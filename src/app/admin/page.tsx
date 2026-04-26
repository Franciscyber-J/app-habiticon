"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, getDoc, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, where, arrayUnion } from "firebase/firestore";
import {
  Building2, Settings, Users, MapPin,
  ToggleLeft, ToggleRight, Plus, ExternalLink,
  ArrowLeft, ChevronRight, Phone, MessageCircle,
  CheckCircle2, Copy, Check, Link2, Trash2, LogOut, Flame, User as UserIcon, Share2, FolderOpen, Lock, FileText, UploadCloud, Info, Printer, Wallet, UserCircle, Map as MapIcon, X, Menu
} from "lucide-react";
import { DossieModal } from "@/components/corretor/DossieModal";
import { DocumentosConstrutorModal } from "@/components/admin/DocumentosConstrutorModal";
import { MapaInterativo } from "@/components/mapa/MapaInterativo";
import { DashboardFinanceiro } from "@/components/admin/DashboardFinanceiro";
import { GestaoComissoes } from "@/components/admin/GestaoComissoes";
import { GestaoRecebiveis } from "@/components/admin/GestaoRecebiveis";
import { GeradorContratoModal } from "@/components/admin/GeradorContratoModal";

// ── IMPORTAÇÕES NOVAS (FRAGMENTAÇÃO DO LAYOUT) ──
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AbaEmpreendimentos } from "@/components/admin/AbaEmpreendimentos";

// ─────────────────────────────────────────────────────────
// TIPAGENS E CONSTANTES
// ─────────────────────────────────────────────────────────

const STATUS_LEAD = {
  em_atendimento: { label: "Em atendimento", cor: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)" },
  qualificado: { label: "Qualificado", cor: "#4ade80", bg: "rgba(74,222,128,0.12)", border: "rgba(74,222,128,0.3)" },
  nao_qualificado: { label: "Não qualificado", cor: "#6b7280", bg: "rgba(107,114,128,0.12)", border: "rgba(107,114,128,0.3)" },
} as const;

type LeadStatus = keyof typeof STATUS_LEAD;

interface Lead {
  id: string;
  empreendimentoId: string;
  empreendimentoNome?: string;
  nome: string;
  whatsapp: string;
  whatsapp2?: string;
  timestamp: string;
  modelo?: string;
  valorImovel?: number;
  loteReserva?: { valorVenda: number; numero?: string; [key: string]: any };
  nomeCorretor?: string;
  corretorId?: string;
  status?: LeadStatus | string;
  dossie?: any;
  documentosConstrutora?: any;
  propostaUrl?: string;
}

interface DocumentoPadrao {
  url: string;
  nomeOriginal: string;
  dataUpload: string;
}

interface Empreendimento {
  slug: string;
  nome: string;
  cidade: string;
  estado: string;
  status: string;
  mapaUrl?: string;
  modelos: { id: string; nome: string; valor: number; area?: number }[];
  leads?: Lead[];
  documentosPadrao?: DocumentoPadrao[];
}

// ─────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES (Mantidos conforme original)
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
      <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--gray-dark)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-subtle)", maxWidth: "min(220px, 40vw)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <Link2 size={11} /> {link.replace(/^https?:\/\//, "")}
      </a>
      <button onClick={copiar} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, cursor: "pointer", border: "none", fontSize: 12, fontWeight: 700, transition: "all 200ms ease", background: copiado ? "rgba(22,163,74,0.15)" : "rgba(175,111,83,0.12)", color: copiado ? "#4ade80" : "var(--terracota)" }}>
        {copiado ? <><Check size={13} /> Copiado!</> : <><Copy size={13} /> Copiar link</>}
      </button>
    </div>
  );
}

function CardConviteEquipe({ titulo, cargo, path }: { titulo: string, cargo: string, path: string }) {
  const [copiado, setCopiado] = useState(false);
  const [urlCompleta, setUrlCompleta] = useState("Carregando link...");
  useEffect(() => { setUrlCompleta(`${window.location.origin}${path}`); }, [path]);

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(urlCompleta);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (error) { console.error("Erro ao copiar link:", error); }
  };

  const handleCompartilhar = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `Cadastro de ${titulo}`, text: `Faça seu cadastro como ${titulo} na plataforma Habiticon:`, url: urlCompleta });
      } catch { console.log("Compartilhamento cancelado ou sem suporte"); }
    } else { handleCopiar(); }
  };

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", gap: 12, flex: "1 1 300px" }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-light)" }}>Convite para {titulo}</h3>
        <p style={{ fontSize: 12, color: "var(--gray-dark)", marginTop: 2 }}>Envie este link para novos {cargo}.</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.3)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
        <Link2 size={14} color="var(--terracota)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "var(--gray-mid)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{urlCompleta}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button onClick={handleCopiar} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: copiado ? "rgba(22,163,74,0.1)" : "transparent", color: copiado ? "#4ade80" : "var(--gray-light)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "0.2s" }}>
          {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? "Copiado" : "Copiar"}
        </button>
        <button onClick={handleCompartilhar} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", borderRadius: 8, border: "none", background: "var(--terracota-glow)", color: "var(--terracota-light)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "0.2s" }}>
          <Share2 size={14} /> Compartilhar
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL (ORQUESTRAÇÃO E ESTADOS)
// ─────────────────────────────────────────────────────────

