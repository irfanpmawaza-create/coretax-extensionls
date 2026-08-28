# Kebijakan Privasi

**Irfan** (individu, pengembang independen) — "CoreTax PDF Downloader & Ekspor Excel"
**Terakhir diperbarui:** 28 Agustus 2026

## 1. Pendahuluan
Kebijakan Privasi ini menjelaskan bagaimana ekstensi browser "CoreTax PDF Downloader & Ekspor Excel" ("Ekstensi") memproses data pada saat digunakan. Ekstensi ini adalah alat pihak ketiga yang **tidak resmi dan tidak berafiliasi dengan Direktorat Jenderal Pajak (DJP)** atau Pemerintah Republik Indonesia, dan hanya berfungsi di dalam halaman resmi CoreTax (`coretaxdjp.pajak.go.id`) yang sudah Anda buka dan Anda login sendiri.

**Ringkasan singkat:** Ekstensi ini **tidak memiliki server**, **tidak mengumpulkan atau menyimpan data Anda di infrastruktur pengembang**, dan **tidak mengirim data ke pihak ketiga mana pun** selain ke portal resmi CoreTax itu sendiri (dengan sesi login Anda sendiri). Seluruh pemrosesan data terjadi secara lokal di browser Anda.

## 2. Data yang Diproses

**a. Data pengguna Ekstensi**
- Parameter yang Anda masukkan sendiri di popup Ekstensi (tahun, rentang bulan) untuk fitur multi periode — hanya digunakan untuk membentuk permintaan ke API CoreTax, tidak disimpan.
- Posisi toolbar (koordinat geser) yang tersimpan di `localStorage` browser Anda pada domain CoreTax — preferensi tampilan semata, bukan data pribadi.

**b. Data pihak ketiga yang terkandung dalam dokumen pajak**
Karena fungsi utama Ekstensi adalah mengekstrak dan mengekspor data dari dokumen Faktur Pajak dan Bukti Potong yang Anda akses di CoreTax, data yang diproses **mencakup data pribadi pihak-pihak yang tercantum dalam dokumen tersebut**, yaitu:
- Nama dan NPWP penjual serta pembeli (untuk Faktur Keluaran/Masukan);
- Nama dan NPWP/NIK pihak yang dipotong pajaknya (untuk Bukti Potong);
- data transaksi non-pribadi terkait: nomor/tanggal dokumen, Dasar Pengenaan Pajak, PPN/PPnBM/PPh, status dokumen, dan metadata terkait lainnya.

Data ini **bukan dikumpulkan secara independen oleh Ekstensi**, melainkan diambil langsung dari dokumen resmi yang sudah dapat Anda akses sah melalui akun CoreTax Anda sendiri, semata-mata untuk direstrukturisasi ke dalam format Excel atas permintaan Anda.

**c. Token sesi CoreTax**
Untuk fitur multi periode, Ekstensi menangkap header Authorization dari permintaan API CoreTax yang sedang berjalan di tab Anda, guna mengambil data tambahan (pagination) atas nama Anda menggunakan sesi login Anda sendiri. Token ini **disimpan hanya sementara di memori (RAM) service worker Ekstensi**, hilang otomatis ketika service worker berhenti (biasanya setelah tab ditutup atau beberapa saat tidak aktif), dan **tidak pernah ditulis ke disk, file konfigurasi, atau dikirim ke tujuan mana pun selain API resmi CoreTax**.

## 3. Bagaimana Data Diproses dan Disimpan
- Seluruh proses ekstraksi PDF dan pembuatan file Excel **berjalan sepenuhnya di browser Anda (client-side)**, menggunakan library sumber terbuka yang dijalankan secara lokal (PDF.js untuk membaca PDF, SheetJS untuk membangun Excel) — tidak ada data yang dikirim ke server mana pun untuk diproses.
- File PDF dan Excel yang dihasilkan disimpan **langsung ke folder unduhan pada perangkat Anda sendiri**, menggunakan fitur unduhan bawaan browser Chrome.
- Ekstensi **tidak memiliki dan tidak mengoperasikan server backend**. Tidak ada basis data, tidak ada penyimpanan cloud, dan tidak ada salinan data Anda yang disimpan atau dapat diakses oleh pengembang Ekstensi.
- Pada mode "Buat Excel Saja", file PDF sementara yang terpaksa dibuat oleh browser akan dihapus otomatis dari perangkat Anda setelah data berhasil diekstrak.

