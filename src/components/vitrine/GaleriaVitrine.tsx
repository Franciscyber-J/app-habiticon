"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

// ─────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────

interface Foto { url: string; titulo?: string }

interface AmbienteData { ativo: boolean; fotos: Foto[] }

interface GaleriaVitrineProps {
  imagens:   Foto[];    // fachada / renders
  plantas:   Foto[];    // plantas baixas
  ambientes?: Record<string, AmbienteData>;
}

const AMBIENTES_CONFIG = [
  { id: "garagem",         label: "Garagem",          icone: "🚗" },
  { id: "sala",            label: "Sala",              icone: "🛋️" },
  { id: "cozinha",         label: "Cozinha",           icone: "🍳" },
  { id: "copa",            label: "Copa",              icone: "🍽️" },
  { id: "quarto_master",   label: "Quarto Master",     icone: "👑" },
  { id: "banheiro_suite",  label: "Banheiro Suíte",    icone: "🚿" },
  { id: "quarto_solteiro", label: "Quarto Solteiro",   icone: "🛏️" },
  { id: "quarto_2",        label: "Quarto 2",          icone: "🛏️" },
  { id: "banheiro_social", label: "Banheiro Social",   icone: "🚽" },
  { id: "lavanderia",      label: "Lavanderia",        icone: "🧺" },
  { id: "area_gourmet",    label: "Área Gourmet",      icone: "🔥" },
];

// ─────────────────────────────────────────────────────────
// LIGHTBOX (carrossel + zoom)
// ─────────────────────────────────────────────────────────

