"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, FileText, AlertTriangle, Percent, CheckCircle2, SlidersHorizontal, Info } from "lucide-react";
import {
  formatBRL, formatBRLDecimal,
  parcelamentoCartao, parcelamentoBoleto,
  C6_MDR, C6_ADICIONAL_PARCELA,
  calcularEntradaEmbutida,
} from "@/lib/calculos";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

interface ResultCardsProps {
  valorImovel: number;
  entrada: number;
  subsidio: number;
  atoPercent: number;           // 0.50 a 1.00
  onAtoPercentChange: (v: number) => void;
}

function AnimatedValue({ value, prefix = "R$ " }: { value: number; prefix?: string }) {
  const animated = useAnimatedNumber(value, 450, "easeOut");
  return (
    <span>
      {prefix}
      {animated.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
    </span>
  );
}

function InfoLine({ label, value, valueColor, last = false }: {
  label: string; value: string; valueColor?: string; last?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0",
      borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.06)",
    }}>
      <span style={{ fontSize: 13, color: "var(--gray-mid)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: valueColor || "var(--gray-light)" }}>{value}</span>
    </div>
  );
}

export function ResultCards({ valorImovel, entrada, subsidio, atoPercent, onAtoPercentChange }: ResultCardsProps) {
  const [tabAtiva, setTabAtiva] = useState<"cartao" | "boleto">("cartao");

  const ato = entrada * atoPercent;
  const restanteEntrada = entrada - ato;
  const valorFinanciado = Math.max(0, valorImovel - entrada - subsidio);

  // Dados entrada embutida para info
  const embutida = calcularEntradaEmbutida(valorImovel, entrada, subsidio);

  const cartao = parcelamentoCartao(restanteEntrada, 5);
  const boleto = parcelamentoBoleto(restanteEntrada, 5);
  const taxaTotalC6Pct = ((C6_MDR + C6_ADICIONAL_PARCELA) * 100).toFixed(2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Card: Ato (editável 50–100%) ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: "22px 24px",
          borderRadius: 16,
          background: "linear-gradient(135deg, rgba(175,111,83,0.15), var(--bg-card))",
          border: "1px solid rgba(175,111,83,0.4)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--terracota)", marginBottom: 3 }}>
              Ato mínimo
            </p>
            <p style={{ fontSize: 12, color: "var(--gray-mid)" }}>
              Pago na assinatura do contrato
            </p>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: "var(--terracota-glow)", color: "var(--terracota-light)", border: "1px solid var(--border-active)",
          }}>
            <SlidersHorizontal size={11} />
            {(atoPercent * 100).toFixed(0)}%
          </div>
        </div>

        {/* Valor animado */}
        <div style={{ fontSize: 36, fontWeight: 800, color: "var(--terracota)", marginBottom: 18, lineHeight: 1 }}>
          <AnimatedValue value={ato} />
        </div>

        {/* Slider do percentual do ato */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--gray-dark)" }}>Mínimo (50%)</span>
            <span style={{ fontSize: 11, color: "var(--gray-dark)" }}>Tudo no ato (100%)</span>
          </div>
          <input
            type="range"
            className="slider-custom"
            min={50}
            max={100}
            step={5}
            value={Math.round(atoPercent * 100)}
            onChange={(e) => onAtoPercentChange(Number(e.target.value) / 100)}
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 12, color: "var(--gray-mid)" }}>Parcela: <strong style={{ color: "var(--gray-light)" }}>{formatBRL(restanteEntrada)}</strong></span>
            <span style={{ fontSize: 12, color: "var(--gray-mid)" }}>Ato: <strong style={{ color: "var(--terracota)" }}>{(atoPercent * 100).toFixed(0)}%</strong></span>
          </div>
        </div>
      </motion.div>

      {/* ── Card: Parcelamento do restante ── */}
      <AnimatePresence>
        {restanteEntrada > 0 && (
          <motion.div
            key="parcelamento"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              padding: "22px 24px",
              borderRadius: 16,
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-card)",
              overflow: "hidden",
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 4 }}>
              Restante da entrada · {(100 - atoPercent * 100).toFixed(0)}%
            </p>
            <p style={{ fontSize: 13, color: "var(--gray-mid)", marginBottom: 18 }}>
              Valor a parcelar: <strong style={{ color: "var(--gray-light)" }}>{formatBRL(restanteEntrada)}</strong>
            </p>

            {/* Tabs */}
            <div className="tab-group" style={{ marginBottom: 20 }}>
              <button className={`tab-item flex items-center justify-center gap-2 ${tabAtiva === "cartao" ? "active" : ""}`} onClick={() => setTabAtiva("cartao")}>
                <CreditCard size={13} />Cartão 5x
              </button>
              <button className={`tab-item flex items-center justify-center gap-2 ${tabAtiva === "boleto" ? "active" : ""}`} onClick={() => setTabAtiva("boleto")}>
                <FileText size={13} />Boleto 5x
              </button>
            </div>

            <AnimatePresence mode="wait">
              {/* ── Cartão ── */}
              {tabAtiva === "cartao" && (
                <motion.div key="c" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 30, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRLDecimal(cartao.parcelaComJuros)}</span>
                      <span style={{ fontSize: 13, color: "var(--gray-mid)" }}>/parcela</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--gray-mid)" }}>5x no cartão · maquininha C6 · taxa embutida</p>
                  </div>
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-subtle)" }}>
                    <InfoLine label="Valor parcelado" value={formatBRL(restanteEntrada)} />
                    <InfoLine label="Taxa MDR" value={`${(C6_MDR * 100).toFixed(2)}%`} />
                    <InfoLine label="Adicional por parcela" value={`${(C6_ADICIONAL_PARCELA * 100).toFixed(2)}%`} />
                    <InfoLine label="Total com taxas (5x)" value={formatBRLDecimal(cartao.totalComJuros)} />
                    <InfoLine label={`Custo total (${taxaTotalC6Pct}%)`} value={formatBRLDecimal(cartao.totalJuros)} valueColor="#fb923c" last />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <CheckCircle2 size={13} color="#4ade80" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 12, color: "var(--gray-mid)", lineHeight: 1.5 }}>Opção preferencial. Pagamento garantido via maquininha C6.</p>
                  </div>
                </motion.div>
              )}

              {/* ── Boleto ── */}
              {tabAtiva === "boleto" && (
                <motion.div key="b" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 30, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRLDecimal(boleto.parcelaPorParcela)}</span>
                      <span style={{ fontSize: 13, color: "var(--gray-mid)" }}>/parcela</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--gray-mid)" }}>5x no boleto · 1,99% a.m. · Tabela Price (CDC)</p>
                  </div>
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-subtle)" }}>
                    <InfoLine label="Valor parcelado" value={formatBRL(restanteEntrada)} />
                    <InfoLine label="Taxa de crédito" value="1,99% a.m. (CDC)" />
                    <InfoLine label="Total com juros (5x)" value={formatBRLDecimal(boleto.totalComJuros)} />
                    <InfoLine label="Custo total dos juros" value={formatBRLDecimal(boleto.totalJuros)} valueColor="#fb923c" last />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)" }}>
                    <Info size={13} color="var(--gray-dark)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 12, color: "var(--gray-mid)", lineHeight: 1.5 }}>
                      Emitido pela construtora via boleto bancário (Tabela Price).
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Ato = 100%: tudo pago à vista */}
        {restanteEntrada === 0 && (
          <motion.div
            key="avista"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              padding: "16px 20px", borderRadius: 14,
              background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
              display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <CheckCircle2 size={18} color="#4ade80" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: "#4ade80" }}>
              Entrada paga integralmente no ato — sem parcelamento necessário.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Card: Saldo a Financiar + Entrada Embutida ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        style={{
          padding: "20px 24px",
          borderRadius: 16,
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 14 }}>
          Composição do Financiamento Caixa
        </p>
        <InfoLine label="Valor contratual (imóvel)" value={formatBRL(embutida.valorContratual)} />
        <InfoLine label="Valor avaliado estimado (laudo)" value={formatBRL(embutida.valorAvaliadoCaixa)} valueColor="var(--terracota)" />
        <InfoLine label="Cota Caixa (80% do avaliado)" value={formatBRL(embutida.cotaCaixa)} valueColor="#4ade80" />
        <InfoLine label="Entrada real do comprador" value={formatBRL(embutida.entradaRealComprador)} />
        {embutida.entradaEmbutida > 0 && (
          <InfoLine label="Entrada embutida na avaliação" value={formatBRL(embutida.entradaEmbutida)} valueColor="#facc15" />
        )}
        {subsidio > 0 && (
          <InfoLine label="Subsídio MCMV estimado" value={formatBRL(subsidio)} valueColor="#4ade80" />
        )}
        <div style={{ paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-mid)" }}>Saldo a financiar</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: "var(--gray-light)" }}>
              <AnimatedValue value={Math.max(0, valorFinanciado)} />
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
