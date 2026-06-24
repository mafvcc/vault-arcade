# SPEC 05 — Integración de Supabase

> **Estado:** Implementado · **Depende de:** — · **Fecha:** 2026-06-24
> **Objetivo:** Dejar instalado y configurado el andamiaje de Supabase (clientes de navegador y servidor + refresco de sesión vía `proxy`) para que specs futuros construyan auth, scores y catálogo encima, sin cablear ninguna funcionalidad todavía.

---

## Alcance

**Dentro:**

- **`package.json`** — añadir dependencias `@supabase/supabase-js` y `@supabase/ssr`.
- **`lib/supabase/client.ts`** — fábrica del **cliente de navegador** (`createBrowserClient` de `@supabase/ssr`). Lee `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Para usar en Client Components.
- **`lib/supabase/server.ts`** — fábrica del **cliente de servidor** (`createServerClient` de `@supabase/ssr`), `async`, integrada con `cookies()` de `next/headers` (`getAll`/`setAll`). Para Server Components, Route Handlers y `proxy`.
- **`lib/supabase/middleware.ts`** — helper `updateSession(request)` que refresca la sesión y propaga las cookies en la respuesta (patrón oficial de `@supabase/ssr` para App Router).
- **`proxy.ts`** (raíz del proyecto, convención Next 16) — exporta `proxy` que delega en `updateSession`, con `config.matcher` que excluye estáticos (`_next/static`, `_next/image`, favicon, assets).
- **`.env.local`** (no versionado) con `NEXT_PUBLIC_SUPABASE_URL=…` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…` (claves provistas por ti).
- **`.env.example`** con ambas variables vacías como plantilla.

**Fuera de alcance (specs futuros):**

- **Auth real** — registro, login, logout, OAuth (Google/GitHub), magic link. Los botones de `/auth` y el `AuthProvider` (localStorage) **no se tocan**.
- **Scores/Salón** — persistir puntuaciones ni conectar el Salón de la Fama a la BD; sigue con `seededScores`.
- **Catálogo** — `GAMES` sigue estático en `lib/data.ts`.
- **Tablas, RLS, migraciones, tipos generados** de la BD — no se crea esquema; el cliente servidor usa solo la clave publishable (sin clave secreta/admin).
- **Protección de rutas** server-side — el `proxy` solo refresca sesión; no redirige ni bloquea nada todavía.
- **Endpoint o página de verificación** — la integración se valida con instanciación + `npm run build` (decisión del usuario).
- Tests automatizados (no hay runner).

---

## Modelo de datos

No se introducen estructuras de datos nuevas. No se crean tablas, esquema ni tipos de BD; el catálogo (`GAMES`), la sesión (`AuthProvider` sobre localStorage) y el Salón (`seededScores`) siguen igual.

Las únicas estructuras de esta integración son las variables de entorno, consumidas por las fábricas de cliente:

```bash
# .env.local (no versionado) y .env.example (plantilla, vacías)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Ambas con prefijo `NEXT_PUBLIC_` porque la clave publishable está pensada para exponerse al cliente (el control de acceso real vendrá de RLS en specs futuros). No hay clave secreta/servicio en este spec.

---

## Plan de implementación

1. **Dependencias y entorno.** `npm install @supabase/supabase-js @supabase/ssr`. Crear `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (claves reales). Crear `.env.example` con ambas vacías. Confirmar que `.env.local` está en `.gitignore`. _Verificación:_ `npm run dev` arranca sin error; ambos paquetes aparecen en `package.json`.

2. **Cliente de navegador `lib/supabase/client.ts`.** `createClient()` que envuelve `createBrowserClient(url, publishableKey)` leyendo las dos env vars. _Verificación:_ `npm run lint` sin errores; el archivo typechequea.

3. **Cliente de servidor `lib/supabase/server.ts`.** Antes de escribirlo, leer `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` (firma async de `cookies()` en Next 16). `createClient()` `async` que envuelve `createServerClient` con `cookies()` (`getAll`/`setAll`, con `try/catch` en `setAll` para el caso de Server Component donde no se pueden escribir cookies). _Verificación:_ typechequea; `await createClient()` compila.

4. **Helper `lib/supabase/middleware.ts`.** `updateSession(request: NextRequest)`: crea un `NextResponse`, instancia `createServerClient` leyendo/escribiendo cookies sobre `request`/`response`, llama a `supabase.auth.getUser()` para refrescar la sesión, y devuelve la respuesta con las cookies propagadas (patrón oficial `@supabase/ssr`). Sin redirecciones (fuera de alcance). _Verificación:_ typechequea.

5. **`proxy.ts` en la raíz.** Antes de escribirlo, leer `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` y `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`. Exporta `proxy(request)` que hace `return await updateSession(request)`, y `config.matcher` excluyendo `_next/static`, `_next/image`, `favicon.ico` y assets de imagen. _Verificación:_ `npm run dev` levanta y navegar por `/`, `/juego`, `/about` sigue funcionando igual (el proxy no rompe rutas ni estáticos).

6. **Limpieza.** `npm run build` y `npm run lint` sin errores ni warnings. _Verificación:_ build/lint limpios; las rutas existentes no muestran regresión.

Nota: el orden deja el sistema funcional en cada paso. El `proxy` (paso 5) es el único que afecta runtime de rutas existentes; por eso su verificación es navegar y confirmar que no hay regresión.

