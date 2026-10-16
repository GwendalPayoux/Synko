import { test, expect } from '@playwright/test';
test('Inscription → projet → tâche → Gantt → Kanban → document → reconnexion', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const email = `e2e-${testInfo.project.name}-${Date.now()}@synko.test`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Créer un espace' }).click();
  await page.getByLabel('Nom complet').fill('Camille Martin');
  await page.getByLabel('Entreprise', { exact: true }).fill('Atelier Synapt');
  await page.getByLabel('Adresse e-mail professionnelle').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('Synko-test-secret-123!');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('heading', { name: 'Bonjour, Camille.' })).toBeVisible();
  await page.getByRole('button', { name: 'Créer un projet', exact: true }).last().click();
  await page.getByLabel('Nom du projet').fill('Nouvel espace client');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Un parcours plus simple pour nos clients.');
  await page.getByLabel('Budget initial (€)').fill('24000');
  await page.getByRole('button', { name: 'Créer le projet', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nouvel espace client' })).toBeVisible();
  await page.getByRole('button', { name: 'Nouvelle tâche', exact: true }).click();
  await page.getByLabel('Titre', { exact: true }).fill('Cadrer les besoins');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Préparer les ateliers avec les équipes.');
  await page.getByLabel('Responsable', { exact: true }).selectOption({ label: 'Camille Martin' });
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Cadrer les besoins : déplacer', exact: false }),
  ).toBeVisible();
  const bar = page.getByRole('button', { name: 'Cadrer les besoins : déplacer', exact: false });
  await bar.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('status')).toHaveText('Modifications enregistrées');
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await page.getByRole('button', { name: /Cadrer les besoins/ }).click();
  await page.getByLabel('Statut', { exact: true }).selectOption('doing');
  await page.getByLabel('Progression (%)').fill('40');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Statut de Cadrer les besoins' })).toHaveValue(
    'doing',
  );
  await expect(page.getByText('40%', { exact: true }).first()).toBeVisible();
  const projectTabs = page.locator('.project-tabs');
  await projectTabs.getByRole('button', { name: 'Documents', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'cadrage.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Livrable réel Synko'),
  });
  await expect(page.getByText('cadrage.txt', { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Télécharger cadrage.txt' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('cadrage.txt');
  await page
    .getByRole('button', { name: 'Nouvelle version de cadrage.txt' })
    .click({ noWaitAfter: true });
  await page.locator('input[type=file]').setInputFiles({
    name: 'cadrage.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Livrable révisé'),
  });
  await expect(page.getByText('v2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Historique de cadrage.txt' }).click();
  await expect(page.getByText('Version 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('button', { name: 'Mon espace', exact: true }).click();
  await expect(page.getByRole('button', { name: /Cadrer les besoins/ }).first()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-dashboard.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Activer le mode sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-dark.png`, fullPage: true });
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await page.getByLabel('Adresse e-mail professionnelle').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('Synko-test-secret-123!');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Paramètres.' })).toBeVisible();
  expect(errors).toEqual([]);
});
