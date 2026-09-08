import { punyaIzin } from './izin'

export type ItemMenu = {
  label: string
  rute?: string
  ikon?: string
  izin?: string
  fase: number
  anak?: ItemMenu[]
}

/** Fase tertinggi yang sudah dibangun. Naikkan saat fase berikutnya selesai. */
export const FASE_AKTIF = 1

export const NAVIGASI: ItemMenu[] = [
  {
    label: 'Dasbor', rute: '/dasbor', ikon: 'LayoutDashboard',
    izin: 'dasbor.ringkasan.lihat', fase: 1,
  },
  {
    label: 'Kontak', ikon: 'Users', fase: 1,
    anak: [
      { label: 'Semua Kontak', rute: '/kontak', izin: 'kontak.partner.lihat', fase: 1 },
      { label: 'Pelanggan', rute: '/kontak/pelanggan', izin: 'kontak.partner.lihat', fase: 1 },
      { label: 'Pemasok', rute: '/kontak/pemasok', izin: 'kontak.partner.lihat', fase: 1 },
    ],
  },
  {
    label: 'Penjualan', ikon: 'ShoppingCart', fase: 4,
    anak: [
      { label: 'Penawaran', rute: '/penjualan/penawaran', izin: 'penjualan.penawaran.lihat', fase: 4 },
      { label: 'Pesanan Penjualan', rute: '/penjualan/pesanan', izin: 'penjualan.pesanan.lihat', fase: 4 },
      { label: 'Laporan Penjualan', rute: '/penjualan/laporan', izin: 'penjualan.laporan.lihat', fase: 4 },
    ],
  },
  {
    label: 'Pembelian', ikon: 'ShoppingBag', fase: 3,
    anak: [
      { label: 'Permintaan Penawaran', rute: '/pembelian/permintaan', izin: 'pembelian.permintaan.lihat', fase: 3 },
      { label: 'Pesanan Pembelian', rute: '/pembelian/pesanan', izin: 'pembelian.pesanan.lihat', fase: 3 },
      { label: 'Laporan Pembelian', rute: '/pembelian/laporan', izin: 'pembelian.laporan.lihat', fase: 3 },
    ],
  },
  {
    label: 'Gudang', ikon: 'Warehouse', fase: 2,
    anak: [
      { label: 'Penerimaan Barang', rute: '/gudang/operasi/penerimaan', izin: 'gudang.penerimaan.kelola', fase: 2 },
      { label: 'Pengiriman', rute: '/gudang/operasi/pengiriman', izin: 'gudang.pengiriman.kelola', fase: 2 },
      { label: 'Packing List', rute: '/gudang/operasi/packing-list', izin: 'gudang.packing.kelola', fase: 2 },
      { label: 'Transfer Internal', rute: '/gudang/operasi/transfer', izin: 'gudang.transfer.kelola', fase: 2 },
      { label: 'Barang Rusak', rute: '/gudang/operasi/barang-rusak', izin: 'gudang.scrap.kelola', fase: 2 },
      { label: 'Stock Opname', rute: '/gudang/operasi/opname', izin: 'gudang.opname.kelola', fase: 2 },
      { label: 'Produk', rute: '/gudang/produk', izin: 'gudang.produk.lihat', fase: 2 },
      { label: 'Kategori Produk', rute: '/gudang/produk/kategori', izin: 'gudang.kategori.kelola', fase: 2 },
      { label: 'Satuan', rute: '/gudang/produk/satuan', izin: 'gudang.satuan.kelola', fase: 2 },
      { label: 'Kartu Stok', rute: '/gudang/laporan/kartu-stok', izin: 'gudang.laporan.kartu-stok', fase: 2 },
      { label: 'Stok Tersedia', rute: '/gudang/laporan/stok-tersedia', izin: 'gudang.laporan.stok', fase: 2 },
      { label: 'Valuasi Persediaan', rute: '/gudang/laporan/valuasi', izin: 'gudang.laporan.valuasi', fase: 2 },
      { label: 'Gudang & Lokasi', rute: '/gudang/konfigurasi/lokasi', izin: 'gudang.lokasi.kelola', fase: 2 },
    ],
  },
  {
    label: 'Manufaktur', ikon: 'Factory', fase: 5,
    anak: [
      { label: 'Perintah Produksi', rute: '/manufaktur/perintah-produksi', izin: 'manufaktur.mo.lihat', fase: 5 },
      { label: 'Bill of Materials', rute: '/manufaktur/bom', izin: 'manufaktur.bom.lihat', fase: 5 },
      { label: 'Analisis HPP Produksi', rute: '/manufaktur/laporan/hpp', izin: 'manufaktur.laporan.hpp', fase: 5 },
    ],
  },
  {
    label: 'Akuntansi', ikon: 'BookOpen', fase: 1,
    anak: [
      { label: 'Dasbor Akuntansi', rute: '/akuntansi', izin: 'akuntansi.dasbor.lihat', fase: 1 },
      { label: 'Faktur Penjualan', rute: '/akuntansi/pelanggan/faktur', izin: 'akuntansi.faktur.lihat', fase: 4 },
      { label: 'Nota Kredit', rute: '/akuntansi/pelanggan/nota-kredit', izin: 'akuntansi.nota-kredit.lihat', fase: 4 },
      { label: 'Pembayaran Masuk', rute: '/akuntansi/pelanggan/pembayaran', izin: 'akuntansi.pembayaran-masuk.lihat', fase: 4 },
      { label: 'Tagihan Pembelian', rute: '/akuntansi/pemasok/tagihan', izin: 'akuntansi.tagihan.lihat', fase: 3 },
      { label: 'Nota Debit', rute: '/akuntansi/pemasok/nota-debit', izin: 'akuntansi.nota-debit.lihat', fase: 3 },
      { label: 'Pembayaran Keluar', rute: '/akuntansi/pemasok/pembayaran', izin: 'akuntansi.pembayaran-keluar.lihat', fase: 3 },
      { label: 'Entri Jurnal', rute: '/akuntansi/jurnal/entri', izin: 'akuntansi.jurnal.lihat', fase: 1 },
      { label: 'Item Jurnal', rute: '/akuntansi/jurnal/item', izin: 'akuntansi.jurnal.lihat', fase: 1 },
      { label: 'Rekonsiliasi', rute: '/akuntansi/jurnal/rekonsiliasi', izin: 'akuntansi.rekonsiliasi.kelola', fase: 3 },
      { label: 'Daftar Aset', rute: '/akuntansi/aset', izin: 'akuntansi.aset.lihat', fase: 6 },
      { label: 'Jadwal Depresiasi', rute: '/akuntansi/aset/depresiasi', izin: 'akuntansi.depresiasi.lihat', fase: 6 },
      { label: 'Laba Rugi', rute: '/akuntansi/laporan/laba-rugi', izin: 'akuntansi.laporan.laba-rugi', fase: 1 },
      { label: 'Neraca', rute: '/akuntansi/laporan/neraca', izin: 'akuntansi.laporan.neraca', fase: 1 },
      { label: 'Arus Kas', rute: '/akuntansi/laporan/arus-kas', izin: 'akuntansi.laporan.arus-kas', fase: 1 },
      { label: 'Buku Besar', rute: '/akuntansi/laporan/buku-besar', izin: 'akuntansi.laporan.buku-besar', fase: 1 },
      { label: 'Neraca Saldo', rute: '/akuntansi/laporan/neraca-saldo', izin: 'akuntansi.laporan.neraca-saldo', fase: 1 },
      { label: 'Buku Besar Pembantu', rute: '/akuntansi/laporan/buku-pembantu', izin: 'akuntansi.laporan.buku-pembantu', fase: 1 },
      { label: 'Umur Piutang & Utang', rute: '/akuntansi/laporan/umur', izin: 'akuntansi.laporan.umur', fase: 1 },
      { label: 'Laporan Pajak', rute: '/akuntansi/laporan/pajak', izin: 'akuntansi.laporan.pajak', fase: 1 },
      { label: 'Bagan Akun', rute: '/akuntansi/konfigurasi/bagan-akun', izin: 'akuntansi.coa.kelola', fase: 1 },
      { label: 'Jurnal', rute: '/akuntansi/konfigurasi/jurnal', izin: 'akuntansi.jurnal-master.kelola', fase: 1 },
      { label: 'Pajak', rute: '/akuntansi/konfigurasi/pajak', izin: 'akuntansi.pajak.kelola', fase: 1 },
      { label: 'Mata Uang & Kurs', rute: '/akuntansi/konfigurasi/mata-uang', izin: 'akuntansi.mata-uang.kelola', fase: 1 },
      { label: 'Syarat Pembayaran', rute: '/akuntansi/konfigurasi/syarat-pembayaran', izin: 'akuntansi.syarat-bayar.kelola', fase: 1 },
      { label: 'Tahun Buku & Penguncian', rute: '/akuntansi/konfigurasi/tahun-buku', izin: 'akuntansi.tahun-buku.kelola', fase: 1 },
    ],
  },
  {
    label: 'Proyek', ikon: 'FolderKanban', fase: 7,
    anak: [
      { label: 'Proyek', rute: '/proyek', izin: 'proyek.proyek.kelola', fase: 7 },
      { label: 'Tugas', rute: '/proyek/tugas', izin: 'proyek.tugas.kelola', fase: 7 },
      { label: 'Timesheet', rute: '/proyek/timesheet', izin: 'proyek.timesheet.kelola', fase: 7 },
      { label: 'Profitabilitas Proyek', rute: '/proyek/laporan/profitabilitas', izin: 'proyek.laporan.profitabilitas', fase: 7 },
    ],
  },
  {
    label: 'Pengaturan', ikon: 'Settings', fase: 1,
    anak: [
      { label: 'Profil Perusahaan', rute: '/pengaturan/perusahaan', izin: 'pengaturan.perusahaan.kelola', fase: 1 },
      { label: 'Pengguna', rute: '/pengaturan/pengguna', izin: 'pengaturan.pengguna.kelola', fase: 1 },
      { label: 'Peran & Hak Akses', rute: '/pengaturan/peran', izin: 'pengaturan.peran.kelola', fase: 1 },
      { label: 'Penomoran Dokumen', rute: '/pengaturan/penomoran', izin: 'pengaturan.penomoran.kelola', fase: 1 },
      { label: 'Log Aktivitas', rute: '/pengaturan/log-aktivitas', izin: 'pengaturan.log.lihat', fase: 1 },
    ],
  },
]

function ratakan(item: ItemMenu[]): ItemMenu[] {
  return item.flatMap((i) => [i, ...(i.anak ? ratakan(i.anak) : [])])
}

/**
 * Seluruh kode izin dari SELURUH fase, termasuk yang belum dibangun.
 * Izin sengaja di-seed lebih dulu agar pemetaan peran dapat disiapkan
 * tanpa menunggu fiturnya selesai.
 */
export function daftarKodeIzin(): string[] {
  const kode = ratakan(NAVIGASI).map((i) => i.izin).filter((k): k is string => Boolean(k))
  return [...new Set(kode)]
}

export function navigasiTerlihat(
  izinDimiliki: string[],
  faseAktif: number = FASE_AKTIF,
): ItemMenu[] {
  function saring(daftar: ItemMenu[]): ItemMenu[] {
    return daftar.reduce<ItemMenu[]>((hasil, item) => {
      if (item.fase > faseAktif) return hasil
      if (item.anak) {
        const anak = saring(item.anak)
        if (anak.length > 0) hasil.push({ ...item, anak })
        return hasil
      }
      if (item.izin && punyaIzin(izinDimiliki, item.izin)) hasil.push(item)
      return hasil
    }, [])
  }
  return saring(NAVIGASI)
}
