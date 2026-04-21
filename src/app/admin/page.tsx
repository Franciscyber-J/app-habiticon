"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, where, onSnapshot } from "firebase/firestore";
import {
  Building2, Settings, Users, MapPin,
  ToggleLeft, ToggleRight, Plus, ExternalLink,
  ArrowLeft, ChevronRight, Phone,
  Calendar, CheckCircle2, Copy, Check, Link2, Trash2, LogOut,
} from "lucide-react";

// ─── Status de lead ──────────────────────────────────────
const STATUS_LEAD = {
  novo:           { label: "Novo",           cor: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.3)"  },
  em_atendimento: { label: "Em atendimento", cor: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)"  },
  qualificado:    { label: "Qualificado",    cor: "#4ade80", bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.3)"  },
  nao_qualificado:{ label: "Não qualificado",cor: "#6b7280", bg: "rgba(107,114,128,0.12)", border: "rgba(107,114,128,0.3)" },
} as const;
type LeadStatus = keyof typeof STATUS_LEAD;

interface Lead {
  id: string;
  empreendimentoId: string;
  nome: string;
  whatsapp: string;
  timestamp: string;
  modelo?: string;
  nomeCorretor?: string;
  status?: LeadStatus;
}

interface Empreendimento {
  slug: string;
  nome: string;
  cidade: string;
  estado: string;
  status: string;
  modelos: { id: string; nome: string; valor: number; area?: number }[];
  leads?: Lead[];
}

function CopyLinkButton({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      const el = document.createElement("textarea");
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 11, color: "var(--gray-dark)", textDecoration: "none",
          display: "flex", alignItems: "center", gap: 4,
          padding: "5px 10px", borderRadius: 6,
          background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-subtle)",
          maxWidth: "min(220px, 40vw)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        <Link2 size={11} />
        {link.replace(/^https?:\/\//, "")}
      </a>
      <button
        onClick={copiar}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 8, cursor: "pointer",
          border: "none", fontSize: 12, fontWeight: 700,
          transition: "all 200ms ease",
          background: copiado ? "rgba(22,163,74,0.15)" : "rgba(175,111,83,0.12)",
          color: copiado ? "#4ade80" : "var(--terracota)",
        }}
      >
        {copiado ? <><Check size={13} /> Copiado!</> : <><Copy size={13} /> Copiar link</>}
      </button>
    </div>
  );
}

