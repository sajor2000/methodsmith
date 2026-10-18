import { readFile } from "fs/promises"
import { fileURLToPath } from "url"
import { Language, Parser, Query, type Node } from "web-tree-sitter"

type CodeLanguage = "python" | "r"
type Partition = "train" | "test" | "full"
type Bindings = Map<string, Partition>

const grammarPaths = {
  python: "tree-sitter-python/tree-sitter-python.wasm",
  r: "@davisvaughan/tree-sitter-r/tree-sitter-r.wasm",
}
let languages: Promise<Record<CodeLanguage, Language>> | undefined

function loadLanguages(): Promise<Record<CodeLanguage, Language>> {
  return languages ??= (async () => {
    await Parser.init({
      locateFile: () => fileURLToPath(import.meta.resolve("web-tree-sitter/web-tree-sitter.wasm")),
    })
    const loaded = await Promise.all((["python", "r"] as const).map(async (name) => {
      const language = await Language.load(fileURLToPath(import.meta.resolve(grammarPaths[name])))
      const parser = new Parser()
      let tree
      let query
      try {
        parser.setLanguage(language)
        const extension = name === "python" ? "py" : "R"
        tree = parser.parse(await readFile(new URL(`./fixtures/parser-smoke.${extension}`, import.meta.url), "utf8"))
        query = new Query(language, "(for_statement) @resampling")
        if (!tree || tree.rootNode.hasError || query.matches(tree.rootNode).length !== 1) {
          throw new Error(`code_query ${name} grammar failed its smoke fixture`)
        }
      } finally {
        query?.delete()
        tree?.delete()
        parser.delete()
      }
      return language
    }))
    return { python: loaded[0]!, r: loaded[1]! }
  })()
}

export async function validateCodeQuery(language: unknown, query: unknown): Promise<void> {
  if (language !== "python" && language !== "r") throw new Error("code_query.language must be python or r")
  if (query !== "tuning_inside_resampling") throw new Error("code_query.query must be tuning_inside_resampling")
  await loadLanguages()
}

function nodes(root: Node, type: string): Node[] {
  const result: Node[] = []
  const visit = (node: Node) => {
    if (node.type === type) result.push(node)
    node.namedChildren.forEach(visit)
  }
  visit(root)
  return result
}

function owner(node: Node): Node {
  let current = node.parent
  while (current?.parent && current.type !== "function_definition") current = current.parent
  return current ?? node
}

function calls(root: Node): Node[] {
  const scope = root.type === "function_definition" ? root : owner(root)
  return nodes(root, "call").filter((call) => {
    if (owner(call).id !== scope.id) return false
    let parent = call.parent
    while (parent && parent.id !== root.id) {
      if (parent.type === "if_statement" &&
          ["False", "false", "0"].includes(field(parent, "condition")?.text ?? "")) {
        const body = field(parent, "consequence")
        if (body && body.startIndex <= call.startIndex && body.endIndex >= call.endIndex) return false
      }
      parent = parent.parent
    }
    return true
  })
}

function field(node: Node, name: string): Node | undefined {
  return node.childForFieldName(name) ?? undefined
}

function args(call: Node): Node[] {
  return (field(call, "arguments")?.namedChildren ?? [])
    .filter((node) => node.type !== "comma")
    .map((node) => ["argument", "keyword_argument"].includes(node.type) ? field(node, "value") ?? node : node)
}

function argumentName(argument: Node): string | undefined {
  const parent = argument.parent
  if (parent?.type === "keyword_argument" || parent?.type === "argument") return field(parent, "name")?.text
  return undefined
}

function argumentFor(actual: Node[], parameter: string, index: number): Node | undefined {
  return actual.find((argument) => argumentName(argument) === parameter) ??
    (actual[index] ?? (actual[0]?.type === "list_splat" ? actual[0] : undefined))
}

