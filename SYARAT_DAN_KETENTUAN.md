# Syarat dan Ketentuan Layanan

**Irfan** (individu, pengembang independen) — "CoreTax PDF Downloader & Ekspor Excel"
**Terakhir diperbarui:** 28 Agustus 2026

## 1. Penerimaan Syarat dan Ketentuan
Dengan memasang, mengaktifkan, atau menggunakan ekstensi browser "CoreTax PDF Downloader & Ekspor Excel" ("Ekstensi", "Layanan"), Anda ("Pengguna") menyetujui Syarat dan Ketentuan ini. Jika Anda tidak menyetujui, jangan memasang atau gunakan Ekstensi, dan copot pemasangan (uninstall) jika sudah terpasang.

## 2. Deskripsi Layanan
Ekstensi ini adalah alat bantu (tool) pihak ketiga yang **tidak resmi dan tidak berafiliasi dengan, tidak didukung oleh, dan tidak disponsori oleh Direktorat Jenderal Pajak (DJP) atau Pemerintah Republik Indonesia**. Ekstensi berjalan secara lokal di browser Anda dan hanya berinteraksi dengan halaman resmi CoreTax di domain `coretaxdjp.pajak.go.id`, khususnya pada modul e-Invoice (Faktur Keluaran/Masukan) dan Bukti Potong.

Fungsi utama Layanan:
- Mengunduh dokumen PDF dari halaman CoreTax yang sedang Anda buka menggunakan sesi login Anda sendiri.
- Mengekstrak data faktur/bukti potong (termasuk Dasar Pengenaan Pajak dan Jumlah PPN) dari dokumen tersebut ke dalam file Excel.
- Menyediakan mode "Buat Excel Saja" yang menghapus file PDF sementara dari perangkat Anda setelah data diekstrak.
- Menggabungkan data dari beberapa masa pajak (multi periode) ke dalam satu file Excel, dengan cara memanggil ulang API CoreTax menggunakan sesi login Anda yang sedang aktif.

Semua pemrosesan data (ekstraksi PDF dan pembuatan file Excel) dilakukan **sepenuhnya di perangkat/browser Anda**. Layanan tidak memiliki server backend dan tidak mengirimkan dokumen atau data Anda ke server mana pun milik Irfan atau pihak ketiga mana pun.

## 3. Kelayakan Pengguna
Layanan ini ditujukan untuk digunakan oleh individu yang cakap secara hukum untuk mengikatkan diri pada perjanjian (termasuk wajib pajak, kuasa wajib pajak, konsultan pajak, staf akuntansi/pajak, atau pihak lain yang memiliki akses sah ke akun CoreTax terkait), yang berusia minimal 18 tahun atau telah dewasa menurut hukum yang berlaku di domisili Anda. Anda bertanggung jawab untuk memastikan bahwa penggunaan Layanan sesuai dengan kewenangan Anda mengakses data CoreTax yang bersangkutan.

## 4. Akun dan Sesi CoreTax
Ekstensi ini **tidak menyediakan sistem akun, login, atau kredensial sendiri**. Ekstensi hanya menggunakan sesi login CoreTax yang sudah Anda buat sendiri melalui situs resmi `coretaxdjp.pajak.go.id`. Anda tetap sepenuhnya bertanggung jawab atas:
- keamanan kredensial login CoreTax Anda;
- kepatuhan terhadap Syarat dan Ketentuan penggunaan CoreTax/DJP Online yang berlaku secara terpisah dari dokumen ini;
- seluruh aktivitas yang terjadi melalui sesi login Anda saat Ekstensi digunakan.

Token otorisasi (Authorization header) dari sesi CoreTax Anda ditangkap dan disimpan **secara sementara di memori** ekstensi (service worker) semata-mata untuk menjalankan fungsi pengambilan data multi periode, dan **tidak ditulis ke penyimpanan permanen, tidak di-hardcode, dan tidak dikirim ke server mana pun** selain digunakan untuk memanggil API resmi CoreTax itu sendiri.

## 5. Penggunaan yang Diperbolehkan dan Dilarang
Anda setuju untuk menggunakan Layanan hanya untuk mengakses dan mengekspor data yang secara sah dapat Anda akses melalui akun CoreTax Anda sendiri. Anda dilarang:
- menggunakan Layanan untuk mengakses data CoreTax milik pihak lain tanpa kewenangan yang sah;
- menggunakan Layanan dengan cara yang melanggar Syarat dan Ketentuan CoreTax/DJP Online atau peraturan perundang-undangan perpajakan yang berlaku;
- merekayasa balik (reverse engineer), mendekompilasi, atau memodifikasi Ekstensi untuk tujuan mengganggu, membebani, atau menyalahgunakan sistem CoreTax;
- menggunakan Layanan dengan volume atau frekuensi permintaan yang dapat membebani atau mengganggu server CoreTax secara tidak wajar.

