import { test, expect } from '@playwright/test';

// Email unico para el test
function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}@inventia.local`;
}

// Registro rapido por API
async function registerUser(request, { nombre, email, password = 'secreto123' }) {
  const response = await request.post('http://127.0.0.1:3000/api/auth/register', {
    data: { nombre, email, password },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

// Guardamos el token para entrar rapido
async function setSession(page, session) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('inventia_auth_token', token);
    localStorage.setItem('inventia_auth_user', JSON.stringify(user));
  }, session);
}

test.describe('Flujo Principal de la App', () => {

  test('Flujo de despensa: añadir producto manualmente y luego borrarlo', async ({ page, request }) => {
    const email = uniqueEmail('pantry-flow');
    const session = await registerUser(request, { nombre: 'Tester Despensa', email });
    await setSession(page, { token: session.token, user: session.user });

    // Vamos a la pagina de escaner
    await page.goto('/escaner');
    
    // Rellenamos el formulario
    await page.getByPlaceholder('Nombre del producto').fill('Manzanas E2E');
    await page.locator('input[name="cantidad"]').fill('5');
    await page.getByRole('button', { name: 'Guardar en mi despensa' }).click();

    // Deberia llevarnos a la home y verse el producto
    await expect(page).toHaveURL('http://127.0.0.1:5173/');
    await expect(page.getByText('Manzanas E2E')).toBeVisible();

    // Probamos a borrarlo
    await page.locator('.food-card-actions button').filter({ hasText: '' }).last().click();
    
    // Aceptamos el confirm
    page.on('dialog', dialog => dialog.accept());
    
    // Verificamos que ya no esta
    await expect(page.getByText('Manzanas E2E')).not.toBeVisible();
  });

  test('Flujo de recetas: buscar una receta y abrir el detalle', async ({ page, request }) => {
    const email = uniqueEmail('recipe-flow');
    const session = await registerUser(request, { nombre: 'Tester Recetas', email });
    await setSession(page, { token: session.token, user: session.user });

    // Vamos a recetas
    await page.goto('/recetas');
    
    // Buscamos algo comun
    const searchInput = page.getByPlaceholder('Buscar por nombre o descripción...');
    await searchInput.fill('Pasta');
    
    // Si hay resultados, clic en el primero
    const firstRecipe = page.locator('.receta-card').first();
    await expect(firstRecipe).toBeVisible({ timeout: 15000 });
    
    const title = await firstRecipe.locator('h3').innerText();
    await firstRecipe.click();

    // Verificamos el detalle
    await expect(page).toHaveURL(/\/recetas\/\d+/);
    await expect(page.locator('h1')).toHaveText(title);
  });

});
