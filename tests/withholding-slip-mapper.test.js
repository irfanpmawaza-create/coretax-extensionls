const assert = require("node:assert/strict");
const mapBppuWithholdingSlipToExcelRow = require("../withholding-slip-mapper.js");

const row = mapBppuWithholdingSlipToExcelRow({
  WithholdingSlipsNumber: "2605A49WK",
  DocumentNumber: "inv/abc-01",
  EmployerName: "BPR DANA MITRA SEJAHTERA",
  EmployerNik: "0015050099523000",
  WithholdingSlipsDate: "2026-08-07T00:00:00+07:00",
  TaxObjectCode: "24-104-30",
  TaxBase: 65000,
  IncomeTax: 1300
}, {
  "24-104-30": "Jasa Perawatan Kendaraan dan/atau Alat Transportasi Darat, Laut dan Udara"
});

assert.deepEqual(row, {
  "Nomor": "2605A49WK",
  "Referensi": "INV/ABC-01",
  "Pemotong": "BPR DANA MITRA SEJAHTERA",
  "NPWP Pemotong": "0015050099523000",
  "Tanggal": "07/08/2026",
  "Kode Objek Pajak": "24-104-30",
  "DPP": 65000,
  "PPh 23": 1300,
  "Objek Pajak": "Jasa Perawatan Kendaraan dan/atau Alat Transportasi Darat, Laut dan Udara"
});
assert.equal(mapBppuWithholdingSlipToExcelRow({ DocumentNumber: null }).Referensi, "");

console.log("withholding-slip-mapper: ok");
