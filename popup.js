class PopupManager {
  constructor() {
    document.addEventListener("DOMContentLoaded", () => {
      this.excelOnlyBtn = document.getElementById("excel-only-btn");
      this.pdfOnlyBtn = document.getElementById("pdf-only-btn");
      this.downloadExcelBtn = document.getElementById("download-excel-btn");
      this.statusText = document.getElementById("status-text");
      this.initialize();
    });
  }

  initialize() {
    if (!this.excelOnlyBtn || !this.pdfOnlyBtn || !this.downloadExcelBtn) {
      this.setStatus("Tombol proses tidak ditemukan.");
      return;
    }

    this.excelOnlyBtn.addEventListener("click", () => {
      this.handleProcess({
        mode: "excelOnly",
        loadingMessage: "Membuat Excel tanpa menyimpan PDF..."
      });
    });

    this.pdfOnlyBtn.addEventListener("click", () => {
      this.handleProcess({
        mode: "pdfOnly",
        loadingMessage: "Download PDF tanpa membuat Excel..."
      });
    });

    this.downloadExcelBtn.addEventListener("click", () => {
      this.handleProcess({
        mode: "downloadPdfAndExcel",
        loadingMessage: "Download PDF dan membuat Excel..."
      });
    });
  }

  async handleProcess({ mode, loadingMessage }) {
    try {
      this.setLoading(true, loadingMessage);

      const activeTab = await this.getActiveTab();
      if (!activeTab || !activeTab.id) {
        throw new Error("Tab aktif tidak ditemukan.");
      }

      if (!this.isCoreTaxHost(activeTab)) {
        await this.showPagePopup(activeTab.id, "Gagal: buka halaman coretax dan login");
        this.setStatus("");
        window.close();
        return;
      }

      await this.ensureContentScriptInjected(activeTab.id);

      const response = await this.sendMessageToContent(activeTab.id, {
        action: "processCoreTaxPDFs",
        mode
      });

      if (response?.success === false) {
        this.setStatus("");
        window.close();
        return;
      }

      this.setStatus(response?.message || "Perintah dikirim.");
    } catch (error) {
      console.error("KESALAHAN:", error);
      this.setStatus(`Gagal: ${error.message || error}`);
    } finally {
      this.setLoading(false);
    }
  }

  getActiveTab() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        if (!tabs || tabs.length === 0) {
          reject(new Error("Tidak ada tab aktif."));
          return;
        }
        resolve(tabs[0]);
      });
    });
  }

  async ensureContentScriptInjected(tabId) {
    const isAlreadyInjected = await this.checkContentScript(tabId);
    if (isAlreadyInjected) return;

    await new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        files: [
          "libs/pdf.min.js",
          "libs/xlsx.full.min.js",
          "pdf-extractor.js",
          "excel-exporter.js",
          "content.js"
        ]
      }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  isCoreTaxHost(tab) {
    try {
      return new URL(tab?.url || "").hostname === "coretaxdjp.pajak.go.id";
    } catch (_) {
      return false;
    }
  }

  checkContentScript(tabId) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
        if (chrome.runtime.lastError || !response?.pong) {
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  }

  showPagePopup(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        func: (popupMessage) => {
          const existingPopup = document.getElementById("coretax-extension-message-popup");
          if (existingPopup) existingPopup.remove();

          const overlay = document.createElement("div");
          overlay.id = "coretax-extension-message-popup";
          overlay.style.position = "fixed";
          overlay.style.inset = "0";
          overlay.style.zIndex = "2147483647";
          overlay.style.display = "flex";
          overlay.style.alignItems = "center";
          overlay.style.justifyContent = "center";
          overlay.style.backgroundColor = "rgba(0, 0, 0, 0.18)";
          overlay.style.fontFamily = '"Segoe UI", Arial, sans-serif';

          const dialog = document.createElement("div");
          dialog.style.width = "min(560px, calc(100vw - 48px))";
          dialog.style.boxSizing = "border-box";
          dialog.style.borderRadius = "0";
          dialog.style.setProperty("border-radius", "0", "important");
          dialog.style.overflow = "hidden";
          dialog.style.backgroundColor = "#f2f2f2";
          dialog.style.boxShadow = "0 10px 28px rgba(0, 0, 0, 0.22)";
          dialog.style.textAlign = "center";

          const messageArea = document.createElement("div");
          messageArea.style.boxSizing = "border-box";
          messageArea.style.minHeight = "150px";
          messageArea.style.padding = "40px 36px";
          messageArea.style.display = "flex";
          messageArea.style.alignItems = "center";
          messageArea.style.justifyContent = "center";

          const text = document.createElement("p");
          text.textContent = popupMessage;
          text.style.margin = "0";
          text.style.color = "#111111";
          text.style.fontSize = "24px";
          text.style.lineHeight = "1.35";
          text.style.fontWeight = "400";
          text.style.letterSpacing = "0";

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
          closeButton.addEventListener("click", () => overlay.remove());

          overlay.addEventListener("click", (event) => {
            if (event.target === overlay) overlay.remove();
          });

          messageArea.appendChild(text);
          dialog.appendChild(messageArea);
          dialog.appendChild(closeButton);
          overlay.appendChild(dialog);
          document.body.appendChild(overlay);
        },
        args: [message]
      }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  sendMessageToContent(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(response);
      });
    });
  }

  setLoading(isLoading, message = "") {
    if (this.excelOnlyBtn) {
      this.excelOnlyBtn.disabled = isLoading;
      this.excelOnlyBtn.textContent = isLoading ? "Memproses..." : "Buat Excel Saja";
    }

    if (this.pdfOnlyBtn) {
      this.pdfOnlyBtn.disabled = isLoading;
      this.pdfOnlyBtn.textContent = isLoading ? "Memproses..." : "Buat Pdf Saja";
    }

    if (this.downloadExcelBtn) {
      this.downloadExcelBtn.disabled = isLoading;
      this.downloadExcelBtn.textContent = isLoading ? "Memproses..." : "Download PDF + Buat Excel";
    }

    if (message) this.setStatus(message);
  }

  setButtonsEnabled(isEnabled) {
    if (this.excelOnlyBtn) this.excelOnlyBtn.disabled = !isEnabled;
    if (this.pdfOnlyBtn) this.pdfOnlyBtn.disabled = !isEnabled;
    if (this.downloadExcelBtn) this.downloadExcelBtn.disabled = !isEnabled;
  }

  setStatus(message) {
    if (this.statusText) {
      this.statusText.textContent = message;
      this.statusText.classList.toggle("is-error", /^Gagal/i.test(message));
      this.statusText.classList.toggle("is-ready", /^Siap/i.test(message));
    }
  }
}

new PopupManager();
