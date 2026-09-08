'use server'

import { AuthError } from 'next-auth'
import { signIn } from '@/auth'

export type StatusMasuk = { galat: string | null }

export async function aksiMasuk(_sebelumnya: StatusMasuk, data: FormData): Promise<StatusMasuk> {
  try {
    await signIn('credentials', {
      email: String(data.get('email') ?? ''),
      kataSandi: String(data.get('kataSandi') ?? ''),
      redirectTo: '/dasbor',
    })
    return { galat: null }
  } catch (galat) {
    if (galat instanceof AuthError) {
      return { galat: 'Email atau kata sandi salah' }
    }
    // signIn melempar pengalihan sebagai exception saat berhasil; melemparnya
    // kembali wajib, kalau tidak pengalihan setelah login akan tertelan.
    throw galat
  }
}
