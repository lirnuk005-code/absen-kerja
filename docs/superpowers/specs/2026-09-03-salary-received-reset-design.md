# Design: Tombol "Gaji Diterima" (Reset Periode Tracker)

Date: 2026-09-03
App: attendance-dashboard (React + Vite + Supabase)

## Problem

Worker (Deksa) menerima gaji pada 28 Agustus 2026. Periode penghitungan gaji tidak
selaras dengan bulan kalender (mulai dari tanggal terima gaji, bukan tanggal 1).
Saat ini KPI bulanan (total jam, total gaji, target 192 jam) selalu dihitung dari
`startOfMonth`, sehingga menghitung ulang waktu yang sudah dibayar.

## Goal

- Tombol **"Gaji Diterima"** di bagian Quick Links (khusus Deksa / worker).
- Setelah diklik, semua KPI periode (total jam, gaji, progress target) dihitung
  ulang dari nol, mulai dari tanggal reset.
- Data lama TIDAK dihapus — tetap tersimpan di DB dan tetap tampil di Recent Logs.

## Approach (yang dipilih)

**Marker entry, bukan penghapusan.** Klik tombol → insert satu baris ke
`time_entries` dengan `entry_type = 'salary_received'`, `clock_in = clock_out = now`.
Periode perhitungan (`periodStart`) ditentukan dari marker terbaru; fallback ke
`startOfMonth(new Date())` (perilaku saat ini).

Company: KPI = entri dengan `clock_in >= periodStart`, `clock_out != null`,
dan `entry_type != 'day_off'`. Marker `salary_received` dieksklusikan dari semua
perhitungan dan tampilan log.

## Changes (hanya `src/App.tsx`)

1. **State**: tambah `periodStart: Date | null` dan perbarui `ActionType`
   dengan nilai `'salary_received'`.
2. **fetchDashboardData**:
   - Query marker terbaru: `select * eq('entry_type','salary_received')
     order('clock_in', desc).limit(1)`.
   - `periodStart` = clock_in marker tersebut (atau `startOfMonth(new Date())`).
   - Fetch entri mulai `startOfMonth(periodStart)` (bukan `startOfMonth(now)`),
     agar log lama satu bulan kalender sebelum reset tetap tampil di Recent Logs.
   - Log disaring ulang saat dihitung (lihat poin 3); Recent Logs menampilkan
     semua entri hasil fetch kecuali marker `salary_received` dan `day_off` ditangani seperti sekarang.
3. **Perhitungan**:
   - `calculateMonthlySeconds`: tambah filter `clock_in >= periodStart` dan
     `entry_type != 'salary_received'`.
   - `calculateTodaySeconds`: tetap berbasis hari ini; eksklusikan marker
     `salary_received` (durasi 0 detik, tapi jangan tampil di log).
   - Deteksi `activeEntry`: tidak berubah (marker punya `clock_out`, jadi tidak aktif).
4. **executeAction**: branch `'salary_received'` → insert
   `{ clock_in: now, clock_out: now, entry_type: 'salary_received' }`,
   lalu set `periodStart = now` dan refresh state `entries`.
5. **UI Quick Links (Deksa)**: kartu ke-5 "Gaji Diterima", ikon `Banknote`
   (lucide-react), aktif hanya saat `!activeEntry` (konsisten dengan Clock In /
   Libur), deskripsi singkat, modal konfirmasi seperti aksi lain.
6. **KPI label**: "THIS MONTH" → "THIS PERIOD". Tampilkan tanggal mulai periode
   di kartu TOTAL TIME (mis. "PERIOD START: 28 AUG").

## Non-goals

- Tidak ada perubahan skema DB (tidak ada migrasi).
- Tidak ada hapus data / tombol undo (histori tetap aman di DB).
- Tidak menyentuh fitur lain (Suspend, Clock Out, Libur, autentikasi, styling).

## Success criteria

- Klik "Gaji Diterima" → KPI bulanan & progress target kembali ke 0 (dari tanggal reset).
- Log sebelum reset tetap terlihat di Recent Logs.
- Semua perilaku lain (clock in/out, libur, today metrics) tidak berubah.