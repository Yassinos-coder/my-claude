---
name: feature-request
description: >
  Generate a pre-filled feature request form in clean, professional French,
  ready to copy-paste into the submission form.
disable-model-invocation: true
---

## Workflow

1. **Ask the user** what feature or need they want to submit. Ask for the context,
   the problem, or the idea they want to describe. Let them explain freely —
   they may provide text, screenshots, code references, or a verbal description.

2. **If the context is too vague to fill the form confidently**, ask one or two
   targeted follow-up questions — never more. Prefer inferring over asking.

3. **Produce the feature request** as a `.md` file written to the current working
   directory named `demande-<topic>.md` (e.g. `demande-notifications-sms.md`).
   Use a short, kebab-case topic derived from the request title.

## Form fields

Every output file must contain exactly these sections, in this order:

```
# Demande de fonctionnalité — <Titre de la demande>

Nom du demandeur : Hamza Eshoul

Division(s) concernée(s) : Tutorax QC

Titre de la demande :
<Une phrase concise résumant la demande>

Explication de la demande :
<Description détaillée — 2 à 5 paragraphes ou listes à puces selon la complexité>

Pourquoi cette demande est-elle importante? :
<Impact concret, valeur ajoutée, problème résolu — 1 à 3 paragraphes>

Degré d'urgence : <Faible | Moyen | Élevé | Critique>
```

## Writing style

Write in **clean, professional French**. The audience is non-technical — managers,
ops, support agents, team leads. They care about what this feature would change
for users and the business, not how it would be implemented technically.

### Tone and language rules

- Third person or impersonal form for the request itself ("Cette fonctionnalité
  permettrait...", "Les utilisateurs pourraient..."). First person singular only
  in the "Pourquoi" section if it adds a personal perspective ("Dans mon
  expérience quotidienne...").
- Correct French grammar, proper accents (é, è, à, ê, etc.), no anglicisms when
  a French equivalent exists. Technical terms universally used in French tech
  context are acceptable (backend, frontend, SSO, API, email, etc.).
- Concise, direct sentences. No filler, no corporate fluff.
- Use bullet points for listing sub-features or benefits. Each bullet has a
  plain text label followed by a dash and explanation.
- Never use bold markdown syntax (`**`) anywhere in the output file. All text
  must be plain, unformatted text (except for the `#` heading).
- Numbers use French formatting when relevant (spaces for thousands, comma for
  decimals).

### Filling each field

**Titre de la demande** — One sentence, under 15 words. Descriptive and specific.
Avoid vague titles like "Amélioration du système". Prefer "Ajout de notifications
SMS pour les rappels de séance".

**Explication de la demande** — Describe the feature from the user's perspective.
What would they see, do, or experience? Use bullet points for sub-features.
Include concrete scenarios when the context provides them. Never mention
implementation details (no database columns, no class names, no API routes).

**Pourquoi cette demande est-elle importante?** — Focus on concrete impact:
time saved, errors avoided, revenue protected, user satisfaction improved,
compliance met. Quantify when possible. Connect to business goals, not
technical debt.

**Degré d'urgence** — Infer from context:
- **Faible** — Nice-to-have, no deadline, quality of life improvement
- **Moyen** — Clear value, should be planned in upcoming cycles
- **Élevé** — Blocking a workflow or causing regular friction, needs attention soon
- **Critique** — Compliance risk, revenue loss, or complete workflow breakdown

## Gotchas

- The user may provide context in English — the output must always be in French.
- If the user describes multiple unrelated features, produce one file per feature
  and confirm with the user.
- Keep the "Explication" focused on the what, and the "Pourquoi" focused on the
  why. Do not repeat the same information in both sections.
- When the context is technical (code, logs, errors), translate the underlying
  need into business language. The form reader does not understand code.
