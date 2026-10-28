#!/usr/bin/env bash
# Install Methodsmith through the simplest native path for each agent.

set -euo pipefail

PLUGIN_NAME="methodsmith"
MARKETPLACE_NAME="methodsmith"
GITHUB_REPO="sajor2000/methodsmith"

target=""
source_root=""
scope="user"
aliases="no"
codex_home="${CODEX_HOME:-$HOME/.codex}"
agents_home="${AGENTS_HOME:-$HOME/.agents}"
dry_run="no"
auto_update="yes"
source_explicit="no"

usage() {
  cat <<'USAGE'
Usage:
  bash install.sh claude [options]
  bash install.sh codex [options]
  bash install.sh droid [options]
  bash install.sh doctor [options]
  bash scripts/install/easy-install.sh --target claude [options]
  bash scripts/install/easy-install.sh --target codex [options]

Options:
  --target claude|codex|droid  Agent platform to configure
  --source PATH          Source path; Droid requires a repo root with .factory-plugin/marketplace.json.
                         Without it, Claude, Codex, and Droid install from the
                         GitHub marketplace so updates reach you.
  --no-auto-update       Claude: do not turn on background auto-update
  --scope user|project   Plugin installation scope (default: user)
  --aliases              Also install safe bare /method-* Claude aliases
  --codex-home PATH      Codex profile root (default: $CODEX_HOME or ~/.codex)
  --agents-home PATH     Codex .agents root for marketplace.json (default: $AGENTS_HOME or ~/.agents)
  --dry-run              Print commands without running them
  --help                 Show this help

Examples:
  bash install.sh doctor
  bash install.sh claude --aliases
  bash install.sh codex --codex-home "${CODEX_HOME:-$HOME/.codex}"
  bash install.sh codex --source /approved/path/methodsmith-codex-local
  bash install.sh droid
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    claude|codex|droid|doctor)
      target="$1"
      shift
      ;;
    --target)
      [ "$#" -ge 2 ] || { echo "Missing value for --target" >&2; exit 2; }
      target="$2"
      shift 2
      ;;
    --source)
      [ "$#" -ge 2 ] || { echo "Missing value for --source" >&2; exit 2; }
      source_root="$2"
      source_explicit="yes"
      shift 2
      ;;
    --no-auto-update)
      auto_update="no"
      shift
      ;;
    --scope)
      [ "$#" -ge 2 ] || { echo "Missing value for --scope" >&2; exit 2; }
      scope="$2"
      shift 2
      ;;
    --aliases)
      aliases="yes"
      shift
      ;;
    --codex-home)
      [ "$#" -ge 2 ] || { echo "Missing value for --codex-home" >&2; exit 2; }
      codex_home="$2"
      shift 2
      ;;
    --agents-home)
      [ "$#" -ge 2 ] || { echo "Missing value for --agents-home" >&2; exit 2; }
      agents_home="$2"
      shift 2
      ;;
    --dry-run)
      dry_run="yes"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$target" in
  claude|codex|droid|doctor) ;;
  "") echo "Choose a target: bash install.sh claude, bash install.sh codex, bash install.sh droid, or bash install.sh doctor" >&2; usage >&2; exit 2 ;;
  *) echo "--target must be claude, codex, droid, or doctor" >&2; exit 2 ;;
esac

case "$scope" in
  user|project) ;;
  *) echo "--scope must be user or project" >&2; exit 2 ;;
esac

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"

if [ -z "$source_root" ]; then
  source_root="$repo_root"
fi

