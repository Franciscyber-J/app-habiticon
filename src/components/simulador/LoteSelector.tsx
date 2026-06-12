"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, X, Check, Map as MapIcon } from "lucide-react";

// ─────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────

interface Lote {
  id: string;
  nome: string;
  tipo: "inteiro" | "fracao";
  medida: string;
  valor: number;
  ativo: boolean;
  isPadrao: boolean;
  modelosVinculados?: string[];
}

interface LoteSelectorProps {
  lotes: Lote[];
  modeloId: string;
  onLoteChange: (lote: { id: string; nome: string; tipo: string; medida: string; valor: number }) => void;
  mapaUrl?: string;                  // imagem do mapa do loteamento (opcional)
  onVerMapa?: (url: string) => void; // abre o visualizador (PlantaModal do pai)
}

const LIMITE_CARDS = 4; // até aqui mostra grid de cards; acima, modo compacto + modal

function TipoBadge({ tipo }: { tipo: string }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: "3px 7px", borderRadius: 6,
      textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0,
      background: tipo === "inteiro" ? "rgba(74,222,128,0.12)" : "rgba(56,189,248,0.12)",
      color: tipo === "inteiro" ? "#4ade80" : "#38bdf8",
    }}>
      {tipo === "inteiro" ? "Inteiro" : "Fração"}
    </span>
  );
}

function DiffLabel({ diff }: { diff: number }) {
  if (diff === 0) return null;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: diff > 0 ? "#fb923c" : "#4ade80" }}>
      {diff > 0 ? "+" : "−"} R$ {Math.abs(diff).toLocaleString("pt-BR")} vs padrão
    </span>
  );
}

function BotaoVerMapa({ onClick, compacto = false }: { onClick: () => void; compacto?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
        padding: compacto ? "6px 12px" : "8px 14px", borderRadius: 8, cursor: "pointer",
        background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)",
        color: "#38bdf8", fontSize: compacto ? 11 : 12, fontWeight: 700,
      }}
    >
      <MapIcon size={compacto ? 12 : 14} /> Ver Mapa
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// COMPONENTE — sempre exatamente 1 lote selecionado
// ─────────────────────────────────────────────────────────