function Lightbox({
  fotos, index, titulo, onClose,
}: {
  fotos: Foto[]; index: number; titulo: string; onClose: () => void;
}) {
  const [current, setCurrent] = useState(index);
  const [zoom, setZoom] = useState(false);

  const prev = useCallback(() => setCurrent((c) => (c - 1 + fotos.length) % fotos.length), [fotos.length]);
  const next = useCallback(() => setCurrent((c) => (c + 1) % fotos.length), [fotos.length]);

  // Teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  const foto = fotos[current];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.95)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Header */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{titulo}</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
              {current + 1} de {fotos.length}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setZoom(!zoom)}
              style={{
                width: 36, height: 36, borderRadius: 8, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: zoom ? "var(--terracota)" : "rgba(255,255,255,0.12)",
                border: "none", color: "white",
              }}
              title="Zoom"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={onClose}
              style={{
                width: 36, height: 36, borderRadius: 8, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,255,255,0.12)", border: "none", color: "white",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Imagem principal */}
        <div
          style={{
            position: "relative",
            width: zoom ? "100vw" : "min(90vw, 900px)",
            height: zoom ? "100vh" : "min(80vh, 640px)",
            transition: "all 0.3s ease",
            cursor: zoom ? "zoom-out" : "zoom-in",
            overflow: "hidden",
          }}
          onClick={() => setZoom(!zoom)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              style={{ position: "absolute", inset: 0 }}
            >
              <Image
                src={foto.url}
                alt={foto.titulo || titulo}
                fill
                style={{ objectFit: zoom ? "contain" : "contain" }}
                priority
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navegação */}
        {fotos.length > 1 && (
          <>
            <button
              onClick={prev}
              style={{
                position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                width: 44, height: 44, borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,255,255,0.12)", border: "none", color: "white",
                backdropFilter: "blur(8px)",
              }}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={next}
              style={{
                position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                width: 44, height: 44, borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,255,255,0.12)", border: "none", color: "white",
                backdropFilter: "blur(8px)",
              }}
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}

        {/* Miniaturas */}
        {fotos.length > 1 && (
          <div style={{
            position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 8, padding: "8px 12px", borderRadius: 12,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
            maxWidth: "90vw", overflowX: "auto",
          }}>
            {fotos.map((f, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                style={{
                  width: 48, height: 36, borderRadius: 6, cursor: "pointer",
                  border: `2px solid ${i === current ? "var(--terracota)" : "transparent"}`,
                  overflow: "hidden", flexShrink: 0, padding: 0, background: "none",
                  position: "relative",
                }}
              >
                <Image src={f.url} alt="" fill style={{ objectFit: "cover" }} />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────
// GRID DE FOTOS (thumbnail clicável)
// ─────────────────────────────────────────────────────────

function FotoGrid({ fotos, titulo }: { fotos: Foto[]; titulo: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  if (fotos.length === 0) return null;

  return (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 10,
      }}>
        {fotos.map((foto, i) => (
          <button
            key={i}
            onClick={() => setLightbox(i)}
            style={{
              position: "relative", height: 130, borderRadius: 12,
              overflow: "hidden", cursor: "pointer", border: "none", padding: 0,
              background: "rgba(0,0,0,0.3)",
            }}
            className="group"
          >
            <Image src={foto.url} alt={foto.titulo || titulo} fill style={{ objectFit: "cover" }} />
            <div
              style={{
                position: "absolute", inset: 0,
                background: "rgba(0,0,0,0)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 200ms",
              }}
              className="group-hover:bg-black/40"
            >
              <ZoomIn size={22} color="white" style={{ opacity: 0, transition: "opacity 200ms" }} className="group-hover:opacity-100" />
            </div>
          </button>
        ))}
      </div>

      {lightbox !== null && (
        <Lightbox
          fotos={fotos}
          index={lightbox}
          titulo={titulo}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────

export function GaleriaVitrine({ imagens, plantas, ambientes = {} }: GaleriaVitrineProps) {
  const [abaAtiva, setAbaAtiva] = useState<"fachada" | "plantas" | string>("fachada");

  // Ambientes ativos com fotos
  const ambientesAtivos = AMBIENTES_CONFIG.filter(
    (a) => ambientes[a.id]?.ativo && (ambientes[a.id]?.fotos?.length ?? 0) > 0
  );

  const abas = [
    ...(imagens.length > 0 ? [{ id: "fachada", label: "Fachada & Renders", icone: "🏠" }] : []),
    ...(plantas.length > 0  ? [{ id: "plantas", label: "Plantas Baixas",    icone: "📐" }] : []),
    ...ambientesAtivos.map((a) => ({ id: a.id, label: a.label, icone: a.icone })),
  ];

  if (abas.length === 0) return null;

  // Garante que a aba ativa é válida
  const abaValidada = abas.find((a) => a.id === abaAtiva) ? abaAtiva : abas[0]?.id ?? "fachada";

  const fotosAtivas =
    abaValidada === "fachada" ? imagens :
    abaValidada === "plantas"  ? plantas  :
    ambientes[abaValidada]?.fotos ?? [];

  const tituloAtivo = abas.find((a) => a.id === abaValidada)?.label ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Seletor de ambientes — scroll horizontal no mobile */}
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ display: "flex", gap: 8, minWidth: "max-content" }}>
          {abas.map((aba) => {
            const ativo = abaValidada === aba.id;
            return (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "9px 16px", borderRadius: 10, cursor: "pointer",
                  border: `1.5px solid ${ativo ? "var(--border-active)" : "var(--border-subtle)"}`,
                  background: ativo ? "var(--terracota-glow)" : "transparent",
                  color: ativo ? "var(--gray-light)" : "var(--gray-mid)",
                  fontSize: 13, fontWeight: ativo ? 700 : 500,
                  transition: "all 150ms ease", whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: 16 }}>{aba.icone}</span>
                {aba.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grade de fotos */}
      <AnimatePresence mode="wait">
        <motion.div
          key={abaValidada}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {fotosAtivas.length > 0 ? (
            <FotoGrid fotos={fotosAtivas} titulo={tituloAtivo} />
          ) : (
            <div style={{
              padding: "40px 20px", borderRadius: 14, textAlign: "center",
              background: "rgba(0,0,0,0.15)", border: "1px dashed var(--border-subtle)",
            }}>
              <p style={{ fontSize: 14, color: "var(--gray-dark)" }}>
                Nenhuma foto disponível para {tituloAtivo}
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

    </div>
  );
}