import { test, expect } from '@playwright/test';
test('Planification avancée, budget, dossiers, validation, modèles et événements', async ({
  page,
}, info) => {
  const origin = 'http://127.0.0.1:3199',
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const r = await page.request.post('/api/auth/register', {
    headers: { origin },
    data: {
      name: 'Alex Modules',
      email: `modules-${info.project.name}-${Date.now()}@synko.test`,
      organization: 'Atelier Modules',
      password: 'modules-password-123!',
    },
  });
  expect(r.status()).toBe(201);
  const me = await (await page.request.get('/api/me')).json();
  const p = await (
    await page.request.post('/api/projects', {
      headers: { origin },
      data: {
        name: 'Projet modules',
        start_date: '2026-10-01',
        end_date: '2026-12-01',
        budget_cents: 1000000,
      },
    })
  ).json();
  const base = `/api/projects/${p.id}`;
  const t = await (
    await page.request.post(base + '/tasks', {
      headers: { origin },
      data: {
        title: 'Cadrage initial',
        assignee_id: me.id,
        start_date: '2026-10-01',
        end_date: '2026-10-02',
      },
    })
  ).json();
  const t2 = await (
    await page.request.post(base + '/tasks', {
      headers: { origin },
      data: {
        title: 'Livrer le résultat',
        assignee_id: me.id,
        start_date: '2026-10-03',
        end_date: '2026-10-05',
      },
    })
  ).json();
  await page.goto('/');
  await page.getByRole('button', { name: 'Projet modules', exact: true }).click();
  const tabs = page.locator('.project-tabs');
  await tabs.getByRole('button', { name: 'Liste', exact: true }).click();
  await page.getByRole('button', { name: /Livrer le résultat/ }).click();
  await page.getByLabel('Tâche parente', { exact: true }).selectOption(t.id);
  await page.getByLabel('Prédécesseurs (sélection multiple)').selectOption([t.id]);
  await page.getByLabel('Charge estimée (heures)').fill('16');
  const saved = page.waitForResponse(
    (r) => r.url().endsWith(`/tasks/${t2.id}/details`) && r.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Enregistrer les relations' }).click();
  await saved;
  await page.getByLabel('Ajouter un commentaire').fill('Le cadrage est validé par l’équipe.');
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  await expect(
    page.getByText('Le cadrage est validé par l’équipe.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('dialog')).toHaveCount(0);
  await tabs.getByRole('button', { name: 'Budget', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter une écriture' }).click();
  await page.getByLabel('Libellé', { exact: true }).fill('Atelier de conception');
  await page.getByLabel('Catégorie', { exact: true }).fill('Prestations');
  await page.getByLabel('Montant (€)').fill('1200');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'Atelier de conception', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `artifacts/${info.project.name}-budget.png`, fullPage: true });
  await tabs.getByRole('button', { name: 'Documents', exact: true }).click();
  await page.getByRole('button', { name: 'Nouveau dossier', exact: true }).click();
  await page.getByLabel('Nom du dossier', { exact: true }).fill('Livrables');
  await page.getByRole('button', { name: 'Enregistrer le dossier' }).click();
  await page.getByLabel('Dossier courant').selectOption({ label: 'Livrables' });
  await page.locator('input[type=file]').setInputFiles({
    name: 'brief.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Cahier de cadrage réel'),
  });
  await expect(page.getByText('brief.txt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Historique de brief.txt' }).click();
  await page.getByRole('button', { name: 'Lire l’aperçu texte' }).click();
  await expect(page.getByText('Cahier de cadrage réel', { exact: true })).toBeVisible();
  await page.getByLabel('Validateur de la version courante').selectOption(me.id);
  await page.getByRole('button', { name: 'Demander une validation' }).click();
  await page.getByRole('button', { name: 'Enregistrer la décision' }).click();
  await expect(page.getByText(/Approuvée ·/)).toBeVisible();
  await page.screenshot({ path: `artifacts/${info.project.name}-document.png`, fullPage: true });
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await tabs.getByRole('button', { name: 'Paramètres', exact: true }).click();
  await page.getByLabel('Nom du projet', { exact: true }).fill('Projet modules enrichi');
  await page.getByRole('button', { name: 'Enregistrer les informations' }).click();
  await expect(
    page.getByRole('heading', { name: 'Projet modules enrichi', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer comme modèle' }).click();
  await page.getByLabel('Nom du modèle', { exact: true }).fill('Modèle atelier');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(page.locator('dialog')).toHaveCount(0);
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page
    .locator('.sidebar nav')
    .getByRole('button', { name: 'Calendrier', exact: true })
    .click();
  await page.getByRole('button', { name: 'Nouvel événement' }).click();
  await page.getByLabel('Titre de l’événement').fill('Réunion de lancement');
  await page.getByRole('button', { name: 'Enregistrer l’événement' }).click();
  await expect(page.getByText('Réunion de lancement', { exact: true }).last()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
