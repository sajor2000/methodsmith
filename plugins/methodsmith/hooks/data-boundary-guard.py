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
and recursive content searches are denied. Script files run by
python/Rscript/bash/sh/quarto render/jupyter nbconvert --execute are read
statically (1 MB cap) and denied when they name a data path or call a reader
on a variable path, unless the command runs through the plugin's method-safe-run.
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

import json
import os
import re
import shlex
import sys

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
# The pre-rename state folder. Detected so an unmoved project fails closed (schema-only), never read.
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
                "mamba": "run", "micromamba": "run", "hatch": "run", "rye": "run"}
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
    """Return (ce_root, main_root) for the project containing anchor, or None."""
    probe = anchor
    while probe and not os.path.isdir(probe):
        parent = os.path.dirname(probe)
        if parent == probe:
            return None
        probe = parent
    if probe in cache:
        return cache[probe]
    ce_root, top, main = None, None, None
    walk = probe
    while True:
        if ce_root is None and _has_state(walk):
            ce_root = walk
        if os.path.exists(os.path.join(walk, ".git")):
            top = walk
            break
        parent = os.path.dirname(walk)
        if parent == walk:
            break
        walk = parent
    if top and os.path.isfile(os.path.join(top, ".git")):
        common = _git_common_dir(top)
        if common and os.path.basename(common.rstrip(os.sep)) == ".git":
            main = os.path.dirname(common.rstrip(os.sep))
    if ce_root is None and main and _has_state(main):
        ce_root = top
    result = (ce_root, main) if ce_root else None
    cache[probe] = result
    return result


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
    if legacy:
        # Only the pre-rename folder exists. Its mode is never trusted (schema-only until it is
        # moved); it is read only for what tightens the boundary: data_root and the locale.
        legacy_config = next((c for c in (os.path.join(b, LEGACY_STATE_DIR, "config.local.yaml") for b in bases)
                              if os.path.isfile(c)), None)
        phi, data_root, _ = read_config(legacy_config) if legacy_config else (None, None, None)
        phi = {"locale": phi["locale"]} if isinstance(phi, dict) and "locale" in phi else None
        mode, why, detail = "schema-only", "legacy", ""
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
    if data_root:
        expanded = os.path.expanduser(data_root)
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
    locale_value = (phi or {}).get("locale")
    locale = _scalar(locale_value) if isinstance(locale_value, str) and locale_value.strip() else None
    return {"mode": mode, "why": why, "detail": detail, "roots": [ce_root], "data_roots": sorted(data_roots),
            "aggregate_dirs": aggregate, "index_paths": index_paths, "output_lists": output_lists,
            "locale": locale or None}


RANK = {"off": 0, "approved": 1, "no-sensitive-data": 1, "schema-only": 2}


def _anchors(context):
    cwd = context.get("cwd") or os.getcwd()
    tool_input = context.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        raise TypeError("tool_input is not an object")
    anchors = [cwd]
    for key in ("file_path", "notebook_path", "path"):
        value = tool_input.get(key)
        if isinstance(value, str) and value:
            anchors.append(_resolve(value, cwd))
    command = tool_input.get("command")
    if isinstance(command, str):
        for chunk in re.findall(r"(?:^|[\s'\"=:(<>@])((?:/|~/)[^\s'\";|&<>()`]+)", command)[:20]:
            anchors.append(_resolve(chunk, cwd))
    return cwd, anchors


def resolve_mode(context):
    """Resolve the boundary for a tool call from cwd and the paths it targets. Strictest project wins."""
    cwd, anchors = _anchors(context)
    cache, best, data_roots, roots, aggregate, index_paths, output_lists = {}, None, set(), [], set(), [], []
    for anchor in anchors:
        found = _locate(anchor, cache)
        if not found:
            continue
        project = _project_mode(*found)
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


def is_data_path(raw, cwd, mode):
    """True when a path names a data file: extension, data_root, symlink target, or a notebook with outputs."""
    if not raw:
        return False
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


def token_ref(token, cwd, mode, tainted):
    if tainted and re.search(r"\$\{?(" + "|".join(map(re.escape, tainted)) + r")\b", token):
        return True
    for chunk in _chunks(token):
        if not chunk or chunk.startswith("-") and "=" not in chunk:
            continue
        has_path_shape = "/" in chunk or "." in chunk or "*" in chunk
        if has_path_shape or os.path.lexists(_resolve(chunk, cwd)):
            if is_data_path(chunk, cwd, mode):
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


def tokenize(text):
    try:
        lexer = shlex.shlex(text, posix=True, punctuation_chars=";&|<>()")
        lexer.whitespace_split = True
        return list(lexer), True
    except ValueError:
        return text.split(), False


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
                if flag in ("-n", "--name", "-p", "--prefix", "--with", "--python", "-e", "--env") and rest:
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
        if token_ref(token, cwd, mode, tainted):
            return True
    return False


