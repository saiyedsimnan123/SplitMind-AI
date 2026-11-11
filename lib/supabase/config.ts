export const ACCESS_COOKIE = "sm_access_token";
export const REFRESH_COOKIE = "sm_refresh_token";
export const SESSION_ID_COOKIE = "sm_session_id";
export const SESSION_CREATED_COOKIE = "sm_session_created_at";

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

function originFromRequestHeaders(request?: Request): string | null {
  if (!request) return null;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (!host || /[\s/\\]/.test(host)) return null;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : "https";
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}

export function getCanonicalOrigin(requestUrl?: string, request?: Request): string {
  // In Vercel Preview deployments, prefer the active preview host so password-reset emails return here.
  if (process.env.VERCEL_ENV === "preview") {
    const headerOrigin = originFromRequestHeaders(request);
    if (headerOrigin) return headerOrigin;
    if (requestUrl) {
      try {
        return new URL(requestUrl).origin;
      } catch {
        // Ignore malformed request URL.
      }
    }
    if (process.env.VERCEL_URL?.trim()) {
      try {
        return new URL(`https://${process.env.VERCEL_URL.trim()}`).origin;
      } catch {
        // Ignore malformed VERCEL_URL.
      }
    }
  }

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {
      // Fall back to request origin if APP_URL is malformed.
    }
  }

  const headerOrigin = originFromRequestHeaders(request);
  if (headerOrigin) return headerOrigin;

  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      // Ignore invalid URL.
    }
  }
  return "http://localhost:3000";
}
