"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { calcularJurosObra, formatBRLDecimal, formatBRL } from "@/lib/calculos";
import { Shield, Info } from "lucide-react";

interface ObrasChartProps {
  valorFinanciado: number;
  taxaAnual: number;
  percentuaisPorMes?: number[]; // mantido por compatibilidade, não utilizado mais
  titulo?: string;
  descricao?: string;
  valorLote: number;
  parcelaSAC: number;
  parcelaPRICE: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "var(--green-dark)",
          border: "1px solid var(--border-active)",
          borderRadius: "10px",
          padding: "10px 14px",
          maxWidth: 220,
        }}
      >
        <p style={{ color: "var(--gray-mid)", fontSize: "11px", marginBottom: 4 }}>
          Mês {label} de obra
        </p>
        <p style={{ color: "var(--terracota)", fontSize: "14px", fontWeight: 600 }}>
          {formatBRLDecimal(payload[0]?.value || 0)}/mês
        </p>
        <p style={{ color: "var(--gray-dark)", fontSize: "11px" }}>
          Juros sobre {payload[0]?.payload?.percentual || 0}% liberado
        </p>
      </div>
    );
  }
  return null;
};

export function ObrasEscadaChart({
  valorFinanciado,
  taxaAnual,
  titulo = "Evolução dos Juros de Obra",
  descricao = "Você só paga pelo que a Caixa já vistoriou e liberou na sua obra.",
  valorLote,
  parcelaSAC,
  parcelaPRICE,
}: ObrasChartProps) {
  const [mesSelecionado, setMesSelecionado] = useState<number>(0); // começa com Mês 1 selecionado

  const jurosObra = calcularJurosObra(valorFinanciado, taxaAnual, valorLote);

  const dados = jurosObra.map((j) => ({
    mes: j.mes,
    juros: parseFloat(j.jurosMensal.toFixed(2)),
    percentual: j.percentualLiberado,
    valorLiberado: j.valorLiberado,
    descricao: j.descricao,
  }));

  const mesSel = dados[mesSelecionado];

  // Cores progressivas: verde (baixo) → terracota (alto)
  const cores = ["#4ade80", "#a3e635", "#fbbf24", "#fb923c", "#ef4444"];

  const totalJuros = dados.reduce((acc, d) => acc + d.juros, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Info contextual */}
      <motion.div
        style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 20px", borderRadius: 14, background: "rgba(33,57,43,0.5)", border: "1px solid var(--border-subtle)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Shield size={18} color="var(--terracota)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--gray-light)" }}>{titulo}</p>
          <p style={{ fontSize: 13, color: "var(--gray-mid)", lineHeight: 1.6 }}>{descricao}</p>
        </div>
      </motion.div>

      {/* Alerta: 80% liberado de imediato */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px", borderRadius: 14, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.2)" }}>
        <Info size={16} color="#4ade80" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#4ade80" }}>
            Repasse Inicial (80% do Lote) na Assinatura
          </p>
          <p style={{ fontSize: 13, color: "var(--gray-mid)", lineHeight: 1.6 }}>
            Na assinatura do contrato, a Caixa repassa <strong style={{ color: "var(--gray-light)" }}>{formatBRL(valorLote * 0.80)}</strong> ao proprietário do lote. 
            Isso permite o início imediato do processo. Você paga juros sobre esse aporte inicial e sobre as medições seguintes.
          </p>
        </div>
      </div>

      {/* Gráfico em escada */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 14 }}>
          Juros mensais por fase de obra
        </p>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              onClick={(e) => { if (e && e.activeTooltipIndex !== undefined) setMesSelecionado(e.activeTooltipIndex as number); }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--gray-mid)", fontSize: 12 }} tickFormatter={(v) => `Mês ${v}`} />
              <YAxis tick={{ fill: "var(--gray-dark)", fontSize: 11 }} tickFormatter={(v) => `R$ ${v.toFixed(0)}`} width={72} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="juros" radius={[6, 6, 0, 0]} cursor="pointer">
                {dados.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={cores[index]} opacity={mesSelecionado === index ? 1 : 0.45} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p style={{ fontSize: 11, textAlign: "center", marginTop: 6, color: "var(--gray-dark)" }}>
          Clique em qualquer barra para ver o detalhe
        </p>
      </div>

      {/* Detalhe do Mês Selecionado */}
      <AnimatePresence mode="wait">
        {mesSel && (
          <motion.div
            key={mesSelecionado}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: "20px 22px",
              borderRadius: 14,
              background: `${cores[mesSelecionado]}10`,
              border: `1px solid ${cores[mesSelecionado]}30`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: cores[mesSelecionado], flexShrink: 0 }} />
              <p style={{ fontWeight: 700, fontSize: 13, color: cores[mesSelecionado] }}>
                Mês {mesSel.mes} — {mesSel.descricao}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <p style={{ fontSize: 11, color: "var(--gray-mid)", marginBottom: 8 }}>% Liberado</p>
                <p style={{ fontWeight: 800, fontSize: 22, color: cores[mesSelecionado] }}>{mesSel.percentual}%</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: "var(--gray-mid)", marginBottom: 8 }}>Valor liberado</p>
                <p style={{ fontWeight: 600, fontSize: 14, color: "var(--gray-light)" }}>{formatBRL(mesSel.valorLiberado)}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: "var(--gray-mid)", marginBottom: 8 }}>Juros deste mês</p>
                <p style={{ fontWeight: 800, fontSize: 22, color: "var(--terracota)" }}>{formatBRLDecimal(mesSel.juros)}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Linha do tempo */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 14 }}>
          Linha do tempo da obra
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {dados.map((d, i) => (
            <button
              key={i}
              onClick={() => setMesSelecionado(i)}
              style={{
                padding: "14px 10px",
                borderRadius: 12,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 200ms ease",
                background: mesSelecionado === i ? `${cores[i]}18` : "rgba(0,0,0,0.25)",
                border: `1px solid ${mesSelecionado === i ? cores[i] : "var(--border-subtle)"}`,
                transform: mesSelecionado === i ? "translateY(-2px)" : "none",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: mesSelecionado === i ? cores[i] : "var(--gray-mid)" }}>
                Mês {d.mes}
              </div>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6, color: cores[i] }}>
                {formatBRLDecimal(d.juros)}
              </div>
              <div style={{ fontSize: 11, color: "var(--gray-dark)" }}>
                {d.percentual}%
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Total de juros de obra */}
      <div style={{ padding: "24px 28px", borderRadius: 20, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gray-mid)" }}>
            Total de juros pagos na obra (previsto)
          </p>
          <p style={{ fontSize: 28, fontWeight: 800, color: "var(--terracota)" }}>
            {formatBRLDecimal(totalJuros)}
          </p>
        </div>
        
        <div style={{ paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: 13, color: "var(--gray-mid)", marginBottom: 14 }}>
            Após o Habite-se, o financiamento bancário substitui os juros. Escolha sua modalidade:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", textTransform: "uppercase", marginBottom: 4 }}>Tabela SAC (1ª Parcela)</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRLDecimal(parcelaSAC)}</p>
              <p style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 4 }}>Decrescente até o final</p>
            </div>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(175,111,83,0.08)", border: "1px solid rgba(175,111,83,0.2)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--terracota)", textTransform: "uppercase", marginBottom: 4 }}>Tabela PRICE (Fixa)</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRLDecimal(parcelaPRICE)}</p>
              <p style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 4 }}>Mesmo valor até o final</p>
            </div>
          </div>
        </div>
      </div>

      {/* Nota de execução profissional */}
      <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(33,57,43,0.3)", border: "1px solid var(--border-subtle)", display: "flex", gap: 12 }}>
        <Info size={16} color="var(--gray-dark)" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 11, color: "var(--gray-mid)", lineHeight: 1.6 }}>
          <strong>Nota Técnica:</strong> O cronograma de liberação financeira está estritamente vinculado à evolução física da obra apurada em vistorias mensais da Caixa. 
          O valor de repasse pode variar conforme o ritmo de construção. A última etapa (5% do saldo) é retida por norma bancária e liberada exclusivamente após a averbação do Habite-se.
        </p>
      </div>
    </div>
  );
}
