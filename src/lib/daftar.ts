export type ParameterDaftar = {
  cari?: string
  filter?: Record<string, string[]>
  kelompokkan?: string
  urutkan?: { kolom: string; arah: 'asc' | 'desc' }
  halaman: number
  ukuranHalaman: number
}

export type HasilDaftar<T> = {
  data: T[]
  totalBaris: number
  grup?: { nilai: string; jumlah: number }[]
}

export function uraikanParameterDaftar(searchParams: URLSearchParams): ParameterDaftar {
  const hasil: ParameterDaftar = {
    halaman: Number(searchParams.get('hal') ?? '1') || 1,
    ukuranHalaman: Number(searchParams.get('ukuran') ?? '20') || 20,
  }

  const cari = searchParams.get('q')
  if (cari) hasil.cari = cari

  const entriFilter = searchParams.getAll('filter')
  if (entriFilter.length > 0) {
    const filter: Record<string, string[]> = {}
    for (const entri of entriFilter) {
      const pemisah = entri.indexOf(':')
      if (pemisah === -1) continue
      const field = entri.slice(0, pemisah)
      const nilai = entri.slice(pemisah + 1).split(',').filter(Boolean)
      if (nilai.length === 0) continue
      filter[field] = [...(filter[field] ?? []), ...nilai]
    }
    if (Object.keys(filter).length > 0) hasil.filter = filter
  }

  const kelompokkan = searchParams.get('group')
  if (kelompokkan) hasil.kelompokkan = kelompokkan

  const sort = searchParams.get('sort')
  if (sort) {
    const [kolom, arah] = sort.split(':')
    if (kolom && (arah === 'asc' || arah === 'desc')) {
      hasil.urutkan = { kolom, arah }
    }
  }

  return hasil
}

export function serialisasiParameterDaftar(param: Partial<ParameterDaftar>, base: URLSearchParams): URLSearchParams {
  const hasil = new URLSearchParams(base)

  if (param.cari !== undefined) {
    if (param.cari) hasil.set('q', param.cari)
    else hasil.delete('q')
  }

  if (param.filter !== undefined) {
    hasil.delete('filter')
    for (const [field, nilai] of Object.entries(param.filter)) {
      if (nilai.length === 0) continue
      hasil.append('filter', `${field}:${nilai.join(',')}`)
    }
  }

  if (param.kelompokkan !== undefined) {
    if (param.kelompokkan) hasil.set('group', param.kelompokkan)
    else hasil.delete('group')
  }

  if (param.urutkan !== undefined) {
    if (param.urutkan) hasil.set('sort', `${param.urutkan.kolom}:${param.urutkan.arah}`)
    else hasil.delete('sort')
  }

  if (param.halaman !== undefined) hasil.set('hal', String(param.halaman))
  if (param.ukuranHalaman !== undefined) hasil.set('ukuran', String(param.ukuranHalaman))

  return hasil
}
