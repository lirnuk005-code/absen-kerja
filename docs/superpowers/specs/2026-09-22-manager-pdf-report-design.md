# Design: Generate Laporan Jam Kerja Deksa (PDF)

Tanggal: 2026-09-22
Status: Approved

## Tujuan
Manager (user `Ketut`) bisa mencetak laporan jam kerja Deksa untuk **periode gaji berjalan**
sebagai PDF, agar terlihat rekap "bulan ini berapa saja" seperti laporan.

## Keputusan (dari brainstorming)
1. Rentang data: **periode gaji berjalan** (`periodStart` = marker `salary_received` terbaru,
   fallback awal bulan kalender) — konsisten dengan KPI dashboard.
2. Isi: **ringkas + rincian per sesi** (bukan agregasi per hari).
3. Metode: **print browser** (`window.print()`) + CSS print — tanpa dependency baru.

## Lokasi UI
- Section baru **"MANAGER TOOLS"** di view Manager (Ketut), tepat sebelum kartu KPI.
- Satu kartu tombol **"Generate Laporan PDF"**.

## Isi Laporan (tema terang, khusus cetak)
- Kop: `LAPORAN JAM KERJA`, Worker: Deksa, Periode: `<mulai> – <sekarang>`, Dicetak: `<tgl jam>`.
- Ringkasan: Total Jam, Total Gaji (jam × Rp 28.000), Jumlah Hari Kerja, Jumlah Sesi.
- Tabel rincian per sesi (urut kronologis): No, Tanggal, Jam Masuk, Jam Keluar, Durasi.
- Footer tanda tangan: Manager (Ketut) & Worker (Deksa).

## Perhitungan
- Entry dengan `clock_in >= periodStart`, kecualikan `salary_received` & `day_off`.
- Sesi RUNNING (`clock_out = null`) dihitung sampai detik sekarang.
- Gaji = `(totalDetik / 3600) × 28000`.
- Hari kerja = jumlah tanggal kalender unik dari sesi.

## Teknis
- Dashboard root diberi `print:hidden`; blok laporan `hidden print:block`.
- `document.title` sementara diubah → `Laporan-Jam-Kerja-Deksa-<periode>` saat print, dipulihkan via event `afterprint`.
- CSS `@media print` di `index.css`: body putih, `@page { margin: 14mm }`.

## Edge case
- Tanpa data → tabel `[ TIDAK ADA DATA ]`, total Rp 0.
- Sesi lintas tengah malam dihitung penuh di tanggal mulai.
