export function getWorkspace(): { name: string; domain: string } {
  const domain =
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL ||
    "localhost:3007";
  return { name: "Tiberius", domain };
}
