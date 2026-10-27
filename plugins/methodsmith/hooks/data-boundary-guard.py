#!/usr/bin/env python3
"""methodsmith sensitive-data boundary guard (Claude Code PreToolUse hook).

Two functions carry the policy and are unit-tested in-process:

  resolve_mode(context) -> the project's boundary for this tool call
  classify(call, mode)  -> None (allow) or {"kind", "reason"} (deny)

Modes come from `phi_environment.mode` in the machine-local
`.methodsmith/config.local.yaml` (worktree first, then the main checkout):

  approved           endpoint approved for the data -> no access limits
  no-sensitive-data  public or synthetic data       -> no access limits
  schema-only        endpoint not approved          -> data values stay out
  off                not a methodsmith project    -> hook does nothing

Legacy keys map onto it: compliant: true -> approved, compliant: false ->
schema-only, sensitive_data: false -> no-sensitive-data. Any explicit
schema-only signal wins a conflict. An unreadable or misspelled value, or no
saved answer, also resolves to schema-only, with a deny reason that says why.
A project that still has only the pre-rename state folder is schema-only until
the folder is moved; that folder is read only for data_root, the identifier
index, and run outputs, never for its mode.

Egress (every mode except off): MCP tool arguments and Bash HTTP requests
(curl/wget/httpie/xh to any host, so NCBI E-utilities by name or IP, and the
method-pubmed script, also inside sh -c or eval) must not carry identifiers (SSN,
email, phone, keyword-anchored MRN/patient/member/claim IDs, DOB, or a value
in the project's hashed identifier index), MCP tools must not receive data
files, and Bash must not upload data files (as arguments, or through a pipe or
`<` redirect into curl/wget/nc/ncat/socat/openssl/ftp/ssh and similar). An
endpoint approval does not cover third-party services.

Schema-only access: Read/Grep/NotebookRead and Edit/MultiEdit/NotebookEdit
(they return a snippet) on data files (including data_root and method-safe-run
logs), Bash/Monitor/PowerShell commands whose text references a data path (any
program except a metadata allowlist), inline interpreter code that opens data,
and recursive content searches are denied. Script files are read statically
(1 MB cap) and denied when they name a data path or call a reader on a variable
path, unless the command runs through the plugin's method-safe-run, however the
script is launched: python/Rscript/bash/sh/quarto render/jupyter nbconvert
--execute, run wrappers (uv/pdm/poetry run), a direct path with a script
extension or interpreter shebang, stdin, source/., python -m for a project
module, Rscript -e source(), and sh -c/bash -c/eval code. Workflow runners
(make, snakemake, pytest, dvc, npm/pnpm/yarn/bun run scripts, targets::tar_make,
rmarkdown::render, and similar) are denied unless run through method-safe-run.
Relative, cd, -C, symlinked, and inline-code paths anchor the project they
reach, so a call from outside a project gets that project's boundary (strictest
wins). Unquoted shell wildcards are expanded (bounded) and checked match by
match; an over-cap expansion is data in schema-only access checks.
Inside method-safe-run only the copy rule still applies (output stays in the log),
and files a run wrote (runs/outputs.txt) are data afterwards. Tables under
phi_environment.aggregate_dirs print through the plugin's method-aggregate-read,
which reads once and checks the bytes it prints (no identifier headers or
indexed cells, no counts 1-10, at most 500 rows); a hook-time check of a later
shell or script read could be raced. Markdown tables, which are not data
files, are also checked on Read and cat. Limits: the script check is
heuristic; obfuscation the parser cannot see is out of scope; this is defense
in depth, not a sandbox.

Fail mode: config problems resolve to schema-only. An unexpected internal error
denies only calls that mention a data-like path or an upload; anything else is
allowed with a one-line stderr warning. Stdlib only; silent on allow.
"""

import fnmatch
import json
import os
import re
import shlex
import sys
import time

# One definition of a data file. schema-peek.py embeds an identical list (tested).
DATA_EXTS = (
    "csv", "tsv", "psv", "tab", "dat", "parquet", "feather", "arrow", "orc",
    "avro", "xlsx", "xlsm", "xlsb", "xls", "ods", "sas7bdat", "sas7bcat",
    "xpt", "dta", "sav", "zsav", "por", "rds", "rdata", "rda", "fst", "pkl",
    "pickle", "npy", "npz", "h5", "hdf5", "sqlite", "sqlite3", "db", "duckdb",
    "jsonl", "ndjson",
)
# Suffixes that wrap a data extension (data.csv.gz, data.csv.bak).
WRAP_EXTS = ("gz", "bz2", "xz", "zst", "zip", "7z", "bak", "orig", "old", "tmp", "part")
# Anything under data_root is data, including .json/.txt/.xml and archives.
DATA_REF = re.compile(
    r"(?<!pyarrow)(?<!pandas)(?<!polars)\.(?:"
    + "|".join(sorted(DATA_EXTS, key=len, reverse=True))
    + r")(?:\.(?:" + "|".join(WRAP_EXTS) + r"))*(?!\w|\.\w)",
    re.IGNORECASE,
)
DATAISH_DIRS = {"data", "raw", "rawdata", "restricted", "phi", "extract", "extracts",
                "private", "secure", "source_data", "sourcedata"}
CODE_EXTS = {
    "py", "r", "rmd", "qmd", "jl", "sh", "bash", "zsh", "sql", "js", "mjs", "cjs",
    "ts", "tsx", "jsx", "rb", "go", "rs", "java", "c", "h", "cc", "cpp", "hpp",
    "cs", "swift", "kt", "scala", "lua", "pl", "php", "do", "ado", "sas", "m",
    "md", "rst", "tex", "bib", "yaml", "yml", "toml", "cfg", "ini", "html", "css",
}
CODE_TYPES = {
    "py", "python", "r", "sh", "bash", "js", "ts", "typescript", "rust", "go",
    "java", "c", "cpp", "ruby", "lua", "julia", "sql", "md", "markdown", "yaml",
    "toml", "tex", "html", "css", "php", "perl", "swift", "kotlin", "scala",
}
SCRIPT_EXTS = {"py", "r", "sh", "bash", "zsh", "jl", "qmd", "rmd", "js", "mjs", "ts", "rb", "pl", "php", "lua", "do", "sas"}
MODES = ("approved", "schema-only", "no-sensitive-data")
AGGREGATE_DIRS = ("output", "results", "analysis/publication", "analysis/sap-tables")
STATE_DIR = ".methodsmith"
# The pre-rename state folder. An unmoved project fails closed (schema-only); the folder is read only to tighten.
LEGACY_STATE_DIR = ".ce-datascience"  # rebrand:keep
CONFIG_REL = os.path.join(STATE_DIR, "config.local.yaml")

METADATA_VERBS = {
    "ls", "du", "stat", "file", "wc", "mkdir", "rmdir", "rm", "touch", "test", "[",
    "realpath", "readlink", "basename", "dirname", "md5", "md5sum", "shasum",
    "sha1sum", "sha256sum", "chmod", "chown", "chgrp", "cd", "pushd", "popd",
    "tree", "exa", "eza", "nbstripout", "unlink",
}
COPY_VERBS = {"cp", "mv", "ln", "rsync", "install"}
GREP_VERBS = {"grep", "egrep", "fgrep", "zgrep", "rg", "ag", "ack"}
SCRIPT_RUNNERS = re.compile(
    r"^(?:python(?:\d+(?:\.\d+)?)?|pypy\d?|rscript|bash|sh|zsh|julia|node|bun|deno|ruby|perl|php)$")
INTERPRETERS = re.compile(
    r"^(?:python(?:\d+(?:\.\d+)?)?|ipython\d?|pypy\d?|rscript|r|node|bun|deno|perl|ruby|"
    r"julia|php|nu|lua|duckdb|sqlite3|psql|sh|bash|zsh|fish|dash|ksh|pwsh|powershell|osascript)$")
INLINE_FLAG = re.compile(r"^(?:-[A-Za-z]*[ceEr]|-p|-ne|-pe|-cmd|--command|--commands|--eval|--expr|--print|eval|-|<<<)$")
LISTING_FUNCS = re.compile(r"\b(?:glob|iglob|listdir|scandir|walk|iterdir|rglob|list\.files|dir|Sys\.glob|readdir|fs\.ls|dir_ls)\s*\(")
EXEC_CONSUMERS = {"xargs", "parallel", "sh", "bash", "zsh", "while", "until", "source", ".", "eval", "exec"}
WRAPPERS = {"sudo", "time", "nice", "nohup", "command", "builtin", "exec", "stdbuf", "caffeinate", "env"}
RUN_WRAPPERS = {"uv": "run", "poetry": "run", "pipenv": "run", "pixi": "run", "conda": "run",
                "mamba": "run", "micromamba": "run", "hatch": "run", "rye": "run", "pdm": "run"}
# Run-wrapper options that take a value, so the value is never mistaken for the program.
RUN_VALUE_FLAGS = {"-n", "--name", "-p", "--prefix", "--with", "--python", "-e", "--env", "--directory", "--project",
                   "--with-editable", "--with-requirements", "--package", "--extra", "--group", "--only-group",
                   "--no-group", "--env-file", "--index", "--default-index", "--environment"}
SHELLS = {"sh", "bash", "zsh", "dash", "ksh"}
PY_VALUE_FLAGS = {"-X", "-W", "--check-hash-based-pycs"}
# Workflow runners run project code that can read data; in schema-only they run under method-safe-run.
WORKFLOW_RUNNERS = {"make", "gmake", "snakemake", "nextflow", "tox", "nox", "just", "invoke", "inv", "task",
                    "papermill", "pytest", "py.test"}
WORKFLOW_SUBCOMMANDS = {
    "dvc": {"repro", "run", "exp"}, "kedro": {"run"}, "dbt": {"run", "build", "test", "show", "seed", "snapshot"},
    "npm": {"run", "run-script", "test", "t", "start", "restart"},
    "pnpm": {"run", "run-script", "test", "t", "start", "restart"},
}
YARN_BUILTINS = {"add", "install", "remove", "upgrade", "up", "init", "info", "why", "config", "cache", "list",
                 "outdated", "audit", "set", "plugin", "dlx", "workspaces", "help", "login", "logout", "link",
                 "unlink", "pack", "publish", "version", "global", "import", "licenses", "constraints", "explain",
                 "npm", "patch", "rebuild", "search", "stage", "unplug"}
PY_WORKFLOW_MODULES = {"pytest", "tox", "nox", "invoke", "papermill", "snakemake", "unittest", "kedro", "dbt"}
R_WORKFLOW = re.compile(r"\b(?:targets::)?tar_make\w*\s*\(|\b(?:rmarkdown::)?render(?:_site)?\s*\(|"
                        r"\bquarto::quarto_render\s*\(|\bbookdown::render_book\s*\(|\bknitr::(?:knit|purl)\s*\(")
# Inline code that runs a script file: R source()/sys.source(), Python runpy.run_path() and exec(open(...)).
SOURCED = re.compile(r"\b(?:sys\.)?source\s*\(\s*['\"]([^'\"]+)['\"]|\brun_path\s*\(\s*['\"]([^'\"]+)['\"]|"
                     r"\bexec\s*\(\s*open\s*\(\s*['\"]([^'\"]+)['\"]")
FIND_EXEC = ("-exec", "-execdir", "-ok", "-okdir")
SEPARATORS = {";", "&", "&&", "||", "|", "|&", "(", ")", ";;"}
REDIRECTS = {"<", ">", ">>", "<>", ">|", "&>", "&>>", ">&", "<&"}

DOI_OR_PMC = re.compile(r"\b10\.\d{4,9}/[^\s&?#@<>()'\"]+|\bPMC\d+\b", re.IGNORECASE)
RECIPIENT_KEYS = {"email", "emails", "recipient", "recipients", "to", "cc"}
UPLOADISH_TOOL = re.compile(r"upload|import|share|attach|send|export|publish|put|create-file", re.IGNORECASE)
UPLOAD_VERBS = {"curl", "wget", "scp", "sftp", "rsync", "http", "https", "xh", "aws", "gsutil",
                "gcloud", "rclone", "azcopy", "nc", "ncat", "ftp", "lftp"}
