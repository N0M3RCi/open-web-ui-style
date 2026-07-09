```bash
# Option 1: Start with uvicorn directly
uv run uvicorn main:api --port 5001

# Option 2: Standalone mode (no Electron dependency)
uv run python main.py

# Option 3: If uv run hangs, delete lock files and retry, or use venv directly:
.venv/bin/python main.py
# or
.venv/bin/uvicorn main:api --port 5001 --host 0.0.0.0

# If uv hangs, delete lock files first: rm -f uv_installing.lock uv_installed.lock
```

### Environment Variables (Standalone)

| Variable                         | Default           | Description                                                                               |
| -------------------------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| `NOVA_BRAIN_PORT`                | 5001              | Listening port                                                                            |
| `NOVA_BRAIN_HOST`                | 0.0.0.0           | Listening address                                                                         |
| `NOVA_DEBUG`                     | -                 | Set to 1/true to enable reload                                                            |
| `NOVA_WORKSPACE`                 | ~/.nova/workspace | Working directory                                                                         |
| `NOVA_DEPLOYMENT_TYPE`           | (auto)            | `local` / `cloud_vm` / `sandbox` / `docker`; determines Hands capabilities (see ADR-0006) |
| `NOVA_HANDS_MODE`                | -                 | Set to `remote` to enable `RemoteHands` (remote cluster resource mode)                    |
| `NOVA_HANDS_CLUSTER_CONFIG_FILE` | -                 | Path to `RemoteHands` config file (TOML); **recommended**                                 |
| `NOVA_HANDS_TERMINAL`            | -                 | Override terminal hand: `1`/`true`/`yes` or `0`/`false`/`no`                              |
| `NOVA_HANDS_BROWSER`             | -                 | Override browser hand                                                                     |
| `NOVA_HANDS_FILESYSTEM`          | -                 | Override filesystem scope: `full` / `workspace_only`                                      |
| `NOVA_HANDS_MCP`                 | -                 | Override MCP mode: `all` / `allowlist`                                                    |

RemoteHands config file example:

```bash
cp backend/config/hands_clusters.example.toml ~/.nova/hands_clusters.toml
export NOVA_HANDS_MODE=remote
export NOVA_HANDS_CLUSTER_CONFIG_FILE=~/.nova/hands_clusters.toml
```

i18n operation process: https://github.com/Anbarryprojects/fastapi-babel

```bash

pybabel extract -F babel.cfg -o messages.pot . --ignore-pot-creation-date  # Extract multilingual strings from code to messages.pot file
pybabel init -i messages.pot -d lang -l zh_CN   # Generate Chinese language pack, can only be generated initially, subsequent execution will cause overwrite
pybabel compile -d lang -l zh_CN                # Compile language pack


pybabel update -i messages.pot -d lang
# -i messages.pot: Specify the input file as the generated .pot file
# -d translations: Specify the translation directory, which typically contains .po files for each language
# -l zh: Specify the language code
```

```bash
# regular search
\berror\b(?!\])
```
