CoreTax PDF Downloader & Ekspor Excel
Versi: 1.1.0 Multi Periode

Fungsi utama:
- Mengambil dokumen PDF dari halaman CoreTax yang didukung.
- Mengekstrak data faktur ke file Excel.
- Menyediakan mode "Buat Excel Saja" untuk menghapus PDF sementara setelah ekstraksi bila browser tetap membuat download.
- Mengekstrak Dasar Pengenaan Pajak dan Jumlah PPN dari ringkasan faktur.
- BARU: mengunduh Faktur Keluaran untuk rentang masa pajak (mis. Januari-Februari) ke satu file Excel tanpa mengganti filter bulan satu per satu.

Cara kerja fitur Multi Periode:
1. Buka CoreTax > e-Invoice > Faktur Keluaran (output-tax).
2. Pastikan tabel Faktur Keluaran sudah pernah memuat data pada sesi/tab tersebut. Jika perlu ubah filter atau refresh tabel sekali.
3. Klik extension.
4. Isi Tahun, Dari Bulan, dan Sampai Bulan.
5. Klik "Download Excel Multi Periode".
6. Extension memakai request API CoreTax pada sesi login aktif, mengambil data per bulan dengan pagination 50 baris, menggabungkannya, lalu membuat satu file XLSX.

Catatan autentikasi:
- Extension tidak memiliki token CoreTax yang di-hardcode.
- Header Authorization dari request CoreTax hanya ditangkap sementara di memori service worker dan tidak ditulis ke file konfigurasi.
- Jika service worker direstart dan konteks belum terbaca, cukup refresh/ubah filter tabel Faktur Keluaran sekali lalu coba kembali.

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
3. Jika versi lama sudah terpasang, hapus/nonaktifkan versi lama atau pilih Reload setelah mengganti folder.
4. Pilih Load unpacked.
5. Pilih folder extension ini.
6. Reload tab CoreTax yang sudah terbuka.

Checklist uji fitur Multi Periode:
- Uji Januari-Februari tahun yang sama.
- Cocokkan jumlah data Januari dan Februari dengan tabel CoreTax.
- Cocokkan beberapa Nomor Faktur, DPP, DPP Nilai Lain, dan PPN secara sampel.
- Uji bulan tanpa data.
- Uji saat login/session CoreTax kedaluwarsa.
- Uji periode dengan data > 50 baris untuk memastikan pagination berjalan.

Disclaimer:
- Pengguna wajib mengecek kembali hasil ekstrak sebelum digunakan untuk pekerjaan/perpajakan.
- Extension hanya berjalan di domain CoreTax dan tidak mengirim data ke server eksternal.
