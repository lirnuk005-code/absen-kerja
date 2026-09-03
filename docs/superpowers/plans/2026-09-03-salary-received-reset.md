# "Gaji Diterima" (Reset Periode Tracker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambahkan tombol "Gaji Diterima" di Quick Links worker yang menyisipkan marker `salary_received` dan mereset semua KPI periode (jam, gaji, target 192h) mulai dari tanggal reset.

**Architecture:** Marker-entry, bukan penghapusan. `periodStart` diambil dari marker `salary_received` terbaru (fallback `startOfMonth(now)`). Semua perhitungan bulanan memakai `periodStart`. Semua perubahan hanya di satu file: `src/App.tsx`.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4 + Supabase JS. Tanpa framework test — verifikasi via `npm run build` (tsc + vite) dan `npm run lint` (oxlint).

## Global Constraints

- Hanya mengubah `src/App.tsx`. Jangan ubah skema DB, `supabase.sql`, atau file lain.
- `entry_type` marker baru: `'salary_received'` (huruf kecil, snake_case, persis).
- Marker harus `clock_in = clock_out = now` → tidak pernah terdeteksi sebagai sesi aktif.
- Marker **wajib** dikecualikan dari: KPI bulanan, KPI hari ini, dan Recent Logs.
- KPI bulanan = entri dengan `clock_in >= periodStart`, `clock_out != null`, `entry_type != 'day_off'` dan `!= 'salary_received'`.
- KPI label: "THIS MONTH" → "THIS PERIOD" (+ tampilkan tanggal mulai periode).
- Kartu "Gaji Diterima" hanya muncul di Quick Links yang memang sudah khusus Deksa (worker); aktif hanya saat `!activeEntry`.
- Ikon kartu: `Banknote` dari `lucide-react`. UI lain (modal, gaya kartu) mengikuti pola kartu yang sudah ada.
- Commit tiap task. Baseline perubahan `src/App.tsx` yang belum di-commit harus di-commit dulu (Task 0).

---

### Task 0: Baseline commit perubahan yang belum di-commit

**Files:**
- Modify: `src/App.tsx` (perubahan `isProcessing` dari sesi sebelumnya, belum di-commit)

**Interfaces:**
- Consumes: —
- Produces: working tree bersih (kecuali file untracked script `*.js`) agar diff fitur bersih.

- [ ] **Step 1: Commit baseline**

```bash
git add src/App.tsx && git commit -m "chore: baseline pending changes sebelum fitur Gaji Diterima"
```

*(Jika tidak ada perubahan yang perlu di-commit, lewati task ini — lanjut ke Task 1.)*

- [ ] **Step 2: Verifikasi**

Run: `git status --short`
Expected: tidak ada `M` pada `src/App.tsx` (yang tersisa hanya `??` untuk script root yang untracked — aman diabaikan).

---

### Task 1: Data layer — state, fetch, kalkulasi, dan aksi `salary_received`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `periodStart: Date | null` (state baru, di-set oleh `fetchDashboardData` dan aksi `salary_received`).
- Produces: `ActionType` menyertakan `'salary_received'`; `fetchDashboardData()` men-set `periodStart`; `executeAction` menangani `'salary_received'`; `calculateMonthlySeconds` / `calculateTodaySeconds` memakai `periodStart`; `recentLogs` mengecualikan marker.

- [ ] **Step 1: Perluas `ActionType` dan tambah state `periodStart`**

Ubah tipe:

```tsx
type ActionType = 'clock_in' | 'suspend' | 'clock_out' | 'day_off' | 'salary_received' | null;
```

Tambah state setelah `pendingAction`/`isProcessing`:

```tsx
const [pendingAction, setPendingAction] = useState<ActionType>(null);
const [isProcessing, setIsProcessing] = useState(false);
const [periodStart, setPeriodStart] = useState<Date | null>(null);
const [kpiIndex, setKpiIndex] = useState(0);
```

- [ ] **Step 2: Ubah `fetchDashboardData`**

Ganti seluruh body `fetchDashboardData` dengan:

