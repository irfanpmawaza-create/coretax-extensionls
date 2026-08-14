const pendingFileNames = [];
const pendingDownloadCaptures = [];

function now() {
  return Date.now();
}

function normalizeFileName(fileName) {
  return String(fileName || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .trim();
}

function cleanupExpiredCaptures() {
  const current = now();
  for (let i = pendingDownloadCaptures.length - 1; i >= 0; i--) {
    const item = pendingDownloadCaptures[i];
    if (current > item.expireAt) {
      pendingDownloadCaptures.splice(i, 1);
      item.sendResponse({
        success: false,
        message: "Timeout menunggu download dibuat oleh Chrome."
      });
    }
  }

  for (let i = pendingFileNames.length - 1; i >= 0; i--) {
    if (current > pendingFileNames[i].expireAt) {
      pendingFileNames.splice(i, 1);
    }
  }
}

function cleanupDownloadedFile(downloadId, attempt = 1, sendResponse = null) {
  chrome.downloads.search({ id: downloadId }, (items) => {
    if (chrome.runtime.lastError) {
      if (sendResponse) sendResponse({ success: false, message: chrome.runtime.lastError.message });
      return;
    }

    const item = items && items[0];
    if (!item) {
      if (sendResponse) sendResponse({ success: false, message: "Download tidak ditemukan." });
      return;
    }

    if (item.state !== "complete" && attempt < 20) {
      setTimeout(() => cleanupDownloadedFile(downloadId, attempt + 1, sendResponse), 1000);
      return;
    }

    if (item.state !== "complete") {
      if (sendResponse) sendResponse({ success: false, message: "File belum selesai diunduh, tidak bisa dihapus." });
      return;
    }

    chrome.downloads.removeFile(downloadId, () => {
      const removeError = chrome.runtime.lastError;

      chrome.downloads.erase({ id: downloadId }, () => {
        if (sendResponse) {
          if (removeError) {
            sendResponse({ success: false, message: removeError.message });
          } else {
            sendResponse({ success: true });
          }
        }
      });
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "queueDownloadFileName") {
    if (request.filename) {
      pendingFileNames.push({
        filename: request.filename,
        expireAt: now() + (request.timeoutMs || 30000)
      });
      console.log("Nama file masuk antrian:", request.filename);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, message: "Filename kosong." });
    }
    return true;
  }

  if (request.action === "prepareDownloadCapture") {
    pendingDownloadCaptures.push({
      expectedFileName: request.expectedFileName || "",
      startedAt: now(),
      expireAt: now() + (request.timeoutMs || 15000),
      sendResponse
    });

    setTimeout(cleanupExpiredCaptures, request.timeoutMs || 15000);
    return true;
  }

  if (request.action === "cleanupDownloadedFile") {
    if (!request.downloadId) {
      sendResponse({ success: false, message: "downloadId kosong." });
      return true;
    }

    cleanupDownloadedFile(request.downloadId, 1, sendResponse);
    return true;
  }
});

chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  cleanupExpiredCaptures();

  if (pendingFileNames.length === 0) {
    suggest();
    return;
  }

  const queuedFile = pendingFileNames.shift();
  const customFileName = queuedFile.filename;

  suggest({
    filename: customFileName,
    conflictAction: "uniquify"
  });

  console.log("Download diganti nama menjadi:", customFileName);
});

chrome.downloads.onCreated.addListener((downloadItem) => {
  cleanupExpiredCaptures();

  if (pendingDownloadCaptures.length === 0) {
    return;
  }

  let captureIndex = 0;
  const downloadFileName = normalizeFileName(downloadItem.filename);

  if (downloadFileName) {
    const matchingIndex = pendingDownloadCaptures.findIndex((item) =>
      normalizeFileName(item.expectedFileName) === downloadFileName
    );
    if (matchingIndex >= 0) captureIndex = matchingIndex;
    if (matchingIndex < 0) return;
  }

  const capture = pendingDownloadCaptures.splice(captureIndex, 1)[0];

  capture.sendResponse({
    success: true,
    downloadId: downloadItem.id,
    url: downloadItem.url || "",
    finalUrl: downloadItem.finalUrl || "",
    filename: downloadItem.filename || "",
    mime: downloadItem.mime || ""
  });

  console.log("Download terdeteksi untuk ekstraksi:", {
    id: downloadItem.id,
    url: downloadItem.url,
    finalUrl: downloadItem.finalUrl,
    filename: downloadItem.filename,
    mime: downloadItem.mime
  });
});

