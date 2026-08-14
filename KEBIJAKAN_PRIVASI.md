# Kebijakan Privasi — Draft

**Status: DRAFT — belum ditinjau oleh penasihat hukum. Lihat Catatan Reviewer di bagian akhir.**

---

## Bagian 1 — Hasil Investigasi (Berbasis Bukti)

### 1.1 Data pribadi apa saja yang diproses
Ekstensi ini mengekstrak dokumen pajak (Faktur Pajak / Bukti Potong) dari CoreTax yang **secara inheren berisi data pribadi** pihak-pihak yang tercantum di dokumen tersebut (bukan data pribadi milik pengguna Ekstensi semata, melainkan juga data pihak ketiga — penjual, pembeli, pihak yang dipotong pajaknya).

Field yang diekstrak dan ditulis ke file Excel, dikonfirmasi lewat kode:

**Faktur Keluaran/Masukan** — `content.js:483-507` (`mapOutputInvoiceToExcelRow`):
- `content.js:491` — NPWP Penjual (`SellerTIN`)
- `content.js:492` — Nama Penjual (`SellerTaxpayerName`)
- `content.js:493` — NPWP Pembeli (`BuyerTIN`)
- `content.js:494` — Nama Pembeli (`BuyerTaxpayerNameClear`/`BuyerName`/dll.)
- `content.js:489, 490, 495-505` — data transaksional non-pribadi: nomor & tanggal faktur, DPP, PPN, PPnBM, status, referensi, penandatangan, metode input, tanggal dibuat/update

**Bukti Potong** — `content.js:719-737` (`mapWithholdingSlipToExcelRow`):
- `content.js:726` — **NPWP/NIK Dipotong** (`TaxIdentificationNumber`) — NIK adalah Nomor Induk Kependudukan, data pribadi yang bersifat spesifik menurut UU PDP
- `content.js:727` — Nama Dipotong (`Name`)
- field lainnya: nomor/tanggal bukti potong, kode objek pajak, pasal, penghasilan bruto, DPP, tarif, PPh dipotong, status

**Kesimpulan: Ekstensi memproses data pribadi pihak ketiga (nama dan NPWP/NIK) yang terkandung dalam dokumen pajak resmi**, sebagai bagian inheren dari fungsi ekstraksi datanya — bukan karena Ekstensi mengumpulkan data pribadi secara independen.

Selain itu, data operasional terkait pengguna Ekstensi sendiri:
- `popup.html:38-49` — input Tahun/Bulan yang dipilih pengguna (parameter operasional, bukan data pribadi)
- `content.js:159-174` — posisi toolbar (`{top, left}`) tersimpan di `localStorage` domain CoreTax — preferensi UI, bukan data pribadi

### 1.2 Di mana data disimpan
- **Tidak ada database atau server backend milik pengembang.** Repo tidak memiliki `package.json`/server — ini murni ekstensi browser sisi klien.
- File PDF dan Excel hasil ekstraksi disimpan **langsung ke disk lokal pengguna** melalui `chrome.downloads` (`background.js:113-168` — penamaan file otomatis via `onDeterminingFilename`; `excel-exporter.js:41-51` — `Blob` + `<a download>` untuk file Excel).
- `background.js:36-73` (`cleanupDownloadedFile`) — pada mode "Excel Saja", file PDF sementara dihapus dari disk/riwayat unduhan lokal pengguna via `chrome.downloads.removeFile`/`erase` setelah data diekstrak.
- `background.js:175-236, 361-404, 532-583` — token Authorization sesi CoreTax ditangkap **hanya di memori volatil** (`Map` per `tabId`) dalam service worker; hilang otomatis saat service worker berhenti/direstart. **Tidak** ditulis ke `chrome.storage`, disk, atau file konfigurasi (dikonfirmasi: nol pemanggilan `chrome.storage.*` di seluruh kode — pencarian eksplisit menghasilkan nol hasil).
- `content.js:159-174` — satu-satunya `localStorage` yang dipakai menyimpan posisi toolbar, bukan data pribadi/dokumen.

