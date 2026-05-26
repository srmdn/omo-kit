# CLAUDE.md — Go Project

## Identity
- Go module-based project
- Use `git config user.name "srmdn" && git config user.email "mail@saidwp.com"` before first commit

## Stack
- Go 1.22+
- Database: modernc.org/sqlite (pure Go SQLite, no CGO)
- Deploy: systemd + nginx on Ubuntu 24.04

## Conventions
- Standard Go project layout: `cmd/`, `internal/`, `pkg/`
- Tests alongside source: `*_test.go`
- Error handling: always check and wrap with `fmt.Errorf("context: %w", err)`
- Use `net/http` standard library; avoid heavy frameworks
- Configuration via environment variables or flags

## Commands
- `go build ./...` — build all packages
- `go test ./...` — run all tests
- `go vet ./...` — static analysis
- `go run ./cmd/<name>` — run a binary

## Commit Style
- Small, atomic commits
- Conventional commit prefixes: feat, fix, refactor, docs, chore
