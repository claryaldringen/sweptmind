# CLI README + MCP Server Design

**Date:** 2026-04-14
**Status:** Approved

## Overview

Add documentation (README.md) and MCP server to the `sweptmind-cli` npm package so users can discover how to use it and integrate it into Claude Code as native tools.

## README.md (`packages/cli/README.md`)

Concise overview-style README (option B). Sections:

1. **Header** — name, one-line description, npm badge
2. **Install** — `npm i -g sweptmind-cli`
3. **Authentication** — OAuth (`sm login`) + API token (`sm login --token` / `SM_TOKEN` env var)
4. **Quick Start** — 4-5 command example flow (login, list ls, task add, task complete)
5. **Commands** — table: command | description (all ~30 subcommands)
6. **Configuration** — config commands, valid keys, env vars
7. **JSON Output** — `--json` flag, TTY auto-detection for scripting
8. **Claude Code Integration** — MCP server setup instructions
9. **License** — MIT

No per-command detailed docs — users use `sm <command> --help` for details.

## MCP Server

### Entry point

New file `packages/cli/src/mcp-server.ts`. Registered as `sm serve` command.

### Protocol

MCP over stdio using `@modelcontextprotocol/sdk`. Standard transport for Claude Code.

### Tools (1:1 mapping with CLI commands)

30 tools total:

- `whoami`
- `task_list`, `task_show`, `task_add`, `task_edit`, `task_complete`, `task_uncomplete`, `task_delete`, `task_move`, `task_clone`
- `step_add`, `step_list`, `step_complete`, `step_delete`
- `list_ls`, `list_create`, `list_show`, `list_edit`, `list_delete`
- `group_ls`, `group_create`, `group_delete`
- `location_ls`, `location_create`, `location_edit`, `location_delete`
- `share_add`, `share_remove`, `share_list`
- `connection_ls`, `connection_invite`, `connection_remove`
- `calendar_sync`
- `subscription_status`

Each tool:
- Has a Zod schema defining its input parameters
- Calls `gql()` from `lib/client.ts` (reuses existing GraphQL client)
- Returns JSON response as text content

### Authentication

Uses existing `getToken()` from `lib/config.ts`:
- Reads `SM_TOKEN` environment variable (priority)
- Falls back to config file (`~/.config/sm/config.json`)

### Claude Code configuration

```json
{
  "mcpServers": {
    "sweptmind": {
      "command": "sm",
      "args": ["serve"]
    }
  }
}
```

Or with explicit token:

```json
{
  "mcpServers": {
    "sweptmind": {
      "command": "sm",
      "args": ["serve"],
      "env": { "SM_TOKEN": "sm_..." }
    }
  }
}
```

### Dependencies

Add to `packages/cli/package.json`:
- `@modelcontextprotocol/sdk`
- `zod`

Bump version to 0.2.0.
