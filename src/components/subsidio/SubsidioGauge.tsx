"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { calcularSubsidio, formatBRL, type FaixaMCMV } from "@/lib/calculos";
import { CheckCircle, TrendingUp, Info, AlertTriangle } from "lucide-react";

interface SubsidioGaugeProps {
  faixas: FaixaMCMV[];
  onSubsidioChange?: (subsidio: number, taxa: number, rendaDigitada: boolean, renda: number) => void;
  initialRenda?: number;
  valorImovel: number;
  tetoMcmv: number;
}

export function SubsidioGauge({
  faixas,
  onSubsidioChange,
  initialRenda,
  valorImovel,
  tetoMcmv,
}: SubsidioGaugeProps) {
  const [renda, setRenda] = useState(() => {
    if (!initialRenda) return "";
    return new Intl.NumberFormat("pt-BR").format(initialRenda);
  });

  const rendaNum = parseFloat(renda.replace(/\D/g, "")) || 0;

  // Lógica de Subsídio e Taxa
  const excedeTeto = valorImovel > tetoMcmv;

  const resultado = useMemo(() => {
    if (rendaNum <= 0) return null;
    return calcularSubsidio(rendaNum, faixas);
  }, [rendaNum, faixas]);

  const faixaAtual = resultado?.faixa;
  const subsidio = resultado?.subsidio || 0;
  const taxa = resultado?.taxa || 12;

  // Notifica o pai sobre mudanças
  useEffect(() => {
    if (onSubsidioChange) {
      onSubsidioChange(subsidio, taxa, rendaNum > 0, rendaNum);
    }
  }, [subsidio, taxa, rendaNum, onSubsidioChange]);

  // Gauge percentage (0 a 100%, baseado na renda máxima da faixa 3)
  const maxRenda = faixas[faixas.length - 1]?.rendaMax || 13000;
  const gaugePct = Math.min((rendaNum / maxRenda) * 100, 100);

  // Cores do gauge por faixa
  const getGaugeColor = () => {
    if (!faixaAtual) return "#4ade80";
    if (faixaAtual.id === 1) return "#4ade80";
    if (faixaAtual.id === 2) return "#a3e635";
    return "#fb923c";
  };

  const formatInput = (val: string) => {
    const num = val.replace(/\D/g, "");
    if (!num) return "";
    return new Intl.NumberFormat("pt-BR").format(parseInt(num));
  };

  return (
    <div className="space-y-12">
      {/* Input de Renda */}
      <div>
        <label className="text-sm font-bold mb-4 block" style={{ color: "var(--gray-light)" }}>
          Renda Bruta Familiar Mensal
        </label>
        <div className="relative">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-lg" style={{ color: "var(--terracota)" }}>R$</span>
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: "4.5rem", fontSize: 20, height: 60 }}
            placeholder="0"
            value={renda}
            onChange={(e) => {
              const formatted = formatInput(e.target.value);
              setRenda(formatted);
            }}
            inputMode="numeric"
          />
        </div>
      </div>

      {/* Alerta de Teto */}
      {excedeTeto && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-4 items-center"
        >
          <AlertTriangle className="text-red-500 shrink-0" size={20} />
          <p className="text-xs text-red-200">
            Atenção: O valor deste imóvel (R$ {valorImovel.toLocaleString()}) excede o teto permitido para o programa MCMV nesta região (R$ {tetoMcmv.toLocaleString()}).
          </p>
        </motion.div>
      )}

      {/* Gauge Termômetro */}
      <AnimatePresence>
        {rendaNum > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="space-y-10"
          >
            {/* Barra de Progresso */}
            <div style={{ padding: "0 4px" }}>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: "var(--gray-dark)" }}>
                <span>Faixa 1</span>
                <span>Faixa 2</span>
                <span>Faixa 3</span>
              </div>
              <div className="relative h-4 rounded-full" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                {faixas.slice(0, -1).map((f) => (
                  <div
                    key={f.id}
                    className="absolute top-0 bottom-0 w-px"
                    style={{ left: `${(f.rendaMax / maxRenda) * 100}%`, background: "rgba(255,255,255,0.1)" }}
                  />
                ))}
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  animate={{ width: `${gaugePct}%`, backgroundColor: getGaugeColor() }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{ boxShadow: `0 0 15px ${getGaugeColor()}40` }}
                />
              </div>
            </div>

            {/* Resultado por faixa */}
            {faixaAtual && (
              <motion.div
                key={faixaAtual.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <div className="p-8 rounded-2xl text-center flex flex-col justify-center gap-1" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-subtle)" }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--gray-dark)" }}>Enquadramento</div>
                  <div className="text-lg font-black" style={{ color: faixaAtual.cor }}>{faixaAtual.nome}</div>
                </div>
                <div className="p-8 rounded-2xl text-center flex flex-col justify-center gap-1" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-subtle)" }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--gray-dark)" }}>Subsídio MCMV</div>
                  <div className="text-xl font-black text-green-400">{subsidio > 0 ? formatBRL(subsidio) : "—"}</div>
                </div>
                <div className="p-8 rounded-2xl text-center flex flex-col justify-center gap-1" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-subtle)" }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--gray-dark)" }}>Taxa de Juros</div>
                  <div className="text-xl font-black" style={{ color: "var(--terracota)" }}>{taxa}% a.a.</div>
                </div>
              </motion.div>
            )}

            {/* Nota informativa */}
            <div className="p-8 rounded-2xl flex items-start gap-4" style={{ background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-subtle)" }}>
              <Info size={18} color="var(--gray-dark)" className="shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed" style={{ color: "var(--gray-dark)" }}>
                Simulação baseada nas regras vigentes do programa Minha Casa Minha Vida (Federal). 
                Valores e taxas sujeitos à análise de crédito e aprovação da Caixa Econômica Federal.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
