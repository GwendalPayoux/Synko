import { test, expect } from '@playwright/test';
test('Gestes Gantt et Kanban persistent les mêmes tâches', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Les gestes souris sont vérifiés sur desktop, le formulaire tactile dans le parcours mobile.',
  );
  const origin = 'http://127.0.0.1:3199';
  const registration = await page.request.post('/api/auth/register', {
    headers: { origin },
    data: {
      name: 'Alex Planning',
      email: `planning-${Date.now()}@synko.test`,
      password: 'planning-secret-123!',
      organization: 'Planning Studio',
    },
  });
  expect(registration.status()).toBe(201);
  const me = await (await page.request.get('/api/me')).json();
  const project = await (
    await page.request.post('/api/projects', {
      headers: { origin },
      data: { name: 'Planning interactif', start_date: '2026-10-01', end_date: '2026-10-31' },
    })
  ).json();
  const base = `/api/projects/${project.id}/tasks`;
  await page.request.post(base, {
    headers: { origin },
    data: {
      title: 'Atelier de cadrage',
      assignee_id: me.id,
      start_date: '2026-10-05',
      end_date: '2026-10-08',
    },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Planning interactif' }).click();
  const bar = page.getByRole('button', { name: 'Atelier de cadrage : déplacer', exact: false });
  await expect(bar).toBeVisible();
  const b = (await bar.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 72, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(async () => (await (await page.request.get(base)).json())[0].start_date)
    .toBe('2026-10-07');
  const resize = page.getByRole('button', { name: 'Redimensionner Atelier de cadrage' });
  const r = (await resize.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 36, r.y + r.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(async () => (await (await page.request.get(base)).json())[0].end_date)
    .toBe('2026-10-11');
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  const card = page.getByRole('button', { name: /Atelier de cadrage/ });
  const source = (await card.boundingBox())!;
  const destination = (await page.locator('.kanban-column.doing').boundingBox())!;
  await page.mouse.move(source.x + 25, source.y + 25);
  await page.mouse.down();
  await page.mouse.move(source.x + 35, source.y + 35);
  await page.mouse.move(destination.x + 50, destination.y + 80, { steps: 12 });
  await page.mouse.move(destination.x + 55, destination.y + 85);
  await page.mouse.up();
  await expect
    .poll(async () => (await (await page.request.get(base)).json())[0].status)
    .toBe('doing');
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Statut de Atelier de cadrage' })).toHaveValue(
    'doing',
  );
  await page.getByRole('button', { name: 'Planning', exact: true }).click();
  await page.screenshot({ path: 'artifacts/gantt.png', fullPage: true });
});
