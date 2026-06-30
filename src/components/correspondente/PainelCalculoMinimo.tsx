"use client";

import { useMemo, useState, useEffect } from "react";
import { Target, Layers, Info, AlertTriangle, CheckCircle2, ChevronDown, Edit3, Home, TrendingUp } from "lucide-react";
import { formatBRL, calcularLaudoCUB, simular, determinarFaixaEfetiva, COTA_MAXIMA_CAIXA } from "@/lib/calculos";

// ─────────────────────────────────────────────────────────
// PainelCalculoMinimo
// Card 1 (Cálculo Mínimo): contrato − entrada → laudo mínimo
// Card 2 (Entrada Embutida CUB): SELETOR DE LOTE + TOGGLE SAC/PRICE
//   → recalcula laudo, valor de venda da casa, financia real, e SALDO DEVEDOR.
//   financiaReal = min( (creditoAprovado OU maxFinRenda da tabela), maxFinCUB )
//   maxFinRenda vem do simular() — fiel ao simulador (PRICE libera mais que SAC)
//   saldo = valorCasa(do lote) − (financiaReal + entrada)
// ─────────────────────────────────────────────────────────

interface PainelCalculoMinimoProps {
  lead: any;
  empreendimento: any;
  lotesVendidos?: string[]; // números dos lotes físicos vendidos (ex: ["22","13"])
}

type Tabela = "PRICE" | "SAC";

