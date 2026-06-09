import { test, expect } from '@playwright/test';

// Authentification (§8). Utilise les comptes de démonstration du seed.
test.describe('Authentification', () => {
  test('connexion cabinet réussie', async ({ page }) => {
    await page.goto('/fr/login');
    await page.fill('input[name=email]', 'collab@bbassocies.ch');
    await page.fill('input[name=password]', 'changeme-collab');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/fr\/tableau-de-bord/);
    await expect(page.getByRole('heading', { name: /Tableau de bord/ })).toBeVisible();
  });

  test('identifiants incorrects → message d’erreur', async ({ page }) => {
    await page.goto('/fr/login');
    // e-mail inexistant : ne verrouille aucun compte réel.
    await page.fill('input[name=email]', 'inconnu@example.test');
    await page.fill('input[name=password]', 'mauvais');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText('Identifiants incorrects')).toBeVisible();
  });

  test('route cabinet protégée → redirige vers la connexion', async ({ page }) => {
    await page.goto('/fr/tableau-de-bord');
    await expect(page).toHaveURL(/\/fr\/login/);
  });
});
