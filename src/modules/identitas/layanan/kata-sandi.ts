import bcrypt from 'bcryptjs'

const PUTARAN = 12
export const PANJANG_MINIMAL = 8

export async function hashKataSandi(kataSandi: string): Promise<string> {
  if (kataSandi.length < PANJANG_MINIMAL) {
    throw new Error(`Kata sandi minimal ${PANJANG_MINIMAL} karakter`)
  }
  return bcrypt.hash(kataSandi, PUTARAN)
}

export async function cocokKataSandi(kataSandi: string, hash: string): Promise<boolean> {
  return bcrypt.compare(kataSandi, hash)
}
