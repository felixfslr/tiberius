/**
 * Canonical app URL used in docs, curl examples, and sidebar display.
 * Override with NEXT_PUBLIC_APP_URL when running behind a different host.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NODE_ENV === "development") return "http://localhost:3007";
  return "https://asktiberius.de";
}

/** Domain without protocol — used where a hostname is expected (sidebar, docs). */
export function getAppDomain(): string {
  return getAppUrl().replace(/^https?:\/\//, "");
}
