import type { NextAuthConfig } from 'next-auth'

/**
 * Konfigurasi yang bebas dari akses basis data sehingga aman dipakai
 * middleware. Provider yang menyentuh basis data ada di src/auth.ts.
 */
export const authConfig = {
  pages: { signIn: '/masuk' },
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const sudahMasuk = Boolean(auth?.user)
      const diHalamanMasuk = request.nextUrl.pathname.startsWith('/masuk')
      if (diHalamanMasuk) {
        return sudahMasuk ? Response.redirect(new URL('/dasbor', request.nextUrl)) : true
      }
      return sudahMasuk
    },
    jwt({ token, user }) {
      if (user) {
        token.penggunaId = user.id as string
        token.izin = (user as { izin?: string[] }).izin ?? []
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.penggunaId as string
      session.user.izin = (token.izin as string[]) ?? []
      return session
    },
  },
} satisfies NextAuthConfig
