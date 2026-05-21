# Claude Instructions

Always use context7 when I need code generation, setup steps, or library/API documentation.

## EC2 Server

All projects share one EC2 instance. Use the `push-to-ec2` skill to deploy.

- **Host:** `ec2-user@51.44.61.246`
- **SSH key:** `C:\Users\castr\my-moodle-ec2-key.pem` (Git Bash: `/c/Users/castr/my-moodle-ec2-key.pem`)
- **SSH command:** `ssh -F NUL -i /c/Users/castr/my-moodle-ec2-key.pem -o IdentitiesOnly=yes ec2-user@51.44.61.246`

# Git Commits

- Never add `Co-Authored-By` or any Claude/AI attribution to commit messages.
- Never mention Claude, AI, or any assistant in commit messages.

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
├── queries/
├── constants/
└── mappers/
```

### DTOs

Use `class-validator` decorators. `!` for required, `?` for optional. `@IsOptional()` for optional fields. DTOs live in `dto/` within the feature.

### Database (Supabase)

- Define `schema` and `tableName` as class properties on every repository
- `.maybeSingle()` for 0 or 1 result, `.single()` for exactly 1
- Always handle errors with descriptive messages
- Type cast results to proper interfaces

### Configuration

Use NestJS `ConfigService` with typed config from `src/config/configuration.ts`.

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

### State management

| State type      | Tool                     |
| --------------- | ------------------------ |
| Server state    | React Query              |
| Global UI state | Zustand (with selectors) |
| Local UI state  | `useState`               |
| Form state      | React Hook Form          |

### Import aliases

Always use `@` alias — never relative paths.