```tsx
const fetchDashboardData = async () => {
  try {
    // 1. Cari marker salary_received terbaru sebagai awal periode
    const { data: markerData, error: markerError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('entry_type', 'salary_received')
      .order('clock_in', { ascending: false })
      .limit(1);

    if (markerError) throw markerError;

    const latestMarker = markerData?.[0];
    const periodStartDate = latestMarker ? new Date(latestMarker.clock_in) : startOfMonth(new Date());
    setPeriodStart(periodStartDate);

    // 2. Ambil entri mulai awal bulan kalender yang memuat periodStart
    //    (log lama satu bulan terakhir tetap tampil di Recent Logs)
    const since = startOfMonth(periodStartDate).toISOString();

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .gte('clock_in', since)
      .order('clock_in', { ascending: false });

    if (error) throw error;

    setEntries(data || []);
    const active = data?.find((e) => !e.clock_out && e.entry_type !== 'salary_received');
    setActiveEntry(active || null);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
};
```

- [ ] **Step 3: Handle `salary_received` di `executeAction`**

Masukkan branch baru sebelum `} else if (pendingAction === 'day_off')`:

```tsx
} else if (pendingAction === 'salary_received') {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('time_entries')
    .insert([{ clock_in: now, clock_out: now, entry_type: 'salary_received' }])
    .select()
    .single();

  if (error) throw error;
  setEntries([data, ...entries]);
  setPeriodStart(new Date(now));
}
```

- [ ] **Step 4: Ubah `calculateMonthlySeconds`**

```tsx
const calculateMonthlySeconds = () => {
  const start = periodStart?.getTime() ?? startOfMonth(new Date()).getTime();
  const completedSeconds = entries
    .filter((e) =>
      e.clock_out &&
      e.entry_type !== 'day_off' &&
      e.entry_type !== 'salary_received' &&
      new Date(e.clock_in).getTime() >= start
    )
    .reduce((total, e) => total + differenceInSeconds(new Date(e.clock_out!), new Date(e.clock_in)), 0);
  return completedSeconds + currentDuration;
};
```

- [ ] **Step 5: Ubah `calculateTodaySeconds`**

Filter `todayEntries` agar mengecualikan marker:

```tsx
const todayEntries = entries.filter(e => new Date(e.clock_in).getTime() >= today && e.entry_type !== 'salary_received');
```

- [ ] **Step 6: Ubah `recentLogs` agar mengecualikan marker**

```tsx
const recentLogs = entries.filter((e) => e.entry_type !== 'salary_received').slice(0, 10);
```

- [ ] **Step 7: Verifikasi build**

Run: `npm run build`
Expected: build sukses tanpa error TypeScript (tidak ada unused import — `noUnusedLocals` aktif).

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx && git commit -m "feat: data layer reset periode via marker salary_received"
```

---

### Task 2: UI — kartu "Gaji Diterima", modal, label KPI

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `setPendingAction('salary_received')` dari Task 1; kartu aktif hanya saat `!activeEntry`.
- Produces: tombol + umpan balik visual yang bisa diverifikasi manual.

> Impor `Banknote` diletakkan di sini (Task 2), bukan Task 1 — karena `noUnusedLocals=true`, impor yang belum dipakai akan menggagalkan `npm run build` di akhir Task 1.

- [ ] **Step 1: Tambah import `Banknote`**

Ubah blok import `lucide-react` untuk menambah `Banknote` (letakkan setelah `AlertTriangle`):

```tsx
import {
  Command,
  LayoutDashboard,
  Play,
  Square,
  Coffee,
  DollarSign,
  Clock,
  Activity,
  Calendar,
  LogOut,
  AlertTriangle,
  Terminal,
  Sun,
  Banknote
} from 'lucide-react';
```

- [ ] **Step 2: Tambah teks modal konfirmasi**

Di dalam blok `<p ... className="text-[#888] text-sm mb-8">`, tambah satu baris:

```tsx
{pendingAction === 'salary_received' && "Are you sure you want to log SALARY RECEIVED? This resets the period tracker — all counters (time, earnings, target) will restart from now."}
```

- [ ] **Step 2: Tambah kartu "Gaji Diterima" di Quick Links**

Setelah kartu "Libur" (penutup `</div>` kartu day_off, sebelum `</div>` penutup grid), tambah:

```tsx
<div
  onClick={!activeEntry ? () => setPendingAction('salary_received') : undefined}
  className={`cmd-card cmd-action-card p-3 md:p-6 rounded-sm flex flex-col gap-2 md:gap-3 items-center text-center md:items-start md:text-left ${activeEntry ? 'disabled' : ''}`}
