import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresca la sesión de Supabase en cada petición y propaga las cookies
// actualizadas tanto a la petición (para Server Components aguas abajo) como a
// la respuesta (para el navegador). Patrón oficial de @supabase/ssr para App
// Router; invocado desde `proxy.ts`.
//
// No redirige ni protege rutas: eso es trabajo de specs futuros. Aquí solo se
// mantiene viva la sesión.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: no metas lógica entre crear el cliente y getUser(); refresca
  // el token de la sesión.
  await supabase.auth.getUser();

  return supabaseResponse;
}
