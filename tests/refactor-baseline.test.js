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

async function assertPagination(methodName, fetchMethodName) {
  const { app } = loadContentApp();
  const calls = [];
  const firstPage = Array.from({ length: 50 }, (_, index) => ({ RecordId: `id-${index}` }));
  const secondPage = [{ RecordId: "id-49" }, { RecordId: "id-50" }];
  app[fetchMethodName] = async (request) => {
    calls.push(request);
    return request.first === 0
      ? { TotalRecords: 52, Data: firstPage }
      : { TotalRecords: 52, Data: secondPage };
  };

  const rows = await app[methodName](2, 2026);
  assert.equal(rows.length, 51);
  assert.deepEqual(calls.map(({ periodCode, year, first, rows: pageSize }) => (
    { periodCode, year, first, pageSize }
  )), [
    { periodCode: "TD.00702", year: 2026, first: 0, pageSize: 50 },
    { periodCode: "TD.00702", year: 2026, first: 50, pageSize: 50 }
  ]);
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
  return entries.find(({ filter }) => filter.urls.includes(url)).listener;
}

function sendRuntimeMessage(listeners, request, tabId) {
  return new Promise((resolve, reject) => {
    for (const listener of listeners) {
      if (listener(request, { tab: { id: tabId } }, resolve) === true) return;
    }
    reject(new Error(`Tidak ada listener untuk ${request.action}`));
  });
}

(async () => {
  await assertPagination("fetchAllOutputInvoicesForMonth", "fetchOutputInvoicePage");
  await assertPagination("fetchAllInputInvoicesForMonth", "fetchInputInvoicePage");

  const { app, sandbox } = loadContentApp();
  sandbox.location.hostname = "coretaxdjp.pajak.go.id";
  sandbox.location.pathname = "/e-invoice-portal/";
  await assert.rejects(
    app.downloadMultiPeriodInvoices({ year: 2019, startMonth: 1, endMonth: 1 }),
    /Tahun tidak valid/
  );
  await assert.rejects(
    app.downloadMultiPeriodInputInvoices({ year: 2026, startMonth: 3, endMonth: 2 }),
    /Rentang bulan tidak valid/
  );

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
  const endpoint = "https://coretaxdjp.pajak.go.id/einvoiceportal/api/outputinvoice/list";
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
    tabId: 7,
    requestBody: { raw: [{ bytes }] }
  });
  listenerFor(background.beforeHeaders, endpoint)({
    method: "POST",
    tabId: 7,
    requestHeaders: [{ name: "Authorization", value: "Bearer token" }]
  });

  const response = await sendRuntimeMessage(background.runtimeListeners, {
    action: "fetchOutputInvoicesPage",
    periodCode: "TD.00702",
    year: 2026,
    first: 50,
    rows: 25
  }, 7);
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

  console.log("refactor-baseline: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