export default function AdminPage() {
  const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([]);
  const [todosLeads, setTodosLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"empreendimentos" | "leads">("empreendimentos");

  const router = useRouter();

  // Buscar Empreendimentos e Leads
  const carregarDados = useCallback(async () => {
    try {
      // 1. Busca os empreendimentos
      const empSnapshot = await getDocs(collection(db, "empreendimentos"));
      const emps: Empreendimento[] = [];
      empSnapshot.forEach((doc) => {
        emps.push(doc.data() as Empreendimento);
      });
      setEmpreendimentos(emps);

      // 2. Configura o listener em tempo real para TODOS os leads
      const unsubscribe = onSnapshot(collection(db, "leads"), (snapshot) => {
        const leadsData: Lead[] = [];
        snapshot.forEach((doc) => {
          leadsData.push({ id: doc.id, ...doc.data() } as Lead);
        });
        setTodosLeads(leadsData);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cleanup = carregarDados();
    return () => {
        cleanup.then(unsub => {
            if(unsub) unsub()
        });
    }
  }, [carregarDados]);


  // ─── Criar novo empreendimento ─────────────
  const criarEmpreendimento = useCallback(async () => {
    const slug = `novo-empreendimento-${Date.now()}`;
    const novo = {
      slug,
      nome: "Novo Empreendimento",
      cidade: "Cidade",
      estado: "GO",
      descricao: "",
      status: "ativo",
      coordenadas: { lat: 0, lng: 0 },
      modelos: [{
        id: "modelo-1", nome: "Modelo 1", quartos: 2,
        area: 60, valor: 200000, valorLote: 40000,
        imagem: "", planta: ""
      }],
      simulador: {
        entradaMin: 10000, entradaMax: 100000, prazoMeses: 360,
        taxaFaixa12: 7, taxaFaixa3: 8.16, taxaFaixa3Cotista: 7.66,
        taxaMercado: 12, igpmMensal: 0.8, mesesObra: 5,
        cotaMaximaCaixa: 0.8, percentualObraPorMes: [20,40,55,75,100],
        cub: { bdi: 0.18, cubVigente: 0 }
      },
      mcmv: {
        faixas: [
          { id:2, nome:"Faixa 2", rendaMin:0, rendaMax:5000, subsidioMax:55000, subsidioMin:0, taxa:7, taxaCotista:6.5, cor:"#84cc16", tetoImovel:275000 },
          { id:3, nome:"Faixa 3", rendaMin:5001, rendaMax:9600, subsidioMax:0, subsidioMin:0, taxa:8.16, taxaCotista:7.66, cor:"#fb923c", tetoImovel:400000 },
          { id:4, nome:"Faixa 4", rendaMin:9601, rendaMax:13000, subsidioMax:0, subsidioMin:0, taxa:10.5, taxaCotista:10, cor:"#f43f5e", tetoImovel:600000 }
        ],
        tetoImovel: 275000,
        observacao: ""
      },
      vitrine: { imagens: [], plantas: [], ambientes: {} },
      textos: {
        notasLegais: "", tituloObra: "Fluxo de Obra (PCI)",
        descricaoObra: "", alertaF3: "", alertaF12: ""
      }
    };
    
    await setDoc(doc(db, "empreendimentos", slug), novo);
    setEmpreendimentos(prev => [...prev, novo]);
    router.push(`/admin/${slug}`);
  }, [router]);

  // ─── Excluir empreendimento ──────────────────────────
  const excluirEmpreendimento = useCallback(async (slug: string, nome: string) => {
    if (!confirm(`Excluir "${nome}"?\n\nEsta ação é permanente.`)) return;
    
    try {
      await deleteDoc(doc(db, "empreendimentos", slug));
      setEmpreendimentos(prev => prev.filter(e => e.slug !== slug));
    } catch (error) {
      console.error("Erro ao excluir empreendimento:", error);
      alert("Erro ao excluir empreendimento.");
    }
  }, []);

  // ─── Clonar empreendimento ───────────────────────────
  const clonarEmpreendimento = useCallback(async (emp: Empreendimento) => {
    const novoSlug = `clone-${emp.slug}-${Date.now()}`;
    const clone = {
      ...JSON.parse(JSON.stringify(emp)),
      slug: novoSlug,
      nome: `Clone — ${emp.nome}`,
    };
    
    await setDoc(doc(db, "empreendimentos", novoSlug), clone);
    setEmpreendimentos(prev => [...prev, clone]);
    router.push(`/admin/${novoSlug}`);
  }, [router]);

  const fazerLogout = useCallback(async () => {
    if (!confirm("Sair do painel administrativo?")) return;
    await fetch("/api/auth", { method: "DELETE" }); // Manter temporariamente se a API ainda for usada para cookies
    window.location.href = "/admin/login";
  }, []);

  // ─── Atualiza status do Lead (Firestore) ─────────────────
  const atualizarStatusLead = async (leadId: string, status: LeadStatus) => {
    try {
      await updateDoc(doc(db, "leads", leadId), { status });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  // ─── Deleta Lead (Firestore) ─────────────────────────────
  const deletarLead = async (leadId: string) => {
    if (!confirm("Excluir este lead? Esta ação não pode ser desfeita.")) return;
    try {
      await deleteDoc(doc(db, "leads", leadId));
    } catch (error) {
      console.error("Erro ao deletar lead:", error);
    }
  };

  const toggleStatus = async (slug: string, current: string) => {
    const newStatus = current === "ativo" ? "inativo" : "ativo";
    try {
        await updateDoc(doc(db, "empreendimentos", slug), { status: newStatus });
        setEmpreendimentos((prev) =>
          prev.map((e) => (e.slug === slug ? { ...e, status: newStatus } : e))
        );
    } catch (error) {
        console.error("Erro ao atualizar status do empreendimento", error)
    }
  };

  const ativos = empreendimentos.filter((e) => e.status === "ativo").length;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* ── HEADER ──────────────────────────────────────────── */}
      <header style={{
        background: "rgba(15,30,22,0.98)",
        backdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--border-subtle)",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div className="container-app">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <Link href="/" className="btn-ghost" style={{ padding: "10px 12px" }}>
                <ArrowLeft size={20} />
              </Link>
              <Image
                src="/logo.png" alt="Habiticon" width={280} height={80}
                style={{ height: "clamp(36px,8vw,56px)", width: "auto", objectFit: "contain", flexShrink: 0 }}
                priority
              />
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 14px", borderRadius: 100,
                background: "rgba(249,115,22,0.15)",
                border: "1px solid rgba(249,115,22,0.3)",
              }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#fb923c", letterSpacing: "0.1em", textTransform: "uppercase" }}>Admin</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link href="/" style={{ fontSize: 13, color: "var(--gray-mid)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 10px" }} className="btn-ghost">
                <ExternalLink size={14} />
                <span className="hidden sm:inline">Ver site</span>
              </Link>
              <div style={{ width: 1, height: 20, background: "var(--border-subtle)" }} />
              <button onClick={fazerLogout} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171", fontSize: 13, fontWeight: 600,
              }}>
                <LogOut size={14} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container-app" style={{ padding: "clamp(20px,4vw,40px) clamp(16px,4vw,32px) 80px" }}>
        {/* ── STATS ───────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 32 }}>
          {[
            {
              label: "Empreendimentos",
              value: loading ? "…" : empreendimentos.length,
              icon: Building2, color: "var(--terracota)", bg: "rgba(175,111,83,0.12)", border: "rgba(175,111,83,0.25)",
            },
            {
              label: "Ativos",
              value: loading ? "…" : ativos,
              icon: CheckCircle2, color: "#4ade80", bg: "rgba(22,163,74,0.1)", border: "rgba(22,163,74,0.2)",
            },
            {
              label: "Leads capturados",
              value: loading ? "…" : todosLeads.length,
              icon: Users, color: "#60a5fa", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} style={{ padding: "18px 16px 16px", background: stat.bg, border: `1px solid ${stat.border}`, borderRadius: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${stat.color}22`, border: `1px solid ${stat.color}44`,
                  }}>
                    <Icon size={18} color={stat.color} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-dark)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    {stat.label}
                  </span>
                </div>
                <div style={{ fontSize: "clamp(28px,6vw,40px)", fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                  {stat.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── TABS ────────────────────────────────────────────── */}
        <div style={{
          display: "flex", gap: 4, background: "rgba(0,0,0,0.3)", padding: 4, borderRadius: 12,
          width: "fit-content", maxWidth: "100%", marginBottom: 24,
        }}>
          {([
            { id: "empreendimentos", label: "Empreendimentos" },
            { id: "leads", label: `Leads (${todosLeads.length})` },
          ] as const).map((t) => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: "10px 20px", borderRadius: 9, border: "none",
                fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 150ms ease",
                background: tab === t.id ? "var(--terracota)" : "transparent",
                color: tab === t.id ? "white" : "var(--gray-mid)",
                boxShadow: tab === t.id ? "0 2px 12px rgba(175,111,83,0.3)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── LISTA DE EMPREENDIMENTOS ─────────────────────────── */}
        {tab === "empreendimentos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {empreendimentos.map((emp) => {
              const leadsDoEmp = todosLeads.filter(l => l.empreendimentoId === emp.slug);
              return (
              <motion.div
                key={emp.slug} layout
                style={{
                  background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                  borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-card)",
                }}
              >
                <div style={{ padding: "18px 18px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flex: 1 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "var(--terracota-glow)", border: "1px solid var(--border-active)",
                    }}>
                      <Building2 size={22} color="var(--terracota)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--gray-light)", marginBottom: 5 }}>
                        {emp.nome}
                      </h3>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 14, color: "var(--gray-mid)" }}>
                        <MapPin size={13} />
                        <span style={{ fontSize: 13 }}>{emp.cidade} · {emp.estado}</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {emp.modelos?.map((m) => (
                          <span key={m.id} style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "5px 12px", borderRadius: 8,
                            background: "rgba(175,111,83,0.12)", border: "1px solid rgba(175,111,83,0.25)",
                            fontSize: 12, fontWeight: 700, color: "var(--terracota-light)",
                          }}>
                            {m.nome}
                            <span style={{ color: "var(--gray-dark)" }}>·</span>
                            <span style={{ color: "var(--gray-mid)", fontWeight: 600 }}>
                              R$ {(m.valor / 1000).toFixed(0)}k
                            </span>
                          </span>
                        ))}
                        {(!emp.modelos || emp.modelos.length === 0) && (
                          <span style={{ fontSize: 12, color: "var(--gray-dark)" }}>Sem modelos</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => toggleStatus(emp.slug, emp.status)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 7,
                        padding: "7px 14px", borderRadius: 8, cursor: "pointer", border: "none", fontSize: 12, fontWeight: 700, transition: "all 150ms ease",
                        background: emp.status === "ativo" ? "rgba(22,163,74,0.15)" : "rgba(249,115,22,0.12)",
                        color: emp.status === "ativo" ? "#4ade80" : "#fb923c",
                      }}
                    >
                      {emp.status === "ativo" ? <><ToggleRight size={15} /> Ativo</> : <><ToggleLeft size={15} /> Inativo</>}
                    </button>
                    <button
                      onClick={() => excluirEmpreendimento(emp.slug, emp.nome)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 7,
                        padding: "9px 14px", borderRadius: 10, cursor: "pointer",
                        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                        color: "#f87171", fontSize: 13, fontWeight: 600,
                      }}
                    >
                      <Trash2 size={13} />
                      <span className="hidden sm:inline">Excluir</span>
                    </button>
                    <button
                      onClick={() => clonarEmpreendimento(emp)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 7,
                        padding: "9px 16px", borderRadius: 10, cursor: "pointer",
                        background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)",
                        color: "#93c5fd", fontSize: 13, fontWeight: 600,
                      }}
                    >
                      Clonar
                    </button>
                    <Link
                      href={`/admin/${emp.slug}`}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 7,
                        padding: "9px 18px", borderRadius: 10, background: "transparent",
                        border: "1.5px solid var(--border-active)", color: "var(--terracota)",
                        fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "all 150ms ease",
                      }}
                    >
                      <Settings size={14} /> Editar
                    </Link>
                    <Link
                      href={`/${emp.slug}`} target="_blank"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border-subtle)",
                        color: "var(--gray-mid)", textDecoration: "none", transition: "all 150ms ease", background: "transparent",
                      }}
                    >
                      <ExternalLink size={15} />
                    </Link>
                  </div>
                </div>
                {leadsDoEmp.length > 0 && (
                  <div style={{
                    padding: "12px 24px", borderTop: "1px solid var(--border-subtle)",
                    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "rgba(0,0,0,0.15)",
                  }}>
                    <Users size={14} color="var(--gray-dark)" />
                    <span style={{ fontSize: 13, color: "var(--gray-mid)" }}>
                      {leadsDoEmp.length} lead{leadsDoEmp.length !== 1 ? "s" : ""} capturado{leadsDoEmp.length !== 1 ? "s" : ""}
                    </span>
                    <ChevronRight size={13} color="var(--gray-dark)" />
                    <button
                      onClick={() => setTab("leads")}
                      style={{ fontSize: 12, color: "var(--terracota)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                    >
                      Ver leads
                    </button>
                  </div>
                )}
              </motion.div>
            )})}
            {/* Novo Empreendimento */}
            <button
              onClick={criarEmpreendimento}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                padding: "28px 24px", borderRadius: 16, border: "2px dashed var(--border-subtle)",
                background: "transparent", transition: "all 150ms ease", cursor: "pointer", width: "100%",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--terracota-glow)", border: "1px solid var(--border-active)",
              }}>
                <Plus size={18} color="var(--terracota)" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--terracota)" }}>Adicionar Novo Empreendimento</p>
                <p style={{ fontSize: 12, color: "var(--gray-dark)", marginTop: 2 }}>Cria um empreendimento em branco para edição</p>
              </div>
            </button>
          </div>
        )}

        {/* ── LEADS POR EMPREENDIMENTO ─────────────────────────── */}
        {tab === "leads" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {empreendimentos.length === 0 ? (
              <div style={{ padding: "64px 24px", borderRadius: 16, textAlign: "center", background: "rgba(0,0,0,0.2)", border: "1px dashed var(--border-subtle)" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <p style={{ fontSize: 14, color: "var(--gray-mid)" }}>Nenhum empreendimento cadastrado</p>
              </div>
            ) : (
              empreendimentos.map((emp) => {
                const leadsEmp = todosLeads
                  .filter(l => l.empreendimentoId === emp.slug)
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                
                const linkLista = `${typeof window !== "undefined" ? window.location.origin : ""}/leads/${emp.slug}`;

                return (
                  <div key={emp.slug}>
                    {/* Cabeçalho do grupo */}
                    <div style={{
                      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                      marginBottom: 14, flexWrap: "wrap", gap: 10,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "var(--terracota-glow)", border: "1px solid var(--border-active)",
                        }}>
                          <Building2 size={16} color="var(--terracota)" />
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-light)" }}>{emp.nome}</p>
                          <p style={{ fontSize: 12, color: "var(--gray-mid)" }}>
                            {leadsEmp.length} lead{leadsEmp.length !== 1 ? "s" : ""} capturado{leadsEmp.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <CopyLinkButton link={linkLista} />
                    </div>

                    {/* Lista de leads do empreendimento */}
                    {leadsEmp.length === 0 ? (
                      <div style={{
                        padding: "24px", borderRadius: 12, textAlign: "center",
                        background: "rgba(0,0,0,0.15)", border: "1px dashed var(--border-subtle)",
                      }}>
                        <p style={{ fontSize: 13, color: "var(--gray-dark)" }}>Nenhum lead ainda para este empreendimento</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {leadsEmp.map((lead, i) => (
                          <motion.div
                            key={lead.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ delay: i * 0.03 }}
                            style={{
                              padding: "14px 16px", background: "var(--bg-card)",
                              border: `1px solid ${STATUS_LEAD[lead.status as LeadStatus]?.border ?? "var(--border-subtle)"}`,
                              borderRadius: 14, display: "flex", flexDirection: "column", gap: 12,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                                <div style={{
                                  width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                  background: STATUS_LEAD[lead.status as LeadStatus]?.bg ?? "var(--terracota-glow)",
                                  border: `1px solid ${STATUS_LEAD[lead.status as LeadStatus]?.border ?? "var(--border-active)"}`,
                                  fontSize: 14, fontWeight: 800, color: STATUS_LEAD[lead.status as LeadStatus]?.cor ?? "var(--terracota)",
                                }}>
                                  {(lead.nome || "?")[0].toUpperCase()}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-light)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {lead.nome}
                                  </p>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 12, color: "var(--gray-mid)", display: "flex", alignItems: "center", gap: 4 }}>
                                      <Phone size={11} /> {lead.whatsapp}
                                    </span>
                                    {lead.modelo && (
                                      <span style={{ fontSize: 11, color: "var(--terracota-light)", fontWeight: 600, padding: "1px 8px", borderRadius: 5, background: "rgba(175,111,83,0.1)" }}>
                                        {lead.modelo}
                                      </span>
                                    )}
                                    {lead.nomeCorretor && (
                                      <span style={{ fontSize: 11, color: "#93c5fd", fontWeight: 600, padding: "1px 8px", borderRadius: 5, background: "rgba(96,165,250,0.1)" }}>
                                        {lead.nomeCorretor}
                                      </span>
                                    )}
                                    {lead.timestamp && (
                                      <span style={{ fontSize: 11, color: "var(--gray-dark)", display: "flex", alignItems: "center", gap: 3 }}>
                                        <Calendar size={11} />
                                        {new Date(lead.timestamp).toLocaleDateString("pt-BR")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <select
                                value={lead.status ?? "novo"}
                                onChange={(e) => atualizarStatusLead(lead.id, e.target.value as LeadStatus)}
                                style={{
                                  padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700, border: "none",
                                  background: STATUS_LEAD[lead.status as LeadStatus]?.bg ?? STATUS_LEAD.novo.bg,
                                  color: STATUS_LEAD[lead.status as LeadStatus]?.cor ?? STATUS_LEAD.novo.cor,
                                  outline: `1px solid ${STATUS_LEAD[lead.status as LeadStatus]?.border ?? STATUS_LEAD.novo.border}`,
                                }}
                              >
                                {Object.entries(STATUS_LEAD).map(([key, cfg]) => (
                                  <option key={key} value={key} style={{ background: "var(--green-dark)", color: "var(--gray-light)" }}>
                                    {cfg.label}
                                  </option>
                                ))}
                              </select>
                              <a
                                href={`https://wa.me/55${lead.whatsapp?.replace(/\D/g, "")}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8,
                                  background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.3)",
                                  color: "#4ade80", fontSize: 12, fontWeight: 700, textDecoration: "none",
                                }}
                              >
                                WhatsApp
                              </a>
                              <button
                                onClick={() => deletarLead(lead.id)}
                                style={{
                                  width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", cursor: "pointer",
                                }} title="Excluir lead"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}