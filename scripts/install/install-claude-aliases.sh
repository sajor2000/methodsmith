#!/usr/bin/env bash
# Install optional bare /method-* Claude Code command aliases for methodsmith.
#
# Native Claude plugin commands and skills are plugin-prefixed. These local
# command files are only a convenience layer for demos and locked-down laptops.

set -euo pipefail

MARKER_PREFIX="<!-- METHODSMITH_ALIAS_MANAGED v1 "
# Aliases written before the rename to Methodsmith carry this marker. They are
# still ours: stale ones are removed and current ones are rewritten.
LEGACY_MARKER_PREFIX="<!-- CE_DATASCIENCE_ALIAS_MANAGED v1 "  # rebrand:keep
# Pre-rebrand command names were deprecated aliases through 5.x. They are no longer
# written; managed ones left from an older install are removed as stale.
LEGACY_PREFIX="ce-"  # rebrand:keep
DEFAULT_PLUGIN_NAME="methodsmith"

scope="user"
commands_dir=""
plugin_dir=""
plugin_name="$DEFAULT_PLUGIN_NAME"
mode="install"
dry_run="no"

usage() {
  cat <<'USAGE'
Usage: bash scripts/install/install-claude-aliases.sh [options]

Options:
  --scope user|project      Write to ~/.claude/commands or ./.claude/commands (default: user)
  --commands-dir PATH       Override the destination command directory
  --plugin-dir PATH         Generate aliases from this methodsmith plugin directory
  --plugin-name NAME        Plugin namespace used in aliases (default: methodsmith)
  --uninstall               Remove only managed methodsmith aliases
  --dry-run                 Print actions without writing files
  --help                    Show this help

Deprecated aliases under pre-rename names, written by older installs, are removed.

The installer never overwrites a user-owned command. Existing managed
aliases are updated in place; stale managed aliases are removed.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --scope)
      [ "$#" -ge 2 ] || { echo "Missing value for --scope" >&2; exit 2; }
      scope="$2"
      shift 2
      ;;
    --commands-dir)
      [ "$#" -ge 2 ] || { echo "Missing value for --commands-dir" >&2; exit 2; }
      commands_dir="$2"
      shift 2
      ;;
    --plugin-dir)
      [ "$#" -ge 2 ] || { echo "Missing value for --plugin-dir" >&2; exit 2; }
      plugin_dir="$2"
      shift 2
      ;;
    --plugin-name)
      [ "$#" -ge 2 ] || { echo "Missing value for --plugin-name" >&2; exit 2; }
      plugin_name="$2"
      shift 2
      ;;
    --uninstall)
      mode="uninstall"
      shift
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

case "$scope" in
  user|project) ;;
  *) echo "--scope must be user or project" >&2; exit 2 ;;
esac

if [ -z "$commands_dir" ]; then
  if [ "$scope" = "project" ]; then
    commands_dir="$PWD/.claude/commands"
  else
    commands_dir="${CLAUDE_COMMANDS_DIR:-$HOME/.claude/commands}"
  fi
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
prebuilt_dir="$script_dir/commands"

if [ -z "$plugin_dir" ]; then
  if [ -d "$repo_root/plugins/methodsmith/skills" ]; then
    plugin_dir="$repo_root/plugins/methodsmith"
  elif [ -d "$prebuilt_dir" ]; then
    plugin_dir=""
  else
    echo "Could not find plugin skills. Pass --plugin-dir /path/to/methodsmith or run from the repo checkout." >&2
    exit 2
  fi
fi

