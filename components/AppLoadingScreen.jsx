import BrandLogo from "./BrandLogo";

export default function AppLoadingScreen({ message = "Stok alanınız hazırlanıyor..." }) {
  return (
    <main className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-gray-950 text-white overflow-hidden" role="status" aria-live="polite">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px]" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl" />
      
      <section className="relative z-10 flex flex-col items-center max-w-xs w-full px-4 text-center">
        <div className="mb-10 scale-125">
          <BrandLogo />
        </div>
        
        <div className="flex items-center justify-center gap-3 text-[11px] font-bold tracking-widest text-slate-400 mb-12 uppercase">
          <span>Stok</span>
          <div className="w-1 h-1 rounded-full bg-slate-600" />
          <span>Barkod</span>
          <div className="w-1 h-1 rounded-full bg-slate-600" />
          <span>SKT</span>
        </div>
        
        <div className="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden mb-6 relative">
          <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-full w-1/2 animate-pulse" />
        </div>
        
        <p className="text-sm font-medium text-slate-300 animate-pulse">{message}</p>
      </section>
    </main>
  );
}