**Kesimpulan: seluruh data pribadi yang diproses tetap berada di perangkat pengguna sendiri (memori sementara browser + file yang diunduh ke disk lokal). Tidak ada penyimpanan data di infrastruktur milik pengembang.**

### 1.3 Bagaimana data diamankan
- Seluruh komunikasi jaringan terjadi lewat **HTTPS** ke `coretaxdjp.pajak.go.id` (`manifest.json:14, 27-28, 58` — semua endpoint memakai skema `https://`).
- `background.js:238-273, 406-441, 585-620` — pengambilan data tambahan (pagination) memakai `fetch(..., credentials:"include")` yang dijalankan di konteks halaman CoreTax sendiri (`chrome.scripting.executeScript({world:"MAIN"})`), sehingga permintaan tetap terikat pada sesi login CoreTax pengguna dan cookie/keamanan bawaan CoreTax — Ekstensi tidak membuat jalur otentikasi terpisah.
- Tidak ada enkripsi tambahan yang diterapkan Ekstensi sendiri terhadap file Excel/PDF yang diunduh — file tersimpan sebagai file biasa di folder unduhan browser, tunduk pada keamanan sistem operasi/disk pengguna itu sendiri (di luar kendali Ekstensi).
- `manifest.json:7-12` — permission yang diminta dibatasi seminimal mungkin: `activeTab`, `scripting`, `downloads`, `webRequest` — tidak ada `storage`, `cookies`, `identity`, atau host permission di luar domain CoreTax.

**Kesimpulan: keamanan data bertumpu pada (a) HTTPS bawaan CoreTax, (b) penyimpanan token hanya di memori volatil, dan (c) permission ekstensi yang minimal. Tidak ada mekanisme enkripsi-at-rest tambahan yang diimplementasikan oleh Ekstensi terhadap file yang diunduh ke disk pengguna.**

### 1.4 Layanan pihak ketiga yang menerima/memproses data
- Pencarian seluruh string `https?://` di kode (`.js/.json/.html/.txt`) menunjukkan **satu-satunya** tujuan jaringan adalah `coretaxdjp.pajak.go.id` — tidak ada domain pihak ketiga lain yang dihubungi.
- Library yang digunakan untuk memproses data **berjalan lokal di browser, tidak mengirim data ke mana pun**:
  - `libs/pdf.min.js` + `libs/pdf.worker.min.js` — PDF.js (Mozilla), dipakai untuk membaca isi PDF secara lokal
  - `libs/xlsx.full.min.js` — SheetJS (`libs/xlsx.full.min.js:1` — header hak cipta terkonfirmasi), dipakai untuk membangun file Excel secara lokal
- Tidak ada SDK analytics, error-reporting, atau tracking pihak ketiga (`analytics|sentry|tracking|telemetry|mixpanel|amplitude|gtag` — nol hasil pencarian di seluruh repo).

**Kesimpulan: tidak ada pihak ketiga (di luar DJP/CoreTax sendiri) yang menerima data pribadi apa pun dari Ekstensi ini.**

### 1.5 Tracking, analytics, telemetry, atau pemantauan lain
- Nol hasil untuk kata kunci `analytics|sentry|tracking|telemetry|mixpanel|amplitude|gtag|google-analytics` di seluruh repo.
- Tidak ada `&lt;script src&gt;` ke CDN eksternal di `popup.html` — hanya file lokal (`popup.js`, `styles.css`, `kapls.png`).
- Satu-satunya bentuk logging adalah `console.log`/`console.warn`/`console.error` (mis. `background.js:82,129,161,202`) yang **hanya tampil di DevTools browser pengguna sendiri** dan tidak pernah dikirim keluar.

**Kesimpulan: tidak ada mekanisme tracking, analytics, atau telemetry dalam bentuk apa pun.**

