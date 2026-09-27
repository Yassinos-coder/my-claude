---
name: threat-intelligence-review
description: >
  Scan the current repo's dependencies and infrastructure for known CVEs,
  actively-exploited vulnerabilities (CISA KEV), and high-EPSS-risk issues
  using the cve-mcp MCP server. Use when the user asks to check for CVEs,
  vulnerabilities, zero-days, or run a threat-intelligence / dependency
  security scan on any codebase — including invocations of
  /threat-intelligence-review. Not project-specific.
user-invocable: true
---

# Threat Intelligence Review

Audits the current repo's third-party dependencies against live CVE/advisory
feeds via the `cve-mcp` MCP server (NVD, OSV.dev, GitHub Advisories, CISA
KEV, EPSS). This finds *known, disclosed* vulnerabilities in dependencies —
it is not a source-code SAST scan and cannot find true zero-days
(undisclosed vulnerabilities have no CVE yet).

If the `cve-mcp` tools aren't available, tell the user the MCP server isn't
connected and stop — don't attempt a manual/offline review.

## 1. Discover dependency manifests

Detect the repo's structure before assuming an ecosystem — this skill runs
in any project, not one specific stack. Look for, wherever present:

- **npm/pnpm/yarn**: `package.json` + lockfile (root and any workspace
  packages, e.g. `apps/*`, `packages/*` per `pnpm-workspace.yaml` /
  `package.json#workspaces`). Resolve exact installed versions from the
  lockfile, not just the semver range.
- **Python**: `requirements*.txt`, `pyproject.toml` + `poetry.lock` /
  `uv.lock`.
- **Go**: `go.mod` / `go.sum`.
- **Rust**: `Cargo.toml` / `Cargo.lock`.
- **Containers**: Dockerfile `FROM` base images.

Only scan ecosystems actually present in the repo — don't assume.

## 2. Query cve-mcp

For each ecosystem found, batch packages into
`scan_dependencies(ecosystem, packages)` calls (OSV.dev-backed) rather than
looking up one package at a time. Supplement with `scan_github_advisories`
for anything OSV misses.

For every CVE surfaced:
- `check_kev_status` — is it in CISA's Known Exploited Vulnerabilities
  catalog? Treat any KEV hit as critical regardless of CVSS score.
- `get_epss_score` — probability of real-world exploitation in the next 30
  days; flag anything with a high EPSS score even at moderate CVSS.
- Use `bulk_cve_lookup` to enrich multiple CVE IDs in one call instead of
  looping `lookup_cve` one at a time.
- For anything ambiguous or high-severity, run `triage_cve` (depth="deep")
  to get the composite NVD+EPSS+KEV risk assessment in one shot.

`lookup_ip_reputation` / `shodan_host_lookup` are for live hosts, not source
code — only use them if the user explicitly asks about exposed
infrastructure, not for a routine dependency scan.

## 3. Prioritize and report

Use `prioritize_cves` / `generate_risk_report` to rank findings. Present as:

1. **Actively exploited (KEV)** — fix immediately regardless of CVSS.
2. **Critical/High CVSS + high EPSS** — fix soon.
3. **Critical/High CVSS, low EPSS** — real but lower urgency.
4. **Everything else** — note but don't block on it.

For each finding give: package + installed version, CVE ID, one-line
description, CVSS/EPSS/KEV status, and the patched version to upgrade to.
In a monorepo, group by workspace/package so fixes can be scoped.

Don't upgrade dependencies automatically — report findings and let the user
decide, unless they explicitly ask you to apply the fixes.

## 4. Missing API keys

If `NVD_API_KEY` / `GITHUB_TOKEN` etc. aren't set, the server still works
but on unauthenticated rate limits — batch calls conservatively. Keys live
in `~/.claude/mcp-servers/cve-mcp-server/.env` (copy from `.env.example` in
that directory); mention this to the user for large scans without treating
it as a blocker.
