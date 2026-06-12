"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

// ─────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────

interface ItemComplementar {
  id: string;
  descricao: string;
  valor: number;
  ativoNoSimulador?: boolean;
  modelosVinculados?: string[];
}

interface ItensAdicionaisSimuladorProps {
  itens: ItemComplementar[];
  modeloId: string;
  onTotalChange: (total: number, itensAtivos: { id: string; nome: string; valor: number }[]) => void;
}

// ─────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────

export function ItensAdicionaisSimulador({ itens, modeloId, onTotalChange }: ItensAdicionaisSimuladorProps) {

  const [ativos, setAtivos] = useState<Record<string, boolean>>({});

  // Filtra itens visíveis para este modelo
  const itensFiltrados = itens.filter(item => {
    if (!item.ativoNoSimulador) return false;
    const vinculados = item.modelosVinculados ?? [];
    return vinculados.length === 0 || vinculados.includes(modeloId);
  });

  // Reseta quando modelo muda
  useEffect(() => {
    setAtivos({});
  }, [modeloId]);

  // Emite total sempre que ativos mudam
  useEffect(() => {
    const itensAtivosList = itensFiltrados.filter(item => ativos[item.id]);
    const total = itensAtivosList.reduce((acc, item) => acc + (item.valor || 0), 0);
    onTotalChange(
      total,
      itensAtivosList.map(item => ({ id: item.id, nome: item.descricao, valor: item.valor }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativos, modeloId]);

  // Nada para mostrar
  if (itensFiltrados.length === 0) return null;

  const toggle = (id: string) => {
    setAtivos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const totalAtivos = itensFiltrados
    .filter(item => ativos[item.id])
    .reduce((acc, item) => acc + (item.valor || 0), 0);

  const temAlgumAtivo = itensFiltrados.some(item => ativos[item.id]);

  return (
    <div className="glass-card-nohover">
      <h3 style={{
        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 20,
      }}>
        ✦ Itens Opcionais
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {itensFiltrados.map(item => {
          const isOn = ativos[item.id] ?? false;

          return (
            <motion.div
              key={item.id}
              layout
              style={{
                borderRadius: 12, overflow: "hidden",
                border: `1px solid ${isOn ? "rgba(74,222,128,0.25)" : "var(--border-subtle)"}`,
                background: isOn ? "rgba(74,222,128,0.05)" : "rgba(0,0,0,0.15)",
                transition: "border-color 0.2s, background 0.2s",
                cursor: "pointer",
              }}
              onClick={() => toggle(item.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px" }}>

                {/* Toggle iOS */}
                <div style={{
                  width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                  background: isOn ? "#4ade80" : "rgba(255,255,255,0.15)",
                  position: "relative", transition: "background 0.25s",
                }}>
                  <motion.div
                    animate={{ x: isOn ? 22 : 2 }}
                    transition={{ type: "spring", damping: 22, stiffness: 420 }}
                    style={{
                      position: "absolute", top: 2,
                      width: 20, height: 20, borderRadius: "50%",
                      background: "white",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                    }}
                  />
                </div>

                {/* Descrição */}
                <p style={{
                  fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0,
                  color: isOn ? "var(--gray-light)" : "var(--gray-mid)",
                  transition: "color 0.2s",
                }}>
                  {item.descricao}
                </p>

                {/* Valor */}
                <p style={{
                  fontSize: 13, fontWeight: 800, flexShrink: 0,
                  color: isOn ? "#4ade80" : "var(--gray-dark)",
                  transition: "color 0.2s",
                }}>
                  {item.valor > 0
                    ? `+ R$ ${item.valor.toLocaleString("pt-BR")}`
                    : "—"}
                </p>
              </div>
            </motion.div>
          );
        })}

        {/* Totalizador — aparece só quando tem algo ativo */}
        {temAlgumAtivo && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 18px", borderRadius: 10, marginTop: 4,
              background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
            }}
          >
            <span style={{
              fontSize: 11, fontWeight: 700, color: "#4ade80",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              Total dos Opcionais:
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#4ade80" }}>
              + R$ {totalAtivos.toLocaleString("pt-BR")}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}