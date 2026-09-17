import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Authentication must never intercept install/update assets or Vercel's
    // own observability endpoints. In particular, /sw.js must be returned as
    // JavaScript even when no Supabase session is present; redirecting it to
    // /login leaves installed clients pinned to an old bundle. Likewise,
    // /_vercel/* must remain available for Analytics and Speed Insights.
    "/((?!_next/static|_next/image|_vercel|favicon.ico|sw.js|manifest.webmanifest|offline|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
