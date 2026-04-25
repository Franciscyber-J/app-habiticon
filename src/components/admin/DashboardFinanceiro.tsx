"use client";

import React, { useMemo } from "react";
import { 
  DollarSign, TrendingUp, TrendingDown, Activity, 
  Banknote, Building2, CheckCircle2, AlertCircle
} from "lucide-react";

// Interfaces para tipagem
interface Lead {
  id: string;
  empreendimentoId: string;
  empreendimentoNome?: string;
  nome: string;
  timestamp: string;
  valorImovel?: number;
  loteReserva?: { valorVenda: number; numero?: string; [key: string]: any };
  status?: string;
}

interface Empreendimento {
  slug: string;
  nome: string;
}

interface DashboardFinanceiroProps {
  leads: Lead[];
  empreendimentos: Empreendimento[];
}

const formatBRL = (val: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
};

export function DashboardFinanceiro({ leads, empreendimentos }: DashboardFinanceiroProps) {
  
  // Função auxiliar para pegar o valor real da negociação (prioridade: Venda Reservada -> Imovel Simulado -> Zero)
  const getValorLead = (l: Lead) => l.loteReserva?.valorVenda || l.valorImovel || 0;

  // Cálculos Inteligentes
  const leadsAprovados = useMemo(() => leads.filter(l => l.status === "qualificado" || l.status === "credito_aprovado"), [leads]);
  const leadsEmAnalise = useMemo(() => leads.filter(l => l.status === "em_atendimento" || l.status === "com_pendencia" || !l.status || l.status === "novo"), [leads]);
  const leadsPerdidos = useMemo(() => leads.filter(l => l.status === "nao_qualificado" || l.status === "credito_reprovado" || l.status === "desqualificado"), [leads]);

  const vgvTotal = useMemo(() => leadsAprovados.reduce((acc, l) => acc + getValorLead(l), 0), [leadsAprovados]);
  const vgvEmAnalise = useMemo(() => leadsEmAnalise.reduce((acc, l) => acc + getValorLead(l), 0), [leadsEmAnalise]);
  const vgvPerdido = useMemo(() => leadsPerdidos.reduce((acc, l) => acc + getValorLead(l), 0), [leadsPerdidos]);
  const ticketMedio = useMemo(() => leadsAprovados.length > 0 ? vgvTotal / leadsAprovados.length : 0, [leadsAprovados, vgvTotal]);

  const rankingEmpreendimentos = useMemo(() => {
    return empreendimentos.map(emp => {
      const leadsDeste = leadsAprovados.filter(l => l.empreendimentoId === emp.slug);
      const vgv = leadsDeste.reduce((acc, l) => acc + getValorLead(l), 0);
      return { nome: emp.nome, vgv, qtd: leadsDeste.length };
    }).sort((a, b) => b.vgv - a.vgv);
  }, [empreendimentos, leadsAprovados]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--terracota-glow)", border: "1px solid var(--border-active)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Banknote size={20} color="var(--terracota)" /> 
          </div>
          Dashboard Financeiro
        </h2>
        <p style={{ fontSize: 13, color: "var(--gray-mid)", marginTop: 6, marginLeft: 50 }}>Visão global de faturamento baseada nos leads capturados, simulações e crédito aprovado.</p>
      </div>

      {/* CARDS DE INDICADORES MACRO (KPIs) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        
        {/* VGV Aprovado */}
        <div style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 18, padding: "24px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, opacity: 0.1 }}>
            <DollarSign size={100} color="#4ade80" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, position: "relative", zIndex: 2 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(74,222,128,0.2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(74,222,128,0.3)" }}>
              <CheckCircle2 size={16} color="#4ade80" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#86efac", textTransform: "uppercase", letterSpacing: "0.05em" }}>VGV Aprovado / Vendido</span>
          </div>
          <div style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, color: "#4ade80", position: "relative", zIndex: 2 }}>{formatBRL(vgvTotal)}</div>
          <p style={{ fontSize: 12, color: "var(--gray-mid)", marginTop: 8, position: "relative", zIndex: 2 }}>
            De <strong style={{ color: "white" }}>{leadsAprovados.length}</strong> vendas garantidas.
          </p>
        </div>

        {/* Dinheiro em Análise */}
        <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 18, padding: "24px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, opacity: 0.1 }}>
            <Activity size={100} color="#fbbf24" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, position: "relative", zIndex: 2 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(251,191,36,0.2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(251,191,36,0.3)" }}>
              <Activity size={16} color="#fbbf24" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#fcd34d", textTransform: "uppercase", letterSpacing: "0.05em" }}>Dinheiro em Fluxo / Análise</span>
          </div>
          <div style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, color: "#fbbf24", position: "relative", zIndex: 2 }}>{formatBRL(vgvEmAnalise)}</div>
          <p style={{ fontSize: 12, color: "var(--gray-mid)", marginTop: 8, position: "relative", zIndex: 2 }}>
            Potencial de <strong style={{ color: "white" }}>{leadsEmAnalise.length}</strong> clientes ativos.
          </p>
        </div>

        {/* Ticket Médio */}
        <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 18, padding: "24px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, opacity: 0.1 }}>
            <TrendingUp size={100} color="#60a5fa" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, position: "relative", zIndex: 2 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(59,130,246,0.3)" }}>
              <TrendingUp size={16} color="#60a5fa" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ticket Médio de Venda</span>
          </div>
          <div style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, color: "#60a5fa", position: "relative", zIndex: 2 }}>{formatBRL(ticketMedio)}</div>
          <p style={{ fontSize: 12, color: "var(--gray-mid)", marginTop: 8, position: "relative", zIndex: 2 }}>
            Faturamento médio por casa vendida.
          </p>
        </div>

        {/* Valor Perdido */}
        <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 18, padding: "24px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, opacity: 0.1 }}>
            <TrendingDown size={100} color="#ef4444" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, position: "relative", zIndex: 2 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(239,68,68,0.3)" }}>
              <TrendingDown size={16} color="#ef4444" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#fca5a5", textTransform: "uppercase", letterSpacing: "0.05em" }}>VGV Perdido</span>
          </div>
          <div style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, color: "#ef4444", position: "relative", zIndex: 2 }}>{formatBRL(vgvPerdido)}</div>
          <p style={{ fontSize: 12, color: "var(--gray-mid)", marginTop: 8, position: "relative", zIndex: 2 }}>
            De <strong style={{ color: "white" }}>{leadsPerdidos.length}</strong> clientes reprovados.
          </p>
        </div>
      </div>

      {/* RANKING E ÚLTIMAS VENDAS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 20 }}>
        
        {/* VGV Por Empreendimento */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 20, padding: "28px", boxShadow: "var(--shadow-card)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "white", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
            <Building2 size={18} color="var(--terracota)" /> VGV Aprovado por Empreendimento
          </h3>
          
          {rankingEmpreendimentos.some(e => e.vgv > 0) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {rankingEmpreendimentos.map((emp, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: i === 0 ? 800 : 600, color: i === 0 ? "var(--terracota-light)" : "var(--gray-light)" }}>
                      {i + 1}º — {emp.nome}
                    </span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "white", display: "block" }}>{formatBRL(emp.vgv)}</span>
                      <span style={{ fontSize: 11, color: "var(--gray-dark)" }}>{emp.qtd} venda{emp.qtd !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "rgba(0,0,0,0.3)", borderRadius: 6, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                    <div style={{ 
                      width: `${rankingEmpreendimentos[0].vgv > 0 ? (emp.vgv / rankingEmpreendimentos[0].vgv) * 100 : 0}%`, 
                      height: "100%", 
                      background: i === 0 ? "var(--terracota)" : "var(--gray-dark)", 
                      borderRadius: 6 
                    }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div style={{ padding: "40px 20px", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 12, border: "1px dashed var(--border-subtle)" }}>
               <AlertCircle size={24} color="var(--gray-dark)" style={{ margin: "0 auto 12px" }} />
               <p style={{ color: "var(--gray-mid)", fontSize: 13 }}>Nenhuma venda aprovada contabilizada ainda.</p>
             </div>
          )}
        </div>

        {/* Últimas Vendas Aprovadas */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 20, padding: "28px", boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
             <h3 style={{ fontSize: 16, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
               <CheckCircle2 size={18} color="#4ade80" /> Últimas Vendas Aprovadas
             </h3>
             <span style={{ fontSize: 11, padding: "4px 10px", background: "rgba(74,222,128,0.1)", color: "#4ade80", borderRadius: 8, fontWeight: 700 }}>
               Sucesso
             </span>
          </div>

          {leadsAprovados.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {leadsAprovados.slice(0, 5).map((lead, i) => {
                const emp = empreendimentos.find(e => e.slug === lead.empreendimentoId);
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "rgba(0,0,0,0.15)", borderRadius: 12, border: "1px solid var(--border-subtle)", transition: "all 0.2s" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>{lead.nome}</p>
                      <p style={{ fontSize: 11, color: "var(--gray-mid)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Building2 size={10} /> {emp?.nome || "Empreendimento removido"}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: "#4ade80" }}>{formatBRL(getValorLead(lead))}</p>
                      <p style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 2 }}>{new Date(lead.timestamp).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", background: "rgba(0,0,0,0.2)", borderRadius: 12, border: "1px dashed var(--border-subtle)" }}>
              <p style={{ color: "var(--gray-mid)", fontSize: 13 }}>Aguardando a primeira aprovação de crédito de clientes.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}