---

## Criterios de aceptación

- [ ] `@supabase/supabase-js` y `@supabase/ssr` aparecen en `dependencies` de `package.json`.
- [ ] `.env.local` define `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, y está ignorado por git.
- [ ] `.env.example` lista ambas variables vacías.
- [ ] Existe `lib/supabase/client.ts` que exporta una fábrica del cliente de navegador (`createBrowserClient`).
- [ ] Existe `lib/supabase/server.ts` que exporta una fábrica `async` del cliente de servidor (`createServerClient`) integrada con `cookies()` de `next/headers`.
- [ ] Existe `lib/supabase/middleware.ts` que exporta `updateSession(request)`.
- [ ] Existe `proxy.ts` en la raíz que exporta `proxy` (delegando en `updateSession`) y un `config.matcher` que excluye `_next/static`, `_next/image`, `favicon.ico` y assets de imagen.
- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores ni warnings.
- [ ] Navegar `/`, `/juego`, `/juego/[id]`, `/about`, `/salon` y `/auth` funciona igual que antes (sin regresión); los estáticos (CSS/JS/imágenes) cargan.
- [ ] La clave secreta/servicio **no** aparece en el repo (no se usa en este spec).
- [ ] El `AuthProvider`, `/auth`, `seededScores` y `lib/data.ts` quedan **sin modificar**.

---

## Decisiones

- **Sí:** solo la integración (andamiaje), sin cablear auth, scores ni catálogo. Lo pediste así; deja una base estable sobre la que cada spec futuro construye su parte sin reescribir plumbing.
- **Sí:** `@supabase/ssr` con clientes de navegador **y** servidor. Pediste ambos; es el patrón recomendado para App Router y habilita sesión en Server Components y Route Handlers desde el primer spec de auth.
- **No:** solo cliente `supabase-js` en navegador. Descartado: dejaría la sesión sin acceso server-side y obligaría a reescribir el plumbing al construir auth real.
- **Sí:** archivo **`proxy.ts`** en la raíz (no `middleware.ts`). Next 16 renombró Middleware a Proxy; usar el nombre antiguo está deprecado.
- **Sí:** el `proxy` solo refresca sesión (`getUser`), sin redirecciones ni protección de rutas. La protección es decisión de cada spec funcional; meterla aquí inflaría el alcance y podría romper rutas existentes.
- **Sí:** esquema de claves **publishable** (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Son las variables que ya tienes; es el esquema vigente de Supabase.
- **No:** clave secreta/servicio en este spec. No hace falta sin operaciones admin; el acceso real se controlará con RLS más adelante. Evita exponer una credencial sensible antes de tiempo.
- **Sí:** verificar solo con instanciación + `npm run build`. Lo elegiste; sin funcionalidad cableada todavía no hay flujo que probar end-to-end.
- **No:** endpoint/página de salud temporal. Descartado por tu decisión de verificación; se evita crear y luego borrar código.
- **Sí:** no tocar `AuthProvider`, `/auth`, `seededScores` ni `lib/data.ts`. Migrar esos a Supabase es trabajo de los specs siguientes; mantenerlos intactos evita regresiones aquí.

---

## Riesgos

| Riesgo                                                                                                         | Mitigación                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| El `proxy.ts` sin `matcher` (o mal configurado) intercepta estáticos y rompe CSS/JS/imágenes.                  | `config.matcher` excluye `_next/static`, `_next/image`, `favicon.ico` y assets (paso 5); criterio de aceptación de no-regresión lo cubre. |
| Usar `middleware.ts` (nombre viejo) en vez de `proxy.ts`: deprecado en Next 16, comportamiento no garantizado. | Leer los docs de Proxy antes de escribir (paso 5); el archivo se llama `proxy.ts` y exporta `proxy`.                                      |
| `cookies()` es asíncrono en Next 16; tratarlo como síncrono rompe el cliente servidor.                         | Leer `cookies.md` antes (paso 3); `createClient()` del servidor es `async` y hace `await cookies()`.                                      |
| `setAll` lanza al llamarse desde un Server Component (no se pueden escribir cookies en render).                | Envolver `setAll` en `try/catch` en `server.ts`; el refresco real de cookies ocurre en el `proxy` (patrón oficial).                       |
| Variables de entorno ausentes dejan el cliente apuntando a `undefined` y fallos opacos en runtime.             | `.env.example` documenta ambas; `.env.local` se configura en el paso 1 antes de cualquier uso.                                            |
| Exponer una clave equivocada (secreta) con prefijo `NEXT_PUBLIC_`.                                             | Solo se usa la clave **publishable** (pensada para cliente); criterio de aceptación verifica que no hay clave secreta en el repo.         |

---

## Lo que **no** entra en este spec

- Auth real: registro, login, logout, OAuth (Google/GitHub), magic link.
- Tocar `AuthProvider`, `/auth`, `seededScores` o `lib/data.ts`.
- Persistir scores o conectar el Salón de la Fama a la BD.
- Mover el catálogo `GAMES` a Supabase.
- Tablas, RLS, migraciones, tipos TypeScript generados, cliente admin/clave secreta.
- Protección/redirección de rutas en el `proxy`.
- Endpoint o página de verificación.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