function assignments(root: Node): Array<{ node: Node; left: Node; right: Node }> {
  const result: Array<{ node: Node; left: Node; right: Node }> = []
  for (const node of [...nodes(root, "assignment"), ...nodes(root, "binary_operator")]) {
    if (node.type === "binary_operator" && !["<-", "="].includes(field(node, "operator")?.text ?? "")) continue
    const left = field(node, "left") ?? field(node, "lhs")
    const right = field(node, "right") ?? field(node, "rhs")
    if (left && right) result.push({ node, left, right })
  }
  return result.sort((a, b) => a.node.startIndex - b.node.startIndex)
}

function binding(name: string, at: Node): Node | undefined {
  const assigned = assignments(owner(at)).filter(({ node, left }) =>
    node.endIndex < at.startIndex && owner(node).id === owner(at).id &&
    (left.text === name || left.namedChildren.some((child) => child.text === name)),
  ).at(-1)
  if (!assigned) return undefined
  let parent = assigned.node.parent
  while (parent && parent.id !== owner(at).id) {
    if (parent.type === "if_statement") {
      const arm = [field(parent, "consequence"), ...parent.childrenForFieldName("alternative")]
        .find((node) => node && node.startIndex <= assigned.node.startIndex && node.endIndex >= assigned.node.endIndex)
      if (arm && !(arm.startIndex <= at.startIndex && arm.endIndex >= at.endIndex)) return assigned.node
    }
    parent = parent.parent
  }
  return assigned.right
}

function functionName(fn: Node): string {
  if (fn.parent?.type === "binary_operator") return field(fn.parent, "lhs")?.text ?? ""
  return field(fn, "name")?.text ?? ""
}

function topLevelFunctions(root: Node): Map<string, Node> {
  const result = new Map<string, Node>()
  for (const fn of nodes(root, "function_definition")) {
    let parent = fn.parent
    while (parent && !["class_definition", "function_definition"].includes(parent.type)) parent = parent.parent
    if (!parent) result.set(functionName(fn), fn)
  }
  return result
}

function callableBinding(callee: Node): Node | undefined {
  const local = binding(callee.text, callee)
  if (local) return local
  const scope = owner(callee)
  if (!scope.parent) return undefined
  return assignments(callee.tree.rootNode).filter(({ node, left }) =>
    !owner(node).parent && left.text === callee.text).at(-1)?.right
}

function resolveFunction(callee: Node | undefined, functions: Map<string, Node>, depth = 0): Node | undefined {
  if (!callee || callee.type !== "identifier" || depth > 8) return undefined
  const scope = owner(callee)
  if (scope.type === "function_definition" && parameterNames(scope).includes(callee.text)) return undefined
  const assigned = callableBinding(callee)
  if (assigned?.type === "function_definition" && functions.get(functionName(assigned))?.id === assigned.id) return assigned
  if (assigned) return resolveFunction(assigned, functions, depth + 1)
  return functions.get(callee.text)
}

function isSearchConstructor(callee: Node | undefined, functions: Map<string, Node>, depth = 0): boolean {
  if (!callee || depth > 8 || resolveFunction(callee, functions)) return false
  const assigned = callee.type === "identifier" ? callableBinding(callee) : undefined
  if (assigned) return isSearchConstructor(assigned, functions, depth + 1)
  const parts = callee.text.split(".")
  const imports = new Map<string, string>()
  for (const statement of [
    ...nodes(callee.tree.rootNode, "import_from_statement"),
    ...nodes(callee.tree.rootNode, "import_statement"),
  ].sort((a, b) => a.startIndex - b.startIndex)) {
    const scope = owner(statement)
    if (scope.parent && scope.id !== owner(callee).id) continue
    if (scope.id === owner(callee).id && statement.startIndex > callee.startIndex) continue
    const module = field(statement, "module_name")?.text
    for (const item of statement.childrenForFieldName("name")) {
      const name = field(item, "name")?.text ?? item.text
      const alias = field(item, "alias")?.text
      imports.set(alias ?? (module ? name : name.split(".")[0]!), module ? `${module}.${name}` : alias ? name : name.split(".")[0]!)
    }
  }
  const canonical = [imports.get(parts[0]!) ?? "", ...parts.slice(1)].join(".")
  return ["sklearn.model_selection.GridSearchCV", "sklearn.model_selection.RandomizedSearchCV"].includes(canonical)
}

