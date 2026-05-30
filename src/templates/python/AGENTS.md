# AGENTS.md — Python Project

## Identity
- Set your git identity before first commit: `git config user.name "Your Name" && git config user.email "you@example.com"`

## Stack
- Runtime: Python 3.14+
- Package manager: uv
- Linter: ruff
- Formatter: ruff format
- Type checker: mypy (strict mode)

## Tooling
- uv for package management
- ruff for linting and formatting
- pytest for testing
- mypy for type checking

## Conventions
- `src/` for source, `tests/` for tests
- pytest with `*_test.py` naming
- Type hints on all public functions
- `pyproject.toml` for project config (not setup.py)

## Commands
- `uv sync` — install dependencies
- `uv run pytest` — run tests
- `uv run ruff check .` — lint
- `uv run mypy src/` — type check

## Agent Instructions
- Do not introduce new dependencies without approval
- Keep imports sorted (ruff will handle this)

## Commit Style
- Small, atomic commits
- Conventional commit prefixes: feat, fix, refactor, docs, chore
