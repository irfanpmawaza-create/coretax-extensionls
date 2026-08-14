# Syarat dan Ketentuan Layanan — Draft

**Status: DRAFT — belum ditinjau oleh penasihat hukum. Lihat Catatan Reviewer di bagian akhir.**

Dokumen ini disusun dalam tiga bagian sesuai permintaan: (1) hasil investigasi codebase dengan rujukan file:baris, (2) daftar informasi yang belum dapat dipastikan dari kode dan perlu konfirmasi, (3) draf Syarat dan Ketentuan itu sendiri.

---

## Bagian 1 — Hasil Investigasi (Berbasis Bukti)

### 1.1 Apa yang dilakukan layanan ini
Repo ini adalah **ekstensi browser Chrome (Manifest V3)**, bukan aplikasi web/backend. Tidak ada `package.json`, tidak ada server, tidak ada API milik pengembang.

- `manifest.json:3` — nama: "CoreTax PDF Downloader & Ekspor Excel"
- `manifest.json:4-5` — versi 1.1.0 ("Multi Periode")
- `manifest.json:6` — deskripsi: membantu mengunduh dokumen PDF CoreTax dan mengekspor hasil ekstraksi ke Excel
- `manifest.json:13-15` — `host_permissions` **hanya** `https://coretaxdjp.pajak.go.id/*`
- `manifest.json:24-39` — content script hanya berjalan di dua path: `e-invoice-portal/*` dan `withholding-slips-portal/*` pada domain tersebut
- `manifest.json:7-12` — permission yang diminta: `activeTab`, `scripting`, `downloads`, `webRequest` — **tidak ada** `storage`, `cookies`, `tabs`, `identity`, `notifications`, atau host permission lain

**Kesimpulan:** ini adalah ekstensi tidak resmi (unofficial) pihak ketiga yang beroperasi secara eksklusif di atas portal CoreTax milik Direktorat Jenderal Pajak (DJP). Tidak ada afiliasi dengan DJP yang ditemukan di kode.

### 1.2 Akun pengguna & autentikasi
- **Tidak ada sistem akun/login milik ekstensi ini.** Tidak ditemukan form login, signup, atau endpoint autentikasi milik pengembang.
- Ekstensi menumpang sesi CoreTax yang sudah aktif di browser pengguna sendiri.
- `background.js:175-236, 361-404, 532-583` — fitur Multi Periode menangkap header `Authorization` dan body request dari request API CoreTax yang sudah berjalan (`webRequest.onBeforeRequest`/`onBeforeSendHeaders`) untuk tiga endpoint: Faktur Keluaran, Faktur Masukan, dan Bukti Potong.
- `background.js:176, 362, 533` — data yang ditangkap disimpan **hanya di memori** (`Map` per `tabId`) di dalam service worker. Tidak ditulis ke `chrome.storage` atau disk (dikonfirmasi: nol pemanggilan `chrome.storage.*` di seluruh kode).
- `background.js:238-273, 406-441, 585-620` — header Authorization yang ditangkap digunakan kembali via `fetch(..., credentials:"include")` yang dieksekusi di konteks JS halaman CoreTax sendiri (`chrome.scripting.executeScript({world:"MAIN"})`) untuk mengambil halaman data tambahan (pagination) — tetap dalam sesi milik pengguna, tidak pernah dikirim keluar domain.
- `content.js:159-174` — satu-satunya penggunaan `localStorage` di seluruh kode: menyimpan posisi toolbar (`{top,left}`) yang bisa di-drag, di domain CoreTax sendiri — preferensi UI, bukan kredensial.
- `README.txt:19-22` — pernyataan pengembang sendiri: tidak ada token CoreTax yang di-hardcode; header Authorization hanya ditangkap sementara di memori.

### 1.3 Paket berbayar / penagihan / langganan
- Pencarian kata kunci `payment|billing|subscription|license|stripe|price|paywall|checkout` di seluruh file `.js` — **nol hasil**.
- Tidak ada tier harga, tidak ada license key, tidak ada paywall pada fitur apa pun di `popup.js`/`content.js`.

**Kesimpulan: layanan saat ini sepenuhnya gratis, tidak ada mekanisme monetisasi apa pun di kode.** (Catatan: permintaan Anda menyebut "ketentuan komersial" — lihat pertanyaan konfirmasi di Bagian 2.)

