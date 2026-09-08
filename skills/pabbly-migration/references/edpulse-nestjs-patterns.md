# EdPulse NestJS building blocks

The concrete patterns to reuse when migrating a Pabbly flow into an EdPulse NestJS service
(clients-management-api and siblings). File paths are representative — confirm them in the target repo,
since they drift slightly between services. The point is the *pattern*, not the exact line.

## Table of contents
1. TutorCruncher webhook payload shape
2. Common webhook actions
3. Branch tokens & `{{...}}` placeholder mapping
4. The TutorCruncher API client
5. Webhook controllers (`@Public`, global prefix)
6. Mapper / validator / interfaces
7. Queues: producer + processor
8. Config & secrets
9. External HTTP clients (`BaseApiClient`)
10. Supabase repositories & the `email_templates_hub` pattern
11. Sending email (`SmtpClientService`) with template-hub + fallback
12. Idempotency / dedup

---

## 1. TutorCruncher webhook payload shape

TutorCruncher posts `{ "events": [ { ... } ] }`. `events` may arrive as a JSON **array** or a JSON
**string** — normalize both. A client/label event looks like:

```jsonc
{
  "action": "ADDED_A_LABEL_TO_A_USER",
  "verb": "Added a Label to a User",
  "branch": 3268,
  "actor": { "id": 1847094, "name": "..." },
  "subject": {
    "model": "Client",                       // "Client" | "Job" | "Appointment" | ...
    "id": 1906898,                            // the resource id
    "user": { "first_name": "...", "last_name": "...", "email": "...", "mobile": "...", "phone": "..." },
    "status": "live",                         // prospect | live | ...
    "associated_admin": { "id": 2421483, "first_name": "Lucy", "email": "lucy@tutorax.com" },
    "labels": [ { "id": 262569, "machine_name": "numero-errone", "name": "Numéro erroné" } ],
    "extra_attrs": [ { "machine_name": "organisation_school", "value": "False", ... } ],
    "rcras": [ { "recipient": 1916570, "paying_client": 1916569 } ],   // on appointment events
    "service": { "id": 948357 }                                        // on appointment events
  }
}
```

Note the contact info may be **nested under `subject.user`** (label events) OR flat on `subject`
(some client events). Read defensively: `subject.user?.email ?? subject.email`. When the payload is
thin, re-fetch the full resource from TutorCruncher by `subject.id` (Pabbly often does this in a Code
step for exactly this reason).

## 2. Common webhook actions

`CREATED_A_CLIENT`, `CHANGED_CLIENT_STATUS`, `ADDED_A_LABEL_TO_A_USER`, `ADDED_A_LABEL_TO_A_SERVICE`,
`CREATED_AN_APPOINTMENT`, `CREATED_A_REPEATING_APPOINTMENT`, `MARKED_AN_APPOINTMENT_AS_CANCELLED`,
`CANCELLED_A_BOOKING`. The `subject.model` tells you the entity (`Client`, `Job`, `Appointment`).
Status values you'll gate on include `live` and the appointment `cancelled-chargeable` special case
(a cancelled-but-still-billed lesson — usually must NOT be treated like a normal cancellation).

## 3. Branch tokens & `{{...}}` placeholder mapping

Each TutorCruncher branch has its own API token, stored in config keyed by branch id, e.g.:

```ts
branchTokens: {
  '3268': process.env.TOKEN_TUTORAX_TUTORAT,      // Tutorat QC  (Pabbly {{qcToken1}})
  '7673': process.env.TOKEN_TUTORAX_CANADA,        // Ontario / Canada (Pabbly {{onToken1}})
  '8427': process.env.TOKEN_TUTORAX_ORTHOPEDAGOGIE,
  '15751': process.env.TOKEN_TUTORAX_USA,
  '14409': process.env.TOKEN_TUTORAX_ORTHOPHONIE,
  '5737': process.env.TOKEN_TUTORAX_STIMULATION,
  '24924': process.env.TOKEN_EDLINGO,
  '23991': process.env.TOKEN_SOSPROF,
}
```

Resolve per event via `BranchUtils.getBranchToken(branch)` (the TutorCruncher client does this for you).
Pabbly placeholders map by region: `{{qcToken1}}` → 3268, `{{onToken1}}` → 7673, `{{demoToken}}` → the
old demo branch (3269, now removed). **Gate to branches you hold a token for**; never hard-code one
token like the Pabbly export did.

## 4. The TutorCruncher API client

`TutorCruncherService` (`infrastructure/tutor-cruncher-client/`) extends `BaseApiClient`, base URL
`https://secure.tutorcruncher.com/api`, auth `Authorization: token <branchToken>`. Key methods:

- `getResourceById(branch, ResourceType.X, id)` — fetch one resource (`CLIENTS`, `RECIPIENTS`,
  `SERVICES`, `CONTRACTORS`, `APPOINTMENTS`, …).
- `getAllResources(branch, ResourceType.X, params)` — paginated list.
- `updateResource(branch, ResourceType.X, id, body)` — update; `extra_attrs` is **merged** (send only
  the keys you change; nesting under `extra_attrs` is how custom fields update — top-level keys are
  ignored).

Wrap calls in `RetryUtils.retryOperation(...)` for resilience, and handle 404 gracefully (return null /
skip) rather than throwing.

## 5. Webhook controllers

