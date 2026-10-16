import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  passwordHash,
  passwordMatches,
  date,
  email,
  integer,
  requirePermission,
} from '../server/security.mjs';
test('Mots de passe : sels uniques et comparaison réelle', async () => {
  const a = await passwordHash('secret-assez-long'),
    b = await passwordHash('secret-assez-long');
  assert.notEqual(a, b);
  assert.ok(await passwordMatches('secret-assez-long', a));
  assert.equal(await passwordMatches('mauvais-mot-de-passe', a), false);
});
test('Validation : dates calendaires, e-mails et entiers', () => {
  assert.equal(date('2024-02-29', 'Date'), '2024-02-29');
  for (const d of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-1'])
    assert.throws(() => date(d, 'Date'));
  assert.equal(email(' User@Example.FR '), 'user@example.fr');
  assert.throws(() => email('a@b'));
  assert.throws(() => integer(1.2, 0, 100, 'Montant'));
  assert.throws(() => integer(Number.MAX_SAFE_INTEGER + 1, 0, Number.MAX_SAFE_INTEGER, 'Montant'));
});
test('Permissions refusées par défaut et lecture sans mutation', () => {
  assert.throws(() => requirePermission({ role: 'inconnu' }, 'project:create'));
  assert.throws(() => requirePermission({ role: 'reader' }, 'task:write'));
  assert.throws(() => requirePermission({ role: 'pmo' }, 'document:write'));
  assert.throws(() => requirePermission({ role: 'contributor' }, 'project:write'));
  assert.doesNotThrow(() => requirePermission({ role: 'org_admin' }, 'members:write'));
});
