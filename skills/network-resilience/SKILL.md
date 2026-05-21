---
name: network-resilience
description: >
  Network resilience patterns for NestJS backends and React frontends. Applies
  when writing, reviewing, or modifying code that makes network calls — fetch,
  Supabase queries, HTTP clients, webhook handlers, event emissions, React Query
  mutations, or any cross-service communication. Triggers when the user writes
  API endpoints, service methods that call external systems, frontend mutations,
  or retry/timeout logic — even if they don't explicitly mention "resilience" or
  "network failures." Also applies when designing new features that involve
  critical user data (exams, grades, assignments, payments, subscriptions).
---

# Network Resilience

## Why This Matters

Networks are unreliable. ~0.1% of API calls fail under good conditions (AWS
design baseline). On mobile: 1-5%. Failures come in bursts, not steady drips.
This is a tradeoff from packet-switched network design — cheap/fast/efficient
over guaranteed delivery. Every fetch, every Supabase query, every webhook is a
distributed system call that can fail.

The fault handling must be part of the software design, not an afterthought.
Suspicion, pessimism, and paranoia pay off.

## Three Failure Modes

Identify which mode applies before writing error handling.

**Loud** — the call fails and you know it. Error, exception, non-200 status.
Handle it: catch, show user a clear message, allow retry.

**Silent** — the call fails but nobody notices. Fire-and-forget patterns,
un-awaited promises, errors swallowed with `console.error()`.
Handle it: always `await` critical calls, always surface errors to the user.

**Ambiguous** — a timeout occurs and you cannot tell if the server processed the
request. The request may have been lost, the server may be down, or the server
processed it but the response was lost. Same error, opposite outcomes.
Handle it: idempotency keys (see Pattern 3).

Silent failure patterns to catch during review:
- `eventEmitter.emit()` without `await` or `emitAsync`
- `.mutate()` without `onError` that shows UI feedback
- `fetch()` inside `useEffect` without error handling
- try/catch that logs but doesn't rethrow or notify the user

## The Tiering Framework

Not every endpoint needs the same protection. Ask two questions:
1. What happens if this fails silently?
2. What happens if this executes twice?

### Tier 1 — Full Protection
Failure = data loss, money loss, or broken user experience.
Examples: exam completion, assignment submission, payment charges, subscription
pause/cancel.

Requires: timeouts + retries with backoff + idempotency keys + queue for async
side-effects.

### Tier 2 — Standard Protection
Failure is noticeable but not catastrophic. No money or grades at stake.
Examples: practice question answers, session index updates, logged time sync.

Requires: timeouts + retries with backoff + clear error UI.

### Tier 3 — Minimal Protection
Non-critical. Failure doesn't affect the user's primary action.
Examples: analytics, conversation memory, non-critical notifications.

Requires: timeouts only. Fail silently (but log it). Never block the user.

**Never mix tiers in a single request.** Critical work is synchronous.
Non-critical side-effects go to a queue (BullMQ).

```ts
@Post('complete-session')
async completeSession(@Body() dto: CompleteExamSessionDto) {
  // Tier 1: critical, must succeed
  const result = await this.examService.completeSession(dto);

  // Tier 3: non-critical, push to BullMQ
  await this.notificationQueue.add('tutor-notify', {
    tutorId: dto.tutorId,
    sessionId: dto.sessionId,
  });

  return result;
}
```

---

## Pattern 1: Timeouts

A request without a timeout can hang forever. Every network call needs one.

### Frontend — Single `request()` method with AbortSignal.timeout()

`AbortSignal.timeout(ms)` is the modern standard. One line, no memory leaks,
throws a distinguishable `TimeoutError` (not `AbortError`). Supported in all
browsers since 2022 and Node.js 18+. Do not use the old
`AbortController + setTimeout` pattern.

The cleanest pattern is a **single private `request()` method** in the base API
client that all public methods (get, post, put, etc.) delegate to. This avoids
duplicating timeout + error handling in every method.

#### ApiError class

