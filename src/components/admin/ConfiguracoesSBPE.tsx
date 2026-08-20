"use client";

import { useState, useEffect } from "react";
import { Info, Plus, Trash2, AlertTriangle } from "lucide-react";
import { entradaMinimaDoModelo } from "@/lib/calculos";

// ============================================================================
// COMPONENTES DE UI
// ============================================================================
function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-mid)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {children}
      </label>
      {hint && <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 3, lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );
}

function NumInput({ value, onChange, prefix, suffix, step = 1, min = 0, placeholder }: {
  value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; step?: number; min?: number; placeholder?: string;
}) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const commit = () => { const n = parseFloat(local) || 0; if (n !== value) onChange(n); };
  
  return (
    <div style={{ position: "relative" }}>
      {prefix && (
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--terracota)", fontWeight: 700, pointerEvents: "none" }}>
          {prefix}
        </span>
      )}
      <input 
        type="number" className="input-field" 
        style={{ paddingLeft: prefix ? 40 : 14, paddingRight: suffix ? 46 : 14, fontSize: 15 }}
        value={local} step={step} min={min} placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)} onBlur={commit} 
      />
      {suffix && (
        <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--gray-dark)", pointerEvents: "none" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 28, boxShadow: "var(--shadow-card)" }}>
      <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-light)" }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: "var(--gray-dark)", marginTop: 4, lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Two({ children }: { children: React.ReactNode }) { 
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>{children}</div>; 
}

// ============================================================================
// COMPONENTE PRINCIPAL SBPE
// ============================================================================
interface ConfiguracoesSBPEProps {
  emp: any;
  update: (field: string, value: any) => void;
}