run_or_echo() {
  if [ "$dry_run" = "yes" ]; then
    printf '[dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

is_managed_alias() {
  [ -f "$1" ] && { grep -Fq "$MARKER_PREFIX" "$1" || grep -Fq "$LEGACY_MARKER_PREFIX" "$1"; }
}

# Managed command files use either the current or the pre-rebrand prefix.
alias_files_in() {
  local dir="$1" file
  for file in "$dir"/method-*.md "$dir/$LEGACY_PREFIX"*.md; do
    [ -f "$file" ] && printf '%s\n' "$file"
  done
}

# Only current names are installed, even from a prebuilt directory made by an older release.
source_files_in() {
  local file
  for file in "$1"/method-*.md; do
    [ -f "$file" ] && printf '%s\n' "$file"
  done
}

write_alias_file() {
  local output_file="$1"
  local skill_name="$2"
  cat > "$output_file" <<EOF_ALIAS
---
description: "Local alias for /${plugin_name}:${skill_name} from Methodsmith."
---
${MARKER_PREFIX}plugin=${plugin_name} skill=${skill_name} -->
This local command is a convenience alias for the Methodsmith plugin skill:

\`/${plugin_name}:${skill_name} \$ARGUMENTS\`

Delegate to that namespaced plugin skill and pass through the arguments exactly:

\$ARGUMENTS
EOF_ALIAS
}

build_source_dir() {
  if [ -z "$plugin_dir" ] && [ -d "$prebuilt_dir" ]; then
    printf '%s\n' "$prebuilt_dir"
    return
  fi

  if [ ! -d "$plugin_dir/skills" ]; then
    echo "Plugin directory does not contain skills/: $plugin_dir" >&2
    exit 2
  fi

  local temp_dir
  temp_dir="$(mktemp -d -t method-claude-aliases-XXXXXX)"
  alias_temp_dir="$temp_dir"

  shopt -s nullglob
  local skill_path skill_name
  for skill_path in "$plugin_dir"/skills/method-*/SKILL.md; do
    skill_name="$(basename "$(dirname "$skill_path")")"
    write_alias_file "$temp_dir/${skill_name}.md" "$skill_name"
  done
  shopt -u nullglob

  if ! compgen -G "$temp_dir/method-*.md" >/dev/null; then
    echo "No public method-* skills found under $plugin_dir/skills" >&2
    exit 2
  fi

  printf '%s\n' "$temp_dir"
}

uninstall_aliases() {
  echo "Removing managed Methodsmith aliases from $commands_dir"
  shopt -s nullglob
  local file
  while IFS= read -r file; do
    if is_managed_alias "$file"; then
      run_or_echo rm -f "$file"
      echo "removed $(basename "$file")"
    fi
  done < <(alias_files_in "$commands_dir")
  shopt -u nullglob
}

install_aliases() {
  local source_dir="$1"
  echo "Installing Methodsmith aliases into $commands_dir"
  run_or_echo mkdir -p "$commands_dir"

  local managed_names="
"
  shopt -s nullglob
  local source_file base target
  while IFS= read -r source_file; do
    base="$(basename "$source_file")"
    managed_names="${managed_names}${base}
"
    target="$commands_dir/$base"
    if [ -e "$target" ] && ! is_managed_alias "$target"; then
      echo "skipped user-owned $base"
      continue
    fi
    if [ "$dry_run" = "yes" ]; then
      echo "[dry-run] install $base"
    else
      cp "$source_file" "$target"
    fi
    echo "installed $base"
  done < <(source_files_in "$source_dir")

  local existing
  while IFS= read -r existing; do
    base="$(basename "$existing")"
    case "$managed_names" in
      *"
$base
"*) ;;
      *)
        if is_managed_alias "$existing"; then
          run_or_echo rm -f "$existing"
          echo "removed stale $base"
        fi
        ;;
    esac
  done < <(alias_files_in "$commands_dir")
  shopt -u nullglob
}

alias_temp_dir=""
trap 'if [ -n "${alias_temp_dir:-}" ] && [ -d "$alias_temp_dir" ]; then rm -rf "$alias_temp_dir"; fi' EXIT

if [ "$mode" = "uninstall" ]; then
  uninstall_aliases
else
  source_dir="$(build_source_dir)"
  install_aliases "$source_dir"
fi
