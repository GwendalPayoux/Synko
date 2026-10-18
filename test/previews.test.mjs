import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
test('Aperçus : octets, signatures, version liée au document et droits inchangés', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'synko-preview-')),
    app = createApp({ directory: dir });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}/api`,
    origin = 'http://localhost:5173';
  const send = (p, data, cookie) =>
    fetch(base + p, {
      method: 'POST',
      headers: { origin, ...(cookie ? { cookie } : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  try {
    const signup = await send('/auth/register', {
      name: 'Test',
      email: 'preview@test.fr',
      organization: 'Preview',
      password: 'preview-password-123!',
    });
    const cookie = signup.headers.get('set-cookie').split(';')[0];
    const project = await (
      await send(
        '/projects',
        { name: 'Prévisualisation', start_date: '2026-10-01', end_date: '2026-11-01' },
        cookie,
      )
    ).json();
    const upload = async (name, bytes) => {
      const r = await fetch(base + `/projects/${project.id}/documents?name=${name}`, {
        method: 'POST',
        headers: { origin, cookie },
        body: bytes,
      });
      assert.equal(r.status, 201);
      return (await r.json()).id;
    };
    const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',
        'base64',
      ),
      id = await upload('pixel.png', png),
      path = `/projects/${project.id}/documents/${id}/preview?format=raw`;
    const res = await fetch(base + path, { headers: { cookie } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(res.headers.get('content-security-policy'), /sandbox/);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), png);
    assert.equal((await fetch(base + path)).status, 401);
    const bad = await upload('faux.png', Buffer.from('<html>untrusted</html>'));
    assert.equal(
      (
        await fetch(base + `/projects/${project.id}/documents/${bad}/preview?format=raw`, {
          headers: { cookie },
        })
      ).status,
      422,
    );
    assert.equal(
      (await fetch(base + path + '&version_id=absent', { headers: { cookie } })).status,
      404,
    );
    const other = await send('/auth/register', {
      name: 'Autre',
      email: 'autre@preview.fr',
      organization: 'Autre',
      password: 'preview-password-123!',
    });
    assert.equal(
      (
        await fetch(base + path, {
          headers: { cookie: other.headers.get('set-cookie').split(';')[0] },
        })
      ).status,
      404,
    );
  } finally {
    await new Promise((r) => app.server.close(r));
    app.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
