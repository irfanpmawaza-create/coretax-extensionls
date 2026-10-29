class CoreTaxMultiPeriodDownloader {
  getPeriodCode(month) {
    return `TD.007${String(month).padStart(2, "0")}`;
  }

  getMonthName(month) {
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return months[month - 1] || String(month);
  }

  sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  async fetchInvoicePage(invoiceType, { periodCode, year, first, rows }) {
    const isInput = invoiceType === "input";
    const result = await this.sendMessageToBackground({
      action: isInput ? "fetchInputInvoicesPage" : "fetchOutputInvoicesPage",
      periodCode,
      year,
      first,
      rows
    });

    if (!result?.success) {
      throw new Error(result?.message || `Gagal mengambil data Faktur ${isInput ? "Masukan" : "Keluaran"}.`);
    }

    const apiResponse = result.response;
    if (!apiResponse?.IsSuccessful) {
      throw new Error(apiResponse?.Message || "CoreTax mengembalikan status gagal.");
    }

    return apiResponse.Payload || { TotalRecords: 0, Data: [] };
  }

  async fetchAllInvoicesForMonth(invoiceType, month, year) {
    const periodCode = this.getPeriodCode(month);
    const rows = 50;
    let first = 0;
    let totalRecords = null;
    const collected = [];
    const seen = new Set();
    let safety = 0;

    while (safety < 500) {
      safety++;
      const payload = await this.fetchInvoicePage(invoiceType, {
        periodCode,
        year,
        first,
        rows
      });

      const data = Array.isArray(payload.Data) ? payload.Data : [];
      if (totalRecords === null && Number.isFinite(Number(payload.TotalRecords))) {
        totalRecords = Number(payload.TotalRecords);
      }

      for (const item of data) {
        const key = item.RecordId || item.AggregateIdentifier || `${item.TaxInvoiceNumber || ""}-${item.TaxInvoiceDate || ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          collected.push(item);
        }
      }

      if (data.length === 0) break;
      if (data.length < rows) break;
      if (totalRecords !== null && first + data.length >= totalRecords) break;

      first += rows;
    }

    return collected;
  }

  formatApiDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  mapOutputInvoiceToExcelRow(item) {
    const periodMonth = Number(String(item.TaxInvoicePeriod || "").slice(-2));
    return {
      "Masa Pajak": this.getMonthName(periodMonth),
      "Tahun": item.TaxInvoiceYear || "",
      "Tanggal Faktur Pajak": this.formatApiDate(item.TaxInvoiceDate),
      "Nomor Faktur Pajak": item.TaxInvoiceNumber || "",
      "Kode Transaksi": item.TaxInvoiceCode || "",
      "NPWP Penjual": item.SellerTIN || "",
      "Nama Penjual": item.SellerTaxpayerName || "",
      "NPWP Pembeli": item.BuyerTIN || "",
      "Nama Pembeli": item.BuyerTaxpayerNameClear || item.BuyerName || item.DisplayName || item.BuyerTaxpayerName || "",
      "DPP": item.SellingPrice ?? 0,
      "DPP Nilai Lain": item.OtherTaxBase ?? 0,
      "PPN": item.VAT ?? 0,
      "PPnBM": item.STLG ?? 0,
      "Status Faktur": item.TaxInvoiceStatus || "",
      "Status Pembeli": item.BuyerStatus || "",
      "Referensi": item.Reference || "",
      "Penandatangan": item.Signer || "",
      "Metode Input": item.InputMethod || "",
      "Tanggal Dibuat": this.formatApiDate(item.CreationDate),
      "Tanggal Update": this.formatApiDate(item.LastUpdatedDate)
    };
  }

  base64ToBlob(base64, mimeType) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType || "application/pdf" });
  }

  buildInvoicePdfFileName(item, invoiceType) {
    const periodMonth = Number(String(item.TaxInvoicePeriod || "").slice(-2));
    const monthAbbr = this.cleanFileName(this.getMonthName(periodMonth).slice(0, 3));
    const counterpartyName = this.cleanFileName(
      invoiceType === "input"
        ? (item.SellerTaxpayerName || "")
        : (item.BuyerTaxpayerNameClear || item.BuyerName || item.DisplayName || item.BuyerTaxpayerName || "")
    );
    const taxInvoiceNumber = this.cleanFileName(item.TaxInvoiceNumber || "FAKTUR");
    return `${taxInvoiceNumber}_${counterpartyName}_${monthAbbr}${item.TaxInvoiceYear || ""}.pdf`;
  }

  async fetchInvoicePdfBlob(item, invoiceType) {
    const status = item.TaxInvoiceStatus || "";
    const isAmended = status === "AMENDED" || status === "WAITING_FOR_AMENDMENT";
    const isCanceled = status === "CANCELED" || status === "WAITING_FOR_CANCELLATION";
    const invoiceNumber = item.TaxInvoiceNumber || "";
    const body = {
      EInvoiceRecordIdentifier: item.RecordId || "",
      EInvoiceAggregateIdentifier: item.AggregateIdentifier || "",
      DocumentAggregateIdentifier: (
        isAmended
          ? item.AmendedDocumentFormAggregateIdentifier
          : isCanceled
            ? item.CanceledDocumentFormAggregateIdentifier
            : item.DocumentFormAggregateIdentifier
      ) || "",
      LetterNumber: `${invoiceNumber}${isAmended ? "A" : isCanceled ? "C" : ""}`,
      DocumentDate: item.LastUpdatedDate || "",
      EInvoiceMenuType: invoiceType === "input" ? "Input" : "Outgoing",
      TaxInvoiceStatus: status
    };

    const result = await this.sendMessageToBackground({ action: "fetchInvoicePdf", invoiceType, body });
    if (!result?.success) {
      throw new Error(result?.message || "Gagal mengambil PDF faktur.");
    }

    let blob;
    if (result.isJson) {
      const base64 = result.data?.Content || result.data?.Payload?.FileContent || result.data?.Payload?.Base64 || result.data?.Payload;
      if (typeof base64 !== "string") {
        throw new Error(result.data?.Message || "Respons PDF tidak dikenali.");
      }
      blob = this.base64ToBlob(base64, "application/pdf");
    } else {
      blob = this.base64ToBlob(result.base64, result.contentType);
    }

    return { blob, fileName: this.buildInvoicePdfFileName(item, invoiceType) };
  }

  async fetchInvoiceDetail(item, invoiceType) {
    const result = await this.sendMessageToBackground({
      action: invoiceType === "input" ? "fetchInputInvoiceDetail" : "fetchOutputInvoiceDetail",
      recordIdentifier: item.RecordId || ""
    });

    if (!result?.success) {
      throw new Error(result?.message || `Gagal mengambil detail Faktur ${invoiceType === "input" ? "Masukan" : "Keluaran"}.`);
    }

    return result.response?.Payload;
  }

  async fetchInvoiceDetailsForItems(allInvoices, invoiceType) {
    const failedDocuments = [];
    const itemExcelRows = [];
    let detailSuccessCount = 0;

    // ponytail: serial tanpa jeda untuk menjaga beban CoreTax; tambah worker pool hanya jika benchmark membutuhkannya.
    for (const item of allInvoices) {
      try {
        const payload = await this.fetchInvoiceDetail(item, invoiceType);
        const formDataObj = payload?.FormDataObj;
        const counterparty = invoiceType === "input" ? {
          name: payload?.SellerName || item.SellerTaxpayerName,
          tin: payload?.SellerTIN || item.SellerTIN,
          documentNumber: "",
          address: formDataObj?.TransactionDocumentData?.SellerAddress,
          email: ""
        } : null;
        const rows = window.mapOutputInvoiceDetailRows(
          item,
          formDataObj,
          this.buildInvoicePdfFileName(item, invoiceType),
          counterparty
        );
        itemExcelRows.push(...rows);
        detailSuccessCount++;
      } catch (error) {
        failedDocuments.push({
          number: item.TaxInvoiceNumber || "?",
          reason: `Detail API: ${error.message || String(error)}`
        });
      }
    }

    return { detailSuccessCount, failedDocuments, itemExcelRows };
  }

  async downloadInvoicePdfsForItems(allInvoices, invoiceType, { savePdf, buildItemExcel }) {
    const failedPdfs = [];
    const itemExcelRows = [];
    let pdfSuccessCount = 0;

    for (const item of allInvoices) {
      try {
        const { blob, fileName } = await this.fetchInvoicePdfBlob(item, invoiceType);
        if (savePdf) this.downloadBlob(blob, fileName);
        if (buildItemExcel) {
          const arrayBuffer = await blob.arrayBuffer();
          const rows = await this.pdfExtractor.extract(arrayBuffer, fileName);
          itemExcelRows.push(...rows);
        }
        pdfSuccessCount++;
      } catch (error) {
        failedPdfs.push({ number: item.TaxInvoiceNumber || "?", reason: error.message || String(error) });
      }
      await this.sleep(this.delayBetweenDownloads);
    }

    return { pdfSuccessCount, failedPdfs, itemExcelRows };
  }

  async downloadMultiPeriodInvoices(options = {}) {
    if (this.multiPeriodRunning) {
      throw new Error("Proses multi periode sedang berjalan. Tunggu sampai selesai.");
    }

    this.multiPeriodRunning = true;
    try {
      if (!this.isCompatiblePage()) {
        throw new Error("Buka halaman e-Invoice atau withholding slips CoreTax terlebih dahulu.");
      }

      if (window.location.pathname.includes("/withholding-slips-portal/")) {
        return await this.downloadMultiPeriodWithholdingSlips(options);
      }

      if (!window.location.pathname.includes("/e-invoice-portal/")) {
        throw new Error("Buka halaman e-Invoice atau withholding slips CoreTax terlebih dahulu.");
      }

      return await this.downloadMultiPeriodInvoiceType(options, options.invoiceType === "input" ? "input" : "output");
    } finally {
      this.multiPeriodRunning = false;
    }
  }

  async downloadMultiPeriodInvoiceType(options, invoiceType) {
    const year = Number(options.year);
    const startMonth = Number(options.startMonth);
    const endMonth = Number(options.endMonth);

    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      throw new Error("Tahun tidak valid.");
    }
    if (!Number.isInteger(startMonth) || !Number.isInteger(endMonth) || startMonth < 1 || endMonth > 12 || startMonth > endMonth) {
      throw new Error("Rentang bulan tidak valid.");
    }

    const isInput = invoiceType === "input";
    const typeLabel = isInput ? "Masukan" : "Keluaran";
    const filePrefix = `Faktur_${typeLabel}`;
    const logPrefix = isInput ? "MULTI PERIODE MASUKAN" : "MULTI PERIODE";
    const allInvoices = [];
    for (let month = startMonth; month <= endMonth; month++) {
      console.log(`${logPrefix}: mengambil ${this.getMonthName(month)} ${year}...`);
      const monthData = await this.fetchAllInvoicesForMonth(invoiceType, month, year);
      allInvoices.push(...monthData);
      console.log(`${logPrefix}: ${this.getMonthName(month)} = ${monthData.length} faktur.`);
    }

    if (allInvoices.length === 0) {
      throw new Error(`Tidak ada Faktur ${typeLabel} yang ditemukan untuk periode tersebut.`);
    }

    const startLabel = this.getMonthName(startMonth).slice(0, 3);
    const endLabel = this.getMonthName(endMonth).slice(0, 3);
    const fileName = startMonth === endMonth
      ? `${filePrefix}_${year}_${startLabel}.xlsx`
      : `${filePrefix}_${year}_${startLabel}-${endLabel}.xlsx`;

    let message = `Selesai memproses ${allInvoices.length} Faktur ${typeLabel} (${this.getMonthName(startMonth)}-${this.getMonthName(endMonth)} ${year}).`;
    const failedDocuments = [];
    const summaryRows = allInvoices.map((item) => this.mapOutputInvoiceToExcelRow(item));
    this.excelExporter.export(summaryRows, fileName, "output");
    message += `\nExcel ringkasan: ${fileName}.`;

    if (options.savePdf) {
      const pdfResult = await this.downloadInvoicePdfsForItems(allInvoices, invoiceType, {
        savePdf: true,
        buildItemExcel: false
      });
      failedDocuments.push(...pdfResult.failedPdfs.map((item) => ({
        ...item,
        reason: `PDF: ${item.reason}`
      })));
      message += `\nPDF tersimpan: ${pdfResult.pdfSuccessCount}, PDF gagal: ${pdfResult.failedPdfs.length}.`;
    }

    if (options.buildItemExcel) {
      const detailResult = await this.fetchInvoiceDetailsForItems(allInvoices, invoiceType);
      failedDocuments.push(...detailResult.failedDocuments);
      message += `\nDetail API berhasil: ${detailResult.detailSuccessCount} faktur, ${detailResult.itemExcelRows.length} baris; gagal: ${detailResult.failedDocuments.length}.`;

      if (detailResult.itemExcelRows.length > 0) {
        const itemFileName = startMonth === endMonth
          ? `${filePrefix}_Rincian_${year}_${startLabel}.xlsx`
          : `${filePrefix}_Rincian_${year}_${startLabel}-${endLabel}.xlsx`;
        const excelRows = detailResult.itemExcelRows.map(({ File, ...row }) => row);
        this.excelExporter.export(excelRows, itemFileName);
        message += `\nExcel rincian per barang: ${itemFileName}.`;
      } else {
        message += `\nExcel rincian tidak dibuat karena tidak ada detail yang berhasil diambil.`;
      }
    }

    this.showFinalNotification(message, failedDocuments);
    return { success: true, message, count: allInvoices.length, fileName };
  }

  getWithholdingPeriodCode(month, year) {
    const mm = String(month).padStart(2, "0");
    return `${mm}${mm}${year}`;
  }

  async fetchWithholdingSlipPage({ periodCode, first, rows }) {
    const result = await this.sendMessageToBackground({
      action: "fetchWithholdingSlipsPage",
      periodCode,
      first,
      rows
    });

    if (!result?.success) {
      throw new Error(result?.message || "Gagal mengambil data Bukti Potong.");
    }

    const apiResponse = result.response;
    if (!apiResponse?.IsSuccessful) {
      throw new Error(apiResponse?.Message || "CoreTax mengembalikan status gagal.");
    }

    return apiResponse.Payload || { TotalRecords: 0, Data: [] };
  }

  async fetchAllWithholdingSlipsForMonth(month, year) {
    const periodCode = this.getWithholdingPeriodCode(month, year);
    const rows = 50;
    let first = 0;
    let totalRecords = null;
    const collected = [];
    const seen = new Set();
    let safety = 0;

    while (safety < 500) {
      safety++;
      const payload = await this.fetchWithholdingSlipPage({ periodCode, first, rows });

      const data = Array.isArray(payload.Data) ? payload.Data : [];
      if (totalRecords === null && Number.isFinite(Number(payload.TotalRecords))) {
        totalRecords = Number(payload.TotalRecords);
      }

      for (const item of data) {
        const key = item.RecordId || item.WithholdingslipsAggregateIdentifier;
        if (!seen.has(key)) {
          seen.add(key);
          collected.push(item);
        }
      }

      if (data.length === 0) break;
      first += data.length;
      if (totalRecords !== null && first >= totalRecords) break;
      if (totalRecords === null && data.length < rows) break;
    }

    return collected;
  }

  async fetchBppuTaxObjectDescriptions() {
    const result = await this.sendMessageToBackground({ action: "fetchBppuTaxObjects" });
    if (!result?.success) {
      throw new Error(result?.message || "Gagal mengambil referensi objek pajak BPPU.");
    }

    const descriptions = {};
    for (const item of result.response?.Payload || []) {
      if (item.AppLanguageID !== "id-ID") continue;
      try {
        const taxObjectCode = JSON.parse(item.ParameterData || "{}").TaxObjectCode;
        if (taxObjectCode) descriptions[taxObjectCode] = item.CodeDescription || "";
      } catch (_) {
        // Abaikan satu referensi rusak; kode lain tetap dapat diekspor.
      }
    }
    return descriptions;
  }

  async fetchBppuDetailsForItems(items) {
    const enrichedItems = [];
    const failedDocuments = [];

    for (const item of items) {
      try {
        const result = await this.sendMessageToBackground({
          action: "fetchBppuDetail",
          recordId: item.RecordId || ""
        });
        if (!result?.success) throw new Error(result?.message || "Detail Bupot BPPU gagal diambil.");
        enrichedItems.push({ ...item, DocumentNumber: result.detail?.DocumentNumber || "" });
      } catch (error) {
        enrichedItems.push({ ...item, DocumentNumber: "" });
        failedDocuments.push({
          number: item.WithholdingSlipsNumber || "?",
          reason: error.message || String(error)
        });
      }
    }

    return { enrichedItems, failedDocuments };
  }

  mapWithholdingSlipToExcelRow(item, taxObjectDescriptions = {}) {
    if (Object.hasOwn(item, "EmployerNik") || Object.hasOwn(item, "EmployerName")) {
      return window.mapBppuWithholdingSlipToExcelRow(item, taxObjectDescriptions);
    }

    const periodMonth = Number(String(item.TaxPeriodCode || "").slice(0, 2));
    return {
      "Masa Pajak": this.getMonthName(periodMonth),
      "Tahun": String(item.TaxPeriodCode || "").slice(-4),
      "Nomor Bukti Potong": item.WithholdingSlipsNumber || "",
      "Tanggal Bukti Potong": this.formatApiDate(item.WithholdingSlipsDate),
      "NPWP/NIK Dipotong": item.TaxIdentificationNumber || "",
      "Nama Dipotong": item.Name || "",
      "Kode Objek Pajak": item.TaxObjectCode || "",
      "Pasal": item.TaxArticle || "",
      "Penghasilan Bruto": item.GrossIncome ?? "",
      "Dasar Pengenaan Pajak": item.TaxBase ?? 0,
      "Tarif": item.TaxRate ?? 0,
      "PPh Dipotong": item.IncomeTaxWithheld ?? item.IncomeTax ?? 0,
      "Status": item.WithholdingSlipsStatus || "",
      "Tanggal Dibuat": this.formatApiDate(item.CreationDate)
    };
  }

  async downloadMultiPeriodWithholdingSlips(options = {}) {
    const year = Number(options.year);
    const startMonth = Number(options.startMonth);
    const endMonth = Number(options.endMonth);

    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      throw new Error("Tahun tidak valid.");
    }
    if (!Number.isInteger(startMonth) || !Number.isInteger(endMonth) || startMonth < 1 || endMonth > 12 || startMonth > endMonth) {
      throw new Error("Rentang bulan tidak valid.");
    }

    const allSlips = [];
    for (let month = startMonth; month <= endMonth; month++) {
      console.log(`MULTI PERIODE BUPOT: mengambil ${this.getMonthName(month)} ${year}...`);
      const monthData = await this.fetchAllWithholdingSlipsForMonth(month, year);
      allSlips.push(...monthData);
      console.log(`MULTI PERIODE BUPOT: ${this.getMonthName(month)} = ${monthData.length} bukti potong.`);
    }

    if (allSlips.length === 0) {
      throw new Error("Tidak ada Bukti Potong yang ditemukan untuk periode tersebut.");
    }

    const isBppu = allSlips.some((item) => Object.hasOwn(item, "EmployerNik") || Object.hasOwn(item, "EmployerName"));
    let exportSlips = allSlips;
    let failedDocuments = [];
    if (isBppu) {
      const detailResult = await this.fetchBppuDetailsForItems(allSlips);
      exportSlips = detailResult.enrichedItems;
      failedDocuments = detailResult.failedDocuments;
    }
    const taxObjectDescriptions = isBppu ? await this.fetchBppuTaxObjectDescriptions() : {};
    const excelRows = exportSlips.map((item) => this.mapWithholdingSlipToExcelRow(item, taxObjectDescriptions));
    const startLabel = this.getMonthName(startMonth).slice(0, 3);
    const endLabel = this.getMonthName(endMonth).slice(0, 3);
    const filePrefix = isBppu ? "eBupot_BPPU" : "Bukti_Potong";
    const fileName = startMonth === endMonth
      ? `${filePrefix}_${year}_${startLabel}.xlsx`
      : `${filePrefix}_${year}_${startLabel}-${endLabel}.xlsx`;

    this.excelExporter.export(excelRows, fileName, "output");

    const message = `Selesai. ${allSlips.length} Bukti Potong (${this.getMonthName(startMonth)}-${this.getMonthName(endMonth)} ${year}) diekspor ke Excel.${failedDocuments.length ? ` Detail gagal: ${failedDocuments.length}.` : ""}`;
    this.showFinalNotification(message, failedDocuments);
    return { success: true, message, count: allSlips.length, fileName };
  }
}

window.CoreTaxMultiPeriodDownloader = CoreTaxMultiPeriodDownloader;
