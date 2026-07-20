export default function manifest() {
  return {
    name: "Envantra",
    short_name: "Envantra",

    description:
      "QR ve barkod destekli stok, sayım ve envanter yönetim sistemi.",

    start_url: "/",

    scope: "/",

    display: "standalone",

    orientation: "portrait",

    background_color: "#f8f9ff",

    theme_color: "#003d9b",

    categories: [
      "business",
      "productivity",
      "utilities",
    ],

    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
