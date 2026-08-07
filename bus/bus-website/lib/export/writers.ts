import {
  formatDateTime,
  reportFileBase,
  type CollegeReport,
} from "./collegeReport";

// Both writers import their library lazily so neither ends up in the dashboard's
// initial bundle — they only load when someone actually exports.

// Excel caps sheet names at 31 characters and rejects : \ / ? * [ ]
function sheetName(key: string): string {
  return key.replace(/[:\\/?*[\]]/g, "-").slice(0, 31);
}

export async function downloadExcel(report: CollegeReport): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  for (const section of report.sections) {
    const aoa = [section.columns, ...section.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Rough auto-fit: widest cell in each column, clamped so one long address
    // doesn't blow the sheet out.
    ws["!cols"] = section.columns.map((col, i) => {
      const longest = section.rows.reduce(
        (max, row) => Math.max(max, String(row[i] ?? "").length),
        col.length
      );
      return { wch: Math.min(Math.max(longest + 2, 10), 45) };
    });
    XLSX.utils.book_append_sheet(wb, ws, sheetName(section.key));
  }

  XLSX.writeFile(wb, `${reportFileBase(report)}.xlsx`);
}

export async function downloadPdf(report: CollegeReport): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  // Landscape — several sections have 8 columns.
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text(report.college.name, 40, 46);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(
    `${report.college.code} · ${report.college.address}`,
    40,
    64
  );
  doc.text(`Generated ${formatDateTime(report.generatedAt)}`, 40, 80);
  doc.setTextColor(0);

  let cursorY = 104;

  report.sections.forEach((section, index) => {
    if (index > 0) {
      doc.addPage();
      cursorY = 48;
    }

    doc.setFontSize(13);
    doc.text(section.title, 40, cursorY);
    cursorY += 10;

    autoTable(doc, {
      startY: cursorY,
      head: [section.columns],
      body: section.rows.map((r) => r.map((c) => String(c ?? ""))),
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [26, 29, 41], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 246, 236] },
      margin: { left: 40, right: 40, bottom: 40 },
    });
  });

  // Page numbers, added last so the total is known.
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Page ${i} of ${total}`,
      pageWidth - 40,
      doc.internal.pageSize.getHeight() - 20,
      { align: "right" }
    );
  }

  doc.save(`${reportFileBase(report)}.pdf`);
}
