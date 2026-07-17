"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {
  signInAnonymously,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc
} from "firebase/firestore";

import { auth, db, appId } from "../lib/firebase";
const getPublicCollection = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);

export default function App() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Global Data
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // UI State
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);
  
  // Arama / Barkod State
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Ekleme akışı için state'ler
  const [isAddScannerOpen, setIsAddScannerOpen] = useState(false);
  const [scannedBarcodeForAdd, setScannedBarcodeForAdd] = useState('');
  const [detailInitialModal, setDetailInitialModal] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        
        }
      } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
if (!auth.currentUser) {
  await signInAnonymously(auth);
}
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(getPublicCollection('users'), currentUser.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) setDbUser(userSnap.data());
          else setDbUser(null);
        } catch (error) { console.error("User fetch error", error); }
      } else {
        setDbUser(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !dbUser) return;
    const unsubProducts = onSnapshot(getPublicCollection('products'), (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubBatches = onSnapshot(getPublicCollection('batches'), (snap) => setBatches(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTransactions = onSnapshot(getPublicCollection('transactions'), (snap) => {
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      txs.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(txs);
    });
    return () => { unsubProducts(); unsubBatches(); unsubTransactions(); };
  }, [user, dbUser]);

  const activeNotifications = useMemo(() => {
    const notifs = [];
    products.forEach(p => {
      const stock = batches.filter(b => b.productId === p.id).reduce((sum, b) => sum + Number(b.quantity), 0);
      if (stock <= Number(p.minStock)) {
        notifs.push({ id: `min_${p.id}`, type: 'CRITICAL', title: 'Kritik Stok Uyarı', message: `${p.name} toplam stok seviyesi minimumun altında (Mevcut: ${stock} / Min: ${p.minStock})` });
      }
    });

    batches.forEach(b => {
      if (Number(b.quantity) > 0) {
        const daysLeft = Math.floor((new Date(b.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
        const productName = products.find(p => p.id === b.productId)?.name || 'Bilinmeyen Ürün';
        const locName = b.location === 'BAR' ? 'Bar' : 'Depo';
        if (daysLeft <= 30 && daysLeft > 0) {
          notifs.push({ id: `exp_${b.id}`, type: 'WARNING', title: 'SKT Yaklaşıyor', message: `${productName} (${locName} - Parti #${b.batchNo}) SKT'sine ${daysLeft} gün kaldı.` });
        } else if (daysLeft <= 0) {
          notifs.push({ id: `exp_${b.id}`, type: 'ERROR', title: 'SKT DOLDU!', message: `${productName} (${locName} - Parti #${b.batchNo}) SKT'si geçti! Lütfen raftan ayırın.` });
        }
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysTransactions = transactions.filter(tx => new Date(tx.date) >= today);

    if (todaysTransactions.length === 0) {
      notifs.push({ id: 'eod_empty', type: 'INFO', title: 'Günün Özeti: Hareketsiz', message: 'Bugün hiçbir üründe stok girişi veya çıkışı yapılmadı.' });
    } else {
      const inCount = todaysTransactions.filter(tx => tx.type === 'IN').length;
      const outCount = todaysTransactions.filter(tx => tx.type === 'OUT').length;
      const transCount = todaysTransactions.filter(tx => tx.type === 'TRANSFER').length;
      notifs.push({ id: 'eod_summary', type: 'INFO', title: 'Günün Özeti: Hareket Var', message: `Bugün ${inCount} giriş, ${outCount} çıkış, ${transCount} sevk yapıldı.` });
    }

    return notifs;
  }, [products, batches, transactions]);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const handleCreateProfile = async (name, role) => {
    if (!user) return;
    const userData = { uid: user.uid, name, role, createdAt: new Date().toISOString() };
    await setDoc(doc(getPublicCollection('users'), user.uid), userData);
    setDbUser(userData);
    showToast(`Hoş geldin, ${name}!`);
  };

  const handleScanSuccess = (decodedText) => {
    setIsScannerOpen(false);
    const foundProduct = products.find(p => p.qrNo === decodedText);
    if (foundProduct) {
      setSelectedProduct(foundProduct);
      setCurrentView('product_detail');
      showToast('Ürün bulundu!', 'success');
    } else {
      setSearchQuery(decodedText);
      showToast('Kayıtsız QR okundu, sonuçlar filtrelendi.', 'error');
    }
  };

  // Yeni Ekleme Barkod Okutma Mantığı
  const handleAddScan = (decodedText) => {
    setIsAddScannerOpen(false);
    const foundProduct = products.find(p => p.qrNo === decodedText);
    if (foundProduct) {
      // Barkod zaten varsa -> Ürünü aç ve direkt "Stok Giriş" (IN) modülünü tetikle
      setSelectedProduct(foundProduct);
      setDetailInitialModal('IN');
      setCurrentView('product_detail');
      showToast('Bu barkod zaten kayıtlı. Direkt stok girebilirsiniz.', 'success');
    } else {
      // Barkod yoksa -> Yeni ürün ekleme formuna yönlendir
      setScannedBarcodeForAdd(decodedText);
      setCurrentView('admin_add');
      showToast('Yeni barkod! Lütfen ürün bilgilerini tamamlayın.', 'info');
    }
  };

  if (isAuthLoading || !user) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white font-bold animate-pulse">Yükleniyor...</div>;
  if (user && !dbUser) return <ProfileSetupView onSetup={handleCreateProfile} showToast={showToast} />;

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.qrNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedProducts = filteredProducts.reduce((groups, product) => {
    const category = (product.category?.trim() || 'DİĞER').toLocaleUpperCase('tr-TR');
    if (!groups[category]) groups[category] = [];
    groups[category].push(product);
    return groups;
  }, {});

  return (
    <div className="max-w-md mx-auto h-screen bg-gray-950 font-sans text-gray-100 overflow-hidden relative shadow-2xl print:bg-white print:max-w-none">
      {toast && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top-5 print:hidden">
          <div className={`px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            {toast.msg}
          </div>
        </div>
      )}

      {/* Scanners */}
      {isScannerOpen && <QRScannerModal onClose={() => setIsScannerOpen(false)} onScan={handleScanSuccess} title="Ürün Ara / Okut" />}
      {isAddScannerOpen && <QRScannerModal onClose={() => setIsAddScannerOpen(false)} onScan={handleAddScan} title="Barkod Okutarak Ekle" />}

      {/* Dashboard View */}
      {currentView === 'dashboard' && (
        <div className="flex flex-col h-full animate-in fade-in duration-200 print:hidden">
          <div className="p-6 bg-gray-900 rounded-b-3xl shadow-lg border-b border-gray-800 relative z-10">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Stok Takip</h1>
                <p className="text-gray-400 text-sm">Merhaba, {dbUser?.name} <span className="ml-2 px-2 py-0.5 bg-gray-800 rounded-md text-[10px] text-blue-400 uppercase">{dbUser?.role}</span></p>
              </div>
              <button onClick={() => setCurrentView('notifications')} className="p-3 bg-gray-800 rounded-full text-white relative active:scale-95 transition-transform">
                <Bell size={24} />
                {activeNotifications.length > 0 && <span className="absolute top-2 right-2 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-gray-800 animate-pulse"></span>}
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-4 text-gray-500" size={24} />
              <input type="text" placeholder="Ürün Adı veya QR No Ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-950 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg placeholder-gray-600"/>
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-4 text-gray-500 p-1"><X size={20}/></button>}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-32">
            {searchQuery && <div className="mb-4 text-sm text-gray-500 font-medium uppercase tracking-wider">Arama Sonuçları ({filteredProducts.length})</div>}
            
            {Object.keys(groupedProducts).sort().map(category => (
              <div key={category} className="mb-8">
                <h2 className="text-blue-400 font-bold mb-3 pl-2 text-sm tracking-widest uppercase flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div> {category}
                </h2>
                <div className="grid gap-3">
                  {groupedProducts[category].map(product => {
                    const productBatches = batches.filter(b => b.productId === product.id);
                    const totalStock = productBatches.reduce((sum, batch) => sum + Number(batch.quantity), 0);
                    const isLowStock = totalStock <= Number(product.minStock);
                    return (
                      <div key={product.id} onClick={() => { setSelectedProduct(product); setCurrentView('product_detail'); }} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 flex items-center justify-between active:scale-95 transition-transform cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${isLowStock ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-blue-400'}`}><Package size={28} /></div>
                          <div>
                            <h3 className="text-white font-bold text-lg">{product.name}</h3>
                            <p className="text-gray-500 text-sm">{product.qrNo}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-bold ${isLowStock ? 'text-red-400' : 'text-green-400'}`}>{totalStock}</div>
                          <div className="text-xs text-gray-600">Adet</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredProducts.length === 0 && (
              <div className="text-center text-gray-500 mt-10">
                <Package size={48} className="mx-auto mb-4 opacity-20" />
                <p>Ürün bulunamadı.</p>
              </div>
            )}
          </div>
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20">
            <button onClick={() => setIsScannerOpen(true)} className="bg-blue-600 text-white p-5 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.4)] flex items-center justify-center active:scale-90 transition-transform">
              <Camera size={36} />
            </button>
          </div>
        </div>
      )}

      {/* Views */}
      {currentView === 'admin_add' && <AdminAddProductView onBack={() => setCurrentView('dashboard')} showToast={showToast} scannedBarcode={scannedBarcodeForAdd} />}
      
      {currentView === 'product_detail' && selectedProduct && (
        <ProductDetailView 
          product={selectedProduct} 
          batches={batches.filter(b => b.productId === selectedProduct.id)}
          transactions={transactions.filter(t => t.productId === selectedProduct.id)}
          onBack={() => { setCurrentView('dashboard'); setSelectedProduct(null); setDetailInitialModal(null); }}
          showToast={showToast}
          dbUser={dbUser}
          initialModal={detailInitialModal}
        />
      )}

      {currentView === 'inventory_count' && (
        <InventoryCountView products={products} batches={batches} dbUser={dbUser} onBack={() => setCurrentView('dashboard')} showToast={showToast} />
      )}

      {currentView === 'history' && <HistoryView transactions={transactions} products={products} onBack={() => setCurrentView('dashboard')} />}
      {currentView === 'notifications' && <NotificationsView notifications={activeNotifications} onBack={() => setCurrentView('dashboard')} />}
      {currentView === 'profile' && <ProfileView dbUser={dbUser} onBack={() => setCurrentView('dashboard')} onLogout={() => signOut(auth)} onOpenReports={() => setCurrentView('reports')} />}
      {currentView === 'reports' && dbUser?.role === 'admin' && <ReportsView products={products} batches={batches} transactions={transactions} onBack={() => setCurrentView('profile')} />}

      {/* Navigation */}
      {currentView !== 'product_detail' && currentView !== 'admin_add' && currentView !== 'reports' && currentView !== 'notifications' && currentView !== 'inventory_count' && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3 flex justify-between items-center z-10 print:hidden">
          <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center gap-1 ${currentView === 'dashboard' ? 'text-blue-500' : 'text-gray-500'}`}><Home size={22} /><span className="text-[10px] font-medium">Ana Sayfa</span></button>
          {dbUser?.role === 'admin' && (
            <>
              {/* Ekle Butonu Artık Tarayıcıyı Açıyor */}
              <button onClick={() => setIsAddScannerOpen(true)} className={`flex flex-col items-center gap-1 ${currentView === 'admin_add' ? 'text-blue-500' : 'text-gray-500'}`}><Plus size={22} /><span className="text-[10px] font-medium">Ekle</span></button>
              <button onClick={() => setCurrentView('inventory_count')} className={`flex flex-col items-center gap-1 ${currentView === 'inventory_count' ? 'text-blue-500' : 'text-gray-500'}`}><ClipboardCheck size={22} /><span className="text-[10px] font-medium">Sayım</span></button>
            </>
          )}
          <button onClick={() => setCurrentView('history')} className={`flex flex-col items-center gap-1 ${currentView === 'history' ? 'text-blue-500' : 'text-gray-500'}`}><History size={22} /><span className="text-[10px] font-medium">Geçmiş</span></button>
          <button onClick={() => setCurrentView('profile')} className={`flex flex-col items-center gap-1 ${currentView === 'profile' ? 'text-blue-500' : 'text-gray-500'}`}><User size={22} /><span className="text-[10px] font-medium">Profil</span></button>
        </div>
      )}
    </div>
  );
}

function QRScannerModal({ onClose, onScan, title = "QR / Barkod Okut" }) {
  useEffect(() => {
    let html5QrcodeScanner;
    const loadScript = () => {
      if (!window.Html5QrcodeScanner) {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/html5-qrcode";
        script.onload = () => initScanner();
        document.body.appendChild(script);
      } else { initScanner(); }
    };
    const initScanner = () => {
      html5QrcodeScanner = new window.Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: {width: 250, height: 250}, aspectRatio: 1.0 }, false);
      html5QrcodeScanner.render((decodedText) => { html5QrcodeScanner.clear(); onScan(decodedText); }, () => {});
    };
    loadScript();
    return () => { if (html5QrcodeScanner) try { html5QrcodeScanner.clear(); } catch(e) {} };
  }, []);

  return (
    <div className="absolute inset-0 z-[100] bg-black flex flex-col print:hidden">
      <div className="p-6 flex justify-between items-center bg-gray-900 border-b border-gray-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><ScanLine className="text-blue-500"/> {title}</h2>
        <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-white"><X size={20}/></button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div id="qr-reader" className="w-full max-w-sm rounded-2xl overflow-hidden border-2 border-blue-500 bg-gray-900"></div>
        <p className="mt-8 text-gray-400 text-center text-sm px-6">Ürün üzerindeki barkodu veya QR kodu kameraya gösterin.</p>
        <button onClick={() => {
          const manual = prompt("Manuel barkod / QR kodunu girin (Örn: 8691234567890)");
          if (manual) onScan(manual);
        }} className="mt-8 px-6 py-2 bg-gray-800 text-white rounded-full text-sm">Manuel Giriş Yap</button>
      </div>
    </div>
  );
}

function ProfileSetupView({ onSetup, showToast }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('staff');
  const [adminPin, setAdminPin] = useState('');

  const ADMIN_SECRET_PIN = "1453"; 

  const handleRegister = () => {
    if (!name.trim()) return;
    if (role === 'admin' && adminPin !== ADMIN_SECRET_PIN) {
      showToast('Hatalı Yönetici PIN Kodu!', 'error');
      return;
    }
    onSetup(name, role);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-gray-950 text-white animate-in zoom-in-95">
      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6"><Package size={32} /></div>
      <h1 className="text-3xl font-bold mb-2">StokApp'e Hoş Geldin</h1>
      <p className="text-gray-400 text-center mb-8">Devam etmek için profil bilgilerinizi oluşturun.</p>
      
      <div className="w-full space-y-4">
        <input type="text" placeholder="Adınız Soyadınız" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 focus:ring-2 focus:ring-blue-500 outline-none" />
        
        <div className="flex gap-4">
          <button onClick={() => { setRole('staff'); setAdminPin(''); }} className={`flex-1 py-4 rounded-xl font-bold border-2 transition-all ${role === 'staff' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>Personel</button>
          <button onClick={() => setRole('admin')} className={`flex-1 py-4 rounded-xl font-bold border-2 transition-all ${role === 'admin' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>Yönetici</button>
        </div>

        {role === 'admin' && (
          <div className="animate-in slide-in-from-top-2 relative">
            <Lock className="absolute left-4 top-4 text-gray-500" size={20} />
            <input type="password" placeholder="Yönetici PIN Kodu (Örn: 1453)" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} className="w-full bg-gray-900 border border-blue-900/50 rounded-xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-blue-500 outline-none text-white font-mono" />
            <p className="text-[10px] text-gray-500 mt-2 text-center">Yönetici yetkisi almak için şifre girmelisiniz.</p>
          </div>
        )}

        <button onClick={handleRegister} disabled={!name || (role === 'admin' && !adminPin)} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-4 rounded-xl transition-colors">
          Giriş Yap
        </button>
      </div>
    </div>
  );
}

function AdminAddProductView({ onBack, showToast, scannedBarcode }) {
  const [formData, setFormData] = useState({ name: '', category: '', minStock: '', shelfLocation: '' });
  
  const handleSubmit = async () => {
    if(!formData.name || !formData.minStock) return showToast('Lütfen zorunlu alanları doldurun', 'error');
    try {
      await addDoc(getPublicCollection('products'), { ...formData, minStock: Number(formData.minStock), qrNo: scannedBarcode, createdAt: new Date().toISOString() });
      showToast('Ürün başarıyla eklendi!');
      onBack();
    } catch(err) { showToast('Bir hata oluştu', 'error'); }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 animate-in slide-in-from-right print:hidden">
      <div className="flex items-center gap-4 p-6 bg-gray-900 border-b border-gray-800">
        <button onClick={onBack} className="p-2 bg-gray-800 rounded-full text-white"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-bold text-white">Yeni Ürün Ekle</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        
        {/* Okutulan Barkod Gösterimi */}
        <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4 flex items-center justify-between shadow-inner">
          <span className="text-sm text-gray-400">Okutulan Barkod:</span>
          <span className="font-mono text-blue-400 font-bold tracking-wider">{scannedBarcode}</span>
        </div>

        <div><label className="text-sm text-gray-400 block mb-1">Ürün Adı *</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-white outline-none"/></div>
        <div><label className="text-sm text-gray-400 block mb-1">Kategori</label><input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-white outline-none" placeholder="Örn: Şarap"/></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm text-gray-400 block mb-1">Kritik Stok *</label><input type="number" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})} className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-white outline-none"/></div>
          <div><label className="text-sm text-gray-400 block mb-1">Raf Konumu</label><input type="text" value={formData.shelfLocation} onChange={e => setFormData({...formData, shelfLocation: e.target.value})} className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-white outline-none"/></div>
        </div>
      </div>
      <div className="p-6 border-t border-gray-800 bg-gray-900 mb-16">
        <button onClick={handleSubmit} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-lg active:scale-95 transition-all">Kaydet</button>
      </div>
    </div>
  );
}

function InventoryCountView({ products, batches, onBack, showToast, dbUser }) {
  const [selectedCategory, setSelectedCategory] = useState('TÜMÜ');
  const [counts, setCounts] = useState({});
  const [phase, setPhase] = useState('COUNTING'); 
  const [differences, setDifferences] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [quickCountProduct, setQuickCountProduct] = useState(null);

  const categories = ['TÜMÜ', ...new Set(products.map(p => (p.category?.trim() || 'DİĞER').toLocaleUpperCase('tr-TR')))];

  const filteredProducts = products.filter(p => {
    if (selectedCategory === 'TÜMÜ') return true;
    return (p.category?.trim() || 'DİĞER').toLocaleUpperCase('tr-TR') === selectedCategory;
  });

  const getSystemStock = (productId, location) => {
    return batches.filter(b => b.productId === productId && (b.location || 'DEPO') === location).reduce((sum, b) => sum + Number(b.quantity), 0);
  };

  const handleInputChange = (productId, location, value) => {
    setCounts(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] || { depo: '', bar: '' }), [location]: value }
    }));
  };

  const handleInventoryScan = (decodedText) => {
    setIsScannerOpen(false);
    const foundProduct = products.find(p => p.qrNo === decodedText);
    if (foundProduct) {
      setQuickCountProduct(foundProduct);
      const cat = (foundProduct.category?.trim() || 'DİĞER').toLocaleUpperCase('tr-TR');
      if (selectedCategory !== 'TÜMÜ' && selectedCategory !== cat) {
        setSelectedCategory(cat);
      }
    } else {
      showToast('Bu koda ait kayıtlı ürün bulunamadı.', 'error');
    }
  };

  const handleReview = () => {
    const diffs = [];
    filteredProducts.forEach(p => {
      const cDepo = counts[p.id]?.depo;
      if (cDepo !== undefined && cDepo !== '') {
        const sysDepo = getSystemStock(p.id, 'DEPO');
        const numDepo = Number(cDepo);
        if (numDepo !== sysDepo) diffs.push({ productId: p.id, name: p.name, location: 'DEPO', sys: sysDepo, actual: numDepo, diff: numDepo - sysDepo });
      }
      const cBar = counts[p.id]?.bar;
      if (cBar !== undefined && cBar !== '') {
        const sysBar = getSystemStock(p.id, 'BAR');
        const numBar = Number(cBar);
        if (numBar !== sysBar) diffs.push({ productId: p.id, name: p.name, location: 'BAR', sys: sysBar, actual: numBar, diff: numBar - sysBar });
      }
    });

    if (diffs.length === 0) {
      showToast('Harika! Girdiğiniz sayımlar sistemle birebir aynı. Fark yok.', 'success');
    } else {
      setDifferences(diffs);
      setPhase('REVIEW');
    }
  };

  const deductStockLogic = async (productId, location, amountToDeduct) => {
    let remaining = amountToDeduct;
    const locBatches = batches.filter(b => b.productId === productId && (b.location || 'DEPO') === location && b.quantity > 0)
                              .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    for (const batch of locBatches) {
      if (remaining <= 0) break;
      const deductAmount = Math.min(batch.quantity, remaining);
      remaining -= deductAmount;
      const batchRef = doc(getPublicCollection('batches'), batch.id);
      await setDoc(batchRef, { ...batch, quantity: batch.quantity - deductAmount });
    }
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);
    let updatesMade = 0;

    try {
      for (const diff of differences) {
        updatesMade++;
        if (diff.diff > 0) {
          await addDoc(getPublicCollection('batches'), { 
            productId: diff.productId, batchNo: `SAYIM-${Date.now()}`, expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], 
            quantity: diff.diff, location: diff.location, createdAt: new Date().toISOString() 
          });
        } else if (diff.diff < 0) {
          await deductStockLogic(diff.productId, diff.location, Math.abs(diff.diff));
        }
        await addDoc(getPublicCollection('transactions'), {
          productId: diff.productId, batchId: 'SAYIM_FARKI', userId: dbUser.uid, userName: dbUser.name, 
          type: diff.diff > 0 ? 'IN' : 'OUT', reason: 'Sayım Farkı Düzeltmesi', locationInfo: diff.location, quantity: Math.abs(diff.diff), date: new Date().toISOString()
        });
      }

      showToast(`Sayım tamamlandı! ${updatesMade} adet stok farkı otomatik düzeltildi.`, 'success');
      setCounts({});
      setDifferences([]);
      setPhase('COUNTING');
    } catch (error) {
      showToast('Sayım kaydedilirken hata oluştu!', 'error');
    }
    setIsSaving(false);
  };

  const handlePrintClick = () => {
    setIsPrintMode(true);
    setTimeout(() => { window.print(); }, 500);
  };

  if (isPrintMode) {
    return (
      <div className="absolute inset-0 z-[200] bg-white text-black p-8 min-h-screen overflow-y-auto font-sans">
        <div className="print:hidden flex justify-end gap-3 mb-6 border-b pb-4">
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg"><Printer size={20}/> Yazdır</button>
          <button onClick={() => setIsPrintMode(false)} className="bg-gray-800 text-white px-4 py-2 rounded-xl shadow-lg font-bold flex items-center gap-2"><X size={20}/> Kapat</button>
        </div>

        <div className="border-b-4 border-black pb-4 mb-6 flex justify-between items-end">
          <h2 className="text-3xl font-bold">Stok Sayım Formu</h2>
          <p className="text-lg font-bold bg-gray-200 px-4 py-2 rounded-lg border border-black">Kategori: {selectedCategory}</p>
        </div>
        <table className="w-full text-left border-collapse border-2 border-black text-sm">
          <thead>
            <tr className="bg-gray-200 border-b-2 border-black">
              <th className="p-3 border border-black w-16 text-center">Raf</th>
              <th className="p-3 border border-black">Ürün Adı</th>
              <th className="p-3 border border-black text-center w-24">Sistem DEPO</th>
              <th className="p-3 border border-black text-center w-28 bg-white">Fiili DEPO</th>
              <th className="p-3 border border-black text-center w-24">Sistem BAR</th>
              <th className="p-3 border border-black text-center w-28 bg-white">Fiili BAR</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(p => (
              <tr key={p.id} className="border-b border-gray-400">
                <td className="p-3 border border-black font-mono font-bold text-center">{p.shelfLocation || '-'}</td>
                <td className="p-3 border border-black font-bold text-lg">{p.name}</td>
                <td className="p-3 border border-black text-center text-gray-600 font-medium">{getSystemStock(p.id, 'DEPO')}</td>
                <td className="p-3 border border-black"></td> 
                <td className="p-3 border border-black text-center text-gray-600 font-medium">{getSystemStock(p.id, 'BAR')}</td>
                <td className="p-3 border border-black"></td> 
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-12 flex justify-between font-bold text-lg">
          <p>Tarih: ____/____/202__</p>
          <p>Sayan Personel İmza: ________________</p>
        </div>
        <p className="print:hidden mt-12 text-gray-500 text-sm text-center">Otomatik yazdırma penceresi açılmazsa sağ üstteki Mavi "Yazdır" butonuna tıklayabilirsiniz.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 animate-in slide-in-from-right print:hidden relative">
      <div className="flex justify-between items-center p-6 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button onClick={phase === 'REVIEW' ? () => setPhase('COUNTING') : onBack} className="p-2 bg-gray-800 rounded-full text-white"><ArrowLeft size={20}/></button>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><ClipboardCheck className="text-blue-500"/> Sayım Modülü</h2>
        </div>
        {phase === 'COUNTING' && (
          <div className="flex gap-2">
            <button onClick={() => setIsScannerOpen(true)} className="p-2 bg-green-600/20 text-green-400 rounded-full flex items-center gap-1 px-3 font-bold text-xs"><ScanLine size={16}/> QR</button>
            <button onClick={handlePrintClick} className="p-2 bg-blue-600/20 text-blue-400 rounded-full flex items-center gap-1 px-3 font-bold text-xs"><Printer size={16}/> Çıktı</button>
          </div>
        )}
      </div>

      {isScannerOpen && <QRScannerModal onClose={() => setIsScannerOpen(false)} onScan={handleInventoryScan} />}

      {quickCountProduct && (
        <div className="absolute inset-0 z-[150] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setQuickCountProduct(null)}></div>
          <div className="bg-gray-900 rounded-t-3xl p-6 relative z-10 animate-in slide-in-from-bottom-full border-t border-gray-800 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><ScanLine className="text-green-500"/> Hızlı Sayım Girişi</h2>
              <button onClick={() => setQuickCountProduct(null)} className="p-2 bg-gray-800 rounded-full text-gray-400"><X size={20}/></button>
            </div>
            
            <div className="mb-6 bg-gray-950 p-4 rounded-xl border border-gray-800">
              <h3 className="text-2xl font-bold text-blue-400 mb-1">{quickCountProduct.name}</h3>
              <p className="text-sm text-gray-500">Kategori: {quickCountProduct.category || 'Diğer'} • Raf: {quickCountProduct.shelfLocation || '-'}</p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex gap-4">
                 <div className="flex-1 bg-gray-950 border border-gray-800 p-4 rounded-xl">
                    <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest">Sistem Depo: {getSystemStock(quickCountProduct.id, 'DEPO')}</p>
                    <input type="number" placeholder="Fiili Depo" value={counts[quickCountProduct.id]?.depo ?? ''} onChange={e => handleInputChange(quickCountProduct.id, 'depo', e.target.value)} className="w-full bg-transparent text-3xl font-bold text-white outline-none border-b-2 border-gray-800 focus:border-green-500 pb-2 transition-colors" />
                 </div>
                 <div className="flex-1 bg-gray-950 border border-gray-800 p-4 rounded-xl">
                    <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest">Sistem Bar: {getSystemStock(quickCountProduct.id, 'BAR')}</p>
                    <input type="number" placeholder="Fiili Bar" value={counts[quickCountProduct.id]?.bar ?? ''} onChange={e => handleInputChange(quickCountProduct.id, 'bar', e.target.value)} className="w-full bg-transparent text-3xl font-bold text-white outline-none border-b-2 border-gray-800 focus:border-green-500 pb-2 transition-colors" />
                 </div>
              </div>
            </div>
            
            <button onClick={() => { setQuickCountProduct(null); showToast(`✓ ${quickCountProduct.name} sayımı listeye işlendi.`); }} className="w-full bg-green-600 text-white font-bold py-5 rounded-2xl text-xl flex justify-center items-center gap-2 active:scale-95 transition-transform"><CheckCircle2 size={24}/> Listeye Ekle</button>
          </div>
        </div>
      )}

      {phase === 'COUNTING' && (
        <>
          <div className="p-4 bg-gray-900 border-b border-gray-800">
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-4 rounded-xl text-white outline-none font-bold">
              {categories.map(cat => <option key={cat} value={cat}>{cat} KATEGORİSİ</option>)}
            </select>
            <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">Rafları dolaşırken üstteki QR butonuna basarak veya tablodaki boşluklara tıklayarak sayım girebilirsiniz.</p>
          </div>

          <div className="flex-1 overflow-y-auto pb-32">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300 min-w-[500px]">
                <thead className="text-xs uppercase bg-gray-800/50 text-gray-400">
                   <tr>
                      <th className="px-4 py-4 whitespace-nowrap">Raf</th>
                      <th className="px-4 py-4 w-1/3">Ürün</th>
                      <th className="px-4 py-4 text-center border-l border-gray-800 bg-gray-900/30">Depo Sayım</th>
                      <th className="px-4 py-4 text-center border-l border-gray-800 bg-gray-900/30">Bar Sayım</th>
                   </tr>
                </thead>
                <tbody>
                   {filteredProducts.map(p => {
                     const sysDepo = getSystemStock(p.id, 'DEPO');
                     const sysBar = getSystemStock(p.id, 'BAR');
                     return (
                       <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-900/50 transition-colors">
                          <td className="px-4 py-3 font-mono text-gray-500 whitespace-nowrap">{p.shelfLocation || '-'}</td>
                          <td className="px-4 py-3 font-bold text-white">{p.name}</td>
                          <td className="px-4 py-3 border-l border-gray-800 bg-gray-900/30">
                             <div className="flex items-center justify-center gap-2">
                                <span className="text-[10px] text-gray-500 w-6 text-right">(Sis:{sysDepo})</span>
                                <input type="number" placeholder="-" value={counts[p.id]?.depo ?? ''} onChange={(e) => handleInputChange(p.id, 'depo', e.target.value)} className="w-16 bg-gray-950 border border-gray-700 focus:border-blue-500 text-white font-bold rounded-lg p-2 text-center outline-none transition-colors" />
                             </div>
                          </td>
                          <td className="px-4 py-3 border-l border-gray-800 bg-gray-900/30">
                             <div className="flex items-center justify-center gap-2">
                                <span className="text-[10px] text-gray-500 w-6 text-right">(Sis:{sysBar})</span>
                                <input type="number" placeholder="-" value={counts[p.id]?.bar ?? ''} onChange={(e) => handleInputChange(p.id, 'bar', e.target.value)} className="w-16 bg-gray-950 border border-gray-700 focus:border-blue-500 text-white font-bold rounded-lg p-2 text-center outline-none transition-colors" />
                             </div>
                          </td>
                       </tr>
                     );
                   })}
                   {filteredProducts.length === 0 && (
                     <tr><td colSpan="4" className="text-center p-8 text-gray-500">Bu kategoride ürün bulunamadı.</td></tr>
                   )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="absolute bottom-[70px] left-0 right-0 p-4 bg-gradient-to-t from-gray-950 to-transparent">
            <button onClick={handleReview} className="w-full bg-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.3)] text-white font-bold py-5 rounded-2xl text-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
              <SearchCode size={24} /> Farkları Kontrol Et
            </button>
          </div>
        </>
      )}

      {phase === 'REVIEW' && (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right">
          <h3 className="text-2xl font-bold text-white mb-2 text-center">Sayım Farkları Tespiti</h3>
          <p className="text-sm text-gray-400 mb-6 text-center">Aşağıdaki ürünlerde sistem ile sizin sayımınız arasında fark bulundu. Onaylarsanız sistem bu farkları otomatik düzeltecektir.</p>
          
          <div className="space-y-3 mb-8">
            {differences.map((diff, i) => (
              <div key={i} className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-800">
                <div>
                  <h4 className="font-bold text-white">{diff.name}</h4>
                  <p className="text-[11px] text-gray-400 mt-1">Konum: <span className={`px-1.5 py-0.5 rounded text-white font-bold ${diff.location === 'DEPO' ? 'bg-gray-700' : 'bg-purple-900'}`}>{diff.location}</span> • Sistem: <span className="font-bold">{diff.sys}</span> • Sizin Sayım: <span className="font-bold">{diff.actual}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Fark</p>
                  <p className={`text-2xl font-black ${diff.diff > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {diff.diff > 0 ? '+' : ''}{diff.diff}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 mt-auto mb-20">
            <button onClick={() => setPhase('COUNTING')} className="flex-1 bg-gray-800 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform">Geri Dön</button>
            <button onClick={handleConfirmSave} disabled={isSaving} className="flex-[2] bg-blue-600 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform shadow-lg shadow-blue-900/50 flex justify-center items-center gap-2">
              <Save size={20}/> {isSaving ? 'Kaydediliyor...' : 'Onayla ve Güncelle'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductDetailView({ product, batches, transactions, onBack, showToast, dbUser, initialModal }) {
  const [modalType, setModalType] = useState(initialModal || null); 
  const [isPrintMode, setIsPrintMode] = useState(false);
  
  useEffect(() => {
    if (initialModal) setModalType(initialModal);
  }, [initialModal, product.id]);

  const activeBatches = batches.filter(b => Number(b.quantity) > 0);
  const totalStock = activeBatches.reduce((sum, b) => sum + Number(b.quantity), 0);
  const depoStock = activeBatches.filter(b => (b.location || 'DEPO') === 'DEPO').reduce((sum, b) => sum + Number(b.quantity), 0);
  const barStock = activeBatches.filter(b => b.location === 'BAR').reduce((sum, b) => sum + Number(b.quantity), 0);
  
  const sortedBatches = [...activeBatches].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  const suggestedBatch = sortedBatches.length > 0 ? sortedBatches[0] : null;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${product.qrNo}&bgcolor=ffffff&color=000000`;

  const handleTransaction = async (type, data) => {
    try {
      const quantityNum = Number(data.quantity);
      if (type === 'IN') {
        await addDoc(getPublicCollection('batches'), { 
          productId: product.id, batchNo: data.batchNo, expiryDate: data.expiryDate, 
          quantity: quantityNum, location: data.location, createdAt: new Date().toISOString() 
        });
      } 
      else if (type === 'OUT') {
        const batchRef = doc(getPublicCollection('batches'), data.batchId);
        const batch = batches.find(b => b.id === data.batchId);
        await setDoc(batchRef, { ...batch, quantity: batch.quantity - quantityNum });
      }
      else if (type === 'TRANSFER') {
        const sourceBatchRef = doc(getPublicCollection('batches'), data.sourceBatchId);
        const sourceBatch = batches.find(b => b.id === data.sourceBatchId);
        await setDoc(sourceBatchRef, { ...sourceBatch, quantity: sourceBatch.quantity - quantityNum });

        const targetBatch = batches.find(b => b.productId === product.id && b.batchNo === sourceBatch.batchNo && b.expiryDate === sourceBatch.expiryDate && b.location === data.targetLocation);
        if (targetBatch) {
          await setDoc(doc(getPublicCollection('batches'), targetBatch.id), { ...targetBatch, quantity: targetBatch.quantity + quantityNum });
        } else {
          await addDoc(getPublicCollection('batches'), { 
            productId: product.id, batchNo: sourceBatch.batchNo, expiryDate: sourceBatch.expiryDate, 
            quantity: quantityNum, location: data.targetLocation, createdAt: new Date().toISOString() 
          });
        }
      }

      await addDoc(getPublicCollection('transactions'), {
        productId: product.id, 
        batchId: type === 'OUT' || type === 'TRANSFER' ? (data.batchId || data.sourceBatchId) : 'NEW_BATCH',
        userId: dbUser.uid, userName: dbUser.name, type: type, reason: data.reason,
        locationInfo: type === 'TRANSFER' ? `${data.sourceLocation} -> ${data.targetLocation}` : (data.location || 'DEPO'),
        quantity: quantityNum, date: new Date().toISOString()
      });

      showToast(`İşlem başarıyla kaydedildi!`);
      setModalType(null);
    } catch (err) { showToast('Bir hata oluştu', 'error'); }
  };

  const handlePrintClick = () => {
    setIsPrintMode(true);
    setTimeout(() => { window.print(); }, 500);
  };

  if (isPrintMode) {
    return (
      <div className="absolute inset-0 z-[200] bg-white flex flex-col items-center justify-center p-4 text-black">
        <div className="print:hidden absolute top-4 right-4 flex gap-2">
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2"><Printer size={20}/> Yazdır</button>
          <button onClick={() => setIsPrintMode(false)} className="bg-gray-800 text-white p-3 rounded-full shadow-lg"><X size={24}/></button>
        </div>
        <div className="border-4 border-black p-10 rounded-3xl flex flex-col items-center text-center max-w-md w-full">
          <h1 className="text-4xl font-bold mb-8 leading-tight">{product.name}</h1>
          <img src={qrImageUrl} alt="QR" className="w-64 h-64 mb-8 object-contain mix-blend-multiply" />
          <p className="text-4xl font-mono tracking-widest font-bold mb-4">{product.qrNo}</p>
          <p className="text-3xl font-bold bg-gray-200 px-8 py-3 rounded-2xl border-4 border-gray-400">Raf: {product.shelfLocation || '-'}</p>
        </div>
        <p className="print:hidden mt-8 text-gray-500 text-sm">Eğer otomatik yazdırma penceresi açılmazsa, yukarıdaki Mavi Butona basın veya bu ekranın görüntüsünü alın.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 animate-in slide-in-from-bottom-5">
      <div className="p-6 bg-gray-900 border-b border-gray-800 relative">
        <button onClick={onBack} className="p-2 bg-gray-800 rounded-full mb-4 text-white"><ArrowLeft size={20}/></button>
        <button onClick={handlePrintClick} className="absolute top-6 right-6 p-3 bg-blue-600/20 text-blue-400 rounded-full flex flex-col items-center gap-1 active:scale-95 transition-transform"><Printer size={20} /> <span className="text-[10px] font-bold">QR YAZDIR</span></button>
        <h1 className="text-3xl font-bold text-white mb-1 leading-tight pr-20">{product.name}</h1>
        <div className="flex items-center gap-2 text-gray-400"><QrCode size={16} /> <span className="font-mono text-sm tracking-wider">{product.qrNo}</span></div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 mb-4">
          <div className="flex justify-between items-end mb-4 border-b border-gray-800 pb-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Toplam Stok</p>
              <p className={`text-4xl font-bold ${totalStock <= product.minStock ? 'text-red-500' : 'text-white'}`}>{totalStock}</p>
            </div>
            <p className="text-xs text-gray-500">Min: {product.minStock}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
              <div className="flex items-center gap-2 text-gray-400 mb-1"><Warehouse size={16}/> <span className="text-xs font-bold">ANA DEPO</span></div>
              <p className="text-2xl font-bold text-white">{depoStock}</p>
            </div>
            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
              <div className="flex items-center gap-2 text-gray-400 mb-1"><Martini size={16}/> <span className="text-xs font-bold">BAR</span></div>
              <p className="text-2xl font-bold text-white">{barStock}</p>
            </div>
          </div>
        </div>
        
        <h3 className="text-lg font-bold mb-3 text-white">Aktif Partiler (SKT)</h3>
        <div className="space-y-2 mb-6">
          {sortedBatches.map((batch, idx) => {
            const loc = batch.location || 'DEPO';
            return (
              <div key={batch.id} className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-800">
                <div>
                  <p className="font-bold text-white">Parti #{batch.batchNo}</p>
                  <p className={`text-xs ${idx === 0 ? 'text-red-400 font-bold' : 'text-gray-500'}`}>SKT: {batch.expiryDate}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-blue-400">{batch.quantity} <span className="text-xs text-gray-500">Adet</span></div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${loc === 'DEPO' ? 'bg-gray-800 text-gray-300' : 'bg-purple-900/30 text-purple-400'}`}>{loc}</span>
                </div>
              </div>
            );
          })}
          {sortedBatches.length === 0 && <div className="bg-gray-900 p-4 rounded-xl text-center text-gray-500 text-sm">Stokta hiç ürün yok.</div>}
        </div>

        <h3 className="text-lg font-bold mb-3 text-white">Son Hareketler</h3>
        <div className="space-y-2 mb-8">
          {transactions.slice(0, 5).map(tx => (
            <div key={tx.id} className="flex justify-between items-center bg-gray-950 p-3 rounded-lg border border-gray-800/50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${tx.type === 'IN' ? 'bg-green-500/20 text-green-400' : tx.type === 'TRANSFER' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                  {tx.type === 'IN' ? <Plus size={16}/> : tx.type === 'TRANSFER' ? <ArrowRightLeft size={16}/> : <Minus size={16}/>}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{tx.reason}</p>
                  <p className="text-[10px] text-gray-400">{tx.locationInfo}</p>
                  <p className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString('tr-TR')} • {tx.userName}</p>
                </div>
              </div>
              <div className={`font-bold ${tx.type === 'IN' ? 'text-green-400' : tx.type === 'TRANSFER' ? 'text-blue-400' : 'text-red-400'}`}>
                {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : ''}{tx.quantity}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-900 border-t border-gray-800 grid grid-cols-3 gap-3">
        <button onClick={() => setModalType('IN')} className="bg-green-600/10 text-green-500 border-2 border-green-600/30 font-bold py-4 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"><Plus size={20} /> <span className="text-xs">Giriş</span></button>
        <button onClick={() => totalStock > 0 ? setModalType('TRANSFER') : showToast('Stok yok', 'error')} className={`font-bold py-4 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform border-2 ${totalStock > 0 ? 'bg-blue-600/10 text-blue-500 border-blue-600/30' : 'bg-gray-800 text-gray-600 border-gray-800 opacity-50'}`}><ArrowRightLeft size={20} /> <span className="text-xs">Sevk</span></button>
        <button onClick={() => totalStock > 0 ? setModalType('OUT') : showToast('Stok yok', 'error')} className={`font-bold py-4 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform border-2 ${totalStock > 0 ? 'bg-red-600/10 text-red-500 border-red-600/30' : 'bg-gray-800 text-gray-600 border-gray-800 opacity-50'}`}><Minus size={20} /> <span className="text-xs">Çıkış</span></button>
      </div>

      {modalType === 'IN' && <StockInModal onClose={() => setModalType(null)} onSubmit={(data) => handleTransaction('IN', data)} />}
      {modalType === 'OUT' && <StockOutModal suggestedBatch={suggestedBatch} batches={activeBatches} onClose={() => setModalType(null)} onSubmit={(data) => handleTransaction('OUT', data)} />}
      {modalType === 'TRANSFER' && <StockTransferModal batches={activeBatches} onClose={() => setModalType(null)} onSubmit={(data) => handleTransaction('TRANSFER', data)} />}
    </div>
  );
}

function StockInModal({ onClose, onSubmit }) {
  const [data, setData] = useState({ quantity: '', batchNo: '', expiryDate: '', reason: 'Satın Alma', location: 'DEPO' });
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-gray-900 rounded-t-3xl p-6 relative z-10 animate-in slide-in-from-bottom-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Plus className="text-green-500"/> Stok Girişi</h2>
          <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-gray-400"><X size={20}/></button>
        </div>
        <div className="space-y-4 mb-6">
          <div className="flex gap-2 p-1 bg-gray-950 rounded-xl border border-gray-800">
            <button onClick={() => setData({...data, location: 'DEPO'})} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${data.location === 'DEPO' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>Ana Depo'ya</button>
            <button onClick={() => setData({...data, location: 'BAR'})} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${data.location === 'BAR' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>Bar'a</button>
          </div>
          <input type="number" placeholder="Miktar (Adet)" value={data.quantity} onChange={e => setData({...data, quantity: e.target.value})} className="w-full bg-gray-950 border border-gray-800 p-4 rounded-xl text-2xl font-bold text-center text-white" />
          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="Parti No" value={data.batchNo} onChange={e => setData({...data, batchNo: e.target.value})} className="w-full bg-gray-950 border border-gray-800 p-4 rounded-xl text-white" />
            <input type="date" value={data.expiryDate} onChange={e => setData({...data, expiryDate: e.target.value})} className="w-full bg-gray-950 border border-gray-800 p-4 rounded-xl text-white" />
          </div>
          <select value={data.reason} onChange={e => setData({...data, reason: e.target.value})} className="w-full bg-gray-950 border border-gray-800 p-4 rounded-xl text-white outline-none">
            <option>Satın Alma</option><option>İade Geldi</option><option>Sayım Fazlası</option>
          </select>
        </div>
        <button onClick={() => { if(data.quantity && data.batchNo && data.expiryDate) onSubmit(data); }} className="w-full bg-green-600 text-white font-bold py-5 rounded-2xl text-xl">Girişi Kaydet</button>
      </div>
    </div>
  );
}

function StockOutModal({ suggestedBatch, batches, onClose, onSubmit }) {
  const [data, setData] = useState({ quantity: '', batchId: suggestedBatch?.id || '', reason: 'Servis' });
  const selectedBatchObj = batches.find(b => b.id === data.batchId);
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-gray-900 rounded-t-3xl p-6 relative z-10 animate-in slide-in-from-bottom-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Minus className="text-red-500"/> Stok Çıkışı</h2>
          <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-gray-400"><X size={20}/></button>
        </div>
        <div className="space-y-4 mb-6">
          <select value={data.batchId} onChange={e => setData({...data, batchId: e.target.value})} className="w-full bg-gray-950 border border-gray-800 p-4 rounded-xl text-white outline-none">
            {batches.map(b => <option key={b.id} value={b.id}>[{b.location || 'DEPO'}] Parti: #{b.batchNo} (Mevcut: {b.quantity})</option>)}
          </select>
          <div>
            <input type="number" placeholder="Miktar (Adet)" value={data.quantity} onChange={e => setData({...data, quantity: e.target.value})} className="w-full bg-gray-950 border border-red-900/50 p-4 rounded-xl text-3xl font-bold text-center text-white focus:border-red-500" />
            {selectedBatchObj && Number(data.quantity) > selectedBatchObj.quantity && <p className="text-red-500 text-xs mt-2 text-center">En fazla {selectedBatchObj.quantity} çıkılabilir!</p>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['Servis', 'Fire', 'İade'].map(reason => (
              <button key={reason} onClick={() => setData({...data, reason})} className={`py-3 rounded-xl font-bold text-sm border ${data.reason === reason ? 'bg-gray-700 border-gray-500 text-white' : 'bg-gray-950 border-gray-800 text-gray-500'}`}>{reason}</button>
            ))}
          </div>
        </div>
        <button onClick={() => { if(data.quantity && data.batchId && Number(data.quantity) <= (selectedBatchObj?.quantity || 0)) onSubmit(data); }} disabled={!data.quantity || Number(data.quantity) > (selectedBatchObj?.quantity || 0)} className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-5 rounded-2xl text-xl transition-all">Çıkışı Onayla</button>
      </div>
    </div>
  );
}

function StockTransferModal({ batches, onClose, onSubmit }) {
  const [data, setData] = useState({ quantity: '', sourceBatchId: '', sourceLocation: 'DEPO', targetLocation: 'BAR', reason: 'Depolar Arası Sevk' });
  const sourceBatches = batches.filter(b => (b.location || 'DEPO') === data.sourceLocation);
  const selectedBatchObj = sourceBatches.find(b => b.id === data.sourceBatchId);

  useEffect(() => { if(sourceBatches.length > 0) setData(prev => ({...prev, sourceBatchId: sourceBatches[0].id})); else setData(prev => ({...prev, sourceBatchId: ''})); }, [data.sourceLocation]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-gray-900 rounded-t-3xl p-6 relative z-10 animate-in slide-in-from-bottom-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><ArrowRightLeft className="text-blue-500"/> Depolar Arası Sevk</h2>
          <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-gray-400"><X size={20}/></button>
        </div>
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-2">
            <select value={data.sourceLocation} onChange={e => setData({...data, sourceLocation: e.target.value, targetLocation: e.target.value === 'DEPO' ? 'BAR' : 'DEPO'})} className="flex-1 bg-gray-950 border border-gray-800 p-4 rounded-xl text-white outline-none">
              <option value="DEPO">Depo'dan</option><option value="BAR">Bar'dan</option>
            </select>
            <ArrowRightLeft className="text-gray-500" />
            <div className="flex-1 bg-gray-900 border border-gray-800 p-4 rounded-xl text-gray-400 text-center font-bold">
              {data.targetLocation === 'BAR' ? "Bar'a" : "Depo'ya"}
            </div>
          </div>
          <select value={data.sourceBatchId} onChange={e => setData({...data, sourceBatchId: e.target.value})} className="w-full bg-gray-950 border border-gray-800 p-4 rounded-xl text-white outline-none">
            <option value="" disabled>Parti Seçin (Zorunlu)</option>
            {sourceBatches.map(b => <option key={b.id} value={b.id}>Parti: #{b.batchNo} (Mevcut: {b.quantity})</option>)}
          </select>
          <div>
            <input type="number" placeholder="Sevk Edilecek Miktar" value={data.quantity} onChange={e => setData({...data, quantity: e.target.value})} className="w-full bg-gray-950 border border-blue-900/50 p-4 rounded-xl text-3xl font-bold text-center text-white focus:border-blue-500 outline-none" />
            {selectedBatchObj && Number(data.quantity) > selectedBatchObj.quantity && <p className="text-red-500 text-xs mt-2 text-center">En fazla {selectedBatchObj.quantity} sevk edilebilir!</p>}
          </div>
        </div>
        <button onClick={() => { if(data.quantity && data.sourceBatchId && Number(data.quantity) <= (selectedBatchObj?.quantity || 0)) onSubmit(data); }} disabled={!data.quantity || !data.sourceBatchId || Number(data.quantity) > (selectedBatchObj?.quantity || 0)} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-5 rounded-2xl text-xl transition-all">Sevk İşlemini Onayla</button>
      </div>
    </div>
  );
}

function HistoryView({ transactions, products, onBack }) {
  return (
    <div className="flex flex-col h-full bg-gray-950 animate-in slide-in-from-right print:hidden">
      <div className="flex items-center gap-4 p-6 bg-gray-900 border-b border-gray-800">
        <button onClick={onBack} className="p-2 bg-gray-800 rounded-full text-white"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-bold text-white">Hareket Geçmişi</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
        {transactions.map(tx => {
          const product = products.find(p => p.id === tx.productId);
          return (
            <div key={tx.id} className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${tx.type === 'IN' ? 'bg-green-500/20 text-green-400' : tx.type === 'TRANSFER' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                  {tx.type === 'IN' ? <Plus size={20}/> : tx.type === 'TRANSFER' ? <ArrowRightLeft size={20}/> : <Minus size={20}/>}
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">{product?.name || 'Bilinmeyen Ürün'}</h4>
                  <p className="text-gray-500 text-xs mt-1">{tx.reason} <span className="text-[10px] bg-gray-800 px-1 rounded ml-1 text-gray-300">{tx.locationInfo}</span></p>
                  <p className="text-gray-600 text-[10px] mt-0.5">{new Date(tx.date).toLocaleDateString('tr-TR')} • {tx.userName}</p>
                </div>
              </div>
              <div className={`text-lg font-bold ${tx.type === 'IN' ? 'text-green-400' : tx.type === 'TRANSFER' ? 'text-blue-400' : 'text-red-400'}`}>{tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : ''}{tx.quantity}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NotificationsView({ notifications, onBack }) {
  return (
    <div className="flex flex-col h-full bg-gray-950 animate-in slide-in-from-right print:hidden">
      <div className="flex items-center gap-4 p-6 bg-gray-900 border-b border-gray-800">
        <button onClick={onBack} className="p-2 bg-gray-800 rounded-full text-white"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-bold text-white">Bildirimler ({notifications.length})</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
        {notifications.map(notif => (
          <div key={notif.id} className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex items-start gap-4">
            <div className={`p-2 rounded-full mt-1 ${notif.type === 'INFO' ? 'bg-blue-500/20 text-blue-400' : notif.type === 'CRITICAL' || notif.type === 'ERROR' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {notif.type === 'INFO' ? <Info size={20}/> : <AlertTriangle size={20}/>}
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">{notif.title}</h4>
              <p className="text-gray-400 text-xs mt-1 leading-relaxed">{notif.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileView({ dbUser, onBack, onLogout, onOpenReports }) {
  return (
    <div className="flex flex-col h-full bg-gray-950 animate-in slide-in-from-right print:hidden">
      <div className="flex items-center gap-4 p-6 bg-gray-900 border-b border-gray-800">
        <button onClick={onBack} className="p-2 bg-gray-800 rounded-full text-white"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-bold text-white">Profil</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-6 pb-24 flex flex-col items-center">
        <div className="w-24 h-24 bg-blue-600/20 rounded-full border-4 border-blue-600/50 flex items-center justify-center mb-6 mt-4"><User size={48} className="text-blue-400" /></div>
        <h3 className="text-3xl font-bold text-white mb-1">{dbUser?.name}</h3>
        <p className="text-gray-400 bg-gray-900 px-4 py-1 rounded-full text-sm font-medium border border-gray-800 uppercase mb-8">Yetki: {dbUser?.role === 'admin' ? 'Yönetici' : 'Personel'}</p>
        
        {dbUser?.role === 'admin' && (
          <button onClick={onOpenReports} className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-2 mb-8 shadow-lg shadow-blue-900/20 active:scale-95 transition-transform">
            <FileDown size={24} /> Raporlar ve Dışa Aktarım
          </button>
        )}
        <button onClick={onLogout} className="mt-8 w-full bg-red-600/10 text-red-500 border border-red-600/30 font-bold py-5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"><LogOut size={24} /> Çıkış Yap</button>
      </div>
    </div>
  );
}

function ReportsView({ products, batches, transactions, onBack }) {
  const exportCSV = (type) => {
    let csvContent = "\uFEFF"; 
    if (type === 'stock') {
      csvContent += "Ürün Adı,Kategori,QR No,Raf Konumu,Minimum Stok,Depo Stok,Bar Stok,Mevcut Toplam Stok\n";
      products.forEach(p => {
        const prodBatches = batches.filter(b => b.productId === p.id);
        const stock = prodBatches.reduce((sum, b) => sum + Number(b.quantity), 0);
        const depo = prodBatches.filter(b => (b.location||'DEPO')==='DEPO').reduce((sum, b) => sum + Number(b.quantity), 0);
        const bar = prodBatches.filter(b => b.location==='BAR').reduce((sum, b) => sum + Number(b.quantity), 0);
        csvContent += `"${p.name}","${p.category || ''}","${p.qrNo}","${p.shelfLocation || ''}",${p.minStock},${depo},${bar},${stock}\n`;
      });
    } else if (type === 'history') {
      csvContent += "Tarih,Saat,Ürün,İşlem Tipi,Lokasyon,Sebep,Miktar,Personel\n";
      transactions.forEach(tx => {
        const p = products.find(p => p.id === tx.productId)?.name || 'Bilinmeyen';
        const date = new Date(tx.date).toLocaleDateString('tr-TR');
        const time = new Date(tx.date).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
        csvContent += `${date},${time},"${p}",${tx.type === 'IN' ? 'Giriş' : tx.type === 'TRANSFER' ? 'Sevk' : 'Çıkış'},"${tx.locationInfo || ''}","${tx.reason}",${tx.quantity},"${tx.userName}"\n`;
      });
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stok_raporu_${type}_${new Date().getTime()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  return (
    <div className="flex flex-col h-full bg-gray-950 animate-in slide-in-from-right print:bg-white print:text-black">
      <div className="flex items-center gap-4 p-6 bg-gray-900 border-b border-gray-800 print:hidden">
        <button onClick={onBack} className="p-2 bg-gray-800 rounded-full text-white"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-bold text-white">Raporlama Merkezi</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 print:p-0">
        <div className="print:hidden space-y-4">
          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800">
            <h3 className="font-bold text-white mb-2">Güncel Stok Durumu</h3>
            <button onClick={() => exportCSV('stock')} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><FileDown size={18}/> Excel</button>
          </div>
          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800">
            <h3 className="font-bold text-white mb-2">Tüm Hareket Geçmişi</h3>
            <button onClick={() => exportCSV('history')} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><FileDown size={18}/> Geçmişi Excel'e Aktar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