# Tools that send their stdin over the network: data piped or redirected into them is an upload.
NETWORK_VERBS = UPLOAD_VERBS | {"socat", "openssl", "telnet", "ssh", "netcat"}
NCBI_HOST = "eutils.ncbi.nlm.nih.gov"
PUBMED_SCRIPT = "pubmed_search.py"
FALLBACK_RISK = re.compile(DATA_REF.pattern + r"|upload|--data|-T\s|=@|\s@[\w./~]", re.IGNORECASE)


# --- identifier index: patterns, normalize, hash, lookup (keep identical across plugin scripts; tested) ---
HASH_WIDTH = 16
# Identifier shapes. Keyword-anchored where digits alone are ambiguous.
IDENTIFIER_PATTERNS = (
    ("an SSN", re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)")),
    ("an email address", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")),
    ("a phone number", re.compile(r"(?<![\d/.])(?:\+?1[-. ]?)?(?:\(\d{3}\)\s?|\d{3}[-. ])\d{3}[-. ]\d{4}(?![\d/])")),
    ("a record identifier", re.compile(
        r"\b(?:mrn|medical[\s_-]*record(?:[\s_-]*(?:number|num|no|#))?|patient[\s_-]*(?:id|identifier|number|no)|"
        r"member[\s_-]*(?:id|number|no)|subscriber[\s_-]*id|claim[\s_-]*(?:number|num|no|id|#)|encounter[\s_-]*id)"
        r"[\s:=#._-]{0,4}[A-Za-z]{0,6}\d{4,}", re.IGNORECASE)),
    ("a date of birth", re.compile(
        r"\b(?:dob|d\.o\.b\.?|date[\s_-]*of[\s_-]*birth|birth[\s_-]*date)\b[\s:=#-]{0,4}"
        r"\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}", re.IGNORECASE)),
)

# Identifier-like column headings, by kind.
HEADER_KINDS = (
    ("email", re.compile(r"^(?:.*_)?e_?mail(?:_.*)?$")),
    ("phone", re.compile(r"^(?:.*_)?(?:phone|telephone|tel|mobile|cell)(?:_.*)?$")),
    ("first", re.compile(r"^(?:first|given|fore)_?name$|^(?:first|given|fname|forename)$")),
    ("last", re.compile(r"^(?:last|family|sur|maiden)_?name$|^(?:last|surname|family|lname)$")),
    ("name", re.compile(r"^(?:(?:patient|pt|member|subscriber|person|full|middle|preferred)_?)?name$")),
    ("id", re.compile(r"^(?:mrn|medical_?record(?:_.*)?|ssn|social_?security(?:_.*)?|claim|subscriber"
                      r"|(?:patient|pt|person|member|subscriber|record|encounter|enrollee|beneficiary)_?(?:id|num|number|no|nbr)"
                      r"|claim_?(?:id|num|number|no|nbr))$")),
    ("dob", re.compile(r"^(?:dob|birth_?date|date_?of_?birth|birth_?dt|birthday|dt_?birth)$")),
    ("address", re.compile(r"^(?:.*_)?(?:address|addr|street)(?:_.*)?$")),
)


def header_kind(name):
    key = re.sub(r"[^a-z0-9]+", "_", str(name).strip().lower()).strip("_")
    for kind, pattern in HEADER_KINDS:
        if pattern.match(key):
            return kind
    return None


def id_tokens(text):
    """Lowercase, fold accents, and split into alphanumeric tokens."""
    import unicodedata  # lazy: only identifier checks need it

    folded = "".join(c for c in unicodedata.normalize("NFKD", str(text)) if not unicodedata.combining(c))
    return re.findall(r"[^\W_]+", folded.lower())


def id_hash(salt, entry):
    import hashlib  # lazy: only identifier checks need it

    return hashlib.sha256(bytes.fromhex(salt) + b"\0" + entry.encode("utf-8")).hexdigest()[:HASH_WIDTH]


# A present but malformed index: every lookup matches, so callers fail closed.
INVALID_INDEX = ("", HASH_WIDTH, "")


def read_index(path):
    """(salt, width, sorted hash blob) from an index file, None when absent, INVALID_INDEX when malformed."""
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (FileNotFoundError, NotADirectoryError):
        return None
    except (OSError, ValueError):
        return INVALID_INDEX
    if not isinstance(data, dict):
        return INVALID_INDEX
    salt, width, blob = data.get("salt"), data.get("width"), data.get("hashes")
    if (not isinstance(salt, str) or not re.fullmatch(r"[0-9a-f]{32,128}", salt) or type(width) is not int
            or width != HASH_WIDTH or not isinstance(blob, str) or len(blob) % width
            or data.get("count") != len(blob) // width or blob != blob.lower()):
        return INVALID_INDEX
    try:
        if len(bytes.fromhex(blob)) * 2 != len(blob):  # fromhex skips whitespace
            return INVALID_INDEX
    except ValueError:
        return INVALID_INDEX
    count = len(blob) // width  # binary search needs sorted keys: check all, or 4096 evenly spaced
    keys = [blob[i * width:(i + 1) * width] for i in range(0, count, max(1, count // 4096))] + [blob[-width:]]
    if any(a >= b for a, b in zip(keys, keys[1:-1])) or (count > 1 and keys[-2] > keys[-1]):
        return INVALID_INDEX
    return salt, width, blob


def _indexed(index, entry):
    if index is INVALID_INDEX:
        return True
    salt, width, blob = index
    key = id_hash(salt, entry)[:width]
    lo, hi = 0, len(blob) // width
    while lo < hi:
        mid = (lo + hi) // 2
        probe = blob[mid * width:(mid + 1) * width]
        if probe == key:
            return True
        if probe < key:
            lo = mid + 1
        else:
            hi = mid
    return False


def index_hit(text, index):
    """True when any 1-3 token n-gram (single tokens only if ID-like) or the whole text is in the index."""
    if index is INVALID_INDEX:
        return True
    tokens = id_tokens(text)
    grams = {" ".join(tokens)} if len(tokens) > 3 else set()
    for size in (1, 2, 3):
        for start in range(len(tokens) - size + 1):
            gram = tokens[start:start + size]
            if size == 1 and (len(gram[0]) < 4 or not any(ch.isdigit() for ch in gram[0])):
                continue
            grams.add(" ".join(gram))
    return any(_indexed(index, gram) for gram in grams)
# --- end identifier index ---

# --- locale packs: opt-in per-project identifier shapes, data in hooks/locales/<locale>.json ---
# A locale is set as `phi_environment.locale` in .methodsmith/config.local.yaml. The pack is data:
# regexes plus (optional) named checksum validators, so new countries need no guard-code changes.
# Checksum-valid matches are treated as identifiers; checksum-INVALID matches (synthetic/test
# fixtures) are allowed, and a malformed or unknown pack fails closed.

_locale_cache: dict = {}


def _checksum_nhs(digits):
    """NHS number: 10 digits, mod 11 over weights 10..2; a computed check of 10 is invalid."""
    d = [int(c) for c in digits]
    total = sum(w * v for w, v in zip(range(10, 1, -1), d[:9]))
    check = (11 - total % 11) % 11
    return check != 10 and d[9] == check


def _checksum_chi(digits):
    """Scottish CHI: 10 digits DDMMYYNNNC, mod 11 over weights 4,5,6,7,2,3,4,5,6."""
    d = [int(c) for c in digits]
    if not (1 <= int(digits[0:2]) <= 31 and 1 <= int(digits[2:4]) <= 12):
        return False
    total = sum(w * v for w, v in zip((4, 5, 6, 7, 2, 3, 4, 5, 6), d[:9]))
    check = (11 - total % 11) % 11
    return check != 10 and d[9] == check


LOCALE_CHECKSUMS = {"nhs": _checksum_nhs, "chi": _checksum_chi}
LOCALE_MALFORMED = object()  # every identifier check fires, like a malformed identifier index

ACTIVE_LOCALE = None


def active_pack():
    return locale_pack(ACTIVE_LOCALE)


def locale_pack(name):
    if not name:
        return None
    if name in _locale_cache:
        return _locale_cache[name]
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "locales", f"{name}.json"),
                  encoding="utf-8") as fh:
            raw = json.load(fh)
        if not isinstance(raw, dict) or not isinstance(raw.get("identifiers"), list) or not raw["identifiers"]:
            raise ValueError("locale pack has no identifiers")
        identifiers = []
        for entry in raw["identifiers"]:
            if not isinstance(entry, dict) or not isinstance(entry.get("pattern"), str):
                raise ValueError("locale pack identifier is malformed")
            checksum = entry.get("checksum")
            if checksum and checksum not in LOCALE_CHECKSUMS:
                raise ValueError("locale pack names an unknown checksum validator")
            identifiers.append((str(entry.get("label", "a locale identifier")), re.compile(entry["pattern"]), checksum))
        columns = []
        for entry in raw.get("columns", []):
            if not isinstance(entry, dict) or not isinstance(entry.get("pattern"), str):
                raise ValueError("locale pack column is malformed")
            columns.append((re.compile(entry["pattern"]), str(entry.get("kind", "id"))))
        pack = {"identifiers": identifiers, "columns": columns}
    except Exception:
        pack = LOCALE_MALFORMED
    _locale_cache[name] = pack
    return pack


# --- end locale packs ---

def _header_patterns():
    """Built-in header patterns plus the active locale's column patterns."""
    pack = active_pack()
    extra = [] if pack is None or pack is LOCALE_MALFORMED else pack["columns"]
    return list(HEADER_KINDS) + extra


INDEX_REL = os.path.join(STATE_DIR, "identifier-index.local.json")
LEGACY_INDEX_REL = os.path.join(LEGACY_STATE_DIR, "identifier-index.local.json")
OUTPUTS = "outputs.txt"  # method-safe-run lists the files its runs wrote here, one project-relative path per line


def run_outputs(mode):
    """Absolute paths of files written by method-safe-run runs: data, because the run read data."""
    if "_outputs" not in mode:
        mode["_outputs"] = set()
        for listing in mode.get("output_lists", []):
            base = os.path.dirname(os.path.dirname(os.path.dirname(listing)))
            try:
                with open(listing, encoding="utf-8", errors="replace") as fh:
                    mode["_outputs"].update(os.path.normpath(os.path.join(base, line)) for line in fh.read().splitlines() if line)
            except OSError:
                continue
    return mode["_outputs"]


def load_index(mode):
    """The project's identifier index, loaded once and only for calls that need it."""
    if "_index" not in mode:
        mode["_index"] = next((i for i in map(read_index, mode.get("index_paths", [])) if i), None)
    return mode["_index"]


class ConfigError(Exception):
    pass


# ---------------------------------------------------------------- resolve_mode

def _git_common_dir(top):
    import subprocess  # only linked worktrees need it

    try:
        out = subprocess.run(["git", "-C", top, "rev-parse", "--path-format=absolute", "--git-common-dir"],
                             capture_output=True, text=True, timeout=3)
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    try:  # git missing or old: parse the gitfile directly
        with open(os.path.join(top, ".git"), encoding="utf-8") as fh:
            line = fh.readline().strip()
        gitdir = os.path.normpath(os.path.join(top, line.split(":", 1)[1].strip()))
        with open(os.path.join(gitdir, "commondir"), encoding="utf-8") as fh:
            return os.path.normpath(os.path.join(gitdir, fh.read().strip()))
    except (OSError, IndexError):
        return None


def _has_state(path):
    return os.path.isdir(os.path.join(path, STATE_DIR)) or os.path.isdir(os.path.join(path, LEGACY_STATE_DIR))


def _locate(anchor, cache):
    """Return (ce_root, main_root) for the project containing anchor, or None.

    cache maps every directory visited on an upward walk to its result, and ("git", top) to the
    main checkout of a linked worktree, so many anchors cost one walk and one `git rev-parse`.
    """
    probe = anchor
    while probe and not os.path.isdir(probe):
        parent = os.path.dirname(probe)
        if parent == probe:
            return None
        probe = parent
    if probe in cache:
        return cache[probe]
    visited, states, top, walk, inherited = [], [], None, probe, False
    while True:
        if walk in cache and not states:
            inherited = True  # nothing below has state, so everything below shares this answer
            break
        visited.append(walk)
        if _has_state(walk):
            states.append(walk)
        if os.path.exists(os.path.join(walk, ".git")):
            top = walk
            break
        parent = os.path.dirname(walk)
        if parent == walk:
            break
        walk = parent
    if inherited:
        result = cache[walk]
        for path in visited:
            cache[path] = result
        return result
    main = None
    if top and os.path.isfile(os.path.join(top, ".git")):
        key = ("git", top)
        if key not in cache:
            common = _git_common_dir(top)
            cache[key] = (os.path.dirname(common.rstrip(os.sep))
                          if common and os.path.basename(common.rstrip(os.sep)) == ".git" else None)
        main = cache[key]
    fallback = top if main and _has_state(main) else None
    nearest = None
    for path in reversed(visited):  # top-down, so each directory sees the nearest state at or above it
        if path in states:
            nearest = path
        ce_root = nearest or fallback
        cache[path] = (ce_root, main) if ce_root else None
    return cache[probe]


def _scalar(raw):
    return raw.split(" #", 1)[0].strip().strip("'\"")


def _parse_bool(raw):
    value = _scalar(raw).lower()
    if value in ("true", "yes", "on"):
        return True
    if value in ("false", "no", "off"):
        return False
    if value in ("", "null", "~"):
        return None
    raise ConfigError


def read_config(path):
    """Parse only phi_environment and data_root. Returns (phi dict or None, data_root, error)."""
    try:
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().splitlines()
    except UnicodeDecodeError:
        return None, None, "it is not UTF-8 text"
    except OSError:
        return None, None, "it cannot be opened"
    phi, data_root, in_phi = None, None, False
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" \t"))
        if indent == 0:
            in_phi = False
            if stripped.startswith("phi_environment:"):
                phi = {}
                rest = stripped[len("phi_environment:"):].strip()
                if rest.startswith("{"):
                    if not rest.rstrip().endswith("}"):
                        return None, data_root, "the phi_environment inline map is not closed"
                    for part in rest.strip()[1:-1].split(","):
                        if ":" in part:
                            key, value = part.split(":", 1)
                            phi[key.strip()] = value
                elif rest and not rest.startswith("#") and _scalar(rest).lower() not in ("null", "~"):
                    return None, data_root, "phi_environment is not a map"
                else:
                    in_phi = True
                continue
        elif in_phi and stripped.startswith("- ") and isinstance(phi.get("aggregate_dirs"), list):
            phi["aggregate_dirs"].append(_scalar(stripped[2:]))
            continue
        elif in_phi and ":" in stripped:
            key, value = stripped.split(":", 1)
            key = key.strip()
            if key == "aggregate_dirs":
                inline = value.split(" #", 1)[0].strip()
                value = [_scalar(v) for v in inline.strip("[]").split(",") if _scalar(v)] if inline else []
            phi[key] = value
            continue
        match = re.match(r"^data_root:\s*(.*)$", stripped)
        if match:
            value = _scalar(match.group(1))
            if value and value.lower() not in ("null", "~"):
                data_root = value
    return phi, data_root, None


def mode_from_config(phi, error):
    """Map phi_environment to (mode, why, detail). Any schema-only signal wins."""
    if error:
        return "schema-only", "unreadable", error
    if not phi:
        return "schema-only", "unset", ""
    signals, bad = [], []
    if "mode" in phi:
        value = _scalar(phi["mode"]).lower().replace("_", "-")
        if value in MODES:
            signals.append(value)
        elif value not in ("", "null", "~"):
            bad.append("mode")
    for key, mapping in (("compliant", {True: "approved", False: "schema-only"}),
                         ("sensitive_data", {False: "no-sensitive-data"})):
        if key in phi:
            try:
                value = _parse_bool(phi[key])
            except ConfigError:
                bad.append(key)
                continue
            if value in mapping:
                signals.append(mapping[value])
    if "schema-only" in signals:
        return "schema-only", "configured", ""
    if bad:
        return "schema-only", "unreadable", f"phi_environment.{bad[0]} has an unrecognized value"
    if "approved" in signals:
        return "approved", "configured", ""
    if "no-sensitive-data" in signals:
        return "no-sensitive-data", "configured", ""
    return "schema-only", "unset", ""


def _project_mode(ce_root, main):
    bases = [ce_root] + ([main] if main else [])
    config = os.path.join(ce_root, CONFIG_REL)
    if not os.path.isfile(config) and main and os.path.isfile(os.path.join(main, CONFIG_REL)):
        config = os.path.join(main, CONFIG_REL)
    legacy = not any(os.path.isdir(os.path.join(base, STATE_DIR)) for base in bases)
    # A pre-rename config is read only for what tightens the boundary, whether or not the project has
    # been (half-)moved: its data_root always adds a data root, and its locale fills in a missing one.
    # Its mode and aggregate_dirs are never taken.
    legacy_config = next((c for c in (os.path.join(b, LEGACY_STATE_DIR, "config.local.yaml") for b in bases)
                          if os.path.isfile(c)), None)
    legacy_phi, legacy_root, _ = read_config(legacy_config) if legacy_config else (None, None, None)
    legacy_locale = legacy_phi.get("locale") if isinstance(legacy_phi, dict) else None
    if legacy:  # only the pre-rename folder exists: schema-only until it is moved
        phi, data_root, mode, why, detail = None, None, "schema-only", "legacy", ""
    else:
        if os.path.isfile(config):
            phi, data_root, error = read_config(config)
        else:
            phi, data_root, error = None, None, None
        mode, why, detail = mode_from_config(phi, error)
    runs = os.path.join(ce_root, STATE_DIR, "runs")  # method-safe-run logs hold raw output
    data_roots = {runs, os.path.realpath(runs)}
    for base in bases:  # logs left in an unmoved pre-rename folder are still data
        legacy_runs = os.path.join(base, LEGACY_STATE_DIR, "runs")
        data_roots.update({legacy_runs, os.path.realpath(legacy_runs)})
    for root in (data_root, legacy_root):
        if not root:
            continue
        expanded = os.path.expanduser(root)
        for base in bases:
            path = os.path.normpath(expanded if os.path.isabs(expanded) else os.path.join(base, expanded))
            data_roots.update({path, os.path.realpath(path)})
    aggregate = set()
    configured = None if legacy else (phi or {}).get("aggregate_dirs")  # never widen from the old folder
    inside = [ce_root, os.path.realpath(ce_root)]
    for rel in (configured if isinstance(configured, list) else AGGREGATE_DIRS):
        path = os.path.normpath(os.path.join(ce_root, os.path.expanduser(rel)))
        real = os.path.realpath(path)
        if path in inside or real in inside or not _under(path, inside) or not _under(real, inside):
            continue  # an aggregate directory must be a subdirectory of its own project
        aggregate.update({path, real})
    aggregate = sorted(aggregate)
    # The pre-rename index and run outputs still count, so an unmoved or half-moved project
    # keeps its identifier and output checks.
    index_paths = [os.path.join(base, rel) for rel in (INDEX_REL, LEGACY_INDEX_REL) for base in bases]
    output_lists = [os.path.join(runs, OUTPUTS)] + [os.path.join(b, LEGACY_STATE_DIR, "runs", OUTPUTS) for b in bases]
    locale = None
    for locale_value in ((phi or {}).get("locale"), legacy_locale):  # the current config's locale wins
        if isinstance(locale_value, str) and _scalar(locale_value):
            locale = _scalar(locale_value)
            break
    return {"mode": mode, "why": why, "detail": detail, "roots": [ce_root], "data_roots": sorted(data_roots),
            "aggregate_dirs": aggregate, "index_paths": index_paths, "output_lists": output_lists,
            "locale": locale or None}


RANK = {"off": 0, "approved": 1, "no-sensitive-data": 1, "schema-only": 2}


DIR_OPTIONS = {"-C": ("git", "make", "gmake"), "--directory": ("make", "gmake", "uv"), "--project": ("uv",)}


def _add_anchor(anchors, path):
    anchors.setdefault(path, None)
    anchors.setdefault(os.path.realpath(path), None)


def _command_anchors(command, cwd, anchors, depth=0):
    """Add every path a shell command may touch, resolved against the directory it runs in.

    Tracks cd/pushd (and subshells), git/make -C and make/uv --directory/--project; recurses into
    inner shell code, command substitutions, and heredoc bodies. A chunk counts when it contains
    `/`, names a data file, or exists on disk, so a bare project folder name anchors too.
    """
    if depth > 3:
        return
    shell, bodies = scan_shell(command)
    for inner in substitutions(shell):
        _command_anchors(inner, cwd, anchors, depth + 1)
    for _, body in bodies:
        _command_anchors(body, cwd, anchors, depth + 1)
    for chunk in re.findall(r"(?:^|[\s'\"=:(<>@])((?:/|~/)[^\s'\";|&<>()`]+)", command):
        _add_anchor(anchors, _resolve(chunk, cwd))
    tokens, _ = tokenize(shell)
    cur, stack, seg = cwd, [], []
    for token in tokens + [";"]:
        if token not in SEPARATORS:
            seg.append(token)
            continue
        if seg:
            cur = _segment_anchors(seg, cur, anchors, depth)
        seg = []
        if token == "(":
            stack.append(cur)
        elif token == ")" and stack:
            cur = stack.pop()


def _segment_anchors(seg, cur, anchors, depth):
    """Anchor one simple command's paths; return the directory later commands run in."""
    _, cmd = unwrap(seg)
    bases, seen = [cur], set()
    for i, token in enumerate(seg):
        seen.add(program(token))
        key, _, value = token.partition("=") if token.startswith("--") else (token, "", "")
        if not value and i + 1 < len(seg):
            value = seg[i + 1]
        if key in DIR_OPTIONS and value and seen.intersection(DIR_OPTIONS[key]):
            base = _resolve(value, cur)
            _add_anchor(anchors, base)
            bases.append(base)
    inner = shell_code(cmd) if cmd else None
    if inner is not None:
        _command_anchors(inner, cur, anchors, depth + 1)
    for token in seg:
        for chunk in _chunks(token):
            if not chunk or chunk.startswith("-"):
                continue
            pathish = "/" in chunk or DATA_REF.search(chunk)
            globbed = isinstance(token, GlobToken) and any(ch in chunk for ch in "*?[")
            for base in bases:
                path = _resolve(chunk, base)
                if pathish or os.path.lexists(path):
                    _add_anchor(anchors, path)
                if globbed:  # the files an unquoted wildcard expands to (cached for classify)
                    for variant in expand_braces(chunk)[:8]:
                        for match in glob_matches(variant, base)[0]:
                            _add_anchor(anchors, match)
    if cmd and program(cmd[0]) in ("cd", "pushd"):
        target = next((t for t in cmd[1:] if not t.startswith("-")), None)
        if target:
            return _resolve(target, cur)
    return cur


def _anchors(context):
    cwd = context.get("cwd") or os.getcwd()
    tool_input = context.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        raise TypeError("tool_input is not an object")
    anchors = {}
    _add_anchor(anchors, cwd)
    for key in ("file_path", "notebook_path", "path"):
        value = tool_input.get(key)
        if isinstance(value, str) and value:
            _add_anchor(anchors, _resolve(value, cwd))
    glob = tool_input.get("glob")
    if isinstance(glob, str) and glob:  # Grep searches under path; the glob's literal folder prefix names a target too
        base = _resolve(tool_input["path"], cwd) if isinstance(tool_input.get("path"), str) and tool_input["path"] else cwd
        literal = re.split(r"[*?\[{]", glob, 1)[0]
        if "/" in literal:
            _add_anchor(anchors, _resolve(literal.rsplit("/", 1)[0] or "/", base))
    command = tool_input.get("command")
    if isinstance(command, str):
        _command_anchors(command, cwd, anchors)
    return cwd, list(anchors)


def resolve_mode(context):
    """Resolve the boundary for a tool call from cwd and the paths it targets. Strictest project wins."""
    reset_glob_budget()  # each guard decision starts here; its wildcard work shares one budget
    cwd, anchors = _anchors(context)
    cache, projects = {}, {}
    best, data_roots, roots, aggregate, index_paths, output_lists = None, set(), [], set(), [], []
    for anchor in anchors:
        found = _locate(anchor, cache)
        if not found or found in projects:
            continue
        project = projects[found] = _project_mode(*found)
        data_roots.update(project["data_roots"])
        aggregate.update(project["aggregate_dirs"])
        index_paths.extend(p for p in project["index_paths"] if p not in index_paths)
        output_lists.extend(p for p in project["output_lists"] if p not in output_lists)
        roots.extend(r for r in project["roots"] if r not in roots)
        if best is None or RANK[project["mode"]] > RANK[best["mode"]]:
            best = project
    if best is None:
        return {"mode": "off", "why": None, "detail": "", "roots": [], "data_roots": [], "aggregate_dirs": [],
                "index_paths": [], "output_lists": [], "cwd": cwd, "locale": None}
    return dict(best, roots=roots, data_roots=sorted(data_roots), aggregate_dirs=sorted(aggregate),
                index_paths=index_paths, output_lists=output_lists, cwd=cwd)


# ------------------------------------------------------------------- data refs

def _resolve(path, cwd):
    path = os.path.expanduser(path)
    if not os.path.isabs(path):
        path = os.path.join(cwd, path)
    return os.path.normpath(path)


def _under(path, roots):
    return any(path == r or path.startswith(r.rstrip(os.sep) + os.sep) for r in roots)


def expand_braces(text, limit=64):
    out, queue = [], [text]
    while queue and len(out) < limit:
        item = queue.pop()
        match = re.search(r"\{([^{}]*,[^{}]*)\}", item)
        if not match:
            out.append(item)
            continue
        for option in match.group(1).split(","):
            queue.append(item[:match.start()] + option + item[match.end():])
    return out or [text]


def notebook_has_outputs(path):
    try:
        with open(path, encoding="utf-8") as fh:
            notebook = json.load(fh)
        return any(cell.get("outputs") for cell in notebook.get("cells", []) if isinstance(cell, dict))
    except FileNotFoundError:
        return False
    except (OSError, ValueError, AttributeError):
        return True  # cannot verify the outputs are empty


GLOB_CAP = 256          # matches checked per wildcard, like a shell expansion cut short
GLOB_SCAN_BUDGET = 300000  # directory entries examined per guard call, across every wildcard and variant
GLOB_DEADLINE = 3.0        # seconds of wildcard expansion per guard call
_GLOB_CACHE: dict = {}
_GLOB_STATE = {"budget": GLOB_SCAN_BUDGET, "deadline": None}


def reset_glob_budget():
    """Start a guard call's wildcard work: a fresh shared scan budget, deadline, and match cache."""
    _GLOB_CACHE.clear()
    _GLOB_STATE["budget"] = GLOB_SCAN_BUDGET
    _GLOB_STATE["deadline"] = time.monotonic() + GLOB_DEADLINE


def glob_matches(pattern, cwd):
    """(up to GLOB_CAP absolute matches, over_cap) for an unquoted shell wildcard, resolved against cwd.

    Hidden names match only a component that starts with `.`, as in the shell. Every wildcard in one
    guard call draws on one GLOB_SCAN_BUDGET of directory entries and one GLOB_DEADLINE; once either is
    spent, this and every later wildcard counts as over the cap, so a huge tree cannot stall the hook.
    """
    key = (pattern, cwd)
    if key in _GLOB_CACHE:
        return _GLOB_CACHE[key]
    if _GLOB_STATE["deadline"] is None:
        _GLOB_STATE["deadline"] = time.monotonic() + GLOB_DEADLINE
    deadline = _GLOB_STATE["deadline"]
    budget = _GLOB_STATE["budget"]
    if budget <= 0 or time.monotonic() > deadline:
        _GLOB_STATE["budget"] = 0
        _GLOB_CACHE[key] = ([], True)
        return _GLOB_CACHE[key]
    path = os.path.expanduser(pattern)
    current = [os.sep if os.path.isabs(path) else cwd]
    parts = [p for p in path.split("/") if p]
    over = False
    for index, part in enumerate(parts):
        last = index == len(parts) - 1
        found = []
        if not any(ch in part for ch in "*?["):
            for base in current:
                candidate = os.path.join(base, part)
                if os.path.lexists(candidate) if last else os.path.isdir(candidate):
                    found.append(candidate)
        else:
            match = re.compile(fnmatch.translate(part)).match
            for base in current:
                try:
                    with os.scandir(base) as entries:
                        for entry in entries:
                            budget -= 1
                            if budget < 0 or (not budget & 4095 and time.monotonic() > deadline):
                                budget, over = 0, True
                                break
                            if entry.name.startswith(".") and not part.startswith("."):
                                continue
                            if not match(entry.name):
                                continue
                            if not last:
                                try:
                                    if not entry.is_dir():
                                        continue
                                except OSError:
                                    continue
                            found.append(os.path.join(base, entry.name))
                            if last and len(found) > GLOB_CAP:
                                over = True
                                break
                except OSError:
                    continue
                if over:
                    break
        current = found
        if over or not current:
            break
    _GLOB_STATE["budget"] = max(budget, 0)
    result = ([os.path.normpath(m) for m in current[:GLOB_CAP]], over)
    _GLOB_CACHE[key] = result
    return result


def _glob_data(raw, cwd, mode, over_cap_is_data):
    """An unquoted wildcard names data when a match does, or (schema-only access) when it is over the cap."""
    memo = mode.setdefault("_glob_refs", {})
    key = (raw, cwd, over_cap_is_data)
    if key not in memo:
        memo[key] = False
        for variant in expand_braces(raw):
            if not any(ch in variant for ch in "*?["):
                continue
            matches, over = glob_matches(variant, cwd)
            if (over and over_cap_is_data) or any(is_data_path(m, cwd, mode) for m in matches):
                memo[key] = True
                break
    return memo[key]


def is_data_path(raw, cwd, mode, over_cap_is_data=False):
    """True when a path names a data file: extension, data_root, symlink target, or a notebook with outputs.

    An unquoted shell wildcard (GlobToken) is expanded and its matches are checked; quoted wildcards and
    literals from code keep the DATAISH_DIRS heuristic below.
    """
    if not raw:
        return False
    if isinstance(raw, GlobToken) and _glob_data(raw, cwd, mode, over_cap_is_data):
        return True
    for variant in expand_braces(raw):
        if DATA_REF.search(variant):
            return True
        path = _resolve(variant, cwd)
        if _under(path, mode["data_roots"]):
            return True
        outputs = run_outputs(mode)
        if outputs and (path in outputs or os.path.realpath(path) in outputs):
            return True
        if any(ch in variant for ch in "*?["):
            parts = [p for p in variant.replace("\\", "/").split("/")[:-1] if p not in ("", ".", "..")]
            if parts and parts[-1].lower() in DATAISH_DIRS:
                return True
            continue
        if os.path.lexists(path):
            real = os.path.realpath(path)
            if real != path and (DATA_REF.search(real) or _under(real, mode["data_roots"])):
                return True
            if real.lower().endswith(".ipynb") and mode["mode"] == "schema-only" and notebook_has_outputs(real):
                return True
    return False


def _chunks(token):
    yield token
    for chunk in re.split(r"[=:,@<>()\"'`]", token):
        if chunk and chunk != token:
            yield chunk


def token_ref(token, cwd, mode, tainted, access=True):
    """A shell word that references data. access=False (egress checks) never fails closed on an over-cap wildcard."""
    if tainted and re.search(r"\$\{?(" + "|".join(map(re.escape, tainted)) + r")\b", token):
        return True
    over_cap_is_data = access and mode["mode"] == "schema-only"
    for chunk in _chunks(token):
        if not chunk or chunk.startswith("-") and "=" not in chunk:
            continue
        if isinstance(token, GlobToken) and chunk is not token and any(ch in chunk for ch in "*?["):
            chunk = GlobToken(chunk)
        has_path_shape = "/" in chunk or "." in chunk or any(ch in chunk for ch in "*?[")
        if has_path_shape or os.path.lexists(_resolve(chunk, cwd)):
            if is_data_path(chunk, cwd, mode, over_cap_is_data):
                return True
    return False


def text_ref(text, cwd, mode):
    """Data reference anywhere in free text (inline code, heredoc bodies)."""
    if any(DATA_REF.search(v) for v in expand_braces(text)):
        return True
    for root in mode["data_roots"]:
        if root in text:
            return True
    for chunk in re.findall(r"[\w.~/*?{},\[\]-]+", text):
        if ("/" in chunk or "*" in chunk) and is_data_path(chunk, cwd, mode):
            return True
    return False


def lists_dataish_dir(text, cwd, mode):
    if not LISTING_FUNCS.search(text):
        return False
    for literal in re.findall(r"['\"]([^'\"]+)['\"]", text):
        head = literal.replace("\\", "/").rstrip("/*").rstrip("/")
        name = head.rsplit("/", 1)[-1].lower()
        if name in DATAISH_DIRS or (head and _under(_resolve(head, cwd), mode["data_roots"])):
            return True
    return False


# -------------------------------------------------------------- shell parsing

def scan_shell(command):
    """Quote-aware pass: drop comments, turn unquoted newlines into ';', and lift heredoc bodies out.

    Returns (shell_text, bodies) where bodies is a list of (header_line, body_text).
    """
    out, bodies, pending = [], [], []
    i, n, quote, line_start = 0, len(command), None, 0
    while i < n:
        ch = command[i]
        if quote:
            out.append(ch)
            if ch == "\\" and quote == '"' and i + 1 < n:
                out.append(command[i + 1])
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch == "\\" and i + 1 < n:
            if command[i + 1] == "\n":
                i += 2
                continue
            out.append(command[i:i + 2])
            i += 2
            continue
        if ch in ("'", '"'):
            quote = ch
            out.append(ch)
            i += 1
            continue
        if ch == "#" and (i == 0 or command[i - 1] in " \t\n;&|("):
            while i < n and command[i] != "\n":
                i += 1
            continue
        if command.startswith("<<", i) and not command.startswith("<<<", i):
            match = re.match(r"<<-?\s*(?:'([^']*)'|\"([^\"]*)\"|\\?([A-Za-z_][\w-]*))", command[i:])
            if match:
                pending.append(match.group(1) or match.group(2) or match.group(3))
                out.append("<< ")
                i += match.end()
                continue
        if ch == "\n":
            header = "".join(out)[line_start:]
            out.append(" ; ")
            i += 1
            for delim in pending:
                body = []
                while i < n:
                    end = command.find("\n", i)
                    line = command[i:] if end == -1 else command[i:end]
                    i = n if end == -1 else end + 1
                    if line.strip() == delim:
                        break
                    body.append(line)
                bodies.append((header, "\n".join(body)))
            pending = []
            line_start = len("".join(out))
            continue
        out.append(ch)
        i += 1
    return "".join(out), bodies


class GlobToken(str):
    """A shell word with an unquoted `*`, `?`, or `[`: the shell expands it against the filesystem."""


GLOB_MARKS = {"*": "\ue000", "?": "\ue001", "[": "\ue002"}
GLOB_UNMARK = str.maketrans({mark: ch for ch, mark in GLOB_MARKS.items()})


def _mark_globs(text):
    """Replace unquoted, unescaped glob characters with private marks, so quoting survives shlex."""
    out, quote, i, n = [], None, 0, len(text)
    while i < n:
        ch = text[i]
        if ch == "\\" and quote != "'" and i + 1 < n:
            out.append(text[i:i + 2])
            i += 2
            continue
        if quote:
            quote = None if ch == quote else quote
        elif ch in ("'", '"'):
            quote = ch
        elif ch in GLOB_MARKS:
            ch = GLOB_MARKS[ch]
        out.append(ch)
        i += 1
    return "".join(out)


def _unmark(token):
    restored = token.translate(GLOB_UNMARK)
    return GlobToken(restored) if restored != token else restored


def tokenize(text):
    """Shell words; a word with an unquoted glob character comes back as a GlobToken."""
    marked = _mark_globs(text)
    try:
        lexer = shlex.shlex(marked, posix=True, punctuation_chars=";&|<>()")
        lexer.whitespace_split = True
        return [_unmark(t) for t in lexer], True
    except ValueError:
        return [_unmark(t) for t in marked.split()], False


def substitutions(text):
    return [m.group(1) or m.group(2) for m in re.finditer(r"[$<>]\(([^()]*)\)|`([^`]*)`", text)]


def segments(tokens):
    """Split tokens into pipelines (lists of segments). Each segment is a token list."""
    pipelines, pipeline, current = [], [], []
    for token in tokens:
        if token in SEPARATORS:
            if current:
                pipeline.append(current)
            current = []
            if token not in ("|", "|&"):
                if pipeline:
                    pipelines.append(pipeline)
                pipeline = []
            continue
        current.append(token)
    if current:
        pipeline.append(current)
    if pipeline:
        pipelines.append(pipeline)
    return pipelines


def program(token):
    return os.path.basename(token).lower()


def unwrap(tokens):
    """Strip assignments and wrappers. Returns (assignments, command tokens)."""
    assignments, rest = [], list(tokens)
    while rest:
        head = rest[0]
        if re.match(r"^[A-Za-z_]\w*=", head):
            assignments.append(head)
            rest.pop(0)
        elif program(head) in ("export", "declare", "local", "readonly", "typeset") and len(rest) > 1:
            rest.pop(0)
            while rest and rest[0].startswith("-"):
                rest.pop(0)
        elif program(head) in WRAPPERS:
            rest.pop(0)
            while rest and rest[0].startswith("-"):
                rest.pop(0)
        elif program(head) == "timeout" and len(rest) > 2:
            rest = rest[2:]
        elif program(head) in RUN_WRAPPERS and len(rest) > 1 and rest[1] == RUN_WRAPPERS[program(head)]:
            rest = rest[2:]
            while rest and rest[0].startswith("-"):
                flag = rest.pop(0)
                if flag in RUN_VALUE_FLAGS and rest:
                    rest.pop(0)
        elif program(head) in ("uvx", "npx", "bunx", "pipx") and len(rest) > 1:
            rest.pop(0)
            if rest and rest[0] == "run":
                rest.pop(0)
        else:
            break
    return assignments, rest


def operands(args):
    """Non-option, non-redirect arguments."""
    out, skip = [], False
    for token in args:
        if skip:
            skip = False
            continue
        if token in REDIRECTS:
            skip = True
            continue
        if token.startswith("-") and token != "-":
            continue
        out.append(token)
    return out


# ------------------------------------------------------------ egress (Bash)

def _remote(token):
    return bool(re.match(r"^(?:[\w.-]+@)?[\w.-]+:(?!//)", token)) or bool(re.match(r"^(?:s3|gs|az|rsync|sftp|ftp)://", token))


def input_refs(seg, cwd, mode, tainted):
    """True when a segment reads a data file: any data reference except the target of an output redirect."""
    skip = False
    for token in seg:
        if skip:
            skip = False
            continue
        if token in (">", ">>", ">|", "&>", "&>>"):
            skip = True
            continue
        if token_ref(token, cwd, mode, tainted, access=False):
            return True
    return False


def stdin_upload(seg, cmd, piped, cwd, mode, tainted):
    """A network tool whose stdin is a data file (`< file`) or a pipe fed by a command that read one."""
    if not cmd or program(cmd[0]) not in NETWORK_VERBS:
        return None
    redirected = any(t == "<" and i + 1 < len(seg) and token_ref(seg[i + 1], cwd, mode, tainted, access=False)
                     for i, t in enumerate(seg))
    if redirected or piped:
        return f"`{program(cmd[0])}` would send a data file from its standard input"
    return None


def upload_violation(cmd, cwd, mode):
    verb = program(cmd[0])
    args = cmd[1:]
    if verb not in UPLOAD_VERBS:
        return None
    sources = []
    if verb in ("curl", "http", "https", "xh"):
        for index, token in enumerate(args):
            nxt = args[index + 1] if index + 1 < len(args) else ""
            if token in ("-T", "--upload-file"):
                sources.append(nxt)
            elif token.startswith("--upload-file="):
                sources.append(token.split("=", 1)[1])
            elif token in ("-F", "--form", "-d", "--data", "--data-binary", "--data-raw", "--data-urlencode", "--json"):
                sources.extend(re.findall(r"[@<]([^;,\s]+)", nxt))
            elif re.match(r"^--(?:data[\w-]*|form|json)=", token):
                sources.extend(re.findall(r"[@<]([^;,\s]+)", token.split("=", 1)[1]))
            elif verb != "curl" and re.match(r"^[\w-]*[@:]?=?@", token):
                sources.extend(re.findall(r"@([^\s]+)", token))
    elif verb == "wget":
        for index, token in enumerate(args):
            if token.startswith(("--post-file=", "--body-file=")):
                sources.append(token.split("=", 1)[1])
            elif token in ("--post-file", "--body-file") and index + 1 < len(args):
                sources.append(args[index + 1])
    else:
        ops = operands(args)
        if any(_remote(t) for t in ops):
            sources.extend(t for t in ops if not _remote(t))
    for source in sources:
        if source and is_data_path(source, cwd, mode):
            return f"`{verb}` would upload a data file"
    return None


# ------------------------------------------------------- schema-only (Bash)

def grep_violation(verb, args, cwd, mode, tainted):
    pattern_seen, files, includes = False, [], []
    recursive = verb in ("rg", "ag", "ack")
    listing = False
    i = 0
    if verb == "git-grep":
        recursive = True
    value_opts = {"-e", "--regexp", "-f", "--file", "-m", "--max-count", "-A", "-B", "-C", "--context",
                  "-d", "--directories", "-D", "--devices", "--include", "--exclude", "--exclude-dir",
                  "-g", "--glob", "--iglob", "-t", "--type", "-T", "--type-not", "--color", "--colour",
                  "-M", "--max-columns", "-j", "--threads", "--label", "--sort", "--sortr",
                  "--type-add", "--type-clear"}
    while i < len(args):
        token = args[i]
        if token in REDIRECTS:
            i += 2
            continue
        if token.startswith("--") and "=" in token:
            key, value = token.split("=", 1)
            if key in ("--include", "--glob", "--iglob", "--type"):
                includes.append(value)
            elif key in ("--type-add", "--type-clear"):
                includes.append("!redefined-type")
            elif key in ("--file",):
                files.append(value)
            elif key == "--directories" and value == "recurse":
                recursive = True
            elif key == "--regexp":
                pattern_seen = True
            i += 1
            continue
        if token in value_opts:
            value = args[i + 1] if i + 1 < len(args) else ""
            if token in ("-e", "--regexp"):
                pattern_seen = True
            elif token in ("-f", "--file"):
                files.append(value)
            elif token in ("--include", "-g", "--glob", "--iglob", "-t", "--type"):
                includes.append(value)
            elif token in ("--type-add", "--type-clear"):
                includes.append("!redefined-type")  # a redefined type is not limited to code
            elif token in ("-d", "--directories") and value == "recurse":
                recursive = True
            i += 2
            continue
        if token.startswith("-") and token != "-":
            if token in ("--recursive", "--dereference-recursive"):
                recursive = True
            elif token in ("--count", "--files-with-matches", "--files-without-match", "--quiet", "--silent", "--files", "--count-matches"):
                listing = True
            elif not token.startswith("--"):
                flags = token[1:]
                if verb not in ("rg", "ag", "ack", "git-grep") and ("r" in flags or "R" in flags):
                    recursive = True
                if any(f in flags for f in ("lcq" if verb == "rg" else "lLcq")):  # rg -L follows symlinks
                    listing = True
            i += 1
            continue
        if not pattern_seen:
            pattern_seen = True
        else:
            files.append(token)
        i += 1
    if listing:
        return None
    if recursive and (not files or any(os.path.isdir(_resolve(f, cwd)) for f in files)):
        code_only = includes and all(_is_code_glob(inc) for inc in includes)
        if not code_only:
            return "a recursive content search can print data rows; add --include/-g/-t limited to code types"
    if any(token_ref(f, cwd, mode, tainted) for f in files):
        return f"`{verb.replace('git-grep', 'git grep')}` on a data file prints its rows"
    return None


def _is_code_glob(value):
    parts = value.split()
    if len(parts) > 1:  # several globs in one value: every one must be a code glob
        return all(_is_code_glob(part) for part in parts)
    value = value.strip()
    if not value or value.startswith("!"):  # a negated glob searches everything else, data included
        return False
    if re.match(r"^[A-Za-z]+$", value):
        return value.lower() in CODE_TYPES
    for variant in expand_braces(value):
        ext = variant.rsplit(".", 1)[-1].lower() if "." in variant else ""
        if ext not in CODE_EXTS:
            return False
    return True


def _git_sub(args):
    """git's arguments from the subcommand on, past global options and their values (`-C dir`)."""
    rest = list(args)
    while rest and rest[0].startswith("-"):
        flag = rest.pop(0)
        if flag in ("-C", "-c", "--git-dir", "--work-tree") and rest:
            rest.pop(0)
    return rest


def git_violation(args, cwd, mode, tainted):
    rest = _git_sub(args)
    if not rest:
        return None
    sub, sub_args = rest[0], rest[1:]
    if sub == "grep":
        return grep_violation("git-grep", sub_args, cwd, mode, tainted)
    if sub in ("add", "rm", "mv", "status", "ls-files", "check-ignore", "check-attr", "commit", "lfs", "stash"):
        return None
    if sub == "log" and not any(t in ("-p", "-u", "--patch", "--full-diff", "--word-diff") or t.startswith("-L")
                                for t in sub_args):
        return None
    if sub in ("diff", "show") and any(t in ("--stat", "--name-only", "--name-status", "--numstat", "--shortstat",
                                               "--summary", "--dirstat", "--quiet", "--exit-code") for t in sub_args):
        return None
    return f"`git {sub}` on a data path prints its contents"


def sed_ok(args, cwd, mode, tainted):
    script, files, i = None, [], 0
    while i < len(args):
        token = args[i]
        if token in ("-e", "--expression"):
            if script is not None:
                return False
            script = args[i + 1] if i + 1 < len(args) else ""
            i += 2
            continue
        if token.startswith("-") or token == "":
            i += 1
            continue
        if script is None:
            script = token
        else:
            files.append(token)
        i += 1
    if script is None or not re.match(r"^s(.)(?:(?!\1).)*\1(?:(?!\1).)*\1[gIip0-9]*$", script):
        return False
    return not any(token_ref(f, cwd, mode, tainted) for f in files)


SCRIPT_CAP = 1 << 20
LITERAL = re.compile(r"'([^'\n]{1,500})'|\"([^\"\n]{1,500})\"")
# Read calls (pandas, polars, pyarrow, readr, haven, readxl, data.table, base R, arrow, duckdb, sqlite).
READ_CALL = re.compile(
    r"(?:\b(?:read_(?:csv|tsv|table|delim|fwf|parquet|feather|ipc|excel|xlsx|xls|sas|stata|dta|spss|sav|xpt|json|rds|orc)"
    r"|read\.(?:csv2?|table|delim2?|dta|xport)|scan_(?:csv|parquet|ipc)|fread|vroom|readRDS|open_dataset|ParquetFile"
    r"|dbConnect)|\barrow::\w+|\bduckdb(?:\.|::)\w+|\bsqlite3?(?:\.|::)\w+)\s*\(\s*([^)\s]?)")


PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))


