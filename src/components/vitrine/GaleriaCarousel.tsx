"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ZoomIn, X, Home, Map } from "lucide-react";

interface Imagem {
  url: string;
  titulo?: string;
}

interface GaleriaCarouselProps {
  imagens: Imagem[];
  plantas: Imagem[];
  nomeModelo: string;
}

export function GaleriaCarousel({ imagens, plantas, nomeModelo }: GaleriaCarouselProps) {
  const [tab, setTab] = useState<"renders" | "plantas">("renders");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const itens = tab === "renders" ? imagens : plantas;

  const prev = () => setCurrentIndex((i) => (i > 0 ? i - 1 : itens.length - 1));
  const next = () => setCurrentIndex((i) => (i < itens.length - 1 ? i + 1 : 0));

  if (imagens.length === 0 && plantas.length === 0) {
    return (
      <div
        className="flex-center flex-col gap-4 py-16 rounded-2xl"
        style={{ background: "rgba(0,0,0,0.2)", border: "1px dashed var(--border-subtle)" }}
      >
        <div className="text-4xl">🖼️</div>
        <p className="text-body text-center">
          Nenhuma imagem cadastrada ainda.
          <br />
          <span style={{ color: "var(--terracota)" }}>Acesse o painel Admin para adicionar fotos.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="tab-group">
        <button
          className={`tab-item flex items-center justify-center gap-2 ${tab === "renders" ? "active" : ""}`}
          onClick={() => { setTab("renders"); setCurrentIndex(0); }}
        >
          <Home size={14} />
          Renders ({imagens.length})
        </button>
        <button
          className={`tab-item flex items-center justify-center gap-2 ${tab === "plantas" ? "active" : ""}`}
          onClick={() => { setTab("plantas"); setCurrentIndex(0); }}
        >
          Planta Baixa ({plantas.length})
        </button>
      </div>

      {/* Carousel */}
      {itens.length > 0 ? (
        <div className="relative">
          <div className="relative rounded-2xl overflow-hidden" style={{ height: 320 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${tab}-${currentIndex}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                <Image
                  src={itens[currentIndex].url}
                  alt={itens[currentIndex].titulo || nomeModelo}
                  fill
                  className="object-cover"
                />
                {/* Overlay */}
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }}
                />
                {itens[currentIndex].titulo && (
                  <div className="absolute bottom-4 left-4">
                    <p className="font-semibold text-sm text-white">{itens[currentIndex].titulo}</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Controles */}
            {itens.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex-center"
                  style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <ChevronLeft size={18} color="white" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex-center"
                  style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <ChevronRight size={18} color="white" />
                </button>
              </>
            )}

            {/* Zoom */}
            <button
              onClick={() => setLightbox(itens[currentIndex].url)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full flex-center"
              style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              <ZoomIn size={16} color="white" />
            </button>
          </div>

          {/* Indicadores */}
          {itens.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              {itens.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: i === currentIndex ? 20 : 8,
                    height: 8,
                    background: i === currentIndex ? "var(--terracota)" : "var(--border-subtle)",
                  }}
                />
              ))}
            </div>
          )}

          {/* Thumbnails */}
          {itens.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
              {itens.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className="relative shrink-0 rounded-xl overflow-hidden"
                  style={{
                    width: 72,
                    height: 52,
                    border: i === currentIndex ? "2px solid var(--terracota)" : "1px solid var(--border-subtle)",
                  }}
                >
                  <Image src={img.url} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex-center py-12 rounded-2xl"
          style={{ background: "rgba(0,0,0,0.2)", border: "1px dashed var(--border-subtle)" }}
        >
          <p className="text-muted text-sm">Sem {tab === "renders" ? "renders" : "plantas"} cadastrados</p>
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative"
              style={{ maxWidth: "90vw", maxHeight: "90vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={lightbox}
                alt="Visualização"
                width={1200}
                height={800}
                style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain", borderRadius: "12px" }}
              />
              <button
                onClick={() => setLightbox(null)}
                className="absolute top-3 right-3 w-10 h-10 rounded-full flex-center"
                style={{ background: "rgba(0,0,0,0.7)" }}
              >
                <X size={18} color="white" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
