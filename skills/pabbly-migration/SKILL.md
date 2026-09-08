---
name: pabbly-migration
description: >-
  Migrate (re-implement) a Pabbly Connect automation or a Zapier Zap into a NestJS backend. Use this
  whenever the user wants to move, rebuild, port, or "migrate" a Pabbly / Pabbly Connect workflow or
  a Zapier Zap into code — especially when they paste a JSON export from the "Pabbly Code Extractor"
  or "Automation Code Extractor" browser extension, or say things like "migrate this flow", "the
  second migration", "run this on this zapier", "turn this Pabbly automation into an endpoint", or
  reference a TutorCruncher webhook automation that currently lives in Pabbly or Zapier. Also applies
  to equivalent Make workflow-to-code migrations against the same EdPulse NestJS stack. Trigger it
  even if the user only says "here's the new flow" and attaches a workflow JSON.
---

# Pabbly → NestJS migration

Pabbly Connect automations are no-code workflows: a trigger (usually a webhook) feeds a chain of
filters, code steps, routers, and app actions (send email, HTTP request, add subscriber, update a
sheet…). Migrating one means **re-implementing that behavior as a NestJS feature** that receives the
same webhook and performs the same side effects — but in maintainable, observable, version-controlled
code instead of a brittle visual flow with hard-coded secrets.

This skill encodes the end-to-end workflow we use on the EdPulse NestJS services (clients-management-api,
jobs-management-api, registration, etc.). It assumes the **Controller → Service → Repository** NestJS
architecture and the EdPulse conventions documented in `references/edpulse-nestjs-patterns.md`.

**Do not rush to code.** The value is in reading the export correctly, finding the existing pattern to
mirror, and confirming the genuinely ambiguous decisions with the user *before* writing. Most of these
flows look similar, so reuse beats reinvention every time.

## The loop

1. Understand the automation (read the export).
2. Explore the target codebase for the pattern to mirror, and decide placement.
3. Confirm the ambiguous decisions with the user.
4. Implement, mirroring existing conventions.
5. Wire it up.
6. Verify (build, lint, local webhook).
7. Ship (changelog → build → push only with explicit permission → host env + webhook registration).

---

## 1. Understand the automation

**Read the reference for the platform you actually have** — check the export's `platform` field:

| `platform` | Reference |
|---|---|
| `"pabbly"` (or no field) | `references/pabbly-export-format.md` |
| `"zapier"` | `references/zapier-export-format.md` |

They are not interchangeable. The two captures are produced completely differently — Pabbly is scraped
from a rendered page, Zapier is read from the editor's JSON node graph — so the rules invert. Most
importantly: for Pabbly `raw` is the source of truth, while a Zapier export has **no** `raw` payload
and `schema.steps` is authoritative. Reading the wrong guide sends you looking for fields that
don't exist.

Traps specific to Zapier (full detail in its reference): every "does not contain" is stored as its
POSITIVE operator plus a flag (`negated: true`, or `action: "stop"` on exports ≤ 0.11.4) and must be
inverted; a field path containing `[]` is flattened-and-joined, not a single element; ids like a
Sendy `list` export opaque with no human label; and no sample values are captured at all. When you
need a label, an operator confirmed, or a sample, ask the user to paste that step's details-panel HTML
from the editor — that is where all three live.

Key points that bite people on **Pabbly** exports:

- **`raw` is the source of truth**; `schema` is a heuristic normalization. Cross-check against `raw`.
- **Sample values are NOT constants.** A mapping like `2. Data 0 Subject Service Id : 948357` means
  "service id from step 2's output" — `948357` was just the test-run value. Never hard-code samples.
- **Dynamic references** `N. Label : sample` point at step N's output; `Label` is a nested path
  (spaces = nesting, e.g. `Data 0 Subject Service Id` = `data[0].subject.service.id`).
- **Routers**: routes are OR'd; conditions inside a filter group are AND'd. Each route's first step is
  usually the filter that defines the branch condition.
- **Step numbering can be misleading** — a step may reference a later step's output (extractor quirk).
  Follow the *logical* data flow, not the displayed order.
- **Noise steps to ignore**: "Text Formatter → Replace `\r\n`/`\n`" steps just sanitize JSON so Pabbly
  can parse it; in code you parse JSON natively, so skip them. "JSON Extractor" steps are likewise
  just parsing. "Code (Run JavaScript)" steps using lodash (`_.filter`, `_.find`) reimplement trivially
  in TS.
- **Secrets in the export** (API tokens, `token ad6f...`, api keys, `{{qcToken1}}` placeholders) must
  move to env/config — never copy them into source.

Write a plain-language summary: **trigger → gating conditions → side effects**, branch by branch. State
it back to the user and confirm you read it right before planning. (`{{qcToken1}}`-style placeholders map
to branches — see the token table in the patterns reference.)

## 2. Explore the codebase, then decide placement

Before proposing anything, search the target repo for the closest existing pattern and read it. You are
almost always mirroring something that already exists. Look for:

- An existing **webhook controller** for the same trigger family (TutorCruncher client/label/appointment
  events). If one already handles this action, you may just add a handler.
- An existing **infrastructure client** if the flow calls an external service (email, SMS, a SaaS API).
- The **queue/processor** plumbing, **branch-token** resolution, **config**, and **Supabase repository**
  conventions.

See `references/edpulse-nestjs-patterns.md` for the concrete building blocks and where they live.

**Placement decision — new module vs. extend an existing one:**

