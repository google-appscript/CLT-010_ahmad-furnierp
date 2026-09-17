-- Kode proyek terbit otomatis lewat ambilNomorBerikut(), jadi urutannya harus
-- sudah ada sebelum proyek pertama dibuat. Disisipkan lewat migrasi, bukan
-- seed, supaya penerapan ke server yang sudah berjalan tidak menuntut langkah
-- manual tambahan. Idempoten: pemasangan baru yang seed-nya sudah membuat baris
-- ini tidak terganggu.
INSERT INTO "sequences" ("kode", "prefix", "panjang_digit", "nomor_berikut", "reset")
VALUES ('proyek:kode', 'PRJ', 4, 1, 'bulanan')
ON CONFLICT ("kode") DO NOTHING;
