# CLAUDE.md — Rust Project

## Identity
- Use `git config user.name "srmdn" && git config user.email "mail@saidwp.com"` before first commit

## Stack
- Edition: 2024
- Build: cargo
- Linter: clippy
- Formatter: rustfmt

## Conventions
- `src/` for source, `tests/` for integration tests
- Unit tests in same file with `#[cfg(test)]` module
- Public API documented with `///` doc comments
- Use `anyhow` for application errors, `thiserror` for libraries
- Prefer `&str` over `String` for function params

## Commands
- `cargo build` — compile
- `cargo test` — run tests
- `cargo clippy -- -D warnings` — lint
- `cargo fmt -- --check` — check formatting
- `cargo run` — run binary

## Commit Style
- Small, atomic commits
- Conventional commit prefixes: feat, fix, refactor, docs, chore
