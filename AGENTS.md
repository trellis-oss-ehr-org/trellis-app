# Trellis Codex Instructions

Trellis is a HIPAA-oriented EHR for behavioral health practices. Treat this
repository as software that may process ePHI when deployed, but do not treat the
codebase alone as a compliance certification.

## Setup

When a user asks to install, configure, or deploy Trellis, use `SETUP.md` as the
primary runbook. Ask only for values that cannot be discovered locally or from
their Google Cloud/Firebase consoles.

## Audit Agents

When a user asks for a HIPAA, compliance, ePHI, BAA, privacy, or risk-analysis
review, follow `docs/agents/hipaa-audit-agent.md`.

When a user asks for a code quality, application security, dependency, or secure
coding review, follow `docs/agents/code-quality-security-agent.md`.

When a user asks for a general security audit, use both audit agents. Start with
the code quality and security audit, then map relevant findings into the
HIPAA-oriented operational review.

## Safety Rules

- Never print secrets, `.env` values, service account keys, OAuth client
  secrets, database passwords, live tokens, private URLs, or real client data.
- Do not ask the user to paste PHI/ePHI into Codex.
- Do not mutate production resources, rotate secrets, change IAM, deploy
  services, or run destructive commands unless the user explicitly asks.
- In audit mode, report findings and do not edit application code unless the
  user asks for remediation work.
- Prefer existing Makefile targets and non-destructive inspection commands.
- Findings should include evidence, impact, and a concrete remediation path.
