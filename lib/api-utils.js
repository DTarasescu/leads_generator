export const API_BASE = process.env.NEXT_PUBLIC_APP_BASE || "";

export function getAccessToken(req) {
  const auth = req.headers.authorization;
  if (typeof auth !== "string" || !auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

export function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}
