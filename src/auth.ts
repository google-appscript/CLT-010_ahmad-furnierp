import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { authConfig } from './auth.config'
import { verifikasiKredensial } from './modules/identitas/layanan/autentikasi'

const skemaMasuk = z.object({
  email: z.email(),
  kataSandi: z.string().min(1),
})

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, kataSandi: {} },
      async authorize(kredensial) {
        const hasil = skemaMasuk.safeParse(kredensial)
        if (!hasil.success) return null
        try {
          const pengguna = await verifikasiKredensial(hasil.data.email, hasil.data.kataSandi)
          return {
            id: pengguna.id,
            email: pengguna.email,
            name: pengguna.nama,
            izin: pengguna.izin,
          }
        } catch {
          return null
        }
      },
    }),
  ],
})
