# SABnzbd Integration Plan

## Context

GitHub issue #1 requests Usenet/NZB download client support. Currently Gamearr only supports qBittorrent (torrents). Prowlarr already returns both torrent and usenet results (the `ProwlarrRelease.protocol` field exists) but Gamearr drops this field during mapping and routes everything to qBittorrent.

**Goal:** Add SABnzbd as a second download client. Both clients run simultaneously — torrent releases route to qBittorrent, usenet releases route to SABnzbd. The Activity page gets separate tabs per client.

---

## Step 1: Carry `protocol` through the data pipeline

The `protocol` field exists on `ProwlarrRelease` but is dropped when mapping to `ReleaseSearchResult`. Thread it through the full pipeline.

**Files to modify:**
- `src/server/integrations/prowlarr/types.ts` — Add `protocol?: 'torrent' | 'usenet'` to `ReleaseSearchResult`
- `src/server/integrations/prowlarr/ProwlarrClient.ts` — Preserve `protocol` in `mapToSearchResult()`
- `src/server/services/IndexerService.ts` — `ScoredRelease` inherits `protocol` via `ReleaseSearchResult`; no changes needed unless scoring differs for usenet (it shouldn't)
- `src/server/routes/search.ts` — Add `protocol` to `grabReleaseSchema` and pass through to `scoredRelease`
- `src/web/src/api/client.ts` — Add `protocol` to `ReleaseData` interface

**DB schema change:**
- `src/server/db/schema.ts` — Add `protocol` column to `releases` table: `protocol: text('protocol').default('torrent')`
- Add `downloadClient` column to `releases` table: `downloadClient: text('download_client')` (stores `'qbittorrent'` or `'sabnzbd'`)
- Add `downloadId` column alongside existing `torrentHash` — stores torrent hash for qBit, nzo_id for SABnzbd. Keep `torrentHash` for backwards compat.

Run `bun run db:push` after schema changes.

---

## Step 2: Create SABnzbd integration client

**New files:**
- `src/server/integrations/sabnzbd/SabnzbdClient.ts`
- `src/server/integrations/sabnzbd/types.ts`

### types.ts
```typescript
interface SabnzbdConfig {
  host: string;    // e.g. http://localhost:8080
  apiKey: string;
}

interface SabnzbdQueueSlot {
  nzo_id: string;
  filename: string;
  status: string;      // Downloading, Queued, Paused, Fetching
  percentage: number;   // 0-100
  mb: string;
  mbleft: string;
  sizeleft: string;
  timeleft: string;
  cat: string;
  priority: string;
}

interface SabnzbdHistorySlot {
  nzo_id: string;
  name: string;
  status: string;       // Completed, Failed
  category: string;
  storage: string;      // Final path
  bytes: number;
  completed: number;    // Unix timestamp
}

interface SabnzbdAddResult {
  status: boolean;
  nzo_ids: string[];
}

// Normalized type matching TorrentInfo pattern
interface NzbDownloadInfo {
  id: string;           // nzo_id
  name: string;
  size: number;
  progress: number;     // 0-1 (normalized from 0-100)
  downloadSpeed: number;
  eta: string;
  status: string;
  category: string;
  addedOn?: Date;
  completionOn?: Date;
  client: 'sabnzbd';
}
```

### SabnzbdClient.ts
Follow the `QBittorrentClient` pattern:
- Constructor accepts `SabnzbdConfig` or reads from env `SABNZBD_HOST`, `SABNZBD_API_KEY`
- `configure(config)` / `isConfigured()` — same pattern as qBittorrent
- `private request<T>(mode, params)` — builds URL: `{host}/sabnzbd/api?output=json&apikey={key}&mode={mode}&{params}`
- Rate limiter: 10 req/sec (reuse existing `RateLimiter` class)

**Public methods:**
| Method | SABnzbd API | Notes |
|--------|-------------|-------|
| `testConnection()` | `mode=version` | Returns true/false |
| `addNzb(url, options?)` | `mode=addurl&name={url}&cat={cat}` | Returns `nzo_id` from response |
| `getQueue()` | `mode=queue&output=json` | Returns `NzbDownloadInfo[]` |
| `getHistory(limit?)` | `mode=history&output=json&limit={n}` | Returns `NzbDownloadInfo[]` |
| `pauseDownload(nzoId)` | `mode=queue&name=pause&value={nzoId}` | |
| `resumeDownload(nzoId)` | `mode=queue&name=resume&value={nzoId}` | |
| `deleteDownload(nzoId, deleteFiles?)` | `mode=queue&name=delete&value={nzoId}&del_files={1\|0}` | |
| `getCategories()` | `mode=get_cats` | Returns string[] |

Export singleton: `export const sabnzbdClient = new SabnzbdClient()`

---

## Step 3: Add SABnzbd settings

**Files to modify:**
- `src/server/services/SettingsService.ts`
  - Add to `SETTINGS_KEYS`: `SABNZBD_HOST`, `SABNZBD_API_KEY`, `SABNZBD_CATEGORY`
  - Add to `ENV_VAR_FALLBACKS`: `sabnzbd_host: 'SABNZBD_HOST'`, `sabnzbd_api_key: 'SABNZBD_API_KEY'`
  - Add typed getters: `getSabnzbdCategory()` (default: `'gamearr'`)

- `src/server/routes/settings.ts`
  - Add `'sabnzbd_host'`, `'sabnzbd_api_key'`, `'sabnzbd_category'` to `ALLOWED_SETTINGS`

- `src/server/index.ts`
  - In `initializeClients()`: load SABnzbd settings and call `sabnzbdClient.configure()`

- `.env.example`
  - Add `SABNZBD_HOST=`, `SABNZBD_API_KEY=`

---

## Step 4: Route downloads to correct client in DownloadService

**File:** `src/server/services/DownloadService.ts`

### Modify `grabRelease()`
Current flow: always sends to qBittorrent. New flow:

```
1. Determine protocol from release.protocol (default: 'torrent')
2. If protocol === 'usenet' && sabnzbdClient.isConfigured():
     → Send to SABnzbd via sabnzbdClient.addNzb()
     → Store nzo_id as downloadId on release
     → Store downloadClient = 'sabnzbd'
3. If protocol === 'torrent' && qbittorrentClient.isConfigured():
     → Send to qBittorrent (existing flow)
     → Store downloadClient = 'qbittorrent'
4. If neither client is configured for the protocol → throw NotConfiguredError
```

The `isConfigured()` check at the top of `grabRelease()` changes from just checking qBittorrent to checking the appropriate client based on protocol.

### Modify `syncDownloadStatus()`
Currently only syncs from qBittorrent. Split into two sync paths:

```
1. Sync torrent releases (existing logic, unchanged)
   - Get torrents from qBittorrent
   - Match against releases where downloadClient = 'qbittorrent' OR downloadClient IS NULL (backwards compat)

2. Sync usenet releases (new)
   - Get queue + history from SABnzbd
   - Match against releases where downloadClient = 'sabnzbd'
   - Match by stored downloadId (nzo_id) — simpler than torrent matching
   - Map SABnzbd status to release status:
     - Queue: Downloading/Queued → 'downloading'
     - Queue: Paused → 'downloading' (still active)
     - History: Completed → 'completed'
     - History: Failed → 'failed'
```

### Modify `getActiveDownloads()`
Since the Activity page will have separate tabs:
- Add `getActiveUsenetDownloads(includeCompleted?)` method
- Existing `getActiveDownloads()` stays for torrents

### Modify pause/resume/cancel methods
Determine the client from the release record's `downloadClient` field:
- `pauseDownload(id, client)` — route to correct client
- `resumeDownload(id, client)` — route to correct client
- `cancelDownload(id, client, deleteFiles)` — route to correct client

---

## Step 5: Update DownloadMonitor

**File:** `src/server/jobs/DownloadMonitor.ts`

The `sync()` method calls `downloadService.syncDownloadStatus()` which will now handle both clients internally. Minimal changes needed here — just ensure error handling covers both client connections:

- Track connection state separately for each client
- Log "SABnzbd offline" / "qBittorrent offline" independently
- Don't fail the entire sync if one client is down

---

## Step 6: Update routes

**File:** `src/server/routes/downloads.ts`

- Add `GET /api/v1/downloads/usenet` — returns SABnzbd downloads
- Add `GET /api/v1/downloads/test-sabnzbd` — test SABnzbd connection (follows qBit pattern)
- Modify `DELETE /api/v1/downloads/:id` — accept client type in query param or determine from release record
- Modify pause/resume endpoints similarly

**File:** `src/server/routes/search.ts`
- The grab endpoint already passes `protocol` through (from Step 1)
- Add logic: when protocol is usenet, prefer `downloadUrl` directly (no magnet URL preference)

---

## Step 7: Frontend — Settings UI

**File:** `src/web/src/components/settings/DownloadsTab.tsx`

Add a SABnzbd settings section below the qBittorrent section, following the exact same UI pattern:
- Host input field
- API Key input field
- Save button + Test Connection button
- Connection test result display

**File:** `src/web/src/pages/Settings.tsx`
- Add SABnzbd state variables (`sabHost`, `sabApiKey`) alongside existing qBit state
- Load SABnzbd settings on mount
- Pass to DownloadsTab as props

**File:** `src/web/src/api/client.ts`
- Add `testSabnzbdConnection()` method

---

## Step 8: Frontend — Activity page tabs

**File:** `src/web/src/pages/Activity.tsx` (or equivalent)

Add tab navigation:
- **Torrents** tab — existing qBittorrent download list (default)
- **Usenet** tab — new SABnzbd download list

Each tab fetches from its respective endpoint (`/api/v1/downloads` vs `/api/v1/downloads/usenet`). The download item component should be shared but display SABnzbd-relevant info (no seeders, different status labels).

---

## Step 9: Frontend — Search results protocol indicator

**File:** `src/web/src/components/SearchResults.tsx` (or equivalent release list component)

- Show a small badge on each search result indicating protocol (torrent/usenet)
- When grabbing a usenet release, pass `protocol: 'usenet'` in the API call
- Disable grab button if the required client isn't configured (show tooltip explaining why)

---

## Implementation Order

1. **Step 1** — Protocol pipeline (foundation, everything depends on this)
2. **Step 2** — SABnzbd client (can test independently)
3. **Step 3** — Settings (enables configuration)
4. **Step 4** — DownloadService routing (core logic)
5. **Step 5** — DownloadMonitor (enables status tracking)
6. **Step 6** — Routes (enables API access)
7. **Step 7** — Settings UI (enables user configuration)
8. **Step 8** — Activity tabs (shows usenet downloads)
9. **Step 9** — Search results badges (polish)

---

## Key Files Summary

| File | Action |
|------|--------|
| `src/server/integrations/sabnzbd/SabnzbdClient.ts` | **CREATE** |
| `src/server/integrations/sabnzbd/types.ts` | **CREATE** |
| `src/server/integrations/prowlarr/types.ts` | Modify (add protocol to ReleaseSearchResult) |
| `src/server/integrations/prowlarr/ProwlarrClient.ts` | Modify (preserve protocol in mapping) |
| `src/server/db/schema.ts` | Modify (add protocol, downloadClient, downloadId to releases) |
| `src/server/services/DownloadService.ts` | Modify (protocol routing, SABnzbd sync) |
| `src/server/services/SettingsService.ts` | Modify (SABnzbd settings keys) |
| `src/server/services/IndexerService.ts` | Minimal (protocol flows through types) |
| `src/server/jobs/DownloadMonitor.ts` | Modify (dual-client error handling) |
| `src/server/routes/downloads.ts` | Modify (new endpoints) |
| `src/server/routes/search.ts` | Modify (protocol in grab schema) |
| `src/server/routes/settings.ts` | Modify (allow SABnzbd settings) |
| `src/server/index.ts` | Modify (initialize SABnzbd client) |
| `src/web/src/components/settings/DownloadsTab.tsx` | Modify (SABnzbd section) |
| `src/web/src/pages/Settings.tsx` | Modify (SABnzbd state) |
| `src/web/src/pages/Activity.tsx` | Modify (tabs) |
| `src/web/src/api/client.ts` | Modify (SABnzbd API methods) |
| `.env.example` | Modify (SABnzbd vars) |

---

## Verification

1. **Settings:** Configure SABnzbd host + API key in Settings UI, test connection button returns success
2. **Search:** Search for a game via Prowlarr with usenet indexers enabled — results show protocol badges, usenet results are grabbable
3. **Grab:** Grab a usenet release — appears in SABnzbd queue with correct category
4. **Monitor:** Download progresses in Activity > Usenet tab, completes and marks game as downloaded
5. **Backwards compat:** Existing torrent downloads still work identically, no migration needed for existing data
6. **Both clients down:** Each client's connection errors are logged independently, one failing doesn't break the other