Layanan menerapkan jeda otomatis antar-unduhan dokumen sebagai bentuk penggunaan yang wajar terhadap server CoreTax; Anda tidak diperkenankan memodifikasi Ekstensi untuk menghilangkan jeda tersebut dengan maksud membebani server CoreTax.

## 6. Data dan File yang Dihasilkan
Seluruh dokumen PDF dan file Excel yang dihasilkan oleh Layanan disimpan **langsung ke perangkat penyimpanan lokal Anda** melalui fitur unduhan bawaan browser. Irfan tidak menyimpan, mengakses, atau memiliki salinan dokumen atau data yang Anda ekstrak — data tersebut sepenuhnya berada dalam kendali Anda begitu diunduh.

Anda bertanggung jawab penuh untuk **memeriksa dan memverifikasi keakuratan hasil ekstraksi** (termasuk namun tidak terbatas pada nomor faktur, Dasar Pengenaan Pajak, dan Jumlah PPN) sebelum menggunakannya untuk keperluan pelaporan pajak, akuntansi, atau pekerjaan lain apa pun. Layanan hanya melakukan penguraian (parsing) otomatis atas dokumen dan tidak melakukan verifikasi substantif atas kebenaran isi dokumen.

## 7. Layanan Tanpa Biaya (Saat Ini) dan Kemungkinan Fitur Berbayar di Masa Depan
Berdasarkan kondisi Layanan saat ini, seluruh fitur yang tersedia dalam Ekstensi (termasuk unduhan PDF, ekspor Excel, dan fitur multi periode) **tidak dipungut biaya**.

Irfan berencana untuk memperkenalkan fitur dan/atau paket berbayar di masa depan. Sebelum fitur berbayar tersebut diberlakukan bagi Pengguna, Irfan akan:
- memperbarui Syarat dan Ketentuan ini untuk mencantumkan secara jelas fitur mana yang berbayar, struktur harga, mekanisme penagihan, dan kebijakan pengembalian dana (refund) yang berlaku; dan
- memberikan Pengguna kesempatan untuk meninjau ketentuan tersebut sebelum fitur berbayar aktif digunakan.

Fitur yang sudah tersedia secara gratis pada versi Ekstensi yang telah Anda pasang tidak akan dijadikan berbayar secara retroaktif tanpa pemberitahuan.

## 8. Hak Kekayaan Intelektual
Ekstensi, termasuk kode, tampilan antarmuka, dan branding di dalamnya, adalah milik Irfan dan dilindungi sebagai hak cipta miliknya (proprietary/all rights reserved) — kode Ekstensi tidak dirilis di bawah lisensi sumber terbuka. Ekstensi menyertakan pustaka pihak ketiga sumber terbuka berikut yang tunduk pada lisensinya masing-masing:
- **PDF.js** (Mozilla) — digunakan untuk membaca/mengekstrak isi dokumen PDF;
- **SheetJS (xlsx.js)** — digunakan untuk membuat file Excel.

Anda tidak diperkenankan menyalin, mendistribusikan ulang, atau menjual Ekstensi tanpa izin tertulis dari Irfan, kecuali sepanjang diizinkan oleh lisensi pustaka pihak ketiga di atas.

## 9. Layanan Pihak Ketiga
Ekstensi berinteraksi secara eksklusif dengan portal CoreTax (`coretaxdjp.pajak.go.id`) yang dikelola oleh Direktorat Jenderal Pajak. Penggunaan CoreTax itu sendiri tunduk pada syarat dan ketentuan, kebijakan, serta peraturan yang ditetapkan oleh DJP/Pemerintah Republik Indonesia, yang berlaku secara independen dari dan tidak dapat diubah oleh Syarat dan Ketentuan ini. Irfan tidak mengendalikan, dan tidak bertanggung jawab atas, ketersediaan, kebijakan, atau perubahan pada portal CoreTax.

## 10. Tidak Ada Fitur Kecerdasan Buatan (AI)
Layanan **tidak menggunakan kecerdasan buatan (AI) atau machine learning**. Ekstraksi data dilakukan melalui penguraian teks/struktur dokumen PDF dan halaman web secara deterministik (rule-based). Hasil ekstraksi dapat keliru apabila format dokumen sumber berubah, dokumen rusak/tidak standar, atau terjadi kegagalan teknis lain — sehingga verifikasi manual oleh Pengguna tetap diperlukan sebagaimana diatur pada Bagian 6.

