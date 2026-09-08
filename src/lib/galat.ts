/** Galat aturan bisnis yang pesannya aman ditampilkan langsung ke pengguna. */
export class ValidasiError extends Error {
  constructor(pesan: string) {
    super(pesan)
    this.name = 'ValidasiError'
  }
}
