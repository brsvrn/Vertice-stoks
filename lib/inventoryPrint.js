import jsPDF from "jspdf";
import "jspdf-autotable";
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR").format(Number(value || 0));
}

export async function printInventoryTable(rows = [], mode = "current") {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("INVENTORY_TABLE_EMPTY");
  }

  const isCountSheet = mode === "count";
  const title = isCountSheet ? "Stok Sayım Formu" : "Güncel Stok Tablosu";
  const generatedAt = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const doc = new jsPDF({ orientation: "portrait" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Envantra - ${title}`, 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Olusturulma: ${generatedAt}`, 14, 28);
  doc.text(`Toplam urun: ${rows.length}`, 14, 34);

  const tableHead = isCountSheet
    ? [["#", "Barkod", "Urun Adi", "Depo Stok", "Bar Stok", "Toplam", "Sayim"]]
    : [["#", "Barkod", "Urun Adi", "Depo Stok", "Bar Stok", "Toplam"]];

  const tableBody = rows.map((row, index) => {
    const data = [
      index + 1,
      row.barcode || "-",
      row.name || "-",
      formatNumber(row.depotStock),
      formatNumber(row.barStock),
      formatNumber(row.totalStock),
    ];
    if (isCountSheet) data.push("");
    return data;
  });

  doc.autoTable({
    startY: 40,
    head: tableHead,
    body: tableBody,
    theme: "striped",
    headStyles: { fillColor: [36, 58, 155] },
    styles: { fontSize: 9, cellPadding: 3, font: "helvetica" },
  });

  const fileName = `Envantra-${isCountSheet ? "Sayim" : "Stok"}-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (typeof window !== "undefined" && window.Capacitor?.isNative) {
    try {
      const base64Str = doc.output("datauristring").split(',')[1];
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Str,
        directory: Directory.Cache,
      });
      await Share.share({
        title: title,
        url: result.uri,
        dialogTitle: 'Tabloyu Kaydet veya Paylaş',
      });
    } catch (err) {
      console.error("PDF share failed:", err);
      alert("PDF Paylaşılamadı: " + err.message);
    }
  } else {
    doc.save(fileName);
  }
}

