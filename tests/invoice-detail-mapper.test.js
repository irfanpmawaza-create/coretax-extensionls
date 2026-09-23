const assert = require("node:assert/strict");
const mapOutputInvoiceDetailRows = require("../invoice-detail-mapper.js");

const listItem = {
  TaxInvoiceNumber: "04002600388170303",
  TaxInvoiceDate: "2026-09-15T00:00:00+07:00",
  BuyerTIN: "0287689574402000",
  BuyerTaxpayerNameClear: "HARSINDO UTAMA PANGAN"
};

const formDataObj = {
  TransactionDocumentData: {
    TaxInvoiceNumber: "04002600388170303",
    InvoiceDate: "2026-09-15T00:00:00",
    TransactionCode: "TD.00304",
    Reference: "119.GA.HUP0.INV21.0926"
  },
  BuyerInformationData: {
    BuyerTIN: "0287689574402000",
    IDDocumentNumber: "DOC-001",
    BuyerTaxpayerNameInClear: "HARSINDO UTAMA PANGAN",
    BuyerTaxpayerAddress: "PERGUDANGAN BANDARA MAS",
    BuyerTaxpayerEmail: "finance@example.com"
  },
  TransactionDetailsData: {
    Rows: [{
      Type: "SERVICES",
      Code: "150202",
      Name: "Jasa akuntansi dan pembukuan",
      Quantity: 1,
      UnitPrice: 8500000,
      TotalPrice: 8500000,
      Discount: 0,
      TaxBase: 8500000,
      OtherTaxBase: 7791667,
      VATRate: 0.12,
      VAT: 935000.0399999999,
      STLGRate: 0,
      STLG: 0
    }]
  }
};

const rows = mapOutputInvoiceDetailRows(listItem, formDataObj, "04002600388170303_HARSINDO_Sep2026.pdf");
assert.equal(rows.length, 1);
assert.equal(rows[0].File, "04002600388170303_HARSINDO_Sep2026.pdf");
assert.equal(rows[0]["Nomor Faktur Pajak"], "04002600388170303");
assert.equal(rows[0]["Tanggal Faktur"], "15/09/2026");
assert.equal(rows[0]["Kode Transaksi"], "TD.00304");
assert.equal(rows[0]["Referensi"], "119.GA.HUP0.INV21.0926");
assert.equal(rows[0]["Tipe Barang/Jasa"], "SERVICES");
assert.equal(rows[0]["Kode Barang/Jasa"], "150202");
assert.equal(rows[0]["Nama Barang/Jasa"], "Jasa akuntansi dan pembukuan");
assert.equal(rows[0]["Nomor Dokumen"], "DOC-001");
assert.equal(rows[0]["Email"], "finance@example.com");
assert.equal(rows[0]["Jumlah Barang Jasa"], 1);
assert.equal(rows[0]["DPP Lain"], 7791667);
assert.equal(rows[0]["Tarif PPN"], 12);
assert.equal(rows[0]["PPN"], 935000);
assert.equal(rows[0]["Tarif PPnBM"], 0);
assert.equal(rows[0]["PPnBM"], 0);
assert.equal(rows[0]["Potongan Harga"], 0);

const exportedRows = rows.map(({ File, ...row }) => row);
assert.equal(Object.hasOwn(exportedRows[0], "File"), false);
assert.equal(rows[0].File, "04002600388170303_HARSINDO_Sep2026.pdf");

const twoRows = mapOutputInvoiceDetailRows(listItem, {
  ...formDataObj,
  TransactionDetailsData: {
    Rows: [
      formDataObj.TransactionDetailsData.Rows[0],
      { TransactionCode: "TD.00307", Type: "SERVICES", Code: "150203", Name: "Jasa kedua", Quantity: 2.5, UnitPrice: 500000, TotalPrice: 1250000, Discount: 50000, TaxBase: 1200000, OtherTaxBase: 1100000, VATRate: 0.11, VAT: 132000, STLGRate: 0.2, STLG: 220000 }
    ]
  }
}, "detail.pdf");

assert.equal(twoRows.length, 2);
assert.equal(twoRows[1]["Kode Transaksi"], "TD.00307");
assert.equal(twoRows[1]["Tipe Barang/Jasa"], "SERVICES");
assert.equal(twoRows[1]["Kode Barang/Jasa"], "150203");
assert.equal(twoRows[1]["Harga Satuan"], 500000);
assert.equal(twoRows[1]["Jumlah Barang Jasa"], 2.5);
assert.equal(twoRows[1]["Potongan Harga"], 50000);
assert.equal(twoRows[1]["DPP"], 1200000);
assert.equal(twoRows[1]["DPP Lain"], 1100000);
assert.equal(twoRows[1]["Tarif PPN"], 11);
assert.equal(twoRows[1]["PPN"], 132000);
assert.equal(twoRows[1]["Tarif PPnBM"], 20);
assert.equal(twoRows[1]["PPnBM"], 220000);

const nullMoney = mapOutputInvoiceDetailRows(listItem, {
  ...formDataObj,
  TransactionDetailsData: {
    Rows: [{ Name: "Nilai kosong", Quantity: null, UnitPrice: null, TotalPrice: null, Discount: 0, TaxBase: null, OtherTaxBase: null, VATRate: null, VAT: null, STLGRate: null, STLG: null }]
  }
}, "detail.pdf")[0];
assert.equal(nullMoney["Harga Satuan"], null);
assert.equal(nullMoney["Jumlah Barang Jasa"], null);
assert.equal(nullMoney["Potongan Harga"], 0);
assert.equal(nullMoney["DPP"], null);
assert.equal(nullMoney["DPP Lain"], null);
assert.equal(nullMoney["Tarif PPN"], null);
assert.equal(nullMoney["PPN"], null);
assert.equal(nullMoney["Tarif PPnBM"], null);
assert.equal(nullMoney["PPnBM"], null);

assert.throws(
  () => mapOutputInvoiceDetailRows(listItem, { ...formDataObj, TransactionDetailsData: { Rows: [] } }, "detail.pdf"),
  /tidak tersedia/
);

console.log("invoice-detail-mapper: ok");
