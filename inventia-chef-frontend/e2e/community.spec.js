import { test, expect } from '@playwright/test';

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@inventia.local`;
}

async function registerUser(request, { nombre, email, password = 'secreto123' }) {
  const response = await request.post('http://127.0.0.1:3000/api/auth/register', {
    data: { nombre, email, password },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function setSession(page, session) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('inventia_auth_token', token);
    localStorage.setItem('inventia_auth_user', JSON.stringify(user));
  }, session);
}

test('comunidad: crear receta con versiones y verla en mis recetas', async ({ page, request }) => {
  const email = uniqueEmail('chef-e2e');
  const session = await registerUser(request, { nombre: 'Chef E2E', email });
  await setSession(page, { token: session.token, user: session.user });

  await page.goto('/recetas-comunidad/contribuir');

  await page.getByPlaceholder('Título de la receta').fill('Receta E2E Versionada');
  await page.getByPlaceholder('Descripción breve').fill('Receta de prueba E2E con versiones.');

  await page.getByPlaceholder('Ingrediente').first().fill('Harina');
  await page.getByPlaceholder('Cantidad').first().fill('250');
  await page.getByPlaceholder('Paso 1').first().fill('Mezclar los ingredientes secos.');

  await page.getByRole('button', { name: 'Añadir versión' }).click();
  await page.getByRole('button', { name: '4 personas' }).click();
  await page.getByPlaceholder('Ingrediente').last().fill('Harina integral');
  await page.getByPlaceholder('Cantidad').last().fill('500');
  await page.getByPlaceholder('Paso 1').last().fill('Mezclar para la versión de 4 personas.');

  await page.getByRole('button', { name: 'Publicar receta' }).click();

  await expect(page).toHaveURL(/\/recetas-comunidad\/mis-recetas/);
  await expect(page.getByText('Receta E2E Versionada')).toBeVisible();
});

test('comunidad: ver detalle de receta publicada', async ({ page, request }) => {
  const email = uniqueEmail('reader-e2e');
  const session = await registerUser(request, { nombre: 'Lector E2E', email });

  const recetaRes = await request.post('http://127.0.0.1:3000/api/recetas-comunidad/gestionar/aportar', {
    headers: { Authorization: `Bearer ${session.token}` },
    data: {
      title: 'Receta E2E Detalle',
      description: 'Para probar la vista de detalle',
      versiones: [
        {
          numero_personas: 2,
          readyInMinutes: 20,
          extendedIngredients: [{ name: 'Tomate', cantidad: 2, unidad: 'unidad', original: '2 unidad Tomate' }],
          analyzedInstructions: [{ steps: [{ number: 1, step: 'Cortar tomate.' }] }],
        },
      ],
    },
  });
  expect(recetaRes.ok()).toBeTruthy();
  const receta = await recetaRes.json();

  await setSession(page, { token: session.token, user: session.user });
  await page.goto(`/recetas-comunidad/${receta._id}`);

  await expect(page.getByRole('heading', { name: 'Receta E2E Detalle' })).toBeVisible();
  await expect(page.getByText('Cortar tomate.')).toBeVisible();
});
