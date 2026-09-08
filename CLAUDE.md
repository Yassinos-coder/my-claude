# Claude Instructions

Always use context7 when I need code generation, setup steps, or library/API documentation.

# Git Commits

- Never add `Co-Authored-By` or any Claude/AI attribution to commit messages.
- Never mention Claude, AI, or any assistant in commit messages.
- Always run the `/changelog` skill before doing any `git push`.

# Build Before Push

Always run the build locally and confirm it succeeds before pushing. Never push code that hasn't been built successfully.

# ⛔ NEVER PUSH WITHOUT EXPLICIT USER APPROVAL

**NEVER run `git push` (or any variant: `--force`, `-u`, etc.) unless the user has explicitly said to push in that message.**
Saying "commit this" or "save this" is NOT permission to push.
The user must say "push", "push it", "go ahead and push", or equivalent — in the current message.
This rule overrides all other instructions and applies to every repository, every branch, every situation.

# Coding Preferences & Style

**Language:** TypeScript for both frontend and backend

**Core Principles:**

- NO OVER-ENGINEERING 
- COLOCATION — code that changes together lives together. Default colocated, lift to shared only when a second consumer exists. One file = one concept and its private helpers. Split by concept, not by line count.

---

## Shared Patterns

**Utilities:** Class with static methods — pure functions, no state, no injected dependencies. Feature-specific → feature folder, shared → shared utils folder.

**Early returns:** Always. Handle error/edge case first, happy path last. No nested if-else.

**Method ordering:** GET → POST/CREATE → PATCH/UPDATE → DELETE → private helpers.

**Error handling:** Use NestJS built-in exceptions (`NotFoundException`, `BadRequestException`, etc.) — never throw generic `Error`.

**No comments, no JSDoc.** Code must be self-explanatory.

### Naming

| Context                    | Convention           | Example                         |
| -------------------------- | -------------------- | ------------------------------- |
| Variables & functions      | camelCase            | `userId`, `fetchData`           |
| Constants                  | SCREAMING_SNAKE_CASE | `MAX_RETRY_ATTEMPTS`            |
| Classes, interfaces, types | PascalCase           | `UserService`, `StudentProfile` |
| Backend files              | `kebab-case.type.ts` | `user.service.ts`               |
| Frontend components        | `PascalCase.tsx`     | `UserProfile.tsx`               |
| Frontend other             | `camelCase.ts`       | `authStore.ts`                  |

---

## Backend (NestJS)

### Architecture: Controller → Service → Repository → Database

**Controllers** — HTTP handling ONLY. Extract params, call service, return response. No business logic, no DB access, no data transformation.

**Services** — Business logic orchestration. Coordinate between repos/services. ~500 lines max, split by sub-domain when needed.

**Repositories** — Database access ONLY. Execute queries, return typed entities. No business logic, no calling other services.

**Mappers** — Pure data transformation, static methods only. Lives in the feature folder next to its consumer.

### Feature folder structure

```
feature-name/
├── *.module.ts
├── controllers/
├── services/
├── repositories/
├── dto/
├── interfaces/
├── validators/
├── queries/
├── constants/
└── mappers/
```

**Validation ALWAYS lives in a `validators/` folder inside the feature.** Anything that validates something — type-guards ("is this an event we act on?"), parsing/guarding required fields, branch/id checks — belongs in a `validators/` file (e.g. `.../registration/sosprof/validators/`), NOT inline in a service, controller, or mapper. Validators are pure static methods.

**Interfaces & types ALWAYS live in an `interfaces/` folder inside the feature — NEVER define an `interface` or `type` inline in a service, controller, repository, or any other file, and NEVER put them in a `types/` folder.** Always create/use `interfaces/` (e.g. `.../registration/sosprof/interfaces/`), even when the surrounding module currently uses a `types/` folder — do not follow that local convention. One concept per file or grouped in `interfaces/index.ts`; import them where needed. A service file contains the class and its logic only — no type declarations above or below it.

### DTOs

Use `class-validator` decorators. `!` for required, `?` for optional. `@IsOptional()` for optional fields. DTOs live in `dto/` within the feature.

### Database (Supabase)

- Define `schema` and `tableName` as class properties on every repository
- `.maybeSingle()` for 0 or 1 result, `.single()` for exactly 1
- Always handle errors with descriptive messages
- Type cast results to proper interfaces

### Configuration

Use NestJS `ConfigService` with typed config from `src/config/configuration.ts`.

### Resilience & Failure Handling

**Caching layers (Redis, etc.) must never be a single point of failure.** If the app tries Redis first and Redis is down/unreachable/times out, the app must not crash or hang — it should catch the failure, log it, and fall back to the source of truth (DB, upstream API, or recompute) so the request still succeeds, just without the cache speed-up. Never let a cache-read/write failure propagate as an unhandled exception that takes down a request or the app.

---

## Frontend (React)

### Architecture: Pages → Hooks → Services → Backend

**Pages** — Orchestrate data fetching (React Query hooks), manage top-level state, compose UI from components. No presentation markup, no direct API calls.

**Components** — Receive data via props, render UI, handle UI-only state. Never fetch data, never access stores (except UI-only), never contain business logic. Naming: `[Section]Header`, `[Entity]Row`, `[State]View`, `[Entity]Card`.

**Hooks** — Three types:

- Query hooks (`useFeatureQueries.ts`) — React Query wrappers
- Mutation hooks (`useFeatureMutations.ts`) — React Query wrappers
- Logic hooks (`useFeatureName.ts`) — reusable business logic

**Services** — Extend `BaseApiClient`, pure API wrappers, export singleton instance.

**Stores** — Zustand for global UI state only. Server state → React Query, not stores.

### Feature folder structure

```
feature-name/
├── components/
├── hooks/
├── pages/
├── routes/
├── services/
├── stores/
├── schemas/
├── types/
├── constants/
├── utils/
└── locales/
```

### Project folder structure

```
frontend/
├── public/               — Static files and assets served as-is
└── src/
    ├── assets/           — Images, fonts, icons, and other static assets
    ├── components/       — Reusable UI components
    ├── layout/           — Layout components (Header, Footer, etc.)
    ├── pages/            — Application pages and routes
    ├── features/         — Feature-based modules
    ├── hooks/            — Custom React hooks
    ├── context/          — React context for global state
    ├── store/            — Global state (Zustand stores or Redux slices)
    ├── services/         — API calls and external services
    ├── utils/            — Helper functions and utilities
    ├── App.tsx
    └── main.tsx
├── .eslintrc.json
├── .gitignore
├── package.json
└── vite.config.ts
```

### State management

| State type      | Tool                     |
| --------------- | ------------------------ |
| Server state    | React Query              |
| Global UI state | Zustand (with selectors) |
| Local UI state  | `useState`               |
| Form state      | React Hook Form          |

### Import aliases

Always use `@` alias — never relative paths.
