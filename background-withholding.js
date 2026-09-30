// ============================================================
// Fitur Bukti Potong (Withholding Slips) Multi Periode
// Pola sama dengan Faktur Keluaran di atas.
// ============================================================
// Endpoint list bukti potong beda-beda per jenis (MP, BP21, BP23, BPPU, dst).
// Ditangkap generik berdasarkan pola URL, bukan nama endpoint yang di-hardcode.
const WITHHOLDING_SLIP_API_PATTERN = "https://coretaxdjp.pajak.go.id/withholdingslipsportal/api/*";
const WITHHOLDING_TAX_OBJECT_URL = "https://coretaxdjp.pajak.go.id/referencedata/api/maintenancereferencedata/list-tax-object-with-code-description";
const WITHHOLDING_BPPU_VIEW_URL = "https://coretaxdjp.pajak.go.id/withholdingslipsportal/api/viewebupotbpu";
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

function isWithholdingSlipListUrl(url) {
  return /\/withholdingslipsportal\/api\/(?:getebupot\w*issued|getmywithholdingslip)/i.test(url || "");
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== "POST" || details.tabId < 0) return;
    if (!isWithholdingSlipListUrl(details.url)) return;
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
    if (!isWithholdingSlipListUrl(details.url)) return;
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

  upsertFilter(filters, "TaxPeriodCode", periodCode);

  const payload = {
    ...base,
    First: first,
    Rows: rows,
    Filters: filters,
    LanguageId: base.LanguageId || "id-ID"
  };

  if (Object.hasOwn(base, "TaxPeriod")) {
    payload.TaxPeriod = `TD.007${String(periodCode).slice(0, 2)}`;
  }
  if (Object.hasOwn(base, "TaxYear")) {
    payload.TaxYear = String(periodCode).slice(-4);
  }

  executeCoreTaxFetch(tabId, context.authorization, payload, context.endpoint)
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "fetchBppuTaxObjects") return;

  const tabId = sender.tab?.id;
  const context = withholdingSlipContexts.get(tabId);
  const taxpayerAggregateIdentifier = context?.payloadTemplate?.TaxpayerAggregateIdentifier || "";
  if (!Number.isInteger(tabId) || !context?.authorization || !taxpayerAggregateIdentifier) {
    sendResponse({ success: false, message: "Konteks API Bupot BPPU belum terbaca." });
    return true;
  }

  executeCoreTaxFetch(tabId, context.authorization, {
    ReferenceDataType: "EBUPOTBPU_TAX_OBJECT",
    TaxpayerAggregateIdentifier: taxpayerAggregateIdentifier
  }, WITHHOLDING_TAX_OBJECT_URL)
    .then((result) => {
      if (!result?.ok || !result.data?.IsSuccessful || !Array.isArray(result.data?.Payload)) {
        sendResponse({
          success: false,
          status: result?.status,
          message: result?.data?.Message || "Referensi objek pajak BPPU tidak tersedia."
        });
        return;
      }
      sendResponse({ success: true, response: result.data });
    })
    .catch((error) => {
      console.error("Gagal mengambil referensi objek pajak BPPU:", error);
      sendResponse({ success: false, message: error.message || String(error) });
    });

  return true;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "fetchBppuDetail") return;

  const tabId = sender.tab?.id;
  const context = withholdingSlipContexts.get(tabId);
  const taxpayerAggregateIdentifier = context?.payloadTemplate?.TaxpayerAggregateIdentifier || "";
  const recordId = String(request.recordId || "");
  if (!Number.isInteger(tabId) || !context?.authorization || !taxpayerAggregateIdentifier || !recordId) {
    sendResponse({ success: false, message: "Konteks atau RecordId Bupot BPPU tidak tersedia." });
    return true;
  }

  executeCoreTaxFetch(tabId, context.authorization, {
    RecordId: recordId,
    IsMyWithholdingMenu: true,
    TaxpayerAggregateIdentifier: taxpayerAggregateIdentifier
  }, WITHHOLDING_BPPU_VIEW_URL)
    .then((result) => {
      const detail = result?.data?.Payload?.Result;
      if (!result?.ok || !result.data?.IsSuccessful || !detail) {
        sendResponse({
          success: false,
          status: result?.status,
          message: result?.data?.Message || "Detail Bupot BPPU tidak tersedia."
        });
        return;
      }
      sendResponse({ success: true, detail });
    })
    .catch((error) => {
      console.error("Gagal mengambil detail Bupot BPPU:", error);
      sendResponse({ success: false, message: error.message || String(error) });
    });

  return true;
});
