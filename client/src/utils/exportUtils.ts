import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportTableToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  extraMetadata?: { [key: string]: string }
) {
  const doc = new jsPDF();

  // Dairy Header
  doc.setFontSize(16);
  doc.setTextColor(20, 83, 45); // Deep green brand
  doc.text('MILKHUB — MILK COLLECTION & DAIRY CRM', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Precision Dairy Management • Developed by Gen Z Neural-X', 14, 24);

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 28, 196, 28);

  // Document Title
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(title.toUpperCase(), 14, 36);

  let currentY = 42;
  if (extraMetadata) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    Object.entries(extraMetadata).forEach(([k, v]) => {
      doc.text(`${k}: ${v}`, 14, currentY);
      currentY += 5;
    });
    currentY += 2;
  }

  // Render Table
  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [20, 83, 45], // Deep green
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount} | MilkHub | Developed by Gen Z Neural-X`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  doc.save(`${filename}.pdf`);
}

export function printWindow() {
  window.print();
}
