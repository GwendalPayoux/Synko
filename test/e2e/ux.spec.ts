import { test, expect } from '@playwright/test';
test('Paramètres compacts, lecteur documentaire et création d’événement en haut', async ({
  page,
}, info) => {
  const origin = 'http://127.0.0.1:3199',
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.request.post('/api/auth/register', {
    headers: { origin },
    data: {
      name: 'Camille UX',
      email: `ux-${info.project.name}-${Date.now()}@synko.test`,
      organization: 'Atelier UX',
      password: 'ux-password-secret-123!',
    },
  });
  const p = await (
    await page.request.post('/api/projects', {
      headers: { origin },
      data: { name: 'Projet UX', start_date: '2026-10-01', end_date: '2026-12-01' },
    })
  ).json();
  const doc = await (
    await page.request.post(`/api/projects/${p.id}/documents?name=note.txt`, {
      headers: { origin },
      data: Buffer.from('Première version de la note'),
    })
  ).json();
  await page.request.post(`/api/projects/${p.id}/documents/${doc.id}/versions`, {
    headers: { origin },
    data: Buffer.from('Deuxième version de la note'),
  });
  await page.goto('/');
  async function navigate(name: string) {
    if (info.project.name === 'mobile')
      await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await page.locator('.sidebar').getByRole('button', { name, exact: true }).click();
  }
  await expect(page.locator('.sidebar button.profile')).toHaveCount(0);
  await navigate('Paramètres');
  await expect(page.getByRole('heading', { name: 'Paramètres.' })).toBeVisible();
  const signout = page.getByRole('button', { name: 'Se déconnecter', exact: true });
  await expect(signout).toBeInViewport();
  await expect(page.getByLabel('Nom complet', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Mot de passe actuel')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Sections des paramètres' })
    .getByRole('button', { name: 'Sécurité et sessions' })
    .click();
  await expect(page.getByLabel('Mot de passe actuel')).toBeVisible();
  await expect(page.getByLabel('Nom complet', { exact: true })).toHaveCount(0);
  await expect(signout).toBeInViewport();
  await page.screenshot({ path: `artifacts/${info.project.name}-settings-ux.png`, fullPage: true });
  await navigate('Calendrier');
  const create = page.getByRole('button', { name: 'Nouvel événement', exact: true });
  await expect(create).toBeInViewport();
  expect((await create.boundingBox())!.y).toBeLessThan(
    (await page.locator('.large-calendar').boundingBox())!.y,
  );
  await create.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await navigate('Mon espace');
  await page.getByRole('button', { name: 'Projet UX', exact: true }).click();
  await page
    .locator('.project-tabs')
    .getByRole('button', { name: 'Documents', exact: true })
    .click();
  await page.getByRole('button', { name: 'Ouvrir note.txt' }).click();
  await expect(page.getByRole('region', { name: 'Consultation du document' })).toBeVisible();
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.getByText('Deuxième version de la note', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Onglets du document' })
    .getByRole('button', { name: /Versions/ })
    .click();
  await page.getByRole('button', { name: 'Consulter la version 1', exact: true }).click();
  await expect(page.getByText('Première version de la note', { exact: true })).toBeVisible();
  await expect(page.getByText('Vous consultez une ancienne version · v1')).toBeVisible();
  if (info.project.name === 'chromium') {
    const preview = (await page.locator('.document-preview').boundingBox())!,
      actions = (await page.locator('.document-inspector').boundingBox())!;
    expect(preview.x + preview.width).toBeLessThanOrEqual(actions.x);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: `artifacts/${info.project.name}-document-ux.png`, fullPage: true });
  await page.getByRole('button', { name: 'Restaurer la version 1', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer la restauration' }).click();
  await expect(page.getByText('Version 3', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Première version de la note', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ouvrir note.txt' })).toBeFocused();
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',
    'base64',
  );
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Ouvrir pixel.png' }).click();
  await expect(page.getByRole('img', { name: 'pixel.png' })).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: 'pixel.png' })
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(1);
  await navigate('Calendrier');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});
