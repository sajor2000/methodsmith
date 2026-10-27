---
name: method-update
description: "Checks whether methodsmith is current and gives the exact update command for Claude Code, Codex, OpenCode, Pi, Gemini CLI, Kiro, or Qwen Code. Finds a pre-5.0 ce-datascience install and prints the switch. Use when asked if methodsmith is up to date or how to update or migrate." # rebrand:keep
disable-model-invocation: true
---

# Check And Update methodsmith


## Skill Value

- **Problem it solves:** Users keep running an old copy of the plugin without knowing a newer version exists or which command updates their harness.
- **Use when:** The user asks whether methodsmith is up to date, or how to update it, in any supported harness.
- **Output:** An installed-vs-upstream verdict where the harness exposes the installed version, and the one update command for that harness.
- **Ask only if:** The harness cannot be identified from the session and the install location; ask which agent app they use.
- **Do not do:** Do not run the update for the user, edit plugin caches, or move files. Updates keep the user's own skills, so never tell them to delete or move their skills first.
- **Interaction:** No user question normally; proceed from the provided inputs and local evidence.

Report whether methodsmith is current and give the exact command that
updates it. Updates never delete or overwrite your own skills: the plugin only
replaces files it installed, and it backs up any plugin file you edited before
replacing it.

## 0. Check for an install from before 5.0