### 1.4 Konten pengguna
- Input dari pengguna hanya berupa parameter operasional: rentang Tahun/Bulan (`popup.html:38-49`) untuk fitur multi periode — bukan konten pribadi.
- Ekstensi **menghasilkan** file: PDF yang diambil dari CoreTax dan file Excel yang dibangun di sisi klien (`excel-exporter.js:1-52`, menggunakan library SheetJS lokal `libs/xlsx.full.min.js`).
- `excel-exporter.js:41-51` — file Excel dibuat sebagai `Blob` lokal lalu diunduh via `<a download>` — **tidak ada transmisi jaringan**, murni unduhan lokal ke perangkat pengguna.
- `background.js:113-168` — nama file unduhan diubah otomatis via `chrome.downloads.onDeterminingFilename`; hasil tetap tersimpan di disk lokal pengguna.
- `background.js:36-73` (`cleanupDownloadedFile`) — pada mode "Excel Saja", PDF sementara yang terpaksa dibuat browser dihapus via `chrome.downloads.removeFile` + `chrome.downloads.erase` — ini menghapus file dari **disk/riwayat unduhan milik pengguna sendiri**, bukan data di server mana pun.
- **Tidak ada file atau data yang diunggah ke server milik pengembang** — satu-satunya tujuan jaringan di seluruh kode adalah `coretaxdjp.pajak.go.id`.

### 1.5 Fitur AI / otomatis
- Pencarian `openai|anthropic|claude|gpt|llm|machine.?learning|\bai\b` — **nol hasil** di seluruh kode.
- "Otomatisasi" di sini berarti: scraping DOM tabel CoreTax, klik terprogram pada tombol unduh milik CoreTax, ekstraksi teks/tabel PDF via library PDF.js (Mozilla, di-vendor pada `libs/pdf.min.js`), dan pemanggilan ulang REST API CoreTax dengan token sesi yang ditangkap.

**Kesimpulan: tidak ada AI/ML/LLM. Hasil ekstraksi adalah hasil parsing PDF/DOM otomatis (non-AI) yang dapat mengandung kesalahan — perlu disclaimer akurasi.**

### 1.6 Layanan pihak ketiga
- **Nol panggilan jaringan eksternal** di luar `coretaxdjp.pajak.go.id` (dikonfirmasi lewat pencarian semua string `https?://` di `.js/.json/.html/.txt`).
- Library pihak ketiga di-**vendor secara lokal** (bukan dimuat dari CDN saat runtime):
  - `libs/pdf.min.js` + `libs/pdf.worker.min.js` — PDF.js (Mozilla)
  - `libs/xlsx.full.min.js` — SheetJS, header hak cipta terkonfirmasi di baris 1: `xlsx.js (C) 2013-present SheetJS`
- Tidak ada library analytics/error-reporting (`analytics|sentry|tracking|telemetry|mixpanel|amplitude|gtag` — nol hasil).
- Karena berjalan di atas CoreTax milik DJP, **Syarat & Ketentuan penggunaan CoreTax/DJP Online tetap berlaku bagi pengguna secara independen** — ekstensi ini tidak menggantikannya.

### 1.7 Batas penggunaan / rate limit / acceptable use
- `content.js:11` — jeda 1800ms (1,8 detik) antar-unduhan PDF (`this.delayBetweenDownloads`), diterapkan sebagai jeda sopan-santun terhadap server CoreTax, **bukan** kuota/lisensi.
- `background.js:297, 465, 643` — pagination 50 baris per panggilan API (ukuran halaman server, bukan pembatasan penggunaan).
- `popup.js:77-85` — validasi input (tahun 2020-2100, bulan 1-12) — validasi form, bukan quota.
- **Tidak ada pembatasan jumlah penggunaan, license check, atau enforcement acceptable-use di kode.**

### 1.8 Suspensi akun / penghentian layanan / penghapusan data
- **Tidak relevan secara teknis** — tidak ada sistem akun (lihat 1.2), sehingga tidak ada apa pun di sisi pengembang untuk disuspend/dihentikan/dihapus.
- Satu-satunya "penghapusan" dalam kode bersifat lokal: pembersihan file PDF sementara di disk pengguna sendiri (lihat 1.4).
- Penghentian penggunaan hanya melalui uninstall ekstensi via `chrome://extensions` (mekanisme bawaan browser).