SAFE_RUNNER = os.path.join(PLUGIN_ROOT, "scripts", "method-safe-run")
AGGREGATE_READER = os.path.join(PLUGIN_ROOT, "scripts", "method-aggregate-read")


def is_plugin_script(token, cwd, script=SAFE_RUNNER):
    """The plugin's own script (same file or byte-identical copy), never a look-alike."""
    path = os.path.realpath(_resolve(os.path.expandvars(token), cwd))
    if path == os.path.realpath(script):
        return True
    try:
        with open(path, "rb") as a, open(script, "rb") as b:
            return a.read(1 << 16) == b.read(1 << 16)
    except OSError:
        return False


_SCANNING = set()


def script_reads_data(path, cwd, mode, kind=None):
    """Static, heuristic: does the script file name a data path? Reads at most 1 MB. Plugin scripts are trusted.

    kind overrides the extension when the language comes from elsewhere ("sh" for a shell shebang or a
    shell fed the file on standard input).
    """
    if _under(os.path.realpath(path), [PLUGIN_ROOT]):
        return False
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            text = fh.read(SCRIPT_CAP)
    except OSError:
        return False
    ext = kind or path.rsplit(".", 1)[-1].lower()
    if ext == "ipynb":
        try:
            cells = json.loads(text).get("cells", [])
            text = "\n".join("".join(c.get("source", "")) for c in cells if isinstance(c, dict))
        except (ValueError, AttributeError, TypeError):
            return True  # cannot verify
    if ext in SHELLS and path not in _SCANNING and len(_SCANNING) < 8:
        _SCANNING.add(path)
        try:
            if bash_violations(text, cwd, mode, 1)[1]:
                return True
        finally:
            _SCANNING.discard(path)
    if lists_dataish_dir(text, cwd, mode):
        return True
    if any(first not in ("'", '"', "") for first in READ_CALL.findall(text)):
        return True  # reads a path held in a variable or argument
    for literal in (a or b for a, b in LITERAL.findall(text)):
        if is_data_path(literal, cwd, mode):  # aggregate tables too: the script reads them later than this check
            return True
    return False


