export const ACCESS_COOKIE = "sm_access_token";
export const REFRESH_COOKIE = "sm_refresh_token";
export const SESSION_ID_COOKIE = "sm_session_id";
export const SESSION_CREATED_COOKIE = "sm_session_created_at";
export const OAUTH_PKCE_COOKIE = "sm_oauth_pkce";

export function getSupabaseUrl(): string {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return raw.trim().replace(/\/+$/, "");
}

export function getSupabaseAnonKey(): string {
  const raw = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return raw.trim();
}

export function getSupabaseServiceKey(): string {
  // Strictly server-only: never accept a NEXT_PUBLIC_* prefix for the service role key.
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function isSupabaseDbConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceKey());
}

export function getCanonicalOrigin(requestUrl?: string): string {
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {
      // Fall back to request URL if APP_URL is malformed.
    }
  }
  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      // Ignore invalid URL.
    }
  }
  return "http://localhost:3000";
}