### 1.9 Temuan tambahan yang relevan secara hukum
- **Tidak ada file `LICENSE`** — status lisensi kode itu sendiri tidak terdefinisi di repo.
- **Tidak ada disclaimer "tidak berafiliasi dengan DJP/pemerintah"** di mana pun dalam repo. `README.txt:49-51` hanya berisi dua disclaimer: pengguna wajib memverifikasi hasil ekstrak, dan ekstensi tidak mengirim data ke server eksternal.
- `popup.html:9` — logo yang ditampilkan di popup memiliki `alt="logo_kap_LS"` (file `kapls.png`), mengindikasikan kemungkinan afiliasi dengan sebuah "KAP LS" (Kantor Akuntan Publik). **Ini perlu dikonfirmasi** — apakah layanan ini disediakan oleh individu atau oleh entitas KAP tersebut.
- Cara instalasi yang didokumentasikan (`README.txt:33-39`) adalah "Load unpacked" — ekstensi ini **belum dikonfirmasi terdaftar di Chrome Web Store**; ini memengaruhi bagaimana pengguna memperoleh/memperbarui ekstensi dan klausul terkait itu.

---

## Bagian 2 — Informasi yang Perlu Dikonfirmasi

Item berikut **tidak dapat ditentukan dari kode** dan secara material memengaruhi isi Syarat & Ketentuan. Saya menggunakan asumsi berlabel jelas dalam draf (Bagian 3) memakai placeholder `[...]`; mohon dikoreksi.

1. ~~**Nama badan hukum/pemilik layanan**~~ — **DIKONFIRMASI:** individu, Irfan (bukan badan usaha/KAP). Logo "kapls.png" pada `popup.html:9` bukan indikasi afiliasi entitas — diperlakukan sebagai branding pribadi saja.
2. ~~**Model komersial**~~ — **DIKONFIRMASI:** belum ada fitur berbayar di kode saat ini; layanan berbayar direncanakan untuk masa depan. Draf memakai bahasa yang secara eksplisit membedakan status saat ini (gratis) dari kemungkinan perubahan mendatang, agar ToS ini tidak perlu ditulis ulang total saat fitur berbayar diluncurkan — namun **detail harga/langganan/refund tetap wajib ditambahkan lewat pembaruan ToS terpisah sebelum fitur berbayar aktif**, bukan diam-diam berlaku dari draf generik ini.
3. **Hukum yang berlaku & forum penyelesaian sengketa** — asumsi wajar: hukum Republik Indonesia (karena objeknya adalah sistem pajak Indonesia), tetapi domisili forum/pengadilan perlu ditentukan → placeholder `[KOTA/PENGADILAN]`.
4. **Usia & kelayakan pengguna** — asumsi: pengguna adalah individu/profesional yang cakap hukum (≥18 tahun) yang menggunakan CoreTax untuk keperluan perpajakan sendiri/klien → mohon konfirmasi apakah perlu batasan tambahan (mis. hanya untuk kuasa wajib pajak/konsultan pajak terdaftar).
5. **Harga & kebijakan refund** — tidak berlaku selama layanan gratis (lihat poin 2). Jika berbayar di masa depan, perlu draf terpisah.
6. **Posisi jaminan (warranty) & pembatasan tanggung jawab** — draf menggunakan bahasa standar "disediakan apa adanya" (as-is) dan pembatasan tanggung jawab seluas yang diizinkan hukum yang berlaku. Mohon konfirmasi apakah ini sesuai preferensi Anda atau ada posisi khusus yang diinginkan.
7. **Preferensi mekanisme penyelesaian sengketa** — musyawarah → pengadilan negeri, atau arbitrase (mis. BANI)? Draf mengasumsikan musyawarah lalu pengadilan negeri Indonesia → placeholder.
8. ~~**Informasi kontak**~~ — **DIKONFIRMASI:** irfanpmawaza@gmail.com.
9. **Status distribusi** — apakah akan dipublikasikan ke Chrome Web Store (yang membawa Google Chrome Web Store Program Policies sendiri) atau tetap didistribusikan sebagai "Load unpacked"? Ini memengaruhi klausul terkait cara memperoleh/memperbarui ekstensi.

---

## Bagian 3 — Draft Syarat dan Ketentuan Layanan

*(Bahasa Indonesia — sesuaikan placeholder `[...]` sebelum publikasi)*

