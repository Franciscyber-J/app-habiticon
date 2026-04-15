"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Check } from "lucide-react";

interface Model {
  id: string;
  nome: string;
  quartos: number;
  area: number;
  valor: number;
  imagem: string;
  planta: string;
}

interface ModelSelectorProps {
  modelos: Model[];
  selected: string;
  onSelect: (id: string) => void;
}

export function ModelSelector({ modelos, selected, onSelect }: ModelSelectorProps) {
  return (
    <div className="grid gap-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
      {modelos.map((modelo) => {
        const isSelected = selected === modelo.id;
        return (
          <motion.button
            key={modelo.id}
            onClick={() => onSelect(modelo.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="text-left relative overflow-hidden rounded-2xl cursor-pointer"
            style={{
              background: isSelected
                ? "linear-gradient(135deg, rgba(175,111,83,0.2) 0%, rgba(33,57,43,0.6) 100%)"
                : "var(--bg-card)",
              border: isSelected ? "2px solid var(--terracota)" : "1px solid var(--border-subtle)",
              boxShadow: isSelected ? "var(--shadow-active)" : "var(--shadow-card)",
              transition: "all 300ms ease",
            }}
          >
            {/* Imagem */}
            <div className="relative h-48 w-full overflow-hidden" style={{ borderRadius: "14px 14px 0 0" }}>
              <div
                className="absolute inset-0 flex-center"
                style={{ background: "linear-gradient(135deg, var(--green-dark), var(--green-darker))" }}
              >
                <div className="text-center">
                  <div className="text-6xl mb-2">🏠</div>
                  <div className="text-sm" style={{ color: "var(--gray-mid)" }}>{modelo.nome}</div>
                </div>
              </div>
              {/* Overlay gradiente */}
              <div
                className="absolute bottom-0 left-0 right-0 h-16"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }}
              />
            </div>

            {/* Conteúdo */}
            <div style={{ padding: "26px 30px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 18, color: "var(--gray-light)", marginBottom: 6 }}>
                    {modelo.nome}
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--gray-mid)", lineHeight: 1.5 }}>
                    {modelo.quartos} quartos · {modelo.area}m²
                  </p>
                </div>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--terracota)", flexShrink: 0 }}
                  >
                    <Check size={14} color="white" strokeWidth={3} />
                  </motion.div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--gray-dark)", marginBottom: 5 }}>Valor do imóvel</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: isSelected ? "var(--terracota)" : "var(--gray-light)" }}>
                    R$ {modelo.valor.toLocaleString("pt-BR")}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    padding: "5px 10px",
                    borderRadius: 8,
                    background: isSelected ? "var(--terracota-glow)" : "rgba(0,0,0,0.3)",
                    color: isSelected ? "var(--terracota-light)" : "var(--gray-mid)",
                    border: `1px solid ${isSelected ? "var(--border-active)" : "var(--border-subtle)"}`,
                    letterSpacing: "0.03em",
                  }}
                >
                  Lote 250m²
                </div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
