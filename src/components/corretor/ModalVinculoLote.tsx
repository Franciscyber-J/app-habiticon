"use client";

import { useMemo, useState, useEffect } from "react";
import { Home, X, ChevronRight, Check } from "lucide-react";
import { formatBRL } from "@/lib/calculos";
import { padraoDoModelo, lotesVisiveis, type LoteInfo } from "@/lib/lotes";

// ─────────────────────────────────────────────────────────
// ModalVinculoLote — modal de vínculo de lote 100% sincronizado
// com o simulador público (EmpreendimentoApp).
//
// Preço final = valorCasa + fracao.valor + itensAdicionais
//   - valorCasa        → modelo.valorCasa  (fallback: modelo.valor − lotePadrao.valor)
//   - fracao.valor     → empreendimento.lotes via padraoDoModelo / lotesVisiveis
//   - itensAdicionais  → simulador.cub.itensComplementares filtrados por
//                        ativoNoSimulador + modelosVinculados (igual ItensAdicionaisSimulador)
//
// Grava na reserva TODOS os campos para sobreviver à troca do SVG.
// Usado por painel-corretor e painel-coordenador (mesma fonte de verdade).
// ─────────────────────────────────────────────────────────

interface ItemComplementar {
  id: string;
  descricao: string;
  valor: number;
  ativoNoSimulador?: boolean;
  modelosVinculados?: string[];
}

export interface ReservaPayload {
  // posição física (SVG atual)
  quadraId: string;
  loteId: string;
  numero: string;
  svgPathId: string;
  // o que o cliente fechou (sobrevive à troca do SVG)
  modeloId: string;
  modeloNome: string;
  valorCasa: number;
  fracaoId: string | null;
  fracaoNome: string | null;
  fracaoMedida: string | null;
  fracaoValor: number;
  itensAdicionais: { id: string; nome: string; valor: number }[];
  valorVenda: number; // = valorVendaFinal (mantém nome 'valorVenda' p/ compat)
}

interface ModalVinculoLoteProps {
  empreendimento: any;       // doc do empreendimento (modelos, lotes, simulador...)
  loteFisico: any;           // lote clicado no mapa (quadraId, id, numero, svgPathId...)
  onCancel: () => void;
  onConfirm: (modeloNome: string, valorVenda: number, extra: ReservaPayload) => void;
  salvando?: boolean;
}