### SYARAT DAN KETENTUAN LAYANAN
**Irfan** (individu, pengembang independen) — "CoreTax PDF Downloader & Ekspor Excel"
Terakhir diperbarui: [TANGGAL]

#### 1. Penerimaan Syarat dan Ketentuan
Dengan memasang, mengaktifkan, atau menggunakan ekstensi browser "CoreTax PDF Downloader & Ekspor Excel" ("Ekstensi", "Layanan"), Anda ("Pengguna") menyetujui Syarat dan Ketentuan ini. Jika Anda tidak menyetujui, jangan memasang atau gunakan Ekstensi, dan copot pemasangan (uninstall) jika sudah terpasang.

#### 2. Deskripsi Layanan
Ekstensi ini adalah alat bantu (tool) pihak ketiga yang **tidak resmi dan tidak berafiliasi dengan, tidak didukung oleh, dan tidak disponsori oleh Direktorat Jenderal Pajak (DJP) atau Pemerintah Republik Indonesia**. Ekstensi berjalan secara lokal di browser Anda dan hanya berinteraksi dengan halaman resmi CoreTax di domain `coretaxdjp.pajak.go.id`, khususnya pada modul e-Invoice (Faktur Keluaran/Masukan) dan Bukti Potong.

Fungsi utama Layanan:
- Mengunduh dokumen PDF dari halaman CoreTax yang sedang Anda buka menggunakan sesi login Anda sendiri.
- Mengekstrak data faktur/bukti potong (termasuk Dasar Pengenaan Pajak dan Jumlah PPN) dari dokumen tersebut ke dalam file Excel.
- Menyediakan mode "Buat Excel Saja" yang menghapus file PDF sementara dari perangkat Anda setelah data diekstrak.
- Menggabungkan data dari beberapa masa pajak (multi periode) ke dalam satu file Excel, dengan cara memanggil ulang API CoreTax menggunakan sesi login Anda yang sedang aktif.

Semua pemrosesan data (ekstraksi PDF dan pembuatan file Excel) dilakukan **sepenuhnya di perangkat/browser Anda**. Layanan tidak memiliki server backend dan tidak mengirimkan dokumen atau data Anda ke server mana pun milik Irfan atau pihak ketiga mana pun.

#### 3. Kelayakan Pengguna
Layanan ini ditujukan untuk digunakan oleh individu yang cakap secara hukum untuk mengikatkan diri pada perjanjian (termasuk wajib pajak, kuasa wajib pajak, konsultan pajak, staf akuntansi/pajak, atau pihak lain yang memiliki akses sah ke akun CoreTax terkait) [ASUMSI: minimal berusia 18 tahun atau usia dewasa menurut hukum yang berlaku di domisili Anda — mohon konfirmasi]. Anda bertanggung jawab untuk memastikan bahwa penggunaan Layanan sesuai dengan kewenangan Anda mengakses data CoreTax yang bersangkutan.

#### 4. Akun dan Sesi CoreTax
Ekstensi ini **tidak menyediakan sistem akun, login, atau kredensial sendiri**. Ekstensi hanya menggunakan sesi login CoreTax yang sudah Anda buat sendiri melalui situs resmi `coretaxdjp.pajak.go.id`. Anda tetap sepenuhnya bertanggung jawab atas:
- keamanan kredensial login CoreTax Anda;
- kepatuhan terhadap Syarat dan Ketentuan penggunaan CoreTax/DJP Online yang berlaku secara terpisah dari dokumen ini;
- seluruh aktivitas yang terjadi melalui sesi login Anda saat Ekstensi digunakan.

Token otorisasi (Authorization header) dari sesi CoreTax Anda ditangkap dan disimpan **secara sementara di memori** ekstensi (service worker) semata-mata untuk menjalankan fungsi pengambilan data multi periode, dan **tidak ditulis ke penyimpanan permanen, tidak di-hardcode, dan tidak dikirim ke server mana pun** selain digunakan untuk memanggil API resmi CoreTax itu sendiri.

