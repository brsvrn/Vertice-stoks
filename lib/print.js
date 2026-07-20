export function printLabels(printRef) {
  const labels = printRef?.current
    ? [...printRef.current.querySelectorAll("[data-label]")]
    : [];

  if (labels.length === 0) {
    throw new Error("PRINT_LABELS_NOT_FOUND");
  }

  // Capacitor (Android/iOS) does not support window.print() via window.open well.
  // It redirects out of the app.
  if (typeof window !== "undefined" && window.Capacitor?.isNative) {
    throw new Error("USE_PDF_INSTEAD_ON_MOBILE");
  }

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    throw new Error("PRINT_WINDOW_BLOCKED");
  }

  const content = labels.map((label) => label.outerHTML).join("");
  win.document.write(`
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>Envantra Etiketler</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
.label-print-grid { display: grid; grid-template-columns: repeat(2, 92.5mm); grid-auto-rows: 50mm; gap: 4mm 5mm; }
.label-card { width: 92.5mm; height: 50mm; border: .25mm solid #c9c9c9; border-radius: 3mm; padding: 4mm; display: flex; flex-direction: column; justify-content: space-between; break-inside: avoid; overflow: hidden; background: #fff; }
.label-card h2 { margin: 0; font-size: 13pt; letter-spacing: .18em; text-align: center; }
.label-card h3 { margin: 0; font-size: 10pt; line-height: 1.2; }
.label-card p { margin: 2mm 0 0; font-size: 8pt; }
.label-card img { width: 26mm; height: 26mm; object-fit: contain; }
.label-card .flex { display: flex; align-items: center; gap: 4mm; }
.label-card .flex-1 { flex: 1; min-width: 0; }
.label-card .text-center { text-align: center; }
.label-card .text-\[10px\] { font-size: 6pt; color: #666; }
@media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body><main class="label-print-grid">${content}</main><script>window.onload=()=>window.print();</script></body>
</html>`);
  win.document.close();
}
