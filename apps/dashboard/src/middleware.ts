import { NextResponse, type NextRequest } from "next/server";

// Une app, deux espaces : admin.<domaine> → /admin/*, vendeur.<domaine> → /vendor/*
// L'autorisation réelle (rôle admin / membre du vendeur) est TOUJOURS vérifiée par l'API.
export function middleware(req: NextRequest) {
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
  if (isLocalHost && hasExplicitSpace) return NextResponse.next();

  const space = host === process.env.ADMIN_HOST ? "/admin" : "/vendor";
  if (pathname === space || pathname.startsWith(`${space}/`)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `${space}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
