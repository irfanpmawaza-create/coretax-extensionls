const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const css = fs.readFileSync(path.join(root, "toolbar.css"), "utf8");

assert(manifest.content_scripts[0].css.includes("toolbar.css"));
assert(manifest.content_scripts[0].js.includes("withholding-slip-mapper.js"));
assert.match(content, /aria-expanded/);
assert.match(content, /aria-live/);
assert.match(content, /keepToolbarInViewport/);
assert.match(content, /coretax-result-dialog/);
assert.match(content, /showPopupMessage\(message, failedDocuments\.length > 0 \? "warning" : "success"\)/);
assert.match(css, /width:\s*min\(220px, calc\(100vw - 24px\)\)/);
assert.match(css, /\.coretax-toolbar__button\s*\{[\s\S]*?width:\s*100%/);
assert.match(css, /animation:\s*coretax-result-blink/);
assert.match(content, /EInvoiceMenuType: invoiceType === "input" \? "Input" : "Outgoing"/);
assert.match(content, /DocumentDate: item\.LastUpdatedDate \|\| ""/);
assert.match(content, /AmendedDocumentFormAggregateIdentifier/);
assert.match(content, /CanceledDocumentFormAggregateIdentifier/);
assert.match(content, /fetchAllWithholdingSlipsForMonth[\s\S]*?first \+= data\.length/);
assert.match(content, /fetchBppuTaxObjectDescriptions/);
assert.match(content, /fetchBppuDetailsForItems/);
assert.match(background, /getmywithholdingslip/);
assert.match(background, /viewebupotbpu/);
assert.match(background, /Payload\?\.Result/);
assert.doesNotMatch(content, /EInvoiceMenuType:[^\n]*"Incoming"/);
assert.doesNotMatch(content, /169\.236px/);

console.log("toolbar-ui: ok");
