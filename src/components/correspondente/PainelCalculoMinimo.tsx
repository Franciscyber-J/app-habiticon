"use client";

import { useMemo, useState } from "react";
import { Target, Layers, Info, AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { formatBRL, calcularLaudoCUB, COTA_MAXIMA_CAIXA } from "@/lib/calculos";

// ─────────────────────────────────────────────────────────
// PainelCalculoMinimo — o que o correspondente PRECISA saber.
// Cálculo BRUTO (sem subsídio, sem trava de renda).
//   contrato          = loteReserva.valorVenda → lead.valorImovel → modelo.valor
//   entradaMin        = empreendimento.simulador.entradaMin
//   repasseNecessario = contrato − entradaMin
//   laudoMinimo       = repasseNecessario / 0,80
//   ── entrada embutida (calcularLaudoCUB) ──
//   laudoCUB   = (área × CUB × (1+BDI)) + valorLote
//   maxFinCUB  = laudoCUB × 0,80
//   entradaEmbutida = max(entradaMin, contrato − maxFinCUB)
// ─────────────────────────────────────────────────────────

interface PainelCalculoMinimoProps {
  lead: any;
  empreendimento: any;
}

export function PainelCalculoMinimo({ lead, empreendimento }: PainelCalculoMinimoProps) {
  const [abrirBruto, setAbrirBruto] = useState(false);
  const [abrirCUB, setAbrirCUB] = useState(false);

  const dados = useMemo(() => {
    if (!empreendimento) return null;

    const sim = empreendimento.simulador || {};
    const entradaMin: number = Number(sim.entradaMin) || 0;
    const reserva = lead?.loteReserva || null;

    const modelos: any[] = empreendimento.modelos || [];
    const modeloPorId = reserva?.modeloId ? modelos.find(m => m.id === reserva.modeloId) : null;
    const modeloPorNome = lead?.modelo ? modelos.find(m => m.nome === lead.modelo) : null;
    const modelo = modeloPorId || modeloPorNome || null;

    let contrato = 0;
    let origemContrato = "";
    if (reserva && typeof reserva.valorVenda === "number" && reserva.valorVenda > 0) {
      contrato = reserva.valorVenda; origemContrato = "lote vinculado";
    } else if (typeof lead?.valorImovel === "number" && lead.valorImovel > 0) {
      contrato = lead.valorImovel; origemContrato = "valor anunciado";
    } else if (modelo?.valor) {
      contrato = modelo.valor; origemContrato = "modelo selecionado";
    }

    const valorLote = (typeof reserva?.fracaoValor === "number" && reserva.fracaoValor > 0 ? reserva.fracaoValor : null)
      ?? (typeof modelo?.valorLote === "number" ? modelo.valorLote : null) ?? 0;
    const area = Number(modelo?.area) || 0;

    const repasseNecessario = Math.max(0, contrato - entradaMin);
    const laudoMinimo = repasseNecessario / COTA_MAXIMA_CAIXA;

    const cub = sim.cub || {};
    const cubVigente = Number(cub.cubVigente) || 0;
    const bdi = typeof cub.bdi === "number" ? cub.bdi : 0.18;
    const temCUB = cubVigente > 0 && area > 0;

    let laudoCUB = 0, maxFinCUB = 0, entradaEmbutida = entradaMin, cubCobre = false;
    if (temCUB) {
      const r = calcularLaudoCUB(valorLote, area, cubVigente, bdi, 0, COTA_MAXIMA_CAIXA, 0);
      laudoCUB = r.laudoTotal;
      maxFinCUB = r.maxFinanciamento;
      entradaEmbutida = Math.max(entradaMin, contrato - maxFinCUB);
      cubCobre = maxFinCUB >= (contrato - entradaMin);
    }

    return {
      contrato, origemContrato, entradaMin, repasseNecessario, laudoMinimo,
      temCUB, laudoCUB, maxFinCUB, entradaEmbutida, cubCobre,
      area, valorLote, cubVigente, bdi, semContrato: contrato <= 0,
      bdiPct: Math.round(bdi * 100),
    };
  }, [lead, empreendimento]);

  if (!dados) {
    return (
      <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
        <p style={{ fontSize: 12, color: "var(--gray-dark)" }}>Carregando dados do empreendimento…</p>
      </div>
    );
  }

  if (dados.semContrato) {
    return (
      <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border-subtle)", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <AlertTriangle size={15} color="var(--gray-mid)" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: "var(--gray-mid)", lineHeight: 1.5 }}>
          Sem valor de contrato definido. Assim que o corretor vincular um lote ou definir o modelo, o cálculo mínimo aparece aqui.
        </p>
      </div>
    );
  }

  const headerBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    padding: "12px 14px", background: "transparent", border: "none",
    cursor: "pointer", textAlign: "left",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* CARD 1: CÁLCULO MÍNIMO (recolhível) */}
      <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
        <button onClick={() => setAbrirBruto(v => !v)} style={headerBtn}>
          <Target size={15} color="var(--gray-light)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-light)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Cálculo Mínimo Necessário</span>
          {!abrirBruto && (
            <span style={{ fontSize: 11, color: "var(--gray-mid)", marginLeft: "auto", whiteSpace: "nowrap" }}>
              Laudo mín. <strong style={{ color: "#38bdf8" }}>{formatBRL(dados.laudoMinimo)}</strong>
            </span>
          )}
          <ChevronDown size={16} color="var(--gray-mid)" style={{ marginLeft: abrirBruto ? "auto" : 10, flexShrink: 0, transform: abrirBruto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>

        {abrirBruto && (
          <>
            <div style={{ padding: "4px 14px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14 }}>
              <div>
                <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Contrato (Venda)</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRL(dados.contrato)}</p>
                <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>{dados.origemContrato}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Entrada Mínima</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRL(dados.entradaMin)}</p>
                <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>config. do empreend.</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Repasse Necessário</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRL(dados.repasseNecessario)}</p>
                <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>contrato − entrada</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "#38bdf8", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Laudo Mínimo (SICAQ)</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#38bdf8" }}>{formatBRL(dados.laudoMinimo)}</p>
                <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>repasse ÷ 80%</p>
              </div>
            </div>
            <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.15)" }}>
              <p style={{ fontSize: 11, color: "var(--gray-mid)", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
                <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                A avaliação de engenharia precisa atingir no mínimo <strong style={{ color: "#38bdf8" }}>{formatBRL(dados.laudoMinimo)}</strong> para liberar o repasse de {formatBRL(dados.repasseNecessario)}.
              </p>
            </div>
          </>
        )}
      </div>

      {/* CARD 2: ENTRADA EMBUTIDA CUB (recolhível) */}
      {dados.temCUB && (
        <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
          <button onClick={() => setAbrirCUB(v => !v)} style={headerBtn}>
            <Layers size={15} color="var(--gray-light)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-light)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Estratégia de Entrada Embutida (CUB)</span>
            {!abrirCUB && (
              <span style={{ fontSize: 11, color: "var(--gray-mid)", marginLeft: "auto", whiteSpace: "nowrap" }}>
                Entrada real <strong style={{ color: dados.cubCobre ? "#4ade80" : "#fb923c" }}>{formatBRL(dados.entradaEmbutida)}</strong>
              </span>
            )}
            <ChevronDown size={16} color="var(--gray-mid)" style={{ marginLeft: abrirCUB ? "auto" : 10, flexShrink: 0, transform: abrirCUB ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>

          {abrirCUB && (
            <>
              <div style={{ padding: "4px 14px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14 }}>
                <div>
                  <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Laudo CUB</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRL(dados.laudoCUB)}</p>
                  <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>{dados.area}m² × CUB + {dados.bdiPct}% BDI + lote</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Financia (80%)</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRL(dados.maxFinCUB)}</p>
                  <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>laudo CUB × 80%</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: dados.cubCobre ? "#4ade80" : "#fb923c", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Entrada Real</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: dados.cubCobre ? "#4ade80" : "#fb923c" }}>{formatBRL(dados.entradaEmbutida)}</p>
                  <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>{dados.cubCobre ? "piso mínimo" : "acima do piso"}</p>
                </div>
              </div>
              <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.15)" }}>
                {dados.cubCobre ? (
                  <p style={{ fontSize: 11, color: "var(--gray-mid)", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <CheckCircle2 size={12} color="#4ade80" style={{ flexShrink: 0, marginTop: 1 }} />
                    O laudo CUB cobre todo o financiamento. A entrada cai para o piso mínimo de <strong style={{ color: "#4ade80" }}>{formatBRL(dados.entradaMin)}</strong> deste empreendimento.
                  </p>
                ) : (
                  <p style={{ fontSize: 11, color: "var(--gray-mid)", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <AlertTriangle size={12} color="#fb923c" style={{ flexShrink: 0, marginTop: 1 }} />
                    O laudo CUB financia {formatBRL(dados.maxFinCUB)} — não cobre todo o contrato. A entrada sobe para <strong style={{ color: "#fb923c" }}>{formatBRL(dados.entradaEmbutida)}</strong>. Para reduzir, é preciso elevar o laudo (CUB / itens complementares).
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Renda como referência discreta */}
      {(lead?.rendaFamiliar > 0 || lead?.simulacao?.rendaFamiliar > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: "rgba(0,0,0,0.15)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
          <span style={{ fontSize: 11, color: "var(--gray-mid)" }}>Renda declarada (referência):</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-light)" }}>{formatBRL(lead.rendaFamiliar || lead.simulacao.rendaFamiliar)}</span>
          <span style={{ fontSize: 10, color: "var(--gray-dark)", marginLeft: "auto" }}>não afeta o cálculo mínimo</span>
        </div>
      )}
    </div>
  );
}