# sweptmind-cli

CLI for SweptMind task management.

[![npm version](https://img.shields.io/npm/v/sweptmind-cli.svg)](https://www.npmjs.com/package/sweptmind-cli)

## Install

```bash
npm install -g sweptmind-cli
```

## Authentication

**OAuth (interactive):** Opens your browser for Google/Facebook login and exchanges the session for an API token.

```bash
sm login
```

**API token:** Use a token directly, or set the `SM_TOKEN` environment variable. Tokens can be created in SweptMind Settings > API Tokens.

```bash
sm login --token <token>
# or
export SM_TOKEN=sm_...
```

## Quick Start

```bash
sm login
sm list ls
sm task add "Buy groceries" --list <id>
sm task list --list <id>
sm task complete <id>
```

## Commands

Use `sm <command> --help` for detailed usage of any command.

### Auth

| Command    | Description                   |
| ---------- | ----------------------------- |
| `login`    | Authenticate with SweptMind   |
| `logout`   | Clear stored credentials      |
| `whoami`   | Show the current user         |

### Tasks

| Command            | Description                       |
| ------------------ | --------------------------------- |
| `task list`        | List tasks in a list              |
| `task show <id>`   | Show task details                 |
| `task add <title>` | Create a new task                 |
| `task edit <id>`   | Edit a task                       |
| `task complete <id>`   | Mark a task as completed      |
| `task uncomplete <id>` | Mark a task as not completed  |
| `task delete <id>` | Delete a task                     |
| `task move <id>`   | Move a task to another list       |
| `task clone <id>`  | Clone a task                      |
| `task import <file>` | Import tasks from a JSON file   |

### Steps

| Command              | Description                  |
| -------------------- | ---------------------------- |
| `step add <taskId>`  | Add a step to a task         |
| `step list <taskId>` | List steps of a task         |
| `step complete <id>` | Mark a step as completed     |
| `step delete <id>`   | Delete a step                |

### Lists

| Command             | Description          |
| ------------------- | -------------------- |
| `list ls`           | List all lists       |
| `list create`       | Create a new list    |
| `list show <id>`    | Show list details    |
| `list edit <id>`    | Edit a list          |
| `list delete <id>`  | Delete a list        |

### Groups

| Command              | Description          |
| -------------------- | -------------------- |
| `group ls`           | List all groups      |
| `group create`       | Create a new group   |
| `group delete <id>`  | Delete a group       |

### Locations

| Command                | Description            |
| ---------------------- | ---------------------- |
| `location ls`          | List all locations     |
| `location create`      | Create a new location  |
| `location edit <id>`   | Edit a location        |
| `location delete <id>` | Delete a location      |

### Sharing

| Command               | Description                     |
| --------------------- | ------------------------------- |
| `share add`           | Share a task with a connection  |
| `share remove`        | Remove sharing from a task      |
| `share list`          | List shared tasks               |
| `connection ls`       | List connections                |
| `connection invite`   | Invite a new connection         |
| `connection remove`   | Remove a connection             |

### Calendar

| Command          | Description                       |
| ---------------- | --------------------------------- |
| `calendar sync`  | Trigger Google Calendar sync      |

### Subscription

| Command               | Description                  |
| --------------------- | ---------------------------- |
| `subscription status` | Show subscription status     |

### Config

| Command                    | Description                  |
| -------------------------- | ---------------------------- |
| `config ls`                | Show all settings            |
| `config get <key>`         | Show a setting value         |
| `config set <key> <value>` | Set a setting value          |
| `config reset`             | Reset all settings           |

## Configuration

Config is stored in `~/.config/sm/config.json`.

| Key           | Default                    | Description               |
| ------------- | -------------------------- | ------------------------- |
| `apiUrl`      | `https://sweptmind.com`    | SweptMind API URL         |
| `token`       |                            | API authentication token  |
| `locale`      | `en`                       | Language (`cs` or `en`)   |
| `defaultList` |                            | Default list ID for tasks |

The `SM_TOKEN` environment variable overrides the configured token.

## JSON Output

Add `--json` to any command for machine-readable JSON output. JSON mode is also auto-detected when piping (non-TTY).

```bash
sm task list --list <id> --json | jq '.[] | .title'
```

## Claude Code Integration

SweptMind CLI includes a built-in MCP server for integration with Claude Code.

Add to your `.claude/settings.json`:

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

Or with an explicit token:

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

After setup, Claude Code can manage your tasks directly using SweptMind tools.

## License

MIT
