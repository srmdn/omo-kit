# omo-kit

CLI toolkit for [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) and [OpenCode](https://github.com/anomalyco/opencode). Generate configs, validate them, manage themes — no hand-editing JSON.

## Install

```bash
bun install -g omo-kit
```

## Commands

| Command | What |
|---|---|
| `omo-kit init` | Interactive config generator — stack, models, budget |
| `omo-kit doctor` | Validate existing config files for errors and stale references |
| `omo-kit theme` | Validate or generate OpenCode themes |

Full docs: **[srmdn.github.io/rig/cli/](https://srmdn.github.io/rig/cli/)**

## Quickstart

```bash
# Generate a full OMO + OpenCode workspace
omo-kit init

# Check configs for problems
omo-kit doctor

# Create a custom theme
omo-kit theme generate
```

## License

MIT
