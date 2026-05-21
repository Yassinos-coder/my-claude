---
name: agentic-ai
description: >
  Build AI agents with the Claude API and Anthropic TypeScript SDK. Use this
  skill when building agents, implementing tool use, designing agent loops,
  managing agent memory/context, or orchestrating multi-agent systems. Applies
  when the user works with @anthropic-ai/sdk tool use, @anthropic-ai/claude-agent-sdk,
  MCP servers, or any agentic pattern — even if they don't say "agent" explicitly.
  Also applies when deciding between single LLM calls, workflows, and agents.
---

# Agentic AI — Building Agents with the Claude API

## Core Mental Model

An agent is a **while loop** where an LLM decides what function to call next,
executes it via your code, observes the result, and repeats until the goal is
met. The LLM never executes code — it requests tool calls, your code fulfills
them.

```
User gives goal → LLM reasons → requests tool call → your code executes →
result fed back → LLM reasons again → ... → LLM decides it's done → responds
```

### Agent vs Workflow vs Single Call

| Pattern | Who decides the path? | When to use |
|---------|----------------------|-------------|
| Single LLM call | N/A — one shot | Task solvable in one response |
| Workflow | Your code (fixed steps) | Steps known at coding time |
| Agent | The LLM (dynamic) | Path depends on what the data reveals |

**Default to the simplest option.** Only escalate when you can measure that
simpler approaches fall short. Agents trade latency and cost for flexibility.

## The Agent Loop

### Manual Loop (Full Control)

Use when you need human-in-the-loop approval, custom logging, or conditional
execution.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

async function runAgent(userMessage: string) {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage }
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      tools,
      messages
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") break;

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const result = await executeTool(toolUse.name, toolUse.input);
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result)
      });
    }

    messages.push({ role: "user", content: toolResults });
  }
}
```

### SDK Tool Runner (Automated Loop)

Use when you don't need intermediate control — the SDK handles the loop.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const client = new Anthropic();

const getStudentProgress = betaZodTool({
  name: "get_student_progress",
  description: "Get a student's recent scores and identified weak topics",
  inputSchema: z.object({
    studentId: z.string().describe("The student ID")
  }),
  run: async (input) => {
    const progress = await studentService.getProgress(input.studentId);
    return JSON.stringify(progress);
  }
});

const finalMessage = await client.beta.messages.toolRunner({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  tools: [getStudentProgress],
  messages: [{ role: "user", content: "Analyze student abc123" }]
});
```

Read `references/api-reference.md` for full tool_choice options, strict mode,
parallel tool use, streaming, and error handling patterns.

## Tool Design

Tools are the agent's hands. The LLM is only as capable as the tools you give it.

### Defining Tools

```typescript
const tools: Anthropic.Tool[] = [
  {
    name: "search_available_tutors",
    description: "Search for tutors available for a specific subject and time. Returns tutor profiles with availability. Use when matching a student to a tutor.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Subject area, e.g. algebra" },
        date: { type: "string", description: "ISO date, e.g. 2026-04-15" }
      },
      required: ["subject"]
    }
  }
];
```

### Tool Design Principles

- **Description is the anchor.** The LLM picks tools based on descriptions.
  Write them like onboarding docs for a new team member — include what it does,
  when to use it, and what it returns.
- **Fewer, more capable tools > many narrow tools.** `search_contacts` over
  `list_contacts`. Reduce selection ambiguity.
- **Semantic parameter names.** `student_id` not `id`. `subject_area` not `type`.
- **Return semantic data.** Return names and descriptions, not just opaque UUIDs.
- **Actionable error messages.** Not `"failed"` — instead
  `"Student not found. Verify the student_id and retry."` with `is_error: true`.
- **Prefix-based naming for grouping.** `student_get_progress`,
  `student_update_plan`, `tutor_search`, `tutor_check_schedule`.

Read `references/api-reference.md` for tool_result format, is_error handling,
and strict mode.

## Human-in-the-Loop

For risky actions, pause the loop and ask for approval before executing.