## 4. Berbagi Data dengan Pihak Ketiga
Ekstensi **tidak membagikan, menjual, atau mengirimkan data apa pun kepada pihak ketiga**. Satu-satunya komunikasi jaringan yang dilakukan Ekstensi adalah ke domain resmi `coretaxdjp.pajak.go.id`, menggunakan sesi login Anda sendiri, untuk mengambil dokumen/data yang memang sudah dapat Anda akses secara sah. Tidak ada SDK analytics, iklan, atau pelacak pihak ketiga yang tertanam dalam Ekstensi ini.

Penggunaan CoreTax itu sendiri tunduk pada kebijakan privasi dan ketentuan yang ditetapkan oleh DJP secara independen, yang tidak dikendalikan oleh Kebijakan Privasi ini.

## 5. Tracking, Analytics, dan Cookie
Ekstensi ini **tidak menggunakan alat analytics, telemetry, atau pelacakan perilaku pengguna dalam bentuk apa pun**. Ekstensi tidak memasang cookie sendiri dan tidak membaca cookie CoreTax secara langsung — permintaan API dijalankan dalam konteks halaman CoreTax itu sendiri sehingga otentikasi tetap ditangani sepenuhnya oleh mekanisme bawaan CoreTax.

## 6. Keamanan Data
- Seluruh komunikasi dengan CoreTax dilakukan melalui HTTPS.
- Token sesi hanya disimpan sementara di memori volatil, tidak pernah ditulis ke disk.
- Permission yang diminta Ekstensi dibatasi seminimal mungkin dan hanya berlaku pada domain CoreTax resmi (`activeTab`, `scripting`, `downloads`, `webRequest`; host permission hanya `coretaxdjp.pajak.go.id`).
- File Excel/PDF yang telah diunduh ke perangkat Anda **tidak dienkripsi tambahan oleh Ekstensi** — keamanannya selanjutnya bergantung pada keamanan perangkat dan sistem operasi Anda sendiri, sama seperti file lain yang Anda unduh dari internet.
- Karena tidak ada server, risiko kebocoran data melalui infrastruktur pengembang secara praktis tidak berlaku — risiko privasi utama terletak pada keamanan perangkat dan folder unduhan Anda sendiri.

## 7. Hak dan Kontrol Anda
Karena Ekstensi tidak menyimpan data pribadi di luar perangkat Anda:
- **Akses dan penghapusan data**: seluruh data yang dihasilkan (file PDF/Excel) berada sepenuhnya di bawah kendali Anda di perangkat Anda sendiri — Anda dapat menghapusnya kapan pun langsung dari sistem berkas Anda. Tidak ada permintaan penghapusan data ke pengembang yang diperlukan karena pengembang tidak menyimpan salinannya.
- **Portabilitas/ekspor data**: fungsi ekspor ke Excel adalah fitur inti Ekstensi ini — data yang Anda ekstrak sepenuhnya portabel dalam format `.xlsx` standar.
- **Penarikan penggunaan**: Anda dapat menghentikan seluruh pemrosesan kapan pun dengan mencopot pemasangan (uninstall) Ekstensi dari browser Anda; token sesi di memori akan otomatis hilang.

## 8. Data Pribadi Pihak Ketiga dalam Dokumen
Karena dokumen Faktur Pajak dan Bukti Potong yang Anda proses melalui Ekstensi ini memuat data pribadi pihak lain (lawan transaksi Anda), Anda sebagai pengguna bertanggung jawab untuk memastikan penggunaan Ekstensi dan penyimpanan/pengelolaan file hasil ekspor dilakukan sesuai dengan kewajiban perlindungan data pribadi yang berlaku bagi Anda selaku pemroses dokumen tersebut, khususnya Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi. Ekstensi hanya menjadi alat bantu teknis dan tidak menentukan tujuan atau dasar hukum pemrosesan data pribadi tersebut.

## 9. Anak-Anak
Ekstensi ini ditujukan untuk pengguna dewasa yang cakap hukum sebagaimana diatur dalam Syarat dan Ketentuan Layanan, dan tidak dirancang atau ditujukan untuk digunakan oleh anak-anak.

## 10. Perubahan Kebijakan Privasi
Kebijakan Privasi ini dapat diperbarui apabila terdapat perubahan cara kerja Ekstensi, termasuk apabila di masa depan ditambahkan fitur yang melibatkan penyimpanan data di server (mis. sistem akun untuk fitur berbayar). Perubahan signifikan pada praktik pemrosesan data akan diinformasikan melalui pembaruan dokumen ini di repositori resmi Ekstensi (README) dan, apabila relevan, melalui halaman listing Ekstensi di Chrome Web Store.

## 11. Kontak
Pertanyaan mengenai Kebijakan Privasi ini dapat disampaikan melalui: irfanpmawaza@gmail.com.
