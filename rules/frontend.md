---
paths:
  - "**/*.tsx"
  - "**/hooks/*.ts"
  - "**/services/*.ts"
  - "**/stores/*.ts"
  - "**/pages/*.ts"
---

# React Architecture

**Layer responsibilities — Pages → Hooks → Services → Backend:**

- **Pages** — Orchestrate data fetching (React Query hooks), manage top-level state, compose UI from components. No presentation markup, no direct API calls.
- **Components** — Receive data via props, render UI, handle UI-only state. Never fetch data, never access stores (except UI-only). Naming: `[Section]Header`, `[Entity]Row`, `[State]View`, `[Entity]Card`.
- **Hooks** — Three types:
  - `useFeatureQueries.ts` — React Query wrappers
  - `useFeatureMutations.ts` — React Query wrappers
  - `useFeatureName.ts` — reusable business logic
- **Services** — Extend `BaseApiClient`, pure API wrappers, export singleton instance.
- **Stores** — Zustand for global UI state only. Server state → React Query, not stores.

**State management:**

| State type | Tool |
| --- | --- |
| Server state | React Query |
| Global UI state | Zustand (with selectors) |
| Local UI state | `useState` |
| Form state | React Hook Form |

**Feature folder structure:**

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

**Import aliases:** Always use `@` alias — never relative paths.
