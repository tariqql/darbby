/**
 * Derives a database-specific connection URL from the base DATABASE_URL
 * by replacing the database name segment.
 */
export function buildDbUrl(dbName: string): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL must be set");
  const envKey = `DATABASE_${dbName.toUpperCase().replace(/-/g, "_")}_URL`;
  const explicit = process.env[envKey];
  if (explicit) return explicit;
  return base.replace(/\/([^/?]+)(\?|$)/, `/${dbName}$2`);
}
