class CoreTaxPdfExtractor {
  // mencari library pembaca pdf di folder libs
  constructor() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("libs/pdf.worker.min.js");
    }
  }

  async extract(arrayBuffer, fileName) {
    if (!window.pdfjsLib) { // cek apakah library pembaca pdf tersedia?
      throw new Error("Library pdf.js belum tersedia. Pastikan libs/pdf.min.js sudah ada.");
    }

    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const allLines = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const lines = this.itemsToLines(textContent.items);
      allLines.push(...lines);
    }

    const fullText = allLines.join("\n");
    const kodeFaktur = this.extractKodeFaktur(fullText);
    const lawanTransaksi = this.extractLawanTransaksi(fullText);
    const npwpLawan = this.extractNpwpLawan(fullText);
    const alamatLawan = this.extractAlamatLawan(fullText);
    const potonganHarga = this.extractPotonganHarga(fullText);
    const dasarPengenaanPajak = this.extractDasarPengenaanPajak(fullText);
    const jumlahPpn = this.extractJumlahPpn(fullText);
    const itemRows = this.extractItemRows(allLines);

    //kalau item tidak terbaca, kembalikan ke nilai return
    if (itemRows.length === 0) {
      return [{
        "File": fileName,
        "Kode dan Nomor Seri Faktur Pajak": kodeFaktur,
        "Nama Barang Kena Pajak / Jasa Kena Pajak": "",
        "Lawan Transaksi": lawanTransaksi,
        "NPWP Lawan Transaksi": npwpLawan,
        "Alamat Lawan Transaksi": alamatLawan,
        "Harga Jual / Penggantian /  Uang Muka / Termin": null,
        "Potongan Harga": potonganHarga,
        "Dasar Pengenaan Pajak": dasarPengenaanPajak,
        "Jumlah PPN (Pajak Pertambahan Nilai)": jumlahPpn,
        "Catatan": "Item tidak terbaca. Periksa struktur PDF."
      }];
    }

    return itemRows.map((item) => ({
      "File": fileName,
      "Kode dan Nomor Seri Faktur Pajak": kodeFaktur,
      "Nama Barang Kena Pajak / Jasa Kena Pajak": item.description,
      "Lawan Transaksi": lawanTransaksi,
      "NPWP Lawan Transaksi": npwpLawan,
      "Alamat Lawan Transaksi": alamatLawan,
      "Harga Jual / Penggantian /  Uang Muka / Termin": item.amount,
      "Potongan Harga": potonganHarga,
      "Dasar Pengenaan Pajak": dasarPengenaanPajak,
      "Jumlah PPN (Pajak Pertambahan Nilai)": jumlahPpn,
      "Catatan": ""
    }));
  }

  itemsToLines(items) {
    const grouped = new Map();

    items.forEach((item) => {
      const text = String(item.str || "").trim();
      if (!text) return;

      const x = Math.round(item.transform[4]);
      const y = Math.round(item.transform[5]);
      const key = Math.round(y / 3) * 3;

      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({ x, text });
    });

    return Array.from(grouped.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) => parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
      )
      .filter(Boolean);
  }

  //ekstrak kode faktur (oke)
  extractKodeFaktur(text) {
    const patterns = [
      /Faktur\s+Pajak\s*:\s*([0-9.\-]+)/i,
      /Kode\s+dan\s+Nomor\s+Seri\s+Faktur\s+Pajak\s*[:\-]?\s*([0-9.\-]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return this.cleanText(match[1]).replace(/[^0-9]/g, "");
    }

    return "";
  }

  //ekstrak pembeli (hasil excel - oke)
  extractLawanTransaksi(text) {
    const buyerSection = this.getBuyerSection(text);
    const match = buyerSection.match(/Nama\s*:\s*([^\n]+)/i);
    return match ? this.cleanText(match[1]) : "";
  }

  //ekstrak npwp pembeli (hasil excel - oke)
  extractNpwpLawan(text) {
    const buyerSection = this.getBuyerSection(text);
    const match = buyerSection.match(/NPWP\s*:\s*([0-9.\-]+)/i);
    return match ? this.cleanText(match[1]).replace(/[^0-9]/g, "") : "";
  }

  //ekstrak alamat pembeli, bisa nyambung ke baris berikutnya (wrap) sebelum baris NPWP
  extractAlamatLawan(text) {
    const buyerSection = this.getBuyerSection(text);
    const match = buyerSection.match(/Alamat\s*:\s*([\s\S]*?)\s*NPWP\s*:/i);
    if (!match) return "";
    // buang noise angka (mis. "#0841760184404000000000") yang suka nempel di ujung alamat
    return this.cleanText(match[1]).replace(/#\d+$/, "").trim();
  }

  extractDasarPengenaanPajak(text) {
    return this.extractSummaryAmount(text, /Dasar\s+Pengenaan\s+Pajak/i);
  }

  extractJumlahPpn(text) {
    return this.extractSummaryAmount(text, /Jumlah\s+PPN(?:\s*\(\s*Pajak\s+Pertambahan\s+Nilai\s*\))?/i);
  }

  extractPotonganHarga(text) {
    return this.extractSummaryAmount(text, /Dikurangi\s+Potongan\s+Harga/i);
  }

  extractSummaryAmount(text, labelPattern) {
    const amountPattern = /([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/;
    const normalizedText = String(text || "").replace(/\s+/g, " ");
    const pattern = new RegExp(`${labelPattern.source}\\s*${amountPattern.source}`, "i");
    const match = normalizedText.match(pattern);
    return match ? this.parseRupiah(match[1]) : null;
  }

  getBuyerSection(text) {
    const marker = /Pembeli\s+Barang\s+Kena\s+Pajak\s*\/\s*Penerima\s+Jasa\s+Kena\s+Pajak\s*:/i;
    const parts = text.split(marker);
    if (parts.length < 2) return text;
    return parts[1].split(/Dasar\s+Pengenaan\s+Pajak|Jumlah\s+Harga\s+Jual|Pengusaha\s+Kena\s+Pajak/i)[0];
  }

  extractItemRows(lines) {
    const rows = [];

    const amountPattern = /([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/;
    const amountOnlyPattern = /^([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})$/;

    // Pola baris item, contoh:
    // 1 150202
    // atau 1 150202 Jasa akuntansi...
    const itemStartPattern = /^(\d+)\s+([A-Za-z0-9.\-\/]+)(?:\s+(.*))?$/;

    const cleanedLines = lines.map((line) => this.cleanText(line)).filter(Boolean);

    let startIndex = cleanedLines.findIndex((line) =>
      /Nama\s+Barang\s+Kena\s+Pajak/i.test(line)
    );

    if (startIndex < 0) {
      startIndex = cleanedLines.findIndex((line) =>
        /\bNo\.?\b/i.test(line) && /Kode/i.test(line)
      );
    }

    if (startIndex < 0) startIndex = 0;

    let endIndex = cleanedLines.findIndex((line, index) =>
      index > startIndex &&
      /^(Harga\s+Jual\s*\/\s*Penggantian\s*\/\s*Uang\s+Muka\s*\/\s*Termin|Dikurangi\s+Potongan\s+Harga|Dasar\s+Pengenaan\s+Pajak|Jumlah\s+PPN)/i.test(line)
    );

    if (endIndex < 0) endIndex = cleanedLines.length;

    const isSummaryLine = (line) =>
      /^(Harga\s+Jual\s*\/\s*Penggantian\s*\/\s*Uang\s+Muka\s*\/\s*Termin|Dikurangi\s+Potongan\s+Harga|Dikurangi\s+Uang\s+Muka|Dasar\s+Pengenaan\s+Pajak|Jumlah\s+PPN|Jumlah\s+PPnBM|Sesuai\s+dengan\s+ketentuan)/i.test(line);

    const isHeaderLine = (line) =>
      /^(No\.?|Kode|Barang\/?|Jasa|Nama\s+Barang.*|Harga\s+Jual.*|Penggantian.*|Uang\s+Muka.*|Termin|\(Rp\))$/i.test(line);

    const isUsableDescriptionLine = (line) => {
      if (!line) return false;
      if (isHeaderLine(line)) return false;
      if (isSummaryLine(line)) return false;
      if (amountOnlyPattern.test(line)) return false;
      return true;
    };

    for (let i = startIndex + 1; i < endIndex; i++) {
      const line = cleanedLines[i];
      const itemMatch = line.match(itemStartPattern);

      if (!itemMatch) continue;

      const itemNo = itemMatch[1];
      const kodeBarang = itemMatch[2];
      let tail = this.cleanText(itemMatch[3] || "");

      if (!/^\d+$/.test(itemNo) || !kodeBarang) continue;

      let amount = null;
      const descriptionParts = [];

      // ==============================
      // 1. Ambil deskripsi yang muncul SEBELUM baris item
      // Ini untuk kasus PDF CoreTax yang urutan teksnya:
      // Jasa akuntansi...
      // Rp 7.500.000...
      // 1 150202
      // Potongan Harga...
      // ==============================
      const previousParts = [];

      for (let k = i - 1; k > startIndex; k--) {
        const prev = cleanedLines[k];

        if (!prev) continue;
        if (isHeaderLine(prev)) continue;
        if (isSummaryLine(prev)) break;
        if (amountOnlyPattern.test(prev)) break;

        // kalau ketemu item sebelumnya, stop
        if (itemStartPattern.test(prev)) break;

        if (isUsableDescriptionLine(prev)) {
          previousParts.unshift(prev);
        }

        // batasi mundur agar tidak terlalu jauh mengambil teks lain
        if (previousParts.length >= 4) break;
      }

      descriptionParts.push(...previousParts);

      // ==============================
      // 2. Ambil deskripsi yang berada di baris yang sama dengan item
      // Contoh: 1 150202 Jasa akuntansi...
      // ==============================
      if (tail) {
        const tailAmountRegex = new RegExp(`(${amountPattern.source})\\s*$`);
        const tailAmountMatch = tail.match(tailAmountRegex);

        if (tailAmountMatch) {
          amount = this.parseRupiah(tailAmountMatch[1]);
          tail = this.cleanText(tail.replace(tailAmountRegex, ""));
        }

        if (isUsableDescriptionLine(tail) && tail !== kodeBarang) {
          descriptionParts.push(tail);
        }
      }

      // ==============================
      // 3. Ambil deskripsi yang muncul SETELAH baris item
      // ==============================
      let j = i + 1;

      for (; j < endIndex; j++) {
        const next = cleanedLines[j];

        if (!next || isHeaderLine(next)) continue;
        if (isSummaryLine(next)) break;

        const nextItemMatch = next.match(itemStartPattern);

        // Kalau ketemu item berikutnya, stop
        if (nextItemMatch) break;

        const amountOnlyMatch = next.match(amountOnlyPattern);

        // Kalau cuma nominal sendiri, itu dianggap harga jual kolom kanan
        if (amountOnlyMatch) {
          if (amount === null) {
            amount = this.parseRupiah(amountOnlyMatch[1]);
          }
          j += 1;
          break;
        }

        if (isUsableDescriptionLine(next)) {
          descriptionParts.push(next);
        }
      }

      // Hilangkan duplikat, kalau ada baris yang kebaca dua kali
      const uniqueDescriptionParts = [];
      descriptionParts.forEach((part) => {
        if (!uniqueDescriptionParts.includes(part)) {
          uniqueDescriptionParts.push(part);
        }
      });

      const description = this.cleanText(uniqueDescriptionParts.join(" "));

      rows.push({
        code: kodeBarang,
        description: description || kodeBarang,
        amount
      });

      i = j - 1;
    }

    return rows;
  }

  parseRupiah(value) {
    const normalized = String(value || "").replace(/\./g, "").replace(",", ".");
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? Math.round(numeric) : null;
  }

  cleanText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }
}

window.CoreTaxPdfExtractor = CoreTaxPdfExtractor;
