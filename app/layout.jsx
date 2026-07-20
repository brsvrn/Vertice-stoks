import "./globals.css";
import PWARegister from "../components/PWARegister";
import NetworkStatus from "../components/NetworkStatus";

export const metadata = {
  title: "Envantra",
  description:
    "Envantra - QR destekli stok takip ve envanter yönetim sistemi",
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
    apple: "/icons/apple-touch-icon.png",
    shortcut: "/icons/favicon-32.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Envantra",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#003d9b",
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="tr">
      <body>
        <PWARegister />
        <NetworkStatus />
        {children}
      </body>
    </html>
  );
}
