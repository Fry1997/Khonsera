import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  // PWA bootstrap/update assets must remain available before authentication.
  // A service worker request cannot follow an HTML login redirect and will
  // otherwise leave an installed app running an obsolete JavaScript bundle.
  "/sw.js",
  "/manifest.webmanifest",
  "/offline",
  // /reset-password is intentionally NOT public — it requires the recovery
  // session that /auth/callback installs after the magic link exchange.
  "/auth/callback",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (publicPath) =>
      path === publicPath || path.startsWith(`${publicPath}/`),
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    if (isPublic) return response;

    // Surface a clear message in the response body instead of crashing the
    // middleware. Explicitly public routes remain available, while protected
    // application routes fail closed until the deployment is configured.
    return new NextResponse(
      "Supabase env vars missing on this deployment (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      { status: 500 },
    );
  }

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet: CookieToSet[]) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}