abs_path() {
  case "$1" in
    /*|[A-Za-z]:/*|[A-Za-z]:\\*) printf '%s\n' "$1" ;;
    *) (cd -- "$1" 2>/dev/null && pwd -P) || printf '%s/%s\n' "$PWD" "$1" ;;
  esac
}

source_root="$(abs_path "$source_root")"
codex_home="$(abs_path "$codex_home")"
agents_home="$(abs_path "$agents_home")"

run_or_echo() {
  if [ "$dry_run" = "yes" ]; then
    printf '[dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

require_command() {
  if [ "$dry_run" = "yes" ]; then
    return
  fi
  command -v "$1" >/dev/null 2>&1 || {
    echo "$1 is required for this install path." >&2
    exit 2
  }
}

command_status() {
  if command -v "$1" >/dev/null 2>&1; then
    printf 'available (%s)' "$(command -v "$1")"
  else
    printf 'not found'
  fi
}

source_status() {
  if [ -f "$source_root/.claude-plugin/marketplace.json" ] && [ -d "$source_root/plugins/$PLUGIN_NAME" ]; then
    printf 'source checkout (standard Claude and Codex installer paths available)'
  elif [ -f "$source_root/install-codex-offline.sh" ]; then
    printf 'unpacked Codex offline package'
  elif [ -d "$source_root/skills" ] && [ -d "$source_root/.claude-plugin" ]; then
    printf 'unpacked Claude plugin folder'
  elif [[ "$source_root" == *.zip ]]; then
    printf 'Claude plugin ZIP'
  else
    printf 'unrecognized; expected a source checkout or approved offline artifact'
  fi
}

print_doctor() {
  echo "Methodsmith install check"
  echo "Source: $source_root"
  echo "Source type: $(source_status)"
  echo "Claude Code CLI: $(command_status claude)"
  echo "Codex CLI: $(command_status codex)"
  echo "Droid CLI: $(command_status droid)"
  echo "Bun (optional for Codex agent bridge): $(command_status bun)"
  echo ""
  echo "Standard laptop:"
  echo "  bash install.sh claude --aliases"
  echo "  bash install.sh codex"
  echo "  bash install.sh droid"
  echo ""
  echo "Locked-down or corporate laptop:"
  echo "  Claude: claude --plugin-dir /approved/path/methodsmith.zip"
  echo "  Codex:  bash install-codex-offline.sh --source /approved/path/methodsmith-codex-local"
  echo ""
  echo "Codex always requires the final host step: restart Codex, open /plugins,"
  echo "install Methodsmith from the local marketplace, then restart once more."
}

install_claude_aliases() {
  local plugin_dir="$1"
  if [ "$aliases" != "yes" ]; then
    return
  fi
  if [ ! -d "$plugin_dir/skills" ]; then
    echo "Cannot install aliases because this source is not an unpacked plugin folder: $plugin_dir" >&2
    return
  fi
  run_or_echo bash "$repo_root/scripts/install/install-claude-aliases.sh" \
    --plugin-dir "$plugin_dir" \
    --scope "$scope"
}

claude_settings_path() {
  if [ "$scope" = "project" ]; then
    printf '%s/.claude/settings.json\n' "$PWD"
  elif [ "$scope" = "local" ]; then
    printf '%s/.claude/settings.local.json\n' "$PWD"
  else
    printf '%s/settings.json\n' "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
  fi
}

find_python() {
  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

print_claude_update_help() {
  echo "Update later with:"
  echo "  claude plugin update $PLUGIN_NAME@$MARKETPLACE_NAME"
  echo "Or turn on automatic updates: run /plugin in Claude Code, open Marketplaces,"
  echo "select $MARKETPLACE_NAME, and choose Enable auto-update."
}

# Set autoUpdate on this marketplace's extraKnownMarketplaces entry, the
# documented per-marketplace switch (third-party marketplaces default to off).
# Never rewrites a settings file it cannot parse.
enable_claude_auto_update() {
  local settings_path python_bin
  settings_path="$(claude_settings_path)"
  if [ "$dry_run" = "yes" ]; then
    echo "[dry-run] set extraKnownMarketplaces.$MARKETPLACE_NAME.autoUpdate=true in $settings_path"
    return
  fi
  if ! python_bin="$(find_python)"; then
    echo "Python not found, so auto-update was not turned on."
    print_claude_update_help
    return
  fi
  if "$python_bin" - "$settings_path" "$MARKETPLACE_NAME" "$GITHUB_REPO" <<'PY'
import json, os, shutil, sys, time
path, name, repo = sys.argv[1:4]
data = {}
if os.path.exists(path):
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, ValueError):
        sys.exit(3)
    if not isinstance(data, dict):
        sys.exit(3)
    shutil.copy2(path, path + ".bak." + time.strftime("%Y%m%dT%H%M%S"))
markets = data.setdefault("extraKnownMarketplaces", {})
if not isinstance(markets, dict):
    sys.exit(3)
entry = markets.setdefault(name, {})
if not isinstance(entry, dict):
    sys.exit(3)
entry.setdefault("source", {"source": "github", "repo": repo})
entry["autoUpdate"] = True
os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
tmp = path + ".tmp"
with open(tmp, "w", encoding="utf-8") as handle:
    json.dump(data, handle, indent=2)
    handle.write("\n")
os.replace(tmp, path)
PY
  then
    echo "Auto-update is on: Claude Code refreshes $MARKETPLACE_NAME in the background"
    echo "and tells you to run /reload-plugins when a new version lands."
    echo "Turn it off in /plugin > Marketplaces, or re-run with --no-auto-update."
  else
    echo "Could not update $settings_path (it is not valid JSON), so it was left unchanged."
    print_claude_update_help
  fi
}

install_claude() {
  if [ "$source_explicit" = "no" ] && [ -f "$source_root/.claude-plugin/marketplace.json" ]; then
    # Default: the GitHub marketplace, so Claude Code can deliver updates.
    # A local checkout marketplace loads in place and only changes on git pull.
    require_command claude
    local from_github="yes"
    if ! run_or_echo claude plugin marketplace add "$GITHUB_REPO" --scope "$scope"; then
      echo "Could not reach the GitHub marketplace; using the local checkout instead."
      echo "Updates then come from: git pull in $source_root"
      run_or_echo claude plugin marketplace add "$source_root" --scope "$scope"
      from_github="no"
    fi
    run_or_echo claude plugin install "$PLUGIN_NAME@$MARKETPLACE_NAME" --scope "$scope"
    install_claude_aliases "$source_root/plugins/$PLUGIN_NAME"
    echo ""
    echo "Claude install complete."
    if [ "$from_github" = "yes" ] && [ "$auto_update" = "yes" ]; then
      enable_claude_auto_update
    elif [ "$from_github" = "yes" ]; then
      print_claude_update_help
    fi
    echo "Start Claude Code in a project and run:"
    if [ "$aliases" = "yes" ]; then
      echo "  /method-setup"
    else
      echo "  /$PLUGIN_NAME:method-setup"
    fi
    return
  fi

  if [ -f "$source_root/.claude-plugin/marketplace.json" ] && [ -d "$source_root/plugins/$PLUGIN_NAME" ]; then
    require_command claude
    run_or_echo claude plugin marketplace add "$source_root" --scope "$scope"
    run_or_echo claude plugin install "$PLUGIN_NAME@$MARKETPLACE_NAME" --scope "$scope"
    install_claude_aliases "$source_root/plugins/$PLUGIN_NAME"
    echo ""
    echo "Claude install complete."
    echo "This marketplace is the local checkout: update with git pull in $source_root."
    echo "Start Claude Code in a project and run:"
    if [ "$aliases" = "yes" ]; then
      echo "  /method-setup"
    else
      echo "  /$PLUGIN_NAME:method-setup"
    fi
    return
  fi

  if [ -d "$source_root/skills" ] && [ -d "$source_root/.claude-plugin" ]; then
    install_claude_aliases "$source_root"
    echo "Launch Claude Code with:"
    echo "  claude --plugin-dir \"$source_root\""
    echo "Then run /$PLUGIN_NAME:method-setup"
    return
  fi

  case "$source_root" in
    *.zip)
      echo "Launch Claude Code with:"
      echo "  claude --plugin-dir \"$source_root\""
      echo "Then run /$PLUGIN_NAME:method-setup"
      return
      ;;
  esac

  echo "Could not find a Methodsmith Claude marketplace or plugin folder at $source_root" >&2
  exit 2
}

install_codex() {
  if [ -f "$source_root/install-codex-offline.sh" ]; then
    run_or_echo bash "$source_root/install-codex-offline.sh" \
      --source "$source_root" \
      --codex-home "$codex_home" \
      --agents-home "$agents_home"
    return
  fi

  if [ -f "$source_root/.agents/plugins/marketplace.json" ] && [ -d "$source_root/plugins/$PLUGIN_NAME" ]; then
    require_command codex
    # The codex CLI refuses a CODEX_HOME that does not exist yet, and it must
    # register the marketplace in the same profile this installer writes to.
    run_or_echo mkdir -p "$codex_home"
    local codex_marketplace="$source_root"
    if [ "$source_explicit" = "no" ]; then
      # A Git marketplace is what `codex plugin marketplace upgrade` refreshes.
      codex_marketplace="$GITHUB_REPO"
      if ! run_or_echo env CODEX_HOME="$codex_home" codex plugin marketplace add "$GITHUB_REPO"; then
        echo "Could not reach the GitHub marketplace; using the local checkout instead."
        codex_marketplace="$source_root"
        run_or_echo env CODEX_HOME="$codex_home" codex plugin marketplace add "$source_root"
      fi
    else
      run_or_echo env CODEX_HOME="$codex_home" codex plugin marketplace add "$source_root"
    fi
    if command -v bun >/dev/null 2>&1; then
      if [ "$dry_run" = "yes" ]; then
        echo "[dry-run] cd \"$source_root\" && bun run src/index.ts install ./plugins/$PLUGIN_NAME --to codex --codex-home \"$codex_home\""
      else
        (cd "$source_root" && bun run src/index.ts install "./plugins/$PLUGIN_NAME" --to codex --codex-home "$codex_home")
      fi
    else
      echo "bun not found; registered the native Codex plugin marketplace only."
      echo "Install Methodsmith from /plugins, or run the Bun bridge later for generated agents."
    fi
    echo ""
    echo "Codex install prepared."
    echo "Restart Codex, open /plugins, install Methodsmith, then start a new thread."
    echo ""
    if [ "$codex_marketplace" = "$GITHUB_REPO" ]; then
      echo "Codex does not update plugins on its own. To update later, run:"
      echo "  codex plugin marketplace upgrade $MARKETPLACE_NAME"
    else
      echo "This marketplace is the local checkout. To update later: git pull in $source_root,"
      echo "then re-run this installer."
    fi
    echo "Refresh the generated agents too with:"
    echo "  bunx github:sajor2000/methodsmith install $PLUGIN_NAME --to codex --codex-home \"$codex_home\""
    return
  fi

  echo "Could not find a Methodsmith Codex marketplace or offline package at $source_root" >&2
  exit 2
}

install_droid() {
  if [ ! -f "$source_root/.factory-plugin/marketplace.json" ] || [ ! -d "$source_root/plugins/$PLUGIN_NAME" ]; then
    echo "Could not find a Methodsmith Factory marketplace and plugin at $source_root" >&2
    exit 2
  fi

  require_command droid
  local marketplace_source="$source_root"
  if [ "$source_explicit" = "no" ]; then
    marketplace_source="$GITHUB_REPO"
  else
    # Droid resolves local marketplace paths to absolute paths; normalize the
    # checkout path so the registered form matches the derived-name lookup.
    marketplace_source="$(cd "$source_root" && pwd -P)"
  fi

  run_or_echo droid plugin marketplace add "$marketplace_source"
  # Droid derives a local marketplace's registered name from its source path,
  # which can differ from $MARKETPLACE_NAME when the checkout has another
  # name. Read the registered name back instead of assuming it.
  local install_marketplace="$MARKETPLACE_NAME"
  if [ "$dry_run" = "no" ]; then
    local registered derived
    if registered="$(droid plugin marketplace list 2>/dev/null)"; then
      derived="$(printf '%s\n' "$registered" | awk -v suffix="local:$marketplace_source" 'index($0, suffix) + length(suffix) == length($0) + 1 {print $1; exit}')"
      if [ -n "$derived" ]; then
        install_marketplace="$derived"
      elif [ "$source_explicit" = "yes" ]; then
        echo "Could not identify the registered Droid marketplace for $marketplace_source" >&2
        exit 2
      fi
    fi
  fi
  run_or_echo droid plugin install "$PLUGIN_NAME@$install_marketplace" --scope "$scope"
  echo ""
  echo "Droid install prepared. Restart Droid and invoke /method-setup in your project."
  if [ "$source_explicit" = "yes" ]; then
    echo "This marketplace uses the local checkout. Update with git pull in $source_root, then run:"
    echo "  droid plugin marketplace update $install_marketplace"
    echo "  droid plugin update $PLUGIN_NAME@$install_marketplace --scope $scope"
  else
    echo "Update later with: droid plugin marketplace update $install_marketplace"
    echo "Then run: droid plugin update $PLUGIN_NAME@$install_marketplace --scope $scope"
  fi
}

case "$target" in
  claude) install_claude ;;
  codex) install_codex ;;
  droid) install_droid ;;
  doctor) print_doctor ;;
esac
