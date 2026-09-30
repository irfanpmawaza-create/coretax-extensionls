importScripts("background-downloads.js");

// ============================================================
// Fitur Faktur Keluaran Multi Periode (v1.1.0)
// Menangkap konteks autentikasi dari request CoreTax yang sah,
// hanya di memori service worker (tidak disimpan permanen).
// ============================================================
const OUTPUT_INVOICE_LIST_URL = "https://coretaxdjp.pajak.go.id/einvoiceportal/api/outputinvoice/list";
const OUTPUT_INVOICE_VIEW_URL = "https://coretaxdjp.pajak.go.id/einvoiceportal/api/outputinvoice/view";
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
    console.warn("Gagal membaca payload request CoreTax:", error);
    return null;
  }
}

function upsertFilter(filters, propertyName, value, preserveArray = false) {
  const existing = filters.find((item) => item.PropertyName === propertyName);
  if (existing) {
    existing.Value = preserveArray && Array.isArray(existing.Value) ? [value] : value;
    return;
  }
  filters.push({
    PropertyName: propertyName,
    Value: value,
    MatchMode: "equals",
    CaseSensitive: true,
    AsString: false
  });
}

function buildInvoiceListPayload(base, { periodCode, year, first, rows }) {
  const filters = Array.isArray(base.Filters)
    ? base.Filters.map((item) => ({ ...item }))
    : [];
  upsertFilter(filters, "TaxInvoicePeriod", periodCode, true);
  upsertFilter(filters, "TaxInvoiceYear", String(year || ""), true);
  return {
    ...base,
    First: Number(first || 0),
    Rows: Number(rows || 50),
    Filters: filters,
    LanguageId: base.LanguageId || "id-ID"
  };
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

async function executeCoreTaxFetch(tabId, authorization, payload, endpoint) {
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

  const payload = buildInvoiceListPayload(context.payloadTemplate, request);

  executeCoreTaxFetch(tabId, context.authorization, payload, OUTPUT_INVOICE_LIST_URL)
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "fetchOutputInvoiceDetail") return;

  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) {
    sendResponse({ success: false, message: "Tab CoreTax tidak ditemukan." });
    return true;
  }

  const context = outputInvoiceContexts.get(tabId);
  const taxpayerAggregateIdentifier = context?.payloadTemplate?.TaxpayerAggregateIdentifier
    || context?.payloadTemplate?.SellerTaxpayerAggregateIdentifier
    || "";

  if (!context?.authorization || !taxpayerAggregateIdentifier) {
    sendResponse({
      success: false,
      code: "CONTEXT_NOT_CAPTURED",
      message: "Konteks API belum terbaca. Di halaman Faktur Keluaran, ubah filter/refresh tabel sekali lalu coba lagi."
    });
    return true;
  }

  const recordIdentifier = String(request.recordIdentifier || "");
  if (!recordIdentifier) {
    sendResponse({ success: false, message: "RecordId faktur tidak tersedia." });
    return true;
  }

  const payload = {
    RecordIdentifier: recordIdentifier,
    EinvoiceVATStatus: "VAT_VAT",
    TaxpayerAggregateIdentifier: taxpayerAggregateIdentifier
  };

  executeCoreTaxFetch(tabId, context.authorization, payload, OUTPUT_INVOICE_VIEW_URL)
    .then((result) => {
      if (!result) {
        sendResponse({ success: false, message: "CoreTax tidak mengembalikan detail faktur." });
        return;
      }

      if (!result.ok) {
        sendResponse({
          success: false,
          status: result.status,
          message: "Request detail CoreTax gagal (" + result.status + " " + (result.statusText || "") + ").",
          response: result.data
        });
        return;
      }

      const rows = result.data?.Payload?.FormDataObj?.TransactionDetailsData?.Rows;
      if (!result.data?.IsSuccessful || !Array.isArray(rows) || rows.length === 0) {
        sendResponse({
          success: false,
          message: result.data?.Message || "Data rincian transaksi tidak tersedia.",
          response: result.data
        });
        return;
      }

      sendResponse({ success: true, response: result.data });
    })
    .catch((error) => {
      console.error("Gagal mengambil detail Faktur Keluaran:", error);
      sendResponse({ success: false, message: error.message || String(error) });
    });

  return true;
});

