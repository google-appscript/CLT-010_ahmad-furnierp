import { wajibIzin } from '@/lib/sesi'
import { daftarAkun } from '@/modules/akuntansi/layanan/akun'
import { daftarJurnal } from '@/modules/akuntansi/layanan/jurnal'
import { daftarPartner } from '@/modules/akuntansi/layanan/partner'
import { daftarProyek } from '@/modules/proyek/layanan/proyek'
import { daftarPosBiaya } from '@/modules/akuntansi/layanan/pos-biaya'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirEntri } from '../formulir-entri'

export const metadata = { title: 'Entri Jurnal Baru' }

export default async function HalamanEntriBaru() {
  await wajibIzin('akuntansi.jurnal.lihat')
  const [akun, jurnal, partner, proyek, posBiaya] = await Promise.all([
    daftarAkun(), daftarJurnal(), daftarPartner(), daftarProyek(),
    daftarPosBiaya({ hanyaAktif: true }),
  ])

  const jurnalAktif = jurnal.filter((j) => j.isActive)

  return (
    <>
      <KepalaHalaman
        judul="Entri Jurnal Baru"
        deskripsi="Entri disimpan sebagai draft dan belum masuk laporan sampai diposting."
      />
      <FormulirEntri
        awal={{
          journalId: jurnalAktif[0]?.id ?? '',
          tanggal: new Date().toISOString().slice(0, 10),
          referensi: '',
          keterangan: '',
          partnerId: '',
          item: [],
        }}
        akun={akun.filter((a) => a.isActive).map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }))}
        jurnal={jurnalAktif.map((j) => ({ id: j.id, kode: j.kode, nama: j.nama }))}
        partner={partner.filter((p) => p.isActive).map((p) => ({ id: p.id, nama: p.nama }))}
        proyek={proyek
          .filter((p) => p.status !== 'dibatalkan' && p.status !== 'terkunci')
          .map((p) => ({ id: p.id, kode: p.kode, nama: p.nama }))}
        posBiaya={posBiaya.map((p) => ({ id: p.id, kode: p.kode, nama: p.nama }))}
      />
    </>
  )
}