AGGREGATE_EXTS = {"csv": ",", "tsv": "\t", "tab": "\t", "md": None}
AGGREGATE_MAX_ROWS = 500
AGGREGATE_CAP = 2 << 20
AGG_READERS = {"cat", "head", "tail", "less", "more", "bat", "column", "csvlook"}
COUNT_CELL = re.compile(r"^(\d+)(?:\s*\([^()]*\)|\s*/\s*\d+)?\s*%?$")


def aggregate_file(raw, cwd, mode):
    """An existing .csv/.tsv/.md under an aggregate directory (and outside data_root)."""
    ext = _ext(raw)
    return ext in AGGREGATE_EXTS and in_aggregate_dir(raw, cwd, mode) and os.path.isfile(_resolve(raw, cwd))


def _table_rows(text, ext):
    import csv  # only aggregate reads need it

    if len(text) > AGGREGATE_CAP:
        return None
    delimiter = AGGREGATE_EXTS[ext]
    if delimiter:
        rows = [r for r in csv.reader(text.splitlines(), delimiter=delimiter) if any(c.strip() for c in r)]
        return [(True, rows[0])] + [(False, r) for r in rows[1:]] if rows else []
    out, in_table = [], False
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            in_table = False
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if all(re.match(r"^:?-{3,}:?$", c) for c in cells if c):
            continue
        out.append((not in_table, cells))
        in_table = True
    return out


