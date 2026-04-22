"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, getDoc, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, where } from "firebase/firestore";
import {
  Building2, Settings, Users, MapPin,
  ToggleLeft, ToggleRight, Plus, ExternalLink,
  ArrowLeft, ChevronRight, Phone,
  CheckCircle2, Copy, Check, Link2, Trash2, LogOut, Flame, User as UserIcon, Share2, FolderOpen, Lock
} from "lucide-react";
import { DossieModal } from "@/components/corretor/DossieModal";
import { DocumentosConstrutorModal } from "@/components/admin/DocumentosConstrutorModal";

// ─────────────────────────────────────────────────────────
// TIPAGENS E CONSTANTES
// ─────────────────────────────────────────────────────────

const STATUS_LEAD = {
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
  corretorId?: string;
  status?: LeadStatus | string; // Permitir string para status antigos
  dossie?: any;
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

// ─────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ─────────────────────────────────────────────────────────

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
          maxWidth: "min(220px, 40vw)", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
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
          border: "none", fontSize: 12, fontWeight: 700, transition: "all 200ms ease",
          background: copiado ? "rgba(22,163,74,0.15)" : "rgba(175,111,83,0.12)",
          color: copiado ? "#4ade80" : "var(--terracota)",
        }}
      >
        {copiado ? <><Check size={13} /> Copiado!</> : <><Copy size={13} /> Copiar link</>}
      </button>
    </div>
  );
}

