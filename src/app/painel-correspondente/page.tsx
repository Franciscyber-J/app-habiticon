"use client";

import { useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import Image from "next/image";
import {
  LogOut, Building2, Phone, Calendar, Search, Filter,
  ShieldCheck, CheckCircle2, Clock, AlertCircle, User as UserIcon, FolderOpen,
  Bed, Maximize
} from "lucide-react";
import { AnaliseModal } from "@/components/correspondente/AnaliseModal";
import { DocumentosConstrutorModal, SLOTS_FIXOS } from "@/components/admin/DocumentosConstrutorModal";

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
  nomeCorretor?: string;
  quartos?: number;
  area?: number;
  dossie?: any;
  documentosConstrutora?: any;
  simulacao?: {
    valorImovel: number;
    valorAvaliacao?: number;
    entrada: number;
    valorFinanciado: number;
    rendaFamiliar: number;
    subsidio: number;
  };
}

// ─────────────────────────────────────────────────────────
// HELPER — Conta arquivos não lidos
// ─────────────────────────────────────────────────────────

function contarNaoLidos(lead: LeadData): number {
  const d = lead.documentosConstrutora;
  if (!d) return 0;

  let total = 0;
  SLOTS_FIXOS.forEach(s => { if (d[s.id] && !d[s.id].lido) total++; });
  (d.pls    || []).forEach((p: any) => { if (!p.lido) total++; });
  (d.outros || []).forEach((o: any) => { if (!o.lido) total++; });
  return total;
}

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────

