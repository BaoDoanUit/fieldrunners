# CodeGraph Setup

> Interactive DeepWiki-style code graph for the FieldRunner repo. The static
> map in [`CODEGRAPH.md`](./CODEGRAPH.md) is always available; this document
> explains how to layer an **LLM-backed wiki + Q&A** on top, using your
> MiniMax **Token Plan** subscription key.

## Architecture at a glance

```
┌────────────────────────┐     ┌──────────────────────────┐
│  Next.js frontend      │     │  FastAPI backend         │
│  (deepwiki-open/src)   │ ◀─▶ │  (deepwiki-open/api)     │
│  http://localhost:3000 │     │  http://localhost:8001   │
└────────────────────────┘     └──────────┬───────────────┘
                                          │
                                          │ adalflow + faiss
                                          │ embeddings + RAG
                                          ▼
                              ┌──────────────────────────┐
                              │  MiniMax M3 (Token Plan) │
                              │  https://api.minimax.io  │
                              │  text-embedding-v3 + M3  │
                              └──────────────────────────┘
```

- **DeepWiki-Open** is a separate git checkout at `~/tools/deepwiki-open/`.
- It clones/reads this repo via its git URL (the local git we just
  initialised is fine), so you don't need to push to GitHub.
- All caches live in `~/.adalflow/` (outside the project).

## Prerequisites

- Python 3.11+ (`python3 --version` — already 3.12.3 here)
- `pip` in your user site (`~/.local/bin/pip` — already installed)
- A Token Plan **Subscription Key** from
  <https://platform.minimax.io/user-center/payment/token-plan>
- This repo initialised as a git repo (already done)

## One-time setup

```bash
# 1. Clone DeepWiki-Open (one-off; already done at ~/tools/deepwiki-open/)
git clone --depth 1 https://github.com/AsyncFuncAI/deepwiki-open.git ~/tools/

# 2. Install Python deps (one-off; already running)
export PATH=$HOME/.local/bin:$PATH
pip install --user --break-system-packages \
  fastapi 'uvicorn[standard]' pydantic tiktoken adalflow numpy \
  faiss-cpu langid requests jinja2 python-dotenv openai ollama \
  aiohttp gitpython websockets

# 3. Drop your Token Plan key into DeepWiki-Open's .env
nano ~/tools/deepwiki-open/.env
#   OPENAI_API_KEY=sk-cp-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
#   (leave OPENAI_BASE_URL=https://api.minimax.io/v1)

# 4. Make sure the embedder uses the OpenAI-compatible config
cp ~/tools/deepwiki-open/api/config/embedder.openai_compatible.json.bak \
   ~/tools/deepwiki-open/api/config/embedder.json
```

The `generator.json` under `~/tools/deepwiki-open/api/config/` has already been
edited to:

- `default_provider: "openai"`
- `openai.default_model: "MiniMax-M3"`
- `MiniMax-M3` and `MiniMax-M2.7` registered in the `openai.models` table

You don't need to change those again.

## Daily use

Two convenience scripts live in `.codegraph/scripts/`:

```bash
# Start the backend (FastAPI on :8001)
.codegraph/scripts/codegraph-up.sh

# Open the frontend (Next.js on :3000)
.codegraph/scripts/codegraph-ui.sh
```

Then:

1. Visit <http://localhost:3000>
2. Paste a repo URL. The simplest one is the local one:
   ```
   file:///home/baodoan/Documents/Codes/FieldRunner
   ```
   (DeepWiki accepts `file://` paths for local repos. If it rejects them,
   push the repo to GitHub and use the HTTPS URL instead.)
3. Click **Generate Wiki**.
4. Use the **Ask** tab for RAG-powered Q&A.

## Verifying the config

```bash
cd ~/tools/deepwiki-open
PATH=$HOME/.local/bin:$PATH python -c "
import json, os
from api.config import load_generator_config, load_embedder_config
g = load_generator_config()
e = load_embedder_config()
print('default_provider:', g.get('default_provider'))
print('openai default_model:', g['providers']['openai']['default_model'])
print('openai.base_url:', os.environ.get('OPENAI_BASE_URL'))
print('openai.api_key set:', bool(os.environ.get('OPENAI_API_KEY')))
print('embedder:', e['embedder']['client_class'], e['embedder']['model_kwargs']['model'])
"
```

Expected output (with your real key in place of the placeholder):

```
default_provider: openai
openai default_model: MiniMax-M3
openai.base_url: https://api.minimax.io/v1
openai.api_key set: True
embedder: OpenAIClient text-embedding-v3
```

## Regenerating the static code map

```bash
node .codegraph/scripts/build-static-graph.mjs   # prints JSON summary
```

The Mermaid block in `CODEGRAPH.md` is hand-curated; re-read it after large
refactors and update it from the JSON output.

## Troubleshooting

| Symptom                                  | Likely cause                                | Fix                                                                |
| ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| `OpenAI API key not set`                 | `.env` not loaded                            | `cd ~/tools/deepwiki-open && python -m api.main` (loads .env auto) |
| `Unknown provider: openai`               | Wrong `generator.json` syntax                | Validate with `python -c "import json; json.load(open('api/config/generator.json'))"` |
| `Could not clone <url>`                  | Wrong repo URL / no git                     | Use a valid `file://` or `https://` URL                            |
| 401 / 403 from `api.minimax.io`          | Bad or expired Token Plan key                | Re-copy from <https://platform.minimax.io/user-center/payment/token-plan> |
| Embedding 404                            | `text-embedding-v3` not on the chosen model | Switch `embedder.json` to `embedder.openai_compatible.json.bak` and try again |

## Security

- `~/tools/deepwiki-open/.env` is **not** in any git repo (it's outside the
  project and the DeepWiki clone is intended to be ephemeral).
- The project-side `.gitignore` ignores `.env` files, so a stray `cp` won't
  leak the key into the FieldRunner repo.
- Never paste the key into chat or commit it.
