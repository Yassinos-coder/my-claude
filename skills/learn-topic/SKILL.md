---
name: learn-topic
description: >
  Structured learning session that teaches a topic gradually through scaffolded
  exploration — research first, then concept-by-concept teaching with
  comprehension checks, curated articles, teach-it-back, and a final summary
  artifact.
disable-model-invocation: true
---

# Learn Topic

Structured learning session. Start by asking the user what they want to learn
and what they already know about it.

## Phase 1: Prereq Check

Ask:

- "What topic do you want to learn?"
- "What do you already know about it?"
- "Is there a specific angle or use case you care about?"

Use the answers to calibrate depth and starting point. Skip concepts the user
already knows. If the user says "nothing" or "start from scratch," begin at
fundamentals.

## Phase 2: Deep Research

Use the Agent tool with subagents to research the topic thoroughly — this keeps
the main context clean. Launch 2-3 parallel research agents covering different
facets of the topic.

Research should gather:
- Core concepts and their relationships
- Common misconceptions
- Good analogies and mental models
- High-quality articles (look for 2 excellent ones to recommend later)
- Practical examples

**Source quality matters.** Prioritize authoritative sources: official
documentation, reputable technical blogs (e.g. Martin Fowler, Dan Abramov,
engineering blogs from companies like Stripe, Vercel, Netflix), peer-reviewed
content, books by recognized experts, and well-regarded educational platforms.
Avoid random Medium posts, SEO-farm articles, or content without clear
authorship. When recommending articles, verify the author has credibility in
the domain.

Do NOT dump research results into the conversation. Synthesize internally and
use them to teach.

## Phase 3: Gradual Teaching

Teach one concept at a time. For each concept:

1. **Explain simply** — plain language, no jargon without definition
2. **Give a concrete example or analogy** — real-world, relatable. For coding
   topics, use NestJS for backend examples and React for frontend examples
   since that is the user's stack
3. **Check comprehension** — ask one focused question: "Does this make sense?"
   or "Can you see how this connects to X?" or ask them to rephrase

Only move to the next concept after the user confirms understanding. If they're
confused, try a different angle — don't just repeat the same explanation louder.

Build concepts progressively — each one should connect to what came before.
Reference earlier concepts explicitly: "Remember how we said X? This builds
on that."

## Phase 4: Mid-Point Article

After covering roughly half the concepts, recommend one excellent article.

Format:
> I'd recommend reading this article at this point: [title](url)
> It covers [what] from [angle] and will reinforce what we just discussed.
> Read it when you're ready, and we can discuss anything that stood out or
> confused you.

Wait for the user to read and discuss before continuing. Ask what resonated
or what raised questions.

## Phase 5: Continue Teaching

Resume concept-by-concept teaching for the remaining material. Continue the
same pattern: explain → example → comprehension check.

## Phase 6: Teach-It-Back

Before the summary, ask the user to explain the topic back in their own words.
This is the most important comprehension check — it exposes gaps that simple
"does this make sense?" questions miss.

Say something like:
> "Now try explaining <topic> back to me as if I've never heard of it.
> Don't worry about being perfect — I'll fill in any gaps."

Listen for:
- Missing concepts
- Incorrect connections
- Oversimplifications that lose important nuance

Gently correct any gaps, then confirm the corrected understanding.

## Phase 7: Deep-Dive Article

Recommend a second article — this one should go deeper or cover a complementary
angle the teaching didn't fully explore.

Same format as Phase 4. Discuss after the user reads it.

## Phase 8: Skill Creation

Create a **Claude Code skill** so the user can apply what they learned in future
conversations. Use the `/create-skill` skill to build it following all best
practices.

The skill should:

- Be saved to `~/.claude/skills/` (personal, available across all projects)
- Include core concepts, practical patterns, gotchas, and the recommended
  articles as resources
- Have reference files for detailed/API-level content to keep SKILL.md under
  500 lines

Ask the user to confirm the skill name, type (reference or task), and scope
before creating it.

## Gotchas

- Never dump all concepts at once. The whole point is gradual scaffolding.
- Don't move on if the user seems confused — try a different explanation angle.
- Research happens in subagents to keep context clean. Never paste raw research
  into the conversation.
- The teach-it-back step is not optional. It's where real learning gaps surface.
- For coding topics, always use NestJS for backend examples and React for
  frontend examples — that's the user's stack.
- Don't recommend articles you haven't verified exist via web search.
- The summary .md file is the deliverable — don't skip it.
