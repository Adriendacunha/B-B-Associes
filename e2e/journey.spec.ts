import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Parcours complet (flux consolidé) : création d'un client → fiche → ouverture
// d'une campagne « Déclaration d'impôt » (assistant guidé) → activation client →
// dépôt groupé → validation.

const FIXTURE = path.join(__dirname, 'fixtures', '2025_certificat_salaire.pdf');
const last = 'E2E' + Date.now().toString().slice(-7);
const email = `${last.toLowerCase()}@e2e.test`;

async function loginStaff(page: Page) {
  await page.goto('/fr/login');
  await page.fill('input[name=email]', 'collab@bbassocies.ch');
  await page.fill('input[name=password]', 'changeme-collab');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/tableau-de-bord');
}

test('parcours : client → campagne Déclaration d’impôt → dépôt → validation', async ({ browser }) => {
  const staff = await browser.newContext();
  const sp = await staff.newPage();
  await loginStaff(sp);

  // 1) Créer un client (identité minimale)
  await sp.goto('/fr/clients');
  await sp.fill('input[name=lastName]', last);
  await sp.fill('input[name=firstName]', 'Testeur');
  await sp.fill('input[name=email]', email);
  await sp.getByRole('button', { name: 'Créer le client' }).click();
  await sp.waitForLoadState('networkidle');

  // 2) Ouvrir la fiche du client
  const row = sp.locator('li', { hasText: last });
  await row.getByRole('link', { name: 'Ouvrir la fiche' }).click();
  await sp.waitForURL('**/clients/**');

  // 3) Récupérer le lien d'activation à transmettre au client
  const activationLink = await sp.locator('input[readonly]').first().inputValue();
  expect(activationLink).toContain('/activation?token=');

  // 4) Créer une campagne « Déclaration d'impôt » (assistant guidé) depuis la fiche
  await sp.getByRole('link', { name: 'Créer une campagne' }).click();
  await sp.waitForURL('**/nouvelle-campagne');
  await sp.getByRole('button', { name: /Déclaration d.impôt/ }).click();
  // Qualification minimale : pas d'impôt à la source + déclaration de l'année
  // (les questions DRIS / réclamation restent alors masquées).
  await sp.getByRole('button', { name: 'Non' }).click();
  await sp.getByRole('button', { name: /Déclaration d.impôt de l.année/ }).click();
  await sp.getByRole('button', { name: 'Créer la campagne' }).click();
  await sp.waitForURL('**/campagne/**');

  // 5) Le client active son compte via le lien
  const client = await browser.newContext();
  const cp = await client.newPage();
  await cp.goto(activationLink);
  await cp.fill('input[name=password]', 'MotDePasse123');
  await cp.getByRole('button', { name: 'Activer' }).click();
  await cp.waitForURL('**/espace');

  // 6) Le client dépose une pièce (dépôt groupé → tri automatique)
  await cp.goto('/fr/espace');
  await cp.waitForLoadState('networkidle');
  await cp.locator('input[type=file]').first().setInputFiles(FIXTURE);
  await cp.getByRole('button', { name: /Déposer et trier|Envoyer/ }).first().click();
  await expect(cp.getByText('En validation').first()).toBeVisible({ timeout: 30_000 });

  // 7) Le cabinet valide la pièce dans la file
  await sp.goto('/fr/validation');
  await sp.getByRole('button', { name: 'Valider' }).first().click();
  await sp.waitForLoadState('networkidle');
});
