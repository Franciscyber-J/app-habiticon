"use client";

import { useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs } from "firebase/firestore";
import Image from "next/image";
import {
  LogOut, Building2, Phone, Calendar, Search, Filter,
  ShieldCheck, CheckCircle2, Clock, AlertCircle, User as UserIcon, FolderOpen,
  Bed, Maximize, FileText, ExternalLink, Info
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
  correspondentesPermitidos?: string[]; // ← LISTA BRANCA (Tudo fechado por padrão)
  motivoReprovacao?: string;
  origemDesqualificacao?: string;
  correspondentesInfo?: Array<{ id: string; nome: string }>;
  simulacao?: {
    valorImovel: number;
    valorAvaliacao?: number;
    entrada: number;
    valorFinanciado: number;
    rendaFamiliar: number;
    subsidio: number;
  };
}

interface DocumentoPadrao {
  url: string;
  nomeOriginal: string;
  dataUpload: string;
}

interface Empreendimento {
  slug: string;
  nome: string;
  documentosPadrao?: DocumentoPadrao[];
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
  const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([]);
  const [userName, setUserName] = useState("");
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [abaAtiva, setAbaAtiva] = useState<"auditoria" | "arquivos">("auditoria");
  const [meuUid, setMeuUid] = useState<string>(""); // ← UID do correspondente logado

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
      setMeuUid(user.uid); // ← Armazena o UID do correspondente

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
          // ← FILTRO SILENCIOSO: SÓ mostra leads onde o UID deste correspondente está na Lista Branca
          .filter(lead => {
            const permitidos = lead.correspondentesPermitidos || [];
            return permitidos.includes(user.uid);
          })
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLeadsParaAnalise(leads);
      });

      return () => unsubLeads();
    });
    return () => unsubAuth();
  }, []);

  // ── CARREGAMENTO DE EMPREENDIMENTOS (PARA OS ARQUIVOS PADRÃO) ──
  useEffect(() => {
    const carregarEmpreendimentos = async () => {
      try {
        const empSnapshot = await getDocs(query(collection(db, "empreendimentos"), where("status", "==", "ativo")));
        const emps: Empreendimento[] = [];
        empSnapshot.forEach((docItem) => {
           emps.push({
             slug: docItem.id,
             nome: docItem.data().nome,
             documentosPadrao: docItem.data().documentosPadrao || []
           });
        });
        setEmpreendimentos(emps);
      } catch (error) {
        console.error("Erro ao carregar empreendimentos:", error);
      }
    };
    
    if (abaAtiva === "arquivos") {
       carregarEmpreendimentos();
    }
  }, [abaAtiva]);

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

        <div style={{ marginBottom: 30 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "white", marginBottom: 20 }}>
            Painel do Correspondente
          </h1>

          {/* ABAS DE NAVEGAÇÃO */}
          <div style={{ display: "flex", gap: 10, background: "rgba(0,0,0,0.3)", padding: 6, borderRadius: 14, border: "1px solid var(--border-subtle)", flexWrap: "wrap", maxWidth: "max-content" }}>
            <button
              onClick={() => setAbaAtiva("auditoria")}
              style={{
                padding: "12px 20px", borderRadius: 10, border: "none",
                fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap",
                background: abaAtiva === "auditoria" ? "var(--terracota)" : "transparent",
                color: abaAtiva === "auditoria" ? "white" : "var(--gray-mid)"
              }}
            >
              <ShieldCheck size={18} />
              Auditoria de Crédito
            </button>
            <button
              onClick={() => setAbaAtiva("arquivos")}
              style={{
                padding: "12px 20px", borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap",
                background: abaAtiva === "arquivos" ? "rgba(56,189,248,0.15)" : "transparent",
                color: abaAtiva === "arquivos" ? "#38bdf8" : "var(--gray-mid)",
                border: abaAtiva === "arquivos" ? "1px solid rgba(56,189,248,0.3)" : "1px solid transparent"
              }}
            >
              <FolderOpen size={18} color={abaAtiva === "arquivos" ? "#38bdf8" : "var(--gray-mid)"} />
              Material de Apoio
            </button>
          </div>
        </div>

        {/* =========================================================
            ABA 1: AUDITORIA DE CRÉDITO (LEADS)
            ========================================================= */}
        {abaAtiva === "auditoria" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* ESTATÍSTICAS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 8 }}>
              <div style={{ padding: "18px 16px 16px", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)" }}>
                    <Clock size={16} color="#38bdf8" />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Em Análise</span>
                </div>
                <p style={{ fontSize: 36, fontWeight: 800, color: "#38bdf8", lineHeight: 1 }}>{countAnalise}</p>
              </div>
              <div style={{ padding: "18px 16px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
                    <AlertCircle size={16} color="#ef4444" />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pendências</span>
                </div>
                <p style={{ fontSize: 36, fontWeight: 800, color: "#ef4444", lineHeight: 1 }}>{countPendencias}</p>
              </div>
              <div style={{ padding: "18px 16px 16px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)" }}>
                    <CheckCircle2 size={16} color="#4ade80" />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Aprovados</span>
                </div>
                <p style={{ fontSize: 36, fontWeight: 800, color: "#4ade80", lineHeight: 1 }}>{countAprovados}</p>
              </div>
            </div>

            {/* BARRA DE FILTROS */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", background: "var(--bg-card)", padding: "16px", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
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
                  <p style={{ color: "var(--gray-mid)", fontWeight: 600 }}>Nenhum lead disponível para você no momento.</p>
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
                        background: "var(--bg-card)", borderRadius: 16,
                        border: `1px solid ${statusBg.replace("0.1", "0.3")}`,
                        display: "flex", flexDirection: "column"
                      }}
                    >
                      {/* LINHA 1: INFO + STATUS */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, background: statusBg, color: statusColor, border: `1px solid ${statusColor}22` }}>
                            {(lead.nome || "?")[0].toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontWeight: 700, color: "white", fontSize: 14, marginBottom: 4 }}>{lead.nome}</p>
                            <div style={{ display: "flex", gap: 6, fontSize: 11, color: "var(--gray-mid)", flexWrap: "wrap", alignItems: "center" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--gray-light)" }}>
                                <Building2 size={11} /> {lead.empreendimentoNome}
                              </span>
                              <span style={{ color: "var(--border-subtle)" }}>·</span>
                              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <Phone size={11} /> {lead.whatsapp}
                              </span>
                              <span style={{ color: "var(--border-subtle)" }}>·</span>
                              <span>{new Date(lead.timestamp).toLocaleDateString()}</span>
                              {lead.nomeCorretor && (
                                <span style={{ fontSize: 10, color: "var(--gray-dark)", fontWeight: 600 }}>· {lead.nomeCorretor}</span>
                              )}
                              {(lead as any).correspondentesInfo && (lead as any).correspondentesInfo.length > 0 && (
                                <><span style={{ color: "var(--border-subtle)" }}>·</span>
                                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#38bdf8", fontWeight: 600 }}>
                                  <ShieldCheck size={10} /> CB: {(lead as any).correspondentesInfo.map((c: any) => c.nome).join(", ")}
                                </span></>
                              )}
                            </div>
                          </div>
                        </div>
                        {(estaAprovado || lead.status === "nao_qualificado" || lead.status === "credito_reprovado") ? (
                          <button onClick={() => setLeadAnaliseId(lead.id)} title="Ver detalhes" style={{ padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, flexShrink: 0, background: statusBg, color: statusColor, border: `1px solid ${statusColor}40`, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            {statusLabel} <span style={{ fontSize: 10, opacity: 0.7 }}>↗</span>
                          </button>
                        ) : (
                          <span style={{ padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, flexShrink: 0, background: statusBg, color: statusColor, border: `1px solid ${statusColor}40` }}>
                            {statusLabel}
                          </span>
                        )}
                      </div>

                      {/* LINHA 2: AÇÕES */}
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "9px 20px", display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => setLeadAnaliseId(lead.id)}
                          style={{ padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, display: "flex", gap: 5, alignItems: "center", border: "none", cursor: "pointer", background: "#38bdf8", color: "white" }}
                        >
                          <ShieldCheck size={12} /> Analisar Dossiê
                        </button>
                        {estaAprovado && (
                          <button
                            onClick={() => setLeadDocumentosId(lead.id)}
                            style={{ position: "relative", padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, display: "flex", gap: 5, alignItems: "center", cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--gray-light)" }}
                          >
                            <FolderOpen size={12} /> Documentos
                            {naoLidos > 0 && (
                              <span style={{ position: "absolute", top: -5, right: -5, background: "#ef4444", color: "white", fontSize: 9, fontWeight: 800, width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {naoLidos}
                              </span>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Motivo inline quando reprovado */}
                      {(lead.status === "nao_qualificado" || lead.status === "credito_reprovado") && lead.motivoReprovacao && (
                        <div style={{ margin: "0 20px 14px", padding: "10px 14px", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid var(--border-subtle)", borderLeft: "3px solid rgba(239,68,68,0.4)", display: "flex", flexDirection: "column", gap: 4 }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: lead.origemDesqualificacao === "corretor" ? "#fb923c" : "var(--gray-mid)" }}>
                            {lead.origemDesqualificacao === "corretor" ? "Desqualificado pelo Corretor" : "Reprovado pela Análise de Crédito"}
                          </p>
                          <p style={{ fontSize: 12, color: "var(--gray-light)", lineHeight: 1.5 }}>{lead.motivoReprovacao}</p>
                        </div>
                      )}

                      </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            ABA 2: MATERIAL DE APOIO (ARQUIVOS PADRÃO)
            ========================================================= */}
        {abaAtiva === "arquivos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ background: "rgba(56,189,248,0.08)", padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
              <Info size={18} color="#38bdf8" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.5 }}>
                Encontre aqui Plantas, Memoriais Descritivos e projetos oficiais fornecidos pela construtora. Eles podem ser úteis para anexar na SICAQ durante a aprovação do crédito.
              </p>
            </div>

            {empreendimentos.length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
                <FolderOpen size={32} color="var(--gray-dark)" style={{ margin: "0 auto 16px" }} />
                <p style={{ color: "var(--gray-mid)", fontWeight: 600 }}>Nenhum material disponível ainda.</p>
              </div>
            ) : (
              empreendimentos.map((emp) => {
                if (!emp.documentosPadrao || emp.documentosPadrao.length === 0) return null;
                
                return (
                  <div key={emp.slug} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, overflow: "hidden" }}>
                    <div style={{ padding: "16px 20px", background: "rgba(0,0,0,0.2)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                      <Building2 size={18} color="var(--terracota)" />
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-light)" }}>{emp.nome}</h3>
                    </div>
                    <div style={{ padding: "16px 20px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                        {emp.documentosPadrao.map((docItem, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 10, background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-subtle)" }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(56,189,248,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8", flexShrink: 0 }}>
                              <FileText size={18} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-light)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={docItem.nomeOriginal}>
                                {docItem.nomeOriginal}
                              </p>
                              <p style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 2 }}>
                                Atualizado em {new Date(docItem.dataUpload).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                            <a 
                              href={docItem.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              title="Baixar arquivo"
                              style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(56,189,248,0.15)", color: "#38bdf8", fontSize: 12, fontWeight: 700, textDecoration: "none", border: "1px solid rgba(56,189,248,0.3)" }}
                            >
                              Baixar
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

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