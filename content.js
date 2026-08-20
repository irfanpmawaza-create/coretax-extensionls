(() => {
  if (window.__coretaxPdfDownloaderV3Injected) return;
  window.__coretaxPdfDownloaderV3Injected = true;

  class CoreTaxPDFDownloaderV3 {
    constructor() {
      this.allowedUrls = [
        "https://coretaxdjp.pajak.go.id/e-invoice-portal/",
        "https://coretaxdjp.pajak.go.id/withholding-slips-portal/"
      ];
      this.delayBetweenDownloads = 1800;
      this.pdfExtractor = new window.CoreTaxPdfExtractor();
      this.excelExporter = new window.CoreTaxExcelExporter();
      this.initializeMessageListener();
      if (this.isCompatiblePage()) this.injectToolbar();
      console.log("CoreTax PDF Downloader & Excel Extractor v1.1.0 Multi Periode aktif.");
    }

    injectToolbar() {
      if (document.getElementById("coretax-extension-toolbar")) return;

      const toolbar = document.createElement("div");
      toolbar.id = "coretax-extension-toolbar";
      Object.assign(toolbar.style, {
        position: "fixed",
        top: "90px",
        right: "16px",
        zIndex: "2147483000",
        backgroundColor: "#f2f2f2",
        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.25)",
        fontFamily: '"Segoe UI", Arial, sans-serif',
        width: "220px",
        boxSizing: "border-box",
        overflow: "hidden"
      });

      const savedPosition = this.loadToolbarPosition();
      if (savedPosition) {
        toolbar.style.top = `${savedPosition.top}px`;
        toolbar.style.left = `${savedPosition.left}px`;
        toolbar.style.right = "auto";
      }

      const header = document.createElement("div");
      Object.assign(header.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        backgroundColor: "#d00000",
        color: "#ffffff",
        fontSize: "13px",
        fontWeight: "600",
        cursor: "move",
        userSelect: "none"
      });
      header.textContent = "CoreTax Extension";
      this.makeToolbarDraggable(toolbar, header);

      const toggleIcon = document.createElement("span");
      toggleIcon.textContent = "▾";
      header.appendChild(toggleIcon);

      const body = document.createElement("div");
      Object.assign(body.style, {
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      });

      const makeButton = (label, bgColor, hoverColor, mode) => {
        const button = document.createElement("button");
        button.textContent = label;
        Object.assign(button.style, {
          width: "100%",
          padding: "10px 12px",
          fontSize: "13px",
          fontWeight: "bold",
          cursor: "pointer",
          backgroundColor: bgColor,
          color: "#ffffff",
          border: "0",
          borderRadius: "6px",
          boxSizing: "border-box"
        });
        button.addEventListener("mouseenter", () => {
          if (!button.disabled) button.style.backgroundColor = hoverColor;
        });
        button.addEventListener("mouseleave", () => {
          if (!button.disabled) button.style.backgroundColor = bgColor;
        });
        button.addEventListener("click", () => this.handleToolbarClick(button, mode, label));
        return button;
      };

      const excelBtn = makeButton("Buat Excel Saja", "#349e48", "#2a7d3a", "excelOnly");
      const pdfBtn = makeButton("Buat Pdf Saja", "#d00000", "#b00000", "pdfOnly");
      const bothBtn = makeButton("Download PDF + Buat Excel", "#d00000", "#b00000", "downloadPdfAndExcel");

      this.toolbarButtons = [excelBtn, pdfBtn, bothBtn];
      body.appendChild(excelBtn);
      body.appendChild(pdfBtn);
      body.appendChild(bothBtn);
      body.appendChild(this.buildMultiPeriodSection());

      let collapsed = false;
      header.addEventListener("click", () => {
        if (toolbar.dataset.dragged === "true") return;
        collapsed = !collapsed;
        body.style.display = collapsed ? "none" : "flex";
        toggleIcon.textContent = collapsed ? "▸" : "▾";
      });

      toolbar.appendChild(header);
      toolbar.appendChild(body);
      document.body.appendChild(toolbar);
    }

    makeToolbarDraggable(toolbar, handle) {
      let startX = 0;
      let startY = 0;
      let startTop = 0;
      let startLeft = 0;

      const onMouseMove = (event) => {
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) toolbar.dataset.dragged = "true";

        const maxLeft = window.innerWidth - toolbar.offsetWidth;
        const maxTop = window.innerHeight - toolbar.offsetHeight;
        toolbar.style.left = `${Math.min(Math.max(startLeft + dx, 0), maxLeft)}px`;
        toolbar.style.top = `${Math.min(Math.max(startTop + dy, 0), maxTop)}px`;
        toolbar.style.right = "auto";
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        if (toolbar.dataset.dragged === "true") {
          this.saveToolbarPosition(toolbar.offsetTop, toolbar.offsetLeft);
        }
        setTimeout(() => { toolbar.dataset.dragged = "false"; }, 0);
      };

      handle.addEventListener("mousedown", (event) => {
        startX = event.clientX;
        startY = event.clientY;
        startTop = toolbar.offsetTop;
        startLeft = toolbar.offsetLeft;
        toolbar.dataset.dragged = "false";
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        event.preventDefault();
      });
    }

    saveToolbarPosition(top, left) {
      try {
        localStorage.setItem("coretaxToolbarPosition", JSON.stringify({ top, left }));
      } catch (_) {
        // localStorage tidak tersedia, abaikan.
      }
    }

    loadToolbarPosition() {
      try {
        const raw = localStorage.getItem("coretaxToolbarPosition");
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    }

    buildMultiPeriodSection() {
      const section = document.createElement("div");
      Object.assign(section.style, {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        borderTop: "1px solid #ddd",
        paddingTop: "8px"
      });

      const isWithholdingPage = window.location.pathname.includes("/withholding-slips-portal/");

      const toggleBtn = document.createElement("button");
      toggleBtn.textContent = isWithholdingPage ? "Bukti Potong Multi Periode" : "Faktur Keluaran Multi Periode";
      Object.assign(toggleBtn.style, {
        width: "100%",
        padding: "10px 12px",
        fontSize: "13px",
        fontWeight: "bold",
        cursor: "pointer",
        backgroundColor: "#1a73e8",
        color: "#ffffff",
        border: "0",
        borderRadius: "6px",
        boxSizing: "border-box"
      });
      toggleBtn.addEventListener("mouseenter", () => { toggleBtn.style.backgroundColor = "#1558b0"; });
      toggleBtn.addEventListener("mouseleave", () => { toggleBtn.style.backgroundColor = "#1a73e8"; });

      const panel = document.createElement("div");
      Object.assign(panel.style, { display: "none", flexDirection: "column", gap: "6px" });

      const fieldStyle = {
        width: "100%",
        padding: "6px 8px",
        fontSize: "12px",
        boxSizing: "border-box",
        border: "1px solid #ccc",
        borderRadius: "4px"
      };
      const labelStyle = { fontSize: "11px", color: "#333" };

      let typeSelect = null;
      if (!isWithholdingPage) {
        const typeLabel = document.createElement("label");
        typeLabel.textContent = "Jenis Faktur";
        Object.assign(typeLabel.style, labelStyle);
        typeSelect = document.createElement("select");
        Object.assign(typeSelect.style, fieldStyle);
        [["output", "Faktur Keluaran"], ["input", "Faktur Masukan"]].forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          typeSelect.appendChild(option);
        });
        panel.appendChild(typeLabel);
        panel.appendChild(typeSelect);
      }

      const yearLabel = document.createElement("label");
      yearLabel.textContent = "Tahun";
      Object.assign(yearLabel.style, labelStyle);
      const yearInput = document.createElement("input");
      yearInput.type = "number";
      yearInput.min = "2020";
      yearInput.max = "2100";
      yearInput.value = String(new Date().getFullYear());
      Object.assign(yearInput.style, fieldStyle);

      const makeMonthSelect = (defaultMonth) => {
        const select = document.createElement("select");
        Object.assign(select.style, fieldStyle);
        for (let month = 1; month <= 12; month++) {
          const option = document.createElement("option");
          option.value = String(month);
          option.textContent = this.getMonthName(month);
          select.appendChild(option);
        }
        select.value = String(defaultMonth);
        return select;
      };

      const startLabel = document.createElement("label");
      startLabel.textContent = "Dari Bulan";
      Object.assign(startLabel.style, labelStyle);
      const startMonthSelect = makeMonthSelect(1);

      const endLabel = document.createElement("label");
      endLabel.textContent = "Sampai Bulan";
      Object.assign(endLabel.style, labelStyle);
      const endMonthSelect = makeMonthSelect(2);

      const makeCheckboxLabel = (text) => {
        const label = document.createElement("label");
        Object.assign(label.style, { ...labelStyle, display: "flex", alignItems: "center", gap: "6px" });
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(text));
        return { label, checkbox };
      };

      let savePdfCheckbox = null;
      let savePdfLabel = null;
      let buildItemExcelCheckbox = null;
      let buildItemExcelLabel = null;
      if (!isWithholdingPage) {
        ({ label: savePdfLabel, checkbox: savePdfCheckbox } = makeCheckboxLabel("Simpan PDF juga"));
        ({ label: buildItemExcelLabel, checkbox: buildItemExcelCheckbox } = makeCheckboxLabel("Excel rincian per barang (dari PDF)"));
      }

      const processBtn = document.createElement("button");
      processBtn.textContent = "Proses Multi Periode";
      Object.assign(processBtn.style, {
        width: "100%",
        padding: "10px 12px",
        fontSize: "13px",
        fontWeight: "bold",
        cursor: "pointer",
        backgroundColor: "#349e48",
        color: "#ffffff",
        border: "0",
        borderRadius: "6px",
        boxSizing: "border-box",
        marginTop: "4px"
      });
      processBtn.addEventListener("mouseenter", () => {
        if (!processBtn.disabled) processBtn.style.backgroundColor = "#2a7d3a";
      });
      processBtn.addEventListener("mouseleave", () => {
        if (!processBtn.disabled) processBtn.style.backgroundColor = "#349e48";
      });
      processBtn.addEventListener("click", () => {
        this.handleMultiPeriodToolbarClick(processBtn, yearInput, startMonthSelect, endMonthSelect, typeSelect, savePdfCheckbox, buildItemExcelCheckbox);
      });

      toggleBtn.addEventListener("click", () => {
        panel.style.display = panel.style.display === "none" ? "flex" : "none";
      });

      panel.appendChild(yearLabel);
      panel.appendChild(yearInput);
      panel.appendChild(startLabel);
      panel.appendChild(startMonthSelect);
      panel.appendChild(endLabel);
      panel.appendChild(endMonthSelect);
      if (savePdfLabel) panel.appendChild(savePdfLabel);
      if (buildItemExcelLabel) panel.appendChild(buildItemExcelLabel);
      panel.appendChild(processBtn);

      section.appendChild(toggleBtn);
      section.appendChild(panel);
      return section;
    }

    async handleMultiPeriodToolbarClick(button, yearInput, startMonthSelect, endMonthSelect, typeSelect, savePdfCheckbox, buildItemExcelCheckbox) {
      button.disabled = true;
      button.style.cursor = "not-allowed";
      const originalLabel = button.textContent;
      button.textContent = "Memproses...";

      try {
        await this.downloadMultiPeriodInvoices({
          year: Number(yearInput.value),
          startMonth: Number(startMonthSelect.value),
          endMonth: Number(endMonthSelect.value),
          invoiceType: typeSelect?.value || "output",
          savePdf: Boolean(savePdfCheckbox?.checked),
          buildItemExcel: Boolean(buildItemExcelCheckbox?.checked)
        });
      } catch (error) {
        console.error("KESALAHAN MULTI PERIODE:", error);
        alert(`Gagal: ${error.message || error}`);
      } finally {
        button.disabled = false;
        button.style.cursor = "pointer";
        button.textContent = originalLabel;
      }
    }

    async handleToolbarClick(button, mode, originalLabel) {
      this.toolbarButtons.forEach((btn) => {
        btn.disabled = true;
        btn.style.cursor = "not-allowed";
      });
      button.textContent = "Memproses...";

      try {
        await this.startProcess({ mode });
      } finally {
        this.toolbarButtons.forEach((btn) => {
          btn.disabled = false;
          btn.style.cursor = "pointer";
        });
        button.textContent = originalLabel;
      }
    }

    initializeMessageListener() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "ping") {
          sendResponse({ pong: true });
          return true;
        }

        if (request.action === "downloadAndExtractPDFs" || request.action === "processCoreTaxPDFs") {
          const mode = request.mode || "downloadPdfAndExcel";
          this.startProcess({ mode })
            .then((result) => sendResponse(result))
            .catch((error) => {
              console.error("KESALAHAN PROSES:", error);
              sendResponse({
                success: false,
                message: error.message || "Terjadi kesalahan saat proses."
              });
            });
          return true;
        }

        if (request.action === "downloadMultiPeriodInvoices") {
          this.downloadMultiPeriodInvoices(request)
            .then((result) => sendResponse(result))
            .catch((error) => {
              console.error("KESALAHAN MULTI PERIODE:", error);
              sendResponse({
                success: false,
                message: error.message || "Terjadi kesalahan saat mengambil Faktur Keluaran multi periode."
              });
            });
          return true;
        }
      });
    }

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

    async fetchOutputInvoicePage({ periodCode, year, first, rows }) {
      const result = await this.sendMessageToBackground({
        action: "fetchOutputInvoicesPage",
        periodCode,
        year,
        first,
        rows
      });

      if (!result?.success) {
        throw new Error(result?.message || "Gagal mengambil data Faktur Keluaran.");
      }

      const apiResponse = result.response;
      if (!apiResponse?.IsSuccessful) {
        throw new Error(apiResponse?.Message || "CoreTax mengembalikan status gagal.");
      }

      return apiResponse.Payload || { TotalRecords: 0, Data: [] };
    }

    async fetchAllOutputInvoicesForMonth(month, year) {
      const periodCode = this.getPeriodCode(month);
      const rows = 50;
      let first = 0;
      let totalRecords = null;
      const collected = [];
      const seen = new Set();
      let safety = 0;

      while (safety < 500) {
        safety++;
        const payload = await this.fetchOutputInvoicePage({
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
        "Kode Faktur": item.TaxInvoiceCode || "",
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

    async fetchInvoicePdfBlob(item, invoiceType) {
      const body = {
        EInvoiceRecordIdentifier: item.RecordId || "",
        EInvoiceAggregateIdentifier: item.AggregateIdentifier || "",
        DocumentAggregateIdentifier: item.DocumentFormAggregateIdentifier || "",
        LetterNumber: item.TaxInvoiceNumber || "",
        DocumentDate: item.TaxInvoiceDate || "",
        EInvoiceMenuType: invoiceType === "input" ? "Incoming" : "Outgoing",
        TaxInvoiceStatus: item.TaxInvoiceStatus || ""
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

      const periodMonth = Number(String(item.TaxInvoicePeriod || "").slice(-2));
      const monthAbbr = this.cleanFileName(this.getMonthName(periodMonth).slice(0, 3));
      const counterpartyName = this.cleanFileName(
        invoiceType === "input"
          ? (item.SellerTaxpayerName || "")
          : (item.BuyerTaxpayerNameClear || item.BuyerName || item.DisplayName || item.BuyerTaxpayerName || "")
      );
      const taxInvoiceNumber = this.cleanFileName(item.TaxInvoiceNumber || "FAKTUR");
      const fileName = `${taxInvoiceNumber}_${counterpartyName}_${monthAbbr}${item.TaxInvoiceYear || ""}.pdf`;

      return { blob, fileName };
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
      if (!this.isCompatiblePage()) {
        throw new Error("Buka halaman e-Invoice atau withholding slips CoreTax terlebih dahulu.");
      }

      if (window.location.pathname.includes("/withholding-slips-portal/")) {
        return this.downloadMultiPeriodWithholdingSlips(options);
      }

      if (!window.location.pathname.includes("/e-invoice-portal/")) {
        throw new Error("Buka halaman e-Invoice atau withholding slips CoreTax terlebih dahulu.");
      }

      if (options.invoiceType === "input") {
        return this.downloadMultiPeriodInputInvoices(options);
      }

      const year = Number(options.year);
      const startMonth = Number(options.startMonth);
      const endMonth = Number(options.endMonth);

      if (!Number.isInteger(year) || year < 2020 || year > 2100) {
        throw new Error("Tahun tidak valid.");
      }
      if (!Number.isInteger(startMonth) || !Number.isInteger(endMonth) || startMonth < 1 || endMonth > 12 || startMonth > endMonth) {
        throw new Error("Rentang bulan tidak valid.");
      }

      const allInvoices = [];
      for (let month = startMonth; month <= endMonth; month++) {
        console.log(`MULTI PERIODE: mengambil ${this.getMonthName(month)} ${year}...`);
        const monthData = await this.fetchAllOutputInvoicesForMonth(month, year);
        allInvoices.push(...monthData);
        console.log(`MULTI PERIODE: ${this.getMonthName(month)} = ${monthData.length} faktur.`);
      }

      if (allInvoices.length === 0) {
        throw new Error("Tidak ada Faktur Keluaran yang ditemukan untuk periode tersebut.");
      }

      const excelRows = allInvoices.map((item) => this.mapOutputInvoiceToExcelRow(item));
      const startLabel = this.getMonthName(startMonth).slice(0, 3);
      const endLabel = this.getMonthName(endMonth).slice(0, 3);
      const fileName = startMonth === endMonth
        ? `Faktur_Keluaran_${year}_${startLabel}.xlsx`
        : `Faktur_Keluaran_${year}_${startLabel}-${endLabel}.xlsx`;

      this.excelExporter.export(excelRows, fileName, "output");

      let message = `Selesai. ${allInvoices.length} Faktur Keluaran (${this.getMonthName(startMonth)}-${this.getMonthName(endMonth)} ${year}) diekspor ke Excel.`;
      let failedPdfs = [];

      if (options.savePdf || options.buildItemExcel) {
        const pdfResult = await this.downloadInvoicePdfsForItems(allInvoices, "output", {
          savePdf: options.savePdf,
          buildItemExcel: options.buildItemExcel
        });
        failedPdfs = pdfResult.failedPdfs;
        if (options.savePdf) {
          message += `\nPDF tersimpan: ${pdfResult.pdfSuccessCount}, PDF gagal: ${failedPdfs.length}.`;
        }
        if (options.buildItemExcel && pdfResult.itemExcelRows.length > 0) {
          const itemFileName = startMonth === endMonth
            ? `Faktur_Keluaran_Rincian_${year}_${startLabel}.xlsx`
            : `Faktur_Keluaran_Rincian_${year}_${startLabel}-${endLabel}.xlsx`;
          this.excelExporter.export(pdfResult.itemExcelRows, itemFileName);
          message += `\nExcel rincian per barang: ${pdfResult.itemExcelRows.length} baris (${itemFileName}).`;
        }
      }

      this.showFinalNotification(message, failedPdfs);
      return { success: true, message, count: allInvoices.length, fileName };
    }

    async fetchInputInvoicePage({ periodCode, year, first, rows }) {
      const result = await this.sendMessageToBackground({
        action: "fetchInputInvoicesPage",
        periodCode,
        year,
        first,
        rows
      });

      if (!result?.success) {
        throw new Error(result?.message || "Gagal mengambil data Faktur Masukan.");
      }

      const apiResponse = result.response;
      if (!apiResponse?.IsSuccessful) {
        throw new Error(apiResponse?.Message || "CoreTax mengembalikan status gagal.");
      }

      return apiResponse.Payload || { TotalRecords: 0, Data: [] };
    }

    async fetchAllInputInvoicesForMonth(month, year) {
      const periodCode = this.getPeriodCode(month);
      const rows = 50;
      let first = 0;
      let totalRecords = null;
      const collected = [];
      const seen = new Set();
      let safety = 0;

      while (safety < 500) {
        safety++;
        const payload = await this.fetchInputInvoicePage({ periodCode, year, first, rows });

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

    async downloadMultiPeriodInputInvoices(options = {}) {
      const year = Number(options.year);
      const startMonth = Number(options.startMonth);
      const endMonth = Number(options.endMonth);

      if (!Number.isInteger(year) || year < 2020 || year > 2100) {
        throw new Error("Tahun tidak valid.");
      }
      if (!Number.isInteger(startMonth) || !Number.isInteger(endMonth) || startMonth < 1 || endMonth > 12 || startMonth > endMonth) {
        throw new Error("Rentang bulan tidak valid.");
      }

      const allInvoices = [];
      for (let month = startMonth; month <= endMonth; month++) {
        console.log(`MULTI PERIODE MASUKAN: mengambil ${this.getMonthName(month)} ${year}...`);
        const monthData = await this.fetchAllInputInvoicesForMonth(month, year);
        allInvoices.push(...monthData);
        console.log(`MULTI PERIODE MASUKAN: ${this.getMonthName(month)} = ${monthData.length} faktur.`);
      }

      if (allInvoices.length === 0) {
        throw new Error("Tidak ada Faktur Masukan yang ditemukan untuk periode tersebut.");
      }

      const excelRows = allInvoices.map((item) => this.mapOutputInvoiceToExcelRow(item));
      const startLabel = this.getMonthName(startMonth).slice(0, 3);
      const endLabel = this.getMonthName(endMonth).slice(0, 3);
      const fileName = startMonth === endMonth
        ? `Faktur_Masukan_${year}_${startLabel}.xlsx`
        : `Faktur_Masukan_${year}_${startLabel}-${endLabel}.xlsx`;

      this.excelExporter.export(excelRows, fileName, "output");

      let message = `Selesai. ${allInvoices.length} Faktur Masukan (${this.getMonthName(startMonth)}-${this.getMonthName(endMonth)} ${year}) diekspor ke Excel.`;
      let failedPdfs = [];

      if (options.savePdf || options.buildItemExcel) {
        const pdfResult = await this.downloadInvoicePdfsForItems(allInvoices, "input", {
          savePdf: options.savePdf,
          buildItemExcel: options.buildItemExcel
        });
        failedPdfs = pdfResult.failedPdfs;
        if (options.savePdf) {
          message += `\nPDF tersimpan: ${pdfResult.pdfSuccessCount}, PDF gagal: ${failedPdfs.length}.`;
        }
        if (options.buildItemExcel && pdfResult.itemExcelRows.length > 0) {
          const itemFileName = startMonth === endMonth
            ? `Faktur_Masukan_Rincian_${year}_${startLabel}.xlsx`
            : `Faktur_Masukan_Rincian_${year}_${startLabel}-${endLabel}.xlsx`;
          this.excelExporter.export(pdfResult.itemExcelRows, itemFileName);
          message += `\nExcel rincian per barang: ${pdfResult.itemExcelRows.length} baris (${itemFileName}).`;
        }
      }

      this.showFinalNotification(message, failedPdfs);
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
        if (data.length < rows) break;
        if (totalRecords !== null && first + data.length >= totalRecords) break;

        first += rows;
      }

      return collected;
    }

    mapWithholdingSlipToExcelRow(item) {
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

      const excelRows = allSlips.map((item) => this.mapWithholdingSlipToExcelRow(item));
      const startLabel = this.getMonthName(startMonth).slice(0, 3);
      const endLabel = this.getMonthName(endMonth).slice(0, 3);
      const fileName = startMonth === endMonth
        ? `Bukti_Potong_${year}_${startLabel}.xlsx`
        : `Bukti_Potong_${year}_${startLabel}-${endLabel}.xlsx`;

      this.excelExporter.export(excelRows, fileName, "output");

      const message = `Selesai. ${allSlips.length} Bukti Potong (${this.getMonthName(startMonth)}-${this.getMonthName(endMonth)} ${year}) diekspor ke Excel.`;
      this.showFinalNotification(message, []);
      return { success: true, message, count: allSlips.length, fileName };
    }

    isCompatiblePage() {
      return window.location.hostname === "coretaxdjp.pajak.go.id";
    }

    async startProcess(options = {}) {
      const mode = options.mode || "downloadPdfAndExcel";
      const shouldDownloadPdf = mode !== "excelOnly";
      const shouldBuildExcel = mode !== "pdfOnly";
      if (!this.isCompatiblePage()) {
        this.showPopupMessage("Halaman tidak sesuai. Buka halaman e-Invoice atau withholding slips CoreTax terlebih dahulu.");
        return { success: false, message: "Halaman tidak sesuai." };
      }

      const selectedRows = this.getSelectedRows();
      if (selectedRows.length === 0) {
        this.showPopupMessage("Gagal: Pilih data terlebih dahulu sebelum download");
        return { success: false, message: "Gagal: Pilih data terlebih dahulu sebelum download" };
      }

      const documents = this.extractDocumentsFromRows(selectedRows);
      if (documents.length === 0) {
        this.showPopupMessage("Nomor dokumen tidak berhasil dibaca. Cek struktur tabel CoreTax.");
        return { success: false, message: "Nomor dokumen tidak ditemukan." };
      }

      this.printDebugTableSample();
      const result = await this.downloadExtractAndExport(documents, { shouldDownloadPdf, shouldBuildExcel });

      let message;
      if (!shouldBuildExcel) {
        message = `Selesai. \nPDF download: ${result.pdfSuccessCount}, \nFile gagal: ${result.failedDocuments.length}.`;
      } else if (shouldDownloadPdf) {
        message = `Selesai. \nPDF download: ${result.pdfSuccessCount}, \nExcel rows: ${result.excelRows.length}, \nFile gagal: ${result.failedDocuments.length}.`;
      } else {
        message = `Selesai. \nExcel rows: ${result.excelRows.length}, \nPDF dipilih: ${result.cleanupRequestCount}, \nFile gagal: ${result.failedDocuments.length}.`;
      }

      if (shouldBuildExcel && result.excelRows.length === 0) {
        message = `Proses selesai, tetapi tidak ada data yang berhasil diekspor ke Excel.\nFile gagal: ${result.failedDocuments.length}.`;
      }

      if (result.fallbackClickCount > 0) {
        message += `\nCatatan: ${result.fallbackClickCount} dokumen hanya berhasil diklik download, tetapi tidak diekstrak karena link PDF tidak dapat dibaca langsung.`;
      }

      this.showFinalNotification(message, result.failedDocuments);

      return { success: true, message };
    }

    getSelectedRows() {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      return rows.filter((row) => {
        const checkbox = row.querySelector("input[type='checkbox']");
        return checkbox && checkbox.checked;
      });
    }

    extractDocumentsFromRows(rows) {
      const documentMap = new Map();

      rows.forEach((row) => {
        const documentNumber = this.getDocumentNumberFromRow(row);
        if (!documentNumber) {
          console.warn("PERINGATAN: Nomor dokumen tidak ditemukan pada baris:", row);
          return;
        }

        if (!documentMap.has(documentNumber)) {
          documentMap.set(documentNumber, { number: documentNumber, row });
        }
      });

      return Array.from(documentMap.values());
    }

    getDocumentNumberFromRow(row) {
      const cells = Array.from(row.children);
      for (const cell of cells) {
        const text = this.cleanText(cell.innerText);
        if (this.isValidDocumentNumber(text)) return text;
      }
      return null;
    }

    isValidDocumentNumber(text) {
      const patterns = [/^\d{17}$/, /^(25|26)[A-Za-z0-9]{7}$/];
      return patterns.some((pattern) => pattern.test(text));
    }

    getFileNameFromRow(row) {
      const buyerName = this.cleanFileName(row.children[3]?.innerText || "NAMA_PEMBELI");
      const taxInvoiceNumber = this.cleanFileName(row.children[5]?.innerText || "NOMOR_FAKTUR");
      return `${taxInvoiceNumber}_${buyerName}.pdf`;
    }

    cleanFileName(text) {
      return String(text || "")
        .trim()
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .substring(0, 150);
    }

    cleanText(text) {
      return String(text || "").trim().replace(/\s+/g, " ");
    }

    async downloadExtractAndExport(documents, options = {}) {
      const shouldDownloadPdf = options.shouldDownloadPdf !== false;
      const shouldBuildExcel = options.shouldBuildExcel !== false;

      let pdfSuccessCount = 0;
      let fallbackClickCount = 0;
      let cleanupRequestCount = 0;
      const failedDocuments = [];
      const excelRows = [];

      for (let index = 0; index < documents.length; index++) {
        const document = documents[index];
        console.log(`PROSES: (${index + 1}/${documents.length}) ${document.number}`);

        try {
          const latestRow = this.findRowByDocumentNumber(document.number);
          if (!latestRow) throw new Error("Baris dokumen tidak ditemukan.");

          const downloadButton = this.findDownloadButton(latestRow);
          if (!downloadButton) throw new Error("Tombol download tidak ditemukan.");

          const customFileName = this.getFileNameFromRow(latestRow);
          let pdfUrl = this.findPdfUrlFromDownloadElement(downloadButton);
          let pdfBlob = null;

          if (pdfUrl) {
            // Kasus ideal: tombol download punya URL langsung.
            // Mode Excel saja: PDF hanya di-fetch sementara, tidak disimpan.
            pdfBlob = await this.fetchPdfBlob(pdfUrl);

            if (shouldDownloadPdf) {
              this.downloadBlob(pdfBlob, customFileName);
              pdfSuccessCount++;
            }
          } else {
            // Kasus CoreTax umum: tombol tidak punya href. Kita klik dulu,
            // lalu background menangkap URL download yang dibuat Chrome.
            // Catatan: untuk mode Excel saja, Chrome mungkin tetap membuat file sementara.
            // Setelah berhasil diekstrak, file tersebut diminta untuk dihapus otomatis.
            const captureFileName = shouldDownloadPdf
              ? customFileName
              : `TEMP_CORETAX_EXCEL_ONLY_${Date.now()}_${customFileName}`;

            const capturePromise = this.prepareDownloadCapture(captureFileName, 20000);
            await this.queueDownloadFileName(captureFileName, 30000);
            downloadButton.click();

            const capturedDownload = await capturePromise;
            if (!capturedDownload?.success) {
              fallbackClickCount++;
              await this.sleep(this.delayBetweenDownloads);
              continue;
            }

            pdfUrl = capturedDownload.finalUrl || capturedDownload.url;
            if (!pdfUrl) {
              fallbackClickCount++;
              await this.cleanupDownloadedFileIfNeeded(capturedDownload.downloadId, shouldDownloadPdf);
              await this.sleep(this.delayBetweenDownloads);
              continue;
            }

            try {
              pdfBlob = await this.fetchPdfBlob(pdfUrl);

              if (shouldDownloadPdf) {
                pdfSuccessCount++;
              }
            } catch (fetchError) {
              console.warn("PDF sudah terdownload, tetapi URL hasil download tidak bisa dibaca ulang untuk ekstraksi:", pdfUrl, fetchError);
              fallbackClickCount++;
              await this.cleanupDownloadedFileIfNeeded(capturedDownload.downloadId, shouldDownloadPdf);
              await this.sleep(this.delayBetweenDownloads);
              continue;
            }

            if (!shouldDownloadPdf) {
              cleanupRequestCount++;
              await this.cleanupDownloadedFileIfNeeded(capturedDownload.downloadId, shouldDownloadPdf);
            }
          }

          if (!pdfBlob) {
            throw new Error("PDF tidak tersedia untuk diekstrak.");
          }

          if (shouldBuildExcel) {
            const arrayBuffer = await pdfBlob.arrayBuffer();
            const rows = await this.pdfExtractor.extract(arrayBuffer, customFileName);
            excelRows.push(...rows);
          }

          await this.sleep(this.delayBetweenDownloads);
        } catch (error) {
          console.warn(`GAGAL: ${document.number}`, error);
          failedDocuments.push({
            number: document.number,
            reason: error.message || String(error)
          });

        }
      }

      if (shouldBuildExcel && excelRows.length > 0) {
        this.excelExporter.export(excelRows, this.buildExcelFileName());
      }

      return { pdfSuccessCount, fallbackClickCount, cleanupRequestCount, failedDocuments, excelRows };
    }

    async cleanupDownloadedFileIfNeeded(downloadId, shouldDownloadPdf) {
      if (shouldDownloadPdf || !downloadId) return;

      try {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: "cleanupDownloadedFile",
            downloadId
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.warn("Gagal meminta hapus file PDF sementara:", chrome.runtime.lastError);
              resolve();
              return;
            }

            if (!response?.success) {
              console.warn("File PDF sementara belum/tidak berhasil dihapus:", response?.message);
            }

            resolve();
          });
        });
      } catch (error) {
        console.warn("Gagal hapus file PDF sementara:", error);
      }
    }

    findRowByDocumentNumber(documentNumber) {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      return rows.find((row) => this.getDocumentNumberFromRow(row) === documentNumber);
    }

    findDownloadButton(row) {
      const selectors = [
        "#DownloadButton",
        "button[id*='Download']",
        "button[aria-label*='Download']",
        "button[title*='Download']",
        "a[id*='Download']",
        "a[aria-label*='Download']",
        "a[title*='Download']"
      ];

      for (const selector of selectors) {
        const element = row.querySelector(selector);
        if (element) return element;
      }
      return null;
    }

    findPdfUrlFromDownloadElement(element) {
      const candidates = [];

      if (element.tagName?.toLowerCase() === "a") candidates.push(element.getAttribute("href"));
      candidates.push(element.getAttribute("href"));
      candidates.push(element.dataset?.href);
      candidates.push(element.dataset?.url);
      candidates.push(element.dataset?.downloadUrl);

      const closestLink = element.closest("a[href]");
      if (closestLink) candidates.push(closestLink.getAttribute("href"));

      for (const candidate of candidates) {
        if (!candidate) continue;
        if (candidate.startsWith("javascript:")) continue;
        try {
          return new URL(candidate, window.location.href).href;
        } catch (_) {
          // skip invalid url
        }
      }

      return null;
    }

    async fetchPdfBlob(pdfUrl) {
      const response = await fetch(pdfUrl, {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`Gagal mengambil PDF. HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const contentType = blob.type || response.headers.get("content-type") || "";

      if (contentType && !contentType.toLowerCase().includes("pdf") && blob.size < 1000) {
        throw new Error("Response tidak terlihat seperti file PDF.");
      }

      return blob;
    }

    downloadBlob(blob, fileName) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    prepareDownloadCapture(expectedFileName, timeoutMs = 20000) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: "prepareDownloadCapture",
          expectedFileName,
          timeoutMs
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve(response);
        });
      });
    }

    queueDownloadFileName(filename, timeoutMs = 30000) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "queueDownloadFileName", filename, timeoutMs }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          if (!response?.success) {
            reject(new Error(response?.message || "Gagal mengantre nama file download."));
            return;
          }

          resolve(response);
        });
      });
    }

    buildExcelFileName() {
      const now = new Date();
      const pad = (value) => String(value).padStart(2, "0");
      const dd = pad(now.getDate());
      const mm = pad(now.getMonth() + 1);
      const yy = String(now.getFullYear()).slice(-2);
      const hh = pad(now.getHours());
      const min = pad(now.getMinutes());
      const ss = pad(now.getSeconds());
      return `PPN_hasil_ekstrak_${dd}${mm}${yy}_${hh}${min}${ss}.xlsx`;
    }

    printDebugTableSample() {
      const firstRow = document.querySelector("table tbody tr");
      if (!firstRow) {
        console.log("DEBUG: Tidak ada baris tabel ditemukan.");
        return;
      }

      console.log("DEBUG: Isi kolom pada baris pertama:");
      Array.from(firstRow.children).forEach((cell, index) => {
        console.log(`children[${index}] => ${this.cleanText(cell.innerText)}`);
      });
    }

    showPopupMessage(message) {
      const existingPopup = document.getElementById("coretax-downloader-popup");
      if (existingPopup) existingPopup.remove();

      const popup = document.createElement("div");
      popup.id = "coretax-downloader-popup";
      popup.style.position = "fixed";
      popup.style.top = "50%";
      popup.style.left = "50%";
      popup.style.transform = "translate(-50%, -50%)";
      popup.style.backgroundColor = "#f2f2f2";
      popup.style.borderRadius = "0";
      popup.style.setProperty("border-radius", "0", "important");
      popup.style.overflow = "hidden";
      popup.style.boxShadow = "0 10px 28px rgba(0, 0, 0, 0.22)";
      popup.style.zIndex = "2147483647";
      popup.style.textAlign = "center";
      popup.style.width = "min(560px, calc(100vw - 48px))";
      popup.style.boxSizing = "border-box";
      popup.style.fontFamily = '"Segoe UI", Arial, sans-serif';

      const messageArea = document.createElement("div");
      messageArea.style.boxSizing = "border-box";
      messageArea.style.minHeight = "150px";
      messageArea.style.padding = "40px 36px";
      messageArea.style.display = "flex";
      messageArea.style.alignItems = "center";
      messageArea.style.justifyContent = "center";

      const text = document.createElement("p");
      text.textContent = message;
      text.style.color = "#111111";
      text.style.fontSize = "24px";
      text.style.lineHeight = "1.35";
      text.style.fontWeight = "400";
      text.style.letterSpacing = "0";
      text.style.margin = "0";

      const closeButton = document.createElement("button");
      closeButton.textContent = "Tutup";
      closeButton.style.width = "100%";
      closeButton.style.height = "72px";
      closeButton.style.padding = "0 24px";
      closeButton.style.display = "block";
      closeButton.style.cursor = "pointer";
      closeButton.style.backgroundColor = "#f00000";
      closeButton.style.color = "#ffffff";
      closeButton.style.border = "0";
      closeButton.style.borderTop = "1px solid rgba(0, 0, 0, 0.08)";
      closeButton.style.borderRadius = "0";
      closeButton.style.setProperty("border-radius", "0", "important");
      closeButton.style.fontFamily = "inherit";
      closeButton.style.fontSize = "24px";
      closeButton.style.fontWeight = "500";
      closeButton.style.letterSpacing = "0";
      closeButton.addEventListener("mouseenter", () => {
        closeButton.style.backgroundColor = "#c90000";
      });
      closeButton.addEventListener("mouseleave", () => {
        closeButton.style.backgroundColor = "#f00000";
      });
      closeButton.addEventListener("focus", () => {
        closeButton.style.backgroundColor = "#c90000";
      });
      closeButton.addEventListener("blur", () => {
        closeButton.style.backgroundColor = "#f00000";
      });
      closeButton.addEventListener("click", () => popup.remove());

      messageArea.appendChild(text);
      popup.appendChild(messageArea);
      popup.appendChild(closeButton);
      document.body.appendChild(popup);
    }

    showFinalNotification(message, failedDocuments) {
      if (failedDocuments.length > 0) {
        const failedText = failedDocuments.map((item) => `${item.number}: ${item.reason}`).join("\n");
        message += `\n\nDetail gagal:\n${failedText}`;
      }
      alert(message);
      console.log(message);
    }

    sleep(milliseconds) {
      return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }
  }

  new CoreTaxPDFDownloaderV3();
})();
