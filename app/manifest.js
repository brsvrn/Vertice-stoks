export default function manifest() {
  return {
    name: "Stockera",
    short_name: "Stockera",

    description:
      "QR ve barkod destekli stok, sayım ve envanter yönetim sistemi.",

    start_url: "/",

    scope: "/",

    display: "standalone",

    orientation: "portrait",

    background_color: "#030712",

    theme_color: "#030712",

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
