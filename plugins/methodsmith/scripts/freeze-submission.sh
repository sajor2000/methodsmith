#!/usr/bin/env bash
#
# Freeze an analysis at submission time.
#
# Usage: ./scripts/freeze-submission.sh <tag>
#
# Example: ./scripts/freeze-submission.sh nejm-2026-04
#
# What it does:
#   1. Refuses if the working tree is dirty.
#   2. Tags the current commit as `submission/<tag>`.
#   3. Writes submissions/<tag>/manifest.yaml with: commit sha, SAP version,
#      locked-wave hash from .methodsmith/data-state.yaml, environment
#      lock-file hashes, and the frozen-at timestamp.
#
# What it does NOT do:
#   - Push the tag (you do that with `git push origin submission/<tag>`)
#   - Copy the data (PHI never leaves data_root; we only record the hash)
#   - Render the manuscript (do that yourself; record the rendered file hash
#     in the manifest manually if needed)

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <tag>" >&2
  exit 2
fi

TAG="$1"
ARCHIVE="submissions/$TAG"

# Refuse on dirty tree
if [ -n "$(git status --porcelain)" ]; then
  echo "Refusing to freeze: working tree is dirty. Commit or stash first." >&2
  exit 1
fi

mkdir -p "$ARCHIVE"

SHA="$(git rev-parse HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
REMOTE="$(git config --get remote.origin.url || echo unknown)"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
USER="$(git config user.name || echo unknown)"

# SAP version (best-effort from analysis/sap.md)
SAP_VERSION="$(grep -m1 '^Version:' analysis/sap.md 2>/dev/null | awk '{print $2}' || echo unknown)"

# Locked wave (best-effort from .methodsmith/data-state.yaml)
WAVE="$(grep -m1 '^current_wave:' .methodsmith/data-state.yaml 2>/dev/null | awk '{print $2}' || echo unknown)"
WAVE_HASH="$(awk -v w="$WAVE" '
  $1 == w":" { in_wave=1; next }
  in_wave && /^  hash_sha256:/ { print $2; exit }
  in_wave && /^[a-zA-Z0-9_-]+:$/ { exit }
' .methodsmith/data-state.yaml 2>/dev/null || echo unknown)"

# Hash any environment lock files that exist
ENV_LOCKS=""
for f in renv.lock requirements.txt pyproject.toml uv.lock pixi.lock environment.yml; do
  if [ -f "$f" ]; then
    H="$(shasum -a 256 "$f" | awk '{print $1}')"
    ENV_LOCKS="${ENV_LOCKS}  ${f}: ${H}\n"
  fi
done

cat > "$ARCHIVE/manifest.yaml" <<EOF
submission_tag: "$TAG"
frozen_at: "$NOW"
frozen_by: "$USER"
git:
  sha: "$SHA"
  branch: "$BRANCH"
  remote_url: "$REMOTE"
  tag: "submission/$TAG"
sap:
  path: "analysis/sap.md"
  version: "$SAP_VERSION"
data:
  current_wave: "$WAVE"
  hash_sha256: "$WAVE_HASH"
environment:
  lock_files_sha256:
$(printf "%b" "$ENV_LOCKS" | sed 's/^/  /')
notes: "Edit this file to add manuscript path / rendered hash / cover-letter ref."
EOF

# Tag the commit
git tag -a "submission/$TAG" -m "Submission freeze: $TAG (SAP $SAP_VERSION, wave $WAVE)"

cat <<EOF
Frozen $TAG at ${SHA:0:12}
  SAP version: $SAP_VERSION
  Data wave:   $WAVE (sha256: ${WAVE_HASH:0:16}...)
  Tag:         submission/$TAG
  Manifest:    $ARCHIVE/manifest.yaml

Next:
  - Edit $ARCHIVE/manifest.yaml to record the rendered manuscript path + hash.
  - Push the tag when ready: git push origin submission/$TAG
EOF