<!-- rebrand:keep-start -->
Methodsmith was named ce-datascience before 5.0, and its commands started with
`ce-`. Run the read-only detector first:
<!-- rebrand:keep-end -->

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
bash "$SKILL_DIR/scripts/detect-pre-rename-install.sh"
```

- If it reports an old install, show its output as printed: one block of exact
  commands per harness, then the renamed-commands table. Add that the new
  install moves the old plugin's files to a backups folder instead of deleting
  them, and that the user's own skills stay where they are.
  Do not run these commands for the user.
- If it reports a **Project state folder**, show its `mv` command as printed
  and say why: the folder holds the PHI-boundary settings, and until it is
  moved the boundary guard treats the project as schema-only. Do not run the
  move for the user.
- If it reports nothing to migrate, continue without mentioning it.
- If the script is missing or `bash` is unavailable, check by hand for the
  folders it looks for and point the user to `references/renamed-commands.md`
  for the old -> new command names.

## 1. Identify the harness

Use the harness you are running in. Claude Code resolves the **Skill
directory** line below to a real path; every other harness leaves it empty or
shows the literal command text.

## 2. Claude Code

### Pre-resolved context

Only the **Skill directory** determines whether this session is Claude Code —
if empty or unresolved, this is another harness; go to section 3. The other sections may
contain error sentinels even in valid Claude Code sessions; the decision logic
below handles those cases.

`${CLAUDE_SKILL_DIR}` is a Claude Code-documented substitution that resolves
at skill-load time. For a marketplace-cached install it looks like
`~/.claude/plugins/cache/<marketplace>/methodsmith/<version>/skills/method-update`,
so the currently-loaded version is the basename two `dirname` levels up.

Compare against `plugins/methodsmith/.claude-plugin/plugin.json` on `main`
HEAD, not release tags; the marketplace installs from `main`.

**Skill directory:**
!`echo "${CLAUDE_SKILL_DIR}"`

**Latest upstream version:**
!`version=$(gh api repos/sajor2000/methodsmith/contents/plugins/methodsmith/.claude-plugin/plugin.json --jq '.content | @base64d | fromjson | .version' 2>/dev/null) && [ -n "$version" ] && echo "$version" || echo '__CE_UPDATE_VERSION_FAILED__'`

**Currently loaded version:**
!`echo "${CLAUDE_SKILL_DIR}" | grep -q "/plugins/cache/.*methodsmith/.*/skills/method-update$" && basename "$(dirname "$(dirname "${CLAUDE_SKILL_DIR}")")" || echo '__CE_UPDATE_NOT_MARKETPLACE__'`

**Marketplace name:**
!`echo "${CLAUDE_SKILL_DIR}" | grep -q "/plugins/cache/.*methodsmith/.*/skills/method-update$" && basename "$(dirname "$(dirname "$(dirname "$(dirname "${CLAUDE_SKILL_DIR}")")")")" || echo '__CE_UPDATE_NOT_MARKETPLACE__'`

### Claude Code decision logic

If **Skill directory** is empty or unresolved, skip to section 3.

If **Currently loaded version** contains `__CE_UPDATE_NOT_MARKETPLACE__`: this
session loaded the skill from outside the standard marketplace cache (typical
when using `claude --plugin-dir` for local development, or for a non-standard
install). Tell the user (substituting the actual path):

> "Skill is loaded from `{skill-directory}` — not the standard marketplace
> cache at `~/.claude/plugins/cache/`. This is normal when using
> `claude --plugin-dir` for local development. No action for this session.
> Your marketplace install (if any) is unaffected — load the `method-update` skill in a
> regular Claude Code session (no `--plugin-dir`) to check that cache."

Then stop.

If **Latest upstream version** contains `__CE_UPDATE_VERSION_FAILED__`: tell
the user the upstream version could not be fetched (gh may be unavailable or
rate-limited), give the update command below anyway, and stop. Fill
`{marketplace-name}` from **Marketplace name**; if that line holds a sentinel,
tell the user to read the name from `/plugin` under **Marketplaces**.

**Up to date** — `{currently loaded} == {latest upstream}`:

> "methodsmith **v{version}** is installed and up to date."

**Out of date** — `{currently loaded} != {latest upstream}`:

> "methodsmith is on **v{currently loaded}** but **v{latest upstream}** is available.
>
> Update with:
> ```
> claude plugin update methodsmith@{marketplace-name}
> ```
> Then run `/reload-plugins` or restart Claude Code."

Derive `{marketplace-name}` from the skill path; never hardcode it, because the
plugin ships under more than one marketplace name.

In both cases add one line about automatic updates: Claude Code updates
third-party marketplaces in the background only when auto-update is on for
that marketplace. To turn it on, run `/plugin`, open **Marketplaces**, select
`{marketplace-name}`, and choose **Enable auto-update**. The repository's
`install.sh claude` turns it on by default.

## 3. Other harnesses

These harnesses do not expose the installed plugin version to a skill, so do
not claim a version comparison. Optionally report the latest upstream version
(read-only; skip silently when offline):

```bash
curl -fsSL https://raw.githubusercontent.com/sajor2000/methodsmith/main/plugins/methodsmith/.claude-plugin/plugin.json
```

Then give the one command for the harness in use. Re-running an install is
safe: it replaces only plugin-owned files and keeps your own skills.

| Harness | Update command | Then |
|---|---|---|
| Codex (plugin from the GitHub marketplace) | `codex plugin marketplace upgrade methodsmith` | Restart Codex. Codex does not update plugins automatically. |
| Codex (generated Methodsmith agents) | `bunx github:sajor2000/methodsmith install methodsmith --to codex --codex-home "${CODEX_HOME:-$HOME/.codex}"` | Restart Codex. |
| OpenCode | `bunx github:sajor2000/methodsmith install methodsmith --to opencode` | Add `--output <workspace>` for a project install. Restart OpenCode. |
| Pi | `bunx github:sajor2000/methodsmith install methodsmith --to pi --pi-home "$HOME/.pi/agent"` | Restart Pi. |
| Gemini CLI | `bunx github:sajor2000/methodsmith install methodsmith --to gemini --output <workspace>` | Restart Gemini CLI. |
| Kiro | `bunx github:sajor2000/methodsmith install methodsmith --to kiro --output <workspace>` | Restart Kiro. |
| Qwen Code | `qwen extensions update methodsmith` | Restart Qwen Code. |

To tell which Codex marketplace is in use, run the read-only
`codex plugin marketplace list`. If `methodsmith` points at a local
folder instead of GitHub, the update is `git pull` in that folder followed by
re-running `bash install.sh codex` there.

If the harness is not in this table, say so and point the user to the
"Keep Methodsmith updated" section of the repository's `docs/setup.md`.