### 1.6 Kontrol yang tersedia bagi pengguna

| Kontrol | Status | Bukti |
|---|---|---|
| Penghapusan data | **Tersedia secara tidak langsung** — karena data tidak disimpan di server pengembang, "penghapusan" cukup dilakukan pengguna sendiri dengan menghapus file dari folder unduhan lokal, atau membiarkan token sesi (di memori) hilang otomatis saat tab/service worker ditutup. Tidak ada tombol "hapus data" di UI Ekstensi karena tidak ada data tersimpan yang perlu dihapus dari sisi Ekstensi. | `background.js:36-73` (penghapusan file lokal otomatis mode "Excel Saja"); tidak ada `chrome.storage` sama sekali |
| Ekspor data | **Tersedia** — inti fungsi Ekstensi adalah mengekspor data faktur/bukti potong ke file Excel yang sepenuhnya dikuasai pengguna. | `excel-exporter.js:1-52`, `content.js:556,651,770,990` |
| Persetujuan/consent | **Tidak ada mekanisme consent eksplisit di dalam Ekstensi** (tidak ada dialog/checkbox persetujuan sebelum pemrosesan). Persetujuan berbentuk implisit: pengguna memicu setiap aksi secara manual lewat popup (klik tombol unduh/ekspor) — tidak ada pemrosesan data yang berjalan otomatis di latar belakang tanpa aksi pengguna. | `popup.html:15-25,52-54` (semua aksi berbasis klik tombol) |
| Kontrol lain | Validasi input rentang tahun/bulan (`popup.js:77-85`) — bukan kontrol privasi, hanya validasi form. | `popup.js:77-85` |

**Kesimpulan: karena Ekstensi tidak menyimpan data pribadi di luar perangkat pengguna, hak "akses/hapus/ekspor" secara praktis identik dengan kontrol yang sudah dimiliki pengguna atas file dan browser mereka sendiri — bukan hak yang harus diminta ke pengembang.**

### 1.7 Temuan tambahan yang relevan
- Ekstensi **tidak resmi**, tidak berafiliasi dengan DJP/Pemerintah RI (lihat `manifest.json:13-15` — host permission hanya `coretaxdjp.pajak.go.id`, tanpa indikasi afiliasi resmi di kode).
- Ekstensi memproses dokumen milik **pihak ketiga** (lawan transaksi wajib pajak — nama & NPWP/NIK mereka), bukan hanya data pengguna Ekstensi sendiri. Ini relevan untuk kebijakan privasi karena "subjek data" mencakup pihak yang bukan pengguna langsung Ekstensi.
- Tidak ditemukan mekanisme apa pun untuk transfer data lintas negara (cross-border data transfer) — seluruh pemrosesan lokal di perangkat pengguna dan komunikasi hanya ke domain `.go.id` Indonesia.

---

## Bagian 2 — Informasi yang Perlu Dikonfirmasi

