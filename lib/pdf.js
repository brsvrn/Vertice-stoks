import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const A4_LAYOUT = {
  marginX: 10,
  marginY: 10,
  labelWidth: 92.5,
  labelHeight: 50,
  columnGap: 5,
  rowGap: 4,
  columns: 2,
  rows: 5,
};

const LABELS_PER_PAGE = A4_LAYOUT.columns * A4_LAYOUT.rows;

function waitForImages(element) {
  const images = [...element.querySelectorAll("img")];
  return Promise.all(
    images.map(
      (image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
            })
    )
  );
}

export async function createPDF(printRef) {
  const labels = printRef?.current
    ? [...printRef.current.querySelectorAll("[data-label]")]
    : [];

  if (labels.length === 0) {
    throw new Error("PDF_LABELS_NOT_FOUND");
  }

  await Promise.all(labels.map(waitForImages));

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  for (let index = 0; index < labels.length; index += 1) {
    if (index > 0 && index % LABELS_PER_PAGE === 0) {
      pdf.addPage("a4", "portrait");
    }

    const label = labels[index];
    const canvas = await html2canvas(label, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const pageIndex = index % LABELS_PER_PAGE;
    const column = pageIndex % A4_LAYOUT.columns;
    const row = Math.floor(pageIndex / A4_LAYOUT.columns);
    const x = A4_LAYOUT.marginX + column * (A4_LAYOUT.labelWidth + A4_LAYOUT.columnGap);
    const y = A4_LAYOUT.marginY + row * (A4_LAYOUT.labelHeight + A4_LAYOUT.rowGap);

    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      x,
      y,
      A4_LAYOUT.labelWidth,
      A4_LAYOUT.labelHeight,
      undefined,
      "FAST"
    );
  }

  pdf.save(`Vertice-Etiket-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export { A4_LAYOUT, LABELS_PER_PAGE };
