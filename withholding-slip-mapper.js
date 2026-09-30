(function (root, factory) {
  const mapWithholdingSlipToExcelRow = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = mapWithholdingSlipToExcelRow;
  }
  if (root) {
    root.mapBppuWithholdingSlipToExcelRow = mapWithholdingSlipToExcelRow;
  }
})(typeof window !== "undefined" ? window : globalThis, () => {
  const formatDate = (value) => {
    if (!value) return "";
    const datePart = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return datePart ? `${datePart[3]}/${datePart[2]}/${datePart[1]}` : String(value);
  };

  return function mapBppuWithholdingSlipToExcelRow(item, taxObjectDescriptions = {}) {
    return {
      "Nomor": item?.WithholdingSlipsNumber || "",
      "Referensi": String(item?.DocumentNumber || "").toUpperCase(),
      "Pemotong": item?.EmployerName || "",
      "NPWP Pemotong": item?.EmployerNik || "",
      "Tanggal": formatDate(item?.WithholdingSlipsDate),
      "Kode Objek Pajak": item?.TaxObjectCode || "",
      "DPP": item?.TaxBase ?? null,
      "PPh 23": item?.IncomeTax ?? null,
      "Objek Pajak": taxObjectDescriptions[item?.TaxObjectCode] || ""
    };
  };
});
