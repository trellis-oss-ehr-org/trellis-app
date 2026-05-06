# Codex Audit Agents

These Markdown files are copy-ready instructions for Codex. Each Trellis
installer can open their local clone in Codex and ask it to run one of these
reviews against their own instance.

## Quick Prompts

HIPAA-oriented installation review:

```text
Use docs/agents/hipaa-audit-agent.md to run a HIPAA-oriented audit of this
Trellis instance. Inspect the repository and local configuration safely, run
non-destructive checks where available, and return prioritized findings. Do not
print secrets or ask me to paste PHI.
```

Code quality and application security review:

```text
Use docs/agents/code-quality-security-agent.md to run a code quality and
security audit of this Trellis instance. Inspect the repository, run safe
automated checks where available, and return prioritized findings with file
references and remediation steps. Do not make code changes unless I approve.
```

Combined security audit:

```text
Run a full Trellis security audit using docs/agents/code-quality-security-agent.md
and docs/agents/hipaa-audit-agent.md. Start with code and dependency risks, then
map the results to HIPAA-oriented technical and operational safeguards. Return
one concise report with commands run, skipped checks, findings, and next steps.
```

## Files

- `hipaa-audit-agent.md` focuses on ePHI data flows, HIPAA Security Rule
  safeguards, operational controls, deployment configuration, and evidence gaps.
- `code-quality-security-agent.md` focuses on application security, dependency
  risk, code quality, tests, and secure implementation issues.

These agents do not provide legal advice or certify HIPAA compliance. They are
structured review prompts that help each practice identify evidence, risks, and
follow-up work for its own deployment.
