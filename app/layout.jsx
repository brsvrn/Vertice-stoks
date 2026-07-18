import "./globals.css";
import PWARegister from "../components/PWARegister";

export const metadata = {
  title: "Vertice Stok",
  description:
    "QR destekli stok takip ve envanter yönetim sistemi",
  manifest: "/manifest.json",
  icons: {
    icon: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vertice Stok",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#030712",
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="tr">
      <body>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
