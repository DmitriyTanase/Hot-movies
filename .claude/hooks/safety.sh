#!/usr/bin/env bash

# Claude Code Bash safety hook.
#
# Purpose:
#   Block high-risk shell commands that should always require explicit
#   human execution or approval.
#
# This hook is intentionally conservative and small.
# It is NOT a security sandbox. Agent role instructions remain responsible
# for deciding whether an otherwise allowed command is appropriate.

set -euo pipefail

# Claude Code PreToolUse hooks receive tool information as JSON on stdin.
INPUT="$(cat)"

# Extract the Bash command without requiring jq.
# Node.js is guaranteed to exist in this Angular project environment.
COMMAND="$(
  printf '%s' "$INPUT" | node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try {
        const data = JSON.parse(input);
        process.stdout.write(data.tool_input?.command ?? "");
      } catch {
        process.exit(2);
      }
    });
  '
)" || {
  echo "Safety hook: unable to parse Bash command." >&2
  exit 2
}

# Normalize to lowercase for case-insensitive checks.
LOWER_COMMAND="$(printf '%s' "$COMMAND" | tr '[:upper:]' '[:lower:]')"

block() {
  echo "BLOCKED by project safety policy: $1" >&2
  echo "Command: $COMMAND" >&2
  exit 2
}

# ---------------------------------------------------------------------------
# Git history / remote mutations
# ---------------------------------------------------------------------------

# "git" plus any global options before the subcommand, e.g. "git -C . push",
# "git -c user.name=x commit", "git --no-pager log".
GIT='(^|[[:space:];&|])git(([[:space:]]+-[cC][[:space:]]+[^[:space:]]+)|([[:space:]]+-[^[:space:]]+))*[[:space:]]+'

if [[ "$LOWER_COMMAND" =~ ${GIT}push([[:space:]]|$) ]]; then
  block "Agents may not push repository changes."
fi

if [[ "$LOWER_COMMAND" =~ ${GIT}reset[[:space:]]+--hard([[:space:]]|$) ]]; then
  block "Agents may not perform destructive Git resets."
fi

if [[ "$LOWER_COMMAND" =~ ${GIT}clean([[:space:]]|$) ]]; then
  block "Agents may not remove untracked files with git clean."
fi

if [[ "$LOWER_COMMAND" =~ ${GIT}rebase([[:space:]]|$) ]]; then
  block "Agents may not rewrite history with git rebase."
fi

if [[ "$LOWER_COMMAND" =~ ${GIT}commit([[:space:]]|$) ]]; then
  block "Git commits remain human-controlled."
fi

if [[ "$LOWER_COMMAND" =~ ${GIT}checkout[[:space:]]+--([[:space:]]|$) ]]; then
  block "Agents may not discard working-tree changes."
fi

if [[ "$LOWER_COMMAND" =~ ${GIT}restore.*(--worktree|--staged|[[:space:]]--[[:space:]]) ]]; then
  block "Agents may not use git restore to discard repository changes."
fi

# ---------------------------------------------------------------------------
# Dangerous filesystem operations
# ---------------------------------------------------------------------------

# Check each command segment (split on ; & |) that invokes rm for both a
# recursive and a force flag, in any order or form: -rf, -fr, -r -f,
# --recursive --force.
RM_RECURSIVE='(^|[[:space:]])(-[a-z]*r[a-z]*|--recursive)([[:space:]]|$)'
RM_FORCE='(^|[[:space:]])(-[a-z]*f[a-z]*|--force)([[:space:]]|$)'

while IFS= read -r SEGMENT; do
  if [[ "$SEGMENT" =~ (^|[[:space:]])rm([[:space:]].*)$ ]]; then
    RM_ARGS="${BASH_REMATCH[2]}"
    if [[ "$RM_ARGS" =~ $RM_RECURSIVE && "$RM_ARGS" =~ $RM_FORCE ]]; then
      block "Recursive forced deletion is not allowed."
    fi
  fi
done < <(printf '%s\n' "$LOWER_COMMAND" | tr ';&|' '\n\n\n')

# ---------------------------------------------------------------------------
# Dangerous permission changes
# ---------------------------------------------------------------------------

if [[ "$LOWER_COMMAND" =~ (^|[[:space:]\;\&\|])chmod[[:space:]]+(-r[[:space:]]+)?777([[:space:]]|$) ]]; then
  block "Broad chmod 777 permissions are not allowed."
fi

# ---------------------------------------------------------------------------
# Shell / remote execution patterns
# ---------------------------------------------------------------------------

# curl/wget piped into bash, sh or zsh, optionally via sudo (with options).
SHELL_SINK='\|[[:space:]]*(sudo([[:space:]]+-[^[:space:]]+)*[[:space:]]+)?(bash|sh|zsh)([[:space:];&|)]|$)'

if [[ "$LOWER_COMMAND" =~ (curl|wget)[^$'\n']*${SHELL_SINK} ]]; then
  block "Piping downloaded content directly into a shell is not allowed."
fi

# Command allowed.
exit 0