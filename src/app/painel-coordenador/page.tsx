"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs } from "firebase/firestore";
import Image from "next/image";
import { Users, LogOut, MessageCircle, Building2, Flame, FolderOpen, FileText, BarChart3, Filter, X, Map as MapIcon, Lock, CheckCircle2, ShieldCheck, Phone, Clock, Briefcase } from "lucide-react";
import { DossieModal } from "@/components/corretor/DossieModal";
import { MapaInterativo } from "@/components/mapa/MapaInterativo";

// ─────────────────────────────────────────────────────────
// TIPAGENS
// ─────────────────────────────────────────────────────────

interface LeadData {
  id: string;
  nome: string;
  whatsapp: string;
  whatsapp2?: string;
  empreendimentoNome: string;
  empreendimentoId: string;
  modelo: string;
  timestamp: string;
  status: string;
  corretorId: string;
  nomeCorretor?: string;
  dossie?: any;
  propostaUrl?: string;
  motivoReprovacao?: string;
  origemDesqualificacao?: string;
  correspondentesInfo?: Array<{ id: string; nome: string }>;
  creditoAprovadoInfo?: {
    valorAprovado: number;
    valorParcela: number;
    observacoes: string;
    dataAprovacao: string;
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
  mapaUrl?: string; 
  documentosPadrao?: DocumentoPadrao[];
}

export default function PainelCoordenador() {
  const [authVerificado, setAuthVerificado] = useState(false);
  const [todosLeads, setTodosLeads] = useState<LeadData[]>([]);
  const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([]);
  const [listaCorretores, setListaCorretores] = useState<any[]>([]);
  const [userName, setUserName] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<"gestao" | "arquivos">("gestao");
  
  // Filtros Avançados
  const [filtroCorretor, setFiltroCorretor] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [pesquisaNome, setPesquisaNome] = useState("");

  const [leadDossieId, setLeadDossieId] = useState<string | null>(null);
  const leadDossieSelecionado = todosLeads.find(l => l.id === leadDossieId) || null;

  // Estados do Mapa de Lotes (Visão Geral - Coordenador)
  const [mapaVisaoGeral, setMapaVisaoGeral] = useState<{ aberto: boolean, empreendimento: Empreendimento | null }>({ aberto: false, empreendimento: null });
  const [lotesVisaoGeral, setLotesVisaoGeral] = useState<any[]>([]);
  const [loadingVisaoGeral, setLoadingVisaoGeral] = useState(false);
  const [loteDetalhe, setLoteDetalhe] = useState<any | null>(null);
  const [modalStatusCoordenador, setModalStatusCoordenador] = useState<LeadData | null>(null);

  const router = useRouter();

  // ── AUTENTICAÇÃO E VALIDAÇÃO DE ROLE ──
  useEffect(() => {
    let unsubLeads: () => void;
    let unsubCorretores: () => void;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { 
        if (unsubLeads) unsubLeads();
        if (unsubCorretores) unsubCorretores();
        router.replace("/login"); 
        return; 
      }

      try {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Libera acesso se for coordenador, se for admin ou se for o e-mail supremo
          if (userData.role !== "coordenador" && userData.role !== "admin" && user.email !== "contax002@gmail.com") {
            alert("Acesso restrito à Coordenação de Vendas.");
            router.replace("/");
            return;
          }
          setUserName(userData.nome || "Coordenador");
          setAuthVerificado(true);
        } else {
          // Fallback para o seu e-mail supremo caso o documento não exista
          if (user.email === "contax002@gmail.com") {
            setUserName("Administrador Supremo");
            setAuthVerificado(true);
          } else {
            alert("Perfil de utilizador não encontrado no banco de dados.");
            auth.signOut();
            return;
          }
        }

        // Buscar TODOS os leads com fallback de erro para não dar crash na consola
        unsubLeads = onSnapshot(
          collection(db, "leads"), 
          (snap) => {
            const leadsData = snap.docs
              .map(d => ({ id: d.id, ...d.data() } as LeadData))
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setTodosLeads(leadsData);
          },
          (error) => {
            console.log("Aviso (Leads): Sessão expirada ou acesso negado. Desligando ouvintes...");
          }
        );

        // Buscar Corretores Ativos para o Filtro
        const qCorretores = query(collection(db, "usuarios"), where("status", "==", "ativo"), where("role", "==", "corretor"));
        unsubCorretores = onSnapshot(
          qCorretores, 
          (snap) => {
            const corretoresData = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            corretoresData.sort((a: any, b: any) => (a.nome || "").localeCompare(b.nome || ""));
            setListaCorretores(corretoresData);
          },
          (error) => {
            console.log("Aviso (Corretores): Sessão expirada ou acesso negado.");
          }
        );

      } catch (err: any) {
        console.error("Erro na verificação de sessão:", err);
        alert(`Erro na validação de permissões: ${err.message}`);
        auth.signOut();
      }
    });