function loopIndices(loop: Node): Node[] {
  const target = field(loop, "left")
  if (!target) return []
  const nested = target.namedChildren.find((child) => ["tuple_pattern", "tuple"].includes(child.type))
  return (nested ?? target).namedChildren
}

function indexPartition(index: Node | undefined, loop: Node, bound: Bindings, depth = 0): Partition {
  if (!index || depth > 12) return "full"
  const assigned = index.type === "identifier" ? binding(index.text, index) : undefined
  let enclosing = index.parent
  while (enclosing) {
    if (enclosing.type === "for_statement") {
      const indices = loopIndices(enclosing)
      const position = indices.findIndex((node) => node.text === index.text)
      if (position !== -1) {
        if (assigned && assigned.startIndex > enclosing.startIndex) return indexPartition(assigned, loop, bound, depth + 1)
        return enclosing.id === loop.id ? (position === 0 ? "train" : "test") : "full"
      }
    }
    enclosing = enclosing.parent
  }
  return assigned ? indexPartition(assigned, loop, bound, depth + 1) : bound.get(`index:${index.text}`) ?? "full"
}

function partition(node: Node | undefined, loop: Node, bound: Bindings, depth = 0): Partition {
  if (!node || depth > 32) return "full"
  if (node.type === "identifier") {
    const assigned = binding(node.text, node)
    const writes = assignments(owner(node)).filter(({ node: assignment, left }) =>
      owner(assignment).id === owner(node).id && assignment.endIndex < node.startIndex &&
      (!assigned || assignment.startIndex > assigned.startIndex) &&
      left.type === "subscript" && field(left, "value")?.text === node.text)
    if (writes.length) {
      const values = writes.map(({ right }) => partition(right, loop, bound, depth + 1))
      if (values.every((value) => value === "train")) return "train"
      if (values.every((value) => value === "test")) return "test"
      return "full"
    }
    return assigned ? partition(assigned, loop, bound, depth + 1) : bound.get(node.text) ?? "full"
  }
  if (node.type === "attribute") {
    return partition(field(node, "object"), loop, bound, depth + 1)
  }
  if (node.type === "subscript") {
    const index = field(node, "subscript")
    const base = partition(field(node, "value"), loop, bound, depth + 1)
    if (base !== "full") return base
    return indexPartition(index, loop, bound)
  }
  if (node.type === "list_splat") return partition(node.namedChildren[0], loop, bound, depth + 1)
  if (node.type === "call") {
    const callee = field(node, "function")
    if (callee?.type === "attribute" &&
        ["predict_proba", "predict", "risk", "probability", "raw_probability"].includes(field(callee, "attribute")?.text ?? "")) {
      return partition(args(node)[0], loop, bound, depth + 1)
    }
    if (["rsample::analysis", "rsample::assessment"].includes(callee?.text ?? "") &&
        args(node)[0]?.text === field(loop, "variable")?.text) {
      return callee?.text === "rsample::analysis" ? "train" : "test"
    }
    if (["rsample::vfold_cv", "rsample::group_vfold_cv"].includes(callee?.text ?? "")) {
      return partition(args(node)[0], loop, bound, depth + 1)
    }
    if (callee?.type === "attribute" && field(callee, "attribute")?.text === "take") {
      const base = partition(field(callee, "object"), loop, bound, depth + 1)
      if (base !== "full") return base
      return indexPartition(args(node)[0], loop, bound)
    }
    if (callee?.type === "attribute" && ["astype", "to_numpy"].includes(field(callee, "attribute")?.text ?? "")) {
      return partition(field(callee, "object"), loop, bound, depth + 1)
    }
    const record = nodes(node.tree.rootNode, "class_definition").find((definition) =>
      field(definition, "name")?.text === callee?.text &&
      definition.parent?.type === "decorated_definition" &&
      definition.parent.namedChildren.some((child) =>
        child.type === "decorator" && nodes(child, "identifier").some((name) => name.text === "dataclass")) &&
      !nodes(definition, "function_definition").some((method) => field(method, "name")?.text === "__init__"))
    if (["pd.DataFrame", "np.asarray", "np.array", "np.clip"].includes(callee?.text ?? "")) {
      return partition(args(node)[0], loop, bound, depth + 1)
    }
    if (record || callee?.text === "Subset") {
      const values = args(node).map((arg) => partition(arg, loop, bound, depth + 1))
      if (values.length && values.every((value) => value === "train")) return "train"
      if (values.length && values.every((value) => value === "test")) return "test"
    }
    const helper = resolveFunction(callee, topLevelFunctions(node.tree.rootNode))
    if (helper) {
      const actual = args(node)
      const parameters = parameterNames(helper)
      const nested: Bindings = new Map()
      parameters.forEach((name, i) => {
        const value = argumentFor(actual, name, i)
        nested.set(name, partition(value, loop, bound, depth + 1))
        nested.set(`index:${name}`, indexPartition(value, loop, bound))
      })
      const returned = nodes(field(helper, "body")!, "return_statement").at(-1)
      const values = returned?.namedChildren[0]
      if (values) {
        const partitions = (["expression_list", "tuple"].includes(values.type) ? values.namedChildren : [values])
          .map((value) => partition(value, loop, nested, depth + 1))
        if (partitions.length && partitions.every((value) => value === "train")) return "train"
        if (partitions.length && partitions.every((value) => value === "test")) return "test"
      }
    }
  }
  return "full"
}

