import { test, expect } from '@playwright/test';
test('Navigation épurée, projets actifs, couleur, clics étendus et événement personnel', async ({
  page,
}, info) => {
  const origin = 'http://127.0.0.1:3199';
  const response = await page.request.post('/api/auth/register', {
    headers: { origin },
    data: {
      name: 'Camille UX',
      email: `round2-${info.project.name}-${Date.now()}@synko.test`,
      organization: 'Entreprise distincte',
      password: 'round-two-password-123!',
    },
  });
  expect(response.status()).toBe(201);
  const p = await (
    await page.request.post('/api/projects', {
      headers: { origin },
      data: {
        name: 'Projet ardoise',
        description: 'Une description cliquable',
        color: 'blue',
        start_date: '2026-10-01',
        end_date: '2026-12-01',
      },
    })
  ).json();
  const paused = await (
    await page.request.post('/api/projects', {
      headers: { origin },
      data: {
        name: 'Projet en pause',
        status: 'paused',
        start_date: '2026-10-01',
        end_date: '2026-12-01',
      },
    })
  ).json();
  expect(paused.id).toBeTruthy();
  const doc = await (
    await page.request.post(`/api/projects/${p.id}/documents?name=note-navigation.txt`, {
      headers: { origin },
      data: Buffer.from('Détail ouvert depuis la ligne'),
    })
  ).json();
  expect(doc.id).toBeTruthy();
  await page.goto('/');
  async function navigate(name: string) {
    if (info.project.name === 'mobile')
      await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await page
      .locator('.sidebar nav')
      .getByRole('button', { name: new RegExp('^' + name) })
      .click();
  }
  await expect(page.locator('.topbar .breadcrumbs')).toHaveText('Mon espace');
  await page.locator('.calendar').getByRole('button', { name: 'Nouvel événement' }).click();
  await page.getByLabel('Titre de l’événement').fill('Atelier personnel');
  await page.getByRole('button', { name: 'Enregistrer l’événement' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.locator('.calendar').getByText('Atelier personnel', { exact: true }),
  ).toBeVisible();
  await navigate('Projets');
  await expect(page.locator('.filter-tabs button.selected')).toHaveText('En cours');
  await expect(page.locator('.project-card')).toHaveCount(1);
  await expect(page.getByText('Modèles de projet', { exact: true })).toHaveCount(0);
  await expect(page.locator('.topbar .breadcrumbs')).toHaveText('Projets');
  const card = page.locator('.project-card');
  await card.getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await expect(page.getByRole('heading', { name: 'Les projets.' })).toBeVisible();
  await card.locator('.project-description').click();
  await expect(page.getByRole('heading', { name: 'Projet ardoise', exact: true })).toBeVisible();
  await expect(page.locator('.app-main')).toHaveAttribute('data-project-color', 'blue');
  await expect(page.locator('.topbar .breadcrumbs')).toHaveText('Projet ardoise');
  const accent = await page
    .locator('.app-main')
    .evaluate((e) => getComputedStyle(e).getPropertyValue('--accent').trim());
  expect(accent).toBe('#3e607d');
  await page
    .locator('.project-tabs')
    .getByRole('button', { name: 'Documents', exact: true })
    .click();
  await page
    .locator('tbody tr')
    .filter({ hasText: 'note-navigation.txt' })
    .locator('td')
    .nth(1)
    .click();
  await expect(page.getByRole('region', { name: 'Consultation du document' })).toBeVisible();
  await expect(page.getByText('Détail ouvert depuis la ligne', { exact: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/navigation-${info.project.name}.png`, fullPage: true });
});
