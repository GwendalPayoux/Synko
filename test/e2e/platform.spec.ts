import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
test('Modèle événement, icône, panneau tâche et notification directe', async ({ page }, info) => {
  const origin = 'http://127.0.0.1:3199';
  await page.request.post('/api/auth/register', {
    headers: { origin },
    data: {
      name: 'Alex Événement',
      organization: 'Événement ' + info.project.name,
      email: `event-${info.project.name}-${Date.now()}@synko.test`,
      password: 'event-test-password-123!',
    },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Créer un projet', exact: true }).last().click();
  await expect(page.getByLabel('Modèle de projet')).toHaveValue('');
  await page.getByLabel('Modèle de projet').selectOption({ label: 'Organisation d’un événement' });
  await expect(page.getByRole('radio', { name: 'Événement', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Communication', exact: true }).check();
  await page.getByLabel('Nom du projet').fill('Convention partenaires');
  await page.getByRole('button', { name: 'Créer le projet', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Convention partenaires' })).toBeVisible();
  const projects = await (await page.request.get('/api/projects')).json(),
    p = projects[0];
  expect(p.icon).toBe('megaphone');
  const tasks = await (await page.request.get(`/api/projects/${p.id}/tasks`)).json(),
    t = tasks[0];
  await page.locator('.project-tabs').getByRole('button', { name: 'Liste', exact: true }).click();
  await page
    .getByRole('button', { name: new RegExp(t.title) })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Enregistrer', exact: true })).toBeInViewport();
  await page.screenshot({ path: `artifacts/task-detail-${info.project.name}.png` });
  await dialog.getByLabel('Titre', { exact: true }).fill('Cadrage confirmé');
  await dialog.getByRole('button', { name: 'Historique', exact: true }).click();
  await dialog.getByRole('button', { name: 'Informations', exact: true }).click();
  await expect(dialog.getByLabel('Titre', { exact: true })).toHaveValue('Cadrage confirmé');
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  // Upcoming deadlines produce genuine task notifications for the assignee.
  const me = await (await page.request.get('/api/me')).json(),
    date = new Date().toISOString().slice(0, 10);
  const task = await (
    await page.request.post(`/api/projects/${p.id}/tasks`, {
      headers: { origin },
      data: {
        title: 'À préparer aujourd’hui',
        start_date: date,
        end_date: date,
        assignee_id: me.id,
      },
    })
  ).json();
  await page.getByRole('button', { name: 'Échéances à surveiller' }).click();
  await page
    .locator('.notification-popover')
    .getByRole('button', { name: /À préparer aujourd’hui/ })
    .click();
  await expect(page.getByRole('dialog').getByLabel('Titre', { exact: true })).toHaveValue(
    'À préparer aujourd’hui',
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Fermer', exact: true })
    .last()
    .click();
  expect(task.id).toBeTruthy();
  const doc = await (
    await page.request.post(`/api/projects/${p.id}/documents?name=programme.txt`, {
      headers: { origin },
      data: Buffer.from('Programme de la convention'),
    })
  ).json();
  expect(
    (
      await page.request.post(`/api/projects/${p.id}/documents/${doc.id}/approvals`, {
        headers: { origin },
        data: { reviewer_id: me.id },
      })
    ).status(),
  ).toBe(201);
  await page.getByRole('button', { name: 'Échéances à surveiller' }).click();
  await page
    .locator('.notification-popover')
    .getByRole('button', { name: /Document à valider : programme.txt/ })
    .click();
  await expect(page.getByRole('region', { name: 'Consultation du document' })).toBeVisible();
  await expect(page.getByText('Programme de la convention', { exact: true })).toBeVisible();
  if (info.project.name === 'chromium') {
    await page.getByRole('button', { name: 'Échéances à surveiller' }).hover();
    await expect(page.getByRole('tooltip')).toHaveText('Échéances à surveiller');
  }
  await page.screenshot({ path: `artifacts/event-${info.project.name}.png`, fullPage: true });
});
test('Back-office Synko : entreprise, compte, filtres et administration explicite', async ({
  page,
}, info) => {
  const origin = 'http://127.0.0.1:3199',
    credentials = JSON.parse(readFileSync('artifacts/e2e-operator.json', 'utf8'));
  expect(
    (
      await page.request.post('/api/auth/login', { headers: { origin }, data: credentials })
    ).status(),
  ).toBe(200);
  await page.goto('/');
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('button', { name: 'Administration Synko', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pilotage plateforme.' })).toBeVisible();
  await page
    .locator('.platform-tabs')
    .getByRole('button', { name: 'Entreprises', exact: true })
    .click();
  await page.getByRole('button', { name: 'Créer une entreprise', exact: true }).click();
  const org = 'Entreprise ' + info.project.name;
  await page.getByLabel('Nom de l’entreprise').fill(org);
  await page.getByRole('button', { name: 'Créer l’entreprise', exact: true }).click();
  await expect(page.getByRole('cell', { name: org, exact: true })).toBeVisible();
  await page
    .locator('.platform-tabs')
    .getByRole('button', { name: 'Utilisateurs', exact: true })
    .click();
  await page.getByLabel('Filtrer par entreprise').selectOption({ label: org });
  await page.getByRole('button', { name: 'Créer un utilisateur', exact: true }).click();
  await page.getByLabel('Nom complet').fill('Camille Test');
  await page
    .getByLabel('Adresse e-mail', { exact: true })
    .fill(`admin-e2e-${info.project.name}@synko.test`);
  await page.getByLabel('Mot de passe initial').fill('e2e-test-password-123!');
  await page.getByLabel('Rôle dans cette entreprise').selectOption('project_manager');
  await page.getByRole('button', { name: 'Créer l’utilisateur', exact: true }).click();
  await expect(page.getByRole('cell').filter({ hasText: 'Camille Test' }).first()).toBeVisible();
  await page
    .locator('.platform-tabs')
    .getByRole('button', { name: 'Projets', exact: true })
    .click();
  await page
    .locator('.admin-toolbar')
    .getByRole('button', { name: 'Créer un projet', exact: true })
    .click();
  await page.getByLabel('Nom du projet').fill('Projet administré');
  await page.getByLabel('Responsable du projet').selectOption({ label: 'Camille Test' });
  await page.getByRole('button', { name: 'Créer le projet', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Projet administré', exact: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/backoffice-${info.project.name}.png`, fullPage: true });
  await page
    .getByRole('button', { name: 'Ouvrir le projet Projet administré', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirmer l’accès' }).click();
  await expect(page.getByRole('heading', { name: 'Projet administré', exact: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/admin-${info.project.name}.png`, fullPage: true });
});
