import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Proxy (antes "middleware"; renombrado en Next 16). Refresca la sesión de
// Supabase en cada petición. No redirige ni protege rutas todavía.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Corre en todas las rutas excepto estáticos, optimización de imágenes,
    // favicon y archivos de imagen, para no bloquear assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