Throw `ApiError` (extends `Error` with a `status` field) instead of plain
`Error`. This lets React Query's retry function distinguish 4xx from 5xx.
Colocate it in the same file as BaseApiClient — it's tightly coupled.

```ts
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_ERROR_MESSAGE = "Erreur — Veuillez contacter notre service client";
const TIMEOUT_ERROR_MESSAGE = "Délai d'attente dépassé — Veuillez réessayer";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export abstract class BaseApiClient {
  // ... constructor, getHeaders, etc.

  private async request(
    url: string,
    init: RequestInit,
    timeout = DEFAULT_TIMEOUT_MS,
  ): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeout),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new ApiError(0, TIMEOUT_ERROR_MESSAGE);
      }
      throw new ApiError(0, DEFAULT_ERROR_MESSAGE);
    }
  }

  protected async handleResponse<T>(
    response: Response,
    preserveErrorMessage = false,
  ): Promise<T> {
    if (response.ok) return this.parseSuccessResponse<T>(response);

    if (preserveErrorMessage) {
      const errorMessage = await this.extractErrorMessage(response);
      throw new ApiError(response.status, errorMessage);
    }

    throw new ApiError(response.status, DEFAULT_ERROR_MESSAGE);
  }

  // Each method delegates to request() — no individual try/catch needed:
  protected async get<T>(path: string, queryParams?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (queryParams) url += `?${new URLSearchParams(queryParams)}`;
    const response = await this.request(url, { method: "GET", headers: this.getHeaders(false) });
    return this.handleResponse<T>(response);
  }

  protected async post<T>(path: string, data?: unknown, options?: { preserveErrorMessage?: boolean }): Promise<T> {
    const response = await this.request(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.getHeaders(true),
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response, options?.preserveErrorMessage);
  }

  // put, patch, delete, postBlob, postFormData follow the same pattern
}
```

Key benefits of this pattern:
- Timeout logic in one place — not duplicated across 7+ methods
- `ApiError` with `status` enables smart retry in React Query
- Each method becomes 3-5 lines — cleaner, less error-prone
- `ApiError extends Error` so `instanceof Error` checks still work everywhere

### Combining with React Query cancellation

React Query passes an `AbortSignal` to `queryFn` for cancellation on unmount.
Timeouts are NOT React Query's concern — they belong in the API client. But if
you want both timeout and unmount cancellation, combine with
`AbortSignal.any()` (supported since 2023):

```ts
const useStudentQuery = (studentId: string) => {
  return useQuery({
    queryKey: ['student', studentId],
    queryFn: async ({ signal }) => {
      const combinedSignal = AbortSignal.any([
        signal,
        AbortSignal.timeout(10_000),
      ]);
      const response = await fetch(`/api/students/${studentId}`, {
        signal: combinedSignal,
      });
      return response.json();
    },
  });
};
```

This is an optimization. The timeout in the base API client alone covers the
critical case.

### Distinguishing timeout from cancellation

```ts
try {
  const data = await apiClient.get<Student>('/students/1');
} catch (error) {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    // Request timed out — show retry UI
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    // Manually cancelled (unmount) — ignore silently
  }
}
```

### Backend — NestJS

**Global request-level timeout** via interceptor. This is a safety net that
wraps around every controller — it starts a timer when the request arrives and
kills it if the controller + service + database work doesn't finish in time.
It's not a callback that runs after — it's a wrapper around the entire request
lifecycle using RxJS's `timeout` operator.

The interceptor is the **last resort backstop**. Inner timeouts (Supabase,
axios) should fire first. The interceptor catches anything that slips through:
heavy CPU work without network calls, forgotten `await`, or new code that
forgets to set a timeout.

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, RequestTimeoutException } from "@nestjs/common";
import { Observable, throwError, TimeoutError } from "rxjs";
import { catchError, timeout } from "rxjs/operators";

const DEFAULT_TIMEOUT_MS = 30_000;

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(DEFAULT_TIMEOUT_MS),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err);
      }),
    );
  }
}
```

Register as global interceptor in `app.module.ts`:

```ts
import { APP_INTERCEPTOR } from "@nestjs/core";