#### 5. Penggunaan yang Diperbolehkan dan Dilarang
Anda setuju untuk menggunakan Layanan hanya untuk mengakses dan mengekspor data yang secara sah dapat Anda akses melalui akun CoreTax Anda sendiri. Anda dilarang:
- menggunakan Layanan untuk mengakses data CoreTax milik pihak lain tanpa kewenangan yang sah;
- menggunakan Layanan dengan cara yang melanggar Syarat dan Ketentuan CoreTax/DJP Online atau peraturan perundang-undangan perpajakan yang berlaku;
- merekayasa balik (reverse engineer), mendekompilasi, atau memodifikasi Ekstensi untuk tujuan mengganggu, membebani, atau menyalahgunakan sistem CoreTax;
- menggunakan Layanan dengan volume atau frekuensi permintaan yang dapat membebani atau mengganggu server CoreTax secara tidak wajar.

Layanan menerapkan jeda otomatis antar-unduhan dokumen sebagai bentuk penggunaan yang wajar terhadap server CoreTax; Anda tidak diperkenankan memodifikasi Ekstensi untuk menghilangkan jeda tersebut dengan maksud membebani server CoreTax.

#### 6. Data dan File yang Dihasilkan
Seluruh dokumen PDF dan file Excel yang dihasilkan oleh Layanan disimpan **langsung ke perangkat penyimpanan lokal Anda** melalui fitur unduhan bawaan browser. Irfan tidak menyimpan, mengakses, atau memiliki salinan dokumen atau data yang Anda ekstrak — data tersebut sepenuhnya berada dalam kendali Anda begitu diunduh.

Anda bertanggung jawab penuh untuk **memeriksa dan memverifikasi keakuratan hasil ekstraksi** (termasuk namun tidak terbatas pada nomor faktur, Dasar Pengenaan Pajak, dan Jumlah PPN) sebelum menggunakannya untuk keperluan pelaporan pajak, akuntansi, atau pekerjaan lain apa pun. Layanan hanya melakukan penguraian (parsing) otomatis atas dokumen dan tidak melakukan verifikasi substantif atas kebenaran isi dokumen.

#### 7. Layanan Tanpa Biaya (Saat Ini) dan Kemungkinan Fitur Berbayar di Masa Depan
Berdasarkan kondisi Layanan saat ini, seluruh fitur yang tersedia dalam Ekstensi (termasuk unduhan PDF, ekspor Excel, dan fitur multi periode) **tidak dipungut biaya**.

Irfan berencana untuk memperkenalkan fitur dan/atau paket berbayar di masa depan. Sebelum fitur berbayar tersebut diberlakukan bagi Pengguna, Irfan akan:
- memperbarui Syarat dan Ketentuan ini untuk mencantumkan secara jelas fitur mana yang berbayar, struktur harga, mekanisme penagihan, dan kebijakan pengembalian dana (refund) yang berlaku; dan
- memberikan Pengguna kesempatan untuk meninjau ketentuan tersebut sebelum fitur berbayar aktif digunakan.

Fitur yang sudah tersedia secara gratis pada versi Ekstensi yang telah Anda pasang tidak akan dijadikan berbayar secara retroaktif tanpa pemberitahuan. [ASUMSI — mohon konfirmasi apakah komitmen ini sesuai rencana Anda, atau apakah fitur gratis yang sudah ada juga berpotensi dipindah ke tier berbayar di kemudian hari.]

#### 8. Hak Kekayaan Intelektual
Ekstensi, termasuk kode, tampilan antarmuka, dan branding di dalamnya, adalah milik Irfan [ASUMSI: status lisensi kode belum ditentukan — repo tidak memiliki berkas LISENSI]. Ekstensi menyertakan pustaka pihak ketiga sumber terbuka berikut yang tunduk pada lisensinya masing-masing:
- **PDF.js** (Mozilla) — digunakan untuk membaca/mengekstrak isi dokumen PDF;
- **SheetJS (xlsx.js)** — digunakan untuk membuat file Excel.

Anda tidak diperkenankan menyalin, mendistribusikan ulang, atau menjual Ekstensi tanpa izin tertulis dari Irfan, kecuali sepanjang diizinkan oleh lisensi pustaka pihak ketiga di atas.

#### 9. Layanan Pihak Ketiga
Ekstensi berinteraksi secara eksklusif dengan portal CoreTax (`coretaxdjp.pajak.go.id`) yang dikelola oleh Direktorat Jenderal Pajak. Penggunaan CoreTax itu sendiri tunduk pada syarat dan ketentuan, kebijakan, serta peraturan yang ditetapkan oleh DJP/Pemerintah Republik Indonesia, yang berlaku secara independen dari dan tidak dapat diubah oleh Syarat dan Ketentuan ini. Irfan tidak mengendalikan, dan tidak bertanggung jawab atas, ketersediaan, kebijakan, atau perubahan pada portal CoreTax.

