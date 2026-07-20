import BrandLogo from "./BrandLogo";

export default function AppLoadingScreen({ message = "Stok alanınız hazırlanıyor..." }) {
  return (
    <main className="envantra-splash" role="status" aria-live="polite">
      <div className="envantra-splash__glow envantra-splash__glow--one" />
      <div className="envantra-splash__glow envantra-splash__glow--two" />
      <section className="envantra-splash__content">
        <BrandLogo className="envantra-splash__brand" />
        <div className="envantra-splash__features" aria-hidden="true">
          <span>Stok</span><i />
          <span>Barkod &amp; QR</span><i />
          <span>SKT</span><i />
          <span>Raporlar</span>
        </div>
        <div className="envantra-splash__progress" aria-hidden="true"><span /></div>
        <p>{message}</p>
      </section>
    </main>
  );
}