export function ConfiguracoesSBPE({ emp, update }: ConfiguracoesSBPEProps) {
  
  const itensComplementares = emp?.simulador?.itensComplementaresSBPE || [];
  const totalItensExtra = itensComplementares.reduce((acc: number, item: any) => acc + (Number(item.valor) || 0), 0);

  // Diagnóstico CUB SBPE
  const diagCUBSBPE = emp?.simulador?.cubSBPE > 0 ? emp.modelos.map((m: any) => {
    const cubVigente = emp.simulador.cubSBPE;
    const bdi = emp.simulador.bdiSBPE ?? 0.18;
    const lote = emp.modelos[0]?.valorLote || 48000;
    
    // MATEMÁTICA DA AVALIAÇÃO: Transforma o valor extra em CUB/m²
    const cubEquivalente = cubVigente + (totalItensExtra / m.area);
    const laudo = lote + m.area * cubEquivalente * (1 + bdi);
    
    const maxFinSAC = laudo * 0.80; // SBPE permite 80% na SAC
    const maxFinPRICE = laudo * 0.70; // SBPE permite 70% na PRICE
    
    const pisoModelo = entradaMinimaDoModelo(emp, m);
    const entradaMinSAC = Math.max(pisoModelo, m.valor - maxFinSAC);
    const funcionaSAC = maxFinSAC >= m.valor - pisoModelo;
    
    return { nome: m.nome, laudo, maxFinSAC, maxFinPRICE, entradaMinSAC, funcionaSAC, cubEquivalente };
  }) : null;

  return (
    <Card 
      title="🏢 Linha SBPE (Alto Padrão / Fora MCMV)" 
      subtitle="Configure a taxa balcão e a engenharia de avaliação. O sistema mudará automaticamente para esta linha se a renda superar R$ 13.000 ou o imóvel o teto do MCMV."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* Aviso de Isolamento */}
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", display: "flex", gap: 8, alignItems: "center" }}>
          <Info size={13} color="#60a5fa" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "#93c5fd", lineHeight: 1.5 }}>
            Os valores abaixo <strong>NÃO</strong> interferem nos cálculos do MCMV.
          </p>
        </div>

        <Two>
          <div>
            <FieldLabel hint="Taxa nominal a.a. (Ex: 11.38% da Caixa)">Taxa de Juros SBPE</FieldLabel>
            <NumInput 
              value={emp.simulador.taxaSBPE ?? 11.38} 
              suffix="% a.a." step={0.01} 
              onChange={v => update("simulador.taxaSBPE", v)} 
            />
          </div>
          <div /> 
        </Two>

        <Two>
          <div>
            <FieldLabel hint="CUB Padrão Alto (R-1) Vigente">CUB Base (SBPE)</FieldLabel>
            <NumInput 
              value={emp.simulador.cubSBPE || 0} 
              prefix="R$" suffix="/m²" step={1} placeholder="Ex: 3290" 
              onChange={v => update("simulador.cubSBPE", v)} 
            />
          </div>
          <div>
            <FieldLabel hint="BDI máximo aceito pela Caixa (18%)">BDI SBPE (%)</FieldLabel>
            <NumInput 
              value={emp.simulador.bdiSBPE ? Math.round(emp.simulador.bdiSBPE * 100) : 18} 
              suffix="%" step={0.5} min={0} 
              onChange={v => update("simulador.bdiSBPE", v / 100)} 
            />
          </div>
        </Two>

        {/* ── SEÇÃO: OBRAS COMPLEMENTARES ── */}
        <div style={{ marginTop: 16, padding: "20px", background: "rgba(0,0,0,0.2)", borderRadius: 12, border: "1px dashed var(--border-subtle)" }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--terracota-light)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Obras Complementares (Estratégia PCI)
          </h4>
          <p style={{ fontSize: 12, color: "var(--gray-mid)", marginBottom: 16, lineHeight: 1.5 }}>
            Adicione itens externos à área construída (Muros, Calçadas, Rampas, Automação). O sistema converterá esse valor em m² e somará ao CUB Base para elevar o Laudo de Avaliação.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {itensComplementares.map((item: any, idx: number) => (
              <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ flex: 2, fontSize: 14 }}
                  placeholder="Ex: Muros (2,5m altura)" 
                  value={item.descricao}
                  onChange={(e) => {
                    const novos = [...itensComplementares];
                    novos[idx].descricao = e.target.value;
                    update("simulador.itensComplementaresSBPE", novos);
                  }}
                />
                <div style={{ flex: 1 }}>
                  <NumInput 
                    value={item.valor} 
                    prefix="R$" 
                    onChange={(v) => {
                      const novos = [...itensComplementares];
                      novos[idx].valor = v;
                      update("simulador.itensComplementaresSBPE", novos);
                    }}
                  />
                </div>
                <button 
                  onClick={() => {
                    const novos = itensComplementares.filter((_: any, i: number) => i !== idx);
                    update("simulador.itensComplementaresSBPE", novos);
                  }}
                  style={{ padding: 12, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none", borderRadius: 10, cursor: "pointer" }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16 }}>
            <button 
              onClick={() => {
                const novos = [...itensComplementares, { id: `item_${Date.now()}`, descricao: "", valor: 0 }];
                update("simulador.itensComplementaresSBPE", novos);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--terracota-glow)", color: "var(--terracota)", border: "1px solid var(--border-active)", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              <Plus size={14} /> Adicionar Item
            </button>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginRight: 8 }}>Total Complementar:</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "white" }}>
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalItensExtra)}
              </span>
            </div>
          </div>

          {/* Alerta de Obrigatoriedade na PCI */}
          {totalItensExtra > 0 && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)" }}>
              <AlertTriangle size={16} color="#fb923c" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 12, color: "#fed7aa", lineHeight: 1.5 }}>
                <strong>Atenção Obrigatória (NBR 12721):</strong> Os itens informados acima devem ser discriminados no campo <strong>"Outros / Obras e Serviços Complementares"</strong> na Planilha PCI da Caixa, com seus respectivos memoriais descritivos anexados.
              </p>
            </div>
          )}
        </div>

        {/* Diagnóstico */}
        {diagCUBSBPE ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Diagnóstico Automático SBPE
            </p>
            {diagCUBSBPE.map((d: any) => {
              const cor = d.funcionaSAC ? "#4ade80" : "#facc15";
              return (
                <div key={d.nome} style={{ padding: "16px 18px", borderRadius: 12, background: `${cor}0d`, border: `1px solid ${cor}28` }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: cor, marginBottom: 12 }}>
                    {d.funcionaSAC ? "✅" : "⚡"} {d.nome} — Laudo cobre 80% do contrato? {d.funcionaSAC ? "SIM" : "PARCIAL"}
                  </p>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 10, color: "var(--gray-dark)", marginBottom: 3 }}>CUB Base</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-mid)" }}>R$ {Math.round(emp.simulador.cubSBPE || 0).toLocaleString("pt-BR")}/m²</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: "var(--gray-dark)", marginBottom: 3 }}>Impacto Extra</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--terracota-light)" }}>+ R$ {Math.round(totalItensExtra / (emp.modelos.find((mx:any)=>mx.nome===d.nome)?.area || 1)).toLocaleString("pt-BR")}/m²</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: "var(--gray-dark)", marginBottom: 3 }}>CUB Efetivo Usado</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: "white" }}>R$ {Math.round(d.cubEquivalente).toLocaleString("pt-BR")}/m²</p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
                    {[
                      ["Laudo Alto Padrão", `R$ ${Math.round(d.laudo).toLocaleString("pt-BR")}`],
                      ["Max Fin (SAC 80%)", `R$ ${Math.round(d.maxFinSAC).toLocaleString("pt-BR")}`],
                      ["Entrada Min (SAC)", `R$ ${Math.round(d.entradaMinSAC).toLocaleString("pt-BR")}`]
                    ].map(([l, v]) => (
                      <div key={l}>
                        <p style={{ fontSize: 10, color: "var(--gray-dark)", marginBottom: 3 }}>{l}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-light)" }}>{v}</p>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    Lembre-se: Na Tabela Price o SBPE só libera 70% de financiamento (Máx R$ {Math.round(d.maxFinPRICE).toLocaleString("pt-BR")}).
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.2)", display: "flex", gap: 10 }}>
            <Info size={14} color="#60a5fa" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "var(--gray-mid)", lineHeight: 1.6 }}>
              Preencha o <strong style={{ color: "var(--gray-light)" }}>CUB Vigente (SBPE)</strong> para visualizar o limite de financiamento no alto padrão.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}