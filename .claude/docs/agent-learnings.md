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

## Validation caches must not undermine source-of-truth

A passing validation command is not sufficient evidence when the underlying
tool can reuse persistent compiled or transformed artifacts.

For critical validation paths:

- ensure source changes invalidate or bypass relevant caches;
- investigate when observed test output does not match current source;
- use a small reversible mutation check when cache correctness is genuinely
  in doubt;
- prefer deterministic project configuration over relying on developers to
  manually clear caches.

Never treat a green test run as authoritative when there is evidence that the
executed code may differ from the current source.