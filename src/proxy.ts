import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

// Next.js 16 memakai konvensi "proxy" menggantikan "middleware".
// Di sini hanya keberadaan sesi yang diperiksa lewat JWT; pemeriksaan izin
// yang sesungguhnya dilakukan di komponen server dan Server Action, sehingga
// lapisan ini tidak perlu menyentuh basis data.
const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