def aggregate_problem(path, mode):
    """Which aggregate rule a table file fails, or None. Never includes a value."""
    with open(path, encoding="utf-8-sig", errors="replace", newline="") as fh:
        return table_problem(fh.read(AGGREGATE_CAP + 1), path.rsplit(".", 1)[-1].lower(), mode)


def read_aggregate(raw, cwd, mode):
    """(problem, text) from one read, so the check and the printed table are the same bytes (no TOCTOU)."""
    if not aggregate_file(raw, cwd, mode):
        return "it is not a .csv, .tsv, or .md file under an aggregate directory", None
    with open(_resolve(raw, cwd), "rb") as fh:
        text = fh.read(AGGREGATE_CAP + 1).decode("utf-8-sig", errors="replace")
    problem = table_problem(text, raw.rsplit(".", 1)[-1].lower(), mode)
    return problem, None if problem else text


def table_problem(text, ext, mode):
    """Which aggregate rule table text fails, or None. Never includes a value."""
    rows = _table_rows(text, ext)
    if rows is None or sum(1 for header, _ in rows if not header) > AGGREGATE_MAX_ROWS:
        return f"it has more than {AGGREGATE_MAX_ROWS} rows"
    index = load_index(mode)
    for header, cells in rows:
        for cell in cells:
            if header and any(pattern.match(re.sub(r"[^a-z0-9]+", "_", cell.lower()).strip("_"))
                              for _, pattern in _header_patterns()):
                return "a column heading names an identifier"
            if any(pattern.search(cell) for _, pattern in IDENTIFIER_PATTERNS):
                return "a cell looks like an identifier"
            if index and index_hit(cell, index):
                return "a cell matches the project's identifier index"
            count = None if header else COUNT_CELL.match(cell)
            if count and 1 <= int(count.group(1)) <= 10:
                return "a count from 1 to 10 breaks the small-cell rule"
    return None


