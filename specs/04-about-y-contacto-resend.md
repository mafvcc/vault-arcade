# SPEC 04 — Página About + envío de contacto con Resend

> **Estado:** Implementado · **Depende de:** 01-mvp-visual, 03-landing-home · **Fecha:** 2026-06-24
> **Objetivo:** Añadir la página `/about` portada de `about.jsx` y conectar su formulario de contacto a Resend vía un Route Handler que notifica al equipo.

---

## Alcance

**Dentro:**

- **`app/components/About.tsx`** — componente `"use client"` portado tal cual de `references/.../home-about/about.jsx`: hero "SOBRE NOSOTROS", `highlight-row` (3 highlights con `HighlightIcon`), `about-divider`, sección de contacto (`contact-intro` + `contact-form`) y terminal de éxito. Incluye el `useReveal` (`IntersectionObserver`) y el subcomponente `HighlightIcon`.
- **`app/about/page.tsx`** — ruta `/about` que renderiza `<About />`.
- **`app/api/contact/route.ts`** — Route Handler `POST` que recibe `{ name, email, msg }`, valida que los tres campos no estén vacíos, y envía el correo con Resend a `mafvidal@gmail.com` desde `onboarding@resend.dev`. Lee la API key de `process.env.RESEND_API_KEY`. Devuelve `200` en éxito y `4xx/5xx` con `{ error }` en fallo.
- **Cableado del formulario** — `onSubmit` deja de fingir el éxito: hace `fetch("/api/contact", …)`, muestra estado **enviando** (botón deshabilitado), en éxito muestra la terminal de éxito existente, en error muestra mensaje + `shake`. La validación de campos vacíos (shake) se conserva en cliente antes del fetch.
- **`app/components/Nav.tsx`** — añadir enlace "Sobre Nosotros" → `/about` (desktop y panel móvil), después de "Salón de la Fama"; `isAbout = pathname.startsWith("/about")`, marcado activo.
- **`app/globals.css`** — portar desde `references/.../home-about/styles.css` solo las clases del About que faltan: `about`, `about-hero`, `about-title`, `about-mission`, `highlight-row`/`highlight`/`hl-icon`/`hl-text`, `about-divider`/`div-bar`/`div-pixels`, `about-contact`/`contact-grid`/`contact-intro`/`contact-title`/`contact-sub`/`contact-tips`/`tip`/`tip-led`, `contact-form`/`field`, `terminal-success`/`term-*`/`shake`. Sin tocar las existentes.
- **`package.json`** — añadir dependencia `resend`.
- **`.env.local`** (no versionado) con `RESEND_API_KEY=…` y **`.env.example`** con la clave vacía como plantilla.

**Fuera de alcance:**

- Correo de confirmación al remitente (solo se notifica al equipo).
- Dominio verificado propio en Resend — se arranca con `onboarding@resend.dev` y se cambia después (otro cambio, no spec).
- Rate limiting, captcha o honeypot anti-spam.
- Persistir los mensajes (no se guardan en BD ni en disco; solo se envían por correo).
- Plantilla HTML elaborada del email — se envía texto/HTML mínimo con los tres campos.
- Tests automatizados (no hay runner).

---

## Modelo de datos

No se introducen estructuras persistentes (no hay BD ni archivos; el mensaje solo se envía por correo). Las únicas estructuras son el contrato del Route Handler y el estado del formulario:

```ts
// POST /api/contact — cuerpo de la petición
type ContactRequest = {
  name: string;   // form.name
  email: string;  // form.email
  msg: string;    // form.msg
};

// Respuestas
// 200 → { ok: true }
// 400 → { error: "Campos incompletos" }      (validación en servidor)
// 500 → { error: "No se pudo enviar" }        (fallo de Resend / config)
```

```ts
// Estado local del formulario en About.tsx
const [form, setForm]     // { name, email, msg }
const [status, setStatus] // "idle" | "sending" | "sent" | "error"
const [shake, setShake]   // boolean — validación vacía o error
```

Notas:

- El `sent` booleano del prototipo se reemplaza por `status` (`"sent"` dispara la terminal de éxito; conserva el nombre del remitente para el mensaje "GRACIAS, {NOMBRE}").
- El email se compone en el servidor con los tres campos; el `email` del remitente va como `reply_to` para poder responder directo.

---

## Plan de implementación

1. **Dependencia y entorno.** `npm install resend`. Crear `.env.local` con `RESEND_API_KEY=…` (clave real de la cuenta) y `.env.example` con `RESEND_API_KEY=` vacío. Confirmar que `.env.local` está en `.gitignore`. *Verificación:* `npm run dev` arranca sin error; `resend` aparece en `package.json`.

2. **Route Handler `app/api/contact/route.ts`.** Antes de escribirlo, consultar `node_modules/next/dist/docs/01-app` sobre Route Handlers en Next 16 (firma de `POST`, `Request`/`NextResponse`, runtime). Implementar `POST`: parsear el body, validar que `name`/`email`/`msg` no estén vacíos (→ 400), instanciar `new Resend(process.env.RESEND_API_KEY)`, enviar a `mafvidal@gmail.com` desde `onboarding@resend.dev` con `reply_to` = email del remitente, devolver `{ ok: true }` (200) o `{ error }` (500). *Verificación:* `curl -X POST localhost:3000/api/contact` con body válido envía el correo y responde 200; body incompleto responde 400.

3. **Portar CSS del About a `app/globals.css`.** Copiar al final solo las clases ausentes del bloque "Dentro" (verificar con `grep` que no existan ya). *Verificación:* `grep` confirma que `about-hero`, `contact-form`, `highlight-row`, `terminal-success`, `shake` existen una sola vez.

4. **Componente `app/components/About.tsx`.** Portar `about.jsx` como `"use client"` con `HighlightIcon` y `useReveal`. Mantener el marcado idéntico salvo el copy del hero: kicker `▸ ACERCA DE` → `▸ SOBRE NOSOTROS` y título `ACERCA DE ARCADE VAULT` → `SOBRE NOSOTROS`. *Verificación:* importado temporalmente, renderiza hero + highlights + divider + formulario sin error de hidratación.

5. **Ruta `app/about/page.tsx`.** Renderiza `<About />`. *Verificación:* `/about` muestra la pantalla completa; el efecto `reveal` funciona al hacer scroll.

6. **Cablear el formulario al endpoint.** Sustituir el `onSubmit` fake: validar vacíos (shake) → `setStatus("sending")` → `fetch("/api/contact", { method:"POST", body: JSON.stringify(form) })` → en `ok` `setStatus("sent")` (terminal de éxito), en fallo `setStatus("error")` + shake + mensaje. Botón deshabilitado mientras `"sending"`. *Verificación:* enviar un mensaje real llega a `mafvidal@gmail.com`; con la API key inválida aparece el estado de error.

7. **Enlace en la Nav.** `app/components/Nav.tsx`: añadir "Sobre Nosotros" → `/about` tras "Salón de la Fama" (desktop + panel móvil); `isAbout = pathname.startsWith("/about")`. El enlace muestra el texto "Sobre Nosotros". *Verificación:* "Sobre Nosotros" navega a `/about` y se marca activo solo ahí.

8. **Limpieza.** `npm run build` y `npm run lint` sin errores ni warnings de hidratación. *Verificación:* build/lint limpios.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] La consola no muestra errores ni warnings de hidratación en `/about`.
- [ ] `/about` renderiza: hero con kicker `▸ SOBRE NOSOTROS` y título `SOBRE NOSOTROS`, `about-mission`, 3 highlights, `about-divider` y la sección de contacto.
- [ ] El efecto `reveal` (fade-in al hacer scroll) funciona en el divider y la sección de contacto.
- [ ] Enviar el formulario con los tres campos llenos hace `POST /api/contact` y el correo llega a `mafvidal@gmail.com` (remitente `onboarding@resend.dev`, `reply_to` = email escrito).
- [ ] Mientras envía, el botón queda deshabilitado (estado "enviando").
- [ ] En éxito se muestra la terminal `VAULT-OS` con "GRACIAS, {NOMBRE}"; "ENVIAR OTRO MENSAJE" resetea el formulario.
- [ ] Con un campo vacío, el formulario hace `shake` y **no** llama al endpoint.
- [ ] Si Resend falla (p.ej. API key inválida), se muestra estado de error + `shake` y **no** se muestra la terminal de éxito.
- [ ] `POST /api/contact` con body incompleto responde 400; con body válido responde 200.
- [ ] La API key nunca aparece en el bundle del cliente (solo se usa en el Route Handler).
- [ ] La Nav muestra "Sobre Nosotros" → `/about` (desktop y móvil), activo solo en `/about`; el resto de enlaces sin regresión.