providers: [
  {
    provide: APP_INTERCEPTOR,
    useClass: TimeoutInterceptor,
  },
]
```

Note: The RxJS `timeout` operator watches the Observable stream — it
automatically cancels itself if the response arrives in time (no cleanup, no
dangling timers). Different from `setTimeout` which fires regardless.

Per-route override with a decorator (add only when a route needs it):

```ts
export const Timeout = (ms: number) => SetMetadata('timeout', ms);

@Get('slow-report')
@Timeout(60_000)
getSlowReport() { ... }
```

**Outbound HTTP calls** — if using axios (existing code), add `timeout` to
the config. For new code, prefer native fetch with `AbortSignal.timeout()`.

For existing axios-based clients, add timeout + detect `ECONNABORTED`:

```ts
const DEFAULT_TIMEOUT_MS = 15_000;

const config: AxiosRequestConfig = {
  method,
  url,
  headers: { ... },
  data: body,
  timeout: DEFAULT_TIMEOUT_MS,
};

// In error handler:
if (axios.isAxiosError(error) && error.code === "ECONNABORTED") {
  return new HttpException("Request timed out", HttpStatus.GATEWAY_TIMEOUT);
}
```

**Supabase queries** — set a global timeout via custom fetch in the Supabase
client constructor. This covers every query in every repository automatically —
no need to add `.abortSignal()` to hundreds of individual queries:

```ts
this.supabaseClient = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'secure' },
  global: {
    fetch: (url, options) =>
      fetch(url, { ...options, signal: AbortSignal.timeout(15_000) }),
  },
});
```

The `global.fetch` option replaces Supabase's default fetch for all requests.
We spread `...options` to preserve Supabase's headers/method/body, then add the
timeout signal. Supabase JS client has no built-in timeout — without this,
queries hang forever.

Alternative: `.abortSignal()` per query (v2.39+) — use only when a specific
query needs a different timeout than the global default:

```ts
const { data, error } = await supabase
  .from('students')
  .select('*')
  .eq('id', studentId)
  .abortSignal(AbortSignal.timeout(5_000))
  .single();
```

### Timeout values by operation type

| Operation | Frontend | Backend outbound |
|---|---|---|
| Auth / login | 5s | — |
| Data reads (page loads) | 10s | 15s to Supabase |
| Mutations (writes) | 15s | 15s to Supabase |
| File uploads / streaming | 30-60s | 30-60s |
| External APIs (TutorCruncher, etc.) | — | 15s |
| Webhooks (Pabbly, etc.) | — | 10s |
| Global request interceptor | — | 30s |

### The cascade rule

Inner timeouts must be shorter than outer timeouts:

```
React (10s) → NestJS interceptor (30s) → Supabase (15s)
```

If Supabase is slow, the query fails at 15s, NestJS returns an error to React.
The frontend already timed out at 10s and disconnected — React Query retries.
The interceptor is the last safety net at 30s for anything that slips through.

Important: when the frontend times out at 10s, the backend keeps processing.
The interceptor would fire at 30s, but if the frontend already disconnected,
there's no client to send the error to. This is expected behavior — the
interceptor protects against server resource leaks, not client-side UX.

---

## Pattern 2: Retries with Exponential Backoff + Jitter

Most network failures are transient. Retry and it works. But naive retries
(immediate, synchronized) cause retry storms that worsen outages.

### Exponential backoff + full jitter (AWS recommended)

```ts
const backoff = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 30_000);
const delay = Math.random() * backoff;
```

- `Math.pow(2, attempt - 1)` — doubles the max wait each attempt (2s → 4s → 8s → 16s...)
- `Math.min(..., 30_000)` — caps at 30s so it never waits absurdly long
- `Math.random() * backoff` — **jitter**: randomizes the actual wait within the
  backoff window. If 100 users all hit a server error at the same time and all
  retry at exactly 4s, they hammer the server simultaneously. Jitter spreads
  retries out so the server can recover.

### What to retry

| Status | Retry? | Why |
|---|---|---|
| 5xx (500, 502, 503, 504) | Yes | Server error, likely transient |
| 429 Too Many Requests | Yes, respect Retry-After | Rate limited |
| Network timeout | Yes, if idempotent | Server may have processed it |
| 4xx (400, 401, 403, 404, 422) | No | Client error, won't fix itself |

### React Query — Smart retry configuration

Use a `retry` function that checks `error.status` (from `ApiError`) to skip
4xx errors. This requires the `ApiError` class from the base client — without
a status on the error object, React Query can't distinguish error types.

Mutations stay at `retry: 0` — they aren't safe to auto-retry without
idempotency keys.

```ts
export const REACT_QUERY_OPTIONS = {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount: number, error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 30_000),
    },
    mutations: {
      retry: 0,
    },
  },
};
```

Note: with 3 retries + 10s timeout each + exponential backoff, total wait can
be ~47s before giving up (10s + ~1s + 10s + ~2s + 10s + ~4s + 10s). This is
expected — the user sees a loading state, then an error.

### Backend — ErrorHandling utility with exponential backoff

For static utility classes (no DI), use a module-level NestJS Logger instead of
`console.log`. The logger goes through Winston for structured logging.

```ts
import { HttpException, Logger } from "@nestjs/common";