#### 10. Tidak Ada Fitur Kecerdasan Buatan (AI)
Layanan **tidak menggunakan kecerdasan buatan (AI) atau machine learning**. Ekstraksi data dilakukan melalui penguraian teks/struktur dokumen PDF dan halaman web secara deterministik (rule-based). Hasil ekstraksi dapat keliru apabila format dokumen sumber berubah, dokumen rusak/tidak standar, atau terjadi kegagalan teknis lain — sehingga verifikasi manual oleh Pengguna tetap diperlukan sebagaimana diatur pada Bagian 6.

#### 11. Disclaimer Jaminan
LAYANAN DISEDIAKAN "SEBAGAIMANA ADANYA" (AS IS) DAN "SEBAGAIMANA TERSEDIA" (AS AVAILABLE), TANPA JAMINAN APA PUN, BAIK TERSURAT MAUPUN TERSIRAT, TERMASUK NAMUN TIDAK TERBATAS PADA JAMINAN KEAKURATAN HASIL EKSTRAKSI, KESESUAIAN UNTUK TUJUAN TERTENTU, ATAU KETERSEDIAAN LAYANAN YANG TIDAK TERPUTUS. Irfan TIDAK MENJAMIN BAHWA EKSTENSI AKAN SELALU KOMPATIBEL DENGAN PERUBAHAN PADA PORTAL CORETAX, KARENA EKSTENSI BERGANTUNG SEPENUHNYA PADA STRUKTUR HALAMAN DAN API CORETAX YANG DAPAT BERUBAH SEWAKTU-WAKTU DI LUAR KENDALI Irfan.

#### 12. Pembatasan Tanggung Jawab
SEJAUH DIIZINKAN OLEH HUKUM YANG BERLAKU, Irfan TIDAK BERTANGGUNG JAWAB ATAS KERUGIAN LANGSUNG, TIDAK LANGSUNG, INSIDENTAL, KHUSUS, ATAU KONSEKUENSIAL YANG TIMBUL DARI ATAU BERKAITAN DENGAN PENGGUNAAN LAYANAN, TERMASUK NAMUN TIDAK TERBATAS PADA KESALAHAN PELAPORAN PAJAK AKIBAT KETIDAKAKURATAN HASIL EKSTRAKSI YANG TIDAK DIVERIFIKASI OLEH PENGGUNA, KEHILANGAN AKSES KE CORETAX, ATAU GANGGUAN PADA SESI LOGIN ANDA. [ASUMSI: klausul ini menggunakan bahasa standar pembatasan tanggung jawab seluas mungkin yang diizinkan hukum Indonesia — mohon konfirmasi posisi yang Anda inginkan.]

#### 13. Ganti Rugi (Indemnifikasi)
Anda setuju untuk membebaskan dan mengganti rugi Irfan dari segala klaim, kerugian, atau tuntutan pihak ketiga yang timbul akibat penggunaan Layanan oleh Anda yang melanggar Syarat dan Ketentuan ini, Syarat dan Ketentuan CoreTax/DJP Online, atau peraturan perundang-undangan yang berlaku, termasuk penggunaan Layanan untuk mengakses data tanpa kewenangan yang sah.

#### 14. Penghentian Penggunaan
Karena Layanan tidak memiliki sistem akun di sisi Irfan, tidak ada mekanisme penangguhan atau penghentian akun oleh Irfan. Anda dapat menghentikan penggunaan Layanan kapan pun dengan mencopot pemasangan (uninstall) Ekstensi melalui pengaturan ekstensi browser Anda. Irfan berhak menghentikan pengembangan, pembaruan, atau ketersediaan Ekstensi kapan pun tanpa kewajiban lebih lanjut kepada Pengguna, mengingat Layanan disediakan tanpa biaya.

