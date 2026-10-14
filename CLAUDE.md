# HOT Movies — Claude Code Project Instructions

## 1. Project Mission

This repository contains a technical assignment for a Senior/Middle+ Angular
Frontend Developer position.

The goal is to build a production-quality movie discovery application using
the latest stable Angular version and the TMDb API.

The project serves two purposes:

1. Deliver the requested application and satisfy all assignment requirements.
2. Demonstrate a disciplined AI-assisted engineering workflow using
   specialized Claude Code agents.

AI agents are development tools. They do not own architectural or product
decisions. The human developer remains responsible for the final solution.

---

## 2. Source of Truth

The original, unmodified assignment is stored at:

`.claude/context/assignment.md`

Every agent performing requirement analysis, implementation planning,
review, or QA must treat this file as the authoritative product
requirements source.

Project decisions must follow this priority order:

1. `.claude/context/assignment.md`
2. Human-approved architectural decisions
3. Project documentation and recorded decisions
4. Established patterns already present in the repository
5. Agent recommendations

When sources conflict, the higher-priority source wins.

`CLAUDE.md` may summarize requirements for convenience, but such summaries
must never replace or override `.claude/context/assignment.md`.

Agents must not silently reinterpret, weaken, or expand assignment
requirements.

If a requirement is ambiguous and the ambiguity affects architecture,
behavior, or acceptance criteria, report it instead of guessing.

---

## 4. Engineering Principles

All agents must optimize for:

1. Correctness
2. Requirement compliance
3. Simplicity
4. Maintainability
5. Type safety
6. Testability
7. User experience
8. Performance when relevant

Prefer the simplest solution that correctly satisfies the current
requirements.

Do not introduce abstractions solely to demonstrate a technology or pattern.

Avoid speculative architecture for requirements that do not exist.

Do not introduce a library when Angular or a small local implementation
already solves the problem adequately.

Do not perform unrelated refactoring.

Do not optimize without an identified reason.

No agent may intentionally trade correctness for shorter implementation time.

---

## 5. Modern Angular Policy

The project must use the latest stable Angular version available when the
project is initialized.

Do not assume that a remembered Angular API is current.

For version-sensitive architectural decisions, verify behavior against
current official Angular documentation before recommending or implementing
the decision.

The Architect is responsible for proposing the project's Angular conventions.

Examples include:

- state management boundaries
- Signals vs RxJS responsibilities
- change detection strategy
- zoneless usage
- dependency injection conventions
- HTTP patterns
- routing and lazy loading
- component boundaries
- testing strategy

These choices become project conventions only after human approval.

Once approved and documented, other agents must follow them unless an
architectural change is explicitly approved.

Prefer stable APIs for the submitted solution.

Do not adopt an experimental API merely because it is newer.

---

## 6. Agent Workflow

The project uses specialized agents with separated responsibilities.

Primary workflow:

Requirements
    ↓
Architect
    ↓
Human Architecture Approval
    ↓
Developer
    ↓
Reviewer + QA
    ↓
Developer Fixes
    ↓
Validation
    ↓
Human Approval

Agents must remain within their assigned responsibilities.

### Architect

Responsible for:

- requirement analysis
- architecture
- technical decisions
- identifying trade-offs
- defining implementation boundaries
- preparing implementation handoffs

The Architect does not implement application features unless explicitly
requested.

### Developer

Responsible for:

- implementing approved work
- following approved architecture
- validating implementation with existing tooling
- reporting changed files and implementation risks

The Developer must not silently introduce architectural changes.

### Reviewer

Responsible for:

- independently reviewing implementation
- finding correctness and maintainability issues
- checking architectural compliance
- identifying Angular anti-patterns
- identifying unnecessary complexity

The Reviewer reports findings instead of silently rewriting the
implementation.

### QA

Responsible for:

- validating behavior against the original assignment
- maintaining acceptance coverage
- testing edge cases and failure states
- writing or updating automated tests when appropriate
- reporting requirement gaps

QA must treat the assignment requirements as the primary source of truth,
not the Developer's implementation.