export default function AdminPage() {
  const [verificandoAuth, setVerificandoAuth] = useState(true);
  const [authVerificado, setAuthVerificado] = useState(false);
  const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([]);
  const [todosLeads, setTodosLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ── ESTADOS DE NAVEGAÇÃO DA SIDEBAR ──
  const [tab, setTab] = useState<"empreendimentos" | "leads" | "financeiro" | "equipe" | "recebiveis" | "arquivos">("empreendimentos");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [listaCorretores, setListaCorretores] = useState<any[]>([]);
  const [filtroCorretor, setFiltroCorretor] = useState<string>("todos");

  const [leadDossieId, setLeadDossieId] = useState<string | null>(null);
  const leadDossieSelecionado = todosLeads.find(l => l.id === leadDossieId) || null;

  const [leadDocumentosId, setLeadDocumentosId] = useState<string | null>(null);
  const leadDocumentosSelecionado = todosLeads.find(l => l.id === leadDocumentosId) || null;

  const [uploadingGeral, setUploadingGeral] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isPrinting, setIsPrinting] = useState(false);

  // Estados do Mapa de Lotes 
  const [mapaVisaoGeral, setMapaVisaoGeral] = useState<{ aberto: boolean, empreendimento: Empreendimento | null }>({ aberto: false, empreendimento: null });
  const [mapaReserva, setMapaReserva] = useState<{ aberto: boolean, lead: Lead | null, emp: Empreendimento | null }>({ aberto: false, lead: null, emp: null });
  const [lotesVisaoGeral, setLotesVisaoGeral] = useState<any[]>([]);
  const [loadingVisaoGeral, setLoadingVisaoGeral] = useState(false);
  const [loteDetalhe, setLoteDetalhe] = useState<any | null>(null);
  
  const [loteReservaModal, setLoteReservaModal] = useState<any | null>(null);
  const [formReserva, setFormReserva] = useState({ modeloId: "", valor: 0 });

  // ESTADOS DA VENDA DIRETA
  const [modalVendaDireta, setModalVendaDireta] = useState(false);
  const [novaVenda, setNovaVenda] = useState({ nome: "", whatsapp: "", empreendimentoId: "" });
  const [leadParaContrato, setLeadParaContrato] = useState<any | null>(null);

  const router = useRouter();

  // ── SEGURANÇA ──
  useEffect(() => {
    let cancelled = false;
    auth.authStateReady().then(() => {
      const unsubAuth = onAuthStateChanged(auth, async (user) => {
        if (cancelled) return;
        if (!user) { router.replace("/login"); setVerificandoAuth(false); return; }
        try {
          if (user.email === "contax002@gmail.com") { setAuthVerificado(true); setVerificandoAuth(false); return; }
          const userDoc = await getDoc(doc(db, "usuarios", user.uid));
          if (cancelled) return;
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role !== "admin") { router.replace(userData.role === "corretor" ? "/painel-corretor" : "/painel-correspondente"); return; }
            setAuthVerificado(true);
          } else { router.replace("/login"); }
        } catch (error) { router.replace("/login"); } finally { if (!cancelled) setVerificandoAuth(false); }
      });
      return () => { cancelled = true; unsubAuth(); };
    });
    return () => { cancelled = true; };
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
    } catch (error) { console.error("Erro ao carregar dados:", error); setLoading(false); }
  }, []);

  useEffect(() => {
    if (!authVerificado) return;
    const cleanup = carregarDados();
    return () => { cleanup.then(unsub => { if (unsub) unsub(); }); };
  }, [carregarDados, authVerificado]);

  useEffect(() => {
    if (!authVerificado) return;
    const qCorretores = query(collection(db, "usuarios"), where("status", "==", "ativo"), where("role", "==", "corretor"));
    const unsub = onSnapshot(qCorretores, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setListaCorretores(data);
    }, (error) => console.error("Erro ao carregar corretores:", error));
    return () => unsub();
  }, [authVerificado]);

  // ─────────────────────────────────────────────────────────
  // FUNÇÕES DE AÇÃO 
  // ─────────────────────────────────────────────────────────

  const criarEmpreendimento = useCallback(async () => {
    const slug = `novo-empreendimento-${Date.now()}`;
    const novo = {
      slug, nome: "Novo Empreendimento", cidade: "Cidade", estado: "GO",
      descricao: "", status: "ativo", coordenadas: { lat: 0, lng: 0 },
      modelos: [{ id: "modelo-1", nome: "Modelo 1", quartos: 2, area: 60, valor: 200000, valorLote: 40000, imagem: "", planta: "" }],
      simulador: { entradaMin: 10000, entradaMax: 100000, prazoMeses: 360, taxaFaixa12: 7, taxaFaixa3: 8.16, taxaFaixa3Cotista: 7.66, taxaMercado: 12, igpmMensal: 0.8, mesesObra: 5, cotaMaximaCaixa: 0.8, percentualObraPorMes: [20, 40, 55, 75, 100], cub: { bdi: 0.18, cubVigente: 0 } },
      mcmv: { faixas: [ { id: 2, nome: "Faixa 2", rendaMin: 0, rendaMax: 5000, subsidioMax: 55000, subsidioMin: 0, taxa: 7, taxaCotista: 6.5, cor: "#84cc16", tetoImovel: 275000 }, { id: 3, nome: "Faixa 3", rendaMin: 5001, rendaMax: 9600, subsidioMax: 0, subsidioMin: 0, taxa: 8.16, taxaCotista: 7.66, cor: "#fb923c", tetoImovel: 400000 }, { id: 4, nome: "Faixa 4", rendaMin: 9601, rendaMax: 13000, subsidioMax: 0, subsidioMin: 0, taxa: 10.5, taxaCotista: 10, cor: "#f43f5e", tetoImovel: 600000 } ], tetoImovel: 275000, observacao: "" },
      vitrine: { imagens: [], plantas: [], ambientes: {} },
      textos: { notasLegais: "", tituloObra: "Fluxo de Obra (PCI)", descricaoObra: "", alertaF3: "", alertaF12: "" },
      documentosPadrao: []
    };
    await setDoc(doc(db, "empreendimentos", slug), novo);
    setEmpreendimentos(prev => [...prev, novo]);
    router.push(`/admin/${slug}`);
  }, [router]);

  const excluirEmpreendimento = useCallback(async (slug: string, nome: string) => {
    if (!confirm(`Excluir "${nome}"?\n\nEsta ação é permanente.`)) return;
    try { await deleteDoc(doc(db, "empreendimentos", slug)); setEmpreendimentos(prev => prev.filter(e => e.slug !== slug)); } catch (error) { console.error(error); }
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
    if (!confirm(`Liberar "${lead.nome}" para a roleta?\n\nO vínculo com ${lead.nomeCorretor || "o corretor atual"} será removido.`)) return;
    try { await updateDoc(doc(db, "leads", lead.id), { status: "novo", corretorId: "", nomeCorretor: "" }); } catch (error) { console.error(error); }
  };

  const deletarLead = async (leadId: string) => {
    if (!confirm("Excluir este lead?\nIsso apagará permanentemente todos os dados.")) return;
    try {
      const leadSnap = await getDoc(doc(db, "leads", leadId));
      const leadData = leadSnap.data();
      if (leadData?.loteReserva?.quadraId && leadData?.loteReserva?.loteId && leadData?.empreendimentoId) {
        const loteRef = doc(db, "empreendimentos", leadData.empreendimentoId, "quadras", leadData.loteReserva.quadraId, "lotes", leadData.loteReserva.loteId);
        const loteSnap = await getDoc(loteRef);
        if (loteSnap.exists()) {
          const filaAtual = loteSnap.data().fila || [];
          const novaFila = filaAtual.filter((f: any) => f.leadId !== leadId);
          await updateDoc(loteRef, { fila: novaFila, status: novaFila.length === 0 ? "disponivel" : "vinculado" });
        }
      }
      await deleteDoc(doc(db, "leads", leadId));
      fetch("/api/leads", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId }) }).catch(() => {});
    } catch (error) { alert("Houve um erro ao excluir o lead."); }
  };

  const toggleStatus = async (slug: string, current: string) => {
    const newStatus = current === "ativo" ? "inativo" : "ativo";
    try { await updateDoc(doc(db, "empreendimentos", slug), { status: newStatus }); setEmpreendimentos((prev) => prev.map((e) => (e.slug === slug ? { ...e, status: newStatus } : e))); } catch (error) { console.error(error); }
  };

  const handleUploadDocumentoPadrao = async (e: React.ChangeEvent<HTMLInputElement>, empSlug: string) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingGeral(true);
    try {
      let listaAtual = [...(empreendimentos.find(e => e.slug === empSlug)?.documentosPadrao || [])];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file); fd.append("slug", empSlug); fd.append("tipo", "docs_padrao"); fd.append("titulo", file.name);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.url) listaAtual.push({ url: data.url, nomeOriginal: file.name, dataUpload: new Date().toISOString() });
      }
      await updateDoc(doc(db, "empreendimentos", empSlug), { documentosPadrao: listaAtual });
      setEmpreendimentos((prev) => prev.map((e) => (e.slug === empSlug ? { ...e, documentosPadrao: listaAtual } : e)));
    } catch (error) { alert("Falha no upload do arquivo."); } finally { setUploadingGeral(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const deletarDocumentoPadrao = async (url: string, empSlug: string) => {
    if (!confirm("Deletar este arquivo padrão?")) return;
    try {
      await fetch("/api/upload", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: empSlug, url, tipo: "docs_padrao" }) });
      const listaAtual = empreendimentos.find(e => e.slug === empSlug)?.documentosPadrao || [];
      const novaLista = listaAtual.filter(d => d.url !== url);
      await updateDoc(doc(db, "empreendimentos", empSlug), { documentosPadrao: novaLista });
      setEmpreendimentos((prev) => prev.map((e) => (e.slug === empSlug ? { ...e, documentosPadrao: novaLista } : e)));
    } catch (error) { alert("Falha ao deletar arquivo."); }
  };

  const abrirVisaoGeralMapa = async (emp: Empreendimento) => {
    if (!emp.mapaUrl) return alert("Este empreendimento ainda não tem um mapa SVG configurado.");
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
              const loteTratado = { id: docLote.id, quadraId: docQuadra.id, ...data, status: quadraBloqueada ? "bloqueado" : data.status };
              if (index >= 0) lotesTemp[index] = loteTratado; else lotesTemp.push(loteTratado);
            });
            setLotesVisaoGeral([...lotesTemp]); resolve();
          });
        });
      });
      Promise.all(promises).then(() => setLoadingVisaoGeral(false));
    });
  };

  const iniciarReservaMapa = async (lead: Lead) => {
    const emp = empreendimentos.find(e => e.slug === lead.empreendimentoId);
    if (!emp) return alert("Empreendimento não encontrado.");
    if (!emp.mapaUrl) return alert("Este empreendimento ainda não tem um mapa SVG configurado.");
    setMapaReserva({ aberto: true, lead, emp });
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
              const loteTratado = { id: docLote.id, quadraId: docQuadra.id, ...data, status: quadraBloqueada ? "bloqueado" : data.status };
              if (index >= 0) lotesTemp[index] = loteTratado; else lotesTemp.push(loteTratado);
            });
            setLotesVisaoGeral([...lotesTemp]); resolve();
          });
        });
      });
      Promise.all(promises).then(() => setLoadingVisaoGeral(false));
    });
  };

  const confirmarReservaLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapaReserva.lead || !mapaReserva.emp || !loteReservaModal) return;
    const modeloSelecionado = mapaReserva.emp.modelos.find(m => m.id === formReserva.modeloId);
    if (!modeloSelecionado) return alert("Selecione um modelo da casa.");
    if (formReserva.valor <= 0) return alert("Indique o valor fechado.");
    setUploadingGeral(true);
    try {
        await updateDoc(doc(db, "leads", mapaReserva.lead.id), {
            modelo: modeloSelecionado.nome, valorImovel: formReserva.valor,
            loteReserva: { numero: loteReservaModal.numero || loteReservaModal.id, quadraId: loteReservaModal.quadraId, loteId: loteReservaModal.id, valorVenda: formReserva.valor },
            status: "qualificado"
        });
        const loteRef = doc(db, "empreendimentos", mapaReserva.emp.slug, "quadras", loteReservaModal.quadraId, "lotes", loteReservaModal.id);
        await updateDoc(loteRef, {
            status: "vendido",
            fila: arrayUnion({ leadId: mapaReserva.lead.id, nomeCliente: mapaReserva.lead.nome, nomeCorretor: "Venda Direta (House)", modeloCasa: modeloSelecionado.nome, valorVenda: formReserva.valor, timestamp: new Date().toISOString() })
        });
        alert("Lote vinculado e Venda aprovada com sucesso! O cliente já consta na aba de Recebíveis.");
        setLoteReservaModal(null); setMapaReserva({ aberto: false, lead: null, emp: null });
    } catch (error) { alert("Erro ao gravar vínculo."); } finally { setUploadingGeral(false); }
  };

  const handleCriarVendaDireta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaVenda.nome || !novaVenda.whatsapp || !novaVenda.empreendimentoId) return alert("Preencha todos os campos.");
    setUploadingGeral(true);
    try {
      const emp = empreendimentos.find(e => e.slug === novaVenda.empreendimentoId);
      const novoId = `lead_int_${Date.now()}`;
      await setDoc(doc(db, "leads", novoId), {
        nome: novaVenda.nome, whatsapp: novaVenda.whatsapp, empreendimentoId: novaVenda.empreendimentoId,
        empreendimentoNome: emp?.nome || "", corretorId: "interno", nomeCorretor: "Venda Direta (House)",
        status: "em_atendimento", timestamp: new Date().toISOString(), origem: "painel_admin"
      });
      setModalVendaDireta(false); setNovaVenda({ nome: "", whatsapp: "", empreendimentoId: "" });
    } catch (err) { alert("Erro ao registrar cliente."); } finally { setUploadingGeral(false); }
  };

  const leadsFiltrados = useMemo(() => {
    if (filtroCorretor === "todos") return todosLeads;
    if (filtroCorretor === "roleta") return todosLeads.filter(l => !l.corretorId);
    if (filtroCorretor === "interno") return todosLeads.filter(l => l.corretorId === "interno");
    return todosLeads.filter(l => l.corretorId === filtroCorretor);
  }, [todosLeads, filtroCorretor]);

  const ativos = empreendimentos.filter((e) => e.status === "ativo").length;
  const leadsNaRoletaCount = todosLeads.filter(l => !l.corretorId).length;

  const handlePrint = () => { setIsPrinting(true); setTimeout(() => { window.print(); setIsPrinting(false); }, 400); };

  if (isPrinting) {
    return (
      <div style={{ background: "white", color: "black", padding: "40px", minHeight: "100vh", fontFamily: "sans-serif" }}>
        <style dangerouslySetInnerHTML={{ __html: `@media print { @page { margin: 15mm; size: landscape; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}} />
        <div style={{ borderBottom: "2px solid #111", paddingBottom: 16, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "#111" }}>Relatório de Vendas — Habiticon</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#444" }}><strong>Filtro Aplicado:</strong> {filtroCorretor === "todos" ? "Todos os Corretores" : filtroCorretor === "roleta" ? "Leads Livres (Roleta)" : filtroCorretor === "interno" ? "Vendas Diretas (House)" : listaCorretores.find(c => c.id === filtroCorretor)?.nome}</p>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#666" }}>
            <p style={{ margin: 0 }}><strong>Total de Registos:</strong> {leadsFiltrados.length}</p>
            <p style={{ margin: "2px 0 0 0" }}>Emitido em {new Date().toLocaleString("pt-BR")}</p>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", border: "1px solid #ddd" }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid #ccc", textAlign: "left" }}>Data</th>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid #ccc", textAlign: "left" }}>Cliente</th>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid #ccc", textAlign: "left" }}>Telefone</th>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid #ccc", textAlign: "left" }}>Empreendimento</th>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid #ccc", textAlign: "left" }}>Modelo</th>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid #ccc", textAlign: "left" }}>Corretor Responsável</th>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid #ccc", textAlign: "left" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {leadsFiltrados.map((lead, idx) => (
              <tr key={lead.id} style={{ background: idx % 2 === 0 ? "white" : "#fafafa", borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px" }}>{new Date(lead.timestamp).toLocaleDateString("pt-BR")}</td>
                <td style={{ padding: "8px", fontWeight: "bold" }}>{lead.nome}</td>
                <td style={{ padding: "8px" }}>{lead.whatsapp} {lead.whatsapp2 ? ` / ${lead.whatsapp2}` : ""}</td>
                <td style={{ padding: "8px" }}>{lead.empreendimentoNome || "-"}</td>
                <td style={{ padding: "8px" }}>{lead.modelo || "-"}</td>
                <td style={{ padding: "8px" }}>{lead.corretorId === "interno" ? "Venda Direta" : lead.corretorId ? lead.nomeCorretor : "Não assumido"}</td>
                <td style={{ padding: "8px", textTransform: "capitalize" }}>{(lead.status === "credito_aprovado" ? "Qualificado" : lead.status === "credito_reprovado" ? "Não Qualificado" : lead.status)?.replace(/_/g, " ") || "Novo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (verificandoAuth) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <div style={{ color: "var(--terracota)", fontWeight: 700, animation: "pulse 2s infinite" }}>Verificando acessos...</div>
      </div>
    );
  }

  if (!authVerificado) return null;

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-base)" }}>
      
      {/* SIDEBAR REAPROVEITADA */}
      <AdminSidebar 
        tab={tab} 
        setTab={setTab} 
        fazerLogout={fazerLogout} 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        todosLeadsCount={todosLeads.length} 
      />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        
        {/* CABEÇALHO MOBILE BLINDADO DENTRO DO CONTEÚDO */}
        <div className="lg:hidden">
          <header style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px", background: "rgba(15,30,22,0.98)",
            borderBottom: "1px solid var(--border-subtle)",
            position: "sticky", top: 0, zIndex: 30,
          }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)",
              cursor: "pointer", color: "var(--gray-light)",
            }}>
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <Image src="/logo.png" alt="Habiticon" width={140} height={40} style={{ height: 36, width: "auto" }} priority />
            <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#fb923c", textTransform: "uppercase", letterSpacing: "0.08em" }}>Admin</span>
          </header>
        </div>

        <main style={{ padding: "clamp(20px,4vw,40px) clamp(16px,4vw,32px) 80px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>

          {/* ESTATÍSTICAS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 32 }}>
            {[
              { label: "Empreendimentos", value: loading ? "…" : empreendimentos.length, icon: Building2, color: "var(--terracota)", bg: "rgba(175,111,83,0.12)", border: "rgba(175,111,83,0.25)" },
              { label: "Ativos", value: loading ? "…" : ativos, icon: CheckCircle2, color: "#4ade80", bg: "rgba(22,163,74,0.1)", border: "rgba(22,163,74,0.2)" },
              { label: "Total Leads", value: loading ? "…" : todosLeads.length, icon: Users, color: "#60a5fa", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)" },
              { label: "Leads Livres", value: loading ? "…" : leadsNaRoletaCount, icon: Flame, color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" },
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

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              
              {tab === "empreendimentos" && (
                <>
                  {/* LINKS DE CONVITE (Apenas nesta aba) */}
                  <div style={{ marginBottom: 40 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-light)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                      <Users size={18} color="var(--terracota)" /> Links de Convite de Equipe
                    </h2>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <CardConviteEquipe titulo="Corretor" cargo="corretores" path="/cadastro-corretor" />
                      <CardConviteEquipe titulo="Correspondente Bancário" cargo="correspondentes e parceiros" path="/cadastro-correspondente" />
                      <CardConviteEquipe titulo="Coordenador de Vendas" cargo="coordenadores" path="/cadastro-coordenador" />
                    </div>
                  </div>

                  {/* ABA FRAGMENTADA INJETADA */}
                  <AbaEmpreendimentos 
                    empreendimentos={empreendimentos}
                    todosLeads={todosLeads}
                    abrirVisaoGeralMapa={abrirVisaoGeralMapa}
                    toggleStatus={toggleStatus}
                    excluirEmpreendimento={excluirEmpreendimento}
                    clonarEmpreendimento={clonarEmpreendimento}
                    setTab={setTab}
                    criarEmpreendimento={criarEmpreendimento}
                  />
                </>
              )}

              {/* ABA: VISÃO DE VENDAS */}
              {tab === "leads" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                  <div style={{ background: "var(--bg-card)", padding: "16px 20px", borderRadius: 14, border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Users size={18} color="var(--terracota)" />
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-light)" }}>Filtrar Atendimentos:</span>
                      </div>
                      <select value={filtroCorretor} onChange={(e) => setFiltroCorretor(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-active)", color: "white", fontSize: 14, outline: "none", minWidth: 200, cursor: "pointer" }}>
                        <option value="todos">Mostrar Todos os Leads</option>
                        <option value="roleta">🔥 Leads Livres (Roleta)</option>
                        <option value="interno">🏢 Vendas Diretas (House)</option>
                        {listaCorretores.map(c => <option key={c.id} value={c.id}>Corretor: {c.nome}</option>)}
                      </select>
                      <span style={{ fontSize: 13, color: "var(--gray-mid)" }}>{leadsFiltrados.length} resultado(s)</span>
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={() => setModalVendaDireta(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "rgba(168,85,247,0.15)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        <Plus size={16} /> Nova Venda Direta
                      </button>
                      <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "var(--terracota-glow)", color: "var(--terracota-light)", border: "1px solid var(--border-active)", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        <Printer size={16} /> Relatório PDF
                      </button>
                    </div>
                  </div>

                  {empreendimentos.length === 0 ? (
                    <div style={{ padding: "64px 24px", borderRadius: 16, textAlign: "center", background: "rgba(0,0,0,0.2)", border: "1px dashed var(--border-subtle)" }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                      <p style={{ fontSize: 14, color: "var(--gray-mid)" }}>Nenhum empreendimento cadastrado</p>
                    </div>
                  ) : (
                    empreendimentos.map((emp) => {
                      const leadsEmp = leadsFiltrados.filter(l => l.empreendimentoId === emp.slug).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
                              <button onClick={() => abrirVisaoGeralMapa(emp)} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 11, fontWeight: 700, color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
                                <MapIcon size={12} /> Ver Mapa
                              </button>
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
                                const isInterno = lead.corretorId === "interno";
                                const estaSolto = !lead.corretorId && !isInterno;
                                const temDossie = !!lead.dossie;
                                const isAprovado = lead.status === "qualificado" || lead.status === "credito_aprovado";
                                const isReprovado = lead.status === "nao_qualificado" || lead.status === "credito_reprovado";
                                const isDecidido = isAprovado || isReprovado;
                                const statusAjustado = (lead.status === "credito_aprovado" ? "qualificado" : lead.status === "credito_reprovado" ? "nao_qualificado" : lead.status) ?? "em_atendimento";

                                return (
                                  <motion.div key={lead.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ delay: i * 0.03 }} style={{ padding: "16px 20px", background: "var(--bg-card)", border: estaSolto ? "1px solid rgba(239,68,68,0.5)" : `1px solid ${STATUS_LEAD[statusAjustado as LeadStatus]?.border ?? "var(--border-subtle)"}`, borderRadius: 14, display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "center", position: "relative", overflow: "hidden" }}>
                                    {estaSolto && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#ef4444" }} />}
                                    
                                    {/* LADO ESQUERDO */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "1 1 min-content", minWidth: 200, paddingLeft: estaSolto ? 8 : 0 }}>
                                      <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: estaSolto ? "rgba(239,68,68,0.15)" : (STATUS_LEAD[statusAjustado as LeadStatus]?.bg ?? "var(--terracota-glow)"), border: `1px solid ${estaSolto ? "rgba(239,68,68,0.3)" : (STATUS_LEAD[statusAjustado as LeadStatus]?.border ?? "var(--border-active)")}`, fontSize: 16, fontWeight: 800, color: estaSolto ? "#ef4444" : (STATUS_LEAD[statusAjustado as LeadStatus]?.cor ?? "var(--terracota)") }}>
                                        {(lead.nome || "?")[0].toUpperCase()}
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-light)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.nome}</p>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                          <span style={{ fontSize: 12, color: "var(--gray-mid)", display: "flex", alignItems: "center", gap: 4 }}>
                                            <Phone size={12} /> {lead.whatsapp}
                                            {lead.whatsapp2 && <><span style={{ margin: "0 4px", color: "var(--border-subtle)" }}>|</span><Phone size={12} /> {lead.whatsapp2}</>}
                                          </span>
                                          {lead.modelo && <span style={{ fontSize: 11, color: "var(--terracota-light)", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(175,111,83,0.1)" }}>{lead.modelo}</span>}
                                          {isInterno ? (
                                            <span style={{ fontSize: 11, color: "#c084fc", fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(168,85,247,0.15)", display: "flex", alignItems: "center", gap: 4 }}><Building2 size={12} /> Venda Direta</span>
                                          ) : estaSolto ? (
                                            <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", gap: 4 }}><Flame size={12} /> Lead Livre</span>
                                          ) : (
                                            <span style={{ fontSize: 11, color: "#93c5fd", fontWeight: 600, padding: "1px 8px", borderRadius: 5, background: "rgba(96,165,250,0.1)", display: "flex", alignItems: "center", gap: 4 }}><UserIcon size={12} /> {listaCorretores.find(c => c.id === lead.corretorId)?.nome || lead.nomeCorretor || "Não assumido"}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* LADO DIREITO */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }} className="w-full sm:w-auto justify-between sm:justify-end">
                                      <div title={isDecidido ? "O status está bloqueado após a análise de crédito." : "Status atual do lead"} style={{ padding: "7px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, background: STATUS_LEAD[statusAjustado as LeadStatus]?.bg ?? STATUS_LEAD.em_atendimento.bg, color: STATUS_LEAD[statusAjustado as LeadStatus]?.cor ?? STATUS_LEAD.em_atendimento.cor, outline: `1px solid ${STATUS_LEAD[statusAjustado as LeadStatus]?.border ?? STATUS_LEAD.em_atendimento.border}`, opacity: isDecidido ? 0.7 : 1 }}>
                                        {STATUS_LEAD[statusAjustado as LeadStatus]?.label ?? "Em atendimento"}
                                        {isDecidido && <Lock size={12} />}
                                      </div>
                                      {isInterno && !lead.loteReserva?.numero && !isDecidido && (
                                        <button onClick={() => iniciarReservaMapa(lead)} title="Vincular Lote via Mapa" style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", cursor: "pointer", transition: "all 0.2s", background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#c084fc" }}>
                                          <MapIcon size={15} /> <span className="hidden sm:inline">Vincular Lote</span>
                                        </button>
                                      )}
                                      {!estaSolto && !isInterno && !isDecidido && (
                                        <button onClick={() => liberarLeadParaRoleta(lead)} title={`Remover vínculo com ${lead.nomeCorretor || "o corretor"} e liberar para a roleta`} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", cursor: "pointer", transition: "all 0.2s", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                                          <Flame size={14} /> <span className="hidden sm:inline">Liberar</span>
                                        </button>
                                      )}
                                      <button onClick={() => setLeadDossieId(lead.id)} title={temDossie ? "Ver Documentos" : "Nenhum documento ainda"} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "flex", gap: 6, background: temDossie ? "rgba(255,255,255,0.1)" : "transparent", border: temDossie ? "none" : "1px dashed var(--border-subtle)", color: temDossie ? "white" : "var(--gray-mid)", cursor: "pointer", transition: "0.2s" }}>
                                        <FolderOpen size={15} /> <span className="hidden sm:inline">Dossiê</span>
                                      </button>
                                      {lead.propostaUrl && (
                                        <a href={lead.propostaUrl} target="_blank" rel="noopener noreferrer" title="Ver Simulação Guardada" style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "flex", gap: 6, background: "rgba(56,189,248,0.1)", border: "1px dashed rgba(56,189,248,0.3)", color: "#38bdf8", cursor: "pointer", transition: "0.2s", textDecoration: "none" }}>
                                          <FileText size={15} /> <span className="hidden sm:inline">Simulação</span>
                                        </a>
                                      )}
                                      {isAprovado && (
                                        <button onClick={() => setLeadDocumentosId(lead.id)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", cursor: "pointer" }} title="Documentos da Construtora">
                                          <FolderOpen size={15} /> <span className="hidden sm:inline">Documentos</span>
                                        </button>
                                      )}
                                      <div style={{ display: "flex", gap: 6 }}>
                                        <a href={`https://wa.me/55${lead.whatsapp?.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.3)", color: "#4ade80", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                                          <MessageCircle size={15} /> WhatsApp
                                        </a>
                                        {lead.whatsapp2 && lead.whatsapp2.replace(/\D/g, "").length >= 10 && (
                                          <a href={`https://wa.me/55${lead.whatsapp2?.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.3)", color: "#4ade80", fontSize: 13, fontWeight: 700, textDecoration: "none" }} title="Chamar no WhatsApp Secundário">
                                            <MessageCircle size={15} /> Whats 2
                                          </a>
                                        )}
                                      </div>
                                      <button onClick={() => deletarLead(lead.id)} title="Excluir lead" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", cursor: "pointer" }}>
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

              {/* ABA: FINANCEIRO */}
              {tab === "financeiro" && <DashboardFinanceiro leads={todosLeads} empreendimentos={empreendimentos} />}

              {/* ABA: EQUIPE */}
              {tab === "equipe" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <GestaoComissoes leads={todosLeads} empreendimentos={empreendimentos} corretores={listaCorretores} />
                  <div style={{ background: "rgba(167,139,250,0.08)", padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <Wallet size={18} color="#a78bfa" style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.5 }}>Aqui você visualiza os dados cadastrais e financeiros (PIX/Bancários) que os corretores preencheram nos seus painéis.</p>
                  </div>
                  {listaCorretores.length === 0 ? (
                    <div style={{ padding: "64px 24px", borderRadius: 16, textAlign: "center", background: "rgba(0,0,0,0.2)", border: "1px dashed var(--border-subtle)" }}>
                      <p style={{ fontSize: 14, color: "var(--gray-mid)" }}>Nenhum corretor na equipa.</p>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                      {listaCorretores.map((corretor) => (
                        <div key={corretor.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
                          <div style={{ padding: "20px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.15)", display: "flex", gap: 14, alignItems: "center" }}>
                            <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(167,139,250,0.15)", color: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, border: "1px solid rgba(167,139,250,0.3)" }}>
                              {(corretor.nome || "?")[0].toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <h3 style={{ fontSize: 16, fontWeight: 700, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{corretor.nome}</h3>
                              <p style={{ fontSize: 12, color: "var(--gray-mid)" }}>CRECI: <strong style={{ color: "var(--gray-light)" }}>{corretor.creci || "Não informado"}</strong></p>
                            </div>
                          </div>
                          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 11, color: "var(--gray-dark)", textTransform: "uppercase", fontWeight: 700 }}>E-mail</span>
                                <span style={{ fontSize: 12, color: "var(--gray-light)", fontWeight: 600 }}>{corretor.email}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 11, color: "var(--gray-dark)", textTransform: "uppercase", fontWeight: 700 }}>WhatsApp</span>
                                <span style={{ fontSize: 12, color: "var(--gray-light)", fontWeight: 600 }}>{corretor.telefone || "-"}</span>
                              </div>
                            </div>
                            <div style={{ height: 1, background: "var(--border-subtle)" }} />
                            <div>
                              <p style={{ fontSize: 11, color: "#a78bfa", textTransform: "uppercase", fontWeight: 800, marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}><Wallet size={12} /> Dados Pagamento</p>
                              {!corretor.dadosBancarios || (!corretor.dadosBancarios.cpf && !corretor.dadosBancarios.chavePix && !corretor.dadosBancarios.banco) ? (
                                <p style={{ fontSize: 12, color: "var(--gray-dark)", fontStyle: "italic" }}>O corretor ainda não preencheu os dados bancários/PIX.</p>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 8, border: "1px dashed rgba(167,139,250,0.2)" }}>
                                  {corretor.dadosBancarios.cpf && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 11, color: "var(--gray-mid)" }}>CPF/CNPJ:</span><span style={{ fontSize: 12, color: "white", fontWeight: 600 }}>{corretor.dadosBancarios.cpf}</span></div>}
                                  {corretor.dadosBancarios.chavePix && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 11, color: "var(--gray-mid)" }}>Chave PIX:</span><span style={{ fontSize: 12, color: "#4ade80", fontWeight: 700 }}>{corretor.dadosBancarios.chavePix}</span></div>}
                                  {corretor.dadosBancarios.banco && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span style={{ fontSize: 11, color: "var(--gray-mid)" }}>Banco:</span><span style={{ fontSize: 12, color: "var(--gray-light)" }}>{corretor.dadosBancarios.banco}</span></div>}
                                  {corretor.dadosBancarios.agencia && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 11, color: "var(--gray-mid)" }}>Agência:</span><span style={{ fontSize: 12, color: "var(--gray-light)" }}>{corretor.dadosBancarios.agencia}</span></div>}
                                  {corretor.dadosBancarios.conta && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 11, color: "var(--gray-mid)" }}>Conta:</span><span style={{ fontSize: 12, color: "var(--gray-light)" }}>{corretor.dadosBancarios.conta}</span></div>}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ABA: RECEBÍVEIS E CONTRATOS */}
              {tab === "recebiveis" && <GestaoRecebiveis leads={todosLeads} empreendimentos={empreendimentos} onGerarContrato={setLeadParaContrato} />}

              {/* ABA: ARQUIVOS PADRÃO */}
              {tab === "arquivos" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                  <div style={{ background: "rgba(175,111,83,0.08)", padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(175,111,83,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
                    <Info size={18} color="var(--terracota)" style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.5 }}>Os arquivos adicionados aqui ficam disponíveis nos painéis dos <strong>Corretores</strong> e <strong>Correspondentes</strong>, divididos por empreendimento.</p>
                  </div>
                  {empreendimentos.length === 0 ? (
                    <div style={{ padding: "64px 24px", borderRadius: 16, textAlign: "center", background: "rgba(0,0,0,0.2)", border: "1px dashed var(--border-subtle)" }}>
                      <p style={{ fontSize: 14, color: "var(--gray-mid)" }}>Nenhum empreendimento cadastrado.</p>
                    </div>
                  ) : (
                    empreendimentos.map((emp) => (
                      <div key={emp.slug} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", background: "rgba(0,0,0,0.2)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Building2 size={18} color="var(--terracota)" />
                            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-light)" }}>{emp.nome}</h3>
                          </div>
                          <div>
                            <input ref={fileInputRef} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => handleUploadDocumentoPadrao(e, emp.slug)} />
                            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingGeral} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, cursor: "pointer", background: "var(--terracota-glow)", border: "1px solid var(--border-active)", color: "var(--terracota)", fontSize: 12, fontWeight: 700, opacity: uploadingGeral ? 0.5 : 1 }}>
                              <UploadCloud size={14} /> {uploadingGeral ? "A enviar..." : "Adicionar Arquivo"}
                            </button>
                          </div>
                        </div>
                        <div style={{ padding: "16px 20px" }}>
                          {!emp.documentosPadrao || emp.documentosPadrao.length === 0 ? (
                            <p style={{ fontSize: 13, color: "var(--gray-dark)", textAlign: "center", padding: "20px 0" }}>Nenhum arquivo padrão adicionado.</p>
                          ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                              {emp.documentosPadrao.map((docItem, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 10, background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-subtle)" }}>
                                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(56,189,248,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8", flexShrink: 0 }}><FileText size={18} /></div>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-light)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={docItem.nomeOriginal}>{docItem.nomeOriginal}</p>
                                    <p style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 2 }}>{new Date(docItem.dataUpload).toLocaleDateString("pt-BR")}</p>
                                  </div>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <a href={docItem.url} target="_blank" rel="noopener noreferrer" title="Abrir arquivo" style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", color: "var(--gray-light)" }}><ExternalLink size={14} /></a>
                                    <button onClick={() => deletarDocumentoPadrao(docItem.url, emp.slug)} title="Deletar arquivo" style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.1)", color: "#f87171", border: "none", cursor: "pointer" }}><Trash2 size={14} /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── MODAIS ── */}
      <AnimatePresence>
        {modalVendaDireta && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 20, width: "100%", maxWidth: 400, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}><Building2 size={18} color="#c084fc" /> Venda Direta (House)</h3>
                <button onClick={() => setModalVendaDireta(false)} style={{ background: "none", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={20} /></button>
              </div>
              <form onSubmit={handleCriarVendaDireta} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 8, textTransform: "uppercase" }}>Nome do Cliente</label><input type="text" required className="input-field" value={novaVenda.nome} onChange={e => setNovaVenda({ ...novaVenda, nome: e.target.value })} placeholder="Ex: João da Silva" /></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 8, textTransform: "uppercase" }}>WhatsApp</label><input type="text" required className="input-field" value={novaVenda.whatsapp} onChange={e => setNovaVenda({ ...novaVenda, whatsapp: e.target.value })} placeholder="(00) 00000-0000" /></div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 8, textTransform: "uppercase" }}>Empreendimento</label>
                  <select required className="input-field" value={novaVenda.empreendimentoId} onChange={e => setNovaVenda({ ...novaVenda, empreendimentoId: e.target.value })}>
                    <option value="">Selecione o empreendimento...</option>
                    {empreendimentos.map(e => <option key={e.slug} value={e.slug}>{e.nome}</option>)}
                  </select>
                </div>
                <div style={{ padding: "12px", background: "rgba(168,85,247,0.1)", border: "1px dashed rgba(168,85,247,0.3)", borderRadius: 8, marginTop: 8 }}>
                  <p style={{ fontSize: 11, color: "#c084fc", lineHeight: 1.5 }}>Este cliente será criado sem vínculo a nenhum corretor e <strong>não gerará comissão de corretagem</strong>. Você poderá anexar a documentação dele clicando no botão "Dossiê".</p>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button type="button" onClick={() => setModalVendaDireta(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "white", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                  <button type="submit" disabled={uploadingGeral} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "var(--terracota)", border: "none", color: "white", fontWeight: 700, cursor: "pointer" }}>{uploadingGeral ? "Criando..." : "Criar Venda"}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DossieModal isOpen={leadDossieId !== null} onClose={() => setLeadDossieId(null)} lead={leadDossieSelecionado} isAdmin={true} />
      <DocumentosConstrutorModal isOpen={leadDocumentosId !== null} onClose={() => setLeadDocumentosId(null)} lead={leadDocumentosSelecionado} isAdmin={true} />

      {mapaVisaoGeral.aberto && mapaVisaoGeral.empreendimento && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(15,30,22,0.95)" }}>
            <div><h2 style={{ fontSize: 18, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}><MapIcon size={20} color="var(--terracota)" />Mapa Geral — {mapaVisaoGeral.empreendimento.nome}</h2><p style={{ fontSize: 13, color: "var(--gray-mid)", marginTop: 4 }}>Modo de visualização. Clique num lote para ver os clientes na fila.</p></div>
            <button onClick={() => setMapaVisaoGeral({ aberto: false, empreendimento: null })} style={{ padding: 8, background: "rgba(255,255,255,0.1)", borderRadius: 8, border: "none", color: "white", cursor: "pointer" }}><X size={20} /></button>
          </div>
          <div style={{ flex: 1, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
            {loadingVisaoGeral ? <div style={{ color: "var(--terracota)", fontWeight: 700, animation: "pulse 2s infinite" }}>Carregando mapa...</div> : <MapaInterativo mapaUrl={mapaVisaoGeral.empreendimento.mapaUrl || ""} lotes={lotesVisaoGeral} onLoteClick={(lote) => setLoteDetalhe(lote)} />}
          </div>
        </div>
      )}

      {mapaReserva.aberto && mapaReserva.emp && mapaReserva.lead && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(15,30,22,0.95)" }}>
            <div><h2 style={{ fontSize: 18, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}><MapIcon size={20} color="#c084fc" />Vincular Lote — {mapaReserva.lead.nome}</h2><p style={{ fontSize: 13, color: "var(--gray-mid)", marginTop: 4 }}>Selecione o lote livre diretamente no mapa para prosseguir.</p></div>
            <button onClick={() => setMapaReserva({ aberto: false, lead: null, emp: null })} style={{ padding: 8, background: "rgba(255,255,255,0.1)", borderRadius: 8, border: "none", color: "white", cursor: "pointer" }}><X size={20} /></button>
          </div>
          <div style={{ flex: 1, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
            {loadingVisaoGeral ? <div style={{ color: "var(--terracota)", fontWeight: 700, animation: "pulse 2s infinite" }}>Carregando mapa...</div> : <MapaInterativo mapaUrl={mapaReserva.emp.mapaUrl || ""} lotes={lotesVisaoGeral} onLoteClick={(lote) => { if (lote.status === "vendido" || lote.status === "bloqueado") { alert("Lote indisponível."); return; } setLoteReservaModal(lote); if (mapaReserva.emp?.modelos?.length) { setFormReserva({ modeloId: mapaReserva.emp.modelos[0].id, valor: mapaReserva.emp.modelos[0].valor }); } }} />}
          </div>
        </div>
      )}

      <AnimatePresence>
        {loteReservaModal && mapaReserva.emp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 20, width: "100%", maxWidth: 400, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={{ fontSize: 16, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}><Building2 size={18} color="#c084fc" /> Configurar Contrato</h3><button onClick={() => setLoteReservaModal(null)} style={{ background: "none", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={20} /></button></div>
              <form onSubmit={confirmarReservaLote} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ padding: "12px 16px", background: "rgba(168,85,247,0.1)", borderRadius: 10, border: "1px solid rgba(168,85,247,0.3)" }}><p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Lote Selecionado</p><p style={{ fontSize: 18, color: "#c084fc", fontWeight: 800 }}>{loteReservaModal.numero || loteReservaModal.id}</p></div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 8, textTransform: "uppercase" }}>Modelo da Casa</label>
                  <select required className="input-field" value={formReserva.modeloId} onChange={e => { const mod = mapaReserva.emp?.modelos.find(m => m.id === e.target.value); setFormReserva({ modeloId: e.target.value, valor: mod ? mod.valor : 0 }); }}>
                    {mapaReserva.emp.modelos.map(m => <option key={m.id} value={m.id}>{m.nome} — R$ {m.valor.toLocaleString("pt-BR")}</option>)}
                  </select>
                </div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 8, textTransform: "uppercase" }}>Valor Fechado na Venda (R$)</label><input type="number" required className="input-field" value={formReserva.valor} onChange={e => setFormReserva({ ...formReserva, valor: Number(e.target.value) })} /></div>
                <div style={{ padding: "12px", background: "rgba(74,222,128,0.1)", border: "1px dashed rgba(74,222,128,0.3)", borderRadius: 8, marginTop: 8 }}><p style={{ fontSize: 11, color: "#4ade80", lineHeight: 1.5 }}>Ao confirmar, esta venda será <strong>marcada como aprovada</strong> e transferida imediatamente para a Gestão de Recebíveis.</p></div>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}><button type="button" onClick={() => setLoteReservaModal(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "white", fontWeight: 600, cursor: "pointer" }}>Voltar ao Mapa</button><button type="submit" disabled={uploadingGeral} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "var(--terracota)", border: "none", color: "white", fontWeight: 700, cursor: "pointer" }}>{uploadingGeral ? "Gravando..." : "Confirmar Vínculo"}</button></div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loteDetalhe && (
        <div style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-card)", padding: 24, borderRadius: 20, width: "100%", maxWidth: 500, border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h3 style={{ color: "white", fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><MapIcon size={20} color="var(--terracota)" /> Detalhes do Lote {loteDetalhe.numero}</h3><button onClick={() => setLoteDetalhe(null)} style={{ background: "transparent", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={20} /></button></div>
            <div style={{ marginBottom: 20 }}><span style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, fontWeight: 700, textTransform: "uppercase", background: "rgba(255,255,255,0.1)", color: "white" }}>Status: {loteDetalhe.status}</span></div>
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
            ) : <div style={{ padding: 20, textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 12, border: "1px dashed var(--border-subtle)" }}><p style={{ fontSize: 13, color: "var(--gray-mid)" }}>Nenhum cliente vinculado a este lote no momento.</p></div>}
            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}><button onClick={() => setLoteDetalhe(null)} style={{ padding: "10px 20px", background: "rgba(255,255,255,0.1)", color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Fechar</button></div>
          </div>
        </div>
      )}

      {leadParaContrato && <GeradorContratoModal lead={leadParaContrato} onClose={() => setLeadParaContrato(null)} />}
    </div>
  );
}