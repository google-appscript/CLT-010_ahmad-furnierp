'use server'

import { signOut } from '@/auth'

export async function aksiKeluar() {
  await signOut({ redirectTo: '/masuk' })
}