## 11. Disclaimer Jaminan
LAYANAN DISEDIAKAN "SEBAGAIMANA ADANYA" (AS IS) DAN "SEBAGAIMANA TERSEDIA" (AS AVAILABLE), TANPA JAMINAN APA PUN, BAIK TERSURAT MAUPUN TERSIRAT, TERMASUK NAMUN TIDAK TERBATAS PADA JAMINAN KEAKURATAN HASIL EKSTRAKSI, KESESUAIAN UNTUK TUJUAN TERTENTU, ATAU KETERSEDIAAN LAYANAN YANG TIDAK TERPUTUS. Irfan TIDAK MENJAMIN BAHWA EKSTENSI AKAN SELALU KOMPATIBEL DENGAN PERUBAHAN PADA PORTAL CORETAX, KARENA EKSTENSI BERGANTUNG SEPENUHNYA PADA STRUKTUR HALAMAN DAN API CORETAX YANG DAPAT BERUBAH SEWAKTU-WAKTU DI LUAR KENDALI Irfan.

## 12. Pembatasan Tanggung Jawab
SEJAUH DIIZINKAN OLEH HUKUM YANG BERLAKU, Irfan TIDAK BERTANGGUNG JAWAB ATAS KERUGIAN LANGSUNG, TIDAK LANGSUNG, INSIDENTAL, KHUSUS, ATAU KONSEKUENSIAL YANG TIMBUL DARI ATAU BERKAITAN DENGAN PENGGUNAAN LAYANAN, TERMASUK NAMUN TIDAK TERBATAS PADA KESALAHAN PELAPORAN PAJAK AKIBAT KETIDAKAKURATAN HASIL EKSTRAKSI YANG TIDAK DIVERIFIKASI OLEH PENGGUNA, KEHILANGAN AKSES KE CORETAX, ATAU GANGGUAN PADA SESI LOGIN ANDA.

## 13. Ganti Rugi (Indemnifikasi)
Anda setuju untuk membebaskan dan mengganti rugi Irfan dari segala klaim, kerugian, atau tuntutan pihak ketiga yang timbul akibat penggunaan Layanan oleh Anda yang melanggar Syarat dan Ketentuan ini, Syarat dan Ketentuan CoreTax/DJP Online, atau peraturan perundang-undangan yang berlaku, termasuk penggunaan Layanan untuk mengakses data tanpa kewenangan yang sah.

## 14. Penghentian Penggunaan
Karena Layanan tidak memiliki sistem akun di sisi Irfan, tidak ada mekanisme penangguhan atau penghentian akun oleh Irfan. Anda dapat menghentikan penggunaan Layanan kapan pun dengan mencopot pemasangan (uninstall) Ekstensi melalui pengaturan ekstensi browser Anda. Irfan berhak menghentikan pengembangan, pembaruan, atau ketersediaan Ekstensi kapan pun tanpa kewajiban lebih lanjut kepada Pengguna, mengingat Layanan disediakan tanpa biaya.

## 15. Perubahan Syarat dan Ketentuan
Irfan dapat memperbarui Syarat dan Ketentuan ini dari waktu ke waktu, termasuk apabila terdapat perubahan fitur, penambahan layanan berbayar, atau perubahan cara distribusi Ekstensi. Versi terbaru akan tersedia melalui repositori resmi Ekstensi ini (termasuk README) dan, apabila di kemudian hari didistribusikan melalui Chrome Web Store, melalui halaman listing resmi Ekstensi di sana. Penggunaan Layanan yang berkelanjutan setelah perubahan berlaku dianggap sebagai penerimaan terhadap perubahan tersebut.

## 16. Hukum yang Berlaku dan Penyelesaian Sengketa
Syarat dan Ketentuan ini diatur oleh dan ditafsirkan berdasarkan hukum Republik Indonesia. Setiap perselisihan yang timbul akan diupayakan diselesaikan terlebih dahulu melalui musyawarah untuk mufakat; apabila tidak tercapai kesepakatan, sengketa akan diselesaikan melalui pengadilan negeri yang berwenang di Indonesia sesuai domisili Irfan.

## 17. Informasi Kontak
Pertanyaan mengenai Syarat dan Ketentuan ini dapat disampaikan melalui: irfanpmawaza@gmail.com.