```ts
@Controller('sendy')                 // → live path is /api/sendy/... (global setGlobalPrefix('api'))
export class FooController {
  @Public()                          // bypasses the global ApiKeyGuard; webhooks carry no API key
  @Post('webhook/client')
  async handle(@Body() body: unknown) {
    await this.fooService.handleWebhook(body);
    return { received: true };       // ack fast; do work async if heavy
  }
}
```

TutorCruncher does not send HMAC signatures; existing webhooks are all `@Public()` (consistent with the
codebase). If the user wants protection, a shared-secret token in the URL/query is the realistic option
(TC can be configured with Basic Auth) — but match the codebase default unless asked.

## 6. Mapper / validator / interfaces

- **Mapper** (pure static): normalize `payload.events` (array or JSON string), take `events[0]`, and pull
  the typed fields you need into an interface. Keep it I/O-free.
- **Validator** (type-guard): `isXEvent(event): event is XEvent` — checks action ∈ allowed set, branch is
  finite and has a token, required ids present. The service returns early when this fails.
- **Interfaces**: the normalized event + the `JobData` wrapper you enqueue.

## 7. Queues: producer + processor

BullMQ. Register the queue name in the queue-names constant (that alone makes `@InjectQueue` resolve).

```ts
// producer
@InjectQueue(QUEUE_NAME) private readonly queue: Queue;
enqueue(data) { return this.queue.add('job-name', data, { removeOnComplete: 200, removeOnFail: 500 }); }

// processor
@Processor(QUEUE_NAME)
export class FooProcessor extends WorkerHost {
  async process(job: Job<FooJobData>) { return this.service.process(job.data); }  // try/catch + log + rethrow
}
```

Use a queue when work is non-trivial or makes external calls (retries, observability via Bull Board). A
single idempotent action can be a direct service call — mirror the nearest sibling.

## 8. Config & secrets

Secrets resolve through NestJS `ConfigService`:

```ts
const apiKey = this.configService.getOrThrow<string>('SENDY_API_KEY');   // fail loud if missing
```

`ConfigService.get('KEY', defaultValue)` for non-secrets (list ids, base URLs). There's also a plain
`config` object (`common/config`) for grouped values, but **never put a real secret as a default in
tracked source** — `.env` is gitignored and holds the real values; the host (Railway) holds prod values.
A background security review will (correctly) flag hard-coded secret fallbacks.

## 9. External HTTP clients

New SaaS integrations go under `infrastructure/<service>-client/` as a service extending `BaseApiClient`
(see `short-url-client`, `dialpad-client`, `sendy-client`). Register in `infrastructure.module.ts`
providers + exports. For form-encoded APIs, send a `URLSearchParams` body with
`Content-Type: application/x-www-form-urlencoded`. `handleError` should throw a NestJS exception.

## 10. Supabase repositories & `email_templates_hub`

Repositories inject `DatabaseService` (`database/supabase-connection.service.ts`) and call `.getClient()`;
define `schema` + `tableName`; query with `.maybeSingle()` (0/1) or `.single()` (exactly 1); throw a
descriptive error on `error`.

The shared **template hub** (`edpulse.email_templates_hub`) is how EdPulse stores editable email bodies.
The pattern (mirrored from `registration`/`jobs-management-api`):

```ts
// getTemplate({ trigger, branchId, sendOrder?, reason?, recipientType?, locale? })
client.schema('edpulse').from('email_templates_hub')
  .select('subject, html_body')
  .eq('is_active', true)
  .eq('trigger', trigger)
  .contains('branch', [branchId])
  // optional: .eq('send_order', n) / .filter('metadata->>step','eq',...) / .eq('reason',...) / etc.
  .limit(1).maybeSingle();
// return { subject, htmlBody } or null. RETURN NULL ON ERROR (don't throw) so the caller can fall back.
// Cache ~5 min in-memory.
```

## 11. Sending email with template-hub + fallback

`SmtpClientService.sendEmail({ fromName, fromEmail, toEmail, subject, body, bccEmail? })`. The EdPulse
"emails from a table, SMTP fallback" pattern:

```ts
const hub = await emailTemplateHub.getTemplate({ trigger: 'X', branchId });
let subject, body;
if (hub) { subject = applyVars(hub.subject, vars); body = applyVars(hub.htmlBody, vars); }   // hub hit
else     { ({ subject, body } = buildFallbackTemplate(vars)); }                              // TS fallback
await smtp.sendEmail({
  fromName, fromEmail,
  toEmail: isProduction ? recipientEmail : TEST_EMAIL,   // non-prod routes to a test inbox
  subject, body,
});
```

The hard-coded TS fallback guarantees an email even if Supabase/the hub row is unavailable. Sender name
often follows `"<associated_admin.first_name> de Tutorax"` with a default fallback name. Resolve template
placeholders (`{{firstName}}`, …) with the existing variable-substitution util; keep the trigger string
and placeholder names in one constants file so they're easy to align with the DB row.

## 12. Idempotency / dedup

Webhook deliveries repeat, and label webhooks re-fire while a label stays on a record. So:

- **Additive effects** (incrementing hours/credits) must be deduped — reserve a cache key
  (`feature:branch:id:action`) with a TTL before mutating; release on failure so retries can re-run.
- **Idempotent effects** (subscribe/unsubscribe, set-a-value, "send once") need at most a short "already
  sent" cache guard, not a long lock — and avoid guards so long they block legitimate re-runs (e.g. a
  client legitimately going live again).

Decide based on whether repeating the side effect is harmful.
