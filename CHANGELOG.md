# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-08

### Added
- 12 new skills: `find-skills`, `no-ai-slop`, `vercel-composition-patterns`, `vercel-react-best-practices`, `vercel-react-native-skills`, `vercel-react-view-transitions`, `web-design-guidelines`, `writing-guidelines`, `android-cli`, `karpathy-guidelines`, `pabbly-migration`, `r8-analyzer`
- `no-ai-slop-always-on.mjs` SessionStart hook script (not yet wired into `settings.json`)
- `i-have-adhd` plugin registered (marketplace + enabled in `settings.json`, installed under `plugins/cache`)

### Changed
- Restructured `CLAUDE.md`: removed the EC2 server section, added mandatory `validators/` and `interfaces/` folder guidance, added a Resilience & Failure Handling section, added the frontend project folder structure
- Tightened the `changelog` skill: explicit handling for scaffold-default `0.0.0` versions, resolving `[Unreleased]` headings before a release, and made the version-source bump mandatory
- Updated `pine-script-builder` skill to target Pine Script v6 only and added new market-structure indicator references

### Removed
- Stopped tracking `plugins/` in git (marketplace clones and generated plugin state) — it was already listed in `.gitignore` but leftover files from before that rule stayed tracked; they remain on disk, just no longer versioned