```typescript
const REQUIRES_APPROVAL = ["send_message", "modify_student_plan", "assign_tutor"];

for (const toolUse of toolUses) {
  if (REQUIRES_APPROVAL.includes(toolUse.name)) {
    const approved = await askUserApproval(toolUse.name, toolUse.input);
    if (!approved) {
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: "Action denied by user.",
        is_error: true
      });
      continue;
    }
  }
  const result = await executeTool(toolUse.name, toolUse.input);
  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
}
```

Use human-in-the-loop for: external messaging, data mutations, payments, anything
affecting real people or shared systems.

## Memory & Context Management

The context window is finite and expensive. Every tool call adds to it.

### Just-in-Time Retrieval (Default Pattern)

Don't pre-load data. Give the agent tools to fetch what it needs on demand.
This keeps the context clean and lets the LLM decide what's relevant.

### Compaction

For long-running agents, summarize older conversation history. Preserve key
decisions, discard redundant tool outputs. The SDK Tool Runner supports
automatic compaction.

### External Notes

For agents that pause and resume across sessions (e.g., waiting for a webhook
response), persist state externally. Serialize the messages array to a database,
reload it when resuming.

### Stopping Conditions

Always set a max iteration limit to prevent runaway loops:

```typescript
const MAX_ITERATIONS = 15;
let iterations = 0;

while (iterations < MAX_ITERATIONS) {
  const response = await client.messages.create({ ... });
  if (response.stop_reason === "end_turn") break;
  iterations++;
  // ... handle tool calls
}
```

With the Tool Runner: pass `max_iterations` to the runner options.

## Multi-Agent Orchestration

Split into multiple agents only when one agent has too many tools and starts
making bad decisions. Apply Single Responsibility Principle.

### Pattern: Orchestrator + Specialists

```
Orchestrator Agent (decides what needs to happen)
  → Diagnosis Agent (student data tools only)
  → Pairing Agent (tutor matching tools only)
  → Communication Agent (messaging tools only)
```

Each specialist has a focused context and fewer tools = better decisions.

### When NOT to Split

- One agent with 5-10 tools works fine — don't split
- Start with a single agent, measure, split only when tool selection degrades
- Multi-agent adds latency, cost, and complexity

## Async / Long-Running Agents

When an agent needs to wait for external input (e.g., a tutor replying via SMS):

1. Agent runs, sends message via tool, has nothing left to do → loop ends
2. Save the agent's message history to your database
3. External event arrives (webhook from Dialpad, etc.)
4. Load saved message history, append the new information
5. Resume the agent loop — it picks up where it left off

The webhook is NOT a tool. It's your NestJS infrastructure that bridges the
outside world back into the agent.

## Claude Agent SDK

The `@anthropic-ai/claude-agent-sdk` is a separate package from the base
`@anthropic-ai/sdk`. It provides a fully managed agent runtime — the same one
that powers Claude Code.

Use the base SDK when: you want full control over the loop, your own tool
implementations, and custom orchestration.

Use the Agent SDK when: you want built-in tools (Read, Write, Edit, Bash, Glob,
Grep, WebSearch), MCP integration, subagent orchestration, and session
management out of the box.

Read `references/agent-sdk.md` for Agent SDK setup, MCP integration, hooks,
subagents, and session management.

## Gotchas

- Agents are slower and more expensive than single calls. Justify the complexity.
- Tool descriptions matter more than the system prompt for agent behavior.
  Invest time in writing clear, specific descriptions.
- All `tool_result` blocks from parallel tool calls must go in a single user
  message. Sending separate messages trains the model to avoid parallel calls.
- The LLM doesn't execute tools — it only requests them. Your code does the work.
- Context windows are finite. A 20-step agent accumulates thousands of tokens
  of tool results. Use compaction or just-in-time retrieval.
- Models can and do pick the wrong tool. Fewer, well-described tools reduce
  this. Test tool selection explicitly.
- Set `is_error: true` on failed tool results with actionable messages.
  The model will retry 2-3 times before giving up.
- Set max iteration limits. Always. An agent without a stop condition can loop
  indefinitely.

## Resources

- [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — the definitive guide to agent architecture
- [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — memory and context management
- [Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents) — tool design best practices
- [Claude API Tool Use Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use) — official API reference