- **New standalone feature module** when the flow introduces a *distinct integration or lifecycle*
  (e.g. syncing to a new external service like Sendy). Mirror a recent sibling migration's module
  layout. Cleanest isolation; one concept per module.
- **Extend an existing module** when that module *already owns this trigger family* and reusing its
  infra (clients, templates, SMTP, repos) avoids duplication — e.g. a new label-triggered email belongs
  next to the existing label/email handlers, not in a fresh module.
- **Watch for behavioral mismatches** when reusing a generic path. Example we hit: the generic
  automated-email path skips clients whose status is `live`; a "wrong phone number" email targets live
  clients, so it needed a *dedicated direct-send handler* rather than the generic queue path. Read what
  the existing path actually does before assuming it fits.

Don't over-engineer: a single one-shot email doesn't need a whole new module if a sibling handler
pattern already exists.

## 3. Confirm the ambiguous decisions

Use targeted questions (not a survey) for things the export can't tell you. The recurring ones:

- **Branch scope** — which TutorCruncher branch(es)? Pabbly flows are often per-region (a workflow named
  "Quebec" → branch 3268). Confirm: one branch, all configured branches, or a specific set.
- **Secrets/config** — env vars (recommended) vs. constants. Secrets always via `ConfigService`; never
  commit a real key. Non-secret defaults (list ids, base URLs) may have fallbacks in config.
- **Endpoint shape** — one webhook endpoint handling all actions, or one per action. (Each Pabbly
  workflow had its own catch-URL, so a dedicated endpoint per migrated flow is the default.)
- **Idempotency** — is the side effect safe to repeat? Additive effects (incrementing hours) need a
  dedup guard; idempotent ones (subscribe/unsubscribe, set-a-value) usually don't.
- Any **external-service field names / template keys / list ids** the export references but doesn't
  fully name.

## 4. Implement

Follow the EdPulse NestJS conventions in `references/edpulse-nestjs-patterns.md`. The typical feature
skeleton:

```
feature-name/
├── feature-name.module.ts
├── controllers/    @Public() @Post('webhook/...') → service; returns { received: true }
├── services/       business logic: map → validate → (enqueue | act)
├── mappers/        pure static extraction of the webhook payload → typed event
├── validators/     type-guard: is this an event we act on? (action, branch, required ids)
├── constants/      queue name, actions, branch config, label/field names, fallbacks
├── interfaces/     the normalized event + job-data types
├── producers/      @InjectQueue(...) enqueue (when using a queue)
├── processors/     @Processor(...) extends WorkerHost → calls the service
└── repositories/   Supabase access only (when the flow reads/writes the DB)
```

Core rules (the "why" matters — see the reference for detail):

- **Controllers are HTTP-only**: `@Public()` (bypasses the API-key guard) + `@Post('webhook/...')`,
  delegate to the service, return `{ received: true }`. Remember the global `api` prefix → the live URL
  is `/api/<controller>/<path>`.
- **Normalize the payload** in a mapper; accept `events` as either a JSON array or a JSON string.
- **Gate hard and early** in a validator (correct action, a branch you hold a token for, required ids
  present). Return quietly when it's not your event.
- **Resolve secrets via `ConfigService`** (`getOrThrow` for required keys). Never hard-code the values
  from the export.
- **Branch tokens**: resolve per-branch via the branch-token map / `BranchUtils.getBranchToken(branch)` —
  never hard-code a single token like the Pabbly version did.
- **Use a queue + processor** when the work is non-trivial or must retry (external calls). For a single
  idempotent action a direct service call is fine — match the closest sibling's choice.
- **External HTTP clients** extend `BaseApiClient` and live under `infrastructure/`.
- **Emails**: prefer the Supabase `email_templates_hub` template with a hard-coded TS template as
  fallback when the lookup fails, both sent via `SmtpClientService` (see reference).

## 5. Wire it up

- Register the queue name (if any) in the queue-names constant so `@InjectQueue` resolves.
- Add the new client/service/repository to the right module `providers` (and `exports` for shared infra).
- Import the feature module in `app.module.ts`.

## 6. Verify

- `npm run build` must succeed, and lint the new/changed files clean.
- Run locally and POST a sample payload (reuse the export's captured `Response Received` body) to the new
  endpoint; confirm gating, the queued job (Bull Board), and the side effect. In non-prod, sends usually
  route to a `TEST_EMAIL`.
- Confirm skips: wrong branch, missing trigger condition, duplicate delivery.

## 7. Ship

Follow the user's repo rules (often in their CLAUDE.md). The EdPulse defaults:

- Run the **`/changelog`** skill before any push.
- **Build before pushing**; never push unbuilt code.
- **Never push without explicit permission in the current message** ("commit"/"save" ≠ "push").
- After deploy: **set the new env vars on the host** (e.g. Railway) — the gitignored `.env` is local
  only — and **register the webhook URL(s) in TutorCruncher** for the relevant event(s). Rotate any key
  that appeared in the export, since it's now exposed.

---

## References

- `references/pabbly-export-format.md` — how to read a Pabbly capture.
- `references/zapier-export-format.md` — how to read a Zapier capture (different rules; read this one
  when `platform` is `"zapier"`).
- `references/edpulse-nestjs-patterns.md` — the concrete EdPulse/NestJS building blocks (payload shape,
  branch tokens, TutorCruncher client, queues, config/secrets, Supabase template hub, SMTP) with the
  reasoning behind each.