1. **Nama pengendali data (data controller)** — sesuai draf Syarat & Ketentuan sebelumnya: individu, **Irfan**. → digunakan langsung, tidak lagi placeholder.
2. **Yurisdiksi hukum yang berlaku** — [ASUMSI: hukum Republik Indonesia, mengingat objek data adalah dokumen pajak Indonesia dan subjek data kemungkinan besar berdomisili di Indonesia — termasuk relevansi UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)]. Mohon konfirmasi.
3. **Informasi kontak** — sesuai draf ToS sebelumnya: **irfanpmawaza@gmail.com**. → digunakan langsung.
4. **Periode retensi/penyimpanan data** — karena Ekstensi tidak menyimpan data pribadi di server mana pun (token hanya di memori volatil, file di disk lokal pengguna), tidak ada "periode retensi" yang dikendalikan oleh pengembang. Retensi file lokal sepenuhnya berada di tangan pengguna. → placeholder `[Periode Retensi Data]` tetap disediakan untuk kondisi apabila di masa depan ditambahkan penyimpanan sisi server (lihat Bagian 3, klausul terkait).
5. **Target pengguna/audiens** — [ASUMSI: wajib pajak, kuasa wajib pajak, konsultan pajak, atau staf akuntansi/pajak yang memiliki akses sah ke akun CoreTax — konsisten dengan asumsi kelayakan pengguna pada draf Syarat & Ketentuan]. Mohon konfirmasi apakah ada batasan tambahan (mis. hanya untuk kalangan profesional/korporat, bukan individu awam).
6. **Rencana fitur berbayar/akun di masa depan** — sesuai percakapan sebelumnya, Anda mengonfirmasi berencana menambahkan fitur berbayar. Jika fitur tersebut kelak melibatkan penyimpanan data di server (mis. akun pengguna, riwayat transaksi), **Kebijakan Privasi ini wajib direvisi total** untuk mencakup praktik penyimpanan server, keamanan server, dan hak subjek data yang baru — draf ini hanya berlaku selama pemrosesan 100% lokal seperti kondisi kode saat ini.

---

## Bagian 3 — Draft Kebijakan Privasi

*(Bahasa Indonesia — sesuaikan placeholder `[...]` sebelum publikasi)*

### KEBIJAKAN PRIVASI
**Irfan** (individu, pengembang independen) — "CoreTax PDF Downloader & Ekspor Excel"
Terakhir diperbarui: [Tanggal]

#### 1. Pendahuluan
Kebijakan Privasi ini menjelaskan bagaimana ekstensi browser "CoreTax PDF Downloader & Ekspor Excel" ("Ekstensi") memproses data pada saat digunakan. Ekstensi ini adalah alat pihak ketiga yang **tidak resmi dan tidak berafiliasi dengan Direktorat Jenderal Pajak (DJP)** atau Pemerintah Republik Indonesia, dan hanya berfungsi di dalam halaman resmi CoreTax (`coretaxdjp.pajak.go.id`) yang sudah Anda buka dan Anda login sendiri.

**Ringkasan singkat:** Ekstensi ini **tidak memiliki server**, **tidak mengumpulkan atau menyimpan data Anda di infrastruktur pengembang**, dan **tidak mengirim data ke pihak ketiga mana pun** selain ke portal resmi CoreTax itu sendiri (dengan sesi login Anda sendiri). Seluruh pemrosesan data terjadi secara lokal di browser Anda.

#### 2. Data yang Diproses

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

#### 3. Bagaimana Data Diproses dan Disimpan
- Seluruh proses ekstraksi PDF dan pembuatan file Excel **berjalan sepenuhnya di browser Anda (client-side)**, menggunakan library sumber terbuka yang dijalankan secara lokal (PDF.js untuk membaca PDF, SheetJS untuk membangun Excel) — tidak ada data yang dikirim ke server mana pun untuk diproses.
- File PDF dan Excel yang dihasilkan disimpan **langsung ke folder unduhan pada perangkat Anda sendiri**, menggunakan fitur unduhan bawaan browser Chrome.
- Ekstensi **tidak memiliki dan tidak mengoperasikan server backend**. Tidak ada basis data, tidak ada penyimpanan cloud, dan tidak ada salinan data Anda yang disimpan atau dapat diakses oleh pengembang Ekstensi.
- Pada mode "Buat Excel Saja", file PDF sementara yang terpaksa dibuat oleh browser akan dihapus otomatis dari perangkat Anda setelah data berhasil diekstrak.

#### 4. Berbagi Data dengan Pihak Ketiga
Ekstensi **tidak membagikan, menjual, atau mengirimkan data apa pun kepada pihak ketiga**. Satu-satunya komunikasi jaringan yang dilakukan Ekstensi adalah ke domain resmi `coretaxdjp.pajak.go.id`, menggunakan sesi login Anda sendiri, untuk mengambil dokumen/data yang memang sudah dapat Anda akses secara sah. Tidak ada SDK analytics, iklan, atau pelacak pihak ketiga yang tertanam dalam Ekstensi ini.