def stdin_upload(seg, cmd, piped, cwd, mode, tainted):
    """A network tool whose stdin is a data file (`< file`) or a pipe fed by a command that read one."""
    if not cmd or program(cmd[0]) not in NETWORK_VERBS:
        return None
    redirected = any(t == "<" and i + 1 < len(seg) and token_ref(seg[i + 1], cwd, mode, tainted)
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


def git_violation(args, cwd, mode, tainted):
    rest = list(args)
    while rest and rest[0].startswith("-"):
        flag = rest.pop(0)
        if flag in ("-C", "-c", "--git-dir", "--work-tree") and rest:
            rest.pop(0)
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


def script_reads_data(path, cwd, mode):
    """Static, heuristic: does the script file name a data path? Reads at most 1 MB. Plugin scripts are trusted."""
    if _under(os.path.realpath(path), [PLUGIN_ROOT]):
        return False
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            text = fh.read(SCRIPT_CAP)
    except OSError:
        return False
    ext = path.rsplit(".", 1)[-1].lower()
    if ext == "ipynb":
        try:
            cells = json.loads(text).get("cells", [])
            text = "\n".join("".join(c.get("source", "")) for c in cells if isinstance(c, dict))
        except (ValueError, AttributeError, TypeError):
            return True  # cannot verify
    if ext in ("sh", "bash", "zsh") and path not in _SCANNING and len(_SCANNING) < 8:
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
    ext = raw.rsplit(".", 1)[-1].lower() if "." in os.path.basename(raw) else ""
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


def script_file(verb, args):
    """The script, Quarto document, or executed notebook a command runs, or None."""
    ops = [t for t in args if not t.startswith("-")]
    if verb == "quarto":
        return ops[1] if ops[:1] == ["render"] and len(ops) > 1 else None
    if verb == "jupyter":
        if ops[:1] == ["nbconvert"] and "--execute" in args:
            return next((t for t in ops[1:] if t.lower().endswith(".ipynb")), None)
        return None
    if not SCRIPT_RUNNERS.match(verb):
        return None
    script = ops[0] if ops else ""
    ext = script.rsplit(".", 1)[-1].lower() if "." in os.path.basename(script) else ""
    return script if ext in SCRIPT_EXTS else None


def judge(cmd, cwd, mode, tainted, written):
    """Classify one unwrapped command. Returns (reason or None, listed_data)."""
    if not cmd:
        return None, False
    verb = program(cmd[0])
    args = cmd[1:]
    if verb in GREP_VERBS:
        return grep_violation(verb, args, cwd, mode, tainted), False
    if verb == "git":
        refs = any(token_ref(t, cwd, mode, tainted) for t in args)
        sub = [t for t in args if not t.startswith("-")][:1]
        if sub == ["grep"]:
            return git_violation(args, cwd, mode, tainted), False
        return (git_violation(args, cwd, mode, tainted) if refs else None), refs
    refs = any(token_ref(t, cwd, mode, tainted) for t in cmd)
    inline_index = next((i for i, t in enumerate(args) if INLINE_FLAG.match(t)), None)
    if INTERPRETERS.match(verb) and inline_index is not None:
        code = " ".join(args[inline_index + 1:inline_index + 2])
        if refs or text_ref(code, cwd, mode) or lists_dataish_dir(code, cwd, mode):
            return f"inline `{verb}` code that opens data returns its values", False
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
    script = script_file(verb, args)
    if script and script_reads_data(_resolve(script, cwd), cwd, mode):
        return f"the script `{script}` reads data and can print its values", False
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
    if verb in ("make", "quarto", "snakemake", "nextflow", "dvc", "pytest", "targets"):
        return None, False
    if SCRIPT_RUNNERS.match(verb):
        ops = [t for t in args if not t.startswith("-")]
        script = ops[0] if ops else ""
        ext = script.rsplit(".", 1)[-1].lower() if "." in os.path.basename(script) else ""
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
        for seg in pipeline:
            assignments, cmd = unwrap(seg)
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
                egress = egress or bash_violations(inner, cur, mode, depth + 1)[0]
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
            reason, listing = judge(cmd, cur, mode, tainted, written)
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


def mcp_access_violation(tool_input, cwd, mode):
    """Schema-only: an MCP tool (filesystem, IDE, notebook, database) returns what it reads into the context."""
    for key, value in _strings(tool_input):
        text = value.strip()
        if text and not re.search(r"\s", text) and not text.startswith(("http://", "https://")) \
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
            "output in a local log and prints only the exit code, files written, and a masked stderr tail. If the endpoint is "
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
