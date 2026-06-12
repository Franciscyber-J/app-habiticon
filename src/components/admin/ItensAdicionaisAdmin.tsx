"use client";

import React from "react";
import { ToggleLeft, ToggleRight, Info } from "lucide-react";

// ─────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────

export interface ItemComplementar {
  id: string;
  descricao: string;
  valor: number;
  ativoNoSimulador?: boolean;
  modelosVinculados?: string[]; // [] = todos os modelos
}

interface Modelo {
  id: string;
  nome: string;
}

interface ItensAdicionaisAdminProps {
  itens: ItemComplementar[];
  modelos: Modelo[];
  onUpdate: (itens: ItemComplementar[]) => void;
}

// ─────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────

export function ItensAdicionaisAdmin({ itens, modelos, onUpdate }: ItensAdicionaisAdminProps) {

  const toggleAtivo = (id: string) => {
    onUpdate(itens.map(item =>
      item.id === id ? { ...item, ativoNoSimulador: !item.ativoNoSimulador } : item
    ));
  };

  const toggleModelo = (itemId: string, modeloId: string) => {
    onUpdate(itens.map(item => {
      if (item.id !== itemId) return item;
      const atual = item.modelosVinculados ?? [];
      const novos = atual.includes(modeloId)
        ? atual.filter(m => m !== modeloId)
        : [...atual, modeloId];
      return { ...item, modelosVinculados: novos };
    }));
  };

  const setTodos = (itemId: string) => {
    onUpdate(itens.map(item =>
      item.id === itemId ? { ...item, modelosVinculados: [] } : item
    ));
  };

  if (itens.length === 0) {
    return (
      <div style={{ padding: "32px", textAlign: "center", borderRadius: 12, background: "rgba(0,0,0,0.15)", border: "1px dashed var(--border-subtle)" }}>
        <p style={{ fontSize: 13, color: "var(--gray-dark)" }}>
          Nenhum item complementar cadastrado ainda.{" "}
          <strong style={{ color: "var(--gray-light)" }}>
            Adicione itens em Valores → Linha MCMV → Obras Complementares.
          </strong>
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Aviso explicativo */}
      <div style={{ display: "flex", gap: 8, padding: "12px 14px", borderRadius: 10, background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)" }}>
        <Info size={14} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 12, color: "var(--gray-light)", lineHeight: 1.6 }}>
          Os itens e valores são gerenciados em <strong>Valores → Linha MCMV → Obras Complementares</strong>.
          Aqui você controla quais aparecem como opcionais para o cliente no simulador e para quais modelos de casa.
        </p>
      </div>

      {/* Lista de itens */}
      {itens.map(item => {
        const ativo = item.ativoNoSimulador ?? false;
        const vinculados = item.modelosVinculados ?? [];
        const todosModelos = vinculados.length === 0;
        const semModeloSelecionado = !todosModelos && vinculados.length === 0;

        return (
          <div key={item.id} style={{
            borderRadius: 14, overflow: "hidden",
            border: `1px solid ${ativo ? "rgba(74,222,128,0.25)" : "var(--border-subtle)"}`,
            background: ativo ? "rgba(74,222,128,0.04)" : "var(--bg-card)",
            transition: "border-color 0.2s, background 0.2s",
          }}>

            {/* Linha principal — nome + valor + toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-light)", marginBottom: 4 }}>
                  {item.descricao}
                </p>
                <p style={{ fontSize: 12, color: item.valor > 0 ? (ativo ? "#4ade80" : "var(--gray-mid)") : "#f87171" }}>
                  {item.valor > 0
                    ? `R$ ${item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : "⚠️ Valor zerado — configure em Obras Complementares (CUB)"}
                </p>
              </div>

              <button
                onClick={() => toggleAtivo(item.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 10, cursor: "pointer",
                  fontWeight: 700, fontSize: 12, border: "none",
                  transition: "all 0.2s", flexShrink: 0,
                  background: ativo ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.07)",
                  color: ativo ? "#4ade80" : "var(--gray-mid)",
                }}
              >
                {ativo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {ativo ? "Visível" : "Oculto"}
              </button>
            </div>

            {/* Seletor de modelos (só aparece se item está ativo) */}
            {ativo && (
              <div style={{
                padding: "14px 20px 16px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(0,0,0,0.15)",
              }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, color: "var(--gray-dark)",
                  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10,
                }}>
                  Aparece para:
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>

                  {/* Todos os modelos */}
                  <button
                    onClick={() => setTodos(item.id)}
                    style={{
                      padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                      fontSize: 12, fontWeight: 600, transition: "0.15s",
                      background: todosModelos ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${todosModelos ? "rgba(74,222,128,0.3)" : "var(--border-subtle)"}`,
                      color: todosModelos ? "#4ade80" : "var(--gray-mid)",
                    }}
                  >
                    ✦ Todos os modelos
                  </button>

                  {/* Modelos individuais */}
                  {modelos.map(m => {
                    const sel = vinculados.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleModelo(item.id, m.id)}
                        style={{
                          padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                          fontSize: 12, fontWeight: 600, transition: "0.15s",
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

                {semModeloSelecionado && (
                  <p style={{ fontSize: 11, color: "#fca5a5", marginTop: 8 }}>
                    ⚠️ Nenhum modelo selecionado — o item não aparecerá no simulador.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}