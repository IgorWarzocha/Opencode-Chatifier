# opencode-chat

A powerful "Chatifier" plugin for OpenCode that enhances the agent experience with chat-optimized tools and local semantic search.

## Features

- **Chat-Optimized Tools**: Replaces native tools with `chat_*` versions (e.g., `chat_read`, `chat_bash`) that are friendlier for LLM interactions.
- **Semantic Search**: Built-in local semantic indexing using `fastembed` and SQLite. Automatically indexes your codebase for vector search.
- **Specialized Agents**:
  - **Just Chat**: Lightweight agent for conversation and web research.
  - **Tool Chat**: Full-featured agent with access to files, code, and semantic search.
- **Todo Management**: Integrated `chat_todo` tool for tracking task progress.
- **Memory**: `chat_remember` tool for persisting information across sessions.

## Installation

```bash
npm install opencode-chat
```

Then add it to your OpenCode config:

```typescript
// ~/.config/opencode/config.ts or .opencode/config.ts
import { ChatifierPlugin } from "opencode-chat"

export default {
  plugins: [ChatifierPlugin],
}
```

## Setup

After installing, run these commands from your project directory:

```bash
# Download the embedding model (~90MB, one-time)
bun run download-model

# Index your codebase for semantic search
bun run semantic-index
```

### On-Launch Behavior

- If ≤100 files need indexing, it runs automatically on startup
- If >100 files need indexing, it skips and displays a message for 10 seconds
- The embedding model downloads automatically if not cached

## How it Works

1. **System Prompt**: Completely replaces the system prompt for chat agents with a universal, friendly prompt.
2. **Tool Replacement**: Provides `chat_*` tool equivalents optimized for LLM interactions.
3. **Indexing**: Checks for file changes and incrementally updates the semantic index in `.opencode/chat/semantic.sqlite`.

## Requirements

- OpenCode (latest version)
- Bun runtime (included with OpenCode)

## License

MIT