// ============================================================
// Fitur Faktur Keluaran Multi Periode (v1.1.0)
// Menangkap konteks autentikasi dari request CoreTax yang sah,
// hanya di memori service worker (tidak disimpan permanen).
// ============================================================
const OUTPUT_INVOICE_LIST_URL = "https://coretaxdjp.pajak.go.id/einvoiceportal/api/outputinvoice/list";
const outputInvoiceContexts = new Map();

function getOutputInvoiceContext(tabId) {
  if (!outputInvoiceContexts.has(tabId)) {
    outputInvoiceContexts.set(tabId, {
      authorization: "",
      payloadTemplate: null,
      capturedAt: 0
    });
  }
  return outputInvoiceContexts.get(tabId);
}

function decodeRequestBody(details) {
  try {
    const rawParts = details.requestBody?.raw || [];
    if (!rawParts.length) return null;

    const decoder = new TextDecoder("utf-8");
    let text = "";
    for (const part of rawParts) {
      if (part.bytes) text += decoder.decode(part.bytes, { stream: true });
    }
    text += decoder.decode();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.warn("Gagal membaca payload outputinvoice/list:", error);
    return null;
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== "POST" || details.tabId < 0) return;
    const payload = decodeRequestBody(details);
    if (!payload) return;

    const context = getOutputInvoiceContext(details.tabId);
    context.payloadTemplate = payload;
    context.capturedAt = now();
  },
  { urls: [OUTPUT_INVOICE_LIST_URL] },
  ["requestBody"]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.method !== "POST" || details.tabId < 0) return;
    const authorizationHeader = (details.requestHeaders || []).find(
      (header) => String(header.name || "").toLowerCase() === "authorization"
    );

    if (!authorizationHeader?.value) return;

    const context = getOutputInvoiceContext(details.tabId);
    context.authorization = authorizationHeader.value;
    context.capturedAt = now();
  },
  { urls: [OUTPUT_INVOICE_LIST_URL] },
  ["requestHeaders", "extraHeaders"]
);

async function executeOutputInvoiceFetch(tabId, authorization, payload) {
  const injectionResults = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (endpoint, authHeader, requestPayload) => {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify(requestPayload)
      });

      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (_) {
        data = { rawText: text };
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data
      };
    },
    args: [OUTPUT_INVOICE_LIST_URL, authorization, payload]
  });

  return injectionResults?.[0]?.result || null;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "fetchOutputInvoicesPage") return;

  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) {
    sendResponse({ success: false, message: "Tab CoreTax tidak ditemukan." });
    return true;
  }

  const context = outputInvoiceContexts.get(tabId);
  if (!context?.authorization || !context?.payloadTemplate) {
    sendResponse({
      success: false,
      code: "CONTEXT_NOT_CAPTURED",
      message: "Konteks API belum terbaca. Di halaman Faktur Keluaran, ubah filter/refresh tabel sekali lalu coba lagi."
    });
    return true;
  }

  const periodCode = request.periodCode;
  const year = String(request.year || "");
  const first = Number(request.first || 0);
  const rows = Number(request.rows || 50);

  const base = context.payloadTemplate;
  const filters = Array.isArray(base.Filters)
    ? base.Filters.map((item) => ({ ...item }))
    : [];

  const upsertFilter = (propertyName, value) => {
    const existing = filters.find((item) => item.PropertyName === propertyName);
    if (existing) {
      existing.Value = value;
    } else {
      filters.push({
        PropertyName: propertyName,
        Value: value,
        MatchMode: "equals",
        CaseSensitive: true,
        AsString: false
      });
    }
  };

  upsertFilter("TaxInvoicePeriod", periodCode);
  upsertFilter("TaxInvoiceYear", year);

  const payload = {
    ...base,
    First: first,
    Rows: rows,
    Filters: filters,
    LanguageId: base.LanguageId || "id-ID"
  };

  executeOutputInvoiceFetch(tabId, context.authorization, payload)
    .then((result) => {
      if (!result) {
        sendResponse({ success: false, message: "CoreTax tidak mengembalikan hasil." });
        return;
      }

      if (!result.ok) {
        sendResponse({
          success: false,
          status: result.status,
          message: `Request CoreTax gagal (${result.status} ${result.statusText || ""}).`.trim(),
          response: result.data
        });
        return;
      }

      sendResponse({ success: true, response: result.data });
    })
    .catch((error) => {
      console.error("Gagal mengambil Faktur Keluaran multi periode:", error);
      sendResponse({ success: false, message: error.message || String(error) });
    });

  return true;
});