function resamplingSource(node: Node | undefined, depth = 0): boolean {
  if (!node || depth > 8) return false
  if (node.type === "identifier") return resamplingSource(binding(node.text, node), depth + 1)
  if (node.type === "extract_operator" && field(node, "rhs")?.text === "splits") return true
  return nodes(node, "call").some((call) => field(call, "function")?.text.endsWith(".split")) ||
    (node.type === "call" && args(node).some((arg) => resamplingSource(arg, depth + 1)))
}

function parameterNames(fn: Node): string[] {
  return (field(fn, "parameters")?.namedChildren ?? []).filter((parameter) => parameter.type !== "comma").map((parameter) =>
    field(parameter, "name")?.text ?? parameter.namedChildren.find((child) => child.type === "identifier")?.text ?? parameter.text)
}

function fitPartitions(call: Node, loop: Node, bound: Bindings, functions: Map<string, Node>): Partition[] {
  const callee = field(call, "function")
  if (callee?.type === "attribute" && field(callee, "attribute")?.text === "fit") {
    return args(call).slice(0, 2).map((arg) => partition(arg, loop, bound))
  }
  const helper = resolveFunction(callee, functions)
  if (!helper) return []
  const parameters = parameterNames(helper)
  const fit = calls(field(helper, "body")!).find((nested) => {
    const name = field(nested, "function")
    return name?.type === "attribute" && field(name, "attribute")?.text === "fit"
  })
  if (!fit) return []
  const actual = args(call)
  const nested = new Map(parameters.map((name, index) => [name, partition(argumentFor(actual, name, index), loop, bound)]))
  return args(fit).slice(0, 2).map((arg) => partition(arg, loop, nested))
}

function candidateParameter(loop: Node): Node | undefined {
  const target = field(loop, "left")
  if (target?.type === "identifier") return target
  const last = target?.namedChildren.at(-1)
  return last?.type === "identifier" ? last : undefined
}

