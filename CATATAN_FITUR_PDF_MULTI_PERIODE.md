# Catatan Fitur: Simpan PDF & Excel Rincian di Multi Periode

Tanggal: 2026-08-20

## Ringkasan

Fitur "Multi Periode" (Faktur Keluaran / Faktur Masukan) sebelumnya cuma bisa ekspor data ringkasan ke Excel lintas rentang bulan, tanpa PDF. Sekarang ditambah dua opsi baru (checkbox, independen satu sama lain) di panel toolbar CoreTax maupun popup extension:

- **Simpan PDF juga** — download PDF asli tiap faktur ke disk, satu file per faktur.
- **Excel rincian per barang (dari PDF)** — parsing isi tiap PDF (pakai `pdf-extractor.js`, mesin yang sama dengan tombol "Buat Excel Saja") jadi satu Excel tambahan dengan baris per barang/jasa, bukan per faktur.

Dua-duanya jalan tanpa perlu ganti filter bulan manual di CoreTax — sama seperti mekanisme Excel ringkasan yang sudah ada, datanya diambil lewat API langsung untuk seluruh rentang bulan sekaligus.

## Yang sudah dikerjakan hari ini

1. **Reverse-engineering endpoint PDF CoreTax** (`POST /einvoiceportal/api/DownloadInvoice/download-invoice-document`) dari network capture asli, atas permintaan user.
2. **`background.js`** — handler pesan baru `fetchInvoicePdf`, pakai ulang `Authorization` yang sudah tertangkap dari endpoint list Faktur Keluaran/Masukan (tidak ada `webRequest` listener baru), decode klaim `taxpayer_id` dari JWT buat isi `TaxpayerAggregateIdentifier`.
3. **`content.js`**:
   - `fetchInvoicePdfBlob(item, invoiceType)` — susun body request dari field API list (`RecordId`, `AggregateIdentifier`, `DocumentFormAggregateIdentifier`, dll), decode respons (base64 di field `Content`) jadi `Blob`.
   - `downloadInvoicePdfsForItems(...)` — loop semua faktur, opsional simpan PDF ke disk dan/atau parsing lewat `pdfExtractor.extract()` buat Excel rincian, dengan throttle 1.8 detik/faktur dan penanganan gagal per-item (satu faktur gagal tidak menghentikan batch).
   - Checkbox baru di `buildMultiPeriodSection()` (toolbar in-page).
4. **`popup.html` / `popup.js`** — checkbox yang sama ditambahkan di popup extension.
5. Perbaikan dua bug yang ketahuan lewat tes langsung di CoreTax:
   - `DocumentAggregateIdentifier` awalnya salah dipetakan dari field yang tidak ada; field yang benar adalah `DocumentFormAggregateIdentifier`.
   - Parsing base64 PDF dari respons salah cari path (`Payload.FileContent`/`Payload.Base64`); field yang benar ada langsung di `data.Content`.
6. Sudah di-commit: `613b7c0 Tambah opsi simpan PDF & Excel rincian per barang di fitur Multi Periode`.

## Yang sudah terverifikasi (tes langsung di CoreTax)

- "Simpan PDF juga" untuk **Faktur Keluaran**: 34 faktur, PDF berhasil ke-download semua setelah kedua perbaikan bug di atas.

## Yang BELUM dikonfirmasi — perlu ditest user

1. **"Excel rincian per barang (dari PDF)"** — fitur baru barusan, belum sekalipun ditest langsung. Cek: apakah kolomnya (Nama Barang, Harga Jual, dst.) terbaca benar untuk faktur dengan banyak item, dan apakah baris "Catatan: Item tidak terbaca" muncul (tanda parsing PDF gagal untuk faktur tertentu).
2. **Faktur Masukan** — PDF fetch (`EInvoiceMenuType: "Incoming"`) sama sekali belum ditest, cuma asumsi simetris dari Faktur Keluaran (`"Outgoing"` yang sudah terbukti benar). Kalau CoreTax nolak, pesan error di alert popup CoreTax sekarang sudah menampilkan detail dari server (bukan cuma kode "(400)"), jadi tinggal baca alasan gagalnya dan laporkan.
3. **Bukti Potong (withholding slips)** — di luar cakupan sama sekali, tetap Excel-only. Endpoint PDF-nya beda dan belum di-capture. Kalau dibutuhkan, perlu sesi reverse-engineering terpisah (network capture baru dari klik download Bukti Potong).
4. **Faktur berstatus bukan `APPROVED`** — belum ditest apakah endpoint PDF tetap jalan atau menolak (mis. status `DRAFT`/`CANCELLED`). Kalau ada faktur begini dalam rentang yang diproses, pantau apakah masuk ke daftar "gagal" di pesan akhir dan cocok logikanya.
5. **Volume besar** — belum ditest untuk rentang banyak bulan/ratusan faktur sekaligus (throttle 1.8 detik/faktur berarti 300 faktur ≈ 9 menit). Pastikan tidak ada rate-limit/timeout dari sisi CoreTax untuk proses sepanjang itu.
