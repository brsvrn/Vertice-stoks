"use client";

export default function BrandLogo({ compact = false, className = "" }) {
  return (
    <div className={`envantra-brand ${compact ? "envantra-brand--compact" : ""} ${className}`.trim()}>
      <img
        src="/icons/envantra-logo-192-v1.png"
        alt=""
        width={compact ? 44 : 96}
        height={compact ? 44 : 96}
        className="envantra-brand__icon"
      />
      <div className="envantra-brand__copy">
        <span className="envantra-brand__name">ENVANTRA</span>
        <span className="envantra-brand__tagline">AKILLI STOK YÖNETİMİ</span>
      </div>
    </div>
  );
}
