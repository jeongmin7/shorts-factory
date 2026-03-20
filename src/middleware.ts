import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: ['/((?!api/auth|api/health|api/telegram|login|_next|favicon.ico).*)'],
}
