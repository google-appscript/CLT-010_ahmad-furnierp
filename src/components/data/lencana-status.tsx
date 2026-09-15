import { Badge } from '@/components/ui/badge'
import { cn } from 'cn'

/**
 * Warna status dipusatkan di sini supaya satu keadaan selalu tampil dengan
 * warna yang sama di seluruh aplikasi. Yang diwarnai adalah *maknanya*, bukan
 * nama statusnya: dokumen yang belum mengikat berwarna netral, yang sedang
 * berjalan biru, yang tuntas hijau, yang dibekukan ungu, dan yang batal merah.
 * Modul boleh memakai istilah berbeda untuk keadaan yang sama — `selesai` di
 * gudang dan `diposting` di akuntansi sama-sama berarti tuntas — dan tetap
 * mendapat warna yang sama.
 */
export type NadaStatus =
  | 'netral' | 'proses' | 'tuntas' | 'beku' | 'batal' | 'perhatian'

const KELAS: Record<NadaStatus, string> = {
  netral:
    'bg-slate-500/10 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300',
  proses:
    'bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
  tuntas:
    'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  beku:
    'bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
  batal:
    'bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
  perhatian:
    'bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
}

/** Status dari seluruh modul dipetakan ke nada yang sama bila artinya sama. */
const NADA: Record<string, NadaStatus> = {
  // Belum mengikat — masih boleh diubah bebas.
  draft: 'netral',
  penawaran: 'netral',
  permintaan: 'netral',
  belum_mulai: 'netral',
  nonaktif: 'netral',

  // Sedang berjalan — sudah mengikat, belum tuntas.
  dikonfirmasi: 'proses',
  berjalan: 'proses',
  sebagian: 'proses',

  // Tuntas.
  selesai: 'tuntas',
  diposting: 'tuntas',
  lunas: 'tuntas',
  aktif: 'tuntas',
  direkonsiliasi: 'tuntas',

  // Dibekukan — tidak lagi menerima perubahan.
  terkunci: 'beku',
  dilepas: 'beku',

  // Batal atau ditolak.
  dibatalkan: 'batal',
  ditolak: 'batal',

  // Butuh tindak lanjut.
  jatuh_tempo: 'perhatian',
  belum_dibayar: 'perhatian',
  lunas_sebagian: 'perhatian',
}

export function nadaStatus(status: string): NadaStatus {
  return NADA[status] ?? 'netral'
}

export function LencanaStatus({
  status, label, nada, className,
}: {
  /** Kunci status domain, dipakai memilih warna bila `nada` tidak diberikan. */
  status?: string
  label: React.ReactNode
  nada?: NadaStatus
  className?: string
}) {
  const dipakai = nada ?? nadaStatus(status ?? '')
  return (
    <Badge variant="outline" className={cn('border-transparent', KELAS[dipakai], className)}>
      {label}
    </Badge>
  )
}
