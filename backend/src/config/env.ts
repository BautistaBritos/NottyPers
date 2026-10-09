// ============================================================
// Validación de variables de entorno al arrancar (Fail-Fast)
// Si falta una var crítica, el proceso muere con un mensaje claro
// antes de que ningún request llegue al servidor.
// ============================================================

const REQUIRED_VARS = [
  'JWT_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'ADMIN_REGISTRATION_KEY',
] as const;

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `\n❌ FATAL: Faltan variables de entorno obligatorias:\n  ${missing.join('\n  ')}\n`,
    );
    process.exit(1);
  }
}
