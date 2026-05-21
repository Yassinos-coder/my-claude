# Claude Agent SDK Reference

The `@anthropic-ai/claude-agent-sdk` is a separate package from the base
`@anthropic-ai/sdk`. It provides the same runtime that powers Claude Code,
exposed as a library.

## Table of Contents

- [When to Use Which SDK](#when-to-use-which-sdk)
- [Basic Usage](#basic-usage)
- [Built-in Tools](#built-in-tools)
- [MCP Server Integration](#mcp-server-integration)
- [Subagents](#subagents)
- [Hooks](#hooks)
- [Sessions (Pause/Resume)](#sessions-pauseresume)
- [Authentication](#authentication)

## When to Use Which SDK

**Base SDK (`@anthropic-ai/sdk`):** Full control over the agent loop. You
implement tool execution, message management, and orchestration. Best when
you have custom tools (your NestJS services) and want precise control.

**Agent SDK (`@anthropic-ai/claude-agent-sdk`):** Fully managed agent runtime
with built-in tools, MCP support, and session management. Best when you want
file system access, code execution, web search, and subagent orchestration
out of the box.

You can use both — the Agent SDK for internal tooling and dev workflows,
the base SDK for production agents with your own tool implementations.

## Basic Usage

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: {
    allowedTools: ["Read", "Edit", "Bash"]
  }
})) {
  console.log(message);
}
```

## Built-in Tools

The Agent SDK provides these tools out of the box:

- **Read** — read files from the filesystem
- **Write** — create or overwrite files
- **Edit** — make targeted edits to existing files
- **Bash** — execute shell commands
- **Glob** — find files by pattern
- **Grep** — search file contents
- **WebSearch** — search the web
- **WebFetch** — fetch web pages
- **AskUserQuestion** — pause and ask the user for input
- **Monitor** — stream output from background processes
- **Agent** — launch subagents

Restrict tools per agent with the `allowedTools` option.

## MCP Server Integration

Connect stdio-based MCP servers to provide additional tools:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Query the database for recent orders",
  options: {
    mcpServers: {
      postgres: {
        command: "npx",
        args: ["@modelcontextprotocol/server-postgres", "postgresql://..."]
      },
      filesystem: {
        command: "npx",
        args: ["@modelcontextprotocol/server-filesystem", "/path/to/dir"]
      }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

MCP (Model Context Protocol) is an open standard for connecting AI to external
systems. Think of it as a universal connector — instead of hardcoding
integrations, agents consume tools from MCP servers dynamically.

## Subagents

Delegate focused tasks to specialized subagents with their own tool sets:

```typescript
for await (const message of query({
  prompt: "Review this codebase for security issues",
  options: {
    allowedTools: ["Read", "Glob", "Grep", "Agent"],
    agents: {
      "security-reviewer": {
        description: "Expert security reviewer.",
        prompt: "Analyze code for OWASP Top 10 vulnerabilities.",
        tools: ["Read", "Glob", "Grep"]
      },
      "dependency-checker": {
        description: "Checks dependencies for known vulnerabilities.",
        prompt: "Review package.json and lock files for CVEs.",
        tools: ["Read", "Bash"]
      }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

Each subagent gets a clean context window and returns a condensed summary.

## Hooks

Execute custom logic at lifecycle events:

```typescript
import { query, HookCallback } from "@anthropic-ai/claude-agent-sdk";
import { appendFile } from "fs/promises";

const auditLog: HookCallback = async (input) => {
  const filePath = (input as any).tool_input?.file_path ?? "unknown";
  await appendFile(
    "./audit.log",
    `${new Date().toISOString()}: modified ${filePath}\n`
  );
  return {};
};

for await (const message of query({
  prompt: "Refactor utils.py",
  options: {
    permissionMode: "acceptEdits",
    hooks: {
      PostToolUse: [
        { matcher: "Edit|Write", hooks: [auditLog] }
      ]
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

Available hook events: PreToolUse, PostToolUse, Stop, SessionStart, SessionEnd.

## Sessions (Pause/Resume)

Capture session ID to resume later with full context:

```typescript
let sessionId: string | undefined;

// First run — capture session ID
for await (const message of query({
  prompt: "Read the authentication module",
  options: { allowedTools: ["Read", "Glob"] }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

// Resume later with full context
for await (const message of query({
  prompt: "Now find all places that call it",
  options: { resume: sessionId }
})) {
  if ("result" in message) console.log(message.result);
}
```

For the base SDK, serialize the messages array to persistent storage (database)
and reload it to resume.

## Authentication

Supports multiple providers:

- **Anthropic API:** Set `ANTHROPIC_API_KEY` environment variable
- **AWS Bedrock:** Set `CLAUDE_CODE_USE_BEDROCK=1`
- **Google Vertex AI:** Set `CLAUDE_CODE_USE_VERTEX=1`
- **Microsoft Azure:** Set `CLAUDE_CODE_USE_FOUNDRY=1`
