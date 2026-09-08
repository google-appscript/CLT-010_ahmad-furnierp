import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: { id: string; izin: string[] } & DefaultSession['user']
  }
  interface User {
    izin?: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    penggunaId?: string
    izin?: string[]
  }
}
