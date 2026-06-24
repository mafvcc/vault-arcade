import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente de Supabase para usar en el servidor (Server Components, Route
// Handlers, Server Actions). Integra la sesión con las cookies de la petición.
// `cookies()` es asíncrono en Next 16, por eso la fábrica es async.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` se llamó desde un Server Component, donde no se pueden
            // escribir cookies. Es esperado: el refresco real de la sesión lo
            // hace el `proxy` (lib/supabase/middleware.ts).
          }
        },
      },
    },
  );
}
