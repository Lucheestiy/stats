# stats.lucheestiy.com

Static dashboard that publishes CodexBar CLI output (`codexbar`) on `https://stats.lucheestiy.com`.

## Components
- **Docker (local machine):** `stats-nginx` container serves `/home/mlweb/stats.lucheestiy.com/public` on `:8117`.
- **Updater (local machine):** systemd timer runs `bin/update-stats` every ~5 minutes.
- **Reverse proxy (droplet 97.107.142.128):** nginx + Let’s Encrypt proxies `stats.lucheestiy.com` → `100.93.127.52:8117` (Tailscale).

## Local paths
- Web root: `/home/mlweb/stats.lucheestiy.com/public`
- Generated JSON: `/home/mlweb/stats.lucheestiy.com/public/data/latest.json`
- Updater script: `/home/mlweb/stats.lucheestiy.com/bin/update-stats`
- CodexBar config (root): `/root/.codexbar/config.json`

## Common commands (local machine)
- Start/stop site:
  - `cd /home/mlweb/stats.lucheestiy.com && docker compose up -d`
  - `cd /home/mlweb/stats.lucheestiy.com && docker compose down`
- Force refresh now:
  - `systemctl start codexbar-stats.service`
  - or run directly: `/home/mlweb/stats.lucheestiy.com/bin/update-stats`
- View updater logs:
  - `journalctl -u codexbar-stats.service -n 200 --no-pager`
- Check timer schedule:
  - `systemctl list-timers --all | rg codexbar-stats`

## Droplet routing
- Config: `/etc/nginx/sites-enabled/stats.lucheestiy.com`
- Cert: `/etc/letsencrypt/live/stats.lucheestiy.com/`

## Troubleshooting
- If the domain works but shows stale data:
  - Check timer: `systemctl status codexbar-stats.timer`
  - Check last run file: `cat /home/mlweb/stats.lucheestiy.com/public/data/last-run.json`
- If droplet returns 502:
  - Verify local container is listening: `curl -fsSI http://127.0.0.1:8117/ | head`
  - Verify Tailscale connectivity from droplet: `ssh droplet 'curl -fsSI http://100.93.127.52:8117/ | head'`

## Notes
- Usage providers currently included: Codex, Claude, Gemini.
- Codex usage is collected for **all `codex-auth` profiles** found under `/root/.codex/accounts/*.json` and each Codex entry includes `codexAuthAccount`.
- This install is currently limited to: `tmr,pr,rk,kr` (configured via `CODEX_AUTH_ACCOUNTS` in `/etc/systemd/system/codexbar-stats.service`).
- Emails (`accountEmail`) are stripped before publishing `data/latest.json` and the UI shows Codex profile names instead.
- `codexbar cost` only supports Codex + Claude (Gemini cost is not available via CodexBar).
- Cost is **not separable per `codex-auth` profile** with CodexBar today; it’s computed by scanning local logs and does not carry per-profile/account attribution, so the Codex cost numbers are shared/aggregated.
