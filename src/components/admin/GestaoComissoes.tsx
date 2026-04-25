"use client";

import { useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wallet, CheckCircle2, Clock, Copy, 
  ExternalLink, User, Building2, Landmark,
  ChevronDown, ChevronUp
} from "lucide-react";

interface GestaoComissoesProps {
  leads: any[];
  empreendimentos: any[];
  corretores: any[];
}

export function GestaoComissoes({ leads, empreendimentos, corretores }: GestaoComissoesProps) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const handleCopiarPIX = (pix: string, id: string) => {
    navigator.clipboard.writeText(pix);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  };

  // 1. FILTRAR APENAS VENDAS QUE GERAM COMISSÃO
  // Omitimos as "Vendas Diretas" (corretorId === "interno") da folha de pagamento
  const vendasComissionaveis = useMemo(() => {
    return leads.filter(l => 
      (l.status === "qualificado" || l.status === "credito_aprovado") && 
      l.corretorId && 
      l.corretorId !== "interno" // <--- TRAVA DE SEGURANÇA: Venda House não gera comissão
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [leads]);

  // 2. FUNÇÃO PARA DAR BAIXA NO PAGAMENTO
  const marcarComoPago = async (leadId: string, parcelaId: string) => {
    if (!confirm("Confirmar que realizou o pagamento desta parcela?")) return;
    
    try {
      const leadRef = doc(db, "leads", leadId);
      await updateDoc(leadRef, {
        [`pagamentosRealizados.${parcelaId}`]: {
          data: new Date().toISOString(),
          pago: true
        }
      });
      alert("Pagamento registrado com sucesso!");
    } catch (error) {
      console.error("Erro ao pagar:", error);
      alert("Erro ao salvar pagamento.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      <div style={{ background: "rgba(175,111,83,0.08)", padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(175,111,83,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
        <Landmark size={18} color="var(--terracota)" />
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Folha de Pagamento de Comissões</p>
          <p style={{ fontSize: 12, color: "var(--gray-mid)" }}>Cálculos automáticos baseados no valor do contrato e regras de cada empreendimento.</p>
        </div>
      </div>

      {vendasComissionaveis.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
          <Clock size={40} color="var(--gray-dark)" style={{ marginBottom: 16 }} />
          <p style={{ color: "var(--gray-mid)" }}>Nenhuma venda qualificada de corretores aguardando comissão.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {vendasComissionaveis.map((lead) => {
            const emp = empreendimentos.find(e => e.slug === lead.empreendimentoId);
            const corretor = corretores.find(c => c.id === lead.corretorId);
            const valorVenda = lead.loteReserva?.valorVenda || 0;
            
            const regrasCorretor = emp?.comissoes?.corretor?.parcelas || [];

            return (
              <div key={lead.id} style={{ background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                
                <div 
                  onClick={() => setExpandido(expandido === lead.id ? null : lead.id)}
                  style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--terracota-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--terracota)" }}>
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: "white" }}>{lead.nome}</h4>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 12, color: "var(--gray-mid)", display: "flex", alignItems: "center", gap: 4 }}>
                          <Building2 size={12} /> {emp?.nome || "Empreendimento"}
                        </span>
                        <span style={{ color: "var(--gray-dark)" }}>•</span>
                        <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 700 }}>
                          R$ {valorVenda.toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>
                  {expandido === lead.id ? <ChevronUp size={20} color="var(--gray-dark)" /> : <ChevronDown size={20} color="var(--gray-dark)" />}
                </div>

                <AnimatePresence>
                  {expandido === lead.id && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} style={{ overflow: "hidden" }}>
                      <div style={{ padding: "20px", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 24 }}>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <p style={{ fontSize: 11, fontWeight: 800, color: "var(--terracota-light)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                              <User size={14} /> Corretor: {corretor?.nome || "Não encontrado"}
                            </p>
                            {corretor?.dadosBancarios?.chavePix && (
                              <button 
                                onClick={() => handleCopiarPIX(corretor.dadosBancarios.chavePix, lead.id + "pix")}
                                style={{ padding: "6px 12px", borderRadius: 8, background: copiado === lead.id + "pix" ? "#16a34a" : "rgba(255,255,255,0.05)", border: "none", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                              >
                                {copiado === lead.id + "pix" ? "Copiado!" : <>Copiar PIX <Copy size={12} /></>}
                              </button>
                            )}
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                            {regrasCorretor.map((p: any) => {
                              const valorParcela = (valorVenda * p.percentual) / 100;
                              const jaPago = lead.pagamentosRealizados?.[p.id]?.pago;
                              return (
                                <div key={p.id} style={{ padding: 14, borderRadius: 12, background: jaPago ? "rgba(74,222,128,0.05)" : "rgba(0,0,0,0.2)", border: jaPago ? "1px solid rgba(74,222,128,0.2)" : "1px solid var(--border-subtle)" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                    <span style={{ fontSize: 10, color: "var(--gray-mid)", fontWeight: 700 }}>{p.percentual}% Parcela</span>
                                    {jaPago && <span style={{ fontSize: 9, background: "#16a34a", color: "white", padding: "2px 6px", borderRadius: 4, fontWeight: 800 }}>PAGO</span>}
                                  </div>
                                  <p style={{ fontSize: 16, fontWeight: 800, color: jaPago ? "#4ade80" : "white" }}>R$ {valorParcela.toLocaleString("pt-BR")}</p>
                                  <p style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 6, lineHeight: 1.4 }}>{p.gatilho}</p>
                                  {!jaPago && (
                                    <button onClick={() => marcarComoPago(lead.id, p.id)} style={{ width: "100%", marginTop: 12, padding: "8px", borderRadius: 8, background: "var(--terracota)", color: "white", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                      Dar Baixa
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}