export function ModalVinculoLote({ empreendimento, loteFisico, onCancel, onConfirm, salvando }: ModalVinculoLoteProps) {
  const modelos: any[] = empreendimento?.modelos || [];

  // Frações comerciais do empreendimento (empreendimento.lotes). Fallback: lote padrão sintético.
  const lotesComerciais: LoteInfo[] = useMemo(() => {
    const base: any[] = (empreendimento?.lotes && empreendimento.lotes.length > 0) ? empreendimento.lotes : [];
    if (base.length > 0) return base as LoteInfo[];
    const m0 = modelos[0];
    return [{
      id: "lote_padrao", nome: "Lote Padrão", tipo: "inteiro",
      medida: m0?.tamanhoLote || "", valor: m0?.valorLote ?? 48000,
      ativo: true, isPadrao: true, modelosVinculados: [],
    }] as LoteInfo[];
  }, [empreendimento, modelos]);

  const itensComplementares: ItemComplementar[] = empreendimento?.simulador?.cub?.itensComplementares || [];

  // Frações admitidas no lote físico (cadastro do admin). A metragem é fato físico:
  // o lote restringe o conjunto, e o modelo escolhido decide qual delas vale.
  const idsPermitidos: string[] = Array.isArray(loteFisico?.fracaoIds) ? loteFisico.fracaoIds : [];
  const temRestricao = idsPermitidos.length > 0;

  // ── ESTADO ──
  const [modeloId, setModeloId] = useState<string>(modelos[0]?.id || "");
  const [fracaoId, setFracaoId] = useState<string | null>(null);
  const [itensAtivos, setItensAtivos] = useState<Record<string, boolean>>({});

  const modelo = useMemo(() => modelos.find(m => m.id === modeloId) || modelos[0], [modelos, modeloId]);

  // Frações visíveis e padrão do modelo (mesma hierarquia do simulador)
  const fracoesVisiveis = useMemo(() => lotesVisiveis(lotesComerciais, modeloId), [lotesComerciais, modeloId]);
  const fracaoPadrao = useMemo(() => padraoDoModelo(lotesComerciais, modeloId), [lotesComerciais, modeloId]);

  // Interseção: frações do lote ∩ frações visíveis para o modelo escolhido.
  const fracoesPermitidas = useMemo(
    () => (temRestricao ? fracoesVisiveis.filter(l => idsPermitidos.includes(l.id)) : fracoesVisiveis),
    [temRestricao, idsPermitidos, fracoesVisiveis]
  );

  // Modelo sem nenhuma fração compatível com este lote → não pode ser vendido aqui.
  const modeloIncompativel = temRestricao && fracoesPermitidas.length === 0;

  // Sobrou exatamente uma → trava automática, sem escolha para o corretor.
  const fracaoTravada = temRestricao && fracoesPermitidas.length === 1 ? fracoesPermitidas[0] : null;

  // Padrão efetivo respeitando a restrição do lote.
  const fracaoPadraoEfetiva = useMemo(() => {
    if (fracaoPadrao && fracoesPermitidas.some(l => l.id === fracaoPadrao.id)) return fracaoPadrao;
    return [...fracoesPermitidas].sort((a, b) => a.valor - b.valor)[0] || null;
  }, [fracoesPermitidas, fracaoPadrao]);

  // Itens visíveis para este modelo (igual ItensAdicionaisSimulador)
  const itensFiltrados = useMemo(() => itensComplementares.filter(item => {
    if (!item.ativoNoSimulador) return false;
    const vinc = item.modelosVinculados ?? [];
    return vinc.length === 0 || vinc.includes(modeloId);
  }), [itensComplementares, modeloId]);

  // Ao trocar de modelo: volta a fração ao padrão do modelo e zera os itens (igual simulador)
  useEffect(() => {
    setFracaoId(fracaoPadraoEfetiva?.id ?? null);
    setItensAtivos({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeloId, fracaoPadraoEfetiva?.id]);

  const fracaoSelecionada = useMemo(
    () => fracoesPermitidas.find(l => l.id === fracaoId) || fracaoPadraoEfetiva || null,
    [fracoesPermitidas, fracaoId, fracaoPadraoEfetiva]
  );

  // valorCasa idêntico ao EmpreendimentoApp: modelo.valorCasa ?? max(0, modelo.valor − fracaoPadrao.valor)
  const valorCasa = useMemo(() => {
    const vc = (modelo as any)?.valorCasa;
    if (typeof vc === "number") return vc;
    return Math.max(0, ((modelo?.valor || 0) - (fracaoPadrao?.valor || 0)));
  }, [modelo, fracaoPadrao]);

  const totalItens = useMemo(
    () => itensFiltrados.filter(i => itensAtivos[i.id]).reduce((acc, i) => acc + (i.valor || 0), 0),
    [itensFiltrados, itensAtivos]
  );

  const valorFracao = fracaoSelecionada?.valor ?? 0;
  const valorVendaFinal = valorCasa + valorFracao + totalItens;

  const temFracoes = fracoesPermitidas.length > 1; // só mostra o passo se há escolha real
  const temItens = itensFiltrados.length > 0;

  const podeConfirmar = Boolean(modelo) && !salvando && !modeloIncompativel && Boolean(fracaoSelecionada);

  const confirmar = () => {
    if (!modelo) return;
    const itensList = itensFiltrados
      .filter(i => itensAtivos[i.id])
      .map(i => ({ id: i.id, nome: i.descricao, valor: i.valor }));

    const payload: ReservaPayload = {
      quadraId: loteFisico.quadraId,
      loteId: loteFisico.id,
      numero: loteFisico.numero,
      svgPathId: loteFisico.svgPathId || "",
      modeloId: modelo.id,
      modeloNome: modelo.nome,
      valorCasa,
      fracaoId: fracaoSelecionada?.id ?? null,
      fracaoNome: fracaoSelecionada?.nome ?? null,
      fracaoMedida: (fracaoSelecionada as any)?.medida ?? null,
      fracaoValor: valorFracao,
      itensAdicionais: itensList,
      valorVenda: valorVendaFinal,
    };
    onConfirm(modelo.nome, valorVendaFinal, payload);
  };

  const toggleItem = (id: string) => setItensAtivos(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", width: "100%", maxWidth: 460, borderRadius: 20, border: "1px solid var(--border-subtle)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Home size={22} color="var(--terracota)" />
            <div>
              <h3 style={{ color: "white", fontSize: 17, fontWeight: 800 }}>Vincular Lote {loteFisico.numero}</h3>
              <p style={{ color: "var(--gray-mid)", fontSize: 12, marginTop: 2 }}>Espelha exatamente o simulador do cliente</p>
            </div>
          </div>
          <button onClick={onCancel} style={{ background: "transparent", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {/* Corpo rolável */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>

          {/* PASSO 1 — MODELO */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--gray-mid)", marginBottom: 10 }}>1 · Modelo da Casa</p>
            {modelos.length === 0 ? (
              <p style={{ color: "var(--gray-mid)", fontSize: 13 }}>Nenhum modelo cadastrado neste empreendimento.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {modelos.map((m: any) => {
                  const isSel = m.id === modeloId;
                  const vc = typeof m.valorCasa === "number" ? m.valorCasa : Math.max(0, (m.valor || 0) - (fracaoPadrao?.valor || 0));
                  return (
                    <button key={m.id} onClick={() => setModeloId(m.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderRadius: 12, cursor: "pointer", textAlign: "left", background: isSel ? "linear-gradient(135deg, rgba(175,111,83,0.18), rgba(33,57,43,0.4))" : "rgba(0,0,0,0.2)", border: isSel ? "2px solid var(--terracota)" : "1px solid var(--border-subtle)" }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: isSel ? "var(--terracota-light)" : "var(--gray-light)" }}>{m.nome}</p>
                        <p style={{ fontSize: 11, color: "var(--gray-mid)", marginTop: 2 }}>Casa: {formatBRL(vc)}{m.area ? ` · ${m.area}m²` : ""}</p>
                      </div>
                      {isSel && <Check size={16} color="var(--terracota)" style={{ flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* MODELO INCOMPATÍVEL COM AS FRAÇÕES DESTE LOTE */}
          {modeloIncompativel && (
            <div style={{ display: "flex", gap: 12, padding: "14px 16px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⛔</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 4 }}>Este modelo não é vendável neste lote</p>
                <p style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.6 }}>
                  Nenhuma das frações permitidas para o lote {loteFisico.numero} está disponível para <strong>{modelo?.nome}</strong>. Escolha outro modelo ou outro lote.
                </p>
              </div>
            </div>
          )}

          {/* FRAÇÃO TRAVADA — resolvida pelo lote físico + modelo escolhido */}
          {fracaoTravada && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.25)" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#38bdf8", marginBottom: 3 }}>Fração deste lote</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-light)" }}>
                  {fracaoTravada.nome}{(fracaoTravada as any).medida ? ` · ${(fracaoTravada as any).medida}` : ""}
                </p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#38bdf8", flexShrink: 0 }}>{formatBRL(fracaoTravada.valor)}</p>
            </div>
          )}

          {/* PASSO 2 — FRAÇÃO / LOTE (só se houver escolha) */}
          {temFracoes && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--gray-mid)", marginBottom: 10 }}>2 · Lote / Fração</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...fracoesPermitidas].sort((a, b) => a.valor - b.valor).map(l => {
                  const isSel = (fracaoSelecionada?.id || null) === l.id;
                  const ehPadrao = fracaoPadrao?.id === l.id;
                  return (
                    <button key={l.id} onClick={() => setFracaoId(l.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderRadius: 12, cursor: "pointer", textAlign: "left", background: isSel ? "rgba(175,111,83,0.12)" : "rgba(0,0,0,0.2)", border: isSel ? "1.5px solid var(--terracota)" : "1px solid var(--border-subtle)" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isSel ? "var(--terracota-light)" : "var(--gray-light)" }}>{l.nome}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 6, textTransform: "uppercase", background: l.tipo === "inteiro" ? "rgba(74,222,128,0.12)" : "rgba(56,189,248,0.12)", color: l.tipo === "inteiro" ? "#4ade80" : "#38bdf8" }}>
                            {l.tipo === "inteiro" ? "Inteiro" : "Fração"}
                          </span>
                          {ehPadrao && <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 6, textTransform: "uppercase", background: "rgba(255,255,255,0.06)", color: "var(--gray-mid)" }}>★ Padrão</span>}
                        </div>
                        {l.medida && <p style={{ fontSize: 11, color: "var(--gray-mid)", marginTop: 2 }}>{l.medida}</p>}
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 800, flexShrink: 0, color: isSel ? "var(--terracota)" : "var(--gray-light)" }}>{formatBRL(l.valor)}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PASSO 3 — ITENS ADICIONAIS (só os ativos no simulador) */}
          {temItens && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--gray-mid)", marginBottom: 10 }}>{temFracoes ? "3" : "2"} · Itens Opcionais</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {itensFiltrados.map(item => {
                  const isOn = itensAtivos[item.id] ?? false;
                  return (
                    <div key={item.id} onClick={() => toggleItem(item.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, cursor: "pointer", background: isOn ? "rgba(74,222,128,0.05)" : "rgba(0,0,0,0.15)", border: isOn ? "1px solid rgba(74,222,128,0.25)" : "1px solid var(--border-subtle)" }}>
                      <div style={{ width: 40, height: 22, borderRadius: 11, flexShrink: 0, background: isOn ? "#4ade80" : "rgba(255,255,255,0.15)", position: "relative", transition: "background 0.2s" }}>
                        <div style={{ position: "absolute", top: 2, left: isOn ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, color: isOn ? "var(--gray-light)" : "var(--gray-mid)" }}>{item.descricao}</p>
                      <p style={{ fontSize: 13, fontWeight: 800, flexShrink: 0, color: isOn ? "#4ade80" : "var(--gray-dark)" }}>
                        {item.valor > 0 ? `+ ${formatBRL(item.valor)}` : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé — preço final ao vivo + confirmar */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--gray-mid)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Casa ({modelo?.nome})</span><span style={{ color: "var(--gray-light)" }}>{formatBRL(valorCasa)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Lote{fracaoSelecionada?.nome ? ` (${fracaoSelecionada.nome})` : ""}</span><span style={{ color: "var(--gray-light)" }}>{formatBRL(valorFracao)}</span></div>
            {totalItens > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Itens opcionais</span><span style={{ color: "var(--gray-light)" }}>+ {formatBRL(totalItens)}</span></div>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px dashed var(--border-subtle)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--gray-mid)" }}>Total ao cliente</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--terracota)" }}>{formatBRL(valorVendaFinal)}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onCancel} disabled={salvando} style={{ flex: "0 0 auto", padding: "12px 18px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)", color: "white", fontWeight: 600, cursor: salvando ? "not-allowed" : "pointer", fontSize: 13 }}>Cancelar</button>
            <button onClick={confirmar} disabled={!podeConfirmar} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", fontWeight: 800, fontSize: 14, cursor: podeConfirmar ? "pointer" : "not-allowed", background: podeConfirmar ? "var(--terracota)" : "rgba(175,111,83,0.3)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {salvando ? "Reservando..." : <>Confirmar Reserva <ChevronRight size={16} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}