// ============================================================
// Fitur Bukti Potong (Withholding Slips) Multi Periode
// Pola sama dengan Faktur Keluaran di atas.
// ============================================================
// Endpoint list bukti potong beda-beda per jenis (MP, BP21, BP23, dst),
// semua berpola ".../withholdingslipsportal/api/getebupot...issued".
// Ditangkap generik berdasarkan pola URL, bukan nama endpoint yang di-hardcode.
const WITHHOLDING_SLIP_API_PATTERN = "https://coretaxdjp.pajak.go.id/withholdingslipsportal/api/*";
const withholdingSlipContexts = new Map();

function getWithholdingSlipContext(tabId) {
  if (!withholdingSlipContexts.has(tabId)) {
    withholdingSlipContexts.set(tabId, {
      authorization: "",
      payloadTemplate: null,
      endpoint: "",
      capturedAt: 0
    });
  }
  return withholdingSlipContexts.get(tabId);
}

function isWithholdingSlipIssuedListUrl(url) {
  return /\/withholdingslipsportal\/api\/getebupot\w*issued/i.test(url || "");
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== "POST" || details.tabId < 0) return;
    if (!isWithholdingSlipIssuedListUrl(details.url)) return;
    const payload = decodeRequestBody(details);
    if (!payload) return;

    const context = getWithholdingSlipContext(details.tabId);
    context.payloadTemplate = payload;
    context.endpoint = details.url;
    context.capturedAt = now();
  },
  { urls: [WITHHOLDING_SLIP_API_PATTERN] },
  ["requestBody"]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.method !== "POST" || details.tabId < 0) return;
    if (!isWithholdingSlipIssuedListUrl(details.url)) return;
    const authorizationHeader = (details.requestHeaders || []).find(
      (header) => String(header.name || "").toLowerCase() === "authorization"
    );

    if (!authorizationHeader?.value) return;

    const context = getWithholdingSlipContext(details.tabId);
    context.authorization = authorizationHeader.value;
    context.capturedAt = now();
  },
  { urls: [WITHHOLDING_SLIP_API_PATTERN] },
  ["requestHeaders", "extraHeaders"]
);

async function executeWithholdingSlipFetch(tabId, authorization, payload, endpoint) {
  const injectionResults = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (endpoint, authHeader, requestPayload) => {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify(requestPayload)
      });

      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (_) {
        data = { rawText: text };
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data
      };
    },
    args: [endpoint, authorization, payload]
  });

  return injectionResults?.[0]?.result || null;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "fetchWithholdingSlipsPage") return;

  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) {
    sendResponse({ success: false, message: "Tab CoreTax tidak ditemukan." });
    return true;
  }

  const context = withholdingSlipContexts.get(tabId);
  if (!context?.authorization || !context?.payloadTemplate || !context?.endpoint) {
    sendResponse({
      success: false,
      code: "CONTEXT_NOT_CAPTURED",
      message: "Konteks API belum terbaca. Di halaman Bukti Potong, ubah filter/refresh tabel sekali lalu coba lagi."
    });
    return true;
  }

  const periodCode = request.periodCode;
  const first = Number(request.first || 0);
  const rows = Number(request.rows || 50);

  const base = context.payloadTemplate;
  const filters = Array.isArray(base.Filters)
    ? base.Filters.map((item) => ({ ...item }))
    : [];

  const upsertFilter = (propertyName, value) => {
    const existing = filters.find((item) => item.PropertyName === propertyName);
    if (existing) {
      existing.Value = value;
    } else {
      filters.push({
        PropertyName: propertyName,
        Value: value,
        MatchMode: "equals",
        CaseSensitive: true,
        AsString: false
      });
    }
  };

  upsertFilter("TaxPeriodCode", periodCode);

  const payload = {
    ...base,
    First: first,
    Rows: rows,
    Filters: filters,
    LanguageId: base.LanguageId || "id-ID"
  };

  executeWithholdingSlipFetch(tabId, context.authorization, payload, context.endpoint)
    .then((result) => {
      if (!result) {
        sendResponse({ success: false, message: "CoreTax tidak mengembalikan hasil." });
        return;
      }

      if (!result.ok) {
        sendResponse({
          success: false,
          status: result.status,
          message: `Request CoreTax gagal (${result.status} ${result.statusText || ""}).`.trim(),
          response: result.data
        });
        return;
      }

      sendResponse({ success: true, response: result.data });
    })
    .catch((error) => {
      console.error("Gagal mengambil Bukti Potong multi periode:", error);
      sendResponse({ success: false, message: error.message || String(error) });
    });

  return true;
});
