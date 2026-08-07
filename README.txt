CoreTax PDF Downloader & Ekspor Excel
Versi: 1.0.2 Full

Fungsi utama:
- Mengambil dokumen PDF dari halaman CoreTax yang didukung.
- Mengekstrak data faktur ke file Excel.
- Menyediakan mode "Buat Excel Saja" untuk menghapus PDF sementara setelah ekstraksi bila browser tetap membuat download.
- Mengekstrak Dasar Pengenaan Pajak dan Jumlah PPN dari ringkasan faktur.

Status versi:
- Ini adalah versi penuh tanpa batas halaman trial.

Halaman yang didukung:
- https://coretaxdjp.pajak.go.id/e-invoice-portal/
- https://coretaxdjp.pajak.go.id/withholding-slips-portal/

Library lokal yang wajib ada di folder libs:
- pdf.min.js
- pdf.worker.min.js
- xlsx.full.min.js

Cara install:
1. Buka chrome://extensions.
2. Aktifkan Developer mode.
3. Pilih Load unpacked.
4. Pilih folder extension ini.
5. Buka salah satu halaman CoreTax yang didukung, pilih baris data, lalu jalankan dari popup extension.

Checklist sebelum digunakan:
- Uji dokumen dari e-Invoice dan withholding slips.
- Uji mode "Buat Excel Saja" dan pastikan PDF sementara terhapus atau pesan peringatannya jelas.
- Uji dokumen dengan lebih dari 1 item barang/jasa.
- Uji saat ada dokumen gagal agar detail gagal muncul benar.
- Pengguna wajib memeriksa ulang hasil ekstraksi sebelum dipakai untuk pelaporan.
- Extension hanya berjalan di domain CoreTax dan tidak mengirim data ke server eksternal.
