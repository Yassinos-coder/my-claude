# Reading the Pabbly Code Extractor JSON

The "Pabbly Code Extractor" browser extension captures a single Pabbly Connect automation from the live
workflow page and exports it as one JSON object. Your job when reading it is to recover **what the
automation actually does** so you can re-implement it. This guide is how to decode it reliably.

## Top-level shape

```jsonc
{
  "systemPrompt": "...",      // instructions the extension embeds; describes the format
  "extension": { ... },        // tool metadata + capturedFrom URL
  "schema": {                  // NORMALIZED, heuristic view — convenient but not authoritative
    "workflowName": "...",     // the automation's name (often encodes branch/region/intent)
    "confidence": "high|medium|low",
    "stepCount": N,
    "steps": [ ... ]           // ordered steps
  },
  "raw": { "steps": [ ... ] }  // SOURCE OF TRUTH — parsed from the live DOM; trust this if schema looks off
}
```

Read `schema.workflowName` first — it usually tells you the region/branch and the intent (e.g.
"Quebec - Label 'Numero errone'", "[TUTORAX] Sendy Catch Event CREATED_CLIENT", "3. Add/Subtract Student
Hours when Lesson is Created/Cancelled").

## Step anatomy

Each step in `schema.steps[]` / `raw.steps[]`:

```jsonc
{
  "order": 1,
  "type": "trigger | action | router | filter",
  "app": "Webhook by Pabbly | Code (Pabbly) | Filter (Pabbly) | Router (Pabbly) | SMTP (Pabbly) | ...",
  "event": "Catch Webhook (Preferred) | Run JavaScript | Filter Values | Conditionally Run | Send Email | Execute API Request | ...",
  "mappings": [ { "field": "...", "value": "...", "references": [ { "step": N, "field": "..." } ] } ],
  "filter": [ { "joiner": "AND|OR", "conditions": [ { "field, operator, value } ] } ],  // filter/router steps
  "routes": [ { "routeName": "...", "stepCount": N, "steps": [ ... ] } ],               // router steps
  "text": "raw on-screen text of the step config"  // fallback when mappings are unclear
}
```

- **trigger** — almost always "Catch Webhook (Preferred)". The `Response Received` mapping holds a sample
  of the incoming payload (a JSON string). This is your input contract — parse it to learn the payload
  shape.
- **action** — does something: a Code step (JS), an Execute API Request (raw HTTP), or a named app action
  (Send Email, Add Subscriber, Update Cell Value…).
- **filter** — gate. The workflow only continues if conditions pass. `conditions` within one group are
  AND'd; multiple groups are OR'd.
- **router** — branches. Each entry in `routes[]` is a conditional branch with its own `steps[]`; the
  first step is normally the filter defining that branch's condition. Routers can nest (`nestedRouter`);
  a `nestedRouter` with a `note` instead of `routes[]` hit the capture depth limit and wasn't expanded —
  go back to `raw` or ask the user for that sub-branch.

## Dynamic references — the #1 thing people get wrong

Inside `mappings` values, filters, and code you'll see tokens like:

```
2. Data 0 Subject Service Id : 948357
7. Output Data Email : sandale8@hotmail.com
1. Events : [{...}]
```

Decode them as `N. <Label> : <sampleValue>`:

- `N` = the **source step's `order`**. The value is produced by step N.
- `<Label>` = the output field path; **spaces denote nesting**. `Data 0 Subject Service Id` =
  `data[0].subject.service.id`. `Output Data Email` = `output.data.email`.
- The text **after the colon is only the sample** captured during a test run — **NOT a constant**. Treat
  it as `stepN.output.<path>`, never as a literal.

A mapping that contains references also carries a `references: [{ step, field }]` array listing the
detected source steps — use it to confirm your decoding.

## Translating common step types to code

| Pabbly step | What it really means | In code |
|---|---|---|
| Catch Webhook | Receives the event payload | Your `@Public() @Post('webhook/...')` endpoint |
| JSON Extractor | Parses the events JSON | `JSON.parse` / normalize the payload in a mapper |
| Text Formatter → Replace `\r\n`,`\n` | Sanitizes JSON so Pabbly can parse it | **Skip** — you parse JSON natively |
| Filter Values | Gate / branch condition | A validator type-guard or an early `return` |
| Code (Run JavaScript) | Arbitrary logic (often lodash `_.filter`/`_.find` over labels/extra_attrs) | Reimplement in TS |
| Router → Conditionally Run | If/else branches | `if`/early-return branches in the service |
| Execute API Request | Raw HTTP call (note the URL, method, headers/token) | A method on an `infrastructure/` client |
| Send Email (SMTP) | Email send (note from/fromName/to/subject/body) | `SmtpClientService.sendEmail(...)` |
| Add/Delete Subscriber, Update Cell Value, etc. | Named SaaS action | The corresponding infra client call |

## Gotchas checklist

- **`raw` over `schema`** whenever they disagree or `schema` looks truncated.
- **Sample values are not constants.** Re-derive every value from the payload or config.
- **Step order can lie.** A step may reference a later step's output (extractor hoisting). Follow the data
  dependencies, not the numbers.
- **Hard-coded secrets** appear in the export (`token ad6f...`, api keys, `{{qcToken1}}` placeholders).
  Move every one to env/config; never paste into source. The `{{...}}` placeholders are Pabbly account
  variables — map them to the right branch token (see the patterns reference).
- **Per-region duplication.** A flow may be one of several near-identical Pabbly workflows (DEMO / Quebec
  / Ontario). The branch filter values (`3268`, `7673`, …) tell you the scope; confirm which to support.
- **Truncated bodies.** Long sample payloads/HTML are cut off with `...`. Don't assume the visible slice
  is complete — reconstruct from the field paths and confirm specifics (e.g. email body, template keys)
  with the user.
