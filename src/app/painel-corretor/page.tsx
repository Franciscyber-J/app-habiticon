"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import Image from "next/image";
import { Users, LogOut, MessageCircle, Building2, UserPlus, Flame, FolderOpen, AlertOctagon, RefreshCcw } from "lucide-react";
import { DossieModal } from "@/components/corretor/DossieModal";

// ─────────────────────────────────────────────────────────
// TIPAGENS
// ─────────────────────────────────────────────────────────

interface LeadData {
  id: string;
  nome: string;
  whatsapp: string;
  empreendimentoNome: string;
  empreendimentoId: string;
  modelo: string;
  timestamp: string;
  status: string;
  corretorId: string;
  dossie?: any;
  motivoReprovacao?: string; 
}

interface GrupoLeads {
  nome: string;
  leads: LeadData[];
}

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────

export default function PainelCorretor() {
  const [meusLeads, setMeusLeads] = useState<LeadData[]>([]);
  const [leadsRoleta, setLeadsRoleta] = useState<LeadData[]>([]);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<"meus" | "roleta">("meus");
  const [leadDossieId, setLeadDossieId] = useState<string | null>(null);

  const leadDossieSelecionado = meusLeads.find(l => l.id === leadDossieId) || null;

  // ── AUTENTICAÇÃO E VALIDAÇÃO DE ROLE ──
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role !== "corretor") {
          if (userData.role === "admin") window.location.href = "/admin";
          else if (userData.role === "correspondente") window.location.href = "/painel-correspondente";
          else window.location.href = "/login";
          return;
        }
        setUserName(userData.nome || user.displayName || "Corretor");
      } else {
        window.location.href = "/login";
        return;
      }

      setUserId(user.uid);

      const qMeus = query(collection(db, "leads"), where("corretorId", "==", user.uid));
      const unsubMeus = onSnapshot(qMeus, (snap) => {
        const meus = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as LeadData))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setMeusLeads(meus);
      });

      const qRoleta = query(collection(db, "leads"), where("corretorId", "==", ""));
      const unsubRoleta = onSnapshot(qRoleta, (snap) => {
        const roleta = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as LeadData))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLeadsRoleta(roleta);
      });

      return () => {
        unsubMeus();
        unsubRoleta();
      };
    });
    return () => unsubAuth();
  }, []);

  // ─────────────────────────────────────────────────────────
  // FUNÇÕES DE AÇÃO
  // ─────────────────────────────────────────────────────────

  const leadsAgrupados = meusLeads.reduce((acc, lead) => {
    const empId = lead.empreendimentoId || "sem-empreendimento";
    const empNome = lead.empreendimentoNome || "Outros Atendimentos";
    if (!acc[empId]) { acc[empId] = { nome: empNome, leads: [] }; }
    acc[empId].leads.push(lead);
    return acc;
  }, {} as Record<string, GrupoLeads>);

  const assumirLead = async (leadId: string) => {
    try {
      const userDoc = await getDoc(doc(db, "usuarios", userId));
      const nomeReal = userDoc.exists() ? userDoc.data().nome : userName;

      await updateDoc(doc(db, "leads", leadId), {
        corretorId: userId,
        nomeCorretor: nomeReal,
        status: "em_atendimento"
      });
    } catch (error) {
      console.error("Erro ao assumir lead:", error);
      alert("Erro de sincronização. Talvez outro corretor já tenha pescado esse lead!");
    }
  };

  // ─────────────────────────────────────────────────────────
  // RENDERIZAÇÃO
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>

      {/* HEADER */}
      <header style={{
        padding: "16px", background: "rgba(15,30,22,0.98)", borderBottom: "1px solid var(--border-subtle)",
        display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10
      }}>
        <Image src="/logo.png" alt="Habiticon" width={140} height={40} style={{ height: 32, width: "auto" }} priority />
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <span style={{ fontSize: 13, color: "var(--gray-light)" }} className="hidden sm:inline">
            Olá, <strong>{userName}</strong>
          </span>
          <button onClick={() => auth.signOut()} className="btn-ghost" style={{ color: "#f87171" }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="container-app" style={{ padding: "30px 20px", maxWidth: 800, margin: "0 auto" }}>

        <div style={{ marginBottom: 30 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "white", marginBottom: 20 }}>Área de Vendas</h1>

          {/* ABAS */}
          <div style={{ display: "flex", gap: 10, background: "rgba(0,0,0,0.3)", padding: 6, borderRadius: 14, border: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => setAbaAtiva("meus")}
              style={{
                flex: 1, padding: "12px", borderRadius: 10, border: "none",
                fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: abaAtiva === "meus" ? "var(--terracota)" : "transparent",
                color: abaAtiva === "meus" ? "white" : "var(--gray-mid)"
              }}
            >
              <Users size={18} />
              Meus Atendimentos
              <span style={{ background: abaAtiva === "meus" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 100, fontSize: 11 }}>
                {meusLeads.length}
              </span>
            </button>
            <button
              onClick={() => setAbaAtiva("roleta")}
              style={{
                flex: 1, padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: abaAtiva === "roleta" ? "rgba(239,68,68,0.15)" : "transparent",
                color: abaAtiva === "roleta" ? "#ef4444" : "var(--gray-mid)",
                border: abaAtiva === "roleta" ? "1px solid rgba(239,68,68,0.3)" : "1px solid transparent"
              }}
            >
              <Flame size={18} color={abaAtiva === "roleta" ? "#ef4444" : "var(--gray-mid)"} />
              Leads Livres
              {leadsRoleta.length > 0 && (
                <span style={{ background: "#ef4444", color: "white", padding: "2px 8px", borderRadius: 100, fontSize: 11, animation: "pulse 2s infinite" }}>
                  {leadsRoleta.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* =========================================================
            ABA 1: MEUS ATENDIMENTOS
            ========================================================= */}
        {abaAtiva === "meus" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {Object.keys(leadsAgrupados).length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Users size={24} color="var(--gray-dark)" />
                </div>
                <p style={{ color: "var(--gray-mid)", fontWeight: 600 }}>Você ainda não possui leads.</p>
                <p style={{ color: "var(--gray-dark)", fontSize: 13, marginTop: 8 }}>Vá para a aba "Leads Livres" ou peça para o cliente gerar a proposta com o seu nome.</p>
              </div>
            ) : (
              Object.values(leadsAgrupados).map((grupo: GrupoLeads, index) => (
                <div key={index}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <Building2 size={16} color="var(--terracota)" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-light)" }}>{grupo.nome}</h3>
                    <span style={{ fontSize: 12, color: "var(--gray-dark)" }}>({grupo.leads.length})</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {grupo.leads.map((lead: LeadData) => {
                      // Verifica se foi reprovado usando os status antigos e novos
                      const isReprovado = lead.status === "nao_qualificado" || lead.status === "credito_reprovado";

                      return (
                        <div key={lead.id} style={{
                          background: "var(--bg-card)", padding: "16px 20px", borderRadius: 14, 
                          border: isReprovado ? "1px solid rgba(239,68,68,0.4)" : "1px solid var(--border-subtle)",
                          display: "flex", flexDirection: "column", gap: 16
                        }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "1 1 min-content", minWidth: 200 }}>
                              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--terracota-glow)", color: "var(--terracota)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                                {(lead.nome || "?")[0].toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontWeight: 700, color: "white", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 15 }}>{lead.nome}</p>
                                <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--gray-mid)", flexWrap: "wrap" }}>
                                  <span style={{ whiteSpace: "nowrap" }}>{lead.modelo}</span>
                                  <span className="hidden sm:inline">•</span>
                                  <span style={{ whiteSpace: "nowrap" }}>{lead.timestamp ? new Date(lead.timestamp).toLocaleDateString("pt-BR") : "Data desconhecida"}</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, width: "auto" }} className="w-full sm:w-auto justify-between sm:justify-end">
                              <span style={{
                                fontSize: 12, padding: "6px 10px", borderRadius: 8, fontWeight: 700, textTransform: "capitalize",
                                background: lead.status === "com_pendencia" || isReprovado ? "rgba(239,68,68,0.15)" : lead.status === "qualificado" || lead.status === "credito_aprovado" ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.05)",
                                border: `1px solid ${lead.status === "com_pendencia" || isReprovado ? "rgba(239,68,68,0.5)" : lead.status === "qualificado" || lead.status === "credito_aprovado" ? "rgba(74,222,128,0.4)" : "var(--border-subtle)"}`,
                                color: lead.status === "com_pendencia" || isReprovado ? "#f87171" : lead.status === "qualificado" || lead.status === "credito_aprovado" ? "#4ade80" : "var(--gray-light)",
                              }}>
                                {lead.status ? lead.status.replace(/_/g, " ") : "Novo"}
                              </span>
                              <button
                                onClick={() => setLeadDossieId(lead.id)}
                                style={{
                                  padding: "8px 14px", background: "rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 13, fontWeight: 700,
                                  display: "flex", gap: 6, border: "none", color: "white", cursor: "pointer", transition: "0.2s"
                                }}
                              >
                                <FolderOpen size={15} /> Dossiê
                              </button>

                              <a
                                href={`https://wa.me/55${(lead.whatsapp || "").replace(/\D/g, "")}`}
                                target="_blank" rel="noopener noreferrer" className="btn-primary"
                                style={{ padding: "8px 16px", background: "#16a34a", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "flex", gap: 6, textDecoration: "none", color: "white" }}
                              >
                                <MessageCircle size={15} /> Chamar
                              </a>
                            </div>
                          </div>

                          {/* INSTRUÇÃO ESTRATÉGICA PARA O CORRETOR CASO REPROVE */}
                          {isReprovado && lead.motivoReprovacao && (
                            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px dashed rgba(239,68,68,0.3)", borderRadius: 10, padding: "16px", display: "flex", flexDirection: "column", gap: 12, marginTop: "4px" }}>
                              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                <AlertOctagon size={18} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
                                <div>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 4 }}>Motivo da Reprovação de Crédito:</p>
                                  <p style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.5 }}>{lead.motivoReprovacao}</p>
                                </div>
                              </div>
                              
                              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: 8 }}>
                                <RefreshCcw size={16} color="var(--gray-light)" style={{ flexShrink: 0, marginTop: 2 }} />
                                <p style={{ fontSize: 12, color: "var(--gray-mid)", lineHeight: 1.5 }}>
                                  <strong style={{ color: "var(--gray-light)" }}>Deseja reverter esta decisão?</strong>{" "}
                                  Se o cliente conseguiu solucionar a pendência ou apresentar novas garantias, anexe os documentos no <strong>Dossiê</strong>. O correspondente poderá reabrir o processo para uma nova análise.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </div>
              ))
            )}
          </div>
        )}

        {/* =========================================================
            ABA 2: ROLETA DE LEADS LIVRES
            ========================================================= */}
        {abaAtiva === "roleta" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {leadsRoleta.length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Flame size={24} color="var(--gray-dark)" />
                </div>
                <p style={{ color: "var(--gray-mid)", fontWeight: 600 }}>A piscina de leads está vazia.</p>
                <p style={{ color: "var(--gray-dark)", fontSize: 13, marginTop: 8 }}>Novos leads do tráfego pago aparecerão aqui em tempo real.</p>
              </div>
            ) : (
              leadsRoleta.map((lead: LeadData) => (
                <div key={lead.id} style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.05) 0%, var(--bg-card) 100%)", padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(239,68,68,0.2)", display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "center", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#ef4444" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "1 1 min-content", minWidth: 200, paddingLeft: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(239,68,68,0.15)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, border: "1px solid rgba(239,68,68,0.3)", flexShrink: 0 }}>
                      {(lead.nome || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 800, color: "white", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 15 }}>{lead.nome}</p>
                      <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--gray-mid)", flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ color: "var(--gray-light)", whiteSpace: "nowrap" }}>{lead.empreendimentoNome}</span>
                        <span className="hidden sm:inline">•</span>
                        <span style={{ whiteSpace: "nowrap" }}>{lead.timestamp ? new Date(lead.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => assumirLead(lead.id)}
                    className="w-full sm:w-auto"
                    style={{ padding: "10px 20px", background: "#ef4444", borderRadius: 10, fontSize: 14, fontWeight: 800, color: "white", display: "flex", justifyContent: "center", gap: 8, alignItems: "center", border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(239,68,68,0.3)", transition: "all 0.2s" }}
                  >
                    <UserPlus size={18} /> Assumir Atendimento
                  </button>
                </div>
              ))
            )}
          </div>
        )}

      </main>

      {/* DOSSIÊ FLUTUANTE */}
      <DossieModal
        isOpen={leadDossieId !== null}
        onClose={() => setLeadDossieId(null)}
        lead={leadDossieSelecionado}
        isAdmin={false}
      />

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}} />
    </div>
  );
}