function references(node: Node, names: Set<string>, depth = 0): boolean {
  if (depth > 8) return false
  if (node.type === "identifier") {
    if (names.has(node.text)) return true
    const value = binding(node.text, node)
    return !!value && references(value, names, depth + 1)
  }
  return node.namedChildren.some((child) => references(child, names, depth + 1))
}

function carriesParameter(node: Node | undefined, names: Set<string>, functions: Map<string, Node>, depth = 0): boolean {
  if (!node || depth > 16) return false
  if (node.type === "keyword_argument") return carriesParameter(field(node, "value"), names, functions, depth + 1)
  if (node.type === "identifier") {
    const value = binding(node.text, node)
    return value ? carriesParameter(value, names, functions, depth + 1) : names.has(node.text)
  }
  if (node.type === "call") {
    const helper = resolveFunction(field(node, "function"), functions)
    if (helper) {
      const actual = args(node)
      const nested = new Set(parameterNames(helper).filter((name, index) =>
        carriesParameter(argumentFor(actual, name, index), names, functions, depth + 1)))
      return nodes(field(helper, "body")!, "return_statement")
        .filter((returned) => owner(returned).id === helper.id)
        .some((returned) => returned.namedChildren.some((value) =>
          carriesParameter(value, nested, functions, depth + 1)))
    }
    return args(node).some((arg) => carriesParameter(arg, names, functions, depth + 1))
  }
  return node.namedChildren.some((child) => carriesParameter(child, names, functions, depth + 1))
}

function variesEstimator(call: Node, candidate: Node, functions: Map<string, Node>): boolean {
  const callee = field(call, "function")
  const names = new Set([candidate.text])
  if (callee?.type === "attribute" && field(callee, "attribute")?.text === "fit") {
    return carriesParameter(field(callee, "object"), names, functions)
  }
  const helper = resolveFunction(callee, functions)
  if (!helper) return false
  const actual = args(call)
  const nested = new Set(parameterNames(helper).filter((name, index) =>
    carriesParameter(argumentFor(actual, name, index), names, functions)))
  return calls(field(helper, "body")!).some((fit) => {
    const method = field(fit, "function")
    return method?.type === "attribute" && field(method, "attribute")?.text === "fit" &&
      carriesParameter(field(method, "object"), nested, functions)
  })
}

function manualSearchLoops(root: Node): Node[] {
  const scope = root.type === "function_definition" ? root : owner(root)
  return nodes(root, "for_statement").filter((loop) => {
    if (owner(loop).id !== scope.id) return false
    const candidate = candidateParameter(loop)
    if (!candidate) return false
    const body = field(loop, "body")!
    if (!calls(body).some((call) => ["log_loss", "brier_score_loss"].includes(field(call, "function")?.text ?? ""))) return false
    const conditionalSelection = nodes(body, "if_statement").some((conditional) => {
      const condition = field(conditional, "condition")
      if (!condition || !nodes(condition, "comparison_operator")
        .some((comparison) => comparison.children.some((child) => ["<", ">", "<=", ">="].includes(child.text)))) return false
      return assignments(field(conditional, "consequence")!).some(({ right }) =>
        nodes(right, "identifier").some((value) => value.text === candidate.text))
    })
    if (conditionalSelection) return true
    const series = new Set<string>()
    for (const call of calls(body)) {
      const callee = field(call, "function")
      if (callee?.type === "attribute" && field(callee, "attribute")?.text === "append") {
        const name = field(callee, "object")
        if (name?.type === "identifier") series.add(name.text)
      }
    }
    for (const { left } of assignments(body)) {
      if (left.type === "subscript") {
        const name = field(left, "value")
        if (name?.type === "identifier") series.add(name.text)
      }
    }
    return calls(owner(loop)).some((call) =>
      call.startIndex > loop.endIndex &&
      ["min", "max", "np.argmin", "np.argmax"].includes(field(call, "function")?.text ?? "") &&
      args(call).some((arg) => references(arg, series)))
  })
}

