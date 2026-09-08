# Reading the Zapier (Automation Code Extractor) JSON

The same extension that captures Pabbly workflows also captures Zapier Zaps, normalizing both into
one schema. But a Zap is captured a completely different way — by reading the JSON node graph the Zap
editor loads for itself, not by scraping a rendered page — and that changes what the export can and
cannot tell you. **Read this instead of `pabbly-export-format.md` when `platform` is `"zapier"`.**

## Top-level shape

```jsonc
{
  "systemPrompt": "...",       // the extension's own reading instructions — actually read them,
                               // they change between versions and describe that version's encoding
  "schemaVersion": 2,
  "platform": "zapier",
  "extension": { "version": "0.11.6", ... },   // VERSION MATTERS — see "Negation" below
  "schema": { "workflowName", "confidence", "health", "stepCount", "steps": [...] },
  "raw": { "note": "..." }     // just a note. There is NO raw payload for a Zapier capture.
}
```

**The Pabbly rule is inverted here.** For Pabbly, `raw` is the source of truth and `schema` is a
heuristic. For Zapier there is no `raw` payload at all — `schema.steps` IS the normalized node graph
and is authoritative. Don't go looking for a `raw` to cross-check against.

`schema.stepCount` counts top-level steps only; `schema.health.counts.total` counts every step
including those nested inside router routes. A Zap showing `stepCount: 4` and `total: 10` is not
inconsistent — it has branches.

## What the export does NOT contain

This is the important half, and the part that will cost you round trips if you don't plan for it.

- **No sample values.** Nothing shows what any field holds at runtime. (The Pabbly export embeds
  samples in every reference, `N. Label : sample`; the Zapier node graph simply has none.) You cannot
  infer a field's shape, type, or cardinality from the export.
- **No human labels for ids.** A Sendy `list` exports as `VSOspVs8TEPDetdPK4A2WQ`; the editor shows
  *"Lead - Tutorat - Primaire et Secondaire - QC/FR"* beside it, resolved separately and not present
  in the graph. Same for `brand: "2"` → *"Tutorax"*.
- **No indication of which array field a flattened condition matched** (see below).

**Recovery procedure — this works well:** ask the user to open the step in the Zap editor and paste
the step-details panel's HTML. That panel renders the human label, the resolved operator, and a sample
value for every reference. It is verbose but it is the ground truth for exactly the three gaps above.
Ask by step number (`schema.steps[].order`), and name the step so they can find it.

## Dynamic references

Zapier writes cross-step references as `{{123456789__field_path}}`, where the number is the **source
node's internal id**, not its position. The extension resolves those to step positions: a mapping
carrying references gets a `references: [{ step, field }]` array where `step` matches another step's
`order`. Filter conditions address their source the same way, as a bare `<nodeId>__<path>` key, also
resolved — a condition with a `step` is reading that step's output at `field`.

Field paths use `__` for nesting and `[]` for array traversal:
`events[]subject__status` = `events[].subject.status`.

## Filters: groups, joiners, negation

`filter` is an array of condition groups. **Groups are OR'd; conditions inside a group are AND'd.**

The `joiner` field labels group 0 `"AND"` and later groups `"OR"`. It describes how a group joins the
*previous* one, so `joiner` on group 0 is meaningless — don't read it as a statement about that
group's internal logic. The internal logic is always AND.

**Negation — check `extension.version`:**

| Version | Encoding of "does not contain" |
|---|---|
| ≥ 0.11.5 | `{ operator: "icontains", negated: true, value: "X" }` |
| ≤ 0.11.4 | `{ operator: "icontains", action: "stop", value: "X" }` |

Both mean the same thing: Zapier has no negative operators, so the editor's "does not contain" is
stored as the *positive* operator plus a flag. **Always invert an operator carrying either marker.**
Taken verbatim, such a condition reads as its own opposite — this is the single easiest way to build a
migration that is exactly backwards.

**Factor repeated conditions.** When the same condition appears in every OR group, it factors out:

```
(primaire ∧ ¬blocked) ∨ (secondaire ∧ ¬blocked)  ≡  ¬blocked ∧ (primaire ∨ secondaire)
```

That turns into one early-return guard plus a resolver, which is both cleaner and provably equivalent.
State the equivalence when you report it.

## Line-item flattening — the biggest trap

A path containing `[]` does **not** select one element. Zapier flattens every value at that path into a
single string and tests that. So a condition on `events[]subject__extra_attrs[]value`:

- `contains "primaire"` → passes if **any** `extra_attrs` value contains it
- `contains "true"` + `negated` → passes only if **no** value contains it

Implement it by collecting all the values and testing the set — never by reading the first element.

The consequence that matters: **such a condition cannot tell you which field matched.** If the
automation looks like it is keyed to one specific custom field, the export cannot prove it. Ask the
user whether to (a) reproduce the flattened match faithfully, or (b) narrow to a named field — and be
explicit that (b) is a behavior change, not a clarification. Reproducing faithfully is usually right,
because it is what production does today.

## Routers

`Paths by Zapier` becomes a `router` step with one entry in `routes[]` per Path. Each route's first
step is the `filter` defining that branch's condition, carrying `path_eval_index` (evaluation order).
Routers nest; a route step marked `nestedRouter` with a `note` instead of `routes[]` hit the capture
depth limit and was not expanded — ask for that sub-branch.

**Paths run in parallel.** `event: "parallel_paths"` means more than one branch can fire for a single
event if their conditions both match. When branches write to mutually exclusive destinations (one list
per grade level), a record matching two branches is almost certainly unintended — implement
first-match and say you did, rather than silently reproducing a double-write.

## Translating common step types to code

| Zapier step | In code |
|---|---|
| Webhooks by Zapier (`catch_hook`, `hook_v2`) | your `@Public() @Post('webhook/...')` endpoint |
| Filter by Zapier | a validator type-guard or early `return` |
| Paths by Zapier | `if`/early-return branches, or a resolver returning an enum |
| Code by Zapier | reimplement the JS/Python in `mappings.code` as TS — never run it as-is |
| Formatter by Zapier | usually a one-line TS transform; often skippable |
| A named app action (Sendy subscribe, Gmail send) | the corresponding `infrastructure/` client call |

Platform plumbing that has no code equivalent — Sendy's `brand`, Zapier's own retry/ordering settings
— should be dropped, not modeled. A Sendy list id is already brand-scoped, so `brand` carries nothing.

## Gotchas checklist

- **`schema.steps` is authoritative** — there is no `raw` to fall back to (inverse of Pabbly).
- **Invert every `negated` / `action: "stop"` condition.** Check `extension.version` for which.
- **`[]` means flattened-and-joined, not "first element".**
- **Ids are opaque.** Keep them as named constants and ask for the human names.
- **A `health` score of "complete / 100%" means data was captured, not that it is correct** — and it
  says nothing about the labels and samples the graph never carried in the first place.
- **Accents are load-bearing.** Zapier's `icontains` is case-insensitive but accent-*sensitive*, so a
  literal `cégep` will not match `cegep`. Prefer an accent-tolerant regex (`c[ée]gep`) in the port —
  it is a strict superset — and say that you widened it.
- **Mojibake (`cÃ©gep`) is not the extension's doing.** Its export is valid UTF-8; that corruption
  comes from whatever read the file. Read through it; don't "fix" the source values.