def aggregate_hint(table):
    return (f"`{table}` is a table under an aggregate directory; print it with `{AGGREGATE_READER} {table}`, "
            "which checks and prints the same bytes")


def in_aggregate_dir(raw, cwd, mode):
    """A path under a configured aggregate directory and outside data_root (data_root always wins)."""
    path = _resolve(raw, cwd)
    real = os.path.realpath(path)
    return (_under(path, mode.get("aggregate_dirs", [])) and _under(real, mode.get("aggregate_dirs", []))
            and not _under(path, mode["data_roots"]) and not _under(real, mode["data_roots"]))


def _ext(token):
    return token.rsplit(".", 1)[-1].lower() if "." in os.path.basename(token) else ""


def shebang(path):
    """The known interpreter a file's `#!` line names, else None. Reads 256 bytes; binaries have no `#!`."""
    try:
        with open(path, "rb") as fh:
            head = fh.read(256)
    except OSError:
        return None
    if not head.startswith(b"#!"):
        return None
    words = head[2:].split(b"\n", 1)[0].decode("utf-8", "replace").split()
    if words and program(words[0]) == "env":
        words = [w for w in words[1:] if not w.startswith("-") and "=" not in w]
    name = program(words[0]) if words else ""
    return name if INTERPRETERS.match(name) else None


def script_kind(path, interpreter=None):
    """How to scan a file run as code ("sh" for shell, else its extension or "code"); None when it is not a script.

    A file fed to an interpreter is scanned in that interpreter's language. A file executed directly is
    scanned only with a script extension or a `#!` line naming a known interpreter, so compiled
    binaries are never read.
    """
    ext = _ext(path)
    if interpreter:
        return "sh" if program(interpreter) in SHELLS else (ext or "code")
    if ext in SCRIPT_EXTS or ext == "ipynb":
        return ext
    found = shebang(path)
    if found:
        return "sh" if found in SHELLS else "code"
    return None


def _script_ops(verb, args):
    """An interpreter's operands: no options, option values, or redirects and their targets."""
    out, skip = [], False
    values = PY_VALUE_FLAGS if re.match(r"^(?:python|pypy)", verb) else set()
    for token in args:
        if skip:
            skip = False
            continue
        if token in REDIRECTS or token in values:
            skip = True
            continue
        if token.startswith("-"):
            continue
        out.append(token)
    return out


def _module_flag(args):
    """The module named by python's `-m MOD` (also `-Bm MOD`), else None. Stops at a script or `-c`."""
    skip = False
    for index, token in enumerate(args):
        if skip:
            skip = False
            continue
        if token in PY_VALUE_FLAGS:
            skip = True
            continue
        if re.match(r"^-[A-Za-z]*m$", token):
            return args[index + 1] if index + 1 < len(args) else None
        if not token.startswith("-") or re.match(r"^-[A-Za-z]*c$", token):
            return None
    return None


def module_files(module, cwd, env):
    """Project files `python -m module` runs: pkg/mod.py, pkg/mod/__init__.py, pkg/mod/__main__.py.

    Looked up under the working directory, src/, and directories in an inline PYTHONPATH= assignment.
    An installed module (pytest, http.server) resolves to nothing and is not scanned.
    """
    if not re.fullmatch(r"[A-Za-z_][\w.]*", module or ""):
        return []
    rel = module.replace(".", os.sep)
    dirs = [cwd, os.path.join(cwd, "src")]
    for assignment in env:
        name, _, value = assignment.partition("=")
        if name == "PYTHONPATH":
            dirs.extend(_resolve(part, cwd) for part in value.split(os.pathsep) if part)
    found = []
    for base in dirs:
        for candidate in (rel + ".py", os.path.join(rel, "__init__.py"), os.path.join(rel, "__main__.py")):
            path = os.path.join(base, candidate)
            if os.path.isfile(path) and path not in found:
                found.append(path)
    return found


def _r_file(args):
    """The script `R -f FILE`, `R --file=FILE`, or `R --file FILE` runs, else None."""
    for index, token in enumerate(args):
        if token.startswith("--file="):
            return token[len("--file="):] or None
        if token in ("-f", "--file"):
            return args[index + 1] if index + 1 < len(args) else None
    return None


def launched_scripts(cmd, cwd, fed=(), env=()):
    """(shown name, path, scan kind) for every script file a command runs.

    Covers a path-shaped program run directly, source/., interpreters given a script operand (with a
    script extension, or any existing file, scanned in the interpreter's language), R -f/--file, a script
    fed on standard input (`< file`, or `cat file |` passed in as fed), python -m on a project module,
    quarto render FILE, and jupyter nbconvert --execute.
    """
    verb, args, head = program(cmd[0]), cmd[1:], cmd[0]
    if "/" in head or _ext(head) in SCRIPT_EXTS:
        path = _resolve(head, cwd)
        kind = script_kind(path) if os.path.isfile(path) else None
        if kind:
            return [(head, path, kind)]
    if verb in ("source", "."):
        ops = operands(args)
        return [(ops[0], _resolve(ops[0], cwd), "sh")] if ops else []
    ops = [t for t in args if not t.startswith("-")]
    if verb == "quarto":
        return [(ops[1], _resolve(ops[1], cwd), None)] if ops[:1] == ["render"] and len(ops) > 1 else []
    if verb == "jupyter":
        if ops[:1] == ["nbconvert"] and "--execute" in args:
            notebook = next((t for t in ops[1:] if t.lower().endswith(".ipynb")), None)
            return [(notebook, _resolve(notebook, cwd), None)] if notebook else []
        return []
    if not INTERPRETERS.match(verb):
        return []
    if re.match(r"^(?:python|pypy)", verb):
        module = _module_flag(args)
        if module is not None:
            return [(module, path, "py") for path in module_files(module, cwd, env)]
    if verb == "r":
        script = _r_file(args)
        if script:
            return [(script, _resolve(script, cwd), "r")]
    ops = _script_ops(verb, args)
    if verb in ("bun", "deno") and ops[:1] == ["run"]:
        ops = ops[1:]
    if ops and "-" not in args and not (verb in SHELLS and "-s" in args):
        script = ops[0]
        if SCRIPT_RUNNERS.match(verb) or re.match(r"^ipython\d?$", verb):  # ipython runs a script operand too
            path = _resolve(script, cwd)
            if _ext(script) in SCRIPT_EXTS:
                return [(script, path, None)]
            if os.path.isfile(path):  # `bash bin/analyze`: the interpreter decides the language, not the name
                return [(script, path, script_kind(path, verb))]
        return []
    # The code comes from standard input: a `<` redirect, or the files a `cat` earlier in the pipe printed.
    sources = [args[i + 1] for i, t in enumerate(args[:-1]) if t == "<"] or list(fed)
    return [(s, _resolve(s, cwd), script_kind(_resolve(s, cwd), verb)) for s in sources]


