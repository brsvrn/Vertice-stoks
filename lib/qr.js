import QRCode from "qrcode";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://envantra.vercel.app";

export function getProductUrl(productId) {
  return new URL(`/product/${encodeURIComponent(productId)}`, APP_URL).toString();
}

export async function generateQRCode(productId) {
  return QRCode.toDataURL(getProductUrl(productId), {
    width: 512,
    margin: 1,
    errorCorrectionLevel: "H",
  });
}

export function parseProductReference(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return { productId: "", barcode: "" };

  try {
    const url = new URL(rawValue);
    const match = url.pathname.match(/^\/product\/([^/]+)\/?$/);
    if (match) {
      return { productId: decodeURIComponent(match[1]), barcode: "" };
    }
  } catch {
    // Eski barkod etiketleri URL olmayabilir; barkod olarak işlenir.
  }

  return { productId: "", barcode: rawValue };
}