const logger = new Logger("ErrorHandling");

export class ErrorHandling {
  private static isRetryable(error: unknown): boolean {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      return status >= 500;
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return true;
    }
    return true;
  }

  public static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 2000,
    silentFail: boolean = false,
    operationName: string = "operation"
  ): Promise<T | undefined> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Attempt ${attempt}/${maxRetries} failed for ${operationName}: ${message}`);

        if (!this.isRetryable(error) || attempt >= maxRetries) {
          break;
        }

        const backoff = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 30_000);
        const delay = Math.random() * backoff;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    if (silentFail) {
      logger.error(`All ${maxRetries} retry attempts failed for ${operationName}, continuing execution`);
      return undefined;
    }

    throw lastError;
  }
}
```

### cockatiel for composable resilience (advanced)

cockatiel is a TypeScript resilience library for composable timeout + retry +
circuit breaker policies. Use it when you need circuit breaking or more complex
resilience composition. For simple retry + backoff, the ErrorHandling utility
above is sufficient.

```ts
import {
  CircuitBreakerPolicy,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  retry,
  timeout,
  wrap,
  TimeoutStrategy,
} from 'cockatiel';

const timeoutPolicy = timeout(5_000, TimeoutStrategy.Aggressive);

const retryPolicy = retry(handleAll, {
  maxAttempts: 3,
  backoff: new ExponentialBackoff({ initialDelay: 200, maxDelay: 5_000 }),
});

const circuitBreaker = new CircuitBreakerPolicy(handleAll, {
  breaker: new ConsecutiveBreaker(5),
  halfOpenAfter: 30_000,
});

const resilientPolicy = wrap(circuitBreaker, retryPolicy, timeoutPolicy);
```

### BullMQ retry configuration

```ts
await queue.add('send-notification', payload, {
  timeout: 30_000,
  attempts: 3,
  backoff: { type: 'exponential', delay: 1_000 },
});
```

---

## Pattern 3: Idempotency Keys

Retrying is only safe if the operation is idempotent (multiple executions = same
result). GET, PUT, DELETE are naturally idempotent. POST is not.

For critical POST endpoints, use idempotency keys:

1. Client generates a UUID before the request
2. Client sends it with the request
3. Server checks: seen this key before?
   - No → process, store key + response in database
   - Yes → return stored response without re-processing

### Frontend (generate the key)

```ts
const idempotencyKey = crypto.randomUUID();

await examService.complete(sessionId, { ...dto, idempotencyKey });
// Safe to retry with same key
```

### Backend (check the key)

```ts
async completeSession(dto: CompleteExamSessionDto) {
  const existing = await this.idempotencyRepo.findByKey(dto.idempotencyKey);
  if (existing) return existing.response;

  const result = await this.sessionsRepository.updateSession(dto.sessionId, {
    status: ExamSessionStatus.COMPLETED,
    completed_at: new Date().toISOString(),
  });

  await this.idempotencyRepo.store(dto.idempotencyKey, result);
  return result;
}
```

