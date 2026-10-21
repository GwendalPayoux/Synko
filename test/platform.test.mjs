import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
test('Administration Synko : isolation, sociétés, comptes, droits, suspension et traçabilité', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'synko-platform-')),
    app = createApp({ directory: dir });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  async function req(path, method = 'GET', data, cookie = '', status = 200) {
    const r = await fetch(base + path, {
      method,
      headers: { origin: 'http://localhost:5173', cookie, 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
    const value = await r.json();
    assert.equal(r.status, status, JSON.stringify(value));
    return { value, cookie: r.headers.get('set-cookie')?.split(';')[0] };
  }
  const password = 'platform-tests-password-123!';
  try {
    const a = (
      await req(
        '/auth/register',
        'POST',
        { name: 'Opérateur', organization: 'Synapt', email: 'operator@test.fr', password },
        '',
        201,
      )
    ).cookie;
    const b = (
      await req(
        '/auth/register',
        'POST',
        { name: 'Client', organization: 'Client', email: 'client@test.fr', password },
        '',
        201,
      )
    ).cookie;
    const me = (await req('/me', 'GET', null, a)).value,
      client = (await req('/me', 'GET', null, b)).value;
    await req('/platform/organizations', 'GET', null, a, 403);
    app.db.prepare('UPDATE users SET platform_admin=1 WHERE id=?').run(me.id);
    const org = (await req('/platform/organizations', 'POST', { name: 'Événements' }, a, 201)).value
      .id;
    const account = (
      await req(
        '/platform/users',
        'POST',
        {
          name: 'Camille',
          email: 'camille@test.fr',
          password,
          org_id: org,
          role: 'project_manager',
        },
        a,
        201,
      )
    ).value.id;
    await req(
      '/platform/users',
      'POST',
      { name: 'Doublon', email: 'camille@test.fr', password, org_id: org, role: 'reader' },
      a,
      409,
    );
    const project = (
      await req(
        '/platform/projects',
        'POST',
        {
          org_id: org,
          owner_id: account,
          name: 'Convention',
          start_date: '2026-10-01',
          end_date: '2026-12-01',
          icon: 'calendar',
          status: 'paused',
        },
        a,
        201,
      )
    ).value.id;
    assert.equal(
      (await req('/platform/projects?org_id=' + org, 'GET', null, a)).value.items[0].status,
      'paused',
    );
    assert.equal((await req('/platform/users?org_id=' + org, 'GET', null, a)).value.total, 2);
    await req('/projects/' + project + '/tasks', 'GET', null, a, 404);
    await req('/platform/projects/' + project, 'PATCH', { owner_id: client.id }, a, 422);
    await req(
      '/platform/projects/' + project,
      'PATCH',
      { name: 'Convention annuelle', archived: true },
      a,
    );
    await req('/platform/projects/' + project, 'PATCH', { archived: false }, a);
    await req('/platform/users/' + me.id, 'PATCH', { platform_admin: false }, a, 422);
    await req('/platform/users/' + account, 'PATCH', { org_id: org, role: 'reader' }, a, 422);
    await req('/platform/organizations/' + org + '/access', 'POST', {}, a);
    assert.equal((await req('/me', 'GET', null, a)).value.org_id, org);
    await req('/projects/' + project + '/tasks', 'GET', null, a);
    let c = (await req('/auth/login', 'POST', { email: 'camille@test.fr', password })).cookie;
    const managed = (
      await req(
        '/projects',
        'POST',
        { name: 'Projet du chef', start_date: '2026-10-01', end_date: '2026-12-01' },
        c,
        201,
      )
    ).value.id;
    assert.ok(
      (await req('/projects/' + managed + '/members', 'GET', null, c)).value.some(
        (m) => m.id === me.id && m.role === 'org_admin',
      ),
    );
    await req('/projects/' + managed + '/members/' + me.id, 'DELETE', null, c, 403);
    const promoted = (
      await req(
        '/platform/users',
        'POST',
        {
          name: 'Second admin',
          email: 'second-admin@test.fr',
          password,
          org_id: org,
          role: 'contributor',
        },
        a,
        201,
      )
    ).value.id;
    await req('/platform/users/' + promoted, 'PATCH', { org_id: org, role: 'org_admin' }, a);
    for (const pid of [managed, project])
      assert.ok(
        (await req('/projects/' + pid + '/members', 'GET', null, a)).value.some(
          (m) => m.id === promoted,
        ),
      );
    await req('/projects/' + managed + '/members/' + promoted, 'DELETE', null, a, 403);
    await req('/platform/organizations/' + org, 'PATCH', { suspended: true }, a);
    await req('/me', 'GET', null, c, 401);
    await req('/auth/login', 'POST', { email: 'camille@test.fr', password }, '', 403);
    await req('/platform/organizations/' + org, 'PATCH', { suspended: false }, a);
    c = (await req('/auth/login', 'POST', { email: 'camille@test.fr', password })).cookie;
    await req('/platform/users/' + account, 'PATCH', { disabled: true }, a);
    await req('/me', 'GET', null, c, 401);
    await req('/auth/login', 'POST', { email: 'camille@test.fr', password }, '', 403);
    await req('/platform/users/' + account, 'PATCH', { disabled: false }, a);
    await req(
      '/platform/users/' + account + '/password',
      'POST',
      { password: 'replacement-password-123!' },
      a,
    );
    await req('/auth/login', 'POST', { email: 'camille@test.fr', password }, '', 401);
    c = (
      await req('/auth/login', 'POST', {
        email: 'camille@test.fr',
        password: 'replacement-password-123!',
      })
    ).cookie;
    await req('/platform/users/' + account + '/sessions', 'DELETE', null, a);
    await req('/me', 'GET', null, c, 401);
    assert.ok(
      (await req('/platform/audit', 'GET', null, a)).value.some((x) =>
        x.action.includes('Accès administratif'),
      ),
    );
    await req('/platform/users', 'GET', null, b, 403);
  } finally {
    await new Promise((r) => app.server.close(r));
    app.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test('Création atomique : modèle événement, projet vierge et identité persistée', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'synko-template-')),
    app = createApp({ directory: dir });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  let cookie = '';
  async function req(path, method = 'GET', data, status = 200) {
    const r = await fetch(base + path, {
      method,
      headers: { origin: 'http://localhost:5173', cookie, 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
    const v = await r.json();
    assert.equal(r.status, status, JSON.stringify(v));
    return v;
  }
  try {
    await req(
      '/auth/register',
      'POST',
      {
        name: 'Alex',
        organization: 'Équipe',
        email: 'alex@tests.fr',
        password: 'template-password-123!',
      },
      201,
    );
    const templates = await req('/templates'),
      event = templates.find((x) => x.name === 'Organisation d’un événement');
    assert.ok(event);
    assert.equal(event.icon, 'calendar');
    const body = {
      name: 'Événement annuel',
      start_date: '2026-10-01',
      end_date: '2026-12-01',
      template_id: event.id,
      icon: 'megaphone',
    };
    const p = await req('/projects', 'POST', body, 201),
      tasks = await req(`/projects/${p.id}/tasks`);
    assert.ok(tasks.length >= 7);
    assert.ok(tasks.some((t) => t.milestone));
    assert.equal((await req('/projects')).find((x) => x.id === p.id).icon, 'megaphone');
    assert.ok(app.db.prepare('SELECT COUNT(*) n FROM folders WHERE project_id=?').get(p.id).n >= 6);
    assert.ok(
      app.db.prepare('SELECT COUNT(*) n FROM task_dependencies WHERE project_id=?').get(p.id).n > 0,
    );
    const blank = await req(
      '/projects',
      'POST',
      { ...body, name: 'Vierge', template_id: undefined },
      201,
    );
    assert.deepEqual(await req(`/projects/${blank.id}/tasks`), []);
    await req('/projects', 'POST', { ...body, template_id: 'foreign-template' }, 404);
    await req('/projects', 'POST', { ...body, icon: 'invalid' }, 422);
    await req('/projects', 'POST', { ...body, end_date: '2026-10-02' }, 422);
    assert.equal((await req('/projects')).length, 2);
  } finally {
    await new Promise((r) => app.server.close(r));
    app.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
