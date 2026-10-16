import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
const origin = 'http://localhost:5173';
test('Parcours API, isolation, rôles, concurrence, documents et persistance', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'synko-api-'));
  let app = createApp({ directory: dir, origin });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  let base = `http://127.0.0.1:${app.server.address().port}`;
  async function request(path, method = 'GET', data, cookie = '', expected = 200, raw = false) {
    const r = await fetch(base + '/api' + path, {
      method,
      headers: {
        origin,
        ...(cookie ? { cookie } : {}),
        ...(data && !raw ? { 'Content-Type': 'application/json' } : {}),
      },
      body: data ? (raw ? data : JSON.stringify(data)) : undefined,
    });
    const result = raw && method === 'GET' ? Buffer.from(await r.arrayBuffer()) : await r.json();
    assert.equal(r.status, expected, JSON.stringify(result));
    return { data: result, cookie: r.headers.get('set-cookie')?.split(';')[0] };
  }
  async function register(email, organization) {
    return (
      await request(
        '/auth/register',
        'POST',
        { name: email.split('@')[0], email, password: 'A-long-secret-123!', organization },
        '',
        201,
      )
    ).cookie;
  }
  const projectData = {
    name: 'Projet réellement persistant',
    description: 'Test',
    start_date: '2026-10-01',
    end_date: '2026-12-01',
    budget_cents: 250000,
  };
  try {
    await request('/projects', 'GET', undefined, '', 401);
    const a = await register('admin@alpha.fr', 'Alpha'),
      b = await register('admin@beta.fr', 'Beta');
    const me = (await request('/me', 'GET', undefined, a)).data;
    const pid = (await request('/projects', 'POST', projectData, a, 201)).data.id;
    await request(`/projects/${pid}`, 'GET', undefined, b, 404);
    assert.equal((await request('/projects', 'GET', undefined, b)).data.length, 0);
    const injection = "'; DROP TABLE projects; --";
    const task = {
      title: injection,
      start_date: '2026-10-02',
      end_date: '2026-10-04',
      assignee_id: me.id,
      priority: 'high',
    };
    const tid = (await request(`/projects/${pid}/tasks`, 'POST', task, a, 201)).data.id;
    await request(`/projects/${pid}/tasks`, 'POST', { ...task, end_date: '2026-02-31' }, a, 422);
    const rows = (await request(`/projects/${pid}/tasks`, 'GET', undefined, a)).data;
    assert.equal(rows[0].title, injection);
    await request(`/projects/${pid}/tasks/${tid}`, 'PATCH', { status: 'done', revision: 1 }, a);
    await request(
      `/projects/${pid}/tasks/${tid}`,
      'PATCH',
      { status: 'doing', revision: 1 },
      a,
      409,
    );
    assert.equal((await request('/tasks', 'GET', undefined, a)).data[0].progress, 100);
    const inv = (
      await request(
        '/invitations',
        'POST',
        { email: 'worker@alpha.fr', role: 'contributor' },
        a,
        201,
      )
    ).data;
    const token = new URL(inv.url).searchParams.get('invitation');
    const worker = (
      await request(
        '/auth/accept',
        'POST',
        { name: 'Worker', email: 'worker@alpha.fr', password: 'A-long-secret-123!', token },
        '',
        201,
      )
    ).cookie;
    await request(`/projects/${pid}`, 'GET', undefined, worker, 404);
    const workerId = (await request('/me', 'GET', undefined, worker)).data.id;
    await request(`/projects/${pid}/members`, 'POST', { user_id: workerId }, a, 201);
    await request('/projects', 'POST', projectData, worker, 403);
    await request(
      `/projects/${pid}/tasks/${tid}`,
      'PATCH',
      { status: 'doing', revision: 2 },
      worker,
      403,
    );
    await request(
      `/projects/${pid}/tasks/${tid}`,
      'PATCH',
      { assignee_id: workerId, revision: 2 },
      a,
    );
    await request(
      `/projects/${pid}/tasks/${tid}`,
      'PATCH',
      { title: 'Escalade', revision: 3 },
      worker,
      403,
    );
    await request(
      `/projects/${pid}/tasks/${tid}`,
      'PATCH',
      { status: 'review', progress: 80, revision: 3 },
      worker,
    );
    const doc = (
      await request(
        `/projects/${pid}/documents?name=livrable.txt`,
        'POST',
        Buffer.from('Version initiale'),
        a,
        201,
        true,
      )
    ).data.id;
    await request(
      `/projects/${pid}/documents/${doc}/versions`,
      'POST',
      Buffer.from('Version deux'),
      a,
      201,
      true,
    );
    const versions = (
      await request(`/projects/${pid}/documents/${doc}/versions`, 'GET', undefined, a)
    ).data;
    assert.equal(versions.length, 2);
    assert.equal(versions[0].version, 2);
    const file = (
      await request(
        `/projects/${pid}/documents/${doc}/versions/${versions[1].id}`,
        'GET',
        undefined,
        a,
        200,
        true,
      )
    ).data;
    assert.equal(file.toString(), 'Version initiale');
    await request(
      `/projects/${pid}/documents/${doc}/versions/${versions[0].id}`,
      'GET',
      undefined,
      b,
      404,
    );
    const readerInvite = (
      await request('/invitations', 'POST', { email: 'reader@alpha.fr', role: 'reader' }, a, 201)
    ).data;
    const reader = (
      await request(
        '/auth/accept',
        'POST',
        {
          name: 'Reader',
          email: 'reader@alpha.fr',
          password: 'A-long-secret-123!',
          token: new URL(readerInvite.url).searchParams.get('invitation'),
        },
        '',
        201,
      )
    ).cookie;
    const rid = (await request('/me', 'GET', undefined, reader)).data.id;
    const directory = (await request('/members', 'GET', undefined, reader)).data;
    assert.equal(directory.length, 1);
    assert.equal(directory[0].id, rid);
    await request(`/projects/${pid}/members`, 'POST', { user_id: rid }, a, 201);
    await request(
      `/projects/${pid}/tasks/${tid}`,
      'PATCH',
      { status: 'done', revision: 4 },
      reader,
      403,
    );
    await request(
      `/projects/${pid}/documents?name=bad.txt`,
      'POST',
      Buffer.from('interdit'),
      reader,
      403,
      true,
    );
    const forged = await fetch(base + `/api/projects/${pid}/tasks/${tid}`, {
      method: 'PATCH',
      headers: { origin: 'https://evil.invalid', cookie: a, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done', revision: 4 }),
    });
    assert.equal(forged.status, 403);
    assert.ok((await request(`/projects/${pid}/activity`, 'GET', undefined, a)).data.length >= 6);
    await new Promise((r) => app.server.close(r));
    app.db.close();
    app = createApp({ directory: dir, origin });
    await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${app.server.address().port}`;
    assert.equal((await request('/projects', 'GET', undefined, a)).data[0].name, projectData.name);
    await request('/auth/logout-all', 'POST', {}, a);
    await request('/me', 'GET', undefined, a, 401);
  } finally {
    await new Promise((r) => app.server.close(r));
    app.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
