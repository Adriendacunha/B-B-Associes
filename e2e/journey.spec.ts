import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Parcours complet de la Phase 1, automatisé : onboarding d'un bêta-testeur →
// ouverture de campagne → dépôt d'une pièce → analyse → validation humaine.
// Remplace la batterie de tests manuels avant l'envoi à un vrai bêta-testeur.

const FIXTURE = path.join(__dirname, 'fixtures', '2025_certificat_salaire.pdf');
const code = 'E2E' + Date.now().toString().slice(-7);
const email = `${code.toLowerCase()}@e2e.test`;

async function loginStaff(page: Page) {
  await page.goto('/fr/login');
  await page.fill('input[name=email]', 'collab@bbassocies.ch');
  await page.fill('input[name=password]', 'changeme-collab');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/tableau-de-bord');
}

test('parcours : onboarding → campagne → dépôt → validation', async ({ browser }) => {
  const staff = await browser.newContext();
  const sp = await staff.newPage();
  await loginStaff(sp);

  // 1) Créer un client (bêta-testeur)
  await sp.goto('/fr/clients');
  await sp.fill('input[name=clientCode]', code);
  await sp.fill('input[name=displayName]', 'E2E Testeur');
  await sp.fill('input[name=email]', email);
  await sp.getByRole('button', { name: 'Créer le client' }).click();
  const activationLink = await sp.locator(`li:has-text("${code}") input[readonly]`).first().inputValue();
  expect(activationLink).toContain('/activation?token=');

  // 2) Le client active son compte via le lien
  const client = await browser.newContext();
  const cp = await client.newPage();
  await cp.goto(activationLink);
  await cp.fill('input[name=password]', 'MotDePasse123');
  await cp.getByRole('button', { name: 'Activer' }).click();
  await cp.waitForURL('**/espace');

  // 3) Le cabinet ouvre une campagne (profilage) pour ce client
  await sp.goto('/fr/profilage');
  await sp.locator('select').first().selectOption(code); // sélecteur Client (value = code)
  await sp.getByRole('button', { name: 'Créer la campagne' }).click();
  await sp.waitForURL('**/campagne/**');

  // 4) Le client dépose une pièce (la 1re : certificat de salaire)
  await cp.goto('/fr/espace');
  await cp.waitForLoadState('networkidle');
  const firstForm = cp.locator('form').filter({ has: cp.locator('input[type=file]') }).first();
  await firstForm.locator('input[type=file]').setInputFiles(FIXTURE);
  await firstForm.locator('button[type=submit]').click();
  // la pièce passe en validation
  await expect(cp.getByText('En validation').first()).toBeVisible({ timeout: 30_000 });

  // 5) Le cabinet valide la pièce dans la file
  await sp.goto('/fr/validation');
  await expect(sp.getByText('Certificat de salaire').first()).toBeVisible();
  await sp.getByRole('button', { name: 'Valider' }).first().click();
  await sp.waitForLoadState('networkidle');

  // 6) Côté client, la pièce est désormais conforme
  await cp.goto('/fr/espace');
  await expect(cp.getByText('Conforme').first()).toBeVisible({ timeout: 30_000 });
});
