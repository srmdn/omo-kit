# AGENTS.md — Go Project

## Tooling
- Go toolchain only; no additional build tools required
- Linting: `go vet` + `staticcheck` (if installed)
- Formatting: `go fmt` (run before commit)

## Agent Instructions
- Read CLAUDE.md for full project conventions
- Keep imports organized: stdlib first, then third-party
- Prefer standard library over external dependencies
- Do not introduce new dependencies without approval
