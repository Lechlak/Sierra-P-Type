import { NextResponse } from "next/server";

export const config = {
  matcher: "/integrations/:path*",
};

export function middleware(request) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-createxyz-project-id", "3074d333-1699-4ada-856c-574124a676a7");
  requestHeaders.set("x-createxyz-project-group-id", "4179a66f-fa9d-4239-b443-0e351eea6c0f");


  request.nextUrl.href = ``;

  return NextResponse.rewrite(request.nextUrl, {
    request: {
      headers: requestHeaders,
    },
  });
}