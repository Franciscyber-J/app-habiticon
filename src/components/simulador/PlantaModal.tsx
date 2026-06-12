"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

// ─────────────────────────────────────────────────────────
// TIPAGEM
// ─────────────────────────────────────────────────────────

interface PlantaModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantaUrl: string;
  modeloNome?: string;
}

const SCALE_MIN = 1;
const SCALE_MAX = 5;

// ─────────────────────────────────────────────────────────
// COMPONENTE
// Lightbox com zoom: scroll do mouse, pinça (2 dedos),
// arrastar para mover, duplo clique/toque e botões +/−.
// Fecha ao clicar fora da imagem ou pressionar Esc.
// ─────────────────────────────────────────────────────────

export function PlantaModal({ isOpen, onClose, plantaUrl, modeloNome }: PlantaModalProps) {

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const areaRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchInicial = useRef<{ dist: number; scale: number } | null>(null);
  const arrastando = useRef(false);
  const ultimoPonto = useRef<{ x: number; y: number } | null>(null);
  const ultimoTap = useRef(0);

  const resetar = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);

  // Reset ao abrir/trocar imagem + fecha com Esc
  useEffect(() => {
    if (!isOpen) return;
    resetar();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, plantaUrl, onClose, resetar]);

  const aplicarZoom = useCallback((novoScale: number, cx?: number, cy?: number) => {
    setScale(prev => {
      const s = Math.min(SCALE_MAX, Math.max(SCALE_MIN, novoScale));
      // Zoom centrado no ponto (cx, cy) relativo ao centro da área
      if (cx !== undefined && cy !== undefined && areaRef.current) {
        const rect = areaRef.current.getBoundingClientRect();
        const px = cx - rect.left - rect.width / 2;
        const py = cy - rect.top - rect.height / 2;
        const fator = s / prev;
        setTx(t => px - (px - t) * fator);
        setTy(t => py - (py - t) * fator);
      }
      if (s === 1) { setTx(0); setTy(0); }
      return s;
    });
  }, []);

  // Scroll do mouse — listener nativo (React anexa wheel como passivo)
  useEffect(() => {
    if (!isOpen) return;
    const el = areaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const fator = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      aplicarZoom(scale * fator, e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isOpen, scale, aplicarZoom]);

  // ── Pointer events: arrastar (1 dedo/mouse) + pinça (2 dedos) ──
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchInicial.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
      arrastando.current = false;
    } else if (pointers.current.size === 1) {
      // Duplo toque/clique: alterna 1x ↔ 2.5x
      const agora = Date.now();
      if (agora - ultimoTap.current < 300) {
        aplicarZoom(scale > 1 ? 1 : 2.5, e.clientX, e.clientY);
        ultimoTap.current = 0;
        return;
      }
      ultimoTap.current = agora;
      if (scale > 1) {
        arrastando.current = true;
        ultimoPonto.current = { x: e.clientX, y: e.clientY };
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchInicial.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const centro = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      aplicarZoom(pinchInicial.current.scale * (dist / pinchInicial.current.dist), centro.x, centro.y);
    } else if (arrastando.current && ultimoPonto.current) {
      const dx = e.clientX - ultimoPonto.current.x;
      const dy = e.clientY - ultimoPonto.current.y;
      ultimoPonto.current = { x: e.clientX, y: e.clientY };
      setTx(t => t + dx);
      setTy(t => t + dy);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchInicial.current = null;
    if (pointers.current.size === 0) { arrastando.current = false; ultimoPonto.current = null; }
  };

  const btnStyle: React.CSSProperties = {
    width: 38, height: 38, borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.07)", color: "white",
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
  };

  return (
    <AnimatePresence>
      {isOpen && plantaUrl && (
        <motion.div
          key="planta-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(0,0,0,0.93)", backdropFilter: "blur(10px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}
        >
          {/* HEADER */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            style={{
              width: "100%", maxWidth: 920,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              gap: 10, flexWrap: "wrap", marginBottom: 14,
            }}
          >
            <div>
              <p style={{ fontSize: 10, color: "var(--gray-dark)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em" }}>
                Visualização
              </p>
              {modeloNome && (
                <p style={{ fontSize: 17, fontWeight: 800, color: "white", marginTop: 2 }}>
                  {modeloNome}
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {/* Controles de zoom */}
              <button onClick={() => aplicarZoom(scale / 1.4)} title="Reduzir zoom" style={{ ...btnStyle, opacity: scale <= SCALE_MIN ? 0.4 : 1 }}>
                <ZoomOut size={16} />
              </button>
              <span style={{ minWidth: 48, textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--gray-light)" }}>
                {Math.round(scale * 100)}%
              </span>
              <button onClick={() => aplicarZoom(scale * 1.4)} title="Ampliar zoom" style={{ ...btnStyle, opacity: scale >= SCALE_MAX ? 0.4 : 1 }}>
                <ZoomIn size={16} />
              </button>
              {scale !== 1 && (
                <button onClick={resetar} title="Restaurar tamanho original" style={btnStyle}>
                  <Maximize2 size={15} />
                </button>
              )}

              {/* Abrir em nova aba */}
              <a
                href={plantaUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "var(--gray-light)", fontSize: 12, fontWeight: 600,
                  textDecoration: "none", cursor: "pointer",
                }}
                className="hidden sm:flex"
              >
                <ExternalLink size={13} /> Abrir em nova aba
              </a>

              {/* Fechar */}
              <button onClick={onClose} style={{ ...btnStyle, background: "rgba(255,255,255,0.1)", border: "none" }}>
                <X size={18} />
              </button>
            </div>
          </motion.div>

          {/* ÁREA DA IMAGEM COM ZOOM */}
          <motion.div
            key="planta-image"
            ref={areaRef}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ delay: 0.06, type: "spring", damping: 25, stiffness: 300 }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              width: "100%", maxWidth: 920,
              borderRadius: 16, overflow: "hidden",
              background: "white",
              boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
              height: "min(78vh, 700px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              touchAction: "none",
              cursor: scale > 1 ? "grab" : "zoom-in",
              userSelect: "none",
              position: "relative",
            }}
          >
            <img
              src={plantaUrl}
              alt={`Visualização${modeloNome ? ` — ${modeloNome}` : ""}`}
              draggable={false}
              style={{
                maxWidth: "100%", maxHeight: "100%",
                display: "block",
                objectFit: "contain",
                transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                transformOrigin: "center center",
                transition: arrastando.current || pinchInicial.current ? "none" : "transform 0.15s ease-out",
                pointerEvents: "none",
              }}
            />
          </motion.div>

          {/* Dica */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 14, textAlign: "center" }}
          >
            Use o scroll, a pinça ou o duplo toque para dar zoom · Arraste para mover · Esc para fechar
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}