>
  <div className="cmd-card-inner" />
  <div className="w-8 h-8 rounded bg-[#1A1A1A] border border-[#333] flex items-center justify-center mb-1 md:mb-2">
    <Banknote size={16} className="text-white" />
  </div>
  <h3 className="text-xs md:text-sm font-semibold text-white leading-tight">Gaji Diterima</h3>
  <p className="text-[#888] text-xs leading-relaxed hidden md:block">
    Tandai gaji telah diterima. Semua penghitung periode (jam, gaji, target) direset dari nol.
  </p>
</div>
```

Ubah class grid Quick Links dari `grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6` menjadi:

```tsx
<div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-6">
```

- [ ] **Step 3: Label KPI "THIS MONTH" → "THIS PERIOD"**

Ada dua tempat label `THIS MONTH` (kartu TOTAL EARNED dan kartu TOTAL TIME). Ganti keduanya:

```tsx
<span className="text-xs text-[#555] font-mono">THIS PERIOD</span>
```

- [ ] **Step 4: Tampilkan tanggal mulai periode di kartu TOTAL TIME**

Di dalam kartu TOTAL TIME, tepat setelah blok progress bar (`</div>` penutup progress bar), tambah:

```tsx
<div className="mt-2 text-[10px] font-mono text-[#555]">
  PERIOD START: {(periodStart ?? new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
</div>
```

*(Tidak menambah import date-fns — pakai `toLocaleDateString`.)*

- [ ] **Step 5: Verifikasi build & lint**

Run: `npm run build && npm run lint`
Expected: keduanya sukses tanpa error.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx && git commit -m "feat: tombol Gaji Diterima + label periode di UI"
```

---

### Task 3: Verifikasi manual end-to-end

**Files:**
- Modify: tidak ada (hanya pengujian)

**Interfaces:**
- Consumes: build Task 1 & 2.
- Produces: konfirmasi fitur berfungsi di browser.

- [ ] **Step 1: Jalankan dev server**

Run: `npm run dev`
Buka `http://localhost:5173` di browser (mode mobile + desktop jika bisa).

- [ ] **Step 2: Login sebagai Deksa**

Expected: Quick Links menampilkan 5 kartu (Clock In, Suspend, Clock Out, Libur, **Gaji Diterima**).

- [ ] **Step 3: Klik "Gaji Diterima"**

Expected:
- Muncul modal konfirmasi "// CONFIRM ACTION".
- Klik EXECUTE → KPI TOTAL EARNED ≈ Rp 0, TOTAL TIME ≈ `00:00:00`, progress target 0.0%.
- Label "PERIOD START" menampilkan tanggal hari ini.
- Recent Logs tidak menampilkan baris marker `salary_received`; log lama (jika ada dalam bulan yang sama) tetap tampil.

- [ ] **Step 4: Verifikasi state tambahan**

Dengan marker aktif, klik **Clock In** → **Clock Out** (urutan normal):
Expected: KPI periode bertambah sesuai durasi sesi singkat; status kembali IDLE.

- [ ] **Step 5: Verifikasi modal tidak bisa dobel-execute**

Klik "Gaji Diterima" lalu EXECUTE dua kali cepat:
Expected: tombol menampilkan EXECUTING... dan hanya satu marker tersimpan (guard `isProcessing`).

- [ ] **Step 6: Update grafik knowledge graph**

Run: `graphify update .`
Expected: selesai tanpa error (AST-only, tidak ada biaya API).