// ============================================================
// Fitur Faktur Masukan Multi Periode
// Pola sama dengan Faktur Keluaran di atas.
// ============================================================
const INPUT_INVOICE_LIST_URL = "https://coretaxdjp.pajak.go.id/einvoiceportal/api/inputinvoice/list";
const INPUT_INVOICE_VIEW_URL = "https://coretaxdjp.pajak.go.id/einvoiceportal/api/inputinvoice/view";
const inputInvoiceContexts = new Map();

function getInputInvoiceContext(tabId) {
  if (!inputInvoiceContexts.has(tabId)) {
    inputInvoiceContexts.set(tabId, {
      authorization: "",
      payloadTemplate: null,
      capturedAt: 0
    });
  }
  return inputInvoiceContexts.get(tabId);
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== "POST" || details.tabId < 0) return;
    const payload = decodeRequestBody(details);
    if (!payload) return;

    const context = getInputInvoiceContext(details.tabId);
    context.payloadTemplate = payload;
    context.capturedAt = now();
  },
  { urls: [INPUT_INVOICE_LIST_URL] },
  ["requestBody"]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.method !== "POST" || details.tabId < 0) return;
    const authorizationHeader = (details.requestHeaders || []).find(
      (header) => String(header.name || "").toLowerCase() === "authorization"
    );

    if (!authorizationHeader?.value) return;

    const context = getInputInvoiceContext(details.tabId);
    context.authorization = authorizationHeader.value;
    context.capturedAt = now();
  },
  { urls: [INPUT_INVOICE_LIST_URL] },
  ["requestHeaders", "extraHeaders"]
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "fetchInputInvoicesPage") return;

  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) {
    sendResponse({ success: false, message: "Tab CoreTax tidak ditemukan." });
    return true;
  }

  const context = inputInvoiceContexts.get(tabId);
  if (!context?.authorization || !context?.payloadTemplate) {
    sendResponse({
      success: false,
      code: "CONTEXT_NOT_CAPTURED",
      message: "Konteks API belum terbaca. Di halaman Faktur Masukan, ubah filter/refresh tabel sekali lalu coba lagi."
    });
    return true;
  }

  const payload = buildInvoiceListPayload(context.payloadTemplate, request);

  executeCoreTaxFetch(tabId, context.authorization, payload, INPUT_INVOICE_LIST_URL)
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
      console.error("Gagal mengambil Faktur Masukan multi periode:", error);
      sendResponse({ success: false, message: error.message || String(error) });
    });

  return true;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "fetchInputInvoiceDetail") return;

  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) {
    sendResponse({ success: false, message: "Tab CoreTax tidak ditemukan." });
    return true;
  }

  const context = inputInvoiceContexts.get(tabId);
  const taxpayerAggregateIdentifier = context?.payloadTemplate?.TaxpayerAggregateIdentifier
    || context?.payloadTemplate?.BuyerTaxpayerAggregateIdentifier
    || "";

  if (!context?.authorization || !taxpayerAggregateIdentifier) {
    sendResponse({
      success: false,
      code: "CONTEXT_NOT_CAPTURED",
      message: "Konteks API belum terbaca. Di halaman Faktur Masukan, ubah filter/refresh tabel sekali lalu coba lagi."
    });
    return true;
  }

  const recordIdentifier = String(request.recordIdentifier || "");
  if (!recordIdentifier) {
    sendResponse({ success: false, message: "RecordId faktur tidak tersedia." });
    return true;
  }

  const payload = {
    RecordIdentifier: recordIdentifier,
    EinvoiceVATStatus: "VAT_VAT",
    TaxpayerAggregateIdentifier: taxpayerAggregateIdentifier
  };

  executeCoreTaxFetch(tabId, context.authorization, payload, INPUT_INVOICE_VIEW_URL)
    .then((result) => {
      if (!result) {
        sendResponse({ success: false, message: "CoreTax tidak mengembalikan detail faktur." });
        return;
      }

      if (!result.ok) {
        sendResponse({
          success: false,
          status: result.status,
          message: "Request detail CoreTax gagal (" + result.status + " " + (result.statusText || "") + ").",
          response: result.data
        });
        return;
      }

      const rows = result.data?.Payload?.FormDataObj?.TransactionDetailsData?.Rows;
      if (!result.data?.IsSuccessful || !Array.isArray(rows) || rows.length === 0) {
        sendResponse({
          success: false,
          message: result.data?.Message || "Data rincian transaksi tidak tersedia.",
          response: result.data
        });
        return;
      }

      sendResponse({ success: true, response: result.data });
    })
    .catch((error) => {
      console.error("Gagal mengambil detail Faktur Masukan:", error);
      sendResponse({ success: false, message: error.message || String(error) });
    });

  return true;
});