Penggunaan CoreTax itu sendiri tunduk pada kebijakan privasi dan ketentuan yang ditetapkan oleh DJP secara independen, yang tidak dikendalikan oleh Kebijakan Privasi ini.

#### 5. Tracking, Analytics, dan Cookie
Ekstensi ini **tidak menggunakan alat analytics, telemetry, atau pelacakan perilaku pengguna dalam bentuk apa pun**. Ekstensi tidak memasang cookie sendiri dan tidak membaca cookie CoreTax secara langsung — permintaan API dijalankan dalam konteks halaman CoreTax itu sendiri sehingga otentikasi tetap ditangani sepenuhnya oleh mekanisme bawaan CoreTax.

#### 6. Keamanan Data
- Seluruh komunikasi dengan CoreTax dilakukan melalui HTTPS.
- Token sesi hanya disimpan sementara di memori volatil, tidak pernah ditulis ke disk.
- Permission yang diminta Ekstensi dibatasi seminimal mungkin dan hanya berlaku pada domain CoreTax resmi (`activeTab`, `scripting`, `downloads`, `webRequest`; host permission hanya `coretaxdjp.pajak.go.id`).
- File Excel/PDF yang telah diunduh ke perangkat Anda **tidak dienkripsi tambahan oleh Ekstensi** — keamanannya selanjutnya bergantung pada keamanan perangkat dan sistem operasi Anda sendiri, sama seperti file lain yang Anda unduh dari internet.
- Karena tidak ada server, risiko kebocoran data melalui infrastruktur pengembang secara praktis tidak berlaku — risiko privasi utama terletak pada keamanan perangkat dan folder unduhan Anda sendiri.

#### 7. Hak dan Kontrol Anda
Karena Ekstensi tidak menyimpan data pribadi di luar perangkat Anda:
- **Akses dan penghapusan data**: seluruh data yang dihasilkan (file PDF/Excel) berada sepenuhnya di bawah kendali Anda di perangkat Anda sendiri — Anda dapat menghapusnya kapan pun langsung dari sistem berkas Anda. Tidak ada permintaan penghapusan data ke pengembang yang diperlukan karena pengembang tidak menyimpan salinannya.
- **Portabilitas/ekspor data**: fungsi ekspor ke Excel adalah fitur inti Ekstensi ini — data yang Anda ekstrak sepenuhnya portabel dalam format `.xlsx` standar.
- **Penarikan penggunaan**: Anda dapat menghentikan seluruh pemrosesan kapan pun dengan mencopot pemasangan (uninstall) Ekstensi dari browser Anda; token sesi di memori akan otomatis hilang.

#### 8. Data Pribadi Pihak Ketiga dalam Dokumen
Karena dokumen Faktur Pajak dan Bukti Potong yang Anda proses melalui Ekstensi ini memuat data pribadi pihak lain (lawan transaksi Anda), Anda sebagai pengguna bertanggung jawab untuk memastikan penggunaan Ekstensi dan penyimpanan/pengelolaan file hasil ekspor dilakukan sesuai dengan kewajiban perlindungan data pribadi yang berlaku bagi Anda selaku pemroses dokumen tersebut (mis. Undang-Undang [Yurisdiksi] tentang Pelindungan Data Pribadi). Ekstensi hanya menjadi alat bantu teknis dan tidak menentukan tujuan atau dasar hukum pemrosesan data pribadi tersebut.

#### 9. Anak-Anak
Ekstensi ini tidak ditujukan untuk digunakan oleh anak-anak dan tidak dirancang untuk memproses data anak-anak secara khusus. [ASUMSI: sesuai kelayakan pengguna dewasa yang cakap hukum pada draf Syarat & Ketentuan — mohon konfirmasi].

