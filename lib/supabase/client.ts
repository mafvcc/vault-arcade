import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

// Cliente de Supabase para usar en Client Components (navegador).
// Lee la URL y la clave publishable de las variables NEXT_PUBLIC_*, que están
// pensadas para exponerse al cliente; el control de acceso real vendrá de RLS
// en specs futuros.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
