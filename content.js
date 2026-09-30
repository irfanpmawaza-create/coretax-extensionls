(() => {
  if (window.__coretaxPdfDownloaderV3Injected) return;
  window.__coretaxPdfDownloaderV3Injected = true;

  class CoreTaxPDFDownloaderV3 extends window.CoreTaxMultiPeriodDownloader {
    constructor() {
      super();
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
      this.toolbar = toolbar;

      const savedPosition = this.loadToolbarPosition();
      if (savedPosition) {
        toolbar.style.top = `${savedPosition.top}px`;
        toolbar.style.left = `${savedPosition.left}px`;
        toolbar.style.right = "auto";
      }

      const header = document.createElement("div");
      header.className = "coretax-toolbar__header";
      header.tabIndex = 0;
      header.setAttribute("role", "button");
      header.setAttribute("aria-expanded", "true");
      header.textContent = "CoreTax Extension";
      this.makeToolbarDraggable(toolbar, header);

      const toggleIcon = document.createElement("span");
      toggleIcon.className = "coretax-toolbar__chevron coretax-toolbar__header-chevron";
      toggleIcon.setAttribute("aria-hidden", "true");
      toggleIcon.textContent = "▾";
      header.appendChild(toggleIcon);

      const body = document.createElement("div");
      body.className = "coretax-toolbar__body";

      const makeButton = (label, mode, variant) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `coretax-toolbar__button coretax-toolbar__button--${variant}`;
        button.textContent = label;
        button.addEventListener("click", () => this.handleToolbarClick(button, mode, label));
        return button;
      };

      const excelBtn = makeButton("Buat Excel", "excelOnly", "excel");
      const pdfBtn = makeButton("Buat PDF", "pdfOnly", "pdf");
      const bothBtn = makeButton("Buat PDF + Excel", "downloadPdfAndExcel", "both");

      this.toolbarButtons = [excelBtn, pdfBtn, bothBtn];
      body.appendChild(excelBtn);
      body.appendChild(pdfBtn);
      body.appendChild(bothBtn);
      body.appendChild(this.buildMultiPeriodSection());

      const status = document.createElement("p");
      status.className = "coretax-toolbar__status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.hidden = true;
      this.toolbarStatus = status;
      body.appendChild(status);

      const toggleToolbar = () => {
        if (toolbar.dataset.dragged === "true") return;
        const collapsed = toolbar.classList.toggle("is-collapsed");
        header.setAttribute("aria-expanded", String(!collapsed));
        requestAnimationFrame(() => this.keepToolbarInViewport(toolbar));
      };
      header.addEventListener("click", toggleToolbar);
      header.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggleToolbar();
      });

      toolbar.appendChild(header);
      toolbar.appendChild(body);
      document.body.appendChild(toolbar);
      this.keepToolbarInViewport(toolbar);
      window.addEventListener("resize", () => this.keepToolbarInViewport(toolbar));
    }

    keepToolbarInViewport(toolbar) {
      const rect = toolbar.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth - toolbar.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - toolbar.offsetHeight);
      toolbar.style.left = `${Math.min(Math.max(rect.left, 0), maxLeft)}px`;
      toolbar.style.top = `${Math.min(Math.max(rect.top, 0), maxTop)}px`;
      toolbar.style.right = "auto";
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
      section.className = "coretax-toolbar__section";

      const isWithholdingPage = window.location.pathname.includes("/withholding-slips-portal/");

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "coretax-toolbar__button coretax-toolbar__button--custom";
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.setAttribute("aria-controls", "coretax-custom-download-form");
      const toggleText = document.createElement("span");
      toggleText.textContent = "Custom Download";
      const toggleChevron = document.createElement("span");
      toggleChevron.className = "coretax-toolbar__chevron";
      toggleChevron.setAttribute("aria-hidden", "true");
      toggleChevron.textContent = "▼";
      toggleBtn.appendChild(toggleText);
      toggleBtn.appendChild(toggleChevron);

      const panel = document.createElement("div");
      panel.id = "coretax-custom-download-form";
      panel.className = "coretax-toolbar__form";
      panel.hidden = true;

      let typeSelect = null;
      if (!isWithholdingPage) {
        const typeLabel = document.createElement("label");
        typeLabel.className = "coretax-toolbar__label";
        typeLabel.htmlFor = "coretax-invoice-type";
        typeLabel.textContent = "Jenis Faktur";
        typeSelect = document.createElement("select");
        typeSelect.id = "coretax-invoice-type";
        typeSelect.className = "coretax-toolbar__field";
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
      yearLabel.className = "coretax-toolbar__label";
      yearLabel.htmlFor = "coretax-download-year";
      yearLabel.textContent = "Tahun";
      const yearInput = document.createElement("input");
      yearInput.id = "coretax-download-year";
      yearInput.className = "coretax-toolbar__field";
      yearInput.type = "number";
      yearInput.min = "2020";
      yearInput.max = "2100";
      yearInput.value = String(new Date().getFullYear());

      const makeMonthSelect = (id, defaultMonth) => {
        const select = document.createElement("select");
        select.id = id;
        select.className = "coretax-toolbar__field";
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
      startLabel.className = "coretax-toolbar__label";
      startLabel.htmlFor = "coretax-start-month";
      startLabel.textContent = "Dari Bulan";
      const startMonthSelect = makeMonthSelect("coretax-start-month", 1);

      const endLabel = document.createElement("label");
      endLabel.className = "coretax-toolbar__label";
      endLabel.htmlFor = "coretax-end-month";
      endLabel.textContent = "Sampai Bulan";
      const endMonthSelect = makeMonthSelect("coretax-end-month", 2);

      const makeCheckboxLabel = (id, text) => {
        const label = document.createElement("label");
        label.className = "coretax-toolbar__check";
        label.htmlFor = id;
        const checkbox = document.createElement("input");
        checkbox.id = id;
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
        ({ label: savePdfLabel, checkbox: savePdfCheckbox } = makeCheckboxLabel("coretax-save-pdf", "Simpan PDF juga"));
        ({ label: buildItemExcelLabel, checkbox: buildItemExcelCheckbox } = makeCheckboxLabel("coretax-item-excel", "Excel rincian per barang"));
      }

      const processBtn = document.createElement("button");
      processBtn.type = "button";
      processBtn.className = "coretax-toolbar__button coretax-toolbar__button--process";
      processBtn.textContent = "Proses Multi Periode";
      processBtn.addEventListener("click", () => {
        this.handleMultiPeriodToolbarClick(processBtn, yearInput, startMonthSelect, endMonthSelect, typeSelect, savePdfCheckbox, buildItemExcelCheckbox);
      });

      toggleBtn.addEventListener("click", () => {
        const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
        toggleBtn.setAttribute("aria-expanded", String(!expanded));
        panel.hidden = expanded;
        requestAnimationFrame(() => this.keepToolbarInViewport(this.toolbar));
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
      const year = Number(yearInput.value);
      const startMonth = Number(startMonthSelect.value);
      const endMonth = Number(endMonthSelect.value);
      yearInput.removeAttribute("aria-invalid");
      startMonthSelect.removeAttribute("aria-invalid");
      endMonthSelect.removeAttribute("aria-invalid");

      if (!Number.isInteger(year) || year < 2020 || year > 2100) {
        yearInput.setAttribute("aria-invalid", "true");
        this.setToolbarStatus("Tahun harus diisi antara 2020 dan 2100.", "error");
        yearInput.focus();
        return;
      }
      if (!Number.isInteger(startMonth) || !Number.isInteger(endMonth) || startMonth < 1 || endMonth > 12 || startMonth > endMonth) {
        startMonthSelect.setAttribute("aria-invalid", "true");
        endMonthSelect.setAttribute("aria-invalid", "true");
        this.setToolbarStatus("Bulan awal tidak boleh melewati bulan akhir.", "error");
        startMonthSelect.focus();
        return;
      }

      button.disabled = true;
      const originalLabel = button.textContent;
      button.textContent = "Memproses...";
      this.setToolbarStatus("Memproses custom download...", "loading");

      try {
        await this.downloadMultiPeriodInvoices({
          year,
          startMonth,
          endMonth,
          invoiceType: typeSelect?.value || "output",
          savePdf: Boolean(savePdfCheckbox?.checked),
          buildItemExcel: Boolean(buildItemExcelCheckbox?.checked)
        });
      } catch (error) {
        console.error("KESALAHAN MULTI PERIODE:", error);
        this.setToolbarStatus(`Gagal: ${error.message || error}`, "error");
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }

    async handleToolbarClick(button, mode, originalLabel) {
      this.toolbarButtons.forEach((btn) => {
        btn.disabled = true;
      });
      button.textContent = "Memproses...";
      this.setToolbarStatus("Memproses dokumen yang dipilih...", "loading");

      try {
        const result = await this.startProcess({ mode });
        if (result?.success === false) this.setToolbarStatus(result.message, "error");
      } catch (error) {
        console.error("KESALAHAN PROSES:", error);
        this.setToolbarStatus(`Gagal: ${error.message || error}`, "error");
      } finally {
        this.toolbarButtons.forEach((btn) => {
          btn.disabled = false;
        });
        button.textContent = originalLabel;
      }
    }

    setToolbarStatus(message, state = "") {
      if (!this.toolbarStatus) return;
      this.toolbarStatus.textContent = message || "";
      this.toolbarStatus.hidden = !message;
      this.toolbarStatus.classList.toggle("is-loading", state === "loading");
      this.toolbarStatus.classList.toggle("is-success", state === "success");
      this.toolbarStatus.classList.toggle("is-error", state === "error");
      if (message) requestAnimationFrame(() => this.keepToolbarInViewport(this.toolbar));
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

    showPopupMessage(message, type = "error") {
      const existingPopup = document.getElementById("coretax-downloader-popup");
      if (existingPopup) existingPopup.remove();

      const previousFocus = document.activeElement;
      const overlay = document.createElement("div");
      overlay.id = "coretax-downloader-popup";
      overlay.className = "coretax-result-overlay";

      const dialog = document.createElement("div");
      dialog.className = `coretax-result-dialog is-${type}`;
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", "coretax-result-title");

      const title = document.createElement("div");
      title.id = "coretax-result-title";
      title.className = "coretax-result-dialog__header";
      title.textContent = type === "success" ? "Proses Berhasil" : type === "warning" ? "Proses Selesai dengan Catatan" : "Perhatian";

      const text = document.createElement("p");
      text.className = "coretax-result-dialog__message";
      text.textContent = message;

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "coretax-result-dialog__close";
      closeButton.textContent = "Tutup";

      const close = () => {
        overlay.remove();
        if (previousFocus instanceof HTMLElement) previousFocus.focus();
      };
      closeButton.addEventListener("click", close);
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
      });
      overlay.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
      });

      dialog.appendChild(title);
      dialog.appendChild(text);
      dialog.appendChild(closeButton);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      closeButton.focus();
    }

    showFinalNotification(message, failedDocuments) {
      if (failedDocuments.length > 0) {
        const failedText = failedDocuments.map((item) => `${item.number}: ${item.reason}`).join("\n");
        message += `\n\nDetail gagal:\n${failedText}`;
      }
      this.setToolbarStatus("");
      this.showPopupMessage(message, failedDocuments.length > 0 ? "warning" : "success");
      console.log(message);
    }

    sleep(milliseconds) {
      return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }
  }

  new CoreTaxPDFDownloaderV3();
})();
