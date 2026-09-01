import { NextResponse } from 'next/server'

export function middleware(request) {
  const basicAuth = request.headers.get('authorization')

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1]
    try {
      const [user, pwd] = atob(authValue).split(':')
      const authUser = process.env.AUTH_USER
      const authPassword = process.env.AUTH_PASSWORD

      // If environment variables are not set, reject access
      if (!authUser || !authPassword) {
        console.error('Authentication environment variables not set.');
        return new NextResponse('Authentication Service Configuration Error', {
          status: 500,
        })
      }

      if (user === authUser && pwd === authPassword) {
        return NextResponse.next()
      }
    } catch (e) {
      // Malformed header, ignore and let it fall through to 401
    }
  }

  return new NextResponse('Authentication Required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  })
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
