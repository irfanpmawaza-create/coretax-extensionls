const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
const multiPeriod = fs.readFileSync(path.join(root, "content-multi-period.js"), "utf8");
const contentScripts = `${content}\n${multiPeriod}`;
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const backgroundWithholding = fs.readFileSync(path.join(root, "background-withholding.js"), "utf8");
const backgroundScripts = `${background}\n${backgroundWithholding}`;
const popup = fs.readFileSync(path.join(root, "popup.js"), "utf8");
const popupHtml = fs.readFileSync(path.join(root, "popup.html"), "utf8");
const css = fs.readFileSync(path.join(root, "toolbar.css"), "utf8");

assert(manifest.content_scripts[0].css.includes("toolbar.css"));
assert(manifest.content_scripts[0].js.includes("withholding-slip-mapper.js"));
assert(manifest.content_scripts[0].js.includes("content-multi-period.js"));
assert(manifest.content_scripts[0].js.indexOf("content-multi-period.js") < manifest.content_scripts[0].js.indexOf("content.js"));
for (const file of manifest.content_scripts[0].js) {
  assert(fs.existsSync(path.join(root, file)), `Content script tidak ditemukan: ${file}`);
}
assert.match(popup, /"withholding-slip-mapper\.js",\s*"content-multi-period\.js",\s*"content\.js"/);
assert.match(popupHtml, /id="multi-invoice-type"[\s\S]*?value="output"[\s\S]*?value="input"/);
assert.match(popup, /invoiceType,\s*year/);
assert.match(popup, /multiInvoiceType\.disabled = isLoading/);
assert(fs.existsSync(path.join(root, "background-downloads.js")));
assert(fs.existsSync(path.join(root, "background-withholding.js")));
assert.match(content, /aria-expanded/);
assert.match(content, /aria-live/);
assert.match(content, /Highlight Duplikat/);
assert.match(content, /toggleDuplicateHighlights/);
assert.match(content, /keepToolbarInViewport/);
assert.match(content, /coretax-result-dialog/);
assert.match(content, /showPopupMessage\(message, failedDocuments\.length > 0 \? "warning" : "success"\)/);
assert.match(css, /width:\s*min\(220px, calc\(100vw - 24px\)\)/);
assert.match(css, /\.coretax-toolbar__button\s*\{[\s\S]*?width:\s*100%/);
assert.match(css, /animation:\s*coretax-result-blink/);
assert.match(css, /\.coretax-duplicate-row/);
assert.match(css, /\.coretax-duplicate-cell/);
assert.match(contentScripts, /EInvoiceMenuType: invoiceType === "input" \? "Input" : "Outgoing"/);
assert.match(contentScripts, /DocumentDate: item\.LastUpdatedDate \|\| ""/);
assert.match(contentScripts, /AmendedDocumentFormAggregateIdentifier/);
assert.match(contentScripts, /CanceledDocumentFormAggregateIdentifier/);
assert.match(contentScripts, /fetchAllWithholdingSlipsForMonth[\s\S]*?first \+= data\.length/);
assert.match(contentScripts, /fetchBppuTaxObjectDescriptions/);
assert.match(contentScripts, /fetchBppuDetailsForItems/);
assert.match(background, /importScripts\("background-downloads\.js"\)/);
assert.match(background, /importScripts\("background-withholding\.js"\)/);
assert.match(backgroundScripts, /getmywithholdingslip/);
assert.match(backgroundScripts, /viewebupotbpu/);
assert.match(backgroundScripts, /Payload\?\.Result/);
assert.doesNotMatch(contentScripts, /EInvoiceMenuType:[^\n]*"Incoming"/);
assert.doesNotMatch(content, /169\.236px/);

console.log("toolbar-ui: ok");
