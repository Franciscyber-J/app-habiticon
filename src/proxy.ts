import { NextRequest, NextResponse } from "next/server";

const COOKIE = "habiticon_admin_auth";
const TOKEN  = "hbt_adm_2026_ipora";

function checkAuth(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const auth = request.cookies.get(COOKIE);
    if (!auth || auth.value !== TOKEN) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }
  return null;
}

// Next.js 16+ usa "proxy" como nome da função exportada
export function proxy(request: NextRequest) {
  return checkAuth(request) ?? NextResponse.next();
}

// Compatibilidade com versões anteriores que ainda esperam "middleware"
export function middleware(request: NextRequest) {
  return checkAuth(request) ?? NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};