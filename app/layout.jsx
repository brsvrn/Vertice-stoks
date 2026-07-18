import "./globals.css";

export const metadata = {
  title: {
    default: "Vertice Stok",
    template: "%s | Vertice Stok",
  },

  description:
    "QR ve barkod destekli stok takip, sayım ve envanter yönetim sistemi.",

  applicationName: "Vertice Stok",

  manifest: "/manifest.webmanifest",

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vertice Stok",
  },

  formatDetection: {
    telephone: false,
  },

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

    apple: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#030712",
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
