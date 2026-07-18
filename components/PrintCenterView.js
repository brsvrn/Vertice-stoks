"use client";

import { useMemo, useRef, useState } from "react";
import { Printer, FileDown, ArrowLeft, Search } from "lucide-react";
import LabelPreview from "./LabelPreview";
import LabelGrid from "./LabelGrid";
import { createPDF } from "../lib/pdf";
import { printLabels } from "../lib/print";

export default function PrintCenterView({
  products = [],
  onBack,
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);

  const printRef = useRef(null);

  const filteredProducts = useMemo(() => {
    const text = search.trim().toLowerCase();

    if (!text) return products;

    return products.filter((p) => {
      return (
        (p.name || "")
          .toLowerCase()
          .includes(text) ||
        (p.qrNo || "")
          .toLowerCase()
          .includes(text)
      );
    });
  }, [products, search]);

  const toggleProduct = (id) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const selectedProducts = filteredProducts.filter(
    (p) => selected.includes(p.id)
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      <header className="sticky top-0 bg-gray-900 border-b border-gray-800 p-5 z-20">

        <div className="flex items-center justify-between">

          <button
            onClick={onBack}
            className="bg-gray-800 rounded-xl p-3"
          >
            <ArrowLeft size={20}/>
          </button>

          <h1 className="font-bold text-xl">
            Etiket Merkezi
          </h1>

          <div />

        </div>

        <div className="mt-4 relative">

          <Search
            className="absolute left-4 top-4 text-gray-500"
            size={18}
          />

          <input
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            placeholder="Ürün Ara..."
            className="w-full bg-gray-800 rounded-xl pl-12 pr-4 py-3 outline-none"
          />

        </div>

      </header>

      <div className="p-5">

        <div className="grid gap-3">

          {filteredProducts.map(product=>{

            const checked =
              selected.includes(product.id);

            return(

              <button
                key={product.id}
                onClick={()=>toggleProduct(product.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  checked
                  ? "border-green-500 bg-green-500/10"
                  : "border-gray-800 bg-gray-900"
                }`}
              >

                <div className="flex justify-between">

                  <div>

                    <h2 className="font-bold">
                      {product.name}
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                      {product.qrNo}
                    </p>

                  </div>

                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                  />

                </div>

              </button>

            );

          })}

        </div>

        {selectedProducts.length>0 && (

          <>

            <div className="mt-8 mb-4 flex justify-between items-center">

              <h2 className="font-bold text-lg">
                Önizleme
              </h2>

              <span className="text-sm text-gray-500">
                {selectedProducts.length} etiket
              </span>

            </div>

            <div ref={printRef}>

              <LabelGrid>

                {selectedProducts.map(product=>(

                  <LabelPreview
                    key={product.id}
                    product={product}
                  />

                ))}

              </LabelGrid>

            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">

              <button

                onClick={()=>
                  printLabels(printRef)
                }

                className="bg-blue-600 rounded-xl py-4 font-bold flex items-center justify-center gap-2"
              >

                <Printer size={20}/>

                Yazdır

              </button>

              <button

                onClick={()=>
                  createPDF(printRef)
                }

                className="bg-green-600 rounded-xl py-4 font-bold flex items-center justify-center gap-2"
              >

                <FileDown size={20}/>

                PDF

              </button>

            </div>

          </>

        )}

      </div>

    </div>
  );

    }