---

## Decisiones

- **Sí:** ruta `/about` en inglés, aunque el texto visible sea "Sobre Nosotros". El usuario lo pidió así; separa la URL (estable) del copy (editable).
- **Sí:** texto "Sobre Nosotros" en Nav y hero, en vez de "Acerca de". Decisión de copy del usuario.
- **Sí:** extraer el About a `app/components/About.tsx` (no dejarlo inline en `page.tsx` como el landing). El usuario lo pidió; además tiene formulario con lógica propia que conviene aislar.
- **Sí:** envío por **Route Handler** server-side (`app/api/contact`). Es la única forma de usar Resend sin exponer la API key; vive dentro de la app Next ("todo local"), sin backend externo.
- **No:** llamar a Resend desde el cliente. Filtraría la API key en el bundle.
- **Sí:** `onboarding@resend.dev` como remitente provisional. Permite enviar sin dominio verificado; se cambia luego.
- **Sí:** destinatario fijo `mafvidal@gmail.com` en el servidor. Único receptor del equipo por ahora; no se expone en el cliente.
- **Sí:** `reply_to` = email del remitente. Permite responder al usuario directamente desde el correo recibido.
- **No:** correo de confirmación al remitente. Fuera de alcance; solo se notifica al equipo.
- **No:** persistir los mensajes. Solo se envían por correo; añadir BD abriría su propio alcance.
- **No:** rate limiting / captcha / honeypot. Aceptado el riesgo de spam por ahora; entra en otro spec si hace falta.
- **Sí:** estados `sending`/`error` además de `sent`. El usuario los pidió; sin ellos un fallo de red dejaría el form mudo.
- **Sí:** portar solo las clases CSS del About que faltan, sin tocar las existentes. Evita divergencia y duplicación (igual criterio que spec 03).

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `onboarding@resend.dev` en modo prueba **solo** entrega al email de la cuenta Resend; si `mafvidal@gmail.com` no es la cuenta dueña, el correo no llega. | Verificar que `mafvidal@gmail.com` es el email de la cuenta Resend antes de probar; si no, usar ese email como destinatario temporal hasta verificar dominio propio. |
| `RESEND_API_KEY` ausente o mal configurada en `.env.local` deja el endpoint en 500 silencioso. | El handler valida la key y devuelve `{ error }`; el form muestra estado de error visible. `.env.example` documenta la variable. |
| API de Route Handlers distinta en Next 16 (firma, `runtime`, `Request`/`Response`). | Consultar `node_modules/next/dist/docs/01-app` antes de escribir el handler (paso 2). |
| Desajuste de hidratación al portar `about.jsx` (igual que el landing). | Sin `Math.random` en render; el `IntersectionObserver` vive en `useEffect`; arrays literales fijos. |
| Colisión de nombres de clase al pegar el CSS del prototipo. | `grep` de cada clase antes de pegar; portar solo las ausentes (paso 3). |
| Spam o abuso del endpoint público `/api/contact`. | Aceptado por ahora (sin rate limiting); validación de campos vacíos en servidor; mitigación real en otro spec. |

---

## Lo que **no** entra en este spec

- Correo de confirmación al remitente.
- Dominio propio verificado en Resend (sigue `onboarding@resend.dev`).
- Rate limiting, captcha o honeypot.
- Persistir los mensajes en BD o disco.
- Plantilla HTML elaborada del email.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
