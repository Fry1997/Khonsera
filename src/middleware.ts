import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Authentication must never intercept the install/update assets used by the
    // PWA. In particular, /sw.js must be returned as JavaScript even when no
    // Supabase session is present; redirecting it to /login leaves installed
    // clients permanently pinned to an old bundle.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
