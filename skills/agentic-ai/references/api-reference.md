# Claude API — Tool Use Reference

Detailed API reference for tool use with the Anthropic TypeScript SDK.

## Table of Contents

- [Tool Definition Schema](#tool-definition-schema)
- [tool_use Response Block](#tool_use-response-block)
- [tool_result Message Block](#tool_result-message-block)
- [tool_choice Options](#tool_choice-options)
- [Strict Mode](#strict-mode)
- [Parallel Tool Use](#parallel-tool-use)
- [Error Handling](#error-handling)
- [Streaming with Tools](#streaming-with-tools)
- [Prompt Caching with Tools](#prompt-caching-with-tools)

## Tool Definition Schema

```typescript
const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",          // ^[a-zA-Z0-9_-]{1,64}$
    description: "Get current weather for a location. Returns temperature and conditions. Use when the user asks about weather in a specific city.",
    input_schema: {               // JSON Schema object
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City and state, e.g. San Francisco, CA"
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"]
        }
      },
      required: ["location"]
    },
    // Optional fields:
    strict: true,                 // Grammar-constrained schema validation
    input_examples: [...],        // Example inputs for complex tools
    cache_control: { type: "ephemeral" }  // For prompt caching
  }
];
```

## tool_use Response Block

When Claude wants to call a tool, the response has `stop_reason: "tool_use"`:

```json
{
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Let me check the weather." },
    {
      "type": "tool_use",
      "id": "toolu_01A09q90qw90lq917835lq9",
      "name": "get_weather",
      "input": { "location": "San Francisco, CA", "unit": "celsius" }
    }
  ],
  "stop_reason": "tool_use"
}
```

The content array can contain both text and tool_use blocks. Claude often
explains what it's doing before calling tools.

## tool_result Message Block

Send results back in a user message:

```typescript
messages.push({
  role: "user",
  content: [
    {
      type: "tool_result",
      tool_use_id: "toolu_01A09q90qw90lq917835lq9",
      content: JSON.stringify({ temperature: "15°C", condition: "Sunny" })
    }
  ]
});
```

Content can be:
- A string
- An array of `text`, `image`, or `document` blocks
- Omitted entirely (for tools with no meaningful output)

**Critical rule:** `tool_result` blocks MUST come FIRST in the content array,
before any text blocks.

## tool_choice Options

```typescript
// Claude decides whether to use tools (default)
tool_choice: { type: "auto" }

// Claude MUST use one of the provided tools
tool_choice: { type: "any" }

// Claude MUST use the specified tool
tool_choice: { type: "tool", name: "get_weather" }

// Claude cannot use any tools
tool_choice: { type: "none" }
```

Each option supports `disable_parallel_tool_use: true`:
- With `auto`: at most one tool call
- With `any` or `tool`: exactly one tool call

With `any` or `tool`, Claude will not emit text before the tool_use block.

## Strict Mode

Set `strict: true` on a tool definition to guarantee inputs match your schema
exactly — no type mismatches, no missing required fields.

```typescript
{
  name: "search_flights",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      destination: { type: "string" },
      passengers: { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }
    },
    required: ["destination", "passengers"],
    additionalProperties: false  // Recommended with strict mode
  }
}
```

Combine `tool_choice: { type: "any" }` with `strict: true` to guarantee both
that a tool will be called AND inputs match your schema.

## Parallel Tool Use

By default, Claude may return multiple `tool_use` blocks in one response.
All results MUST go in a single user message:

```typescript
// Claude returns two tool calls
const toolUses = response.content.filter(b => b.type === "tool_use");

// Execute all, collect results
const results = await Promise.all(
  toolUses.map(async (tu) => ({
    type: "tool_result" as const,
    tool_use_id: tu.id,
    content: JSON.stringify(await executeTool(tu.name, tu.input))
  }))
);

// Send ALL results in one message
messages.push({ role: "user", content: results });
```

Sending separate messages per result trains Claude to avoid parallel calls.

To disable parallel tool use:
```typescript
tool_choice: { type: "auto", disable_parallel_tool_use: true }
```

To encourage it, add to system prompt:
```
For maximum efficiency, invoke all relevant tools simultaneously rather than
sequentially when operations are independent.
```

## Error Handling

Return `is_error: true` with an actionable message:

```typescript
toolResults.push({
  type: "tool_result",
  tool_use_id: toolUse.id,
  content: "Student not found with ID 'xyz'. Verify the ID format (e.g., 'stu_abc123') and retry.",
  is_error: true
});
```

Claude will attempt 2-3 retries with corrected inputs before giving up.
Write error messages that guide correction — include expected formats,
valid values, or alternative approaches.

## Streaming with Tools

### With Tool Runner

```typescript
const runner = client.beta.messages.toolRunner({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  tools: [myTool],
  messages: [{ role: "user", content: "..." }],
  stream: true
});

for await (const messageStream of runner) {
  for await (const event of messageStream) {
    // SSE events as they arrive
    if (event.type === "content_block_delta") {
      process.stdout.write(event.delta.text ?? "");
    }
  }
}
```

### Without Tool Runner

```typescript
const stream = client.messages.stream({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  tools,
  messages
});

for await (const event of stream) {
  // Handle events, detect tool_use blocks, execute tools manually
}

const finalMessage = await stream.finalMessage();
// Check stop_reason, handle tool calls, loop if needed
```

## Prompt Caching with Tools

Cache tool definitions to avoid reprocessing on every request:

```typescript
const tools = [
  {
    name: "search_tutors",
    description: "...",
    input_schema: { ... },
    cache_control: { type: "ephemeral" }  // Cache this tool definition
  }
];
```

Also cache system prompts and large, static tool results to reduce cost.
