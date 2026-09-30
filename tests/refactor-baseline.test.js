const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function loadContentApp() {
  const listeners = [];
  const sandbox = {
    Blob,
    URL,
    Uint8Array,
    atob,
    clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    document: { querySelectorAll: () => [] },
    setTimeout,
    chrome: {
      runtime: {
        getURL: (value) => value,
        lastError: null,
        onMessage: { addListener: (listener) => listeners.push(listener) }
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.location = {
    hostname: "example.invalid",
    pathname: "/",
    href: "https://example.invalid/"
  };
  sandbox.CoreTaxPdfExtractor = class {};
  sandbox.CoreTaxExcelExporter = class {};

  const source = fs.readFileSync(path.join(root, "content.js"), "utf8")
    .replace("new CoreTaxPDFDownloaderV3();", "globalThis.coreTaxApp = new CoreTaxPDFDownloaderV3();");
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  return { app: sandbox.coreTaxApp, sandbox };
}

async function assertPagination(invoiceType) {
  const { app } = loadContentApp();
  const calls = [];
  const firstPage = Array.from({ length: 50 }, (_, index) => ({ RecordId: `id-${index}` }));
  const secondPage = [{ RecordId: "id-49" }, { RecordId: "id-50" }];
  app.fetchInvoicePage = async (type, request) => {
    assert.equal(type, invoiceType);
    calls.push(request);
    return request.first === 0
      ? { TotalRecords: 52, Data: firstPage }
      : { TotalRecords: 52, Data: secondPage };
  };

  const rows = await app.fetchAllInvoicesForMonth(invoiceType, 2, 2026);
  assert.equal(rows.length, 51);
  assert.deepEqual(calls.map(({ periodCode, year, first, rows: pageSize }) => (
    { periodCode, year, first, pageSize }
  )), [
    { periodCode: "TD.00702", year: 2026, first: 0, pageSize: 50 },
    { periodCode: "TD.00702", year: 2026, first: 50, pageSize: 50 }
  ]);
}

async function assertSummaryExport(invoiceType, expectedFileName) {
  const { app, sandbox } = loadContentApp();
  const exports = [];
  sandbox.location.hostname = "coretaxdjp.pajak.go.id";
  sandbox.location.pathname = "/e-invoice-portal/";
  app.fetchAllInvoicesForMonth = async (type, month, year) => {
    assert.equal(type, invoiceType);
    assert.equal(month, 2);
    assert.equal(year, 2026);
    return [{ RecordId: `${type}-1`, TaxInvoicePeriod: "TD.00702", TaxInvoiceYear: year }];
  };
  app.excelExporter = { export: (...args) => exports.push(args) };
  app.showFinalNotification = () => {};

  const result = await app.downloadMultiPeriodInvoices({ invoiceType, year: 2026, startMonth: 2, endMonth: 2 });
  assert.equal(result.fileName, expectedFileName);
  assert.equal(exports[0][1], expectedFileName);
  assert.equal(exports[0][2], "output");
}

function loadBackground() {
  const runtimeListeners = [];
  const beforeRequests = [];
  const beforeHeaders = [];
  const scriptCalls = [];
  const event = () => ({ addListener() {} });
  const sandbox = {
    TextDecoder,
    Uint8Array,
    atob,
    btoa,
    clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    chrome: {
      downloads: {
        erase() {},
        onCreated: event(),
        onDeterminingFilename: event(),
        removeFile() {},
        search() {}
      },
      runtime: {
        lastError: null,
        onMessage: { addListener: (listener) => runtimeListeners.push(listener) }
      },
      scripting: {
        executeScript: async (options) => {
          scriptCalls.push(options);
          return [{ result: { ok: true, status: 200, statusText: "OK", data: { IsSuccessful: true, Payload: {} } } }];
        }
      },
      webRequest: {
        onBeforeRequest: {
          addListener: (listener, filter) => beforeRequests.push({ listener, filter })
        },
        onBeforeSendHeaders: {
          addListener: (listener, filter) => beforeHeaders.push({ listener, filter })
        }
      }
    }
  };

  vm.runInNewContext(fs.readFileSync(path.join(root, "background.js"), "utf8"), sandbox, {
    filename: "background.js"
  });
  return { beforeHeaders, beforeRequests, runtimeListeners, scriptCalls };
}

function listenerFor(entries, url) {
  return entries.find(({ filter }) => filter.urls.some((pattern) => (
    pattern === url || (pattern.endsWith("*") && url.startsWith(pattern.slice(0, -1)))
  ))).listener;
}

function sendRuntimeMessage(listeners, request, tabId) {
  return new Promise((resolve, reject) => {
    for (const listener of listeners) {
      if (listener(request, { tab: { id: tabId } }, resolve) === true) return;
    }
    reject(new Error(`Tidak ada listener untuk ${request.action}`));
  });
}

async function assertInvoicePayload(background, { endpoint, action, tabId }) {
  const template = {
    Filters: [
      { PropertyName: "TaxInvoicePeriod", Value: ["TD.00701"] },
      { PropertyName: "TaxInvoiceYear", Value: "2025" }
    ],
    LanguageId: "id-ID",
    Untouched: "keep"
  };
  const bytes = new TextEncoder().encode(JSON.stringify(template)).buffer;
  listenerFor(background.beforeRequests, endpoint)({
    method: "POST",
    tabId,
    requestBody: { raw: [{ bytes }] }
  });
  listenerFor(background.beforeHeaders, endpoint)({
    method: "POST",
    tabId,
    requestHeaders: [{ name: "Authorization", value: "Bearer token" }]
  });

  const response = await sendRuntimeMessage(background.runtimeListeners, {
    action,
    periodCode: "TD.00702",
    year: 2026,
    first: 50,
    rows: 25
  }, tabId);
  assert.equal(response.success, true);

  const [calledEndpoint, authorization, payload] = background.scriptCalls.at(-1).args;
  assert.equal(calledEndpoint, endpoint);
  assert.equal(authorization, "Bearer token");
  assert.equal(payload.First, 50);
  assert.equal(payload.Rows, 25);
  assert.equal(payload.Untouched, "keep");
  assert.deepEqual(JSON.parse(JSON.stringify(payload.Filters)), [
    { PropertyName: "TaxInvoicePeriod", Value: ["TD.00702"] },
    { PropertyName: "TaxInvoiceYear", Value: "2026" }
  ]);
  assert.equal(template.Filters[0].Value[0], "TD.00701");
}

async function assertWithholdingPayload(background) {
  const endpoint = "https://coretaxdjp.pajak.go.id/withholdingslipsportal/api/getmywithholdingslip";
  const template = {
    Filters: [{ PropertyName: "TaxPeriodCode", Value: ["01012026"] }],
    TaxPeriod: "TD.00701",
    TaxYear: "2025"
  };
  const bytes = new TextEncoder().encode(JSON.stringify(template)).buffer;
  listenerFor(background.beforeRequests, endpoint)({
    method: "POST",
    tabId: 9,
    url: endpoint,
    requestBody: { raw: [{ bytes }] }
  });
  listenerFor(background.beforeHeaders, endpoint)({
    method: "POST",
    tabId: 9,
    url: endpoint,
    requestHeaders: [{ name: "Authorization", value: "Bearer bupot" }]
  });

  const response = await sendRuntimeMessage(background.runtimeListeners, {
    action: "fetchWithholdingSlipsPage",
    periodCode: "02022026",
    first: 50,
    rows: 25
  }, 9);
  assert.equal(response.success, true);

  const [calledEndpoint, authorization, payload] = background.scriptCalls.at(-1).args;
  assert.equal(calledEndpoint, endpoint);
  assert.equal(authorization, "Bearer bupot");
  assert.equal(payload.TaxPeriod, "TD.00702");
  assert.equal(payload.TaxYear, "2026");
  assert.equal(payload.Filters[0].Value, "02022026");
  assert.equal(template.Filters[0].Value[0], "01012026");
}

(async () => {
  await assertPagination("output");
  await assertPagination("input");
  await assertSummaryExport("output", "Faktur_Keluaran_2026_Feb.xlsx");
  await assertSummaryExport("input", "Faktur_Masukan_2026_Feb.xlsx");

  const { app, sandbox } = loadContentApp();
  sandbox.location.hostname = "coretaxdjp.pajak.go.id";
  sandbox.location.pathname = "/e-invoice-portal/";
  await assert.rejects(
    app.downloadMultiPeriodInvoices({ year: 2019, startMonth: 1, endMonth: 1 }),
    /Tahun tidak valid/
  );
  await assert.rejects(
    app.downloadMultiPeriodInvoices({ invoiceType: "input", year: 2026, startMonth: 3, endMonth: 2 }),
    /Rentang bulan tidak valid/
  );

  const actions = [];
  app.sendMessageToBackground = async (request) => {
    actions.push(request.action);
    return { success: true, response: { IsSuccessful: true, Payload: {} } };
  };
  const pageRequest = { periodCode: "TD.00702", year: 2026, first: 0, rows: 50 };
  await app.fetchInvoicePage("output", pageRequest);
  await app.fetchInvoicePage("input", pageRequest);
  assert.deepEqual(actions, ["fetchOutputInvoicesPage", "fetchInputInvoicesPage"]);

  const invoice = {
    TaxInvoicePeriod: "TD.00709",
    TaxInvoiceYear: 2026,
    TaxInvoiceNumber: "040.026",
    BuyerTaxpayerNameClear: "PT A/B",
    SellerTaxpayerName: "CV C:D"
  };
  assert.equal(app.buildInvoicePdfFileName(invoice, "output"), "040.026_PT_AB_Sep2026.pdf");
  assert.equal(app.buildInvoicePdfFileName(invoice, "input"), "040.026_CV_CD_Sep2026.pdf");

  const background = loadBackground();
  await assertInvoicePayload(background, {
    endpoint: "https://coretaxdjp.pajak.go.id/einvoiceportal/api/outputinvoice/list",
    action: "fetchOutputInvoicesPage",
    tabId: 7
  });
  await assertInvoicePayload(background, {
    endpoint: "https://coretaxdjp.pajak.go.id/einvoiceportal/api/inputinvoice/list",
    action: "fetchInputInvoicesPage",
    tabId: 8
  });
  await assertWithholdingPayload(background);

  console.log("refactor-baseline: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
