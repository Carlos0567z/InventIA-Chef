# InventIA Chef — TFC (2º DAW)

Aplicación web para gestionar la despensa del hogar, buscar recetas según los ingredientes disponibles y preparar listas de compra. Incluye módulos con IA (sugerencias de recetas, lista de compra y reconocimiento por cámara) y una zona de recetas compartidas entre usuarios.

## Estructura del repositorio

| Carpeta | Descripción |
|---------|-------------|
| `inventia-chef-backend` | API REST con Node.js, Express y MongoDB |
| `inventia-chef-frontend` | Interfaz con React y Vite |

## Requisitos

- Node.js 20 o superior
- MongoDB (local o Atlas)
- Variables de entorno en el backend (ver `.env.example` si existe, o crear `.env` con al menos `MONGODB_URI` y `JWT_SECRET`)

Opcional para funciones de IA:

- `GEMINI_API_KEY` o `GEMINI_API_KEYS` (recetas y compra inteligente)
- `GOOGLE_CLIENT_ID` (login con Google)
- Claves de APIs externas que uses (Spoonacular, etc.)

En el frontend, `VITE_GOOGLE_CLIENT_ID` si activas Google Sign-In.

## Arranque en local

### Backend

```bash
cd inventia-chef-backend
npm install
npm run dev
```

Por defecto escucha en el puerto definido en `PORT` (5000 si no se indica).

### Frontend

```bash
cd inventia-chef-frontend
npm install
npm run dev
```

Vite suele abrir en `http://localhost:5173`. Configura el proxy en `vite.config.js` para que las peticiones `/api` lleguen al backend.

## Tests

```bash
# Backend (integración con MongoDB en memoria)
cd inventia-chef-backend
npm test

# Frontend (E2E con Playwright; levanta backend y front automáticamente)
cd inventia-chef-frontend
npm run e2e
```

## Módulos principales

1. **Despensa** — Alta manual, escáner de código de barras y reconocimiento por cámara (Teachable Machine).
2. **Recetas** — Catálogo clásico, sugerencias con Gemini según inventario, favoritos y pendientes.
3. **Comunidad** — Publicar recetas, comentarios, likes y perfiles de cocinero.
4. **Compras** — Historial de tickets y generación de lista según recetas pendientes.
5. **Administración** — Panel para rol `admin` (límites de recetas IA, etc.).

## Autor

Proyecto de fin de ciclo — Desarrollo de Aplicaciones Web.
