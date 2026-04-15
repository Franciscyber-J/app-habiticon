"use client";

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  simular, formatBRLDecimal, formatBRL, taxaAnualParaMensal,
  calcularCapacidadeRenda, PRAZO_PADRAO_MESES, COMPROMETIMENTO_MAX_RENDA,
} from "@/lib/calculos";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { TrendingDown, Equal, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

function AnimatedBRL({ value }: { value: number }) {
  const animated = useAnimatedNumber(value, 500);
  return (
    <span>
      {new Intl.NumberFormat("pt-BR", {
        style: "currency", currency: "BRL",
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(animated)}
    </span>
  );
}

interface ComparadorProps {
  valorFinanciado: number;
  taxaAnual: number;
  prazoMeses: number;
  rendaFamiliar?: number; // renda informada no passo 1
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "var(--green-dark)", border: "1px solid var(--border-active)", borderRadius: 10, padding: "10px 14px" }}>
        <p style={{ color: "var(--gray-mid)", fontSize: 12, marginBottom: 4 }}>Mês {label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
            {p.name}: {formatBRLDecimal(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function InfoLine({ label, value, valueColor, last = false }: {
  label: string; value: string; valueColor?: string; last?: boolean;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "9px 0",
      borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.06)",
    }}>
      <span style={{ fontSize: 12, color: "var(--gray-mid)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: valueColor || "var(--gray-light)" }}>{value}</span>
    </div>
  );
}

export function ComparadorSacPrice({ valorFinanciado, taxaAnual, prazoMeses, rendaFamiliar = 0 }: ComparadorProps) {
  const prazoCalculo = Math.min(prazoMeses, PRAZO_PADRAO_MESES);

  const resultado = useMemo(
    () => simular({ valorImovel: valorFinanciado, entrada: 0, prazoMeses: prazoCalculo, taxaAnual, subsidio: 0 }),
    [valorFinanciado, taxaAnual, prazoCalculo]
  );

  const capacidade = useMemo(
    () => calcularCapacidadeRenda(resultado.parcelaPricePrimeira, resultado.parcelaSACPrimeira, rendaFamiliar),
    [resultado, rendaFamiliar]
  );

  // Dados para o gráfico
  const dadosGrafico = useMemo(() => {
    const taxaMensal = taxaAnualParaMensal(taxaAnual);
    const amortizacao = valorFinanciado / prazoCalculo;
    const dados = [];
    const step = Math.max(1, Math.floor(prazoCalculo / 12));
    for (let i = 0; i < prazoCalculo; i += step) {
      const saldoSAC = Math.max(0, valorFinanciado - amortizacao * i);
      const parcelaSAC = amortizacao + saldoSAC * taxaMensal;
      dados.push({ mes: i + 1, SAC: Math.round(parcelaSAC), PRICE: Math.round(resultado.parcelaPricePrimeira) });
    }
    return dados;
  }, [valorFinanciado, taxaAnual, prazoCalculo, resultado]);

  const prazoAnos = Math.round(prazoCalculo / 12);
  const comprometimentoPct = capacidade.comprometimentoAtual * 100;

  // Cores do motor de renda
  const statusConfig = {
    aprovado: { color: "#4ade80", icon: CheckCircle2, label: "Renda aprovada" },
    margem:   { color: "#facc15", icon: AlertTriangle, label: "No limite — PRICE ok, SAC exige mais" },
    insuficiente: { color: "#f87171", icon: XCircle, label: "Renda insuficiente" },
    nao_informada: { color: "var(--gray-mid)", icon: Info, label: "Informe a renda no passo 1" },
  };
  const st = statusConfig[capacidade.status];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

      {/* ── Cards SAC / PRICE ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* SAC */}
        <div style={{
          padding: "26px 26px",
          borderRadius: 16,
          background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(33,57,43,0.4))",
          border: "1px solid rgba(34,197,94,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <TrendingDown size={14} color="#4ade80" />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4ade80" }}>
              SAC
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--gray-light)", marginBottom: 4 }}>
            <AnimatedBRL value={resultado.parcelaSACPrimeira} />
          </div>
          <p style={{ fontSize: 11, color: "var(--gray-mid)", marginBottom: 16 }}>1ª parcela (a maior)</p>
          <div style={{ borderTop: "1px solid rgba(34,197,94,0.15)", paddingTop: 14 }}>
            <InfoLine label="Última parcela" value={formatBRLDecimal(resultado.parcelaSACUltima)} valueColor="#4ade80" />
            <InfoLine label={`${prazoCalculo} parcelas`} value={`${prazoAnos} anos`} last />
          </div>
        </div>

        {/* PRICE */}
        <div style={{
          padding: "26px 26px",
          borderRadius: 16,
          background: "linear-gradient(135deg, rgba(175,111,83,0.12), rgba(33,57,43,0.4))",
          border: "1px solid rgba(175,111,83,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Equal size={14} color="var(--terracota)" />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--terracota)" }}>
              PRICE
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--gray-light)", marginBottom: 4 }}>
            <AnimatedBRL value={resultado.parcelaPricePrimeira} />
          </div>
          <p style={{ fontSize: 11, color: "var(--gray-mid)", marginBottom: 16 }}>Parcela fixa (todas iguais)</p>
          <div style={{ borderTop: "1px solid rgba(175,111,83,0.15)", paddingTop: 14 }}>
            <InfoLine label="Invariável" value="Até o fim" valueColor="var(--terracota)" />
            <InfoLine label={`${prazoCalculo} parcelas`} value={`${prazoAnos} anos`} last />
          </div>
        </div>
      </div>

      {/* ── MOTOR DE RENDA ── */}
      <div style={{
        padding: "24px 28px",
        borderRadius: 14,
        background: `${st.color}10`,
        border: `1px solid ${st.color}30`,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <st.icon size={16} color={st.color} style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: st.color }}>{st.label}</p>
            {rendaFamiliar > 0 && (
              <p style={{ fontSize: 11, color: "var(--gray-mid)", marginTop: 2 }}>
                Renda informada: {formatBRL(rendaFamiliar)} · {comprometimentoPct.toFixed(1)}% comprometido (máx. {(COMPROMETIMENTO_MAX_RENDA * 100).toFixed(0)}%)
              </p>
            )}
          </div>
        </div>

        {/* Linha de comprometimento visual */}
        {rendaFamiliar > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(comprometimentoPct / (COMPROMETIMENTO_MAX_RENDA * 100) * 100, 100)}%`,
                background: st.color,
                borderRadius: 4,
                transition: "width 600ms ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "var(--gray-dark)" }}>0%</span>
              <span style={{ fontSize: 10, color: st.color }}>{comprometimentoPct.toFixed(1)}%</span>
              <span style={{ fontSize: 10, color: "var(--gray-dark)" }}>30% (máx)</span>
            </div>
          </div>
        )}

        {/* Tabela de renda mínima */}
        <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(0,0,0,0.2)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--gray-dark)", marginBottom: 10 }}>
            Renda mínima recomendada (regra 30%)
          </p>
          <InfoLine
            label="Para PRICE (parcela fixa)"
            value={formatBRL(capacidade.rendaMinimaPrice)}
            valueColor={rendaFamiliar >= capacidade.rendaMinimaPrice ? "#4ade80" : "#f87171"}
          />
          <InfoLine
            label="Para SAC (1ª parcela, pior caso)"
            value={formatBRL(capacidade.rendaMinimaSAC)}
            valueColor={rendaFamiliar >= capacidade.rendaMinimaSAC ? "#4ade80" : rendaFamiliar >= capacidade.rendaMinimaPrice ? "#facc15" : "#f87171"}
            last
          />
        </div>

        <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 10, lineHeight: 1.5 }}>
          * Inclui seguros obrigatórios estimados (~R$ 70-100/mês) não exibidos acima. Sujeito à análise de crédito.
        </p>
      </div>

      {/* ── Nota do prazo e taxa ── */}
      <p style={{ fontSize: 11, color: "var(--gray-dark)", textAlign: "center" }}>
        {prazoCalculo} parcelas · {prazoAnos} anos · Taxa {taxaAnual}% a.a. nominal · Máximo MCMV: 420 meses
      </p>

      {/* ── Gráfico ── */}
      <div style={{ padding: "24px 28px", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 16 }}>
          Evolução das parcelas ao longo do tempo
        </p>
        <div style={{ height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dadosGrafico} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="mes" tick={{ fill: "var(--gray-dark)", fontSize: 10 }} tickFormatter={(v) => `M${v}`} />
              <YAxis tick={{ fill: "var(--gray-dark)", fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={32} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="SAC" stroke="#4ade80" strokeWidth={2} dot={false} name="SAC" />
              <Line type="monotone" dataKey="PRICE" stroke="var(--terracota)" strokeWidth={2} dot={false} strokeDasharray="5 5" name="PRICE" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 20, height: 2, background: "#4ade80" }} />
            <span style={{ fontSize: 11, color: "var(--gray-mid)" }}>SAC (decrescente)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 20, height: 2, background: "var(--terracota)", borderTop: "2px dashed" }} />
            <span style={{ fontSize: 11, color: "var(--gray-mid)" }}>PRICE (fixo)</span>
          </div>
        </div>
      </div>

    </div>
  );
}
