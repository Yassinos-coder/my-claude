---
name: recap-feature
description: >
  Produce a clean, professional French summary of a feature or group of code changes
  for sharing with a non-technical team. Use when the user wants to communicate what
  was built, what changed, or what was delivered — targeting teammates who don't read
  code. Outputs a polished .md file ready to copy into Slack, Teams, or email.
disable-model-invocation: true
argument-hint: "[feature or context]"
---

## Workflow

1. **Ask the user** what feature, change, or group of work to summarize. Ask which
   files or folders to read, or let the user describe the feature verbally. If
   `$ARGUMENTS` is provided, use it as the starting context but still confirm scope.

2. **Read the relevant code** — controllers, services, components, migrations, etc.
   Understand what the feature does from a user-facing perspective, not implementation
   details.

3. **Produce the recap** as a `.md` file written to the current working directory
   named `recap-<topic>.md` (e.g. `recap-messagerie.md`). Ask the user for the
   file name if the topic is ambiguous.

## Writing style

Write in **clean, professional French**. The audience is non-technical — managers,
ops, support agents, team leads. They care about what changed for users, not how
the code works.

### Tone and language rules

- First person singular ("J'ai integre", "J'ai finalise") — the developer speaking
  to the team.
- Correct French grammar, proper accents (e, e, a, etc.), no anglicisms when a
  French equivalent exists. Technical terms universally used in French tech context
  are acceptable (backend, frontend, SSO, API, email, etc.).
- Concise, direct sentences. No filler, no corporate fluff.
- Use bullet points (with the `*` marker rendered as bullet) for listing
  sub-features. Each bullet has a **bold label** followed by a dash and explanation.
- Numbers and costs use French formatting when relevant (spaces for thousands,
  comma for decimals) but dollar sign is acceptable.
- Slack-compatible emoji shortcodes are allowed sparingly (`:slightly_smiling_face:`,
  `:warning:`, etc.) when they add tone — never decorative.

### Document structure

Follow this template:

```
Update - [Titre descriptif de la fonctionnalite]

[Paragraphe d'introduction — 1 a 3 phrases resumant ce qui a ete fait et pour qui.]

[Section optionnelle : Fonctionnalites principales / Points cles / Details]
* **Label** — Description accessible de la sous-fonctionnalite
* **Label** — Description accessible de la sous-fonctionnalite
[...]

[Sections additionnelles si necessaire — notes importantes, limites connues,
prochaines etapes, points d'attention pour l'equipe. Utiliser des sous-titres clairs.]

[Phrase de cloture optionnelle — courte, informelle, humaine.]
```

### What to include

- What changed from the user's perspective
- Who is affected (clients, tuteurs, admins, toutes les filiales, etc.)
- Concrete numbers if available (items generated, cost, coverage)
- Known limitations or missing features, stated honestly
- Action items for specific team members if relevant (use @mentions)

### What to exclude

- Implementation details (no mention of specific classes, database columns, etc.)
- Code snippets
- Technical jargon the audience wouldn't understand
- Speculative future features unless the user asks to include them

## Examples

Read `references/examples.md` before writing the recap. These are real examples
from the user — match their tone, structure, and level of detail exactly.

## Gotchas

- The user may provide code in English but the output must always be in French.
- If the feature spans multiple modules, group the recap by user-facing capability,
  not by technical component.
- When the user says "feature," they may mean a single PR, a group of PRs, or a
  whole epic. Clarify scope before writing.