export default function PainelCorrespondente() {
  const [leadsParaAnalise, setLeadsParaAnalise] = useState<LeadData[]>([]);
  const [userName, setUserName] = useState("");
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  // Modais
  const [leadAnaliseId, setLeadAnaliseId]   = useState<string | null>(null);
  const leadAnaliseSelecionado = leadsParaAnalise.find(l => l.id === leadAnaliseId) || null;

  const [leadDocumentosId, setLeadDocumentosId] = useState<string | null>(null);
  const leadDocumentosSelecionado = leadsParaAnalise.find(l => l.id === leadDocumentosId) || null;

  // ── AUTENTICAÇÃO E BUSCA DE LEADS ──
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = "/login"; return; }

      setUserName(user.displayName || "Correspondente");

      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        if (role !== "correspondente" && role !== "admin") {
          window.location.href = "/login";
          return;
        }
      }

      const qLeads = query(collection(db, "leads"), where("status", "!=", "novo"));
      const unsubLeads = onSnapshot(qLeads, (snap) => {
        const leads = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as LeadData))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLeadsParaAnalise(leads);
      });

      return () => unsubLeads();
    });
    return () => unsubAuth();
  }, []);

  // ── FILTRAGEM ──
  const leadsFiltrados = useMemo(() => {
    return leadsParaAnalise.filter(lead => {
      const termo = termoBusca.toLowerCase();
      const bateTexto =
        (lead.nome              || "").toLowerCase().includes(termo) ||
        (lead.empreendimentoNome|| "").toLowerCase().includes(termo) ||
        (lead.nomeCorretor      || "").toLowerCase().includes(termo);
      
      let bateStatus = false;
      if (filtroStatus === "todos") {
        bateStatus = true;
      } else if (filtroStatus === "credito_aprovado") {
        bateStatus = lead.status === "qualificado" || lead.status === "credito_aprovado";
      } else if (filtroStatus === "credito_reprovado") {
        bateStatus = lead.status === "nao_qualificado" || lead.status === "credito_reprovado";
      } else {
        bateStatus = lead.status === filtroStatus;
      }

      return bateTexto && bateStatus;
    });
  }, [leadsParaAnalise, termoBusca, filtroStatus]);

  // Contadores
  const countAnalise   = leadsParaAnalise.filter(l => l.status === "em_atendimento" || l.status === "em_analise").length;
  const countPendencias = leadsParaAnalise.filter(l => l.status === "com_pendencia").length;
  const countAprovados  = leadsParaAnalise.filter(l => l.status === "qualificado" || l.status === "credito_aprovado").length;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>

      {/* HEADER */}
      <header style={{
        padding: "16px", background: "rgba(15,30,22,0.98)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/logo.png" alt="Habiticon" width={140} height={40} style={{ height: 32, width: "auto" }} priority />
          <span style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", padding: "4px 10px", background: "rgba(56,189,248,0.1)", borderRadius: 100, border: "1px solid rgba(56,189,248,0.2)" }} className="hidden sm:inline">
            MESA DE CRÉDITO
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <span style={{ fontSize: 13, color: "var(--gray-light)" }} className="hidden sm:inline">
            Olá, <strong>{userName}</strong>
          </span>
          <button onClick={() => auth.signOut()} className="btn-ghost" style={{ color: "#f87171" }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="container-app" style={{ padding: "30px 20px", maxWidth: 1000, margin: "0 auto" }}>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: "white", marginBottom: 24 }}>
          Auditoria e Análise de Crédito
        </h1>

        {/* ESTATÍSTICAS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 32 }}>
          <div style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 16, padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#38bdf8" }}>
              <Clock size={16} /> <span style={{ fontSize: 12, fontWeight: 700 }}>EM ANÁLISE</span>
            </div>
            <p style={{ fontSize: 32, fontWeight: 800, color: "#38bdf8", lineHeight: 1 }}>{countAnalise}</p>
          </div>
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#ef4444" }}>
              <AlertCircle size={16} /> <span style={{ fontSize: 12, fontWeight: 700 }}>PENDÊNCIAS</span>
            </div>
            <p style={{ fontSize: 32, fontWeight: 800, color: "#ef4444", lineHeight: 1 }}>{countPendencias}</p>
          </div>
          <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 16, padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#4ade80" }}>
              <CheckCircle2 size={16} /> <span style={{ fontSize: 12, fontWeight: 700 }}>APROVADOS</span>
            </div>
            <p style={{ fontSize: 32, fontWeight: 800, color: "#4ade80", lineHeight: 1 }}>{countAprovados}</p>
          </div>
        </div>

        {/* BARRA DE FILTROS */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", background: "var(--bg-card)", padding: "16px", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
          <div style={{ flex: "1 1 300px", position: "relative" }}>
            <Search size={18} color="var(--gray-mid)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Buscar cliente, corretor ou empreendimento..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: 10, border: "1px solid var(--border-active)", background: "rgba(0,0,0,0.3)", color: "white", fontSize: 14, outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-active)", borderRadius: 10, padding: "0 14px" }}>
            <Filter size={16} color="var(--gray-mid)" />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              style={{ background: "#1a2e23", border: "none", color: "white", fontSize: 14, outline: "none", cursor: "pointer", padding: "12px 0" }}
            >
              <option value="todos"          style={{ background: "#1a2e23" }}>Todos os Status</option>
              <option value="em_atendimento" style={{ background: "#1a2e23" }}>⏳ Em Análise Inicial</option>
              <option value="com_pendencia"  style={{ background: "#1a2e23" }}>⚠️ Com Pendência</option>
              <option value="credito_aprovado"  style={{ background: "#1a2e23" }}>✅ Crédito Aprovado</option>
              <option value="credito_reprovado" style={{ background: "#1a2e23" }}>❌ Crédito Reprovado</option>
            </select>
          </div>
        </div>

        {/* FILA DE LEADS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {leadsFiltrados.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
              <ShieldCheck size={32} color="var(--gray-dark)" style={{ margin: "0 auto 16px" }} />
              <p style={{ color: "var(--gray-mid)", fontWeight: 600 }}>Nenhum lead encontrado com estes filtros.</p>
            </div>
          ) : (
            leadsFiltrados.map((lead: LeadData) => {
              
              let statusColor = "#38bdf8";
              let statusBg    = "rgba(56,189,248,0.1)";
              let statusLabel = "Em Análise";
              
              if (lead.status === "com_pendencia")    { statusColor = "#ef4444"; statusBg = "rgba(239,68,68,0.1)";   statusLabel = "Com Pendência"; }
              if (lead.status === "qualificado" || lead.status === "credito_aprovado") { statusColor = "#4ade80"; statusBg = "rgba(74,222,128,0.1)";  statusLabel = "Aprovado";       }
              if (lead.status === "nao_qualificado" || lead.status === "credito_reprovado"){ statusColor = "#f87171"; statusBg = "rgba(239,68,68,0.1)"; statusLabel = "Reprovado";      }

              const temDossie     = !!lead.dossie;
              const naoLidos      = contarNaoLidos(lead);
              const estaAprovado  = lead.status === "qualificado" || lead.status === "credito_aprovado";

              return (
                <div
                  key={lead.id}
                  style={{
                    background: "var(--bg-card)", padding: "20px", borderRadius: 16,
                    border: `1px solid ${statusBg.replace("0.1", "0.3")}`,
                    display: "flex", flexWrap: "wrap", gap: 20,
                    justifyContent: "space-between", alignItems: "center"
                  }}
                >
                  {/* DADOS DO LEAD */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flex: "1 1 min-content", minWidth: 250 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 18,
                      background: statusBg, color: statusColor,
                      border: `1px solid ${statusBg.replace("0.1", "0.2")}`
                    }}>
                      {(lead.nome || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 800, color: "white", marginBottom: 6, fontSize: 16 }}>{lead.nome}</p>
                      <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--gray-mid)", flexWrap: "wrap" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--gray-light)" }}>
                          <Building2 size={12} /> {lead.empreendimentoNome}
                        </span>
                        
                        {/* ATUALIZADO: Mostra Quartos e Metragem se existir no lead */}
                        {(lead.quartos || lead.area) && (
                          <>
                            {lead.quartos && (
                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <Bed size={12} /> {lead.quartos} Quartos
                              </span>
                            )}
                            {lead.area && (
                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <Maximize size={12} /> {lead.area} m²
                              </span>
                            )}
                          </>
                        )}

                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Phone size={12} /> {lead.whatsapp}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={12} /> {new Date(lead.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "4px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 6, fontSize: 11, color: "var(--gray-mid)" }}>
                        <UserIcon size={12} color="#93c5fd" />
                        Corretor: <strong style={{ color: "var(--gray-light)" }}>{lead.nomeCorretor || "Não atribuído"}</strong>
                      </div>
                    </div>
                  </div>

                  {/* AÇÕES */}
                  <div className="w-full sm:w-auto" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>

                    {/* Badge de status */}
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 100, background: statusBg, color: statusColor, border: `1px solid ${statusColor}40` }}>
                      {statusLabel}
                    </span>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>

                      <button
                        onClick={() => setLeadAnaliseId(lead.id)}
                        disabled={!temDossie}
                        style={{
                          padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 800,
                          display: "flex", justifyContent: "center", gap: 8, alignItems: "center",
                          border: "none", cursor: temDossie ? "pointer" : "not-allowed",
                          background: temDossie ? "#38bdf8" : "rgba(255,255,255,0.05)",
                          color: temDossie ? "white" : "var(--gray-mid)",
                          boxShadow: temDossie ? "0 4px 14px rgba(56,189,248,0.3)" : "none"
                        }}
                      >
                        <ShieldCheck size={16} />
                        {temDossie ? "Analisar Dossiê" : "Aguardando Documentos"}
                      </button>

                      {estaAprovado && (
                        <button
                          onClick={() => setLeadDocumentosId(lead.id)}
                          style={{
                            padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 800,
                            display: "flex", justifyContent: "center", gap: 8, alignItems: "center",
                              cursor: "pointer", position: "relative",
                            background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)",
                            color: "#a78bfa"
                          } as any}
                        >
                          <FolderOpen size={16} />
                          Documentos

                          {naoLidos > 0 && (
                            <span style={{
                              position: "absolute", top: -6, right: -6,
                              background: "#ef4444", color: "white",
                              fontSize: 10, fontWeight: 800,
                              width: 18, height: 18, borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: "0 0 0 2px var(--bg-base)"
                            }}>
                              {naoLidos}
                            </span>
                          )}
                        </button>
                      )}

                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>

      <AnaliseModal
        isOpen={leadAnaliseId !== null}
        onClose={() => setLeadAnaliseId(null)}
        lead={leadAnaliseSelecionado}
      />

      <DocumentosConstrutorModal
        isOpen={leadDocumentosId !== null}
        onClose={() => setLeadDocumentosId(null)}
        lead={leadDocumentosSelecionado}
        isAdmin={false}
      />

    </div>
  );
}