export function PainelCalculoMinimo({ lead, empreendimento, lotesVendidos = [] }: PainelCalculoMinimoProps) {
  const [abrirBruto, setAbrirBruto] = useState(false);
  const [abrirCUB, setAbrirCUB] = useState(false);
  const [loteEscolhidoId, setLoteEscolhidoId] = useState<string>("");
  const [tabela, setTabela] = useState<Tabela>("PRICE"); // PRICE = libera mais (default p/ venda)
  const [creditoEditavel, setCreditoEditavel] = useState<number | null>(null);
  const [editandoCredito, setEditandoCredito] = useState(false);
  const [rendaEditavel, setRendaEditavel] = useState<number | null>(null);
  const [editandoRenda, setEditandoRenda] = useState(false);
  const [entradaEditavel, setEntradaEditavel] = useState<number | null>(null);
  const [editandoEntrada, setEditandoEntrada] = useState(false);

  const base = useMemo(() => {
    if (!empreendimento) return null;

    const sim = empreendimento.simulador || {};
    const entradaMin: number = Number(sim.entradaMin) || 0;
    const prazoMeses: number = Number(sim.prazoMeses) || 360;
    const reserva = lead?.loteReserva || null;

    const modelos: any[] = empreendimento.modelos || [];
    const modeloPorId = reserva?.modeloId ? modelos.find(m => m.id === reserva.modeloId) : null;
    const modeloPorNome = lead?.modelo ? modelos.find(m => m.nome === lead.modelo) : null;
    const modelo = modeloPorId || modeloPorNome || null;
    const modeloId = modelo?.id || null;

    const valorLoteModelo = Number(modelo?.valorLote) || 0;
    const valorCasaBase = (typeof modelo?.valorCasa === "number" ? modelo.valorCasa : null)
      ?? Math.max(0, (Number(modelo?.valor) || 0) - valorLoteModelo);

    // Contrato (card 1)
    let contrato = 0, origemContrato = "";
    if (reserva && typeof reserva.valorVenda === "number" && reserva.valorVenda > 0) {
      contrato = reserva.valorVenda; origemContrato = "lote vinculado";
    } else if (typeof lead?.valorImovel === "number" && lead.valorImovel > 0) {
      contrato = lead.valorImovel; origemContrato = "valor anunciado";
    } else if (modelo?.valor) {
      contrato = modelo.valor; origemContrato = "modelo selecionado";
    }

    const repasseNecessario = Math.max(0, contrato - entradaMin);
    const laudoMinimo = repasseNecessario / COTA_MAXIMA_CAIXA;

    // CUB
    const cub = sim.cub || {};
    const cubVigente = Number(cub.cubVigente) || 0;
    const bdi = typeof cub.bdi === "number" ? cub.bdi : 0.18;
    const area = Number(modelo?.area) || 0;
    const temCUB = cubVigente > 0 && area > 0;
    const bdiPct = Math.round(bdi * 100);

    // Faixas MCMV (para a taxa)
    const faixas: any[] = empreendimento.mcmv?.faixas || [];
    const tetoMCMV = Number(empreendimento.mcmv?.tetoImovel) || 0;

    // Lotes do seletor: inteiro(s) + fração vinculada ao modelo
    const todosLotes: any[] = empreendimento.lotes || [];
    const inteiros = todosLotes.filter(l => l.tipo === "inteiro" && l.ativo !== false);
    const fracoesDoModelo = todosLotes.filter(l =>
      l.tipo === "fracao" && l.ativo !== false &&
      Array.isArray(l.modelosVinculados) && modeloId && l.modelosVinculados.includes(modeloId)
    );
    // Extrai o número do lote do nome comercial: "Quadra 21 - Lote 22" → "22".
    // Itens genéricos ("Lote Padrão"/"Fração") não têm número → nunca casam → nunca bloqueiam.
    const extrairNumeroLote = (nome: string): string => {
      const m = String(nome || "").match(/lote\s*(\d+)/i);
      return m ? m[1] : "";
    };
    const vendidosSet = new Set((lotesVendidos || []).map(String));
    const lotesDisponiveis = [...fracoesDoModelo, ...inteiros].map(l => {
      const nome = l.nome || (l.tipo === "inteiro" ? "Lote Inteiro" : "Fração");
      const numero = extrairNumeroLote(nome);
      return {
        id: l.id,
        nome,
        tipo: l.tipo,
        valor: Number(l.valor) || 0,
        numero,
        vendido: numero !== "" && vendidosSet.has(numero),
      };
    });

    const creditoAprovado = (typeof lead?.creditoAprovadoInfo?.valorAprovado === "number" && lead.creditoAprovadoInfo.valorAprovado > 0)
      ? lead.creditoAprovadoInfo.valorAprovado
      : null;

    const rendaLead = Number(lead?.rendaFamiliar) || Number(lead?.simulacao?.rendaFamiliar) || 0;

    return {
      entradaMin, prazoMeses, contrato, origemContrato, repasseNecessario, laudoMinimo,
      temCUB, cubVigente, bdi, bdiPct, area, valorCasaBase, valorLoteModelo,
      lotesDisponiveis, creditoAprovado, rendaLead, faixas, tetoMCMV,
      modeloNome: modelo?.nome || lead?.modelo || "",
      semContrato: contrato <= 0,
    };
  }, [lead, empreendimento, lotesVendidos]);

  // Lote default
  useEffect(() => {
    if (!base || base.lotesDisponiveis.length === 0) return;
    const reservaFracaoId = lead?.loteReserva?.fracaoId;
    const existeReserva = reservaFracaoId && base.lotesDisponiveis.find(l => l.id === reservaFracaoId);
    if (existeReserva) { setLoteEscolhidoId(reservaFracaoId); return; }
    // default = primeiro lote NÃO vendido (cai pro primeiro se todos estiverem vendidos)
    const primeiroDisponivel = base.lotesDisponiveis.find(l => !l.vendido) || base.lotesDisponiveis[0];
    setLoteEscolhidoId(primeiroDisponivel.id);
  }, [base, lead?.loteReserva?.fracaoId]);

  const rendaUsada = rendaEditavel ?? base?.rendaLead ?? 0;
  // Entrada: trava no mínimo do empreendimento. Default = entradaMin; recalcula se editada.
  const entradaUsada = Math.max(base?.entradaMin ?? 0, entradaEditavel ?? (base?.entradaMin ?? 0));

  const cub = useMemo(() => {
    if (!base || !base.temCUB) return null;
    const lote = base.lotesDisponiveis.find(l => l.id === loteEscolhidoId) || base.lotesDisponiveis[0];
    if (!lote) return null;

    const valorCasaLote = base.valorCasaBase + lote.valor;

    // Laudo CUB do lote escolhido
    const r = calcularLaudoCUB(lote.valor, base.area, base.cubVigente, base.bdi, 0, COTA_MAXIMA_CAIXA, 0);
    const laudoTotal = r.laudoTotal;
    const maxFinCUB = r.maxFinanciamento;

    // Taxa pela faixa efetiva (renda + laudo puxa pra cima)
    const fe = determinarFaixaEfetiva(laudoTotal, rendaUsada, base.faixas as any, 0);
    const taxa = fe.taxaEfetiva || 12;
    const bloqueioFaixa = fe.bloqueio;

    // maxFinRenda via simular (tabela escolhida) — fiel ao simulador
    let maxFinRenda = Infinity;
    if (rendaUsada > 0) {
      const s = simular({
        valorImovel: valorCasaLote,
        entrada: entradaUsada,
        prazoMeses: base.prazoMeses,
        taxaAnual: taxa,
        rendaFamiliar: rendaUsada,
        usarSubsidio: false,
        tetoImovel: base.tetoMCMV > 0 ? base.tetoMCMV : undefined,
      });
      maxFinRenda = tabela === "PRICE" ? s.finLiberadoPRICE : s.finLiberadoSAC;
    }

    // Crédito de referência: editável > aprovado > (sem aprovação) maxFinRenda
    const creditoManual = creditoEditavel;
    const temCredito = creditoManual != null || base.creditoAprovado != null;
    const limiteRenda = creditoManual != null
      ? creditoManual
      : (base.creditoAprovado != null ? base.creditoAprovado : maxFinRenda);

    const financiaReal = Math.min(limiteRenda, maxFinCUB);
    const totalCoberto = financiaReal + entradaUsada;
    const saldoDevedor = Math.max(0, valorCasaLote - totalCoberto);

    let limitadoPor: string;
    if (financiaReal >= maxFinCUB) limitadoPor = "laudo";
    else if (temCredito) limitadoPor = "crédito";
    else limitadoPor = "renda";

    const creditoExibido = creditoManual ?? base.creditoAprovado ?? (maxFinRenda === Infinity ? 0 : maxFinRenda);

    // ── RESUMO: saldo de TODOS os lotes (só relevante quando há muitos) ──
    // Usa o mesmo crédito/entrada atuais. Para o limite de renda por lote,
    // reusa maxFinRenda do lote selecionado como aproximação quando sem crédito.
    const lotesResumo = base.lotesDisponiveis.map(l => {
      const casaL = base.valorCasaBase + l.valor;
      const laudoL = calcularLaudoCUB(l.valor, base.area, base.cubVigente, base.bdi, 0, COTA_MAXIMA_CAIXA, 0);
      const maxFinCUBL = laudoL.maxFinanciamento;
      const limiteL = creditoManual != null
        ? creditoManual
        : (base.creditoAprovado != null ? base.creditoAprovado : maxFinRenda);
      const finL = Math.min(limiteL, maxFinCUBL);
      const saldoL = Math.max(0, casaL - (finL + entradaUsada));
      return { id: l.id, nome: l.nome, tipo: l.tipo, valor: l.valor, saldo: saldoL };
    }).sort((a, b) => a.saldo - b.saldo);

    const lotesQueZeram = lotesResumo.filter(l => l.saldo <= 0);
    const lotesSaldoPequeno = lotesResumo.filter(l => l.saldo > 0 && l.saldo < 15000);
    const menorSaldoLote = lotesResumo[0] || null;

    return {
      lote, valorCasaLote, laudoTotal, maxFinCUB, maxFinRenda, financiaReal,
      totalCoberto, saldoDevedor, limitadoPor, taxa, bloqueioFaixa,
      temCredito, creditoExibido,
      lotesResumo, lotesQueZeram, lotesSaldoPequeno, menorSaldoLote,
    };
  }, [base, loteEscolhidoId, tabela, creditoEditavel, rendaUsada, entradaUsada]);

  if (!base) {
    return (
      <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
        <p style={{ fontSize: 12, color: "var(--gray-dark)" }}>Carregando dados do empreendimento…</p>
      </div>
    );
  }

  if (base.semContrato) {
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

  const corSaldo = (s: number) => s <= 0 ? "#4ade80" : (s < 15000 ? "#fb923c" : "#f87171");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* CARD 1: CÁLCULO MÍNIMO */}
      <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
        <button onClick={() => setAbrirBruto(v => !v)} style={headerBtn}>
          <Target size={15} color="var(--gray-light)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-light)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Cálculo Mínimo Necessário</span>
          {!abrirBruto && (
            <span style={{ fontSize: 11, color: "var(--gray-mid)", marginLeft: "auto", whiteSpace: "nowrap" }}>
              Laudo mín. <strong style={{ color: "#38bdf8" }}>{formatBRL(base.laudoMinimo)}</strong>
            </span>
          )}
          <ChevronDown size={16} color="var(--gray-mid)" style={{ marginLeft: abrirBruto ? "auto" : 10, flexShrink: 0, transform: abrirBruto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>

        {abrirBruto && (
          <>
            <div style={{ padding: "4px 14px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14 }}>
              <div>
                <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Contrato (Venda)</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRL(base.contrato)}</p>
                <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>{base.origemContrato}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Entrada Mínima</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRL(base.entradaMin)}</p>
                <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>config. do empreend.</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Repasse Necessário</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRL(base.repasseNecessario)}</p>
                <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>contrato − entrada</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "#38bdf8", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Laudo Mínimo (SICAQ)</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#38bdf8" }}>{formatBRL(base.laudoMinimo)}</p>
                <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>repasse ÷ 80%</p>
              </div>
            </div>
            <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.15)" }}>
              <p style={{ fontSize: 11, color: "var(--gray-mid)", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
                <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                A avaliação de engenharia precisa atingir no mínimo <strong style={{ color: "#38bdf8" }}>{formatBRL(base.laudoMinimo)}</strong> para liberar o repasse de {formatBRL(base.repasseNecessario)}.
              </p>
            </div>
          </>
        )}
      </div>

      {/* CARD 2: ENTRADA EMBUTIDA CUB */}
      {base.temCUB && cub && (
        <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
          <button onClick={() => setAbrirCUB(v => !v)} style={headerBtn}>
            <Layers size={15} color="var(--gray-light)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-light)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Estratégia de Entrada Embutida (CUB)</span>
            {!abrirCUB && (
              <span style={{ fontSize: 11, color: "var(--gray-mid)", marginLeft: "auto", whiteSpace: "nowrap" }}>
                Saldo <strong style={{ color: corSaldo(cub.saldoDevedor) }}>{formatBRL(cub.saldoDevedor)}</strong>
              </span>
            )}
            <ChevronDown size={16} color="var(--gray-mid)" style={{ marginLeft: abrirCUB ? "auto" : 10, flexShrink: 0, transform: abrirCUB ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>

          {abrirCUB && (
            <>
              {/* SELETOR DE LOTE + TOGGLE TABELA */}
              <div style={{ padding: "4px 14px 0", display: "flex", flexWrap: "wrap", gap: 14 }}>
                <div style={{ flex: "1 1 200px" }}>
                  <label style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                    <Home size={11} /> Tipo de Lote
                  </label>
                  {base.lotesDisponiveis.length <= 2 ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {base.lotesDisponiveis.map(l => {
                        const ativo = l.id === loteEscolhidoId;
                        const vendido = l.vendido;
                        return (
                          <button key={l.id} onClick={() => { if (!vendido) setLoteEscolhidoId(l.id); }} disabled={vendido} title={vendido ? "Lote já vendido" : ""} style={{ flex: "1 1 120px", padding: "8px 12px", borderRadius: 8, cursor: vendido ? "not-allowed" : "pointer", textAlign: "left", transition: "0.15s", opacity: vendido ? 0.45 : 1, background: vendido ? "rgba(239,68,68,0.06)" : (ativo ? "rgba(168,85,247,0.12)" : "rgba(0,0,0,0.2)"), border: vendido ? "1px solid rgba(239,68,68,0.25)" : (ativo ? "1px solid rgba(168,85,247,0.4)" : "1px solid var(--border-subtle)") }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: vendido ? "#f87171" : (ativo ? "#c084fc" : "var(--gray-light)"), display: "block" }}>{l.tipo === "inteiro" ? "Lote Inteiro" : "Fração Ideal"}{vendido ? " · VENDIDO" : ""}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: ativo && !vendido ? "white" : "var(--gray-mid)" }}>{formatBRL(l.valor)}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <select value={loteEscolhidoId} onChange={e => setLoteEscolhidoId(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.3)", color: "white", fontSize: 13, fontWeight: 700, outline: "none", cursor: "pointer" }}>
                      {base.lotesDisponiveis.map(l => (
                        <option key={l.id} value={l.id} disabled={l.vendido} style={{ background: "#1a2e23", color: l.vendido ? "#f87171" : "white" }}>
                          {l.nome} — {formatBRL(l.valor)}{l.tipo === "inteiro" ? " (inteiro)" : ""}{l.vendido ? " — VENDIDO" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ flex: "1 1 160px" }}>
                  <label style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                    <TrendingUp size={11} /> Tabela
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["PRICE", "SAC"] as Tabela[]).map(t => {
                      const ativo = t === tabela;
                      return (
                        <button key={t} onClick={() => setTabela(t)} disabled={cub.temCredito} title={cub.temCredito ? "Crédito aprovado já define o valor — tabela não altera" : ""} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, cursor: cub.temCredito ? "not-allowed" : "pointer", textAlign: "center", transition: "0.15s", opacity: cub.temCredito ? 0.45 : 1, background: ativo ? "rgba(56,189,248,0.12)" : "rgba(0,0,0,0.2)", border: ativo ? "1px solid rgba(56,189,248,0.4)" : "1px solid var(--border-subtle)" }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: ativo ? "#38bdf8" : "var(--gray-mid)", display: "block" }}>{t}</span>
                          <span style={{ fontSize: 9, color: "var(--gray-dark)" }}>{t === "PRICE" ? "libera mais" : "conservador"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* RESUMO DE LOTES (só com 3+ opções) */}
              {base.lotesDisponiveis.length >= 3 && cub.menorSaldoLote && (
                <div style={{ padding: "10px 14px 0" }}>
                  <div style={{ padding: "10px 12px", borderRadius: 8, background: cub.lotesQueZeram.length > 0 ? "rgba(74,222,128,0.06)" : "rgba(251,146,60,0.06)", border: cub.lotesQueZeram.length > 0 ? "1px solid rgba(74,222,128,0.2)" : "1px solid rgba(251,146,60,0.2)" }}>
                    <p style={{ fontSize: 11, color: "var(--gray-light)", lineHeight: 1.5 }}>
                      {cub.lotesQueZeram.length > 0 ? (
                        <>
                          <strong style={{ color: "#4ade80" }}>{cub.lotesQueZeram.length} de {base.lotesDisponiveis.length} lotes</strong> fecham sem saldo a partir de <strong style={{ color: "white" }}>{formatBRL(cub.lotesQueZeram[0].valor)}</strong>
                          {cub.lotesSaldoPequeno.length > 0 && <> · mais {cub.lotesSaldoPequeno.length} com saldo pequeno (fácil parcelar)</>}.
                        </>
                      ) : cub.lotesSaldoPequeno.length > 0 ? (
                        <>
                          <strong style={{ color: "#fb923c" }}>{cub.lotesSaldoPequeno.length} lote(s)</strong> com saldo pequeno (&lt;{formatBRL(15000)}, fácil parcelar). Menor saldo: <strong style={{ color: "white" }}>{formatBRL(cub.menorSaldoLote.saldo)}</strong> no lote de {formatBRL(cub.menorSaldoLote.valor)}.
                        </>
                      ) : (
                        <>
                          Nenhum lote zera o saldo com este crédito. Menor saldo possível: <strong style={{ color: "#fb923c" }}>{formatBRL(cub.menorSaldoLote.saldo)}</strong> no lote mais barato (<strong style={{ color: "white" }}>{formatBRL(cub.menorSaldoLote.valor)}</strong>).
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* CRÉDITO + RENDA + ENTRADA editáveis */}
              <div style={{ padding: "12px 14px 0", display: "flex", flexWrap: "wrap", gap: 10 }}>
                {/* Crédito */}
                <div style={{ flex: "1 1 180px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Crédito Aprovado</p>
                    {editandoCredito ? (
                      <input type="number" autoFocus value={creditoEditavel ?? Math.round(cub.creditoExibido) ?? ""} onChange={e => setCreditoEditavel(Number(e.target.value) || 0)} onKeyDown={e => { if (e.key === "Enter") setEditandoCredito(false); }} style={{ width: 120, marginTop: 2, padding: "4px 8px", borderRadius: 6, background: "rgba(0,0,0,0.4)", border: "1px solid var(--border-active)", color: "white", fontSize: 14, fontWeight: 700, outline: "none" }} />
                    ) : (
                      <p style={{ fontSize: 15, fontWeight: 800, color: "white", marginTop: 2 }}>{formatBRL(cub.creditoExibido)}</p>
                    )}
                    <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 1 }}>
                      {creditoEditavel != null ? "editado manualmente" : (base.creditoAprovado != null ? "aprovado pela mesa" : "estimado pela renda")}
                    </p>
                  </div>
                  <button onClick={() => setEditandoCredito(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "var(--gray-light)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    <Edit3 size={12} /> {editandoCredito ? "ok" : "editar"}
                  </button>
                </div>

                {/* Renda */}
                <div style={{ flex: "1 1 180px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Renda Declarada</p>
                    {editandoRenda ? (
                      <input type="number" autoFocus value={rendaEditavel ?? Math.round(rendaUsada) ?? ""} onChange={e => setRendaEditavel(Number(e.target.value) || 0)} onKeyDown={e => { if (e.key === "Enter") setEditandoRenda(false); }} style={{ width: 120, marginTop: 2, padding: "4px 8px", borderRadius: 6, background: "rgba(0,0,0,0.4)", border: "1px solid var(--border-active)", color: "white", fontSize: 14, fontWeight: 700, outline: "none" }} />
                    ) : (
                      <p style={{ fontSize: 15, fontWeight: 800, color: rendaUsada > 0 ? "white" : "var(--gray-dark)", marginTop: 2 }}>{rendaUsada > 0 ? formatBRL(rendaUsada) : "—"}</p>
                    )}
                    <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 1 }}>
                      {cub.temCredito ? "limita só sem aprovação" : `taxa ${cub.taxa}% · limita o financiamento`}
                    </p>
                  </div>
                  <button onClick={() => setEditandoRenda(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "var(--gray-light)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    <Edit3 size={12} /> {editandoRenda ? "ok" : "editar"}
                  </button>
                </div>

                {/* Entrada (trava no mínimo do empreendimento) */}
                <div style={{ flex: "1 1 180px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Entrada do Cliente</p>
                    {editandoEntrada ? (
                      <input type="number" autoFocus value={entradaEditavel ?? Math.round(entradaUsada) ?? ""} onChange={e => setEntradaEditavel(Number(e.target.value) || 0)} onKeyDown={e => { if (e.key === "Enter") setEditandoEntrada(false); }} style={{ width: 120, marginTop: 2, padding: "4px 8px", borderRadius: 6, background: "rgba(0,0,0,0.4)", border: "1px solid var(--border-active)", color: "white", fontSize: 14, fontWeight: 700, outline: "none" }} />
                    ) : (
                      <p style={{ fontSize: 15, fontWeight: 800, color: "white", marginTop: 2 }}>{formatBRL(entradaUsada)}</p>
                    )}
                    <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 1 }}>
                      {(entradaEditavel != null && entradaEditavel > base.entradaMin) ? "definida pelo cliente" : `mínimo do empreend. (${formatBRL(base.entradaMin)})`}
                    </p>
                  </div>
                  <button onClick={() => setEditandoEntrada(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "var(--gray-light)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    <Edit3 size={12} /> {editandoEntrada ? "ok" : "editar"}
                  </button>
                </div>
              </div>

              {/* RESULTADOS */}
              <div style={{ padding: "12px 14px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14 }}>
                <div>
                  <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Valor da Casa</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRL(cub.valorCasaLote)}</p>
                  <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>casa + lote {cub.lote.tipo === "inteiro" ? "inteiro" : "fração"}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Laudo CUB</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRL(cub.laudoTotal)}</p>
                  <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>{base.area}m² × CUB + {base.bdiPct}% BDI + lote</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Financia (real)</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRL(cub.totalCoberto)}</p>
                  <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>{formatBRL(cub.financiaReal)} + {formatBRL(entradaUsada)} · limita: {cub.limitadoPor}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: corSaldo(cub.saldoDevedor), textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Saldo Devedor</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: corSaldo(cub.saldoDevedor) }}>{formatBRL(cub.saldoDevedor)}</p>
                  <p style={{ fontSize: 9, color: "var(--gray-dark)", marginTop: 2 }}>casa − (financia + entrada)</p>
                </div>
              </div>

              {cub.bloqueioFaixa && (
                <div style={{ padding: "8px 14px", background: "rgba(239,68,68,0.06)", borderTop: "1px solid rgba(239,68,68,0.2)" }}>
                  <p style={{ fontSize: 11, color: "#f87171", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {cub.bloqueioFaixa}
                  </p>
                </div>
              )}

              <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.15)" }}>
                {cub.saldoDevedor <= 0 ? (
                  <p style={{ fontSize: 11, color: "var(--gray-mid)", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <CheckCircle2 size={12} color="#4ade80" style={{ flexShrink: 0, marginTop: 1 }} />
                    Crédito + entrada cobrem todo o valor da casa com este lote{cub.temCredito ? "" : ` (tabela ${tabela})`}. Negócio fechado sem saldo a parcelar.
                  </p>
                ) : cub.saldoDevedor < 15000 ? (
                  <p style={{ fontSize: 11, color: "var(--gray-mid)", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <CheckCircle2 size={12} color="#fb923c" style={{ flexShrink: 0, marginTop: 1 }} />
                    Sobra <strong style={{ color: "#fb923c" }}>{formatBRL(cub.saldoDevedor)}</strong> — diferença pequena, fácil de negociar ou parcelar com o cliente.
                  </p>
                ) : (
                  <p style={{ fontSize: 11, color: "var(--gray-mid)", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <AlertTriangle size={12} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                    Sobra <strong style={{ color: "#f87171" }}>{formatBRL(cub.saldoDevedor)}</strong> a cobrir.{!cub.temCredito && tabela === "SAC" ? " Tente a tabela PRICE (libera mais)." : " Avalie a fração (mais barata) ou reforço de entrada."}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}