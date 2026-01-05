# OpenCode Chat

A conversational coding assistant plugin for OpenCode with semantic code search.

**This project is not led by Opencode Developers. If you encounter any problems, file an issue here.** 

## What It Does

**Chatifier** transforms OpenCode into a more conversational experience with two specialized agents and local semantic search.

![opencode-chat](https://github.com/user-attachments/assets/d489422c-a5a6-4003-b955-adf9b17260c2)

### Chat Agents

| Agent         | Purpose                                                |
| ------------- | ------------------------------------------------------ |
| **Just Chat** | Quick questions, web research, semantic search, memory |
| **Tool Chat** | Full toolkit with files, semantic search, and memory   |

### Features

- **Semantic Search** - Ask "where is auth handled?" and find code by meaning, not keywords
- **Memory** - Tell it to remember preferences and they persist across sessions
- **Task Tracking** - Built-in todo list for multi-step work
- **Skills** - Load project-specific guidance from `.opencode/skill/`
- **Streamlined Prompts** - Concise, direct responses without filler

## Installation

Add to your `opencode.json`:

```json
{
  "plugin": ["@howaboua/opencode-chat@latest"]
}
```

OpenCode automatically installs the plugin on next launch.

### Pin a version (optional)

```json
{
  "plugin": ["@howaboua/opencode-chat@0.1.10"]
}
```

## Setup

### New or Small Projects

For new projects or directories with fewer than 100 files, just launch OpenCode. The plugin automatically:

1. Downloads the embedding model (~90MB, cached in `.opencode/chat/models/`)
2. Indexes your codebase for semantic search

### Existing Large Projects (IMPORTANT)

**For directories with 100+ files (Obsidian vaults, large codebases, etc.), you MUST run setup manually before launching OpenCode.** Otherwise, the plugin will skip indexing to avoid blocking startup.

```bash
cd your-project

# Download the embedding model first (requires Bun)
bunx --bun opencode-chat-download-model@npm:@howaboua/opencode-chat

# Index your files (may take several minutes for large directories)
bunx --bun opencode-chat-semantic-index@npm:@howaboua/opencode-chat --mode full
```

After this one-time setup, OpenCode will launch normally and only re-index changed files.

## Usage

### Switch Agents

Use the agent selector in OpenCode to switch between:

- **Just Chat** - Conversational, minimal tools, web access
- **Tool Chat** - Full toolkit including semantic search

### Semantic Search

Ask natural language questions:

- "Where is the database connection configured?"
- "Find error handling for API requests"
- "Show me the authentication flow"

The assistant searches by meaning using local embeddings - no API calls, fully private.

### Memory

Tell the assistant to remember things:

- "Remember that I prefer TypeScript over JavaScript"
- "Remember this project uses React 19"

Memories persist in `AGENTS.md` and apply to future sessions.

### Task Tracking

For multi-step tasks, the assistant creates and tracks a todo list automatically. The list persists in `todo.md` and is removed when all tasks complete.

## Requirements

- [OpenCode](https://opencode.ai) v1.0.201+
- [Bun](https://bun.sh) runtime (for semantic indexing)

## How It Works

- **Embeddings**: Uses [fastembed](https://github.com/Anush008/fastembed-js) with the AllMiniLML6V2 model
- **Storage**: SQLite database in `.opencode/chat/semantic.sqlite`
- **Indexing**: Incremental - only re-indexes changed files

## License

MIT
