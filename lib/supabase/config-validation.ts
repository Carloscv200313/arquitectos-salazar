/** Pure validation: never include environment values in errors. */
export function validateProductionConfig(env: Record<string, string | undefined>) {
  if (env.NODE_ENV !== "production") return;
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "AUTH_SECRET"];
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`Configuración obligatoria ausente: ${missing.join(", ")}`);
  if (env.AUTH_SECRET === "dev-insecure-secret-change-me") {
    throw new Error("AUTH_SECRET no puede usar el valor de desarrollo.");
  }
}
