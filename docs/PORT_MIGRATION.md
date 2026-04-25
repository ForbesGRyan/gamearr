# Port Migration: 7878 → 8484

**Affected versions:** upgrades from `v0.1.14` (or earlier) to `v0.1.15` (or later).

**TL;DR:** Gamearr's default HTTP port changed from `7878` to `8484` to avoid colliding with Radarr on systems that run both. If you do nothing, Gamearr will now listen on `8484`. Bookmarks, reverse proxies, and any callback URLs that referenced `7878` must be updated — or you can opt out of the change by setting `PORT=7878`.

---

## Why the change

`7878` is Radarr's default port. A growing number of Gamearr users self-host the full *arr stack alongside Gamearr, and a first-run port collision with Radarr is a bad default. Nothing about Gamearr requires `7878` — it's purely a cosmetic default.

Port `8484` was chosen because:

- It does not collide with any default port in the *arr ecosystem:

  | App      | Default port |
  | -------- | ------------ |
  | Radarr   | 7878         |
  | Sonarr   | 8989         |
  | Lidarr   | 8686         |
  | Readarr  | 8787         |
  | Prowlarr | 9696         |
  | Bazarr   | 6767         |
  | Whisparr | 6969         |
  | **Gamearr** | **8484**   |

- It is unassigned by IANA, so no well-known protocol claims it.
- It is easy to remember (symmetric, adjacent to Readarr's `8787`).

A small number of unrelated tools use `8484` occasionally (e.g. Acronis Agent, some Tomcat management setups). Home-lab users running those tools alongside Gamearr can override with the `PORT` environment variable.

---

## What actually changed

Every default reference to `7878` in the repo now resolves to `8484`:

- **Runtime default** — `src/server/index.ts` falls back to `8484` when `PORT` is unset.
- **`.env.example`** — ships `PORT=8484` plus a comment explaining the migration.
- **Dockerfile** — `ENV PORT=8484`, `EXPOSE 8484`, and the healthcheck URL.
- **`docker-compose.yml`** and **`docker-compose copy.yml`** — host/container port mappings and the `PORT` env var.
- **Documentation** — `README.md`, `docs/SETUP.md`, `docs/PRODUCT_PLAN.md`, `CLAUDE.md`, `docs/CLAUDE.md`.
- **Dev tooling** — Vite dev server proxy (`src/web/vite.config.ts`), Playwright base URL (`playwright.config.ts`), and e2e setup script (`e2e/setup.spec.ts`).

No code logic, API contract, or on-disk data format changed — only the default listener port.

---

## Upgrade guide

### If you accept the new default

After upgrading, Gamearr will listen on `8484`. Update anything that pointed at `7878`:

1. **Browser bookmarks** — change `http://<host>:7878` → `http://<host>:8484`.
2. **Docker / docker-compose** — if you pinned a host port (e.g. `- 7878:7878`), update to `- 8484:8484`, or map to whatever host port you prefer (e.g. `- 7878:8484` keeps the old external URL).
3. **Reverse proxy** (Nginx / Traefik / Caddy) — update the upstream `proxy_pass`, `loadbalancer.server.port`, or equivalent to `8484`.
4. **External integrations** — Discord webhooks, cross-service callbacks, or anything else that stores a Gamearr URL.
5. **Firewall rules** — open `8484`, close `7878` if nothing else needs it.

### If you want to keep using 7878

Gamearr still honors the `PORT` environment variable. Set it explicitly and nothing changes for you:

**`.env`:**
```
PORT=7878
```

**docker-compose.yml:**
```yaml
environment:
  - PORT=7878
ports:
  - "7878:7878"
```

**systemd / shell:**
```bash
PORT=7878 ./gamearr
```

This is the lowest-friction path if you were never going to run Radarr on the same box.

### If you run Gamearr behind a reverse proxy

The internal container port is what matters. You can keep the external URL identical by remapping:

```yaml
ports:
  - "7878:8484"   # host:container — users still hit :7878, container listens on :8484
```

Or standardize on `8484` end-to-end and update proxy config.

---

## Verification

After upgrading, confirm the new port is live:

```bash
curl http://localhost:8484/api/v1/system/status
```

The Docker healthcheck uses `${PORT:-8484}` and will automatically follow whatever port is configured.

---

## Rollback

This is a single-value configuration change. To revert, set `PORT=7878` in your environment — no data migration, no schema change, no rebuild required.
