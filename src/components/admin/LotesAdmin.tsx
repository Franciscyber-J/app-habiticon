"use client";

import React from "react";
import { Plus, Trash2, Star, Ruler, Info } from "lucide-react";

// ─────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────

export interface Lote {
  id: string;
  nome: string;
  tipo: "inteiro" | "fracao";
  medida: string;          // string de exibição — gerada automaticamente
  frente?: number;         // metros (opcional)
  profundidade?: number;   // metros (opcional)
  areaM2?: number;         // m² (opcional — auto-calculada de frente × profundidade)
  valor: number;
  ativo: boolean;
  isPadrao: boolean;
  modelosVinculados: string[]; // [] = todos os modelos
}

interface LotesAdminProps {
  lotes: Lote[];
  modelos: { id: string; nome: string }[];
  onUpdate: (lotes: Lote[]) => void;
}

// ─────────────────────────────────────────────────────────
// HELPER — monta a string de exibição a partir das dimensões
// ─────────────────────────────────────────────────────────

function montarMedida(l: Partial<Lote>): string {
  const f = Number(l.frente) || 0;
  const p = Number(l.profundidade) || 0;
  const area = Number(l.areaM2) || (f > 0 && p > 0 ? f * p : 0);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  if (area > 0 && f > 0 && p > 0) return `${fmt(area)}m² (${fmt(f)}m × ${fmt(p)}m)`;
  if (area > 0) return `${fmt(area)}m²`;
  if (f > 0 && p > 0) return `${fmt(f)}m × ${fmt(p)}m`;
  return "";
}

// ─────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────