#### 10. Perubahan Kebijakan Privasi
Kebijakan Privasi ini dapat diperbarui apabila terdapat perubahan cara kerja Ekstensi, termasuk apabila di masa depan ditambahkan fitur yang melibatkan penyimpanan data di server (mis. sistem akun untuk fitur berbayar). Perubahan signifikan pada praktik pemrosesan data akan diinformasikan melalui [saluran: README repositori / Chrome Web Store / kontak email — placeholder, mohon konfirmasi].

#### 11. Kontak
Pertanyaan mengenai Kebijakan Privasi ini dapat disampaikan melalui: irfanpmawaza@gmail.com.

---

## Catatan Reviewer

**Sudah dikonfirmasi/diselaraskan dengan draf Syarat & Ketentuan sebelumnya (tidak lagi placeholder):**
- Nama pengendali data: **Irfan** (individu).
- Kontak: **irfanpmawaza@gmail.com**.

**Asumsi yang masih perlu dikonfirmasi:**
1. Yurisdiksi hukum (Bagian 8 draf menyebut "[Yurisdiksi]") — diasumsikan Indonesia/UU PDP, namun perlu konfirmasi eksplisit karena berdampak pada dasar hukum pemrosesan data pribadi pihak ketiga (Bagian 8).
2. Target audiens/pengguna — diasumsikan profesional pajak/akuntansi dengan akses sah ke CoreTax, konsisten dengan draf ToS.
3. Periode retensi data — **tidak berlaku untuk kondisi kode saat ini** (tidak ada penyimpanan sisi server), tetapi placeholder `[Periode Retensi Data]` perlu diisi apabila fitur berbayar mendatang menambahkan penyimpanan server (lihat Bagian 6 investigasi dan Bagian 10 draf).
4. Saluran pengumuman perubahan kebijakan (Bagian 10) belum ditentukan.
5. Klausul anak-anak (Bagian 9) memakai asumsi umum, belum ada mekanisme verifikasi usia teknis di kode — wajar untuk ekstensi tanpa sistem akun, tetapi tetap perlu ditinjau kesesuaian bahasanya.

**Temuan penting yang membedakan draf ini dari kebijakan privasi generik:**
- Data pribadi yang diproses **bukan hanya data pengguna Ekstensi**, melainkan juga data pihak ketiga (lawan transaksi) yang tercantum di dokumen pajak — ini ditangani secara eksplisit di Bagian 2b dan Bagian 8, karena kebijakan privasi generik biasanya hanya membahas data pengguna langsung.
- Karena tidak ada server/`chrome.storage` sama sekali, konsep "hak akses/hapus/portabilitas data" pada Bagian 7 ditulis ulang agar sesuai kenyataan (kontrol berada di tangan pengguna atas file lokal mereka sendiri) — bukan disalin dari template hak subjek data yang mengasumsikan ada database pengembang untuk diminta dihapus.

**Yang secara sengaja TIDAK diklaim** karena tidak didukung bukti kode: tidak ada klaim enkripsi at-rest oleh Ekstensi, tidak ada klaim kepatuhan sertifikasi keamanan tertentu, tidak ada klaim adanya Data Protection Officer/pejabat pelindung data, dan tidak ada klaim mekanisme consent management platform — karena semua itu tidak ada di kode.

**PENTING:** Dokumen ini adalah draf yang disusun oleh AI berdasarkan analisis kode, bukan nasihat hukum. Draf ini **wajib ditinjau dan disahkan oleh advokat/penasihat hukum yang berkualifikasi** di bidang hukum perlindungan data pribadi (khususnya UU No. 27 Tahun 2022 tentang PDP apabila berlaku) sebelum dipublikasikan atau digunakan secara resmi — terutama karena Ekstensi ini memproses data pribadi pihak ketiga (NPWP/NIK dan nama) yang terkandung dalam dokumen perpajakan.