importScripts("background-withholding.js");

// ============================================================
// Simpan PDF di fitur Multi Periode (Faktur Keluaran/Masukan)
// Pakai ulang authorization yang sudah tertangkap dari list API
// di atas — tidak ada webRequest listener baru yang dibutuhkan.
// ============================================================
const INVOICE_PDF_URL = "https://coretaxdjp.pajak.go.id/einvoiceportal/api/DownloadInvoice/download-invoice-document";

function decodeJwtPayload(authorizationHeader) {
  try {
    const token = String(authorizationHeader || "").replace(/^Bearer\s+/i, "");
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch (error) {
    console.warn("Gagal decode JWT payload:", error);
    return null;
  }
}

async function executeInvoicePdfFetch(tabId, authorization, body) {
  const injectionResults = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (endpoint, authHeader, requestBody) => {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify(requestBody)
      });

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const text = await response.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (_) {
          data = { rawText: text };
        }
        return { ok: response.ok, status: response.status, statusText: response.statusText, isJson: true, data };
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const chunkSize = 0x8000;
      let binary = "";
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        isJson: false,
        base64: btoa(binary),
        contentType
      };
    },
    args: [INVOICE_PDF_URL, authorization, body]
  });

  return injectionResults?.[0]?.result || null;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "fetchInvoicePdf") return;

  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) {
    sendResponse({ success: false, message: "Tab CoreTax tidak ditemukan." });
    return true;
  }

  const contexts = request.invoiceType === "input" ? inputInvoiceContexts : outputInvoiceContexts;
  const context = contexts.get(tabId);
  if (!context?.authorization) {
    sendResponse({
      success: false,
      code: "CONTEXT_NOT_CAPTURED",
      message: "Konteks API belum terbaca. Ubah filter/refresh tabel faktur sekali lalu coba lagi."
    });
    return true;
  }

  const claims = decodeJwtPayload(context.authorization);
  const body = {
    ...request.body,
    TaxpayerAggregateIdentifier: claims?.taxpayer_id || ""
  };

  executeInvoicePdfFetch(tabId, context.authorization, body)
    .then((result) => {
      if (!result) {
        sendResponse({ success: false, message: "CoreTax tidak mengembalikan hasil." });
        return;
      }

      if (!result.ok) {
        const detail = result.isJson
          ? (result.data?.Message || result.data?.title || JSON.stringify(result.data))
          : "";
        sendResponse({
          success: false,
          status: result.status,
          message: `Request PDF CoreTax gagal (${result.status} ${result.statusText || ""}).${detail ? " " + detail : ""}`.trim(),
          response: result.isJson ? result.data : null
        });
        return;
      }

      sendResponse({
        success: true,
        isJson: result.isJson,
        data: result.data,
        base64: result.base64,
        contentType: result.contentType
      });
    })
    .catch((error) => {
      console.error("Gagal mengambil PDF faktur multi periode:", error);
      sendResponse({ success: false, message: error.message || String(error) });
    });

  return true;
});