function CardConviteEquipe({ titulo, cargo, path }: { titulo: string, cargo: string, path: string }) {
  const [copiado, setCopiado] = useState(false);
  const [urlCompleta, setUrlCompleta] = useState("Carregando link...");

  useEffect(() => {
    setUrlCompleta(`${window.location.origin}${path}`);
  }, [path]);

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(urlCompleta);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (error) {
      console.error("Erro ao copiar link:", error);
    }
  };

  const handleCompartilhar = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Cadastro de ${titulo}`,
          text: `Faça seu cadastro como ${titulo} na plataforma Habiticon:`,
          url: urlCompleta,
        });
      } catch {
        console.log("Compartilhamento cancelado ou sem suporte");
      }
    } else {
      handleCopiar();
    }
  };

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
      borderRadius: 14, padding: "16px",
      display: "flex", flexDirection: "column", gap: 12,
      flex: "1 1 300px"
    }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-light)" }}>Convite para {titulo}</h3>
        <p style={{ fontSize: 12, color: "var(--gray-dark)", marginTop: 2 }}>Envie este link para novos {cargo}.</p>
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "rgba(0,0,0,0.3)", padding: "8px 12px",
        borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)"
      }}>
        <Link2 size={14} color="var(--terracota)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "var(--gray-mid)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
          {urlCompleta}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button
          onClick={handleCopiar}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "8px", borderRadius: 8, border: "1px solid var(--border-subtle)",
            background: copiado ? "rgba(22,163,74,0.1)" : "transparent",
            color: copiado ? "#4ade80" : "var(--gray-light)",
            fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "0.2s"
          }}
        >
          {copiado ? <Check size={14} /> : <Copy size={14} />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
        <button
          onClick={handleCompartilhar}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "8px", borderRadius: 8, border: "none",
            background: "var(--terracota-glow)", color: "var(--terracota-light)",
            fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "0.2s"
          }}
        >
          <Share2 size={14} />
          Compartilhar
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────

export default function AdminPage() {
  const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([]);
  const [todosLeads, setTodosLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"empreendimentos" | "leads">("empreendimentos");
  const [listaCorretores, setListaCorretores] = useState<{id: string, nome: string}[]>([]);
  const [filtroCorretor, setFiltroCorretor] = useState<string>("todos");
  const [leadDossieId, setLeadDossieId] = useState<string | null>(null);
  const leadDossieSelecionado = todosLeads.find(l => l.id === leadDossieId) || null;

  const [leadDocumentosId, setLeadDocumentosId] = useState<string | null>(null);
  const leadDocumentosSelecionado = todosLeads.find(l => l.id === leadDocumentosId) || null;

  const router = useRouter();

  // ── SEGURANÇA: redireciona se não for admin ──
  useEffect(() => {
    const monitorarAcesso = async () => {
      const user = auth.currentUser;
      if (!user) { router.push("/login"); return; }

      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role !== "admin") {
          router.push(userData.role === "corretor" ? "/painel-corretor" : "/painel-correspondente");
        }
      } else {
        router.push("/login");
      }
    };
    monitorarAcesso();
  }, [router]);

  // ── CARREGAMENTO DE DADOS ──
  const carregarDados = useCallback(async () => {
    try {
      const empSnapshot = await getDocs(collection(db, "empreendimentos"));
      const emps: Empreendimento[] = [];
      empSnapshot.forEach((docItem) => { emps.push(docItem.data() as Empreendimento); });
      setEmpreendimentos(emps);

      const unsubscribeLeads = onSnapshot(collection(db, "leads"), (snapshot) => {
        const leadsData: Lead[] = [];
        snapshot.forEach((docItem) => { leadsData.push({ id: docItem.id, ...docItem.data() } as Lead); });
        setTodosLeads(leadsData);
        setLoading(false);
      });

      return () => unsubscribeLeads();
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cleanup = carregarDados();
    return () => { cleanup.then(unsub => { if (unsub) unsub(); }); };
  }, [carregarDados]);

  // Listener independente para corretores
  useEffect(() => {
    const qCorretores = query(
      collection(db, "usuarios"),
      where("status", "==", "ativo"),
      where("role", "==", "corretor")
    );
    const unsub = onSnapshot(qCorretores, (snapshot) => {
      const data = snapshot.docs
        .map(d => ({ id: d.id, nome: d.data().nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setListaCorretores(data);
    }, (error) => {
      console.error("Erro ao carregar corretores:", error);
    });
    return () => unsub();
  }, []);

  // ─────────────────────────────────────────────────────────
  // FUNÇÕES DE AÇÃO
  // ─────────────────────────────────────────────────────────

  const criarEmpreendimento = useCallback(async () => {
    const slug = `novo-empreendimento-${Date.now()}`;
    const novo = {
      slug, nome: "Novo Empreendimento", cidade: "Cidade", estado: "GO",
      descricao: "", status: "ativo", coordenadas: { lat: 0, lng: 0 },
      modelos: [{ id: "modelo-1", nome: "Modelo 1", quartos: 2, area: 60, valor: 200000, valorLote: 40000, imagem: "", planta: "" }],
      simulador: {
        entradaMin: 10000, entradaMax: 100000, prazoMeses: 360,
        taxaFaixa12: 7, taxaFaixa3: 8.16, taxaFaixa3Cotista: 7.66, taxaMercado: 12,
        igpmMensal: 0.8, mesesObra: 5, cotaMaximaCaixa: 0.8,
        percentualObraPorMes: [20, 40, 55, 75, 100],
        cub: { bdi: 0.18, cubVigente: 0 }
      },
      mcmv: {
        faixas: [
          { id: 2, nome: "Faixa 2", rendaMin: 0, rendaMax: 5000, subsidioMax: 55000, subsidioMin: 0, taxa: 7, taxaCotista: 6.5, cor: "#84cc16", tetoImovel: 275000 },
          { id: 3, nome: "Faixa 3", rendaMin: 5001, rendaMax: 9600, subsidioMax: 0, subsidioMin: 0, taxa: 8.16, taxaCotista: 7.66, cor: "#fb923c", tetoImovel: 400000 },
          { id: 4, nome: "Faixa 4", rendaMin: 9601, rendaMax: 13000, subsidioMax: 0, subsidioMin: 0, taxa: 10.5, taxaCotista: 10, cor: "#f43f5e", tetoImovel: 600000 }
        ],
        tetoImovel: 275000, observacao: ""
      },
      vitrine: { imagens: [], plantas: [], ambientes: {} },
      textos: { notasLegais: "", tituloObra: "Fluxo de Obra (PCI)", descricaoObra: "", alertaF3: "", alertaF12: "" }
    };
    await setDoc(doc(db, "empreendimentos", slug), novo);
    setEmpreendimentos(prev => [...prev, novo]);
    router.push(`/admin/${slug}`);
  }, [router]);

  const excluirEmpreendimento = useCallback(async (slug: string, nome: string) => {
    if (!confirm(`Excluir "${nome}"?\n\nEsta ação é permanente.`)) return;
    try {
      await deleteDoc(doc(db, "empreendimentos", slug));
      setEmpreendimentos(prev => prev.filter(e => e.slug !== slug));
    } catch (error) {
      console.error("Erro ao excluir empreendimento:", error);
    }
  }, []);

  const clonarEmpreendimento = useCallback(async (emp: Empreendimento) => {
    const novoSlug = `clone-${emp.slug}-${Date.now()}`;
    const clone = { ...JSON.parse(JSON.stringify(emp)), slug: novoSlug, nome: `Clone — ${emp.nome}` };
    await setDoc(doc(db, "empreendimentos", novoSlug), clone);
    setEmpreendimentos(prev => [...prev, clone]);
    router.push(`/admin/${novoSlug}`);
  }, [router]);

  const fazerLogout = useCallback(async () => {
    if (!confirm("Sair do painel administrativo?")) return;
    await auth.signOut();
    window.location.href = "/login";
  }, []);

  const liberarLeadParaRoleta = async (lead: Lead) => {
    const confirmacao = confirm(
      `Liberar "${lead.nome}" para a roleta?\n\nO vínculo com ${lead.nomeCorretor || "o corretor atual"} será removido e o lead ficará disponível para toda a equipe.`
    );
    if (!confirmacao) return;
    try {
      await updateDoc(doc(db, "leads", lead.id), { status: "novo", corretorId: "", nomeCorretor: "" });
    } catch (error) {
      console.error("Erro ao liberar lead:", error);
    }
  };

  // ── ATUALIZADO: Deletar via API para garantir faxina no Storage ──
  const deletarLead = async (leadId: string) => {
    if (!confirm("Excluir este lead?\nIsso apagará permanentemente todos os dados e os arquivos do Storage. Esta ação não pode ser desfeita.")) return;
    try {
      const res = await fetch("/api/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      
      if (!res.ok) {
         throw new Error("Falha na exclusão");
      }
    } catch (error) {
      console.error("Erro ao excluir lead:", error);
      alert("Houve um erro ao tentar excluir o lead e seus arquivos.");
    }
  };

  const toggleStatus = async (slug: string, current: string) => {
    const newStatus = current === "ativo" ? "inativo" : "ativo";
    try {
      await updateDoc(doc(db, "empreendimentos", slug), { status: newStatus });
      setEmpreendimentos((prev) => prev.map((e) => (e.slug === slug ? { ...e, status: newStatus } : e)));
    } catch (error) {
      console.error(error);
    }
  };

  // ── FILTRAGEM ──
  const leadsFiltrados = useMemo(() => {
    if (filtroCorretor === "todos") return todosLeads;
    if (filtroCorretor === "roleta") return todosLeads.filter(l => !l.corretorId);
    return todosLeads.filter(l => l.corretorId === filtroCorretor);
  }, [todosLeads, filtroCorretor]);

  const ativos = empreendimentos.filter((e) => e.status === "ativo").length;
  const leadsNaRoletaCount = todosLeads.filter(l => !l.corretorId).length;

  // ─────────────────────────────────────────────────────────
  // RENDERIZAÇÃO
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>

      {/* HEADER */}
      <header style={{
        background: "rgba(15,30,22,0.98)", backdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--border-subtle)", position: "sticky", top: 0, zIndex: 40
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
                display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 100,
                background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)"
              }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#fb923c", letterSpacing: "0.1em", textTransform: "uppercase" }}>Admin</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link href="/" className="btn-ghost" style={{ fontSize: 13, color: "var(--gray-mid)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 10px" }}>
                <ExternalLink size={14} />
                <span className="hidden sm:inline">Ver site</span>
              </Link>
              <div style={{ width: 1, height: 20, background: "var(--border-subtle)" }} />
              <button
                onClick={fazerLogout}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#f87171", fontSize: 13, fontWeight: 600
                }}
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container-app" style={{ padding: "clamp(20px,4vw,40px) clamp(16px,4vw,32px) 80px" }}>

        {/* ESTATÍSTICAS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 32 }}>
          {[
            { label: "Empreendimentos", value: loading ? "…" : empreendimentos.length, icon: Building2, color: "var(--terracota)", bg: "rgba(175,111,83,0.12)", border: "rgba(175,111,83,0.25)" },
            { label: "Ativos",          value: loading ? "…" : ativos,                 icon: CheckCircle2, color: "#4ade80", bg: "rgba(22,163,74,0.1)",  border: "rgba(22,163,74,0.2)"   },
            { label: "Total Leads",     value: loading ? "…" : todosLeads.length,      icon: Users,        color: "#60a5fa", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.2)"  },
            { label: "Leads Livres",    value: loading ? "…" : leadsNaRoletaCount,     icon: Flame,        color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.2)"   },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} style={{ padding: "18px 16px 16px", background: stat.bg, border: `1px solid ${stat.border}`, borderRadius: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${stat.color}22`, border: `1px solid ${stat.color}44` }}>
                    <Icon size={18} color={stat.color} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-dark)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{stat.label}</span>
                </div>
                <div style={{ fontSize: "clamp(28px,6vw,40px)", fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
              </div>
            );
          })}
        </div>

        {/* LINKS DE CONVITE DE EQUIPE */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-light)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={18} color="var(--terracota)" />
            Links de Convite de Equipe
          </h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <CardConviteEquipe titulo="Corretor" cargo="corretores" path="/cadastro-corretor" />
            <CardConviteEquipe titulo="Correspondente Bancário" cargo="correspondentes e parceiros" path="/cadastro-correspondente" />
          </div>
        </div>

        {/* ABAS */}
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.3)", padding: 4, borderRadius: 12, width: "fit-content", maxWidth: "100%", marginBottom: 24 }}>
          {([
            { id: "empreendimentos", label: "Empreendimentos" },
            { id: "leads", label: `Visão de Vendas (${todosLeads.length})` }
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 20px", borderRadius: 9, border: "none",
                fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 150ms ease",
                background: tab === t.id ? "var(--terracota)" : "transparent",
                color: tab === t.id ? "white" : "var(--gray-mid)",
                boxShadow: tab === t.id ? "0 2px 12px rgba(175,111,83,0.3)" : "none"
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* =========================================================
            ABA 1: EMPREENDIMENTOS
            ========================================================= */}
        {tab === "empreendimentos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {empreendimentos.map((emp) => {
              const leadsDoEmp = todosLeads.filter(l => l.empreendimentoId === emp.slug);
              return (
                <motion.div
                  key={emp.slug} layout
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-card)" }}
                >
                  <div style={{ padding: "18px 18px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flex: 1 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--terracota-glow)", border: "1px solid var(--border-active)" }}>
                        <Building2 size={22} color="var(--terracota)" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--gray-light)", marginBottom: 5 }}>{emp.nome}</h3>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 14, color: "var(--gray-mid)" }}>
                          <MapPin size={13} />
                          <span style={{ fontSize: 13 }}>{emp.cidade} · {emp.estado}</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {emp.modelos?.map((m) => (
                            <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, background: "rgba(175,111,83,0.12)", border: "1px solid rgba(175,111,83,0.25)", fontSize: 12, fontWeight: 700, color: "var(--terracota-light)" }}>
                              {m.nome} <span style={{ color: "var(--gray-dark)" }}>·</span> <span style={{ color: "var(--gray-mid)", fontWeight: 600 }}>R$ {(m.valor / 1000).toFixed(0)}k</span>
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
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 8, cursor: "pointer", border: "none", fontSize: 12, fontWeight: 700, transition: "all 150ms ease", background: emp.status === "ativo" ? "rgba(22,163,74,0.15)" : "rgba(249,115,22,0.12)", color: emp.status === "ativo" ? "#4ade80" : "#fb923c" }}
                      >
                        {emp.status === "ativo" ? <><ToggleRight size={15} /> Ativo</> : <><ToggleLeft size={15} /> Inativo</>}
                      </button>
                      <button
                        onClick={() => excluirEmpreendimento(emp.slug, emp.nome)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 10, cursor: "pointer", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 13, fontWeight: 600 }}
                      >
                        <Trash2 size={13} /> <span className="hidden sm:inline">Excluir</span>
                      </button>
                      <button
                        onClick={() => clonarEmpreendimento(emp)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, cursor: "pointer", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)", color: "#93c5fd", fontSize: 13, fontWeight: 600 }}
                      >
                        Clonar
                      </button>
                      <Link
                        href={`/admin/${emp.slug}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, background: "transparent", border: "1.5px solid var(--border-active)", color: "var(--terracota)", fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "all 150ms ease" }}
                      >
                        <Settings size={14} /> Editar
                      </Link>
                      <Link
                        href={`/${emp.slug}`} target="_blank"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border-subtle)", color: "var(--gray-mid)", textDecoration: "none", transition: "all 150ms ease", background: "transparent" }}
                      >
                        <ExternalLink size={15} />
                      </Link>
                    </div>
                  </div>
                  {leadsDoEmp.length > 0 && (
                    <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "rgba(0,0,0,0.15)" }}>
                      <Users size={14} color="var(--gray-dark)" />
                      <span style={{ fontSize: 13, color: "var(--gray-mid)" }}>{leadsDoEmp.length} lead{leadsDoEmp.length !== 1 ? "s" : ""} capturado{leadsDoEmp.length !== 1 ? "s" : ""}</span>
                      <ChevronRight size={13} color="var(--gray-dark)" />
                      <button onClick={() => setTab("leads")} style={{ fontSize: 12, color: "var(--terracota)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                        Ver leads
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}

            <button
              onClick={criarEmpreendimento}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "28px 24px", borderRadius: 16, border: "2px dashed var(--border-subtle)", background: "transparent", transition: "all 150ms ease", cursor: "pointer", width: "100%" }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--terracota-glow)", border: "1px solid var(--border-active)" }}>
                <Plus size={18} color="var(--terracota)" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--terracota)" }}>Adicionar Novo Empreendimento</p>
                <p style={{ fontSize: 12, color: "var(--gray-dark)", marginTop: 2 }}>Cria um empreendimento em branco para edição</p>
              </div>
            </button>
          </div>
        )}

        {/* =========================================================
            ABA 2: VISÃO DE VENDAS
            ========================================================= */}
        {tab === "leads" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

            {/* FILTRO POR CORRETOR */}
            <div style={{ background: "var(--bg-card)", padding: "16px 20px", borderRadius: 14, border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={18} color="var(--terracota)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-light)" }}>Filtrar Atendimentos:</span>
              </div>
              <select
                value={filtroCorretor}
                onChange={(e) => setFiltroCorretor(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-active)", color: "white", fontSize: 14, outline: "none", minWidth: 200, cursor: "pointer" }}
              >
                <option value="todos">Mostrar Todos os Leads</option>
                <option value="roleta">🔥 Leads Livres (Roleta)</option>
                {listaCorretores.map(c => (
                  <option key={c.id} value={c.id}>Corretor: {c.nome}</option>
                ))}
              </select>
              <span style={{ fontSize: 13, color: "var(--gray-mid)", marginLeft: "auto" }}>
                {leadsFiltrados.length} resultado(s)
              </span>
            </div>

            {empreendimentos.length === 0 ? (
              <div style={{ padding: "64px 24px", borderRadius: 16, textAlign: "center", background: "rgba(0,0,0,0.2)", border: "1px dashed var(--border-subtle)" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <p style={{ fontSize: 14, color: "var(--gray-mid)" }}>Nenhum empreendimento cadastrado</p>
              </div>
            ) : (
              empreendimentos.map((emp) => {
                const leadsEmp = leadsFiltrados
                  .filter(l => l.empreendimentoId === emp.slug)
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                if (leadsEmp.length === 0 && filtroCorretor !== "todos") return null;

                const linkLista = `${typeof window !== "undefined" ? window.location.origin : ""}/leads/${emp.slug}`;

                return (
                  <div key={emp.slug}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--terracota-glow)", border: "1px solid var(--border-active)" }}>
                          <Building2 size={16} color="var(--terracota)" />
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-light)" }}>{emp.nome}</p>
                          <p style={{ fontSize: 12, color: "var(--gray-mid)" }}>{leadsEmp.length} lead{leadsEmp.length !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <CopyLinkButton link={linkLista} />
                    </div>

                    {leadsEmp.length === 0 ? (
                      <div style={{ padding: "24px", borderRadius: 12, textAlign: "center", background: "rgba(0,0,0,0.15)", border: "1px dashed var(--border-subtle)" }}>
                        <p style={{ fontSize: 13, color: "var(--gray-dark)" }}>Nenhum lead capturado ainda.</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {leadsEmp.map((lead, i) => {
                          const estaSolto = !lead.corretorId;
                          const temDossie = !!lead.dossie;
                          
                          // REGRA DE NEGÓCIO: Verifica se o lead já foi decidido pela mesa de crédito
                          const isAprovado = lead.status === "qualificado" || lead.status === "credito_aprovado"; 
                          const isReprovado = lead.status === "nao_qualificado" || lead.status === "credito_reprovado";
                          const isDecidido = isAprovado || isReprovado;

                          // Resolução do status para exibição correta
                          const statusAjustado = (lead.status === "credito_aprovado" ? "qualificado" : 
                                                  lead.status === "credito_reprovado" ? "nao_qualificado" : 
                                                  lead.status) ?? "em_atendimento";

                          return (
                            <motion.div
                              key={lead.id}
                              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.97 }} transition={{ delay: i * 0.03 }}
                              style={{
                                padding: "16px 20px", background: "var(--bg-card)",
                                border: estaSolto ? "1px solid rgba(239,68,68,0.5)" : `1px solid ${STATUS_LEAD[statusAjustado as LeadStatus]?.border ?? "var(--border-subtle)"}`,
                                borderRadius: 14, display: "flex", flexWrap: "wrap", gap: 16,
                                justifyContent: "space-between", alignItems: "center",
                                position: "relative", overflow: "hidden"
                              }}
                            >
                              {estaSolto && (
                                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#ef4444" }} />
                              )}

                              {/* LADO ESQUERDO */}
                              <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "1 1 min-content", minWidth: 200, paddingLeft: estaSolto ? 8 : 0 }}>
                                <div style={{
                                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  background: estaSolto ? "rgba(239,68,68,0.15)" : (STATUS_LEAD[statusAjustado as LeadStatus]?.bg ?? "var(--terracota-glow)"),
                                  border: `1px solid ${estaSolto ? "rgba(239,68,68,0.3)" : (STATUS_LEAD[statusAjustado as LeadStatus]?.border ?? "var(--border-active)")}`,
                                  fontSize: 16, fontWeight: 800,
                                  color: estaSolto ? "#ef4444" : (STATUS_LEAD[statusAjustado as LeadStatus]?.cor ?? "var(--terracota)"),
                                }}>
                                  {(lead.nome || "?")[0].toUpperCase()}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-light)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {lead.nome}
                                  </p>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 12, color: "var(--gray-mid)", display: "flex", alignItems: "center", gap: 4 }}>
                                      <Phone size={12} /> {lead.whatsapp}
                                    </span>
                                    {lead.modelo && (
                                      <span style={{ fontSize: 11, color: "var(--terracota-light)", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(175,111,83,0.1)" }}>
                                        {lead.modelo}
                                      </span>
                                    )}
                                    {estaSolto ? (
                                      <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", gap: 4 }}>
                                        <Flame size={12} /> Lead Livre
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 11, color: "#93c5fd", fontWeight: 600, padding: "1px 8px", borderRadius: 5, background: "rgba(96,165,250,0.1)", display: "flex", alignItems: "center", gap: 4 }}>
                                        <UserIcon size={12} /> {listaCorretores.find(c => c.id === lead.corretorId)?.nome || lead.nomeCorretor || "Não assumido"}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* LADO DIREITO */}
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }} className="w-full sm:w-auto justify-between sm:justify-end">
                                
                                {/* O admin só vê o status, não pode alterar. */}
                                <div
                                  title={isDecidido ? "O status está bloqueado após a análise de crédito." : "Status atual do lead"}
                                  style={{
                                    padding: "7px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6,
                                    fontSize: 12, fontWeight: 700,
                                    background: STATUS_LEAD[statusAjustado as LeadStatus]?.bg ?? STATUS_LEAD.em_atendimento.bg,
                                    color: STATUS_LEAD[statusAjustado as LeadStatus]?.cor ?? STATUS_LEAD.em_atendimento.cor,
                                    outline: `1px solid ${STATUS_LEAD[statusAjustado as LeadStatus]?.border ?? STATUS_LEAD.em_atendimento.border}`,
                                    opacity: isDecidido ? 0.7 : 1
                                  }}
                                >
                                  {STATUS_LEAD[statusAjustado as LeadStatus]?.label ?? "Em atendimento"}
                                  {isDecidido && <Lock size={12} />}
                                </div>

                                {/* Visível apenas quando o lead tem corretor e o status não está bloqueado — devolve para a roleta */}
                                {!estaSolto && !isDecidido && (
                                  <button
                                    onClick={() => liberarLeadParaRoleta(lead)}
                                    title={`Remover vínculo com ${lead.nomeCorretor || "o corretor"} e liberar para a roleta`}
                                    style={{
                                      padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                                      display: "flex", gap: 6, alignItems: "center",
                                      cursor: "pointer", transition: "all 0.2s",
                                      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171"
                                    }}
                                  >
                                    <Flame size={14} />
                                    <span className="hidden sm:inline">Liberar</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => setLeadDossieId(lead.id)}
                                  title={temDossie ? "Ver Documentos" : "Nenhum documento ainda"}
                                  style={{
                                    padding: "8px 14px", borderRadius: 8,
                                    fontSize: 13, fontWeight: 700, display: "flex", gap: 6,
                                    background: temDossie ? "rgba(255,255,255,0.1)" : "transparent",
                                    border: temDossie ? "none" : "1px dashed var(--border-subtle)",
                                    color: temDossie ? "white" : "var(--gray-mid)",
                                    cursor: "pointer", transition: "0.2s"
                                  }}
                                >
                                  <FolderOpen size={15} />
                                  <span className="hidden sm:inline">Dossiê</span>
                                </button>

                                {/* Botão Documentos da Construtora — apenas leads aprovados (qualificados) */}
                                {isAprovado && (
                                  <button
                                    onClick={() => setLeadDocumentosId(lead.id)}
                                    style={{
                                      padding: "8px 14px", borderRadius: 8,
                                      fontSize: 13, fontWeight: 700, display: "flex", gap: 6, alignItems: "center",
                                      background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)",
                                      color: "#a78bfa", cursor: "pointer"
                                    }}
                                    title="Documentos da Construtora"
                                  >
                                    <FolderOpen size={15} />
                                    <span className="hidden sm:inline">Documentos</span>
                                  </button>
                                )}

                                <a
                                  href={`https://wa.me/55${lead.whatsapp?.replace(/\D/g, "")}`}
                                  target="_blank" rel="noopener noreferrer"
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 5,
                                    padding: "8px 14px", borderRadius: 8,
                                    background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.3)",
                                    color: "#4ade80", fontSize: 13, fontWeight: 700, textDecoration: "none",
                                  }}
                                >
                                  WhatsApp
                                </a>

                                <button
                                  onClick={() => deletarLead(lead.id)}
                                  title="Excluir lead"
                                  style={{
                                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                                    color: "#f87171", cursor: "pointer",
                                  }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* DOSSIÊ FLUTUANTE — isAdmin=true dá poder total de exclusão */}
      <DossieModal
        isOpen={leadDossieId !== null}
        onClose={() => setLeadDossieId(null)}
        lead={leadDossieSelecionado}
        isAdmin={true}
      />

      {/* DOCUMENTOS DA CONSTRUTORA — apenas leads com crédito aprovado */}
      <DocumentosConstrutorModal
        isOpen={leadDocumentosId !== null}
        onClose={() => setLeadDocumentosId(null)}
        lead={leadDocumentosSelecionado}
        isAdmin={true}
      />

    </div>
  );
}