#### 15. Perubahan Syarat dan Ketentuan
Irfan dapat memperbarui Syarat dan Ketentuan ini dari waktu ke waktu, termasuk apabila terdapat perubahan fitur, penambahan layanan berbayar, atau perubahan cara distribusi Ekstensi. Versi terbaru akan tersedia [MELALUI: repositori/README/Chrome Web Store — placeholder, mohon konfirmasi saluran resmi]. Penggunaan Layanan yang berkelanjutan setelah perubahan berlaku dianggap sebagai penerimaan terhadap perubahan tersebut.

#### 16. Hukum yang Berlaku dan Penyelesaian Sengketa
Syarat dan Ketentuan ini diatur oleh dan ditafsirkan berdasarkan hukum Republik Indonesia [ASUMSI — mohon konfirmasi]. Setiap perselisihan yang timbul akan diupayakan diselesaikan terlebih dahulu melalui musyawarah untuk mufakat; apabila tidak tercapai kesepakatan, sengketa akan diselesaikan melalui [Pengadilan Negeri [KOTA] / mekanisme lain sesuai preferensi Anda — placeholder].

#### 17. Informasi Kontak
Pertanyaan mengenai Syarat dan Ketentuan ini dapat disampaikan melalui: irfanpmawaza@gmail.com.

---

## Catatan Reviewer

**Sudah dikonfirmasi pengguna (tidak lagi berupa asumsi):**
- Pemilik layanan adalah individu, **Irfan** — bukan badan usaha/KAP, meskipun logo popup (`popup.html:9`) menampilkan "kapls.png"/"logo_kap_LS".
- Saat ini **tidak ada** fitur berbayar; fitur berbayar **direncanakan untuk masa depan**. Bagian 7 sudah disusun agar ToS ini tetap berlaku untuk versi gratis saat ini, dengan komitmen eksplisit bahwa ketentuan harga/penagihan/refund akan ditambahkan lewat pembaruan ToS terpisah sebelum fitur berbayar aktif — **bukan** berlaku otomatis dari draf generik ini begitu fitur berbayar diluncurkan.
- Kontak resmi: irfanpmawaza@gmail.com (Bagian 17).

**Asumsi yang masih tersisa dalam draf ini** (semua ditandai `[...]` di teks dan wajib dikonfirmasi/diganti sebelum publikasi):
1. Hukum yang berlaku diasumsikan hukum Indonesia (karena objek layanan adalah sistem pajak Indonesia), tetapi forum penyelesaian sengketa (kota pengadilan) belum ditentukan.
2. Batas usia pengguna diasumsikan dewasa/cakap hukum secara umum — tidak ada mekanisme verifikasi usia di kode (memang tidak dibutuhkan untuk ekstensi tanpa akun).
3. Bahasa disclaimer jaminan dan pembatasan tanggung jawab pada Bagian 11–12 menggunakan formulasi standar/luas — belum tentu mencerminkan posisi risiko spesifik yang Anda inginkan.
4. Mekanisme penyelesaian sengketa (musyawarah → pengadilan negeri) adalah asumsi default; belum dikonfirmasi preferensi arbitrase.
5. Status lisensi kode sumber (Bagian 8) belum ditentukan karena tidak ada berkas `LICENSE` di repo.
6. Saluran distribusi resmi (Chrome Web Store vs. distribusi manual "Load unpacked") belum dikonfirmasi — memengaruhi Bagian 15 tentang cara pembaruan diumumkan.
7. Belum ditentukan apakah fitur gratis yang sudah ada berpotensi dipindah ke tier berbayar nanti, atau hanya fitur baru yang akan berbayar (lihat Bagian 7).

**Yang TIDAK diklaim dalam draf ini** karena tidak didukung bukti kode: tidak ada klaim adanya fitur AI, tidak ada klaim pengumpulan/penjualan data pengguna, tidak ada klaim biaya/langganan, tidak ada klaim afiliasi resmi dengan DJP, dan tidak ada klaim penyimpanan data di server mana pun — karena kode memang tidak melakukan hal-hal tersebut.

**PENTING:** Dokumen ini adalah draf yang disusun oleh AI berdasarkan analisis kode, bukan nasihat hukum. Draf ini **wajib ditinjau dan disahkan oleh advokat/penasihat hukum yang berkualifikasi** di bidang hukum siber, perlindungan data, dan/atau hukum perpajakan Indonesia sebelum dipublikasikan atau digunakan secara resmi — khususnya karena layanan ini berinteraksi dengan sistem perpajakan pemerintah dan menyangkut data yang berpotensi sensitif (data faktur pajak).
