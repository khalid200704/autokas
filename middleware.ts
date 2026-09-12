import { NextResponse, type NextRequest } from "next/server";

// Auth is intentionally optional while the product prototype is being built.
// Supabase protection can be restored once the Google provider is configured.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
