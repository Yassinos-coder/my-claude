---
name: push-to-ec2
description: Deploy the current project to the EC2 server by SSHing in, pulling the latest git changes, and restarting whatever services are running (Docker Compose, Docker, systemd, PM2, etc.). Use this skill whenever the user says "push to server", "deploy", "update EC2", "sync to server", "push live", "release", "ship it", or any variation of deploying or updating the remote server. Also handles first-time discovery of the deployment layout by probing the EC2 instance and saving instructions for next time.
---

# Push to EC2

## SSH credentials

```
ssh -F NUL -i "C:\Users\castr\my-moodle-ec2-key.pem" -o IdentitiesOnly=yes ec2-user@51.44.61.246
```

On Windows (Git Bash / WSL), the key path maps to `/c/Users/castr/my-moodle-ec2-key.pem`.

---

## Step 1 — Read or discover deployment config

Check if `PUSH_INSTRUCTIONS.md` exists in the current project root.

**If it exists:** read it now. It contains the remote project path and the exact restart command. Skip the discovery section below and go straight to Step 2.

**If it does not exist (first run):**

Probe the EC2 instance to find where this project lives:

```bash
ssh -F NUL -i /c/Users/castr/my-moodle-ec2-key.pem -o IdentitiesOnly=yes ec2-user@51.44.61.246 \
  "find /home/ec2-user /var/www /opt /srv /app -maxdepth 5 -name '.git' -type d 2>/dev/null | head -30"
```

Match the result to the current project by comparing the git remote URL or the directory/project name. Then detect what service runner is in use by checking for these files in the remote project root:

| File present | Service type |
|---|---|
| `docker-compose.yml` or `docker-compose.yaml` | Docker Compose |
| `Dockerfile` only | Bare Docker |
| `/etc/systemd/system/*.service` referencing this dir | systemd |
| `ecosystem.config.js` or `pm2` in `package.json` | PM2 |

Once you have the path and service type, create `PUSH_INSTRUCTIONS.md` in the local project root (see format below), then add it to `.gitignore`.

---

## Step 2 — Push local changes to git (if applicable)

If the project has a git remote and there are uncommitted or unpushed changes, push them now so the server can pull them:

```bash
git status
git add -A
git commit -m "<brief description of what changed>"
git push
```

Ask the user for a commit message if it's not obvious from context. Skip this step if:
- The user says not to commit/push
- The working tree is already clean and up-to-date with the remote

---

## Step 3 — SSH in and deploy

Run the pull and restart in a single SSH session:

```bash
ssh -F NUL -i /c/Users/castr/my-moodle-ec2-key.pem -o IdentitiesOnly=yes ec2-user@51.44.61.246 "
  set -e
  cd <remote-project-path>
  git pull
  <restart-command>
"
```

Use the restart command that matches the detected service type:

| Service type | Restart command |
|---|---|
| Docker Compose | `docker compose pull && docker compose up -d --build` |
| Docker Compose (older) | `docker-compose pull && docker-compose up -d --build` |
| Bare Docker | `docker build -t <image-name> . && docker restart <container-name>` |
| systemd | `sudo systemctl restart <service-name>` |
| PM2 | `pm2 reload ecosystem.config.js` or `pm2 restart all` |

If there's a build step (e.g. `npm run build`, `composer install`, `pip install -r requirements.txt`), run it between `git pull` and the restart command. Look for hints in `PUSH_INSTRUCTIONS.md` or the project's README/Makefile.

---

## Step 4 — Verify

After restart, confirm the services came up:

```bash
ssh -F NUL -i /c/Users/castr/my-moodle-ec2-key.pem -o IdentitiesOnly=yes ec2-user@51.44.61.246 "
  cd <remote-project-path>
  <status-command>
"
```

| Service type | Status command |
|---|---|
| Docker Compose | `docker compose ps` |
| systemd | `sudo systemctl status <service-name> --no-pager` |
| PM2 | `pm2 status` |

Report what you see — running containers/processes, any errors — concisely to the user.

---

## PUSH_INSTRUCTIONS.md format

Create this file on first run. It is the persistent record of this project's deployment config so you don't have to re-discover it next time.

```markdown
# EC2 Push Instructions

**Remote path:** /home/ec2-user/<project-name>
**Service type:** docker-compose | docker | systemd | pm2
**Restart command:** <exact command, copy-pasteable>
**Build step:** <npm run build / composer install / none>

## Manual deploy (if the skill isn't available)

```bash
ssh -F NUL -i "C:\Users\castr\my-moodle-ec2-key.pem" -o IdentitiesOnly=yes ec2-user@51.44.61.246
cd /home/ec2-user/<project-name>
git pull
<build-step-if-any>
<restart-command>
```

_This file is git-ignored. It contains machine-specific deployment config for the push-to-ec2 skill._
```

After writing it, add to `.gitignore`:

```bash
echo "PUSH_INSTRUCTIONS.md" >> .gitignore
```

---

## Edge cases

- **Project not found on EC2:** Tell the user the repo wasn't found, list the git dirs that were found, and ask how to proceed (maybe they need to clone it first).
- **SSH key missing:** Alert if `/c/Users/castr/my-moodle-ec2-key.pem` is not found. The key must not have broad permissions — if SSH complains, remind the user to run `chmod 400` on the key (or on WSL, use a copy stored there).
- **Git pull fails (conflicts):** Surface the error, ask the user whether to stash remote changes or reset to the pushed branch.
- **Service restart fails:** Print the error output in full so the user can diagnose (logs, config issues, port conflicts).
- **No git remote:** Skip Step 2 entirely — just SSH in and trigger whatever manual deploy mechanism is in `PUSH_INSTRUCTIONS.md`.