### When to require idempotency keys

- Any POST that creates or modifies critical data (exams, grades, payments)
- Any POST that triggers side effects (billing webhooks, notifications)
- Any mutation where a duplicate would cause data corruption or money loss

### When NOT needed

- GET requests (naturally idempotent)
- PUT/DELETE requests (naturally idempotent)
- Upsert operations with proper conflict keys (already idempotent by design)
- Tier 3 operations (analytics, non-critical logging)

### "Client" means whoever sends the request

- React is the client when talking to NestJS → React generates the key
- NestJS is the client when talking to Stripe/Pabbly → NestJS generates the key

---

## Pattern 4: Queues for Critical Async Work

When a side-effect must eventually happen but shouldn't block the user, push it
to BullMQ. Queues provide automatic retries with backoff, dead letter queues
for permanent failures, and decoupling of critical responses from non-critical
side-effects.

Use queues for: webhook delivery, email sending, notification dispatching,
analytics processing — any Tier 3 work triggered by Tier 1 operations.

---

## Review Checklist

When writing or reviewing code that makes a network call:

- [ ] Timeout is set (`AbortSignal.timeout()` on frontend, interceptor + per-call on backend)
- [ ] Error is caught AND surfaced to the user (not just `console.error`)
- [ ] Errors thrown with status code (`ApiError` on frontend, `HttpException` on backend)
- [ ] Async calls are awaited (no fire-and-forget on Tier 1/2 paths)
- [ ] Retries use exponential backoff + jitter (not immediate or flat retry)
- [ ] Only transient errors are retried (5xx, 429, timeouts — not 4xx)
- [ ] Critical POST mutations have idempotency keys
- [ ] Non-critical side-effects are pushed to queues, not inlined
- [ ] Inner timeouts are shorter than outer timeouts (cascade rule)
- [ ] New fetch calls go through `this.request()` on frontend (not raw `fetch()`)
- [ ] Backend logging uses NestJS Logger (not `console.log`)

## Gotchas

- `fetch()` has no default timeout. Without `AbortSignal.timeout()`, it hangs
  forever.
- `AbortSignal.timeout()` throws `TimeoutError` (DOMException).
  `AbortController.abort()` throws `AbortError`. Use `error.name` to
  distinguish them.
- Supabase JS client has no built-in timeout. Use the `global.fetch` wrapper
  on `createClient` for global coverage, or `.abortSignal()` per query for
  specific overrides.
- `eventEmitter.emit()` in NestJS is fire-and-forget by default. Use `emitAsync`
  or await the handler if the result matters.
- A timeout does NOT mean the request failed. The server may have processed it.
  Never assume timeout = failure for mutations.
- React Query retries 3 times by default on queries. Configure a custom `retry`
  function that checks `ApiError.status` to skip 4xx errors. Set mutations to
  `retry: 0` — they aren't safe without idempotency keys.
- Retrying with `new Date().toISOString()` in the payload changes the timestamp
  on each attempt, breaking idempotency even with upsert. Generate timestamps
  once or use idempotency keys to return the original response.
- BullMQ retry delay defaults to 0 (immediate). Always configure exponential
  backoff: `backoff: { type: 'exponential', delay: 1000 }`.
- The NestJS TimeoutInterceptor wraps around the entire request lifecycle — it's
  a deadline, not a callback. It watches the RxJS Observable stream and kills
  the request if it doesn't complete in time. When the frontend times out first,
  the backend keeps processing until the interceptor fires — this is expected.
- For existing axios code, add `timeout` to AxiosRequestConfig and detect
  `ECONNABORTED` in the error handler. For new code, prefer native fetch with
  `AbortSignal.timeout()`.
- `@nestjs/axios` uses axios under the hood. Prefer native fetch for new code.
- With 3 retries + timeouts + backoff, total wait before error can be ~47s.
  This is expected — users see loading state, then error. The alternative
  (no retries) shows errors immediately on transient failures.
