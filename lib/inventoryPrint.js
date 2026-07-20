function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR").format(Number(value || 0));
}

export function printInventoryTable(rows = [], mode = "current") {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("INVENTORY_TABLE_EMPTY");
  }

  const isCountSheet = mode === "count";
  const title = isCountSheet ? "Stok Sayım Formu" : "Güncel Stok Tablosu";
  const generatedAt = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  const tableRows = rows
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td class="barcode">${escapeHtml(row.barcode)}</td>
          <td class="name">${escapeHtml(row.name)}</td>
          <td>${formatNumber(row.depotStock)}</td>
          <td>${formatNumber(row.barStock)}</td>
          <td class="total">${formatNumber(row.totalStock)}</td>
          ${isCountSheet ? '<td class="count-cell"></td>' : ""}
        </tr>`
    )
    .join("");

  const win = window.open("", "_blank", "width=1000,height=720");
  if (!win) {
    throw new Error("PRINT_WINDOW_BLOCKED");
  }

  win.document.write(`<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${title} - Envantra</title>
  <style>
    @page { size: A4 landscape; margin: 11mm 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; background: #fff; font-family: Arial, Helvetica, sans-serif; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12mm; margin-bottom: 6mm; }
    h1 { margin: 0; color: #243a9b; font-size: 18pt; }
    p { margin: 2mm 0 0; color: #59657a; font-size: 8.5pt; }
    .meta { text-align: right; white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    thead { display: table-header-group; }
    th { padding: 3mm 2.5mm; background: #f0f3ff; color: #243a9b; border: .25mm solid #cbd3ec; text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .04em; }
    td { padding: 2.6mm 2.5mm; border: .25mm solid #d7dce6; vertical-align: middle; }
    tbody tr:nth-child(even) { background: #fafbff; }
    .barcode { font-family: "Courier New", monospace; white-space: nowrap; }
    .name { font-weight: 700; }
    .total { font-weight: 700; color: #1e3a8a; }
    .count-cell { height: 11mm; background: #fff; }
    footer { margin-top: 5mm; display: flex; justify-content: space-between; color: #667085; font-size: 7.5pt; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <header>
    <div><h1>Envantra - ${title}</h1><p>${isCountSheet ? "Fiziksel sayımı son sütuna elle yazınız." : "Depo ve bar stoklarının güncel toplam görünümü."}</p></div>
    <p class="meta">Oluşturulma: ${generatedAt}<br />Toplam ürün: ${rows.length}</p>
  </header>
  <table>
    <thead><tr><th>#</th><th>Barkod</th><th>Ürün Adı</th><th>Depo Stok</th><th>Bar Stok</th><th>Toplam Stok</th>${isCountSheet ? "<th>Sayım</th>" : ""}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <footer><span>Envantra Stok Yönetimi</span><span>Sayfa numarası yazdırma ayarlarından eklenebilir.</span></footer>
  <script>window.onload = () => window.print();</script>
</body>
</html>`);
  win.document.close();
}