def workflow_runner(verb, args, cwd):
    """The workflow runner a command starts (make, pytest, npm run, ...), as shown in a deny reason, else None."""
    ops = [t for t in args if not t.startswith("-")]
    if verb in WORKFLOW_RUNNERS:
        return verb
    if verb in WORKFLOW_SUBCOMMANDS and ops[:1] and ops[0] in WORKFLOW_SUBCOMMANDS[verb]:
        return f"{verb} {ops[0]}"
    if verb == "yarn" and ops and ops[0] not in YARN_BUILTINS:
        return f"yarn {ops[0]}" if ops[0] == "run" else "yarn"
    if verb == "bun" and ops[:1] == ["run"]:
        target = ops[1] if len(ops) > 1 else ""
        if not target or ("/" not in target and _ext(target) not in SCRIPT_EXTS):
            return "bun run"
    if verb == "quarto" and ops[:1] == ["render"] and (len(ops) == 1 or os.path.isdir(_resolve(ops[1], cwd))):
        return "quarto render"
    if verb == "r" and args[:2] == ["CMD", "BATCH"]:
        return "R CMD BATCH"
    if re.match(r"^(?:python|pypy)", verb):
        module = _module_flag(args)
        if module and module.split(".")[0] in PY_WORKFLOW_MODULES:
            return f"{verb} -m {module.split('.')[0]}"
    return None


def workflow_reason(name):
    return (f"`{name}` runs project code that can read data and print its values; run it as "
            f"`method-safe-run -- {name} ...` so its output stays in the run log")


FIND_PATTERN_OPTS = ("-name", "-iname", "-path", "-ipath", "-wholename", "-iwholename")
FIND_NAME_ONLY_OPTS = ("-name", "-iname")


def find_pattern_data(args, cwd, mode):
    """A find name/path pattern (quoted or not; never expanded) that can match a data file or data_root.

    Case-insensitive fnmatch: the pattern's last component against sample data file names, and a path
    pattern also against the data_root paths as find would print them.
    """
    names = ["x." + ext for ext in DATA_EXTS]
    for i, token in enumerate(args[:-1]):
        if token not in FIND_PATTERN_OPTS:
            continue
        pattern = args[i + 1].lower()
        candidates = [os.path.basename(r).lower() for r in mode["data_roots"]] + names
        if any(fnmatch.fnmatchcase(name, pattern.rsplit("/", 1)[-1]) for name in candidates):
            return True
        if token not in FIND_NAME_ONLY_OPTS:  # -path/-ipath/-wholename match the full path
            for root in mode["data_roots"]:
                rel = os.path.relpath(root, cwd)
                if any(fnmatch.fnmatchcase(c.lower(), pattern) for c in (root + "/x", rel + "/x", "./" + rel + "/x")):
                    return True
    return False


def find_exec_violation(args, cwd, mode):
    """(reason, unrestricted) for find: -exec of a content reader over files not limited to code is denied.

    unrestricted is True when the files find lists are not limited to code or directories, so a
    command that consumes the list (xargs cat, while read) is treated as reading listed data files.
    A name or path pattern that can match a data file lifts the limit (find_pattern_data).
    """
    names = [args[i + 1] for i, t in enumerate(args[:-1]) if t in ("-name", "-iname")]
    types = [args[i + 1] for i, t in enumerate(args[:-1]) if t == "-type"]
    limited = ((names and all(_is_code_glob(n) for n in names)) or (types and all(t == "d" for t in types))) \
        and not find_pattern_data(args, cwd, mode)
    if limited:
        return None, False
    for index, token in enumerate(args[:-1]):
        if token in FIND_EXEC and program(args[index + 1]) not in METADATA_VERBS:
            return (f"`find {token} {program(args[index + 1])}` over files not limited to code can print data values; "
                    "add -name with a code pattern (for example '*.py') or run it through method-safe-run"), True
    return None, True


def judge(cmd, cwd, mode, tainted, written, fed=(), env=()):
    """Classify one unwrapped command. Returns (reason or None, listed_data).

    fed: files a `cat` earlier in the pipe sends to this command's standard input.
    env: the command's inline assignments (PYTHONPATH= for python -m).
    """
    if not cmd:
        return None, False
    verb = program(cmd[0])
    args = cmd[1:]
    if verb in GREP_VERBS:
        return grep_violation(verb, args, cwd, mode, tainted), False
    if verb == "git":
        refs = any(token_ref(t, cwd, mode, tainted) for t in args)
        sub = _git_sub(args)[:1]
        if sub == ["grep"]:
            return git_violation(args, cwd, mode, tainted), False
        return (git_violation(args, cwd, mode, tainted) if refs else None), refs
    refs = any(token_ref(t, cwd, mode, tainted) for t in cmd)
    inline_index = next((i for i, t in enumerate(args) if INLINE_FLAG.match(t)), None)
    if INTERPRETERS.match(verb) and inline_index is not None and args[inline_index] != "-":  # `-`: code on stdin
        code = " ".join(args[inline_index + 1:inline_index + 2])
        if refs or text_ref(code, cwd, mode) or lists_dataish_dir(code, cwd, mode):
            return f"inline `{verb}` code that opens data returns its values", False
        if verb in ("rscript", "r") and R_WORKFLOW.search(code):
            return workflow_reason(f"{cmd[0]} -e"), False
        for target in (a or b or c for a, b, c in SOURCED.findall(code)):
            if script_reads_data(_resolve(target, cwd), cwd, mode):
                return f"the script `{target}` reads data and can print its values", False
        return None, False
    runner = next((t for t in args if not t.startswith("-")), "") if re.match(r"^python", verb) else cmd[0]
    if os.path.basename(runner) == "method-aggregate-read" and is_plugin_script(runner, cwd, AGGREGATE_READER):
        return None, False  # checks and prints the same bytes
    if verb in AGG_READERS:
        ops = operands(args)
        tables = [t for t in ops if aggregate_file(t, cwd, mode)]
        for table in tables:
            if DATA_REF.search(table):
                return aggregate_hint(table), False
            problem = aggregate_problem(_resolve(table, cwd), mode)
            if problem:
                return f"`{table}` is not an aggregate table: {problem}", False
        if tables and not any(token_ref(t, cwd, mode, tainted) for t in ops if t not in tables):
            return None, False
    workflow = workflow_runner(verb, args, cwd)
    if workflow:
        return workflow_reason(workflow), False
    for shown, path, kind in launched_scripts(cmd, cwd, fed, env):
        if not token_ref(shown, cwd, mode, tainted) and script_reads_data(path, cwd, mode, kind):
            return f"the script `{shown}` reads data and can print its values", False
    if verb == "find":
        reason, unrestricted = find_exec_violation(args, cwd, mode)
        if reason or not refs:
            return reason, unrestricted
    if not refs:
        return None, False
    if verb in METADATA_VERBS:
        return None, True
    if verb == "find":
        if any(t in ("-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprint0", "-fprintf", "-fls") for t in args):
            return "`find -exec` on data files can print their values", False
        return None, True
    if verb in COPY_VERBS:
        ops = operands(args)
        if ops and all(token_ref(t, cwd, mode, tainted) for t in ops):
            return None, True
        return f"`{verb}` would copy a data file to a non-data path", False
    if verb == "sed" and sed_ok(args, cwd, mode, tainted):
        return None, False
    if any(os.path.basename(t) == "schema-peek.py" for t in cmd[:3]) and re.match(r"^python", verb):
        return None, False
    if verb in ("jupyter",) and args[:1] == ["nbconvert"] and "--clear-output" in args:
        return None, False
    if SCRIPT_RUNNERS.match(verb):
        ops = [t for t in args if not t.startswith("-")]
        script = ops[0] if ops else ""
        ext = _ext(script)
        if script and ext in SCRIPT_EXTS and not token_ref(script, cwd, mode, tainted):
            if _resolve(script, cwd) in written:
                return "writing a script that opens data and running it in one command returns its values", False
            return None, False
        if verb == "rscript" and ext == "r":
            return None, False
    return f"`{verb}` on a data file prints its values", False


def safe_companion(cmd):
    """A command that may share a Bash call with method-safe-run: metadata only, or a reader of the pipe (no files)."""
    verb = program(cmd[0])
    if verb in METADATA_VERBS or verb in ("echo", "printf", "true", "false", ":"):
        return True
    return verb in AGG_READERS | GREP_VERBS and all(t.isdigit() for t in operands(cmd[1:])[1 if verb in GREP_VERBS else 0:])


def shell_code(cmd):
    """The code string run by `sh|bash|zsh|dash|ksh -c CODE` or `eval CODE...`, else None."""
    verb = program(cmd[0])
    if verb == "eval":
        return " ".join(cmd[1:])
    if verb in ("sh", "bash", "zsh", "dash", "ksh"):
        flags = [i for i, t in enumerate(cmd[1:], 1) if re.match(r"^-[A-Za-z]*c[A-Za-z]*$", t)]
        if flags and flags[0] + 1 < len(cmd):
            return cmd[flags[0] + 1]
    return None


def _wrapper_dir(seg, cur):
    """The directory a run wrapper switches to (`uv run --directory D`), else cur."""
    head = next((t for t in seg if not re.match(r"^[A-Za-z_]\w*=", t)), "")
    if program(head) != "uv":
        return cur
    for index, token in enumerate(seg):
        if token == "--directory" and index + 1 < len(seg):
            return _resolve(seg[index + 1], cur)
        if token.startswith("--directory="):
            return _resolve(token.split("=", 1)[1], cur)
    return cur


def bash_violations(command, cwd, mode, depth=0):
    """Return (egress reason, access reason) for a shell command."""
    if depth > 3:
        return None, None
    shell, bodies = scan_shell(command)
    egress = access = None
    for inner in substitutions(shell):
        e, a = bash_violations(inner, cwd, mode, depth + 1)
        egress, access = egress or e, access or a
    tokens, _ = tokenize(shell)
    pipelines = segments(tokens)
    commands = [unwrap(seg) for pipeline in pipelines for seg in pipeline]
    runs_code = any(rest and (INTERPRETERS.match(program(rest[0])) or SCRIPT_RUNNERS.match(program(rest[0])))
                    for _, rest in commands)
    if mode["mode"] == "schema-only" and any(rest and program(rest[0]) == "method-safe-run" and is_plugin_script(rest[0], cwd)
                                             for _, rest in commands):
        if not all(not rest or program(rest[0]) == "method-safe-run" or safe_companion(rest) for _, rest in commands):
            access = access or ("run method-safe-run as its own command: other commands in the same call can read what the "
                                "run writes before it is recorded as data")
    written = set()
    for index, token in enumerate(tokens[:-1]):
        if token in (">", ">>", ">|"):
            written.add(_resolve(tokens[index + 1], cwd))
    for header, body in bodies:
        header_tokens, _ = tokenize(header)
        feeders = [program(t) for t in header_tokens]
        if any(f in ("bash", "sh", "zsh", "dash", "ksh") for f in feeders):
            e, a = bash_violations(body, cwd, mode, depth + 1)
            egress, access = egress or e, access or a
        elif text_ref(body, cwd, mode) or lists_dataish_dir(body, cwd, mode):
            if any(INTERPRETERS.match(f) for f in feeders):
                access = access or "inline code that opens a data file returns its values"
            elif runs_code:
                access = access or "writing a script that opens data and running it in one command returns its values"
    tainted, cur = set(), cwd
    for pipeline in pipelines:
        listed = piped = False
        fed = ()
        for seg in pipeline:
            assignments, cmd = unwrap(seg)
            run_cwd = _wrapper_dir(seg, cur)
            egress = egress or stdin_upload(seg, cmd, piped, cur, mode, tainted)
            piped = piped or input_refs(seg, cur, mode, tainted)
            for assignment in assignments:
                name, value = assignment.split("=", 1)
                if token_ref(value, cur, mode, tainted):
                    tainted.add(name)
            if not cmd:
                continue
            safe = False
            if program(cmd[0]) == "method-safe-run" and "--" in cmd:
                safe = is_plugin_script(cmd[0], cur)
                _, cmd = unwrap(cmd[cmd.index("--") + 1:])
                if not cmd:
                    continue
            egress = egress or upload_violation(cmd, cur, mode) or ncbi_violation(cmd, mode)
            inner = shell_code(cmd)
            if inner is not None:
                e, a = bash_violations(inner, cur, mode, depth + 1)
                egress = egress or e
                if not safe:  # under the plugin's method-safe-run the inner code's output stays in the log
                    access = access or a
            feeding, fed = fed, (tuple(t for t in operands(cmd[1:]) if t != "-") if program(cmd[0]) == "cat" else ())
            if mode["mode"] != "schema-only":
                continue
            verb = program(cmd[0])
            if safe:  # output stays in the run log; a copy to a readable path still leaks
                if verb in COPY_VERBS:
                    access = access or judge(cmd, cur, mode, tainted, written)[0]
                continue
            if listed and verb in EXEC_CONSUMERS:
                sub = [t for t in cmd[1:] if not t.startswith("-")]
                if verb != "xargs" or not sub or program(sub[0]) not in METADATA_VERBS:
                    access = access or f"`{verb}` runs a command on listed data files"
            reason, listing = judge(cmd, run_cwd, mode, tainted, written, feeding, assignments)
            access = access or reason
            listed = listed or listing
            if verb in ("cd", "pushd") and len(cmd) > 1:
                cur = _resolve(cmd[1], cur)
    return egress, access


