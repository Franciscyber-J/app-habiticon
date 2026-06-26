"use client";

import { useMemo, useState, useEffect } from "react";
import { Scale, TrendingUp, Edit3, Trophy, AlertTriangle, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import {
  simular, calcularLaudoCUB, determinarFaixaEfetiva,
  formatBRL, COTA_MAXIMA_CAIXA,
} from "@/lib/calculos";
import {
  simularSBPE, SBPE_COTA_MAXIMA_SAC,
} from "@/lib/calculos_sbpe";

// ─────────────────────────────────────────────────────────
// ComparadorImoveis — confronta CADA modelo do empreendimento com a
// renda declarada + entrada, decide a LINHA (MCMV/SBPE) e roda o motor
// correto. Sem subsídio (motor bruto). Recomenda o melhor.
//
// 3 MÉTRICAS (todas precisam passar para APROVAR):
//   1. Renda: financiamento que a renda suporta ≥ repasse necessário
//   2. CUB:   80% do laudo CUB ≥ repasse necessário
//   3. 80%:   embutido nas duas (cota máxima)
//
// RECOMENDAÇÃO:
//   - algum aprova → o mais CARO que aprova com a entrada mínima
//   - nenhum aprova → entre os que passam na RENDA (eliminatória),
//     o de MENOR entrada real (mais perto do piso). Se nenhum passa
//     na renda → sem recomendação.
// ─────────────────────────────────────────────────────────

interface ComparadorImoveisProps {
  lead: any;
  empreendimento: any;
}

const PRAZO = 360;

export function ComparadorImoveis({ lead, empreendimento }: ComparadorImoveisProps) {
  const [aberto, setAberto] = useState(false);

  // Renda e entrada: pega do lead; correspondente pode editar
  const rendaInicial = Number(lead?.simulacao?.rendaFamiliar ?? lead?.rendaFamiliar ?? 0) || 0;
  const sim = empreendimento?.simulador || {};
  const entradaMinConfig = Number(sim.entradaMin) || 0;

  const [renda, setRenda] = useState<number>(rendaInicial);
  const [entrada, setEntrada] = useState<number>(entradaMinConfig);
  const [editando, setEditando] = useState(false);

  // Re-sincroniza se o lead/empreendimento mudar
  useEffect(() => { setRenda(rendaInicial); }, [rendaInicial]);
  useEffect(() => { setEntrada(entradaMinConfig); }, [entradaMinConfig]);

  const analise = useMemo(() => {
    if (!empreendimento) return null;
    const modelos: any[] = empreendimento.modelos || [];
    if (modelos.length === 0) return null;

    const cub = sim.cub || {};
    const cubVigente = Number(cub.cubVigente) || 0;
    const bdi = typeof cub.bdi === "number" ? cub.bdi : 0.18;
    const faixas = empreendimento?.mcmv?.faixas || [];
    const tetoMCMVGlobal = Math.max(
      ...faixas.map((f: any) => Number(f.tetoImovel) || 0),
      Number(empreendimento?.mcmv?.tetoImovel) || 600000
    );
    const tetoRendaMCMV = Math.max(...faixas.map((f: any) => Number(f.rendaMax) || 0), 13000);
    const taxaSBPE = Number(sim.taxaSBPE) || 11.38;
    const cubSBPE = Number(sim.cubSBPE) || 0;
    const bdiSBPE = typeof sim.bdiSBPE === "number" ? sim.bdiSBPE : 0.18;

    const resultados = modelos.map((m: any) => {
      const area = Number(m.area) || 0;
      const valorLote = Number(m.valorLote) || 0;
      const valorCasa = typeof m.valorCasa === "number" ? m.valorCasa : Math.max(0, (m.valor || 0) - valorLote);
      const contrato = Number(m.valor) || (valorCasa + valorLote);
      const repasse = Math.max(0, contrato - entrada);

      // Laudo CUB MCMV
      const laudoCUB = (cubVigente > 0 && area > 0)
        ? calcularLaudoCUB(valorLote, area, cubVigente, bdi, 0, COTA_MAXIMA_CAIXA, 0).laudoTotal
        : 0;

      // Decide a linha (mesma regra do EmpreendimentoApp)
      const isSBPE = (renda > tetoRendaMCMV) || (contrato > tetoMCMVGlobal) || (laudoCUB > tetoMCMVGlobal);

      let linha: "MCMV" | "SBPE" = isSBPE ? "SBPE" : "MCMV";
      let taxa = 0;
      let maxFinRenda = 0;
      let maxFinCUB = 0;
      let entradaReal = entrada;
      let rendaOK = false;
      let cubOK = false;
      let bloqueio: string | null = null;

      if (!isSBPE) {
        // ── MCMV ──
        const fx = determinarFaixaEfetiva(laudoCUB > 0 ? laudoCUB : null, renda, faixas, 0);
        taxa = fx.taxaEfetiva || 12;
        if (fx.bloqueio) bloqueio = fx.bloqueio;

        maxFinCUB = laudoCUB > 0 ? laudoCUB * COTA_MAXIMA_CAIXA : contrato * COTA_MAXIMA_CAIXA;
        cubOK = maxFinCUB >= repasse;

        if (renda > 0 && !bloqueio) {
          const r = simular({
            valorImovel: contrato, entrada: 0, prazoMeses: PRAZO,
            taxaAnual: taxa, subsidio: 0, usarSubsidio: false,
            rendaFamiliar: renda, tetoImovel: tetoMCMVGlobal,
          });
          maxFinRenda = r.finLiberadoPRICE;
          rendaOK = maxFinRenda >= repasse;
        } else {
          rendaOK = false;
        }

        // Entrada real HONESTA: o limitador mais restritivo entre CUB e renda (e o piso).
        // O banco libera no máximo o menor dos dois financiamentos.
        const maxFinReal = renda > 0 && !bloqueio ? Math.min(maxFinCUB, maxFinRenda) : maxFinCUB;
        entradaReal = Math.max(entrada, contrato - maxFinReal);
      } else {
        // ── SBPE ──
        linha = "SBPE";
        taxa = taxaSBPE;
        const laudoSBPE = (cubSBPE > 0 && area > 0)
          ? calcularLaudoCUB(valorLote, area, cubSBPE, bdiSBPE, 0, SBPE_COTA_MAXIMA_SAC, 0).laudoTotal
          : 0;
        const laudoBase = laudoSBPE > contrato ? laudoSBPE : contrato;
        maxFinCUB = laudoBase * SBPE_COTA_MAXIMA_SAC;

        const r = simularSBPE({
          valorImovel: contrato, entrada: 0, prazoMeses: PRAZO,
          taxaAnual: taxaSBPE, rendaFamiliar: renda, laudoCalculado: laudoSBPE,
        });
        maxFinRenda = r.finLiberadoSAC; // SAC já cruza renda × cota 80%
        // Entrada real honesta: limitador mais restritivo (o finLiberadoSAC já é o mínimo renda×cota)
        entradaReal = Math.max(entrada, contrato - maxFinRenda);
        rendaOK = renda > 0 && maxFinRenda >= repasse;
        cubOK = maxFinCUB >= repasse;
      }

      const aprovado = rendaOK && cubOK && !bloqueio;

      return {
        id: m.id, nome: m.nome, linha, taxa, area, contrato, repasse,
        maxFinRenda: Math.round(maxFinRenda), maxFinCUB: Math.round(maxFinCUB),
        entradaReal: Math.round(entradaReal), rendaOK, cubOK, aprovado, bloqueio,
        entradaNoPiso: Math.round(entradaReal) <= Math.round(entrada),
      };
    });

    // ── Recomendação ──
    const aprovados = resultados.filter(r => r.aprovado);
    let recomendadoId: string | null = null;
    let modoRecomendacao: "aprovado" | "fallback" | "nenhum" = "nenhum";

    if (aprovados.length > 0) {
      const rec = [...aprovados].sort((a, b) => b.contrato - a.contrato)[0];
      recomendadoId = rec.id;
      modoRecomendacao = "aprovado";
    } else {
      const passamRenda = resultados.filter(r => r.rendaOK);
      if (passamRenda.length > 0) {
        const rec = [...passamRenda].sort((a, b) => a.entradaReal - b.entradaReal)[0];
        recomendadoId = rec.id;
        modoRecomendacao = "fallback";
      }
    }

    // ── Renda mínima para aprovar o modelo MAIS BARATO (só relevante no modo "nenhum") ──
    // Usa o próprio motor (simular) via busca binária — fiel, sem reimplementar parcela.
    let rendaIdeal: { modelo: string; renda: number; entrada: number } | null = null;
    if (modoRecomendacao === "nenhum" && renda > 0) {
      const maisBarato = [...resultados].sort((a, b) => a.contrato - b.contrato)[0];
      if (maisBarato && maisBarato.linha === "MCMV" && !maisBarato.bloqueio) {
        // financiável real = min(repasse, maxFinCUB); a entrada sobe se o CUB não cobre
        const financiavelAlvo = Math.min(maisBarato.repasse, maisBarato.maxFinCUB);
        const entradaCenario = Math.max(entrada, maisBarato.contrato - maisBarato.maxFinCUB);
        // busca a menor renda cujo finLiberadoPRICE >= financiavelAlvo
        let lo = 0, hi = 50000, achou = 0;
        for (let it = 0; it < 50; it++) {
          const mid = (lo + hi) / 2;
          const r = simular({
            valorImovel: maisBarato.contrato, entrada: 0, prazoMeses: PRAZO,
            taxaAnual: maisBarato.taxa, subsidio: 0, usarSubsidio: false,
            rendaFamiliar: mid, tetoImovel: tetoMCMVGlobal,
          });
          if (r.finLiberadoPRICE >= financiavelAlvo - 0.01) { achou = mid; hi = mid; }
          else { lo = mid; }
        }
        if (achou > 0) {
          rendaIdeal = { modelo: maisBarato.nome, renda: Math.ceil(achou), entrada: Math.round(entradaCenario) };
        }
      }
    }

    return { resultados, recomendadoId, modoRecomendacao, semRenda: renda <= 0, rendaIdeal };
  }, [empreendimento, renda, entrada, sim]);

  if (!analise) return null;

  return (
    <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
      {/* Header recolhível */}
      <button onClick={() => setAberto(v => !v)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
        <Scale size={15} color="var(--gray-light)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-light)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Comparador de Imóveis</span>
        {!aberto && (
          <span style={{ fontSize: 11, color: "var(--gray-mid)", marginLeft: "auto", whiteSpace: "nowrap" }}>
            {analise.modoRecomendacao === "aprovado" ? "tem opção aprovável" : analise.modoRecomendacao === "fallback" ? "ver mais próxima" : "renda não atende"}
          </span>
        )}
        <ChevronDown size={16} color="var(--gray-mid)" style={{ marginLeft: aberto ? "auto" : 10, flexShrink: 0, transform: aberto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {aberto && (
        <div style={{ padding: "0 14px 14px" }}>
          {/* Inputs renda/entrada */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border-subtle)", marginBottom: 12, alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 140px" }}>
              <label style={{ display: "block", fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Renda Declarada</label>
              {editando ? (
                <input type="number" value={renda || ""} onChange={e => setRenda(Number(e.target.value) || 0)} placeholder="0" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.4)", border: "1px solid var(--border-active)", color: "white", fontSize: 14, outline: "none" }} />
              ) : (
                <p style={{ fontSize: 15, fontWeight: 800, color: "white" }}>{renda > 0 ? formatBRL(renda) : "—"}</p>
              )}
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <label style={{ display: "block", fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Entrada Disponível</label>
              {editando ? (
                <input type="number" value={entrada || ""} onChange={e => setEntrada(Number(e.target.value) || 0)} placeholder="0" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.4)", border: "1px solid var(--border-active)", color: "white", fontSize: 14, outline: "none" }} />
              ) : (
                <p style={{ fontSize: 15, fontWeight: 800, color: "white" }}>{formatBRL(entrada)}</p>
              )}
            </div>
            <button onClick={() => setEditando(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, background: editando ? "#38bdf8" : "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: editando ? "#082f49" : "var(--gray-light)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {editando ? <><CheckCircle2 size={13} /> Aplicar</> : <><Edit3 size={13} /> Editar</>}
            </button>
          </div>

          {analise.semRenda && (
            <div style={{ padding: "10px 12px", background: "rgba(251,146,60,0.06)", borderRadius: 8, border: "1px solid rgba(251,146,60,0.2)", marginBottom: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertTriangle size={14} color="#fb923c" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11, color: "var(--gray-light)", lineHeight: 1.5 }}>Sem renda declarada, não dá para confrontar as métricas. Edite a renda acima para simular.</p>
            </div>
          )}

          {/* Lista de modelos */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {analise.resultados.map(r => {
              const ehRec = r.id === analise.recomendadoId;
              const corBorda = ehRec ? (analise.modoRecomendacao === "aprovado" ? "rgba(74,222,128,0.5)" : "rgba(251,146,60,0.5)") : "var(--border-subtle)";
              return (
                <div key={r.id} style={{ background: ehRec ? "rgba(74,222,128,0.04)" : "rgba(0,0,0,0.2)", border: `1px solid ${corBorda}`, borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      {ehRec && <Trophy size={14} color={analise.modoRecomendacao === "aprovado" ? "#4ade80" : "#fb923c"} style={{ flexShrink: 0 }} />}
                      <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{r.nome}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 5, textTransform: "uppercase", background: r.linha === "SBPE" ? "rgba(59,130,246,0.15)" : "rgba(74,222,128,0.12)", color: r.linha === "SBPE" ? "#60a5fa" : "#4ade80" }}>{r.linha}</span>
                      <span style={{ fontSize: 10, color: "var(--gray-dark)" }}>{r.taxa}% a.a.</span>
                    </div>
                    {r.aprovado ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800, color: "#4ade80" }}><CheckCircle2 size={13} /> APROVA</span>
                    ) : (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--gray-mid)" }}><XCircle size={13} /> não aprova</span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11 }}>
                    <span style={{ color: "var(--gray-mid)" }}>Contrato: <strong style={{ color: "var(--gray-light)" }}>{formatBRL(r.contrato)}</strong></span>
                    <span style={{ color: r.rendaOK ? "#4ade80" : "#f87171" }}>
                      Renda: {r.rendaOK ? "ok" : "insuf."} <span style={{ color: "var(--gray-dark)" }}>(suporta {formatBRL(r.maxFinRenda)})</span>
                    </span>
                    <span style={{ color: r.entradaNoPiso ? "#4ade80" : "#fb923c" }}>
                      Entrada necessária: <strong>{formatBRL(r.entradaReal)}</strong>
                    </span>
                  </div>

                  {r.bloqueio && (
                    <p style={{ fontSize: 10, color: "#f87171", marginTop: 6, lineHeight: 1.4 }}>{r.bloqueio}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Veredito */}
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-subtle)" }}>
            {analise.modoRecomendacao === "aprovado" && (
              <p style={{ fontSize: 12, color: "var(--gray-light)", lineHeight: 1.5, display: "flex", gap: 6, alignItems: "flex-start" }}>
                <Trophy size={13} color="#4ade80" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Melhor opção aprovável: a mais valorizada que fecha as três métricas com a entrada informada. O cliente leva a maior casa possível sem reforço de entrada.</span>
              </p>
            )}
            {analise.modoRecomendacao === "fallback" && (
              <p style={{ fontSize: 12, color: "var(--gray-light)", lineHeight: 1.5, display: "flex", gap: 6, alignItems: "flex-start" }}>
                <TrendingUp size={13} color="#fb923c" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Nenhum modelo fecha 100% com a entrada mínima. A opção destacada é a que a renda aprova com a <strong>menor entrada adicional</strong> — mais perto de viabilizar.</span>
              </p>
            )}
            {analise.modoRecomendacao === "nenhum" && !analise.semRenda && (
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <AlertTriangle size={13} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12, color: "var(--gray-light)", lineHeight: 1.5 }}>
                    A renda declarada não suporta a parcela de nenhum modelo disponível. Seria preciso renda maior, compor renda, ou rever o produto.
                  </p>
                  {analise.rendaIdeal && (
                    <p style={{ fontSize: 12, color: "var(--gray-light)", lineHeight: 1.5, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle)" }}>
                      💡 Para aprovar o modelo mais barato (<strong style={{ color: "var(--gray-light)" }}>{analise.rendaIdeal.modelo}</strong>), a renda precisaria ser de no mínimo <strong style={{ color: "#4ade80" }}>{formatBRL(analise.rendaIdeal.renda)}</strong>
                      {analise.rendaIdeal.entrada > entrada && <> com entrada de <strong style={{ color: "#fb923c" }}>{formatBRL(analise.rendaIdeal.entrada)}</strong></>}.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}