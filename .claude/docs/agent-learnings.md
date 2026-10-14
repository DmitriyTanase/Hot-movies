# Agent Learnings

## Agent capability must match responsibility

If an agent is responsible for producing or updating repository artifacts,
its tool permissions must explicitly support that responsibility.

Do not rely on Bash as a substitute for Write/Edit when structured file
editing is expected.

## Maintain a single requirements source of truth

`.claude/context/assignment.md` is the canonical product requirements source.

Do not duplicate authoritative requirements across agent instructions or
project documentation. Summaries may exist for convenience but must never
replace the canonical assignment.

## Prefer enforced boundaries over prompt-only boundaries

Critical safety restrictions should be enforced through tool permissions or
hooks where practical, rather than relying exclusively on natural-language
instructions.

## Validate enforcement in the real execution path

A safety mechanism is not considered active merely because its implementation
works in isolation.

Hooks and permission controls must be verified through the actual agent/tool
execution path that they are intended to protect.