function doesModelWork(root: Node, functions: Map<string, Node>, depth = 0): boolean {
  if (depth > 3) return false
  return calls(root).some((call) => {
    const callee = field(call, "function")
    if (!callee) return false
    if (callee.type === "attribute" &&
        ["fit", "predict", "predict_proba", "risk", "raw_risk", "probability", "raw_probability"]
          .includes(field(callee, "attribute")?.text ?? "")) return true
    if (["tune::tune_grid", "tune::tune_bayes"].includes(callee.text)) return true
    const fn = resolveFunction(callee, functions)
    return !!fn && doesModelWork(field(fn, "body")!, functions, depth + 1)
  })
}

function tunerCalls(root: Node, loop: Node, bound: Bindings, functions: Map<string, Node>, depth: number,
  searches = new Map<string, Node>()): Partition[][] {
  if (depth > 2) return []
  const events: Partition[][] = []
  for (const searchLoop of manualSearchLoops(root)) {
    const candidate = candidateParameter(searchLoop)!
    const fits: Partition[][] = []
    for (const call of nodes(field(searchLoop, "body")!, "call")) {
      if (!variesEstimator(call, candidate, functions)) continue
      const data = fitPartitions(call, loop, bound, functions)
      if (data.length === 2) fits.push(data)
    }
    if (fits.length) {
      events.push(...fits)
      for (const score of calls(field(searchLoop, "body")!)) {
        if (["log_loss", "brier_score_loss"].includes(field(score, "function")?.text ?? "")) {
          events.push(args(score).slice(0, 2).map((arg) => partition(arg, loop, bound)))
        }
      }
    }
  }
  for (const call of calls(root)) {
    const callee = field(call, "function")
    if (!callee) continue
    if (["tune::tune_grid", "tune::tune_bayes"].includes(callee.text)) {
      const resamples = args(call).find((arg) => field(arg.parent!, "name")?.text === "resamples")
      events.push([partition(resamples, loop, bound)])
    }
    if (callee.type === "attribute" && field(callee, "attribute")?.text === "fit") {
      const receiver = field(callee, "object")
      const definition = receiver?.type === "identifier" ?
        binding(receiver.text, receiver) ?? searches.get(receiver.text) : receiver
      if (definition?.type === "call" &&
          isSearchConstructor(field(definition, "function"), functions)) {
        events.push(args(call).slice(0, 2).map((arg) => partition(arg, loop, bound)))
      }
    }
    const helper = resolveFunction(callee, functions)
    if (helper) {
      const actual = args(call)
      const parameters = parameterNames(helper)
      const nested = new Map(parameters.map((parameter, i) =>
        [parameter, partition(argumentFor(actual, parameter, i), loop, bound)]))
      parameters.forEach((parameter, i) =>
        nested.set(`index:${parameter}`, indexPartition(argumentFor(actual, parameter, i), loop, bound)))
      const nestedSearches = new Map<string, Node>()
      parameters.forEach((parameter, index) => {
        const value = argumentFor(actual, parameter, index)
        const definition = value?.type === "identifier" ?
          binding(value.text, value) ?? searches.get(value.text) : value
        if (definition) nestedSearches.set(parameter, definition)
      })
      events.push(...tunerCalls(field(helper, "body")!, loop, nested, functions, depth + 1, nestedSearches))
    }
  }
  return events
}

function fitDataPartitions(scope: Node, reference: Node, bound: Bindings, functions: Map<string, Node>): Partition[] {
  const data: Partition[] = []
  for (const call of nodes(scope, "call")) {
    const callee = field(call, "function")
    if (callee && ["tune::tune_grid", "tune::tune_bayes"].includes(callee.text)) {
      const resamples = args(call).find((argument) => field(argument.parent!, "name")?.text === "resamples")
      data.push(partition(resamples, reference, bound))
    }
    data.push(...fitPartitions(call, reference, bound, functions))
  }
  return data
}

