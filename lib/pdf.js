import jsPDF from "jspdf";
import { generateQRCode } from "./qr";

const A4_LAYOUT = {
  marginX: 10, marginY: 10, labelWidth: 92.5, labelHeight: 50,
  columnGap: 5, rowGap: 4, columns: 2, rows: 5,
};

const LABELS_PER_PAGE = A4_LAYOUT.columns * A4_LAYOUT.rows;

function cleanText(value, fallback = "-") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function drawLabel(pdf, product, x, y, qrImage) {
  const { labelWidth: width, labelHeight: height } = A4_LAYOUT;
  const padding = 4;
  const qrSize = 28;
  const textX = x + padding + qrSize + 4;
  const textWidth = width - (textX - x) - padding;

  pdf.setDrawColor(202, 195, 216);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(x, y, width, height, 3, 3, "FD");
  pdf.setTextColor(99, 44, 229);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("VERTICE", x + width / 2, y + 6, { align: "center", charSpace: 1.2 });
  pdf.addImage(qrImage, "PNG", x + padding, y + 11, qrSize, qrSize);

  pdf.setTextColor(21, 28, 39);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.text(pdf.splitTextToSize(cleanText(product.name, "Ürün"), textWidth).slice(0, 2), textX, y + 16);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(`QR: ${cleanText(product.qrNo)}`, textX, y + 29, { maxWidth: textWidth });
  if (product.shelfLocation) pdf.text(`Raf: ${cleanText(product.shelfLocation)}`, textX, y + 35, { maxWidth: textWidth });

  pdf.setDrawColor(231, 238, 254);
  pdf.line(x + padding, y + height - 8, x + width - padding, y + height - 8);
  pdf.setTextColor(108, 105, 136);
  pdf.setFontSize(5.8);
  pdf.text("Vertice Stok Yönetim Sistemi", x + width / 2, y + height - 4, { align: "center" });
}

export async function createPDF(products = []) {
  if (!Array.isArray(products) || products.length === 0) throw new Error("PDF_LABELS_NOT_FOUND");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

  for (let index = 0; index < products.length; index += 1) {
    if (index > 0 && index % LABELS_PER_PAGE === 0) pdf.addPage("a4", "portrait");
    const pageIndex = index % LABELS_PER_PAGE;
    const column = pageIndex % A4_LAYOUT.columns;
    const row = Math.floor(pageIndex / A4_LAYOUT.columns);
    const x = A4_LAYOUT.marginX + column * (A4_LAYOUT.labelWidth + A4_LAYOUT.columnGap);
    const y = A4_LAYOUT.marginY + row * (A4_LAYOUT.labelHeight + A4_LAYOUT.rowGap);
    drawLabel(pdf, products[index], x, y, await generateQRCode(products[index].id));
  }

  pdf.save(`Vertice-Etiket-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export { A4_LAYOUT, LABELS_PER_PAGE };