    return () => {
      unsubAuth();
      if (unsubLeads) unsubLeads();
      if (unsubCorretores) unsubCorretores();
    };
  }, [router]);

  // ── CARREGAR EMPREENDIMENTOS E MATERIAIS ──
  useEffect(() => {
    const fetchEmps = async () => {
      const snap = await getDocs(query(collection(db, "empreendimentos"), where("status", "==", "ativo")));
      setEmpreendimentos(snap.docs.map(d => ({ 
        slug: d.id, 
        nome: d.data().nome, 
        mapaUrl: d.data().mapaUrl,
        documentosPadrao: d.data().documentosPadrao || [] 
      })));
    };
    fetchEmps();
  }, []);

  // ── MAPA INTERATIVO (VISÃO GERAL) ──
  const abrirVisaoGeralMapa = async (emp: Empreendimento) => {
    if (!emp.mapaUrl) {
      alert("Este empreendimento ainda não tem um mapa SVG configurado.");
      return;
    }

    setMapaVisaoGeral({ aberto: true, empreendimento: emp });
    setLoadingVisaoGeral(true);

    const qQuadras = query(collection(db, "empreendimentos", emp.slug, "quadras"));
    onSnapshot(qQuadras, (snapQuadras) => {
      const lotesTemp: any[] = [];
      let promises = snapQuadras.docs.map(docQuadra => {
        const quadraBloqueada = docQuadra.data().bloqueada === true;

        return new Promise<void>((resolve) => {
          onSnapshot(collection(db, "empreendimentos", emp.slug, "quadras", docQuadra.id, "lotes"), (snapLotes) => {
            snapLotes.forEach(docLote => {
              const data = docLote.data();
              const index = lotesTemp.findIndex(l => l.id === docLote.id);
              const loteTratado = {
                id: docLote.id,
                quadraId: docQuadra.id,
                ...data,
                status: quadraBloqueada ? "bloqueado" : data.status
              };

              if (index >= 0) lotesTemp[index] = loteTratado;
              else lotesTemp.push(loteTratado);
            });
            setLotesVisaoGeral([...lotesTemp]);
            resolve();
          });
        });
      });

      Promise.all(promises).then(() => setLoadingVisaoGeral(false));
    });
  };

  // ── LÓGICA DE FILTRAGEM ──
  const leadsFiltrados = useMemo(() => {
    return todosLeads.filter(lead => {
      const matchCorretor = filtroCorretor === "todos" || 
                            (filtroCorretor === "roleta" && !lead.corretorId) || 
                            lead.corretorId === filtroCorretor;
      const matchStatus = filtroStatus === "todos" || 
                          (filtroStatus === "aprovados" && (lead.status === "qualificado" || lead.status === "credito_aprovado")) ||
                          (filtroStatus === "reprovados" && (lead.status === "nao_qualificado" || lead.status === "credito_reprovado" || lead.status === "desqualificado")) ||
                          lead.status === filtroStatus;
      const matchNome = lead.nome.toLowerCase().includes(pesquisaNome.toLowerCase());
      
      return matchCorretor && matchStatus && matchNome;
    });
  }, [todosLeads, filtroCorretor, filtroStatus, pesquisaNome]);

  const leadsNaRoleta = todosLeads.filter(l => !l.corretorId).length;
  const leadsAprovados = todosLeads.filter(l => l.status === "qualificado" || l.status === "credito_aprovado").length;

  if (!authVerificado) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <div style={{ color: "var(--terracota)", fontWeight: 700, animation: "pulse 2s infinite" }}>Carregando Painel da Coordenação...</div>
        <style dangerouslySetInnerHTML={{__html: `@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>

      {/* HEADER */}
      <header style={{ padding: "16px", background: "rgba(15,30,22,0.98)", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 40 }}>
        <Image src="/logo.png" alt="Habiticon" width={140} height={40} style={{ height: 32, width: "auto" }} priority />
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <div style={{ padding: "4px 10px", borderRadius: 100, background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#60a5fa", textTransform: "uppercase" }}>Coordenação</span>
          </div>
          <span style={{ fontSize: 13, color: "var(--gray-light)" }} className="hidden sm:inline">
            Olá, <strong>{userName}</strong>
          </span>
          <button onClick={() => auth.signOut()} title="Sair" className="btn-ghost" style={{ color: "#f87171", padding: 8 }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="container-app" style={{ padding: "30px 20px", maxWidth: 1000, margin: "0 auto" }}>

        {/* DASHBOARD RÁPIDO */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
          <div style={{ padding: "18px 16px 16px", background: "rgba(175,111,83,0.08)", border: "1px solid rgba(175,111,83,0.2)", borderRadius: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(175,111,83,0.15)", border: "1px solid rgba(175,111,83,0.3)" }}>
                <Users size={16} color="var(--terracota)" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total de Leads</span>
            </div>
            <p style={{ fontSize: 36, fontWeight: 800, color: "var(--terracota)", lineHeight: 1 }}>{todosLeads.length}</p>
          </div>
          <div style={{ padding: "18px 16px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <Flame size={16} color="#ef4444" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Leads na Roleta</span>
            </div>
            <p style={{ fontSize: 36, fontWeight: 800, color: "#ef4444", lineHeight: 1 }}>{leadsNaRoleta}</p>
          </div>
          <div style={{ padding: "18px 16px 16px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)" }}>
                <BarChart3 size={16} color="#4ade80" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Aprovados / Vendidos</span>
            </div>
            <p style={{ fontSize: 36, fontWeight: 800, color: "#4ade80", lineHeight: 1 }}>{leadsAprovados}</p>
          </div>
        </div>

        {/* ABAS */}
        <div style={{ display: "flex", gap: 10, background: "rgba(0,0,0,0.3)", padding: 6, borderRadius: 14, border: "1px solid var(--border-subtle)", flexWrap: "wrap", marginBottom: 24 }}>
          <button
            onClick={() => setAbaAtiva("gestao")}
            style={{ flex: "1 1 min-content", padding: "12px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap", background: abaAtiva === "gestao" ? "var(--terracota)" : "transparent", color: abaAtiva === "gestao" ? "white" : "var(--gray-mid)" }}
          >
            <Filter size={18} /> Monitoramento de Vendas
          </button>
          <button
            onClick={() => setAbaAtiva("arquivos")}
            style={{ flex: "1 1 min-content", padding: "12px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap", background: abaAtiva === "arquivos" ? "rgba(56,189,248,0.15)" : "transparent", color: abaAtiva === "arquivos" ? "#38bdf8" : "var(--gray-mid)" }}
          >
            <FolderOpen size={18} /> Material de Apoio e Mapas
          </button>
        </div>

        {/* ABA 1: GESTÃO DE LEADS */}
        {abaAtiva === "gestao" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* BARRA DE FILTROS */}
            <div style={{ background: "var(--bg-card)", padding: "16px 20px", borderRadius: 14, border: "1px solid var(--border-subtle)", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Corretor Responsável</label>
                <select value={filtroCorretor} onChange={(e) => setFiltroCorretor(e.target.value)} className="input-field" style={{ height: 42, fontSize: 13, padding: "0 12px" }}>
                  <option value="todos">Toda a Equipe</option>
                  <option value="roleta">🔥 Soltos na Roleta</option>
                  {listaCorretores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Status do Cliente</label>
                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="input-field" style={{ height: 42, fontSize: 13, padding: "0 12px" }}>
                  <option value="todos">Qualquer Status</option>
                  <option value="novo">Novo</option>
                  <option value="em_atendimento">Em Atendimento</option>
                  <option value="com_pendencia">Com Pendência</option>
                  <option value="aprovados">✅ Crédito Aprovado / Qualificado</option>
                  <option value="reprovados">❌ Crédito Reprovado / Desqualificado</option>
                </select>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Buscar Cliente</label>
                <div style={{ position: "relative" }}>
                  <input type="text" placeholder="Nome do cliente..." value={pesquisaNome} onChange={(e) => setPesquisaNome(e.target.value)} className="input-field" style={{ height: 42, fontSize: 13, padding: "0 12px" }} />
                  {pesquisaNome && (
                    <button onClick={() => setPesquisaNome("")} style={{ position: "absolute", right: 10, top: 12, background: "transparent", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}>
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* LISTAGEM DE LEADS (Somente Leitura / Contato) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 13, color: "var(--gray-mid)", paddingLeft: 8 }}>Exibindo <strong>{leadsFiltrados.length}</strong> clientes.</p>
              
              {leadsFiltrados.length === 0 ? (
                 <div style={{ padding: "40px", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
                   <p style={{ color: "var(--gray-mid)" }}>Nenhum lead encontrado com estes filtros.</p>
                 </div>
              ) : (
                leadsFiltrados.map((lead) => {
                  const estaSolto = !lead.corretorId;
                  const nomeCorretor = listaCorretores.find(c => c.id === lead.corretorId)?.nome || lead.nomeCorretor || "Desconhecido";
                  
                  const isAprovado = lead.status === "qualificado" || lead.status === "credito_aprovado";
                  const isReprovado = lead.status === "nao_qualificado" || lead.status === "credito_reprovado";
                  const statusBg = isAprovado ? "rgba(74,222,128,0.12)" : isReprovado ? "rgba(107,114,128,0.12)" : "rgba(255,255,255,0.05)";
                  const statusBorder = isAprovado ? "rgba(74,222,128,0.3)" : isReprovado ? "rgba(107,114,128,0.3)" : "var(--border-subtle)";
                  const statusColor = isAprovado ? "#4ade80" : isReprovado ? "#9ca3af" : "var(--gray-light)";

                  return (
                    <div key={lead.id} style={{ background: "var(--bg-card)", borderRadius: 14, border: isAprovado ? "1px solid rgba(74,222,128,0.3)" : isReprovado ? "1px solid rgba(107,114,128,0.3)" : estaSolto ? "1px solid rgba(239,68,68,0.3)" : "1px solid var(--border-subtle)", display: "flex", flexDirection: "column" }}>

                      {/* LINHA 1: INFO + STATUS */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: isAprovado ? "rgba(74,222,128,0.12)" : isReprovado ? "rgba(107,114,128,0.12)" : estaSolto ? "rgba(239,68,68,0.12)" : "var(--terracota-glow)", color: isAprovado ? "#4ade80" : isReprovado ? "#9ca3af" : estaSolto ? "#ef4444" : "var(--terracota)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                            {(lead.nome || "?")[0].toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontWeight: 700, color: "white", fontSize: 14, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.nome}</p>
                            <div style={{ display: "flex", gap: 6, fontSize: 11, color: "var(--gray-mid)", flexWrap: "wrap", alignItems: "center" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <Phone size={11} /> {lead.whatsapp}
                                {lead.whatsapp2 && <><span style={{ margin: "0 3px", color: "var(--border-subtle)" }}>|</span><Phone size={11} /> {lead.whatsapp2}</>}
                              </span>
                              <span style={{ color: "var(--border-subtle)" }}>·</span>
                              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <Clock size={10} />
                                {lead.timestamp ? new Date(lead.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " às") : "—"}
                              </span>
                              {lead.modelo && <><span style={{ color: "var(--border-subtle)" }}>·</span><span style={{ color: "var(--terracota-light)", fontWeight: 600 }}>{lead.modelo}</span></>}
                              <span style={{ color: "var(--border-subtle)" }}>·</span>
                              {estaSolto ? (
                                <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700 }}>Sem Corretor</span>
                              ) : (
                                <span style={{ color: "#93c5fd", fontWeight: 600 }}>{nomeCorretor}</span>
                              )}
                              {(lead as any).correspondentesInfo && (lead as any).correspondentesInfo.length > 0 &&
                                ((lead as any).correspondentesInfo as any[])
                                  .filter((c: any) => (c.correspondencia ?? true) || (c.consultoria ?? false))
                                  .map((c: any) => {
                                    const hasCB = c.correspondencia ?? true;
                                    const hasCons = c.consultoria ?? false;
                                    return (
                                      <Fragment key={c.id}>
                                        <span style={{ color: "var(--border-subtle)" }}>·</span>
                                        <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600 }}>
                                          {hasCB && <ShieldCheck size={10} color="#38bdf8" />}
                                          {hasCons && <Briefcase size={10} color="#a78bfa" />}
                                          <span style={{ color: hasCB && hasCons ? "var(--gray-light)" : hasCB ? "#38bdf8" : "#a78bfa" }}>
                                            {hasCB && hasCons ? `CB + Consultoria: ${c.nome}` : hasCB ? `CB: ${c.nome}` : `Consultoria: ${c.nome}`}
                                          </span>
                                        </span>
                                      </Fragment>
                                    );
                                  })
                              }
                            </div>
                          </div>
                        </div>
                        {(isAprovado || isReprovado) ? (
                          <button onClick={() => setModalStatusCoordenador(lead)} title="Ver detalhes" style={{ padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, flexShrink: 0, background: statusBg, border: `1px solid ${statusBorder}`, color: statusColor, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            {lead.status ? lead.status.replace(/_/g, " ") : "Novo"} <Lock size={9} />
                          </button>
                        ) : (
                          <span style={{ padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, flexShrink: 0, background: statusBg, border: `1px solid ${statusBorder}`, color: statusColor }}>
                            {lead.status ? lead.status.replace(/_/g, " ") : "Novo"}
                          </span>
                        )}
                      </div>

                      {/* LINHA 2: AÇÕES */}
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "9px 20px", display: "flex", alignItems: "center", gap: 5 }}>
                        <button onClick={() => setLeadDossieId(lead.id)} style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--gray-light)" }}>
                          <FolderOpen size={12} /> Ver Dossiê
                        </button>
                        {lead.propostaUrl && (
                          <a href={lead.propostaUrl} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--gray-light)", textDecoration: "none" }}>
                            <FileText size={12} /> PDF
                          </a>
                        )}
                        <div style={{ flex: 1 }} />
                        <a href={`https://wa.me/55${(lead.whatsapp || "").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.15)", color: "#4ade80", textDecoration: "none" }}>
                          <MessageCircle size={12} /> WhatsApp
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ABA 2: MATERIAIS DE VENDAS E MAPAS */}
        {abaAtiva === "arquivos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {empreendimentos.map((emp) => {
              if ((!emp.documentosPadrao || emp.documentosPadrao.length === 0) && !emp.mapaUrl) return null;
              
              return (
                <div key={emp.slug} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", background: "rgba(0,0,0,0.2)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Building2 size={18} color="var(--terracota)" />
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-light)" }}>{emp.nome}</h3>
                    </div>
                    
                    <button 
                      onClick={() => abrirVisaoGeralMapa(emp)} 
                      style={{ padding: "6px 12px", background: "var(--terracota-glow)", color: "var(--terracota)", border: "1px solid var(--border-active)", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                    >
                        <MapIcon size={14}/> Ver Mapa de Lotes
                    </button>
                  </div>

                  <div style={{ padding: "16px 20px" }}>
                    {!emp.documentosPadrao || emp.documentosPadrao.length === 0 ? (
                      <p style={{ fontSize: 13, color: "var(--gray-dark)", textAlign: "center", padding: "10px 0" }}>
                        Nenhum arquivo em PDF adicionado para este empreendimento.
                      </p>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                        {emp.documentosPadrao.map((docItem, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 10, background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-subtle)" }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(56,189,248,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8", flexShrink: 0 }}>
                              <FileText size={18} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-light)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{docItem.nomeOriginal}</p>
                            </div>
                            <a href={docItem.url} target="_blank" rel="noopener noreferrer" style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(56,189,248,0.15)", color: "#38bdf8", fontSize: 12, fontWeight: 700, textDecoration: "none", border: "1px solid rgba(56,189,248,0.3)" }}>
                              Baixar
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

{/* MODAL: STATUS DO LEAD (APROVADO / REPROVADO) */}
      {modalStatusCoordenador && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setModalStatusCoordenador(null); }} style={{ position: "fixed", inset: 0, zIndex: 160, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-card)", width: "100%", maxWidth: 460, borderRadius: 20, overflow: "hidden", border: (modalStatusCoordenador.status === "qualificado" || modalStatusCoordenador.status === "credito_aprovado") ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(239,68,68,0.3)" }}>
            <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: (modalStatusCoordenador.status === "qualificado" || modalStatusCoordenador.status === "credito_aprovado") ? "1px solid rgba(74,222,128,0.2)" : "1px solid rgba(239,68,68,0.2)", background: (modalStatusCoordenador.status === "qualificado" || modalStatusCoordenador.status === "credito_aprovado") ? "rgba(74,222,128,0.06)" : "rgba(239,68,68,0.06)" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, color: (modalStatusCoordenador.status === "qualificado" || modalStatusCoordenador.status === "credito_aprovado") ? "#4ade80" : "#f87171" }}>
                  {(modalStatusCoordenador.status === "qualificado" || modalStatusCoordenador.status === "credito_aprovado")
                    ? <><CheckCircle2 size={18} /> Crédito Aprovado</>
                    : <><Lock size={18} /> Crédito Reprovado</>}
                </h3>
                <p style={{ fontSize: 12, color: "var(--gray-mid)", marginTop: 4 }}>Cliente: <strong style={{ color: "var(--gray-light)" }}>{modalStatusCoordenador.nome}</strong></p>
              </div>
              <button onClick={() => setModalStatusCoordenador(null)} style={{ background: "none", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {(modalStatusCoordenador.status === "qualificado" || modalStatusCoordenador.status === "credito_aprovado") ? (
                modalStatusCoordenador.creditoAprovadoInfo ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                        <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Valor Liberado</p>
                        <p style={{ fontSize: 18, fontWeight: 800, color: "white" }}>R$ {modalStatusCoordenador.creditoAprovadoInfo.valorAprovado?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                        <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Parcela Estimada</p>
                        <p style={{ fontSize: 18, fontWeight: 800, color: "white" }}>R$ {modalStatusCoordenador.creditoAprovadoInfo.valorParcela?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    {modalStatusCoordenador.creditoAprovadoInfo.observacoes && (
                      <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border-subtle)", borderLeft: "3px solid rgba(74,222,128,0.4)" }}>
                        <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Condicionantes</p>
                        <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.6 }}>{modalStatusCoordenador.creditoAprovadoInfo.observacoes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: "14px 16px", background: "rgba(74,222,128,0.06)", borderRadius: 10, border: "1px solid rgba(74,222,128,0.15)" }}>
                    <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.6 }}>Este lead foi <strong style={{ color: "#4ade80" }}>qualificado</strong> e está pronto para avançar no financiamento.</p>
                  </div>
                )
              ) : (
                modalStatusCoordenador.motivoReprovacao ? (
                  <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border-subtle)", borderLeft: "3px solid rgba(239,68,68,0.4)" }}>
                    <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: modalStatusCoordenador.origemDesqualificacao === "corretor" ? "#fb923c" : "var(--gray-mid)" }}>
                      {modalStatusCoordenador.origemDesqualificacao === "corretor" ? "Desqualificado pelo Corretor" : "Reprovado pela Análise de Crédito"}
                    </p>
                    <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.6 }}>{modalStatusCoordenador.motivoReprovacao}</p>
                  </div>
                ) : (
                  <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px dashed var(--border-subtle)" }}>
                    <p style={{ fontSize: 13, color: "var(--gray-dark)", fontStyle: "italic" }}>Nenhum motivo foi registrado.</p>
                  </div>
                )
              )}
              <button onClick={() => setModalStatusCoordenador(null)} style={{ padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "white", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* DOSSIÊ FLUTUANTE (SOMENTE LEITURA PARA O COORDENADOR) */}
      <DossieModal
        isOpen={leadDossieId !== null}
        onClose={() => setLeadDossieId(null)}
        lead={leadDossieSelecionado}
        isAdmin={false} 
      />

      {/* =========================================================
          MODAL DE MAPA INTERATIVO (VISÃO GERAL / READ-ONLY)
          ========================================================= */}
      {mapaVisaoGeral.aberto && mapaVisaoGeral.empreendimento && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(15,30,22,0.95)" }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
                <MapIcon size={20} color="var(--terracota)" /> 
                Mapa Geral — {mapaVisaoGeral.empreendimento.nome}
              </h2>
              <p style={{ fontSize: 13, color: "var(--gray-mid)", marginTop: 4 }}>
                Modo de visualização. Clique num lote para ver os clientes na fila.
              </p>
            </div>
            <button onClick={() => setMapaVisaoGeral({ aberto: false, empreendimento: null })} style={{ padding: 8, background: "rgba(255,255,255,0.1)", borderRadius: 8, border: "none", color: "white", cursor: "pointer" }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ flex: 1, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
            {loadingVisaoGeral ? (
              <div style={{ color: "var(--terracota)", fontWeight: 700, animation: "pulse 2s infinite" }}>Carregando mapa...</div>
            ) : (
              <MapaInterativo 
                mapaUrl={mapaVisaoGeral.empreendimento.mapaUrl || ""} 
                lotes={lotesVisaoGeral} 
                onLoteClick={(lote) => setLoteDetalhe(lote)} 
              />
            )}
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DO LOTE (QUEM ESTÁ NA FILA) */}
      {loteDetalhe && (
        <div style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-card)", padding: 24, borderRadius: 20, width: "100%", maxWidth: 500, border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "white", fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                <MapIcon size={20} color="var(--terracota)" /> Detalhes do Lote {loteDetalhe.numero}
              </h3>
              <button onClick={() => setLoteDetalhe(null)} style={{ background: "transparent", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, fontWeight: 700, textTransform: "uppercase", background: "rgba(255,255,255,0.1)", color: "white" }}>
                Status: {loteDetalhe.status}
              </span>
            </div>

            {loteDetalhe.fila && loteDetalhe.fila.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h4 style={{ fontSize: 13, color: "var(--gray-mid)", fontWeight: 700, textTransform: "uppercase" }}>Fila de Clientes ({loteDetalhe.fila.length})</h4>
                {loteDetalhe.fila.map((f: any, idx: number) => (
                  <div key={idx} style={{ padding: 16, background: "rgba(0,0,0,0.3)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "white", marginBottom: 4 }}>{idx + 1}º - {f.nomeCliente}</p>
                    <p style={{ fontSize: 12, color: "var(--gray-mid)", marginBottom: 2 }}>Corretor: <strong style={{ color: "var(--gray-light)" }}>{f.nomeCorretor || "Não informado"}</strong></p>
                    <p style={{ fontSize: 12, color: "var(--gray-mid)", marginBottom: 2 }}>Modelo: <strong style={{ color: "var(--terracota-light)" }}>{f.modeloCasa}</strong></p>
                    <p style={{ fontSize: 12, color: "var(--gray-mid)", marginBottom: 2 }}>Valor: <strong style={{ color: "#4ade80" }}>R$ {(f.valorVenda || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>
                    <p style={{ fontSize: 12, color: "var(--gray-mid)" }}>Data da reserva: {new Date(f.timestamp).toLocaleString("pt-BR")}</p>
                  </div>
                ))}
              </div>
            ) : (
               <div style={{ padding: 20, textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 12, border: "1px dashed var(--border-subtle)" }}>
                 <p style={{ fontSize: 13, color: "var(--gray-mid)" }}>Nenhum cliente vinculado a este lote no momento.</p>
               </div>
            )}

            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setLoteDetalhe(null)} style={{ padding: "10px 20px", background: "rgba(255,255,255,0.1)", color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}