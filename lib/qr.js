import QRCode from "qrcode";

export async function generateQRCode(
  qrNo
) {
  const value = `https://stok.verticerestaurant.com.tr/product/${qrNo}`;

  return await QRCode.toDataURL(value, {
    width: 512,
    margin: 1,
    errorCorrectionLevel: "H",
  });
}

export function generateQRText(qrNo) {
  return `https://stok.verticerestaurant.com.tr/product/${qrNo}`;
}
