---
paths:
  - "**/*.service.ts"
  - "**/*.controller.ts"
  - "**/*.repository.ts"
  - "**/*.module.ts"
  - "**/dto/*.ts"
  - "**/*.entity.ts"
---

# NestJS Architecture

**Layer responsibilities — Controller → Service → Repository → Database:**

- **Controllers** — HTTP only: extract params, call service, return response. No business logic, no DB access, no data transformation.
- **Services** — Business logic orchestration. Coordinate repos/services. ~500 lines max, split by sub-domain when needed.
- **Repositories** — DB access only. Execute queries, return typed entities. No business logic, no calling other services.
- **Mappers** — Pure static transformation methods. Lives in feature folder next to its consumer.

**Feature folder structure:**

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

**DTOs:** Use `class-validator` decorators. `!` for required fields, `?` for optional. `@IsOptional()` on optional fields. DTOs live in `dto/` within the feature.

**Supabase repositories:**

- Define `schema` and `tableName` as class properties on every repository
- `.maybeSingle()` for 0-or-1 result, `.single()` for exactly 1
- Always handle errors with descriptive messages
- Type cast results to proper interfaces

**Config:** Use `ConfigService` with typed config from `src/config/configuration.ts`.
