# SSH to a Remote Server

Connect to any remote server using the appropriate authentication method. The user will provide a server nickname or connection details.

## Known Servers

| Nickname | User | Host | Auth Method | Key / Notes |
|----------|------|------|-------------|-------------|
| ec2 | ec2-user | 51.44.61.246 | PEM key | `C:/Users/castr/my-moodle-ec2-key.pem` |

---

## Instructions

When the user invokes `/ssh [target] [optional command]`:

1. **Look up the nickname** in the Known Servers table above. If found, use those details directly.

2. **If not found**, ask the user for:
   - Host / IP
   - Username
   - Auth method: `key` (PEM/id_rsa), `password`, `agent`, or `default` (~/.ssh/id_rsa)

3. **Build the correct SSH command** based on auth method:

   ### Key-based (PEM or private key)
   ```bash
   ssh -i "<path-to-key>" <user>@<host> "<optional command>"
   ```

   ### Password-based
   Use `sshpass` if available:
   ```bash
   sshpass -p '<password>' ssh <user>@<host> "<optional command>"
   ```
   Or prompt the user to run manually if `sshpass` is not installed.

   ### Default key (~/.ssh/id_rsa or ssh-agent)
   ```bash
   ssh <user>@<host> "<optional command>"
   ```

   ### Jump host / bastion
   ```bash
   ssh -J <bastion-user>@<bastion-host> <user>@<host> "<optional command>"
   ```

4. **Run the command** using the Bash tool.

5. **If the user gives a command to run** (e.g. `/ssh ec2 df -h`), append it as the remote command. Otherwise open an interactive-style one-liner (e.g. check uptime or disk).

6. **If the connection fails**, diagnose:
   - Permission denied → wrong key or user
   - Connection refused → wrong port or firewall
   - Timeout → wrong IP or security group
   Report the likely cause to the user.

## Adding a New Server

If the user says "remember this server" or "save this server", add a new row to the Known Servers table in this file using the Write or Edit tool, so it persists for future sessions.

## Example invocations

- `/ssh ec2` — connects to the EC2 Moodle server
- `/ssh ec2 df -h` — runs `df -h` on the EC2 server
- `/ssh myserver` — looks up nickname, or asks for details if unknown
- `/ssh root@192.168.1.10 key ~/.ssh/id_rsa` — explicit connection
