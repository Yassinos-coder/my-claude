---
name: changelog
description: Write or update a CHANGELOG.md file in the root of the current codebase. Use this skill whenever the user asks to write, update, generate, or create a changelog, release notes, or version history — even if they just say "update the changelog" or "log the changes". This skill handles version detection, git diff analysis, and Keep a Changelog formatting automatically.
---

# Changelog Skill

Generate or update a `CHANGELOG.md` at the root of the project using the [Keep a Changelog](https://keepachangelog.com) format, with auto-detected version bumping and `package.json` sync.

## Step 1 — Gather git changes

First, check for uncommitted changes (both staged and unstaged):

```bash
git diff HEAD
```

If that returns nothing meaningful (no relevant changes), fall back to the last 10 commits:

```bash
git log --oneline -10
git diff HEAD~10 HEAD
```

Use whichever source has content. If both are empty, tell the user there's nothing to log and stop.

## Step 2 — Detect current version

Look for a version in this order:
1. `package.json` → `version` field
2. `pyproject.toml` → `[project] version` or `[tool.poetry] version`
3. `Cargo.toml` → `[package] version`
4. Existing `CHANGELOG.md` → extract the latest `## [x.y.z]` heading

If no version is found anywhere, start at `0.1.0`.

## Step 3 — Determine the version bump

Analyze the changes and apply semver rules:

| Change type | Bump |
|---|---|
| Breaking change, API removal, major refactor | **major** (x.0.0) |
| New feature, new endpoint, new config option | **minor** (0.x.0) |
| Bug fix, typo, dependency update, small tweak | **patch** (0.0.x) |

When in doubt, lean toward **patch**. If the diff clearly contains multiple bump levels, use the highest one.

## Step 4 — Categorize changes

Group the changes into Keep a Changelog categories. Only include sections that have entries — don't output empty sections.

- **Added** — new features, new files, new commands
- **Changed** — modifications to existing behavior
- **Fixed** — bug fixes
- **Removed** — deleted features, files, or options
- **Security** — vulnerability patches
- **Deprecated** — soon-to-be-removed features

Write entries as concise bullet points. Focus on *what changed and why it matters*, not on file names or implementation details. Good: `Added dark mode toggle to user settings`. Bad: `Modified UserSettings.tsx line 42`.

## Step 5 — Write the changelog entry

Use this exact format:

```markdown
## [NEW_VERSION] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

Today's date goes on the new entry.

## Step 6 — Update CHANGELOG.md

- If `CHANGELOG.md` exists at the project root: insert the new entry **after** the `# Changelog` heading (or the first line) and **before** the previous most-recent entry.
- If it doesn't exist: create it with this header first, then the entry:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [NEW_VERSION] - YYYY-MM-DD
...
```

## Step 7 — Update the version source

If `package.json` exists, update the `version` field to the new version. Do the same for `pyproject.toml` or `Cargo.toml` if that's where the version came from.

Do **not** commit anything — just write the files and let the user review.

## Step 8 — Report back

Tell the user:
- What version bump was applied and why (one sentence)
- Which categories had entries
- That `CHANGELOG.md` and the version file have been updated
