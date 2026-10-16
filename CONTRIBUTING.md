# Contributing

ContextOS is a minimal YouTube context prototype. Please discuss large changes before implementing them; V1 does not include chat, notes, accounts, or cloud personal-profile sync.

## Development

Use Java 21, Maven, Node.js 22.12+ and Chrome. Follow the root README, run `npm ci`, and use memory persistence with `CONTEXTOS_GEMINI_ENABLED=false` for credential-free development. Mock responses are fixtures, not actual video analysis.

From the repository root, validate changes with:

```bash
npm test
npm run typecheck
npm run build
mvn -f backend/pom.xml package
```

Include focused regression tests for behavior changes. In pull requests describe the problem, resulting behavior, verification, and untested live integrations. Distinguish real Gemini output from fixtures.

## Commits

Use Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`, `test(scope): ...`, or `chore(scope): ...`. Describe the actual change, for example `fix(extension): match backend port in local setup`.

## Before Sharing

Never commit `.env` files, API keys, service-account JSON, tokens, browser profiles, or private logs. Use placeholder-only `.env.example` files. Review `git diff --cached` before committing. Report vulnerabilities as described in SECURITY.md rather than posting credentials in an issue.
