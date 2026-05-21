---
name: logging-strategy
description: >
  Structured logging best practices for NestJS backends. Applies when writing,
  reviewing, or modifying service methods, controllers, exception filters, or
  background jobs that produce log output. Triggers when the user writes logs,
  adds logging, debugs observability, or works on error handling in backend
  services — even if they don't explicitly mention "logging" or "observability."
user-invocable: false
---

# Logging Strategy

## Core Rule: Structured JSON, Never Plain Strings

Every log in production is structured JSON. No `console.log()`, no bare strings.

```ts
// Wrong
this.logger.error("Payment failed");
this.logger.error("Payment failed", { contractorId, amount });

// Right
this.logger.error({ message: "Payment failed", contractorId, amount, invoiceId, error: error.message });
```

## Every Log Answers Four Questions

| Question | Fields | Example |
|---|---|---|
| **When** | timestamp (automatic) | `"2025-01-10T14:30:00.123Z"` |
| **Where** | context (service name) | `"PaymentService"` |
| **Who** | userId, email, IP | `"contractorId": 42` |
| **What** | message, level, reason | `"message": "Payment failed", "reason": "card_declined"` |

If a log doesn't answer all four, it's incomplete.

## Log Levels

| Level | Meaning | Example |
|---|---|---|
| `info` | Business event succeeded | Payment processed, user logged in |
| `warn` | Something wrong but handled | Login failed (wrong password), rate limit approaching |
| `error` | Operation failed unexpectedly | Stripe API returned 500, unhandled exception |
| `fatal` | App is unusable (rare) | Database connection lost |

No `debug` in production. If you're reaching for `fatal` often, your error classification is wrong.

## Canonical Log Lines — The Default Pattern

One comprehensive log entry at the END of an operation. Not before, not during — at the end. One operation = one log = all the context.

```ts
// Wrong — breadcrumbs
this.logger.info('Login started');
this.logger.info('Calling Supabase');
this.logger.info('Supabase returned');
this.logger.info('Setting cookie');

// Right — one canonical log with everything
this.logger.info({
  message: 'Login succeeded',
  userId,
  email,
  role,
  ip: req.ip,
  duration: Date.now() - start,
});

// On failure — same idea, one log with full context
this.logger.warn({
  message: 'Login failed',
  email,
  reason: 'invalid_credentials',
  ip: req.ip,
  attemptCount: 3,
});
```

Why canonical:
- One log per operation = easy to count ("how many logins today?")
- All context in one place = no correlating scattered breadcrumbs
- Reveals patterns = 50 failed logins for the same email is immediately visible

## Two Layers, Never Duplicate

**Global exception filter** — logs all unhandled exceptions automatically (HTTP method, path, status, stack). Never re-log these in services.

**Services** — log business events and expected outcomes only:
- Successful operations: login succeeded, payment processed, job finished
- Expected failures with domain context: login failed (wrong password), user not found

```ts
// Service — expected outcome with business context
if (!user) {
  this.logger.warn({ message: 'Login failed', email, reason: 'invalid_credentials', ip });
  throw new UnauthorizedException(); // filter handles HTTP-level logging
}
this.logger.info({ message: 'Login succeeded', userId, email, role });
```

## What to Log

**Log:**
- Significant business operations — payment calculated, invoice generated, appointment created
- Auth events (login success/failure, token failures, authorization denied)
- External service calls that can visibly fail (Supabase auth, Stripe, etc.)
- Background job completion or failure (not start)

**Never log:**
- Passwords, tokens, encryption keys, bank account data
- Function entry/exit, routine reads with no business value
- Breadcrumbs — fold into one wide event at the end
- Unhandled exceptions in services — the global filter handles this

## Security Signals

Auth events are security signals. Log them consistently so patterns are searchable.

| Event | Level |
|---|---|
| Login success | `info` |
| Login failure (wrong password, invalid credentials) | `warn` |
| Login failure (account locked) | `warn` |
| Logout | `info` |
| Token validation failure | `warn` |
| Token refresh failure | `warn` |
| Authorization failure (valid user, wrong role) | `warn` |

Always include: user identifier, IP address, failure reason.

```ts
this.logger.warn({ message: 'Login failed', email, reason: 'invalid_credentials', ip: req.ip });
this.logger.warn({ message: 'Token refresh failed', reason: error.message });
this.logger.warn({ message: 'Authorization denied', userId, path: req.url, reason: 'insufficient_role' });
```

## Logger Usage

**`new Logger()` — pass an object as the first argument:**

```ts
private readonly logger = new Logger(MyService.name);

this.logger.error({ message: "Payment failed", contractorId, amount, error: error.message });
this.logger.warn({ message: "Login failed", email, reason, ip });
this.logger.log({ message: "Payment processed", contractorId, amount });
```

**`@Inject(WINSTON_MODULE_PROVIDER)` — message first, metadata second (infrastructure only):**

```ts
this.logger.error("Payment failed", { contractorId, amount, error: error.message });
this.logger.info("Payment processed", { contractorId, amount });
```

Use `new Logger()` for services. Reserve Winston injection for infrastructure-level classes like the global exception filter.

## Gotchas

- NestJS `Logger.log()` is the equivalent of `info` level — use `.log()` not `.info()` with `new Logger()`
- Never log the start of an operation unless it's a long-running background job where you need to know it was picked up
- If you catch an exception and handle it gracefully, log it as `warn` with the reason — don't re-throw and let the filter double-log it
- Include `duration` (ms) in canonical logs for any operation that calls external services or runs queries
