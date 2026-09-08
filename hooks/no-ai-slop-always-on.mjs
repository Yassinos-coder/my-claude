import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const skillPath = join(homedir(), ".claude", "skills", "no-ai-slop", "SKILL.md");

function loadRules() {
  try {
    const raw = readFileSync(skillPath, "utf8");
    return raw.replace(/^---[\s\S]*?---\s*/, "").trim();
  } catch {
    return null;
  }
}

const rules = loadRules();

const additionalContext = rules
  ? `The no-ai-slop skill is always on for this session. Apply its editing rules to every response you write, not only when asked to edit a draft: cut AI-slop patterns (binary contrasts, throat-clearing openers, faux-insight setups, colon reveals, importance puffery, weasel attribution, fake-profound kickers, summary-recap endings, banned words like "delve"/"leverage"/"robust", etc.), prefer active voice and concrete specifics, and preserve the user's own voice rather than sounding scrubbed-generic. Full rules:\n\n${rules}`
  : "The no-ai-slop skill is enabled always-on, but its SKILL.md could not be found at " + skillPath + ". Skipping.";

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext,
    },
  }),
);
