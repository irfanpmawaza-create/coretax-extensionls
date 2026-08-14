class CoreTaxExcelExporter {
  export(rows, fileName = "PPN_hasil_ekstrak.xlsx", sheetName = "PPN") {
    if (!window.XLSX) {
      throw new Error("Library SheetJS belum tersedia. Pastikan libs/xlsx.full.min.js sudah ada.");
    }

    if (!rows || rows.length === 0) {
      throw new Error("Tidak ada data yang dapat diekspor ke Excel.");
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = this.buildColumnWidths(rows);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const excelArray = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array"
    });

    const blob = new Blob([excelArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    this.downloadBlob(blob, fileName);
  }

  buildColumnWidths(rows) {
    const keys = Object.keys(rows[0] || {});
    return keys.map((key) => {
      const maxLength = rows.reduce((max, row) => {
        const value = row[key] == null ? "" : String(row[key]);
        return Math.max(max, value.length);
      }, key.length);

      return { wch: Math.min(Math.max(maxLength + 2, 12), 60) };
    });
  }

  downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

window.CoreTaxExcelExporter = CoreTaxExcelExporter;