export function LoteSelector({ lotes, modeloId, onLoteChange, mapaUrl, onVerMapa }: LoteSelectorProps) {

  // Lotes visíveis para o modelo atual
  const visiveis = useMemo(() => {
    return lotes.filter(l => {
      if (!l.ativo) return false;
      const vinc = l.modelosVinculados ?? [];
      return vinc.length === 0 || vinc.includes(modeloId);
    });
  }, [lotes, modeloId]);

  const padrao = useMemo(() => {
    return visiveis.find(l => l.isPadrao) || visiveis[0] || null;
  }, [visiveis]);

  const [selId, setSelId] = useState<string | null>(padrao?.id ?? null);
  const [modalAberto, setModalAberto] = useState(false);

  // Ao trocar modelo (ou lista mudar): volta ao padrão e emite
  useEffect(() => {
    if (!padrao) return;
    setSelId(padrao.id);
    onLoteChange({ id: padrao.id, nome: padrao.nome, tipo: padrao.tipo, medida: padrao.medida, valor: padrao.valor });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeloId, padrao?.id, visiveis.length]);

  // Com 0 ou 1 opção não há escolha a fazer — não renderiza nada
  if (visiveis.length <= 1) return null;

  const selecionar = (l: Lote) => {
    setSelId(l.id);
    onLoteChange({ id: l.id, nome: l.nome, tipo: l.tipo, medida: l.medida, valor: l.valor });
  };

  const valorPadrao = padrao?.valor ?? 0;
  const selecionado = visiveis.find(l => l.id === selId) || padrao;
  const modoCompacto = visiveis.length > LIMITE_CARDS;
  const listaOrdenada = [...visiveis].sort((a, b) => a.valor - b.valor);
  const temMapa = Boolean(mapaUrl && onVerMapa);
  const abrirMapa = () => { if (mapaUrl && onVerMapa) onVerMapa(mapaUrl); };

  return (
    <div className="glass-card-nohover">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <div>
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)" }}>
            📐 Escolha o Lote
          </h3>
          <p style={{ fontSize: 12, color: "var(--gray-dark)", marginTop: 6 }}>
            O valor do lote compõe o preço final e o laudo de avaliação.
          </p>
        </div>
        {temMapa && <BotaoVerMapa onClick={abrirMapa} />}
      </div>
      <div style={{ height: 12 }} />

      {/* ══════ MODO CARDS (2 a 4 opções) ══════ */}
      {!modoCompacto && (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {visiveis.map(l => {
            const isSel = selId === l.id;
            return (
              <motion.div
                key={l.id}
                onClick={() => selecionar(l)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  padding: "16px 18px", borderRadius: 14, cursor: "pointer",
                  background: isSel
                    ? "linear-gradient(135deg, rgba(175,111,83,0.18), rgba(33,57,43,0.5))"
                    : "rgba(0,0,0,0.18)",
                  border: isSel ? "2px solid var(--terracota)" : "1px solid var(--border-subtle)",
                  transition: "border-color 0.2s, background 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: isSel ? "var(--terracota-light)" : "var(--gray-light)" }}>
                    {l.nome}
                  </p>
                  <TipoBadge tipo={l.tipo} />
                </div>
                {l.medida && <p style={{ fontSize: 11, color: "var(--gray-mid)", marginBottom: 8 }}>{l.medida}</p>}
                <p style={{ fontSize: 16, fontWeight: 800, color: isSel ? "var(--terracota)" : "var(--gray-light)" }}>
                  R$ {l.valor.toLocaleString("pt-BR")}
                </p>
                <div style={{ marginTop: 4 }}><DiffLabel diff={l.valor - valorPadrao} /></div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ══════ MODO COMPACTO (5+ opções): resumo do selecionado + botão Trocar ══════ */}
      {modoCompacto && selecionado && (
        <motion.div
          onClick={() => setModalAberto(true)}
          whileTap={{ scale: 0.99 }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            padding: "16px 18px", borderRadius: 14, cursor: "pointer",
            background: "linear-gradient(135deg, rgba(175,111,83,0.16), rgba(33,57,43,0.45))",
            border: "2px solid var(--terracota)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--terracota-light)" }}>{selecionado.nome}</p>
              <TipoBadge tipo={selecionado.tipo} />
              {selecionado.medida && <span style={{ fontSize: 11, color: "var(--gray-mid)" }}>{selecionado.medida}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <p style={{ fontSize: 17, fontWeight: 800, color: "var(--terracota)" }}>
                R$ {selecionado.valor.toLocaleString("pt-BR")}
              </p>
              <DiffLabel diff={selecionado.valor - valorPadrao} />
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
            padding: "9px 14px", borderRadius: 10,
            background: "var(--terracota)", color: "white",
            fontSize: 12, fontWeight: 800,
          }}>
            Trocar <ChevronRight size={14} />
          </div>
        </motion.div>
      )}

      {modoCompacto && (
        <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 10, textAlign: "center" }}>
          {visiveis.length} opções de lote disponíveis para este modelo
        </p>
      )}

      {/* ══════ MODAL DE ESCOLHA ══════ */}
      <AnimatePresence>
        {modalAberto && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setModalAberto(false); }}
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              padding: "20px 0 0",
            }}
            className="sm:!items-center sm:!p-5"
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{
                background: "var(--bg-card, #17271C)", width: "100%", maxWidth: 480,
                borderRadius: "20px 20px 0 0", border: "1px solid var(--border-subtle)",
                display: "flex", flexDirection: "column", maxHeight: "82vh", overflow: "hidden",
              }}
              className="sm:!rounded-[20px]"
            >
              {/* Header */}
              <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.2)", flexShrink: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "white" }}>📐 Escolha o Lote</h3>
                  <p style={{ fontSize: 11, color: "var(--gray-mid)", marginTop: 2 }}>{visiveis.length} opções · ordenadas por valor</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {temMapa && <BotaoVerMapa onClick={abrirMapa} compacto />}
                  <button onClick={() => setModalAberto(false)} style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)", color: "var(--gray-light)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Lista */}
              <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {listaOrdenada.map(l => {
                  const isSel = selId === l.id;
                  const diff = l.valor - valorPadrao;
                  return (
                    <button
                      key={l.id}
                      onClick={() => { selecionar(l); setModalAberto(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, width: "100%",
                        padding: "14px 16px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                        background: isSel ? "var(--terracota-glow, rgba(175,111,83,0.12))" : "rgba(0,0,0,0.18)",
                        border: isSel ? "1.5px solid var(--terracota)" : "1px solid var(--border-subtle)",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: isSel ? "var(--terracota)" : "rgba(255,255,255,0.06)",
                        border: isSel ? "none" : "1px solid var(--border-subtle)",
                      }}>
                        {isSel && <Check size={13} color="white" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isSel ? "var(--terracota-light)" : "var(--gray-light)" }}>{l.nome}</span>
                          <TipoBadge tipo={l.tipo} />
                          {l.isPadrao && (
                            <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 7px", borderRadius: 6, textTransform: "uppercase", background: "rgba(255,255,255,0.06)", color: "var(--gray-mid)" }}>
                              ★ Padrão
                            </span>
                          )}
                        </div>
                        {l.medida && <p style={{ fontSize: 11, color: "var(--gray-mid)", marginTop: 2 }}>{l.medida}</p>}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: isSel ? "var(--terracota)" : "var(--gray-light)" }}>
                          R$ {l.valor.toLocaleString("pt-BR")}
                        </p>
                        <DiffLabel diff={diff} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0, background: "rgba(0,0,0,0.15)" }}>
                <button
                  onClick={() => setModalAberto(false)}
                  style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: "pointer", background: "var(--terracota)", color: "white", fontSize: 14, fontWeight: 800 }}
                >
                  Confirmar Seleção
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}