function trainingOnlyFitData(loop: Node, reference: Node, bound: Bindings, functions: Map<string, Node>): boolean {
  const data = fitDataPartitions(field(loop, "body")!, reference, bound, functions)
  return data.length > 0 && data.every((value) => value === "train")
}

function trainingOnlyWithin(loop: Node, enclosing: Node, functions: Map<string, Node>): boolean {
  const enclosingBody = field(enclosing, "body")
  if (!enclosingBody) return false
  if (enclosingBody.startIndex <= loop.startIndex && enclosingBody.endIndex >= loop.endIndex) {
    return trainingOnlyFitData(loop, enclosing, new Map(), functions)
  }
  return trainingOnlyHelper(loop, enclosingBody, enclosing, new Map(), functions, 0) === true
}

function trainingOnlyHelper(loop: Node, root: Node, reference: Node, bound: Bindings,
  functions: Map<string, Node>, depth: number): boolean | undefined {
  if (depth > 2) return undefined
  let found = false
  let safe = true
  for (const call of nodes(root, "call")) {
    const helper = resolveFunction(field(call, "function"), functions)
    if (!helper) continue
    const actual = args(call)
    const parameters = parameterNames(helper)
    const nested: Bindings = new Map()
    parameters.forEach((parameter, index) => {
      const value = argumentFor(actual, parameter, index)
      nested.set(parameter, partition(value, reference, bound))
      nested.set(`index:${parameter}`, indexPartition(value, reference, bound))
    })
    const body = field(helper, "body")!
    if (body.startIndex <= loop.startIndex && body.endIndex >= loop.endIndex) {
      found = true
      safe = trainingOnlyFitData(loop, reference, nested, functions) && safe
    } else {
      const nestedResult = trainingOnlyHelper(loop, body, reference, nested, functions, depth + 1)
      if (nestedResult !== undefined) {
        found = true
        safe = nestedResult && safe
      }
    }
  }
  return found ? safe : undefined
}

export async function evaluateCodeQuery(source: string, language: unknown, queryName: unknown) {
  await validateCodeQuery(language, queryName)
  const grammar = (await loadLanguages())[language === "python" ? "python" : "r"]
  const parser = new Parser()
  let tree
  let query
  try {
    parser.setLanguage(grammar)
    tree = parser.parse(source)
    if (!tree || tree.rootNode.hasError) return { passed: false, evidence: "code_query: invalid source syntax" }
    query = new Query(grammar, "(for_statement) @resampling")
    const functions = topLevelFunctions(tree.rootNode)
    const candidates = query.captures(tree.rootNode).map((capture) => capture.node)
      .filter((loop) => !manualSearchLoops(owner(loop)).some((search) =>
        search.startIndex <= loop.startIndex && search.endIndex >= loop.endIndex))
      .filter((loop) => resamplingSource(field(loop, "right") ?? field(loop, "sequence")))
      .filter((loop) => doesModelWork(field(loop, "body")!, functions))
    const loops = candidates.filter((loop) => !candidates.some((enclosing) =>
      enclosing.id !== loop.id && trainingOnlyWithin(loop, enclosing, functions)))
    const outcomes = loops.map((loop) => {
      const events = tunerCalls(field(loop, "body")!, loop, new Map(), functions, 0)
      const passed = events.length > 0 && events.every((event) =>
        event.length >= (language === "r" ? 1 : 2) && event.every((p) => p === "train"))
      return { line: loop.startPosition.row + 1, events, passed }
    })
    const passed = outcomes.length > 0 && outcomes.every((outcome) => outcome.passed)
    return { passed, evidence: `code_query ${queryName}: ${JSON.stringify(outcomes)}` }
  } finally {
    query?.delete()
    tree?.delete()
    parser.delete()
  }
}