export function LotesAdmin({ lotes, modelos, onUpdate }: LotesAdminProps) {

  const addLote = () => {
    onUpdate([...lotes, {
      id: `lote_${Date.now()}`,
      nome: lotes.length === 0 ? "Lote Padrão" : `Lote ${lotes.length + 1}`,
      tipo: "inteiro",
      medida: "",
      valor: 0,
      ativo: true,
      isPadrao: lotes.length === 0,
      modelosVinculados: [],
    }]);
  };

  const patch = (id: string, p: Partial<Lote>) => {
    onUpdate(lotes.map(l => {
      if (l.id !== id) return l;
      const atualizado = { ...l, ...p };
      // Regenera a string de exibição sempre que dimensões mudam
      if ("frente" in p || "profundidade" in p || "areaM2" in p) {
        atualizado.medida = montarMedida(atualizado);
      }
      return atualizado;
    }));
  };

  // Ao mudar frente/profundidade, recalcula a área automaticamente
  // (a menos que o usuário já tenha digitado uma área manual diferente do produto anterior)
  const patchDimensao = (id: string, campo: "frente" | "profundidade", valor: number) => {
    const l = lotes.find(x => x.id === id);
    if (!l) return;
    const novo: Partial<Lote> = { [campo]: valor };
    const f = campo === "frente" ? valor : (Number(l.frente) || 0);
    const p = campo === "profundidade" ? valor : (Number(l.profundidade) || 0);
    const produtoAnterior = (Number(l.frente) || 0) * (Number(l.profundidade) || 0);
    const areaEraAuto = !l.areaM2 || Math.abs((l.areaM2 || 0) - produtoAnterior) < 0.01;
    if (f > 0 && p > 0 && areaEraAuto) {
      novo.areaM2 = Math.round(f * p * 100) / 100;
    }
    patch(id, novo);
  };

  const remove = (id: string) => {
    const alvo = lotes.find(l => l.id === id);
    if (!alvo) return;
    if (lotes.length === 1) {
      alert("É necessário ter pelo menos um lote cadastrado — ele é usado no laudo CUB e no preço final.");
      return;
    }
    if (!confirm(`Remover "${alvo.nome}"?`)) return;
    onUpdate(lotes.filter(l => l.id !== id));
  };

  // ★ PADRÃO POR ESCOPO:
  // - clicar numa estrela marcada = desmarca (pode ficar zero padrões → vale o mais barato)
  // - marcar um lote global (✦ Todos) desmarca apenas outros globais
  // - marcar um lote específico desmarca apenas específicos que compartilham modelo
  // - global + específico convivem: o específico vence para o seu modelo (hierarquia)
  const togglePadrao = (id: string) => {
    const alvo = lotes.find(l => l.id === id);
    if (!alvo) return;

    // Desmarcar
    if (alvo.isPadrao) {
      onUpdate(lotes.map(l => l.id === id ? { ...l, isPadrao: false } : l));
      return;
    }

    const vincAlvo = alvo.modelosVinculados ?? [];
    const alvoGlobal = vincAlvo.length === 0;

    const conflitantes = lotes.filter(l => {
      if (l.id === id || !l.isPadrao) return false;
      const v = l.modelosVinculados ?? [];
      const lGlobal = v.length === 0;
      if (alvoGlobal) return lGlobal;                  // global só conflita com global
      if (lGlobal) return false;                       // específico não conflita com global
      return v.some(mid => vincAlvo.includes(mid));    // específicos com modelo em comum
    });

    if (conflitantes.length > 0) {
      const nomes = conflitantes.map(c => `"${c.nome}"`).join(", ");
      if (!confirm(`Marcar "${alvo.nome}" como padrão vai desmarcar ${nomes} (mesmo escopo de modelos). Continuar?`)) return;
    }

    onUpdate(lotes.map(l => {
      if (l.id === id) return { ...l, isPadrao: true };
      if (conflitantes.some(c => c.id === l.id)) return { ...l, isPadrao: false };
      return l;
    }));
  };

  const toggleModelo = (loteId: string, modeloId: string) => {
    onUpdate(lotes.map(l => {
      if (l.id !== loteId) return l;
      const atual = l.modelosVinculados ?? [];
      return {
        ...l,
        modelosVinculados: atual.includes(modeloId)
          ? atual.filter(m => m !== modeloId)
          : [...atual, modeloId],
      };
    }));
  };

  const inputStyle: React.CSSProperties = {
    padding: "9px 11px", borderRadius: 8, background: "rgba(0,0,0,0.3)",
    border: "1px solid var(--border-subtle)", color: "var(--gray-light)", fontSize: 13,
  };

  const dimLabel: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, color: "var(--gray-dark)",
    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "block",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {lotes.map(lote => {
        const todosModelos = (lote.modelosVinculados ?? []).length === 0;
        return (
          <div key={lote.id} style={{
            borderRadius: 12, overflow: "hidden",
            border: `1px solid ${lote.isPadrao ? "var(--border-active)" : "var(--border-subtle)"}`,
            background: lote.ativo ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.35)",
            opacity: lote.ativo ? 1 : 0.55,
          }}>

            {/* Linha 1 — nome, tipo, valor, padrão, ativo, excluir */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 14px" }}>
              <input
                value={lote.nome}
                onChange={e => patch(lote.id, { nome: e.target.value })}
                placeholder="Nome (ex: Lote Esquina)"
                style={{ ...inputStyle, flex: "2 1 140px", minWidth: 120, fontWeight: 600 }}
              />

              {/* Tipo: Inteiro | Fração */}
              <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-subtle)", flexShrink: 0 }}>
                {(["inteiro", "fracao"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => patch(lote.id, { tipo: t })}
                    style={{
                      padding: "8px 12px", border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 700,
                      background: lote.tipo === t ? "var(--terracota)" : "rgba(0,0,0,0.3)",
                      color: lote.tipo === t ? "white" : "var(--gray-mid)",
                    }}
                  >
                    {t === "inteiro" ? "Inteiro" : "Fração"}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "var(--terracota)", fontWeight: 700 }}>R$</span>
                <input
                  type="number"
                  value={lote.valor}
                  onChange={e => patch(lote.id, { valor: Number(e.target.value) || 0 })}
                  style={{ ...inputStyle, width: 100, fontWeight: 700 }}
                />
              </div>

              {/* Padrão (por escopo — clique de novo para desmarcar) */}
              <button
                onClick={() => togglePadrao(lote.id)}
                title={lote.isPadrao
                  ? "Clique para desmarcar como padrão"
                  : "Marcar como lote padrão do escopo (Todos = global; modelos específicos = padrão daquele(s) modelo(s))"}
                style={{
                  display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                  padding: "7px 10px", borderRadius: 8, cursor: "pointer", border: "none",
                  fontSize: 10, fontWeight: 700,
                  background: lote.isPadrao ? "var(--terracota-glow)" : "rgba(255,255,255,0.05)",
                  color: lote.isPadrao ? "var(--terracota-light)" : "var(--gray-dark)",
                }}
              >
                <Star size={12} fill={lote.isPadrao ? "currentColor" : "none"} />
                {lote.isPadrao ? (todosModelos ? "Padrão Global" : "Padrão do Modelo") : ""}
              </button>

              {/* Ativo */}
              <button
                onClick={() => patch(lote.id, { ativo: !lote.ativo })}
                style={{
                  flexShrink: 0, padding: "7px 10px", borderRadius: 8, cursor: "pointer", border: "none",
                  fontSize: 10, fontWeight: 700,
                  background: lote.ativo ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.05)",
                  color: lote.ativo ? "#4ade80" : "var(--gray-dark)",
                }}
              >
                {lote.ativo ? "Ativo" : "Inativo"}
              </button>

              <button
                onClick={() => remove(lote.id)}
                style={{ flexShrink: 0, padding: 8, borderRadius: 8, cursor: "pointer", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", display: "flex" }}
              >
                <Trash2 size={13} />
              </button>
            </div>

            {/* Linha 2 — dimensões (opcionais) */}
            <div style={{ padding: "10px 14px 12px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, paddingBottom: 9 }}>
                <Ruler size={13} color="var(--gray-dark)" />
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-dark)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Dimensões
                </span>
              </div>

              <div style={{ flex: "1 1 90px", minWidth: 90, maxWidth: 130 }}>
                <label style={dimLabel}>Frente (m)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={lote.frente || ""}
                  placeholder="Ex: 10"
                  onChange={e => patchDimensao(lote.id, "frente", Number(e.target.value) || 0)}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>

              <div style={{ flex: "1 1 110px", minWidth: 110, maxWidth: 150 }}>
                <label style={dimLabel}>Profundidade (m)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={lote.profundidade || ""}
                  placeholder="Ex: 30"
                  onChange={e => patchDimensao(lote.id, "profundidade", Number(e.target.value) || 0)}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>

              <div style={{ flex: "1 1 100px", minWidth: 100, maxWidth: 140 }}>
                <label style={dimLabel}>Área (m²)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={lote.areaM2 || ""}
                  placeholder="Auto"
                  onChange={e => patch(lote.id, { areaM2: Number(e.target.value) || 0 })}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>

              {/* Preview da medida exibida ao cliente */}
              <div style={{ flex: "2 1 160px", minWidth: 140 }}>
                <label style={dimLabel}>Exibido ao cliente</label>
                <div style={{
                  padding: "9px 11px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: lote.medida ? "rgba(74,222,128,0.06)" : "rgba(0,0,0,0.2)",
                  border: lote.medida ? "1px solid rgba(74,222,128,0.2)" : "1px dashed var(--border-subtle)",
                  color: lote.medida ? "#4ade80" : "var(--gray-dark)",
                }}>
                  {lote.medida || "— sem medida —"}
                </div>
              </div>
            </div>

            {/* Linha 3 — vínculo de modelos */}
            <div style={{ padding: "10px 14px 12px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.12)", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-dark)", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 4 }}>
                Disponível para:
              </span>
              <button
                onClick={() => patch(lote.id, { modelosVinculados: [] })}
                style={{
                  padding: "4px 10px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: todosModelos ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${todosModelos ? "rgba(74,222,128,0.3)" : "var(--border-subtle)"}`,
                  color: todosModelos ? "#4ade80" : "var(--gray-mid)",
                }}
              >
                ✦ Todos
              </button>
              {modelos.map(m => {
                const sel = (lote.modelosVinculados ?? []).includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleModelo(lote.id, m.id)}
                    style={{
                      padding: "4px 10px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600,
                      background: sel ? "var(--terracota-glow)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${sel ? "var(--border-active)" : "var(--border-subtle)"}`,
                      color: sel ? "var(--terracota-light)" : "var(--gray-mid)",
                    }}
                  >
                    {m.nome}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <button
        onClick={addLote}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 8, cursor: "pointer", width: "fit-content", background: "var(--terracota-glow)", border: "1px solid var(--border-active)", color: "var(--terracota)", fontSize: 12, fontWeight: 700 }}
      >
        <Plus size={14} /> Adicionar Lote / Fração
      </button>

      {/* Explicador da hierarquia de padrão */}
      <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.15)" }}>
        <Info size={14} color="#38bdf8" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 11, color: "var(--gray-mid)", lineHeight: 1.6 }}>
          <strong style={{ color: "#38bdf8" }}>Como o padrão funciona no simulador:</strong>{" "}
          cada modelo abre no seu <strong>★ Padrão do Modelo</strong> (lote marcado com vínculo específico).
          Se não tiver, usa o <strong>★ Padrão Global</strong> (vínculo ✦ Todos).
          Se nenhum estiver marcado, abre no <strong>lote mais barato</strong> visível para o modelo.
          Pode haver 1 padrão global e 1 padrão por modelo ao mesmo tempo — o específico vence.
        </p>
      </div>
    </div>
  );
}