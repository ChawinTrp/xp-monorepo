# @xp/mcp-server

A local MCP (stdio) server that lets Claude read and safely mutate live XP data.

## Scope
- **Read:** `search_nodes`, `get_node`
- **Write:** `create_node`, `update_node`, `archive_node`, `unarchive_node`
- **Actions:** `complete_task`, `check_in_routine`, `start_task_timer`, `stop_task_timer`

No hard-delete tool — removal is soft (archive) only. Hard delete stays a human action in the web UI.

## Build
    npm install
    npm run build -w @xp/mcp-server

## Test
    npm test -w @xp/mcp-server

## Configure in Claude Desktop
Add to `claude_desktop_config.json`:

    {
      "mcpServers": {
        "xp": {
          "command": "node",
          "args": ["C:/Projects/XP/xp-monorepo/packages/mcp-server/dist/index.js"],
          "env": { "XP_API_URL": "https://xp-monorepo.onrender.com/graphql" }
        }
      }
    }

Point `XP_API_URL` at `http://localhost:3000/graphql` for local development.

## Note
The XP API has no auth yet (tracked as Phase 11). Guardrails here are agent-behaviour
guardrails (no hard delete, field whitelist, per-type metadata validation), not network auth.
