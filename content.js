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
      console.log("CoreTax PDF Downloader & Excel Extractor v1.0.2 Full aktif.");
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
        cursor: "pointer",
        userSelect: "none"
      });
      header.textContent = "CoreTax Extension";

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

      let collapsed = false;
      header.addEventListener("click", () => {
        collapsed = !collapsed;
        body.style.display = collapsed ? "none" : "flex";
        toggleIcon.textContent = collapsed ? "▸" : "▾";
      });

      toolbar.appendChild(header);
      toolbar.appendChild(body);
      document.body.appendChild(toolbar);
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
