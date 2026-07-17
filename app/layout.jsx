import "./globals.css";

export const metadata = {
  title: "Vertice Stok",
  description: "QR destekli stok takip ve envanter yönetim sistemi",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
