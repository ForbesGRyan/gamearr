// One-off reproduction + regression coverage for qBittorrent login handling.
//   - v5.2.0 / auth-bypass: 204 No Content, empty body  -> success
//   - v4.x success:          200 "Ok."                  -> success
//   - bad credentials:       200 "Fails."               -> rejected
import { QBittorrentClient } from '../src/server/integrations/qbittorrent/QBittorrentClient';

type Case = { name: string; loginStatus: number; loginBody: string | null; expectOk: boolean };

const cases: Case[] = [
  { name: 'v5.2.0 / auth-bypass (204 empty)', loginStatus: 204, loginBody: null, expectOk: true },
  { name: 'v4.x success (200 "Ok.")', loginStatus: 200, loginBody: 'Ok.', expectOk: true },
  { name: 'bad credentials (200 "Fails.")', loginStatus: 200, loginBody: 'Fails.', expectOk: false },
];

let failures = 0;

for (const tc of cases) {
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/api/v2/auth/login') {
        return new Response(tc.loginBody, {
          status: tc.loginStatus,
          headers: { 'set-cookie': 'QBT_SID=abc123; HttpOnly; path=/' },
        });
      }
      if (url.pathname === '/api/v2/app/version') return new Response('v5.2.0', { status: 200 });
      return new Response('Not found', { status: 404 });
    },
  });

  const client = new QBittorrentClient({
    host: `http://localhost:${server.port}`,
    username: 'admin',
    password: 'whatever',
  });

  let gotOk: boolean;
  let detail = '';
  try {
    await client.getVersion();
    gotOk = true;
  } catch (err) {
    gotOk = false;
    detail = err instanceof Error ? err.message : String(err);
  } finally {
    server.stop(true);
  }

  if (gotOk === tc.expectOk) {
    console.log(`PASS: ${tc.name} -> ${gotOk ? 'authenticated' : `rejected (${detail})`}`);
  } else {
    failures++;
    console.error(`FAIL: ${tc.name} -> expected ${tc.expectOk ? 'success' : 'rejection'}, got ${gotOk ? 'success' : `rejection (${detail})`}`);
  }
}

process.exitCode = failures === 0 ? 0 : 1;
