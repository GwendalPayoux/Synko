import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
import { createBackup, restoreBackup } from '../server/backups.mjs';
import { DatabaseSync } from 'node:sqlite';
import { assertAcyclic, budgetSummary } from '../server/planning.mjs';
test('Planification : cycles et calcul budgétaire centralisé', () => {
  assert.throws(() =>
    assertAcyclic([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'a'],
    ]),
  );
  assert.doesNotThrow(() =>
    assertAcyclic([
      ['a', 'b'],
      ['b', 'c'],
    ]),
  );
  assert.deepEqual(
    budgetSummary(
      { budget_cents: 1000 },
      [
        { kind: 'actual', amount_cents: 400 },
        { kind: 'commitment', amount_cents: 300 },
        { kind: 'forecast', amount_cents: 500 },
      ],
      [{ amount_cents: 1100 }],
    ),
    {
      initial_cents: 1000,
      revised_cents: 1100,
      actual_cents: 400,
      commitment_cents: 300,
      forecast_cents: 500,
      projected_cents: 1200,
      variance_cents: -100,
    },
  );
});
test('Modules métier : relations, documents, budget, modèles, droits et notifications', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'synko-business-')),
    app = createApp({ directory: dir });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  async function req(path, method = 'GET', data, cookie = '', status = 200, raw = false) {
    const res = await fetch(base + path, {
      method,
      headers: {
        origin: 'http://localhost:5173',
        cookie,
        ...(data && !raw ? { 'Content-Type': 'application/json' } : {}),
      },
      body: data ? (raw ? data : JSON.stringify(data)) : undefined,
    });
    const value = await res.json();
    assert.equal(res.status, status, JSON.stringify(value));
    return { value, cookie: res.headers.get('set-cookie')?.split(';')[0] };
  }
  const pass = 'password-business-123!';
  try {
    const a = (
      await req(
        '/auth/register',
        'POST',
        { name: 'Admin', organization: 'Tests', email: 'a@tests.fr', password: pass },
        '',
        201,
      )
    ).cookie;
    const b = (
      await req(
        '/auth/register',
        'POST',
        { name: 'Autre', organization: 'Autre', email: 'b@tests.fr', password: pass },
        '',
        201,
      )
    ).cookie;
    const me = (await req('/me', 'GET', null, a)).value;
    const p = (
      await req(
        '/projects',
        'POST',
        {
          name: 'Module complet',
          start_date: '2026-10-01',
          end_date: '2026-11-01',
          budget_cents: 10000,
        },
        a,
        201,
      )
    ).value.id;
    const root = `/projects/${p}`;
    async function invite(role) {
      const email = role + '@tests.fr';
      const inv = (await req('/invitations', 'POST', { email, role }, a, 201)).value;
      const cookie = (
        await req(
          '/auth/accept',
          'POST',
          {
            name: role,
            email,
            password: pass,
            token: new URL(inv.url).searchParams.get('invitation'),
          },
          '',
          201,
        )
      ).cookie;
      const member = (await req('/me', 'GET', null, cookie)).value;
      await req(root + '/members', 'POST', { user_id: member.id }, a, 201);
      return { cookie, id: member.id };
    }
    const contributor = await invite('contributor'),
      reader = await invite('reader');
    const t1 = (
      await req(
        root + '/tasks',
        'POST',
        {
          title: 'Analyse',
          start_date: '2026-10-01',
          end_date: '2026-10-05',
          assignee_id: contributor.id,
        },
        a,
        201,
      )
    ).value.id;
    const t2 = (
      await req(
        root + '/tasks',
        'POST',
        { title: 'Livraison', start_date: '2026-10-04', end_date: '2026-10-10' },
        a,
        201,
      )
    ).value.id;
    await req(
      root + `/tasks/${t2}/details`,
      'PATCH',
      { revision: 1, parent_id: t1, effort_hours: 24, predecessor_ids: [t1] },
      a,
    );
    await req(
      root + `/tasks/${t1}/details`,
      'PATCH',
      { revision: 1, parent_id: t2, effort_hours: 8, predecessor_ids: [] },
      a,
      422,
    );
    await req(
      root + `/tasks/${t1}/details`,
      'PATCH',
      { revision: 1, effort_hours: 8, predecessor_ids: [t2] },
      a,
      422,
    );
    assert.equal(
      (await req(root + '/planning', 'GET', null, a)).value.dependencies[0].conflict,
      true,
    );
    await req(
      root + `/tasks/${t1}/comments`,
      'POST',
      { body: 'Commentaire réel' },
      contributor.cookie,
      201,
    );
    await req(root + `/tasks/${t1}/comments`, 'POST', { body: 'Interdit' }, reader.cookie, 403);
    assert.equal(
      (await req(root + `/tasks/${t1}/details`, 'GET', null, a)).value.comments.length,
      1,
    );
    await req(root + `/tasks/${t1}`, 'DELETE', null, a, 422);
    await req(
      root + '/budget/entries',
      'POST',
      {
        label: 'Prestation',
        category: 'Services',
        kind: 'commitment',
        amount_cents: 12000,
        entry_date: '2026-10-02',
      },
      a,
      201,
    );
    assert.equal((await req(root + '/budget', 'GET', null, a)).value.summary.variance_cents, -2000);
    await req(
      root + '/budget/revisions',
      'POST',
      { amount_cents: 15000, reason: 'Périmètre étendu' },
      a,
      201,
    );
    assert.equal((await req(root + '/budget', 'GET', null, a)).value.summary.variance_cents, 3000);
    await req(
      root + '/budget/entries',
      'POST',
      {
        label: 'Faux',
        category: 'Divers',
        kind: 'actual',
        amount_cents: 1,
        entry_date: '2026-10-02',
      },
      contributor.cookie,
      403,
    );
    await req(root + '/budget', 'GET', null, reader.cookie, 403);
    assert.equal((await req(root, 'GET', null, reader.cookie)).value.budget_cents, undefined);
    await req(root + '/budget', 'GET', null, b, 404);
    await req('/portfolio', 'GET', null, contributor.cookie, 403);
    assert.equal((await req('/portfolio', 'GET', null, a)).value[0].budget.variance_cents, 3000);
    await req('/capacity', 'PATCH', { capacity_hours: 28 }, contributor.cookie);
    await req('/capacity', 'PATCH', { user_id: me.id, capacity_hours: 0 }, contributor.cookie, 403);
    const absence = (
      await req(
        '/availability',
        'POST',
        { start_date: '2026-10-20', end_date: '2026-10-21', reason: 'Formation' },
        contributor.cookie,
        201,
      )
    ).value.id;
    assert.equal(
      (await req('/availability', 'GET', null, contributor.cookie)).value.members[0].capacity_hours,
      28,
    );
    await req('/availability/' + absence, 'DELETE', null, b, 404);
    await req('/availability/' + absence, 'DELETE', null, contributor.cookie);
    const folder = (await req(root + '/folders', 'POST', { name: 'Livrables' }, a, 201)).value.id;
    const child = (
      await req(root + '/folders', 'POST', { name: 'Final', parent_id: folder }, a, 201)
    ).value.id;
    await req(
      root + `/folders/${folder}`,
      'PATCH',
      { name: 'Livrables', parent_id: child },
      a,
      422,
    );
    const doc = (
      await req(
        root + `/documents?name=spec.txt&folder_id=${folder}`,
        'POST',
        Buffer.from('Version A'),
        a,
        201,
        true,
      )
    ).value.id;
    assert.equal((await req(root + '/documents', 'GET', null, a)).value[0].folder_id, folder);
    await req(root + `/documents/${doc}`, 'PATCH', { audience: 'internal' }, a);
    assert.equal((await req(root + '/documents', 'GET', null, reader.cookie)).value.length, 0);
    await req(root + `/documents/${doc}/details`, 'GET', null, reader.cookie, 404);
    assert.equal(
      (await req(root + `/documents/${doc}/preview`, 'GET', null, a)).value.content,
      'Version A',
    );
    const versions = (await req(root + `/documents/${doc}/versions`, 'GET', null, a)).value;
    await req(root + `/documents/${doc}/versions`, 'POST', Buffer.from('Version B'), a, 201, true);
    assert.equal(
      (await req(root + `/documents/${doc}/preview?version_id=${versions[0].id}`, 'GET', null, a))
        .value.content,
      'Version A',
    );
    await req(root + `/documents/${doc}/preview?version_id=absent`, 'GET', null, a, 404);
    await req(root + `/documents/${doc}/preview?format=raw`, 'GET', null, a, 422);
    await req(root + `/documents/${doc}/restore`, 'POST', { version_id: versions[0].id }, a, 201);
    assert.equal(
      (await req(root + `/documents/${doc}/preview`, 'GET', null, a)).value.content,
      'Version A',
    );
    const approval = (
      await req(
        root + `/documents/${doc}/approvals`,
        'POST',
        { reviewer_id: contributor.id },
        a,
        201,
      )
    ).value.id;
    await req(root + `/approvals/${approval}`, 'PATCH', { status: 'approved' }, reader.cookie, 404);
    await req(
      root + `/approvals/${approval}`,
      'PATCH',
      { status: 'rejected', reason: '' },
      contributor.cookie,
      422,
    );
    await req(
      root + `/approvals/${approval}`,
      'PATCH',
      { status: 'rejected', reason: 'Informations manquantes' },
      contributor.cookie,
    );
    await req(
      root + `/approvals/${approval}`,
      'PATCH',
      { status: 'approved' },
      contributor.cookie,
      409,
    );
    await req(
      root + `/tasks/${t1}/attachments`,
      'POST',
      { document_id: doc },
      contributor.cookie,
      201,
    );
    const notice = (await req('/notifications', 'GET', null, contributor.cookie)).value.find(
      (n) => n.entity_id === doc,
    );
    assert.ok(notice);
    await req('/notifications/' + notice.id, 'PATCH', { read: true }, contributor.cookie);
    assert.ok(
      (await req('/notifications', 'GET', null, contributor.cookie)).value.find(
        (n) => n.id === notice.id,
      ).read_at,
    );
    await req(
      root + '/events',
      'POST',
      { title: 'Atelier', kind: 'meeting', start_date: '2026-10-02', end_date: '2026-10-02' },
      a,
      201,
    );
    assert.equal((await req('/events', 'GET', null, reader.cookie)).value.length, 1);
    assert.equal((await req('/events', 'GET', null, b)).value.length, 0);
    const template = (await req(root + '/template', 'POST', { name: 'Modèle technique' }, a, 201))
      .value.id;
    await req(
      `/templates/${template}/instantiate`,
      'POST',
      { name: 'Copie', start_date: '2027-01-01' },
      b,
      404,
    );
    const copy = (
      await req(
        `/templates/${template}/instantiate`,
        'POST',
        { name: 'Copie', start_date: '2027-01-01' },
        a,
        201,
      )
    ).value.id;
    assert.equal((await req(`/projects/${copy}/tasks`, 'GET', null, a)).value.length, 2);
    assert.equal(
      (await req(`/projects/${copy}/planning`, 'GET', null, a)).value.dependencies.length,
      1,
    );
    assert.equal((await req(`/projects/${copy}/folders`, 'GET', null, a)).value.length, 2);
    await req('/members/' + me.id, 'PATCH', { role: 'reader' }, a, 422);
    await req(root + `/members/${contributor.id}`, 'DELETE', null, a);
    await req(root + '/tasks', 'GET', null, contributor.cookie, 404);
    assert.equal(
      (await req(root + '/tasks', 'GET', null, a)).value.find((t) => t.id === t1).assignee_id,
      null,
    );
    assert.equal((await req('/notifications', 'GET', null, contributor.cookie)).value.length, 0);
    const latest = (await req(root + '/tasks', 'GET', null, a)).value.find((t) => t.id === t2);
    const race = await Promise.all(
      ['doing', 'review'].map((status) =>
        fetch(base + root + `/tasks/${t2}`, {
          method: 'PATCH',
          headers: {
            origin: 'http://localhost:5173',
            cookie: a,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ revision: latest.revision, status }),
        }),
      ),
    );
    assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
    const parallelApproval = (
      await req(root + `/documents/${doc}/approvals`, 'POST', { reviewer_id: me.id }, a, 201)
    ).value.id;
    const decisions = await Promise.all(
      ['approved', 'rejected'].map((status) =>
        fetch(base + root + `/approvals/${parallelApproval}`, {
          method: 'PATCH',
          headers: {
            origin: 'http://localhost:5173',
            cookie: a,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status, reason: 'Décision concurrente test' }),
        }),
      ),
    );
    assert.deepEqual(decisions.map((r) => r.status).sort(), [200, 409]);
    await req(root, 'PATCH', { name: 'Projet renommé', archived: true }, a);
    assert.equal((await req('/projects', 'GET', null, a)).value.length, 1);
    assert.equal((await req('/projects?archived=true', 'GET', null, a)).value.length, 2);
    await createBackup(dir, join(dir, 'snapshot'));
    restoreBackup(join(dir, 'snapshot'), join(dir, 'restored'));
    const restored = new DatabaseSync(join(dir, 'restored', 'synko.sqlite'), { readOnly: true });
    try {
      assert.equal(
        restored.prepare('SELECT name FROM projects WHERE id=?').get(p).name,
        'Projet renommé',
      );
      assert.equal(restored.prepare('SELECT COUNT(*) n FROM document_versions').get().n, 3);
    } finally {
      restored.close();
    }
  } finally {
    await new Promise((r) => app.server.close(r));
    app.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
