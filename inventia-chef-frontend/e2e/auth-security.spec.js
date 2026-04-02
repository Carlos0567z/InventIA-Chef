import { test, expect } from '@playwright/test';

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}@inventia.local`;
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

test.describe('Seguridad y Autenticación', () => {
  
  test('debe redirigir a /auth al intentar entrar en ruta protegida sin login', async ({ page }) => {
    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/auth\?next=%2Fperfil/);
  });

  test('no debe permitir inyección XSS básica en el nombre de perfil', async ({ page, request }) => {
    const email = uniqueEmail('xss-test');
    const session = await registerUser(request, { nombre: 'Test XSS', email });
    await setSession(page, { token: session.token, user: session.user });

    await page.goto('/perfil');
    
    // Probamos un script en el nombre
    const xssPayload = 'Usuario <script>window.alert("xss")</script>';
    await page.getByPlaceholder('Nombre completo').fill(xssPayload);
    await page.getByRole('button', { name: 'Guardar' }).first().click();

    // Se guarda el texto pero no se ejecuta el script
    await expect(page.getByText('Perfil actualizado correctamente')).toBeVisible();
    
    // Recargamos para comprobar que sigue como texto
    await page.reload();
    const val = await page.getByPlaceholder('Nombre completo').inputValue();
    expect(val).toBe(xssPayload);
  });

  test('no debe filtrar información sensible en localStorage', async ({ page, request }) => {
    const email = uniqueEmail('storage-test');
    const session = await registerUser(request, { nombre: 'Secure User', email });
    await setSession(page, { token: session.token, user: session.user });

    await page.goto('/');
    
    const keys = await page.evaluate(() => Object.keys(localStorage));
    // Solo deben quedar las keys de auth
    const sensibleKeys = keys.filter(k => k.includes('password') || k.includes('secret') || k.includes('key') && !k.includes('auth'));
    expect(sensibleKeys.length).toBe(0);
  });

  test('bloqueo de acceso a /admin para usuarios normales', async ({ page, request }) => {
    const email = uniqueEmail('normal-user');
    const session = await registerUser(request, { nombre: 'Usuario Normal', email });
    
    // Dejamos el rol como usuario normal
    session.user.rol = 'usuario';
    await setSession(page, { token: session.token, user: session.user });

    await page.goto('/admin');
    // Debería redirigir a / porque no es admin
    await expect(page).toHaveURL('http://127.0.0.1:5173/');
  });

});