# --------------------------------------------------------------- MCP egress

def _strings(value, key=""):
    if isinstance(value, str):
        yield key, value
    elif isinstance(value, dict):
        for k, v in value.items():
            yield from _strings(v, str(k).lower())
    elif isinstance(value, list):
        for v in value:
            yield from _strings(v, key)


def identifier_reason(text, mode, key=""):
    """Why a string sent to a third party carries an identifier, or None. Never includes the match."""
    from urllib.parse import unquote_plus  # percent-encoded identifiers (name%40hospital.org) are checked too

    text = DOI_OR_PMC.sub(" ", unquote_plus(text))
    for label, pattern in IDENTIFIER_PATTERNS:
        if label == "an email address" and key in RECIPIENT_KEYS:
            continue
        if pattern.search(text):
            return f"an argument contains {label}"
    pack = active_pack()
    if pack is LOCALE_MALFORMED:
        return ("the configured locale pack is malformed or names an unknown checksum validator, so locale "
                "identifiers cannot be checked; fix or remove phi_environment.locale")
    if pack:
        for label, pattern, checksum in pack["identifiers"]:
            for match in pattern.finditer(text):
                if not checksum or LOCALE_CHECKSUMS[checksum](re.sub(r"\D", "", match.group(0))):
                    return f"an argument contains {label}"
    index = load_index(mode)
    if index is INVALID_INDEX:
        return ("the project's identifier index (.methodsmith/identifier-index.local.json) is malformed, so "
                "arguments cannot be checked against it; rebuild it with method-identifier-index")
    if index and index_hit(text, index):
        return "an argument matches a value in the project's identifier index"
    return None


def mcp_violation(tool, tool_input, cwd, mode):
    uploadish = bool(UPLOADISH_TOOL.search(tool.split("__")[-1]))
    for key, value in _strings(tool_input):  # no key is exempt: DOIs/PMCIDs are stripped, bare PMIDs never match
        reason = identifier_reason(value, mode, key)
        if reason:
            return reason
        if uploadish and not value.startswith(("/clipboard", "http://", "https://")) and is_data_path(value.strip(), cwd, mode):
            return "the tool would send a local data file"
    return None


MCP_CODE_KEYS = {"code", "source", "script", "command", "cmd", "sql", "query_code", "cell", "program", "expression"}
# Keys whose value is a path even when it contains spaces (`My Data/a.csv`); so is any key ending in "path".
MCP_PATH_KEYS = {"path", "paths", "file_path", "filepath", "filename", "notebook_path", "uri", "file", "files",
                 "source_path", "target"}


def mcp_access_violation(tool_input, cwd, mode):
    """Schema-only: an MCP tool (filesystem, IDE, notebook, database) returns what it reads into the context.

    A path-keyed value is checked whole, spaces and all (a file:// URI is decoded first); any other
    value is checked only when it is a single word, so free-text queries are not read as paths.
    """
    from urllib.parse import unquote

    for key, value in _strings(tool_input):
        text = value.strip()
        pathish = key in MCP_PATH_KEYS or key.endswith("path")
        if pathish and text.lower().startswith("file://"):
            text = unquote(text[len("file://"):])
        if text and (pathish or not re.search(r"\s", text)) and not text.startswith(("http://", "https://")) \
                and is_data_path(text, cwd, mode):
            return "an MCP tool would read a data file into the model context"
        if key in MCP_CODE_KEYS and (text_ref(value, cwd, mode) or lists_dataish_dir(value, cwd, mode)):
            return "an MCP tool would run code that opens data"
    return None


HTTP_CLIENTS = {"curl", "wget", "http", "https", "xh"}
# Where an HTTP request carries the caller's own contact by convention: credentials, the From header
# (RFC 9110: the human user's email), and the User-Agent (polite-pool "mailto:"). An email there is not a patient's.
OWN_CONTACT_OPTS = {"-u", "--user", "-A", "--user-agent"}
OWN_CONTACT_HEADERS = ("from:", "user-agent:")


def own_contact(prev, token):
    if prev in OWN_CONTACT_OPTS or token.split("=", 1)[0] in OWN_CONTACT_OPTS:
        return True
    value = token.split("=", 1)[1] if token.startswith("--header=") else token if prev in ("-H", "--header") else ""
    return value.strip().lower().startswith(OWN_CONTACT_HEADERS)


def ncbi_violation(cmd, mode):
    """Any HTTP client call (NCBI E-utilities by name or IP included) or the method-pubmed script: MCP identifier checks."""
    verb, args = program(cmd[0]), cmd[1:]
    if verb not in HTTP_CLIENTS and not any(os.path.basename(t) == PUBMED_SCRIPT for t in cmd):
        return None
    where = "an NCBI E-utilities query" if any(NCBI_HOST in t or os.path.basename(t) == PUBMED_SCRIPT for t in cmd) \
        else f"a `{verb}` request"
    for index, token in enumerate(args):
        if os.path.basename(token) == PUBMED_SCRIPT:
            continue
        own = verb in HTTP_CLIENTS and own_contact(args[index - 1] if index else "", token)
        reason = identifier_reason(token, mode, "email" if own else "")
        if reason:
            return f"{where}: {reason[len('an argument '):]}" if reason.startswith("an argument ") else reason
    return None


# ----------------------------------------------------------------- classify

def classify(call, mode):
    """Return None to allow, or {"kind": "egress"|"access", "reason": ...} to deny."""
    global ACTIVE_LOCALE
    ACTIVE_LOCALE = mode.get("locale")
    if mode["mode"] == "off":
        return None
    tool = call.get("tool_name", "") or ""
    tool_input = call.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        raise TypeError("tool_input is not an object")
    cwd = mode.get("cwd") or call.get("cwd") or os.getcwd()
    command = tool_input.get("command") if tool in ("Bash", "Monitor", "PowerShell") else None
    if tool.startswith("mcp__"):
        reason = mcp_violation(tool, tool_input, cwd, mode)
        if reason:
            return {"kind": "egress", "reason": reason}
        if mode["mode"] == "schema-only":
            reason = mcp_access_violation(tool_input, cwd, mode)
            return {"kind": "access", "reason": reason} if reason else None
        return None
    if tool in ("WebFetch", "WebSearch"):
        for key, value in _strings(tool_input):
            reason = identifier_reason(value, mode, key)
            if reason:
                return {"kind": "egress", "reason": reason}
        return None
    egress, access = (bash_violations(command, cwd, mode) if isinstance(command, str) else (None, None))
    if egress:
        return {"kind": "egress", "reason": egress}
    if mode["mode"] != "schema-only":
        return None
    reason = access
    if tool in ("Read", "NotebookRead", "Edit", "MultiEdit", "NotebookEdit"):  # edits return a snippet
        path = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
        resolved = _resolve(path, cwd) if path else ""
        if path and aggregate_file(path, cwd, mode) and DATA_REF.search(path):
            reason = aggregate_hint(path)
        elif path and aggregate_file(path, cwd, mode):
            problem = aggregate_problem(resolved, mode)
            reason = f"`{path}` is not an aggregate table: {problem}" if problem else None
        elif resolved.lower().endswith(".ipynb") and os.path.exists(resolved) and notebook_has_outputs(resolved):
            reason = ("the notebook has saved outputs that may hold data values; clear them first with "
                      "`jupyter nbconvert --clear-output --inplace <notebook>`")
        elif is_data_path(path, cwd, mode):
            reason = "reading a data file returns its values"
    elif tool == "Grep":
        reason = grep_tool_violation(tool_input, cwd, mode)
    return {"kind": "access", "reason": reason} if reason else None


def grep_tool_violation(tool_input, cwd, mode):
    if (tool_input.get("output_mode") or "files_with_matches") != "content":
        return None
    path = tool_input.get("path") or ""
    target = _resolve(path or ".", cwd)
    if is_data_path(path or ".", cwd, mode) or _under(target, mode["data_roots"]):
        return "searching data files in content mode returns their rows"
    if path and os.path.isfile(target):
        return None
    glob, file_type = tool_input.get("glob") or "", (tool_input.get("type") or "").lower()
    if file_type and file_type in CODE_TYPES and not glob:
        return None
    if glob and _is_code_glob(glob) and (not file_type or file_type in CODE_TYPES):
        return None
    return "a content search that is not limited to code files can return data rows; set glob or type to code files"


# --------------------------------------------------------------------- main

def deny_message(result, mode, helper):
    reason = result["reason"]
    if result["kind"] == "egress":
        return (f"methodsmith egress guard: {reason}. Web searches/fetches, MCP tools, and uploads receive search terms, MeSH terms, "
                "PMIDs, DOIs, and titles only, never data values, identifiers, row text, or data files. This holds "
                "in every mode: an endpoint approval does not cover third-party services.")
    if mode.get("why") == "unset":
        return ("methodsmith: no sensitive-data boundary is recorded for this project, so data values stay out "
                f"of the model context ({reason}). Run the method-setup skill and choose a boundary, or set "
                "phi_environment.mode in .methodsmith/config.local.yaml.")
    if mode.get("why") == "legacy":
        return ("methodsmith: this project still uses the pre-rename state folder "
                f"{LEGACY_STATE_DIR}/, which is no longer read, so schema-only mode applies ({reason}). "
                f"Move it with `mv {LEGACY_STATE_DIR} {STATE_DIR}` (or run method-update) to restore the "
                "recorded boundary.")
    if mode.get("why") == "unreadable":
        return ("methodsmith: the phi_environment block in .methodsmith/config.local.yaml cannot be read "
                f"({mode.get('detail')}), so schema-only mode applies ({reason}). Set phi_environment.mode to "
                "approved, schema-only, or no-sensitive-data, or re-run method-setup.")
    return ("methodsmith schema-only mode: the model endpoint is not approved for this project's sensitive "
            f"data ({reason}). Inspect structure with `python3 \"{helper}\" <file>` (headings, types, counts, "
            f"% missing only). Run scripts that read data through `{SAFE_RUNNER} -- <command>`: it keeps their "
            "output in a local log and prints only the exit code, files written, and traceback frames and error types. If the endpoint is "
            "approved, re-run method-setup or set phi_environment.mode in .methodsmith/config.local.yaml.")


def emit(message):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": message,
    }}))


def main():
    raw = sys.stdin.read()
    helper = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "schema-peek.py")
    try:
        payload = json.loads(raw or "{}")
        mode = resolve_mode(payload)
        result = classify(payload, mode)
    except Exception as exc:  # internal error: deny only risky calls
        if FALLBACK_RISK.search(raw):
            emit("methodsmith data-boundary guard hit an internal error on a call that mentions a data file "
                 f"or an upload ({type(exc).__name__}), so it was blocked. Retry with a simpler command.")
        else:
            print(f"methodsmith data-boundary guard skipped this call after an internal error: {type(exc).__name__}",
                  file=sys.stderr)
        return 0
    if result is not None:
        emit(deny_message(result, mode, helper))
    return 0


if __name__ == "__main__":
    sys.exit(main())
