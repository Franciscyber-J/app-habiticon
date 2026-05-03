"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { calcularSubsidio, formatBRL, type FaixaMCMV } from "@/lib/calculos";
import { Info, AlertTriangle, Building2 } from "lucide-react";

interface SubsidioGaugeProps {
  faixas: FaixaMCMV[];
  onSubsidioChange?: (subsidio: number, taxa: number, rendaDigitada: boolean, renda: number, faixaId?: number) => void;
  initialRenda?: number;
  valorImovel: number;
  tetoMcmv: number;
}

// Cor por posição na lista de faixas (não mais por id fixo)
const CORES_GAUGE = ["#4ade80", "#a3e635", "#fb923c", "#f43f5e"];
const COR_SBPE = "#3b82f6"; // Azul premium para Alto Padrão (SBPE)

export function SubsidioGauge({
  faixas,
  onSubsidioChange,
  initialRenda,
  valorImovel,
  tetoMcmv,
}: SubsidioGaugeProps) {
  const [renda, setRenda] = useState(() => {
    if (!initialRenda) return "";
    return new Intl.NumberFormat("pt-BR").format(initialRenda);
  });

  const rendaNum = parseFloat(renda.replace(/\D/g, "")) || 0;
  
  // Calcula o teto máximo de renda do MCMV baseado nas faixas
  const maxRenda = faixas[faixas.length - 1]?.rendaMax || 13000;
  
  // Gatilho SBPE: Se a renda ou o imóvel passarem do limite MCMV
  const isSBPE = rendaNum > maxRenda || valorImovel > tetoMcmv;

  const resultado = useMemo(() => {
    if (rendaNum <= 0) return null;
    return calcularSubsidio(rendaNum, faixas);
  }, [rendaNum, faixas]);

  const faixaAtual = resultado?.faixa ?? null;
  const subsidio   = isSBPE ? 0 : (resultado?.subsidio ?? 0);
  const taxa       = isSBPE ? 11.38 : (resultado?.taxa ?? 12); // 11.38 é fallback. O parent controla a taxa real SBPE

  // Índice da faixa atual na lista (0-based)
  const faixaIdx = faixaAtual ? faixas.findIndex((f) => f.id === faixaAtual.id) : -1;
  
  // Controle de cores e percentual da barra inteligente (SBPE vs MCMV)
  const gaugeColor = isSBPE ? COR_SBPE : (faixaIdx >= 0 ? CORES_GAUGE[faixaIdx] ?? "#fb923c" : "var(--gray-mid)");
  const gaugePct = isSBPE ? 100 : Math.min((rendaNum / maxRenda) * 100, 100);

  // Isolamos a variável primitiva para blindar o useEffect contra re-renders (Evita o erro de tamanho de array do HMR)
  const faixaId = isSBPE ? undefined : faixaAtual?.id;

  useEffect(() => {
    onSubsidioChange?.(subsidio, taxa, rendaNum > 0, rendaNum, faixaId);
  }, [subsidio, taxa, rendaNum, onSubsidioChange, faixaId]);

  const formatInput = (val: string) => {
    const num = val.replace(/\D/g, "");
    if (!num) return "";
    return new Intl.NumberFormat("pt-BR").format(parseInt(num));
  };

  return (
    <div className="space-y-10">

      {/* ── Input de Renda ─────────────────────────────── */}
      <div>
        <label className="text-sm font-bold mb-4 block" style={{ color: "var(--gray-light)" }}>
          Renda Bruta Familiar Mensal
        </label>
        <div className="relative">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-lg" style={{ color: isSBPE ? COR_SBPE : "var(--terracota)" }}>
            R$
          </span>
          <input
            type="text"
            className="input-field"
            style={{ 
              paddingLeft: "4.5rem", 
              fontSize: 20, 
              height: 60,
              borderColor: isSBPE ? `${COR_SBPE}50` : undefined,
              boxShadow: isSBPE ? `0 0 0 1px ${COR_SBPE}30` : undefined
            }}
            placeholder="0"
            value={renda}
            onChange={(e) => setRenda(formatInput(e.target.value))}
            inputMode="numeric"
          />
        </div>
        {/* Nota informativa */}
        <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <Info size={11} />
          {isSBPE 
            ? "O perfil informado acionou a transição para a Linha SBPE (Alto Padrão)."
            : `Programa MCMV — Faixas disponíveis: ${faixas.map(f => f.nome).join(", ")} · até R$ ${maxRenda.toLocaleString("pt-BR")}/mês`
          }
        </p>
      </div>

      {/* ── Alerta de Teto Inteligente (Imóvel Fora do MCMV) ────────────── */}
      {valorImovel > tetoMcmv && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", display: "flex", gap: 14, alignItems: "center" }}
        >
          <Building2 size={18} color={COR_SBPE} style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "#93c5fd", lineHeight: 1.5 }}>
            O valor deste imóvel (R$ {valorImovel.toLocaleString("pt-BR")}) excede o teto MCMV (R$ {tetoMcmv.toLocaleString("pt-BR")}). <strong>Transição automática para a Linha SBPE.</strong>
          </p>
        </motion.div>
      )}

      {/* ── Gauge + Resultado ──────────────────────────── */}
      <AnimatePresence>
        {rendaNum > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            style={{ display: "flex", flexDirection: "column", gap: 28 }}
          >

            {/* Barra de progresso com labels dinâmicos */}
            <div style={{ padding: "0 4px" }}>
              {/* Labels: gerados da lista de faixas */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                {faixas.map((f, i) => (
                  <span key={f.id} style={{
                    fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em",
                    color: !isSBPE && faixaAtual?.id === f.id ? CORES_GAUGE[i] : "var(--gray-dark)",
                    transition: "color 0.3s",
                  }}>
                    {f.nome}
                  </span>
                ))}
                {/* Indicador SBPE na ponta da régua */}
                <span style={{
                  fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em",
                  color: isSBPE ? COR_SBPE : "var(--gray-dark)",
                  transition: "color 0.3s",
                }}>
                  SBPE
                </span>
              </div>

              {/* Barra */}
              <div style={{ position: "relative", height: 14, borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
                {/* Divisores entre faixas */}
                {faixas.map((f) => (
                  <div key={f.id} style={{
                    position: "absolute", top: 0, bottom: 0, width: 1,
                    left: `${(f.rendaMax / maxRenda) * 100}%`,
                    background: "rgba(255,255,255,0.12)",
                  }} />
                ))}
                {/* Preenchimento animado */}
                <motion.div
                  style={{ position: "absolute", inset: "0 auto 0 0", borderRadius: 8, boxShadow: `0 0 14px ${gaugeColor}50` }}
                  animate={{ width: `${gaugePct}%`, backgroundColor: gaugeColor }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>

              {/* Valores limite abaixo da barra */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 9, color: "var(--gray-dark)" }}>R$ 0</span>
                {faixas.map((f) => (
                  <span key={f.id} style={{ fontSize: 9, color: "var(--gray-dark)" }}>
                    R$ {(f.rendaMax / 1000).toFixed(1)}k
                  </span>
                ))}
              </div>
            </div>

            {/* Cards de resultado */}
            {isSBPE ? (
              /* CARD MODO SBPE */
              <motion.div
                key="sbpe"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}
              >
                {/* Enquadramento */}
                <div style={{ padding: "20px 16px", borderRadius: 16, textAlign: "center", background: "rgba(59, 130, 246, 0.08)", border: `1px solid rgba(59, 130, 246, 0.3)` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#60a5fa", marginBottom: 8 }}>
                    Enquadramento
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: COR_SBPE }}>
                    Linha SBPE
                  </div>
                  <div style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 4 }}>
                    Fora do MCMV
                  </div>
                </div>

                {/* Subsídio */}
                <div style={{ padding: "20px 16px", borderRadius: 16, textAlign: "center", background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--gray-dark)", marginBottom: 8 }}>
                    Subsídio
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "var(--gray-dark)" }}>
                    —
                  </div>
                  <div style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 4 }}>
                    Não aplicável
                  </div>
                </div>

                {/* Taxa */}
                <div style={{ padding: "20px 16px", borderRadius: 16, textAlign: "center", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--gray-dark)", marginBottom: 8 }}>
                    Taxa de Juros
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#60a5fa" }}>
                    Taxa Balcão
                  </div>
                  <div style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 4 }}>
                    SBPE
                  </div>
                </div>
              </motion.div>
            ) : faixaAtual ? (
              /* CARD MODO MCMV (Original) */
              <motion.div
                key={faixaAtual.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}
              >
                {/* Enquadramento */}
                <div style={{ padding: "20px 16px", borderRadius: 16, textAlign: "center", background: "rgba(0,0,0,0.2)", border: `1px solid ${faixaAtual.cor}30` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--gray-dark)", marginBottom: 8 }}>
                    Enquadramento
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: faixaAtual.cor }}>
                    {faixaAtual.nome}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 4 }}>
                    até R$ {faixaAtual.rendaMax.toLocaleString("pt-BR")}
                  </div>
                </div>

                {/* Subsídio */}
                <div style={{ padding: "20px 16px", borderRadius: 16, textAlign: "center", background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--gray-dark)", marginBottom: 8 }}>
                    Subsídio MCMV
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: subsidio > 0 ? "#4ade80" : "var(--gray-dark)" }}>
                    {subsidio > 0 ? formatBRL(subsidio) : "—"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 4 }}>
                    {subsidio > 0 ? "desconto direto" : "sem subsídio"}
                  </div>
                </div>

                {/* Taxa */}
                <div style={{ padding: "20px 16px", borderRadius: 16, textAlign: "center", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--gray-dark)", marginBottom: 8 }}>
                    Taxa de Juros
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "var(--terracota)" }}>
                    {taxa}% a.a.
                  </div>
                  <div style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 4 }}>
                    nominal · MCMV
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Fallback (Quase impossível de acontecer com a nova lógica SBPE) */
              <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", gap: 10, alignItems: "center" }}>
                <AlertTriangle size={15} color="#f87171" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.5 }}>
                  Erro ao enquadrar.
                </p>
              </div>
            )}

            {/* Nota informativa */}
            <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-subtle)", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Info size={16} color="var(--gray-dark)" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11, color: "var(--gray-dark)", lineHeight: 1.6 }}>
                Simulação baseada nas regras vigentes da Caixa Econômica Federal.
                Valores e taxas sujeitos à análise de crédito e aprovação.
              </p>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}