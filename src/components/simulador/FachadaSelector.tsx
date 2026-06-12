"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

// ─────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────

interface Fachada {
  id: string;
  nome: string;
  imagemUrl: string;
  diferencaPreco: number;
  ativo: boolean;
  isPadrao: boolean;
}

interface FachadaSelectorProps {
  modeloId: string;
  modeloNome: string;
  fachadas: Fachada[];
  onFachadaChange: (modeloId: string, fachada: { id: string; nome: string; diferencaPreco: number }) => void;
  onZoom?: (url: string, nome: string) => void;
}

// ─────────────────────────────────────────────────────────
// COMPONENTE — vive dentro do card do modelo
// Todos os cliques usam stopPropagation para não disparar
// a seleção do card.
// ─────────────────────────────────────────────────────────

export function FachadaSelector({ modeloId, modeloNome, fachadas, onFachadaChange, onZoom }: FachadaSelectorProps) {

  const ativas = useMemo(() => fachadas.filter(f => f.ativo), [fachadas]);

  const idxPadrao = useMemo(() => {
    const i = ativas.findIndex(f => f.isPadrao);
    return i >= 0 ? i : 0;
  }, [ativas]);

  const [idx, setIdx] = useState(idxPadrao);
  const [direcao, setDirecao] = useState(0);

  // Emite a fachada inicial (padrão) ao montar / quando lista muda
  useEffect(() => {
    setIdx(idxPadrao);
    const f = ativas[idxPadrao];
    if (f) onFachadaChange(modeloId, { id: f.id, nome: f.nome, diferencaPreco: f.diferencaPreco });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idxPadrao, ativas.length, modeloId]);

  if (ativas.length === 0) return null;

  const atual = ativas[Math.min(idx, ativas.length - 1)];

  const irPara = (novoIdx: number, dir: number) => {
    const i = (novoIdx + ativas.length) % ativas.length;
    setDirecao(dir);
    setIdx(i);
    const f = ativas[i];
    onFachadaChange(modeloId, { id: f.id, nome: f.nome, diferencaPreco: f.diferencaPreco });
  };

  const badgeTexto = atual.diferencaPreco === 0
    ? "Padrão"
    : atual.diferencaPreco > 0
      ? `+ R$ ${atual.diferencaPreco.toLocaleString("pt-BR")}`
      : `− R$ ${Math.abs(atual.diferencaPreco).toLocaleString("pt-BR")}`;

  const badgeCor = atual.diferencaPreco === 0
    ? { bg: "rgba(255,255,255,0.12)", fg: "var(--gray-light)" }
    : atual.diferencaPreco > 0
      ? { bg: "rgba(74,222,128,0.18)", fg: "#4ade80" }
      : { bg: "rgba(251,146,60,0.18)", fg: "#fb923c" };

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Imagem da fachada com animação de slide */}
      <AnimatePresence initial={false} custom={direcao} mode="popLayout">
        <motion.div
          key={atual.id}
          custom={direcao}
          initial={{ x: direcao > 0 ? 60 : -60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direcao > 0 ? -60 : 60, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          style={{ position: "absolute", inset: 0 }}
        >
          {atual.imagemUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={atual.imagemUrl}
              alt={`${modeloNome} — ${atual.nome}`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
              🏠
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Badge de preço — topo esquerdo */}
      <div style={{
        position: "absolute", top: 10, left: 10, zIndex: 2,
        padding: "4px 10px", borderRadius: 8,
        background: badgeCor.bg, color: badgeCor.fg,
        fontSize: 11, fontWeight: 800, letterSpacing: "0.03em",
        backdropFilter: "blur(8px)",
      }}>
        {badgeTexto}
      </div>

      {/* Zoom — topo direito */}
      {onZoom && atual.imagemUrl && (
        <button
          onClick={(e) => { e.stopPropagation(); onZoom(atual.imagemUrl, `${modeloNome} — ${atual.nome}`); }}
          style={{
            position: "absolute", top: 10, right: 10, zIndex: 2,
            width: 30, height: 30, borderRadius: 8, cursor: "pointer",
            background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)",
            color: "white", display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)",
          }}
        >
          <ZoomIn size={15} />
        </button>
      )}

      {/* Navegação — só se houver mais de uma fachada */}
      {ativas.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); irPara(idx - 1, -1); }}
            style={{
              position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", zIndex: 2,
              width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
              background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.15)",
              color: "white", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); irPara(idx + 1, 1); }}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", zIndex: 2,
              width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
              background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.15)",
              color: "white", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ChevronRight size={16} />
          </button>

          {/* Dots + nome da fachada — rodapé */}
          <div style={{
            position: "absolute", bottom: 8, left: 0, right: 0, zIndex: 2,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: "white",
              padding: "2px 8px", borderRadius: 6,
              background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
            }}>
              {atual.nome}
            </span>
            <div style={{ display: "flex", gap: 5 }}>
              {ativas.map((f, i) => (
                <button
                  key={f.id}
                  onClick={(e) => { e.stopPropagation(); irPara(i, i > idx ? 1 : -1); }}
                  style={{
                    width: i === idx ? 16 : 6, height: 6, borderRadius: 3,
                    border: "none", cursor: "pointer", padding: 0,
                    background: i === idx ? "var(--terracota)" : "rgba(255,255,255,0.45)",
                    transition: "all 0.25s",
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}