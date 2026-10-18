import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
test('Récupération réelle : liens locaux, usage unique, révocation et organisations', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'synko-account-')),
    app = createApp({ directory, mailMode: 'local' });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  async function req(path, method = 'GET', data, cookie = '', status = 200) {
    const res = await fetch(base + path, {
      method,
      headers: {
        origin: 'http://localhost:5173',
        cookie,
        ...(data ? { 'Content-Type': 'application/json' } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    const value = await res.json();
    assert.equal(res.status, status, JSON.stringify(value));
    return { value, cookie: res.headers.get('set-cookie')?.split(';')[0] };
  }
  const original = 'initial-password-123!';
  try {
    let cookie = (
      await req(
        '/auth/register',
        'POST',
        { name: 'Camille', email: 'camille@test.fr', password: original, organization: 'Atelier' },
        '',
        201,
      )
    ).cookie;
    const me = (await req('/me', 'GET', null, cookie)).value;
    await req('/me/verification', 'POST', {}, cookie);
    const messages = () =>
      readdirSync(join(directory, 'mail-outbox')).map((n) =>
        JSON.parse(readFileSync(join(directory, 'mail-outbox', n), 'utf8')),
      );
    const verify = new URL(
      messages().find((m) => m.subject.startsWith('Vérification')).url,
    ).searchParams.get('verify');
    await req('/auth/verify', 'POST', { token: verify });
    await req('/auth/verify', 'POST', { token: verify }, '', 422);
    assert.equal((await req('/me', 'GET', null, cookie)).value.email_verified, true);
    await req('/auth/forgot', 'POST', { email: 'absent@test.fr' });
    assert.equal(messages().length, 1);
    await req('/auth/forgot', 'POST', { email: 'camille@test.fr' });
    const reset = new URL(
      messages().find((m) => m.subject.startsWith('Réinitialisation')).url,
    ).searchParams.get('reset');
    await req('/auth/reset', 'POST', { token: reset, password: 'new-password-123!' });
    await req('/me', 'GET', null, cookie, 401);
    await req('/auth/reset', 'POST', { token: reset, password: 'another-password-123!' }, '', 422);
    await req('/auth/login', 'POST', { email: 'camille@test.fr', password: original }, '', 401);
    cookie = (
      await req('/auth/login', 'POST', { email: 'camille@test.fr', password: 'new-password-123!' })
    ).cookie;
    await req('/platform/organizations', 'GET', null, cookie, 403);
    app.db.prepare('UPDATE users SET platform_admin=1 WHERE id=?').run(me.id);
    assert.equal((await req('/platform/organizations', 'GET', null, cookie)).value.length, 1);
    const other = (
      await req(
        '/auth/register',
        'POST',
        {
          name: 'Autre admin',
          email: 'other@test.fr',
          password: original,
          organization: 'Autre entreprise',
        },
        '',
        201,
      )
    ).cookie;
    const org = (await req('/me', 'GET', null, other)).value.org_id;
    const invitation = (
      await req('/invitations', 'POST', { email: 'camille@test.fr', role: 'pmo' }, other, 201)
    ).value;
    const token = new URL(invitation.url).searchParams.get('invitation');
    await req('/invitations/accept-existing', 'POST', { token }, other, 422);
    await req('/invitations/accept-existing', 'POST', { token }, cookie);
    assert.equal((await req('/me', 'GET', null, cookie)).value.org_id, org);
    assert.equal((await req('/organizations', 'GET', null, cookie)).value.length, 2);
    await req('/organizations/switch', 'POST', { org_id: me.org_id }, cookie);
    const second = (
      await req('/auth/login', 'POST', { email: 'camille@test.fr', password: 'new-password-123!' })
    ).cookie;
    await req(
      '/me/password',
      'POST',
      { current_password: 'wrong-password-123!', password: 'final-password-123!' },
      cookie,
      403,
    );
    await req(
      '/me/password',
      'POST',
      { current_password: 'new-password-123!', password: 'final-password-123!' },
      cookie,
    );
    await req('/me', 'GET', null, second, 401);
    assert.equal((await req('/sessions', 'GET', null, cookie)).value.length, 1);
    assert.equal(
      (await req('/me/export', 'GET', null, cookie)).value.profile.email,
      'camille@test.fr',
    );
  } finally {
    await new Promise((r) => app.server.close(r));
    app.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
