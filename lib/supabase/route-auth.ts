import { NextResponse } from "next/server";
import {
  applySessionCookies,
  getRequestSession,
  type VerifiedServerSession,
} from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { ensureUserProfile } from "@/lib/supabase/db";
import type { AuthUser } from "@/lib/types";

export async function authenticateApiRequest(request: Request): Promise<
  | { ok: true; session: VerifiedServerSession; profile: AuthUser }
  | { ok: false; response: NextResponse }
> {
  if (!isSupabaseAuthConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Supabase database persistence is not configured." },
        { status: 503 },
      ),
    };
  }

  const session = await getRequestSession(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  let profile: AuthUser;
  try {
    const ensured = await ensureUserProfile(session.accessToken, session.user);
    profile = ensured.profile;
  } catch {
    profile = {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.user_metadata?.full_name || session.user.email,
      initials: "SM",
      avatarColor: "coral",
      defaultCurrency: "INR",
    };
  }

  return { ok: true, session, profile };
}

export function jsonWithSession(
  body: unknown,
  session: VerifiedServerSession,
  request: Request,
  status = 200,
) {
  const response = NextResponse.json(body, { status });
  if (session.refreshed) {
    applySessionCookies(response, session, request);
  }
  return response;
}

export function errorResponse(error: unknown, fallback = "Request failed.", defaultStatus = 400) {
  const status = (error as Error & { status?: number })?.status;
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: status && status >= 400 && status < 600 ? status : defaultStatus },
  );
}
