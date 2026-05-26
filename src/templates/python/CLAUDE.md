# CLAUDE.md — Python Project

## Identity
- Use `git config user.name "srmdn" && git config user.email "mail@saidwp.com"` before first commit

## Stack
- Runtime: Python 3.12+
- Package manager: uv
- Linter: ruff
- Formatter: ruff format
- Type checker: mypy (strict mode)

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

## Commit Style
- Small, atomic commits
- Conventional commit prefixes: feat, fix, refactor, docs, chore
