import { NextResponse, type NextRequest } from "next/server";

// Une app, deux espaces : admin.<domaine> → /admin/*, vendeur.<domaine> → /vendor/*
// L'autorisation réelle (rôle admin / membre du vendeur) est TOUJOURS vérifiée par l'API.
export async function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.split(":")[0];
  const { pathname } = req.nextUrl;
  if (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/_next" ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const hasExplicitSpace = /^\/(admin|vendor)(\/|$)/.test(pathname);
  const space = isLocalHost && hasExplicitSpace
    ? (pathname.startsWith("/admin") ? "/admin" : "/vendor")
    : host === process.env.ADMIN_HOST ? "/admin" : "/vendor";
  const resolvedPath = isLocalHost && hasExplicitSpace ? pathname : `${space}${pathname === "/" ? "" : pathname}`;
  if (resolvedPath === "/admin" || resolvedPath.startsWith("/admin/")) {
    const apiUrl = process.env.API_INTERNAL_URL ?? process.env.API_URL ?? "http://localhost:8000";
    let role = "";
    try {
      const session = await fetch(`${apiUrl}/v1/admin/session`, {
        headers: { cookie: req.headers.get("cookie") ?? "" },
        cache: "no-store",
      });
      if (session.ok) role = (await session.json()).role;
      if (session.status === 403) return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
    } catch {
      // Fail closed if the API cannot verify the browser session.
    }
    if (role !== "admin") {
      const login = new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
      login.searchParams.set("redirect", resolvedPath);
      return NextResponse.redirect(login);
    }
  }
  if (isLocalHost && hasExplicitSpace) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = resolvedPath;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
