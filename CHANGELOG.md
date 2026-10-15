# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-10-15

### Added
- 148 third-party skills from `coreyhaines31/marketingskills`, `wondelai/skills`, `anthropics/skills` and `alexdcd/Mafia-Claude-Skills` (marketing, CRO, SEO, business and engineering frameworks, document and PDF tooling, browser automation, prompt and research tools), reviewed for network calls, credential access, hidden characters and prompt injection before install
- Ignore rules for private keys, `.env` files, certificates and local history so secrets cannot be committed

### Changed
- Removed the auto-approved `npx agent-browser` tool permission from the `agent-browser` skill so its commands prompt before running

### Security
- Removed the old EC2 host address, username and key path from `commands/ssh.md` and `skills/push-to-ec2`, replaced with placeholders (the server no longer exists)

## [0.3.1] - 2026-10-13

### Security

- Stopped tracking `settings.json` and added it to `.gitignore`: its saved permission entries had embedded Supabase API keys, and this repository is public. The keys were rotated.

## [0.3.0] - 2026-10-13

### Added
- `claude-red` skill pack (SnailSploit/claude-red) of offensive-security skills, installed under `skills/claude-red` to audit our own code for vulnerabilities and derive defenses after an application is built

### Changed
- Refreshed synced built-in skills and expanded the settings.json permission allowlist

## [0.2.0] - 2026-09-27

### Added
- `threat-intelligence-review` skill: scans a repo's dependency manifests (npm/pnpm, Python, Go, Rust, Docker) against live CVE/advisory feeds via the `cve-mcp` MCP server (NVD, OSV.dev, GitHub Advisories, CISA KEV, EPSS)
- `cve-mcp` MCP server registered globally in `~/.claude.json`, backed by a local clone of `mukul975/cve-mcp-server` installed under `mcp-servers/` (gitignored — venv + API keys, not versioned)

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