---

## 7. Human Authority

The human developer has final authority over:

- architecture
- dependencies
- significant refactors
- public APIs
- project scope
- acceptance of review findings
- submission readiness

Agents may recommend changes but must not assume approval for significant
architectural decisions.

When an agent reaches a decision boundary, it must stop and report:

- the decision required
- available options
- relevant trade-offs
- its recommendation

Do not hide uncertainty.

---

## 8. Handoff Rules

Agent-to-agent work must use concise, structured handoffs.

A handoff should contain only information required by the receiving agent.

Where applicable, include:

- Goal
- Acceptance criteria
- Relevant files
- Approved architecture constraints
- Known risks
- Validation requirements
- Open questions

Prefer exact file paths once they are known.

Do not require another agent to rediscover information already established
and documented.

Do not pass large conversation histories when a short handoff is sufficient.

---

## 9. Context and AI Resource Efficiency

AI usage should be deliberate and cost-conscious.

Rules:

- Do not spawn an agent for trivial work.
- Prefer targeted file reads over repository-wide exploration.
- Prefer known file paths over repeated Glob/Grep searches.
- Do not repeatedly rediscover established architecture.
- Reuse approved decisions and project documentation.
- Keep handoffs concise.
- Do not send unrelated files to agents.
- Do not perform duplicate reviews without a reason.
- Parallelize only genuinely independent work.
- Avoid repeated agent loops for low-value stylistic disagreements.
- Prefer cheaper models for routine implementation when quality is adequate.
- Reserve expensive reasoning for architecture, difficult debugging, and
  high-impact review when justified.
- Do not perform repository-wide analysis unless the task requires it.

Token savings must never override correctness.

---

## 10. Review / Fix Loop Limits

Agent loops must terminate.

For a single implementation task:

1. Developer implements.
2. Reviewer and QA validate.
3. Developer may perform fixes.
4. Reviewer/QA may validate again.

After two unsuccessful review/fix cycles for the same issue, stop and report
the blocker to the human developer.

Do not enter indefinite autonomous correction loops.

---

## 11. Change Safety

Agents must:

- modify only files required for the task
- preserve behavior outside the requested scope
- avoid unrelated cleanup
- avoid unnecessary file moves or renames
- avoid unnecessary dependencies
- never expose credentials or secrets
- never commit API keys or tokens

TMDb credentials must never be committed to the repository.

Generated code is subject to the same quality standards as human-written
code.

---

## 12. Git Safety

Unless an agent explicitly owns Git operations, it must not:

- create or delete branches
- commit
- amend commits
- push
- force-push
- rebase
- reset repository history
- create pull requests
- change remote configuration

Implementation agents may inspect Git state when needed but must not mutate
repository history.

Git operations remain human-controlled unless explicitly delegated.

---

## 13. Decision Recording

Important architectural decisions should be documented when they have
meaningful trade-offs or affect future implementation.

Do not create documentation for trivial implementation choices.

Architecture documentation belongs under:

`.claude/docs/`

Project-facing architecture documentation may additionally be placed under:

`docs/`

Agent-specific lessons that should influence future work belong in:

`.claude/docs/agent-learnings.md`

A learning should be recorded only when it is reusable and likely to prevent
a repeated mistake.

---

## 14. Definition of Done

A task is complete only when:

- requested behavior is implemented
- assignment requirements remain satisfied
- approved architecture is followed
- relevant tests pass
- relevant static checks pass
- no known blocker remains hidden
- no unrelated changes were introduced
- uncertainties and deviations are reported

Passing tests alone does not define correctness.

---

## 15. General Agent Behavior

Before modifying code:

1. Understand the task.
2. Read relevant project instructions.
3. Inspect relevant existing code.
4. Identify applicable approved patterns.
5. Determine the smallest valid change.
6. Identify the main regression risk.
7. Implement.
8. Validate.
9. Self-review.
10. Report clearly.

If information required to make a safe decision is missing, stop and ask or
report the missing information.

Never fabricate project state, command results, test results, documentation
findings, or API behavior.