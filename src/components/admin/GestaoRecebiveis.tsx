"use client";

import { useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Landmark, ChevronDown, ChevronUp, User, 
  CalendarDays, Plus, Building2, ArrowRightLeft, ShieldAlert,
  Car
} from "lucide-react";

interface GestaoRecebiveisProps {
  leads: any[];
  empreendimentos: any[];
}

const formatBRL = (val: number) => 
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

export function GestaoRecebiveis({ leads, empreendimentos }: GestaoRecebiveisProps) {
  const [expandido, setExpandido] = useState<string | null>(null);

  const clientesAtivos = useMemo(() => {
    return leads.filter(l => l.status === "qualificado" || l.status === "credito_aprovado")
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [leads]);

  // Função ATUALIZADA para aceitar Descrição (Permutas, Sinal, etc)
  const adicionarParcelaEntrada = async (leadId: string, atual: any[]) => {
    const descricao = prompt("O que é este recebimento?\nEx: Sinal em PIX, Mensal, Carro Ônix placa XYZ, Lote Permuta...", "Parcela");
    if (!descricao) return;

    const valorStr = prompt(`Qual o valor de avaliação de "${descricao}"? (R$)`);
    if (!valorStr) return;
    
    const valor = parseFloat(valorStr.replace(/\./g, "").replace(",", "."));
    if (isNaN(valor) || valor <= 0) return alert("Valor inválido.");

    const data = prompt("Data de Entrada/Vencimento (DD/MM/AAAA):");
    if (!data) return;

    const isPermuta = descricao.toLowerCase().includes("carro") || descricao.toLowerCase().includes("moto") || descricao.toLowerCase().includes("veículo") || descricao.toLowerCase().includes("lote") || descricao.toLowerCase().includes("permuta");

    const novaParcela = {
      id: `ent_${Date.now()}`,
      descricao,
      valor,
      vencimento: data,
      pago: isPermuta ? true : false, // Se for permuta de bem, geralmente o bem já foi entregue
      tipo: isPermuta ? "permuta" : "parcela"
    };

    try {
      await updateDoc(doc(db, "leads", leadId), {
        "financeiro.entrada": [...atual, novaParcela]
      });
    } catch (e) {
      alert("Erro ao adicionar parcela.");
    }
  };

  const adicionarMedicaoPls = async (leadId: string, atual: any[]) => {
    const valorStr = prompt("Valor esperado da Medição (R$):");
    if (!valorStr) return;
    
    const valor = parseFloat(valorStr.replace(/\./g, "").replace(",", "."));
    if (isNaN(valor) || valor <= 0) return alert("Valor inválido.");

    const previsao = prompt("Previsão de Pagamento (Mês/Ano):");
    if (!previsao) return;

    const novaMedicao = {
      id: `pls_${Date.now()}`,
      valor,
      previsao,
      pago: false
    };

    try {
      await updateDoc(doc(db, "leads", leadId), {
        "financeiro.pls": [...atual, novaMedicao]
      });
    } catch (e) {
      alert("Erro ao adicionar medição.");
    }
  };

  const darBaixa = async (leadId: string, fieldPath: string, arrayAtual: any[], itemId: string) => {
    if (!confirm("Confirmar recebimento deste valor na conta?")) return;
    
    const arrayAtualizado = arrayAtual.map(item => 
      item.id === itemId ? { ...item, pago: true, dataPagamento: new Date().toISOString() } : item
    );

    try {
      await updateDoc(doc(db, "leads", leadId), {
        [fieldPath]: arrayAtualizado
      });
    } catch (e) {
      alert("Erro ao dar baixa.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      <div style={{ background: "rgba(56,189,248,0.08)", padding: "20px", borderRadius: 16, border: "1px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Landmark size={24} color="#38bdf8" />
        </div>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "white", marginBottom: 4 }}>Gestão de Recebíveis & Contratos</h3>
          <p style={{ fontSize: 13, color: "var(--gray-mid)", lineHeight: 1.5 }}>
            Controle o fluxo de caixa individual. Registe o <strong>Sinal</strong>, os parcelamentos e as <strong>Permutas (veículos/lotes)</strong> do lado do cliente, e as <strong>Medições PLS</strong> do lado da Caixa.
          </p>
        </div>
      </div>

      {clientesAtivos.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
          <p style={{ color: "var(--gray-mid)" }}>Nenhum contrato aprovado para gerenciar recebíveis.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {clientesAtivos.map((cliente) => {
            const emp = empreendimentos.find(e => e.slug === cliente.empreendimentoId);
            const fin = cliente.financeiro || { entrada: [], pls: [] };
            const valorContrato = cliente.loteReserva?.valorVenda || cliente.valorImovel || 0;

            // Totais
            const totalClientePago = fin.entrada.filter((e:any) => e.pago).reduce((acc:number, e:any) => acc + e.valor, 0);
            const totalClientePendente = fin.entrada.filter((e:any) => !e.pago).reduce((acc:number, e:any) => acc + e.valor, 0);

            return (
              <div key={cliente.id} style={{ background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                
                <div 
                  onClick={() => setExpandido(expandido === cliente.id ? null : cliente.id)}
                  style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-light)", fontWeight: 800 }}>
                      {(cliente.nome || "?")[0]}
                    </div>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 800, color: "white" }}>{cliente.nome}</h4>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 12, color: "var(--gray-mid)", display: "flex", alignItems: "center", gap: 4 }}>
                          <Building2 size={12} /> {emp?.nome || "Empreendimento"}
                        </span>
                        <span style={{ color: "var(--gray-dark)" }}>•</span>
                        <span style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700 }}>
                          Contrato: {formatBRL(valorContrato)}
                        </span>
                        {cliente.loteReserva?.numero && (
                          <>
                            <span style={{ color: "var(--gray-dark)" }}>•</span>
                            <span style={{ fontSize: 11, background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: 4, color: "var(--gray-light)" }}>
                              Lote {cliente.loteReserva.numero}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandido === cliente.id ? <ChevronUp size={20} color="var(--gray-dark)" /> : <ChevronDown size={20} color="var(--gray-dark)" />}
                </div>

                <AnimatePresence>
                  {expandido === cliente.id && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} style={{ overflow: "hidden" }}>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 1, background: "var(--border-subtle)", borderTop: "1px solid var(--border-subtle)" }}>
                        
                        {/* COLUNA ESQUERDA: ENTRADA / PERMUTA */}
                        <div style={{ background: "var(--bg-card)", padding: 24 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                            <h5 style={{ fontSize: 14, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
                              <User size={16} color="#fb923c" /> Pagamentos do Cliente
                            </h5>
                            <button 
                              onClick={() => adicionarParcelaEntrada(cliente.id, fin.entrada)}
                              style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(251,146,60,0.1)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.2)", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <Plus size={12} /> Lançar Pagamento
                            </button>
                          </div>

                          <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", gap: 8, marginBottom: 16 }}>
                            <ShieldAlert size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
                            <p style={{ fontSize: 11, color: "var(--gray-light)", lineHeight: 1.5 }}>
                              <strong style={{ color: "#f87171" }}>Atenção Contratual:</strong> Em caso de distrato, R$ 5.000,00 pagos no Ato ficam retidos para cobrir serviços iniciais. Atrasos nas parcelas sofrem multa de 10% + Juros de 2% a.m. + INCC.
                            </p>
                          </div>

                          {/* Sumário do Cliente */}
                          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                            <div style={{ flex: 1, padding: "8px 12px", background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8 }}>
                              <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase" }}>Já Entrou</p>
                              <p style={{ fontSize: 14, fontWeight: 800, color: "#4ade80" }}>{formatBRL(totalClientePago)}</p>
                            </div>
                            <div style={{ flex: 1, padding: "8px 12px", background: "rgba(251,146,60,0.05)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 8 }}>
                              <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase" }}>Pendente</p>
                              <p style={{ fontSize: 14, fontWeight: 800, color: "#fb923c" }}>{formatBRL(totalClientePendente)}</p>
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {fin.entrada.length === 0 ? (
                              <p style={{ fontSize: 12, color: "var(--gray-dark)", textAlign: "center", padding: "20px 0" }}>Nenhum valor ou permuta registrado.</p>
                            ) : (
                              fin.entrada.map((p: any) => (
                                <div key={p.id} style={{ padding: "12px 16px", borderRadius: 10, border: p.pago ? "1px solid rgba(74,222,128,0.2)" : "1px solid var(--border-subtle)", background: p.pago ? "rgba(74,222,128,0.05)" : "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <div>
                                    <p style={{ fontSize: 14, fontWeight: 800, color: p.pago ? "#4ade80" : "white", display: "flex", alignItems: "center", gap: 6 }}>
                                      {formatBRL(p.valor)}
                                      {p.tipo === "permuta" && <Car size={14} color="var(--gray-mid)" />}
                                    </p>
                                    <p style={{ fontSize: 12, color: "var(--gray-light)", marginTop: 4, fontWeight: 600 }}>{p.descricao}</p>
                                    <p style={{ fontSize: 11, color: "var(--gray-mid)", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                                      <CalendarDays size={11} /> {p.tipo === "permuta" ? "Avaliado em:" : "Venc:"} {p.vencimento}
                                    </p>
                                  </div>
                                  <div>
                                    {p.pago ? (
                                      <span style={{ fontSize: 10, fontWeight: 800, color: "#4ade80", background: "rgba(74,222,128,0.15)", padding: "4px 8px", borderRadius: 6 }}>PAGO / ENTREGUE</span>
                                    ) : (
                                      <button 
                                        onClick={() => darBaixa(cliente.id, "financeiro.entrada", fin.entrada, p.id)}
                                        style={{ padding: "6px 12px", background: "var(--terracota)", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                      >
                                        Dar Baixa
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* COLUNA DIREITA: REPASSES DA CAIXA */}
                        <div style={{ background: "var(--bg-card)", padding: 24 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                            <h5 style={{ fontSize: 14, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
                              <Building2 size={16} color="#38bdf8" /> Repasses da Caixa (PLS)
                            </h5>
                            <button 
                              onClick={() => adicionarMedicaoPls(cliente.id, fin.pls)}
                              style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <Plus size={12} /> Prever Medição
                            </button>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {fin.pls.length === 0 ? (
                              <p style={{ fontSize: 12, color: "var(--gray-dark)", textAlign: "center", padding: "20px 0" }}>Nenhuma medição prevista.</p>
                            ) : (
                              fin.pls.map((m: any) => (
                                <div key={m.id} style={{ padding: "12px 16px", borderRadius: 10, border: m.pago ? "1px solid rgba(74,222,128,0.2)" : "1px solid var(--border-subtle)", background: m.pago ? "rgba(74,222,128,0.05)" : "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <div>
                                    <p style={{ fontSize: 14, fontWeight: 800, color: m.pago ? "#4ade80" : "white" }}>{formatBRL(m.valor)}</p>
                                    <p style={{ fontSize: 11, color: "var(--gray-mid)", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                                      <ArrowRightLeft size={11} /> Previsão: {m.previsao}
                                    </p>
                                  </div>
                                  <div>
                                    {m.pago ? (
                                      <span style={{ fontSize: 10, fontWeight: 800, color: "#4ade80", background: "rgba(74,222,128,0.15)", padding: "4px 8px", borderRadius: 6 }}>CREDITADO</span>
                                    ) : (
                                      <button 
                                        onClick={() => darBaixa(cliente.id, "financeiro.pls", fin.pls, m.id)}
                                        style={{ padding: "6px 12px", background: "transparent", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.4)", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                      >
                                        Anotar Depósito
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
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