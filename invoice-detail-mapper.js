(function (root, factory) {
  const mapOutputInvoiceDetailRows = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = mapOutputInvoiceDetailRows;
  }
  if (root) {
    root.mapOutputInvoiceDetailRows = mapOutputInvoiceDetailRows;
  }
})(typeof window !== "undefined" ? window : globalThis, () => {
  const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();

  const roundMoney = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : null;
  };

  const roundToTwoDecimals = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
  };

  const rateAsPercent = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const rate = Number(value);
    return Number.isFinite(rate) ? Math.round(rate * 10000) / 100 : null;
  };

  const formatDate = (value) => {
    if (!value) return "";

    const datePart = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (datePart) return `${datePart[3]}/${datePart[2]}/${datePart[1]}`;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${date.getFullYear()}`;
  };

  return function mapOutputInvoiceDetailRows(listItem, formDataObj, fileName) {
    const documentData = formDataObj?.TransactionDocumentData;
    const buyerData = formDataObj?.BuyerInformationData;
    const detailRows = formDataObj?.TransactionDetailsData?.Rows;

    if (!documentData || !buyerData || !Array.isArray(detailRows) || detailRows.length === 0) {
      throw new Error("Data rincian transaksi tidak tersedia.");
    }

    const invoiceNumber = documentData.TaxInvoiceNumber || listItem?.TaxInvoiceNumber || "";
    const invoiceDate = documentData.InvoiceDate || listItem?.TaxInvoiceDate || "";
    const buyerName = buyerData.BuyerTaxpayerNameInClear
      || buyerData.BuyerTaxpayerName
      || listItem?.BuyerTaxpayerNameClear
      || listItem?.BuyerName
      || "";

    return detailRows.map((row) => ({
      "File": fileName || "",
      "Nomor Faktur Pajak": cleanText(invoiceNumber).replace(/[^0-9]/g, ""),
      "Tanggal Faktur": formatDate(invoiceDate),
      "Kode Transaksi": cleanText(row?.TransactionCode || documentData.TransactionCode),
      "Referensi": cleanText(documentData.Reference),
      "Tipe Barang/Jasa": cleanText(row?.Type),
      "Kode Barang/Jasa": cleanText(row?.Code),
      "Nama Barang/Jasa": cleanText(row?.Name || row?.Code),
      "Lawan Transaksi": cleanText(buyerName),
      "NPWP Lawan Transaksi": cleanText(buyerData.BuyerTIN || listItem?.BuyerTIN).replace(/[^0-9]/g, ""),
      "Nomor Dokumen": cleanText(buyerData.IDDocumentNumber),
      "Alamat Lawan Transaksi": cleanText(buyerData.BuyerTaxpayerAddress),
      "Email": cleanText(buyerData.BuyerTaxpayerEmail),
      "Harga Satuan": roundMoney(row?.TotalPrice),
      "Jumlah Barang Jasa": roundToTwoDecimals(row?.Quantity),
      "Potongan Harga": roundMoney(row?.Discount),
      "DPP": roundMoney(row?.TaxBase),
      "DPP Lain": roundMoney(row?.OtherTaxBase),
      "Tarif PPN": rateAsPercent(row?.VATRate),
      "PPN": roundMoney(row?.VAT),
      "Tarif PPnBM": rateAsPercent(row?.STLGRate),
      "PPnBM": roundMoney(row?.STLG),
      "Catatan": ""
    }));
  };
});
