import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function createPDF(printRef) {
  if (!printRef?.current) return;

  const canvas = await html2canvas(printRef.current, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });

  const image = canvas.toDataURL("image/png");

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight =
    (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(
    image,
    "PNG",
    0,
    position,
    imgWidth,
    imgHeight
  );

  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;

    pdf.addPage();

    pdf.addImage(
      image,
      "PNG",
      0,
      position,
      imgWidth,
      imgHeight
    );

    heightLeft -= pageHeight;
  }

  pdf.save(
    `Vertice-Etiket-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`
  );
}
