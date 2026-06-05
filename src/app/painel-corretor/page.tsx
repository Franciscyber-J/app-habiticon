"use client";

import { useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, getDocs } from "firebase/firestore";
import Image from "next/image";
import { Users, ShieldCheck, LogOut, MessageCircle, Building2, MessageSquare, UserPlus, Flame, FolderOpen, AlertOctagon, RefreshCcw, FileText, ExternalLink, Info, ThumbsUp, Share2, Copy, UserCircle, Save, X, Map as MapIcon, Home, Phone, Lock, CheckCircle2 } from "lucide-react";
import { DossieModal } from "@/components/corretor/DossieModal";
import { MapaInterativo } from "@/components/mapa/MapaInterativo";
import { formatBRL } from "@/lib/calculos";

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
  historicoAtendimento?: {
    texto: string;
    autorNome: string;
    autorId: string;
    timestamp: string;
  }[];
  dossie?: any;
  motivoReprovacao?: string; 
  creditoAprovadoInfo?: {
    valorAprovado: number;
    valorParcela: number;
    observacoes: string;
    dataAprovacao: string;
  };
  loteReserva?: {
    quadraId: string;
    loteId: string;
    numero: string;
    modeloCasa: string;
    valorVenda: number;
  };
  propostaUrl?: string;
  correspondentesInfo?: Array<{ id: string; nome: string }>;
}

interface GrupoLeads {
  nome: string;
  leads: LeadData[];
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
  vendaEmOrdem?: boolean; 
  documentosPadrao?: DocumentoPadrao[];
  modelos?: any[]; 
}

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────

export default function PainelCorretor() {
  const [meusLeads, setMeusLeads] = useState<LeadData[]>([]);
  const [leadsRoleta, setLeadsRoleta] = useState<LeadData[]>([]);
  const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([]);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<"meus" | "roleta" | "arquivos">("meus");
  const [empreendimentosPermitidos, setEmpreendimentosPermitidos] = useState<string[] | null>(null);
  const [leadDossieId, setLeadDossieId] = useState<string | null>(null);

  // Estados do Perfil
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [perfilData, setPerfilData] = useState({
    nome: "", email: "", telefone: "", creci: "",
    cpf: "", chavePix: "", banco: "", agencia: "", conta: ""
  });

  // Estados de Cadastro Manual de Lead
  const [modalNovoLeadAberto, setModalNovoLeadAberto] = useState(false);
  const [salvandoNovoLead, setSalvandoNovoLead] = useState(false);
  const [novoLeadData, setNovoLeadData] = useState({
    nome: "", whatsapp: "", whatsapp2: "", empreendimentoId: "", modeloId: "",
    // ── Pré-cadastro do cliente ──
    email: "",
    estadoCivil: "",                // solteiro | casado | divorciado | viuvo | uniao_estavel
    pisnit: "",
    tipoVinculo: "",                // clt | autonomo | empresario | aposentado | servidor_publico | outro
    temCarteiraAssinada3Anos: "",   // sim | nao | nao_se_aplica
    temFinanciamentoCaixa: "",      // nunca | ativo | quitado
    temFilhosMenores: "",           // sim | nao
    observacoesCorretor: "",
  });


  const leadDossieSelecionado = meusLeads.find(l => l.id === leadDossieId) || null;

  const [modalHistoricoLeadId, setModalHistoricoLeadId] = useState<string | null>(null);
  const modalHistoricoLead = meusLeads.find(l => l.id === modalHistoricoLeadId) || null;
  const [novoHistorico, setNovoHistorico] = useState("");
  const [salvandoHistorico, setSalvandoHistorico] = useState(false);

  // Filtros blindados contra valores nulos (null = sem restrição = vê tudo)
  const empreendimentosVisiveis = useMemo(() => {
    const base = empreendimentos || [];
    if (empreendimentosPermitidos === null) return base;
    return base.filter(e => e?.slug && empreendimentosPermitidos.includes(e.slug));
  }, [empreendimentos, empreendimentosPermitidos]);

  const leadsRoletaVisiveis = useMemo(() => {
    const base = leadsRoleta || [];
    if (empreendimentosPermitidos === null) return base;
    return base.filter(l => l?.empreendimentoId && empreendimentosPermitidos.includes(l.empreendimentoId));
  }, [leadsRoleta, empreendimentosPermitidos]);

  // Estados do Mapa de Lotes (Reserva)
  const [mapaModalAberto, setMapaModalAberto] = useState<{aberto: boolean, empreendimento: Empreendimento | null, lead: LeadData | null}>({aberto: false, empreendimento: null, lead: null});
  const [lotesMapa, setLotesMapa] = useState<any[]>([]); 
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [loteParaReservar, setLoteParaReservar] = useState<any | null>(null);

  // Estados do Mapa de Lotes (Visão Geral - Read Only)
  const [mapaVisaoGeral, setMapaVisaoGeral] = useState<{aberto: boolean, empreendimento: Empreendimento | null}>({aberto: false, empreendimento: null});
  const [lotesVisaoGeral, setLotesVisaoGeral] = useState<any[]>([]);
  const [loadingVisaoGeral, setLoadingVisaoGeral] = useState(false);

  // ── MODAL NÃO QUALIFICADO ──
  const [modalNaoQualificado, setModalNaoQualificado] = useState<{aberto: boolean, lead: LeadData | null}>({aberto: false, lead: null});
  const [modalStatusCorretor, setModalStatusCorretor] = useState<LeadData | null>(null);
  const [motivoNaoQualificado, setMotivoNaoQualificado] = useState("");

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
        setEmpreendimentosPermitidos(userData.empreendimentosPermitidos ?? null);
        
        setPerfilData({
          nome: userData.nome || "",
          email: userData.email || user.email || "",
          telefone: userData.telefone || "",
          creci: userData.creci || "",
          cpf: userData.dadosBancarios?.cpf || "",
          chavePix: userData.dadosBancarios?.chavePix || "",
          banco: userData.dadosBancarios?.banco || "",
          agencia: userData.dadosBancarios?.agencia || "",
          conta: userData.dadosBancarios?.conta || ""
        });

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

  // ── CARREGAMENTO DE EMPREENDIMENTOS ──
  useEffect(() => {
    const carregarEmpreendimentos = async () => {
      try {
        const empSnapshot = await getDocs(query(collection(db, "empreendimentos"), where("status", "==", "ativo")));
        const emps: Empreendimento[] = [];
        empSnapshot.forEach((docItem) => {
           emps.push({
             slug: docItem.id,
             nome: docItem.data().nome,
             mapaUrl: docItem.data().mapaUrl,
             vendaEmOrdem: docItem.data().vendaEmOrdem,
             documentosPadrao: docItem.data().documentosPadrao || [],
             modelos: docItem.data().modelos || []
           });
        });
        setEmpreendimentos(emps);
      } catch (error) {
        console.error("Erro ao carregar empreendimentos:", error);
      }
    };
    
    carregarEmpreendimentos();
  }, [abaAtiva, modalNovoLeadAberto]);

  // ─────────────────────────────────────────────────────────
  // FUNÇÕES DE AÇÃO E MODAIS DE MAPA
  // ─────────────────────────────────────────────────────────

  const formatWhatsApp = (val: string) => {
    const num = val.replace(/\D/g, "").slice(0, 11);
    if (num.length <= 2) return num;
    if (num.length <= 7) return `(${num.slice(0, 2)}) ${num.slice(2)}`;
    return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
  };

  const handleCadastrarLeadManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoLeadData.nome || !novoLeadData.whatsapp || !novoLeadData.empreendimentoId) {
      alert("Preencha os campos obrigatórios.");
      return;
    }

    setSalvandoNovoLead(true);
    try {
      const empSelecionado = empreendimentos.find(e => e.slug === novoLeadData.empreendimentoId);
      const modeloSelecionado = empSelecionado?.modelos?.find(m => m.id === novoLeadData.modeloId);

      // Envia para a API padronizada (mesmo fluxo do simulador)
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
          nome: novoLeadData.nome,
          whatsapp: novoLeadData.whatsapp,
          whatsapp2: novoLeadData.whatsapp2,
          corretorId: userId,
          nomeCorretor: perfilData.nome || userName,
          empreendimento: empSelecionado?.nome || "",
          empreendimentoId: empSelecionado?.slug || "",
          modelo: modeloSelecionado?.nome || "",
          valorImovel: modeloSelecionado?.valor || 0,
          area: modeloSelecionado?.area || 0,
          quartos: modeloSelecionado?.quartos || 0,
          origem: "cadastro_manual",
          timestamp: new Date().toISOString(),
          // ── Pré-cadastro ──
          preCadastro: {
            email:                    novoLeadData.email,
            estadoCivil:              novoLeadData.estadoCivil,
            pisnit:                   novoLeadData.pisnit,
            tipoVinculo:              novoLeadData.tipoVinculo,
            temCarteiraAssinada3Anos: novoLeadData.temCarteiraAssinada3Anos,
            temFinanciamentoCaixa:    novoLeadData.temFinanciamentoCaixa,
            temFilhosMenores:         novoLeadData.temFilhosMenores,
            observacoesCorretor:      novoLeadData.observacoesCorretor,
          },
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Como a API cria com status "novo", nós forçamos para "em_atendimento" 
      // pois foi o corretor que inseriu manualmente.
      if (data.lead?.id) {
         await updateDoc(doc(db, "leads", data.lead.id), { status: "em_atendimento" });
      }

      alert("Cliente cadastrado e vinculado a você com sucesso!");
      setModalNovoLeadAberto(false);
      setNovoLeadData({
        nome: "", whatsapp: "", whatsapp2: "", empreendimentoId: "", modeloId: "",
        email: "", estadoCivil: "", pisnit: "", tipoVinculo: "",
        temCarteiraAssinada3Anos: "", temFinanciamentoCaixa: "",
        temFilhosMenores: "", observacoesCorretor: "",
      });

      setAbaAtiva("meus"); // Direciona para a aba correta
    } catch (error) {
      console.error("Erro ao cadastrar lead:", error);
      alert("Houve um erro ao tentar cadastrar o cliente.");
    } finally {
      setSalvandoNovoLead(false);
    }
  };

  const leadsAgrupados = meusLeads.reduce((acc, lead) => {
    const empId = lead.empreendimentoId || "sem-empreendimento";
    const empNome = lead.empreendimentoNome || "Outros Atendimentos";
    if (!acc[empId]) { acc[empId] = { nome: empNome, leads: [] }; }
    acc[empId].leads.push(lead);
    return acc;
  }, {} as Record<string, GrupoLeads>);

  const assumirLead = async (leadId: string) => {
    try {
      const nomeReal = perfilData.nome || userName;
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

  const copiarLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert("Link copiado para a área de transferência! Cole no seu WhatsApp ou Instagram.");
  };

  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoPerfil(true);
    try {
      await updateDoc(doc(db, "usuarios", userId), {
        nome: perfilData.nome,
        telefone: perfilData.telefone,
        creci: perfilData.creci,
        dadosBancarios: {
          cpf: perfilData.cpf,
          chavePix: perfilData.chavePix,
          banco: perfilData.banco,
          agencia: perfilData.agencia,
          conta: perfilData.conta
        }
      });
      setUserName(perfilData.nome);
      alert("Perfil atualizado com sucesso!");
      setPerfilAberto(false);
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      alert("Erro ao atualizar o perfil. Tente novamente.");
    } finally {
      setSalvandoPerfil(false);
    }
  };

  const desvincularLote = async (lead: LeadData) => {
    if (!lead.loteReserva || !confirm("Deseja remover a reserva deste lote? Ele voltará a ficar disponível para outros corretores.")) return;
    try {
      const { quadraId, loteId } = lead.loteReserva;
      const loteRef = doc(db, "empreendimentos", lead.empreendimentoId, "quadras", quadraId, "lotes", loteId);
      
      const loteSnap = await getDoc(loteRef);
      if (loteSnap.exists()) {
        const filaAtual = loteSnap.data().fila || [];
        const novaFila = filaAtual.filter((f: any) => f.leadId !== lead.id);
        const novoStatus = novaFila.length === 0 ? "disponivel" : "vinculado";

        await updateDoc(loteRef, { fila: novaFila, status: novoStatus });
      }

      const leadRef = doc(db, "leads", lead.id);
      const leadSnap = await getDoc(leadRef);
      if (leadSnap.exists()) {
        await updateDoc(leadRef, { loteReserva: null });
      }

      alert("Lote desvinculado com sucesso.");
    } catch (error) {
      console.error("Erro ao desvincular:", error);
      alert("Erro ao desvincular o lote.");
    }
  };

  const marcarNaoQualificado = async () => {
    const { lead } = modalNaoQualificado;
    if (!lead) return;
    if (!motivoNaoQualificado.trim()) {
      alert("O motivo é obrigatório. Descreva por que este lead não está qualificado.");
      return;
    }
    try {
      await updateDoc(doc(db, "leads", lead.id), {
        status: "nao_qualificado",
        motivoReprovacao: motivoNaoQualificado.trim(),
        origemDesqualificacao: "corretor",
      });
      setModalNaoQualificado({ aberto: false, lead: null });
      setMotivoNaoQualificado("");
    } catch (error) {
      console.error("Erro ao marcar não qualificado:", error);
      alert("Erro ao atualizar o status do lead.");
    }
  };

const publicarHistorico = async () => {
    if (!modalHistoricoLead || !novoHistorico.trim()) return;
    setSalvandoHistorico(true);
    try {
      const entrada = {
        texto: novoHistorico.trim(),
        autorNome: perfilData.nome || userName,
        autorId: userId,
        timestamp: new Date().toISOString()
      };
      const historicoAtual = modalHistoricoLead.historicoAtendimento || [];
      await updateDoc(doc(db, "leads", modalHistoricoLead.id), {
        historicoAtendimento: [...historicoAtual, entrada]
      });
      setNovoHistorico("");
    } catch (error) {
      alert("Erro ao publicar. Tente novamente.");
    } finally {
      setSalvandoHistorico(false);
    }
  };

  // MAPA: MODO VISÃO GERAL (READ-ONLY)
  const abrirVisaoGeralMapa = async (empId: string) => {
    const emp = empreendimentos.find(e => e.slug === empId) || null;
    if (!emp || !emp.mapaUrl) {
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
                id: docLote.id, quadraId: docQuadra.id, ...data,
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

  // MAPA: MODO RESERVA PARA CLIENTE
  const abrirMapaParaLead = async (lead: LeadData) => {
    const emp = empreendimentos.find(e => e.slug === lead.empreendimentoId) || null;
    if (!emp || !emp.mapaUrl) {
      alert("Este empreendimento ainda não tem um mapa SVG configurado pelo administrador.");
      return;
    }

    setMapaModalAberto({ aberto: true, empreendimento: emp, lead });
    setLoadingLotes(true);

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
                id: docLote.id, quadraId: docQuadra.id, ...data,
                status: quadraBloqueada ? "bloqueado" : data.status 
              };
              if (index >= 0) lotesTemp[index] = loteTratado;
              else lotesTemp.push(loteTratado);
            });
            setLotesMapa([...lotesTemp]); 
            resolve();
          });
        });
      });
      Promise.all(promises).then(() => setLoadingLotes(false));
    });
  };

  const handleLoteClick = (lote: any) => {
    const { empreendimento, lead } = mapaModalAberto;
    if (!empreendimento || !lead) return;

    if (lote.status === "bloqueado") {
      alert("Este lote ou a sua quadra estão bloqueados pelo administrador.");
      return;
    }
    if (lote.status === "vendido") {
      alert("Este lote já foi vendido em definitivo.");
      return;
    }

    if (empreendimento.vendaEmOrdem && lote.adjacentes && lote.adjacentes.length > 0) {
      const adjacenteVendido = lotesMapa.some(l => lote.adjacentes.includes(l.svgPathId) && l.status === "vendido");
      if (!adjacenteVendido) {
        alert("Pela regra de venda sequencial definida pelo Admin, você só pode reservar este lote se um dos lotes vizinhos (adjacentes) já estiver vendido.");
        return;
      }
    }

    const jaNaFila = lote.fila?.some((f: any) => f.leadId === lead.id);
    if (jaNaFila) {
      alert("Este cliente já está na fila de espera deste lote.");
      return;
    }

    setLoteParaReservar(lote);
  };

  const confirmarReservaComModelo = async (modeloNome: string, valor: number) => {
    const { empreendimento, lead } = mapaModalAberto;
    const lote = loteParaReservar;
    if (!empreendimento || !lead || !lote) return;

    try {
      const novoFilaItem = {
        leadId: lead.id, nomeCliente: lead.nome, corretorId: userId,
        nomeCorretor: userName, modeloCasa: modeloNome, valorVenda: valor,
        timestamp: new Date().toISOString()
      };
      const novaFila = [...(lote.fila || []), novoFilaItem];
      
      await updateDoc(doc(db, "empreendimentos", empreendimento.slug, "quadras", lote.quadraId, "lotes", lote.id), {
        fila: novaFila, status: "vinculado"
      });

      await updateDoc(doc(db, "leads", lead.id), {
        loteReserva: { quadraId: lote.quadraId, loteId: lote.id, numero: lote.numero, modeloCasa: modeloNome, valorVenda: valor }
      });

      alert(`Lote ${lote.numero} reservado com o modelo ${modeloNome}!`);
      setLoteParaReservar(null);
      setMapaModalAberto({ aberto: false, empreendimento: null, lead: null });
    } catch (error) {
      console.error("Erro ao reservar lote:", error);
      alert("Erro ao processar reserva.");
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
          <button onClick={() => setPerfilAberto(true)} title="Meu Perfil" className="btn-ghost" style={{ color: "var(--gray-light)", padding: 8 }}>
            <UserCircle size={18} />
          </button>
          <button onClick={() => auth.signOut()} title="Sair" className="btn-ghost" style={{ color: "#f87171", padding: 8 }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="container-app" style={{ padding: "30px 20px", maxWidth: 800, margin: "0 auto" }}>

        <div style={{ marginBottom: 30 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "white" }}>Área de Vendas</h1>
            <button 
              onClick={() => setModalNovoLeadAberto(true)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", 
                background: "var(--terracota)", color: "white", borderRadius: 12, 
                fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", 
                boxShadow: "0 4px 14px rgba(175,111,83,0.3)", transition: "all 0.2s"
              }}
            >
              <UserPlus size={16} /> Cadastrar Cliente
            </button>
          </div>

          {/* ABAS */}
          <div style={{ display: "flex", gap: 10, background: "rgba(0,0,0,0.3)", padding: 6, borderRadius: 14, border: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
            <button
              onClick={() => setAbaAtiva("meus")}
              style={{
                flex: "1 1 min-content", padding: "12px", borderRadius: 10, border: "none",
                fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap",
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
                flex: "1 1 min-content", padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap",
                background: abaAtiva === "roleta" ? "rgba(239,68,68,0.15)" : "transparent",
                color: abaAtiva === "roleta" ? "#ef4444" : "var(--gray-mid)",
                border: abaAtiva === "roleta" ? "1px solid rgba(239,68,68,0.3)" : "1px solid transparent"
              }}
            >
              <Flame size={18} color={abaAtiva === "roleta" ? "#ef4444" : "var(--gray-mid)"} />
              Leads Livres
              {leadsRoletaVisiveis.length > 0 && (
                <span style={{ background: "#ef4444", color: "white", padding: "2px 8px", borderRadius: 100, fontSize: 11, animation: "pulse 2s infinite" }}>
                  {leadsRoletaVisiveis.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setAbaAtiva("arquivos")}
              style={{
                flex: "1 1 min-content", padding: "12px", borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap",
                background: abaAtiva === "arquivos" ? "rgba(56,189,248,0.15)" : "transparent",
                color: abaAtiva === "arquivos" ? "#38bdf8" : "var(--gray-mid)",
                border: abaAtiva === "arquivos" ? "1px solid rgba(56,189,248,0.3)" : "1px solid transparent"
              }}
            >
              <FolderOpen size={18} color={abaAtiva === "arquivos" ? "#38bdf8" : "var(--gray-mid)"} />
              Material de Vendas
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
                <p style={{ color: "var(--gray-dark)", fontSize: 13, marginTop: 8 }}>Cadastre manualmente, vá para "Leads Livres" ou compartilhe seu link de divulgação.</p>
              </div>
            ) : (
              Object.entries(leadsAgrupados).map(([empId, grupo], index) => (
                <div key={index}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <Building2 size={16} color="var(--terracota)" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-light)" }}>{grupo.nome}</h3>
                    <span style={{ fontSize: 12, color: "var(--gray-dark)" }}>({grupo.leads.length})</span>
                    
                    {/* BOTÃO VER MAPA GERAL (AO LADO DO EMPREENDIMENTO) */}
                    <button 
                      onClick={() => abrirVisaoGeralMapa(empId)} 
                      style={{ padding: "4px 10px", background: "rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 11, fontWeight: 700, color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}
                    >
                      <MapIcon size={12}/> Ver Mapa
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {grupo.leads.map((lead: LeadData) => {
                      const isReprovado = lead.status === "nao_qualificado" || lead.status === "credito_reprovado";
                      const isAprovado = lead.status === "qualificado" || lead.status === "credito_aprovado";
                      const isDesqualificado = lead.status === "desqualificado" || lead.status === "venda_cancelada" || lead.status === "venda_desfeita";
                      const estaSolto = !lead.corretorId;

                      const bgStatus = lead.status === "com_pendencia" || isReprovado || isDesqualificado ? "rgba(239,68,68,0.15)" : isAprovado ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.05)";
                      const borderStatus = lead.status === "com_pendencia" || isReprovado || isDesqualificado ? "rgba(239,68,68,0.5)" : isAprovado ? "rgba(74,222,128,0.4)" : "var(--border-subtle)";
                      const colorStatus = lead.status === "com_pendencia" || isReprovado || isDesqualificado ? "#f87171" : isAprovado ? "#4ade80" : "var(--gray-light)";
                      
                      const borderColorCard = isReprovado || isDesqualificado ? "1px solid rgba(239,68,68,0.4)" : isAprovado ? "1px solid rgba(74,222,128,0.4)" : "1px solid var(--border-subtle)";

                      return (
                        <div key={lead.id} style={{
                          background: "var(--bg-card)", borderRadius: 14, 
                          border: borderColorCard,
                          display: "flex", flexDirection: "column"
                        }}>
                          {/* LINHA 1: INFO + STATUS */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                              <div style={{ width: 38, height: 38, borderRadius: 10, background: bgStatus.replace("0.15","0.1"), color: colorStatus, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                                {(lead.nome || "?")[0].toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontWeight: 700, color: "white", fontSize: 14, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.nome}</p>
                                <div style={{ display: "flex", gap: 6, fontSize: 11, color: "var(--gray-mid)", flexWrap: "wrap", alignItems: "center" }}>
                                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                    <Phone size={11} /> {lead.whatsapp}
                                    {lead.whatsapp2 && (<><span style={{ margin: "0 3px", color: "var(--border-subtle)" }}>|</span><Phone size={11} /> {lead.whatsapp2}</>)}
                                  </span>
                                  <span style={{ color: "var(--border-subtle)" }}>·</span>
                                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                    {lead.timestamp ? new Date(lead.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " às") : ""}
                                  </span>
                                  {lead.modelo && (<><span style={{ color: "var(--border-subtle)" }}>·</span><span style={{ color: "var(--terracota-light)", fontWeight: 600 }}>{lead.modelo}</span></>)}
                                  {lead.correspondentesInfo && lead.correspondentesInfo.length > 0 && (
                                    <><span style={{ color: "var(--border-subtle)" }}>·</span>
                                    <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#38bdf8", fontWeight: 600 }}>
                                      <ShieldCheck size={10} /> CB: {lead.correspondentesInfo.map((c: any) => c.nome).join(", ")}
                                    </span></>
                                  )}
                                </div>
                              </div>
                            </div>
                            {(isAprovado || isReprovado) ? (
                              <button onClick={() => setModalStatusCorretor(lead)} title={isAprovado ? "Ver detalhes da aprovação" : "Ver motivo da reprovação"} style={{ padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, flexShrink: 0, background: bgStatus, border: `1px solid ${borderStatus}`, color: colorStatus, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                                {lead.status ? lead.status.replace(/_/g, " ") : "Novo"} <Lock size={9} />
                              </button>
                            ) : (
                              <span style={{ padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, flexShrink: 0, background: bgStatus, border: `1px solid ${borderStatus}`, color: colorStatus }}>
                                {lead.status ? lead.status.replace(/_/g, " ") : "Novo"}
                              </span>
                            )}
                          </div>

                          {/* LINHA 2: AÇÕES */}
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "9px 20px", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                            {!estaSolto && !isReprovado && !isDesqualificado && !lead.loteReserva && (
                              <button onClick={() => abrirMapaParaLead(lead)} style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--gray-light)" }}>
                                <MapIcon size={12} /> Mapa de Lotes
                              </button>
                            )}
                            <button onClick={() => setLeadDossieId(lead.id)} style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--gray-light)" }}>
                              <FolderOpen size={12} /> Dossiê
                            </button>
                            <button onClick={() => setModalHistoricoLeadId(lead.id)} style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--gray-light)" }}>
                              <MessageSquare size={12} /> Histórico
                              {(lead.historicoAtendimento || []).length > 0 && (
                                <span style={{ fontSize: 9, fontWeight: 800, background: "#38bdf8", color: "#082f49", padding: "1px 5px", borderRadius: 100 }}>
                                  {(lead.historicoAtendimento || []).length}
                                </span>
                              )}
                            </button>
                            {lead.status === "em_atendimento" && !isAprovado && (
                              <button onClick={() => { setModalNaoQualificado({ aberto: true, lead }); setMotivoNaoQualificado(""); }} style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", cursor: "pointer", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171" }}>
                                <AlertOctagon size={12} /> Não Qualificado
                              </button>
                            )}
                            {lead.propostaUrl && (
                              <a href={lead.propostaUrl} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--gray-light)", textDecoration: "none" }}>
                                <FileText size={12} /> Simulação
                              </a>
                            )}
                            <div style={{ flex: 1 }} />
                            <a href={`https://wa.me/55${(lead.whatsapp || "").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.15)", color: "#4ade80", textDecoration: "none" }}>
                              <MessageCircle size={12} /> Chamar
                            </a>
                            {lead.whatsapp2 && lead.whatsapp2.replace(/\D/g, "").length >= 10 && (
                              <a href={`https://wa.me/55${(lead.whatsapp2 || "").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.15)", color: "#4ade80", textDecoration: "none" }}>
                                <MessageCircle size={12} /> Wpp 2
                              </a>
                            )}
                          </div>

                          {lead.loteReserva && !isAprovado && !isReprovado && !isDesqualificado && (
                            <div style={{ margin: "0 20px 14px", padding: "12px", background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <p style={{ fontSize: 11, color: "#fb923c", fontWeight: 700, textTransform: "uppercase" }}>Lote Reservado</p>
                                <p style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Lote {lead.loteReserva.numero} — {lead.loteReserva.modeloCasa}</p>
                                <p style={{ fontSize: 12, color: "var(--gray-mid)" }}>Valor total: {formatBRL(lead.loteReserva.valorVenda)}</p>
                              </div>
                              <button 
                                onClick={() => desvincularLote(lead)}
                                style={{ padding: "8px", background: "rgba(239,68,68,0.15)", border: "none", borderRadius: 8, color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                title="Desvincular Lote"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          )}

                          {isDesqualificado && (
                            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px dashed rgba(239,68,68,0.3)", borderRadius: 10, padding: "16px", display: "flex", flexDirection: "column", gap: 12, marginTop: "0 20px 14px" }}>
                              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                <AlertOctagon size={18} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
                                <div>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 4 }}>Venda Cancelada / Desqualificado</p>
                                  <p style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.5 }}>
                                    A reserva ou venda atrelada a este cliente foi desfeita pela administração. O lote correspondente foi libertado e o cliente encontra-se desqualificado.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {isReprovado && lead.motivoReprovacao && !isDesqualificado && (
                            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px dashed rgba(239,68,68,0.3)", borderRadius: 10, padding: "16px", display: "flex", flexDirection: "column", gap: 12, marginTop: "0 20px 14px" }}>
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

                          {isAprovado && lead.creditoAprovadoInfo && !isDesqualificado && (
                            <div style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column", gap: 12, marginTop: "0 20px 14px" }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <ThumbsUp size={18} color="#4ade80" />
                                <p style={{ fontSize: 14, fontWeight: 800, color: "#4ade80" }}>Crédito Aprovado!</p>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: 8 }}>
                                  <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Valor Liberado</p>
                                  <p style={{ fontSize: 16, fontWeight: 800, color: "white" }}>
                                    R$ {lead.creditoAprovadoInfo.valorAprovado?.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: 8 }}>
                                  <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Parcela Estimada</p>
                                  <p style={{ fontSize: 16, fontWeight: 800, color: "white" }}>
                                    R$ {lead.creditoAprovadoInfo.valorParcela?.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                              {lead.creditoAprovadoInfo.observacoes && (
                                <div style={{ marginTop: 4, padding: "12px", borderTop: "1px dashed rgba(74,222,128,0.2)" }}>
                                  <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Condicionantes / Observações:</p>
                                  <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.5 }}>{lead.creditoAprovadoInfo.observacoes}</p>
                                </div>
                              )}
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
            {leadsRoletaVisiveis.length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Flame size={24} color="var(--gray-dark)" />
                </div>
                <p style={{ color: "var(--gray-mid)", fontWeight: 600 }}>A piscina de leads está vazia.</p>
                <p style={{ color: "var(--gray-dark)", fontSize: 13, marginTop: 8 }}>Novos leads do tráfego pago aparecerão aqui em tempo real.</p>
              </div>
            ) : (
              leadsRoletaVisiveis.map((lead: LeadData) => (
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

        {/* =========================================================
            ABA 3: MATERIAL DE VENDAS & LINKS DE DIVULGAÇÃO
            ========================================================= */}
        {abaAtiva === "arquivos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* SEÇÃO DE LINKS DE DIVULGAÇÃO */}
            <div style={{ background: "var(--terracota-glow)", padding: "20px", borderRadius: 16, border: "1px solid var(--border-active)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "white", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <Share2 size={18} /> Meus Links de Divulgação
              </h2>
              <p style={{ fontSize: 13, color: "var(--gray-light)", marginBottom: 16 }}>
                Use os links abaixo para capturar leads. Leads vindos destes links serão <strong>automaticamente atribuídos a você</strong>.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(empreendimentosVisiveis && empreendimentosVisiveis.length > 0) ? (
                  empreendimentosVisiveis.map(emp => {
                    const linkPessoal = `${typeof window !== 'undefined' ? window.location.origin : ''}/${emp.slug}?ref=${userId}`;
                    return (
                      <div key={`link-${emp.slug}`} style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--terracota-light)", marginBottom: 4 }}>{emp.nome}</p>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{linkPessoal}</p>
                        </div>
                        <button
                          onClick={() => copiarLink(linkPessoal)}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, background: "var(--terracota)", color: "white", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                        >
                          <Copy size={14} /> Copiar Link
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ color: "var(--gray-mid)", padding: "12px", fontSize: 13 }}>
                    Nenhum empreendimento liberado para divulgação.
                  </p>
                )}
              </div>
            </div>

            {/* SEÇÃO DE ARQUIVOS PADRÃO */}
            <div style={{ background: "rgba(56,189,248,0.08)", padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
              <Info size={18} color="#38bdf8" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.5 }}>
                Encontre aqui Plantas, Memoriais Descritivos e Apresentações oficiais fornecidas pela construtora.
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
                    
                    {/* BOTÃO DE VISÃO GERAL DE MAPA (READ-ONLY) */}
                    <div style={{ padding: "16px 20px", background: "rgba(0,0,0,0.2)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Building2 size={18} color="var(--terracota)" />
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-light)" }}>{emp.nome}</h3>
                      </div>
                      
                      <button 
                        onClick={() => abrirVisaoGeralMapa(emp.slug)} 
                        style={{ padding: "6px 12px", background: "var(--terracota-glow)", color: "var(--terracota)", border: "1px solid var(--border-active)", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                      >
                         <MapIcon size={14}/> Ver Mapa de Lotes
                      </button>
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

      {/* =========================================================
          MODAL DE CADASTRO MANUAL DE LEAD
          ========================================================= */}
      {modalNovoLeadAberto && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: "var(--bg-card)", width: "100%", maxWidth: 500,
            borderRadius: 24, border: "1px solid var(--border-subtle)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh"
          }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 10 }}>
                <UserPlus size={20} color="var(--terracota)" /> Cadastrar Cliente
              </h2>
              <button onClick={() => setModalNovoLeadAberto(false)} style={{ background: "transparent", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCadastrarLeadManual} style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
              
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Nome Completo *</label>
                <input type="text" required value={novoLeadData.nome} onChange={(e) => setNovoLeadData({...novoLeadData, nome: e.target.value})} className="input-field" style={{ fontSize: 14 }} placeholder="Nome do cliente" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>WhatsApp *</label>
                  <input type="text" required value={novoLeadData.whatsapp} onChange={(e) => setNovoLeadData({...novoLeadData, whatsapp: formatWhatsApp(e.target.value)})} className="input-field" style={{ fontSize: 14 }} placeholder="(62) 99999-9999" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>WhatsApp 2</label>
                  <input type="text" value={novoLeadData.whatsapp2} onChange={(e) => setNovoLeadData({...novoLeadData, whatsapp2: formatWhatsApp(e.target.value)})} className="input-field" style={{ fontSize: 14 }} placeholder="Opcional" />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Empreendimento de Interesse *</label>
                <select
                  required
                  value={novoLeadData.empreendimentoId}
                  onChange={(e) => setNovoLeadData({...novoLeadData, empreendimentoId: e.target.value, modeloId: ""})}
                  className="input-field"
                  style={{ fontSize: 14, color: novoLeadData.empreendimentoId ? "white" : "var(--gray-dark)", cursor: "pointer", appearance: "none" }}
                >
                  <option value="" disabled>Selecione o Empreendimento</option>
                  {empreendimentos.map(e => (
                    <option key={e.slug} value={e.slug} style={{ background: "#17271C", color: "white" }}>{e.nome}</option>
                  ))}
                </select>
              </div>

              {novoLeadData.empreendimentoId && (
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Modelo (Opcional)</label>
                  <select
                    value={novoLeadData.modeloId}
                    onChange={(e) => setNovoLeadData({...novoLeadData, modeloId: e.target.value})}
                    className="input-field"
                    style={{ fontSize: 14, color: novoLeadData.modeloId ? "white" : "var(--gray-dark)", cursor: "pointer", appearance: "none" }}
                  >
                    <option value="">Ainda não definiu o modelo</option>
                    {empreendimentos.find(e => e.slug === novoLeadData.empreendimentoId)?.modelos?.map((m: any) => (
                      <option key={m.id} value={m.id} style={{ background: "#17271C", color: "white" }}>
                        {m.nome} — {formatBRL(m.valor)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── PRÉ-CADASTRO DO CLIENTE ── */}
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--terracota-light)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                  📋 Dados do Cliente (Pré-Cadastro)
                </h3>
 
                {/* E-mail */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>E-mail</label>
                  <input type="email" value={novoLeadData.email} onChange={(e) => setNovoLeadData({...novoLeadData, email: e.target.value})} className="input-field" style={{ fontSize: 14 }} placeholder="cliente@email.com" />
                </div>
 
                {/* PIS/NIT */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Número do PIS / NIT</label>
                  <input type="text" value={novoLeadData.pisnit} onChange={(e) => setNovoLeadData({...novoLeadData, pisnit: e.target.value})} className="input-field" style={{ fontSize: 14 }} placeholder="000.00000.00-0" />
                </div>
 
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Estado Civil */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Estado Civil</label>
                    <select value={novoLeadData.estadoCivil} onChange={(e) => setNovoLeadData({...novoLeadData, estadoCivil: e.target.value})} className="input-field" style={{ fontSize: 14, cursor: "pointer", appearance: "none" }}>
                      <option value="">Selecione...</option>
                      <option value="solteiro">Solteiro(a)</option>
                      <option value="casado">Casado(a)</option>
                      <option value="divorciado">Divorciado(a)</option>
                      <option value="viuvo">Viúvo(a)</option>
                      <option value="uniao_estavel">União Estável</option>
                    </select>
                  </div>
                  {/* Filhos menores */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Possui Filhos Menores?</label>
                    <select value={novoLeadData.temFilhosMenores} onChange={(e) => setNovoLeadData({...novoLeadData, temFilhosMenores: e.target.value})} className="input-field" style={{ fontSize: 14, cursor: "pointer", appearance: "none" }}>
                      <option value="">Selecione...</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </div>
                </div>
 
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Tipo de vínculo */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Vínculo Empregatício</label>
                    <select value={novoLeadData.tipoVinculo} onChange={(e) => setNovoLeadData({...novoLeadData, tipoVinculo: e.target.value})} className="input-field" style={{ fontSize: 14, cursor: "pointer", appearance: "none" }}>
                      <option value="">Selecione...</option>
                      <option value="clt">CLT (Carteira Assinada)</option>
                      <option value="autonomo">Autônomo</option>
                      <option value="empresario">Empresário / MEI</option>
                      <option value="aposentado">Aposentado / Pensionista</option>
                      <option value="servidor_publico">Servidor Público</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  {/* 3 anos carteira */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>+3 anos de carteira?</label>
                    <select value={novoLeadData.temCarteiraAssinada3Anos} onChange={(e) => setNovoLeadData({...novoLeadData, temCarteiraAssinada3Anos: e.target.value})} className="input-field" style={{ fontSize: 14, cursor: "pointer", appearance: "none" }}>
                      <option value="">Confirmar com cliente...</option>
                      <option value="sim">Sim (pode ser em várias empresas)</option>
                      <option value="nao">Não</option>
                      <option value="nao_se_aplica">Não se aplica</option>
                    </select>
                  </div>
                </div>
 
                {/* Financiamento CAIXA */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Financiamento de imóvel na CAIXA</label>
                  <select value={novoLeadData.temFinanciamentoCaixa} onChange={(e) => setNovoLeadData({...novoLeadData, temFinanciamentoCaixa: e.target.value})} className="input-field" style={{ fontSize: 14, cursor: "pointer", appearance: "none" }}>
                    <option value="">Confirmar com cliente...</option>
                    <option value="nunca">Nunca teve</option>
                    <option value="ativo">Possui ativo</option>
                    <option value="quitado">Já quitado</option>
                  </select>
                </div>
 
                {/* Observações */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Observações do Corretor</label>
                  <textarea
                    value={novoLeadData.observacoesCorretor}
                    onChange={(e) => setNovoLeadData({...novoLeadData, observacoesCorretor: e.target.value})}
                    className="input-field"
                    style={{ fontSize: 13, resize: "vertical", minHeight: 72 }}
                    placeholder="Ex: Cliente tem renda informal complementar, mencionou dívida no SPC já regularizada..."
                  />
                </div>
              </div>

              <div style={{ marginTop: 8, padding: "12px", background: "rgba(74,222,128,0.05)", border: "1px dashed rgba(74,222,128,0.2)", borderRadius: 10 }}>
                 <p style={{ fontSize: 12, color: "var(--gray-mid)", lineHeight: 1.5, textAlign: "center" }}>
                   Este cliente será cadastrado diretamente na sua carteira (<strong style={{ color: "white" }}>Meus Atendimentos</strong>). A plataforma manterá o mesmo padrão de segurança dos leads captados online.
                 </p>
              </div>

              <button
                type="submit" disabled={salvandoNovoLead}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "16px", borderRadius: 12, border: "none", cursor: "pointer",
                  background: "var(--terracota)", color: "white", fontSize: 15, fontWeight: 800,
                  marginTop: 8, transition: "all 0.2s", boxShadow: "0 4px 14px rgba(175,111,83,0.3)"
                }}
              >
                {salvandoNovoLead ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Cadastrando...
                  </span>
                ) : (
                  <>
                    <UserPlus size={18} /> Finalizar Cadastro
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL DE PERFIL DO CORRETOR
          ========================================================= */}
      {perfilAberto && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: "var(--bg-card)", width: "100%", maxWidth: 600,
            borderRadius: 24, border: "1px solid var(--border-subtle)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh"
          }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 10 }}>
                <UserCircle size={20} color="var(--terracota)" /> Meu Perfil
              </h2>
              <button onClick={() => setPerfilAberto(false)} style={{ background: "transparent", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={salvarPerfil} style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 24 }}>
              
              {/* DADOS DE IDENTIFICAÇÃO */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 8 }}>Identificação Profissional</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Nome Completo</label>
                    <input type="text" required value={perfilData.nome} onChange={(e) => setPerfilData({...perfilData, nome: e.target.value})} className="input-field" style={{ fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>E-mail (Acesso)</label>
                    <input type="email" value={perfilData.email} disabled className="input-field" style={{ fontSize: 14, opacity: 0.6, cursor: "not-allowed" }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>WhatsApp</label>
                    <input type="text" required value={perfilData.telefone} onChange={(e) => setPerfilData({...perfilData, telefone: e.target.value})} className="input-field" style={{ fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>CRECI</label>
                    <input type="text" value={perfilData.creci} onChange={(e) => setPerfilData({...perfilData, creci: e.target.value})} className="input-field" style={{ fontSize: 14 }} placeholder="Ex: 12345-F" />
                  </div>
                </div>
              </div>

              {/* DADOS FINANCEIROS */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(74,222,128,0.1)", paddingBottom: 8 }}>Dados Bancários (Comissões)</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>CPF ou CNPJ</label>
                    <input type="text" value={perfilData.cpf} onChange={(e) => setPerfilData({...perfilData, cpf: e.target.value})} className="input-field" style={{ fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Chave PIX</label>
                    <input type="text" value={perfilData.chavePix} onChange={(e) => setPerfilData({...perfilData, chavePix: e.target.value})} className="input-field" style={{ fontSize: 14 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Banco</label>
                    <input type="text" value={perfilData.banco} onChange={(e) => setPerfilData({...perfilData, banco: e.target.value})} className="input-field" style={{ fontSize: 13 }} placeholder="Ex: Nubank" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Agência</label>
                    <input type="text" value={perfilData.agencia} onChange={(e) => setPerfilData({...perfilData, agencia: e.target.value})} className="input-field" style={{ fontSize: 13 }} placeholder="0001" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Conta</label>
                    <input type="text" value={perfilData.conta} onChange={(e) => setPerfilData({...perfilData, conta: e.target.value})} className="input-field" style={{ fontSize: 13 }} placeholder="12345-6" />
                  </div>
                </div>
              </div>

              <button
                type="submit" disabled={salvandoPerfil}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "14px", borderRadius: 12, border: "none", cursor: "pointer",
                  background: "var(--terracota)", color: "white", fontSize: 14, fontWeight: 700,
                  marginTop: 8, transition: "all 0.2s"
                }}
              >
                <Save size={16} /> {salvandoPerfil ? "A salvar..." : "Guardar Alterações"}
              </button>
            </form>
          </div>
        </div>
      )}

{/* =========================================================
          MODAL: MARCAR COMO NÃO QUALIFICADO
          ========================================================= */}
      {modalNaoQualificado.aberto && modalNaoQualificado.lead && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 150,
          background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: "var(--bg-card)", width: "100%", maxWidth: 460,
            borderRadius: 20, border: "1px solid rgba(239,68,68,0.3)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.6)", overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#f87171", display: "flex", alignItems: "center", gap: 10 }}>
                <AlertOctagon size={20} /> Não Qualificado
              </h2>
              <button onClick={() => setModalNaoQualificado({ aberto: false, lead: null })} style={{ background: "transparent", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.07)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)" }}>
                <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.6 }}>
                  Você está marcando <strong style={{ color: "white" }}>{modalNaoQualificado.lead.nome}</strong> como não qualificado. Este lead será movido para a aba correta e o motivo ficará registrado no histórico.
                </p>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#f87171", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.05em" }}>
                  Motivo (obrigatório)
                </label>
                <textarea
                  autoFocus
                  value={motivoNaoQualificado}
                  onChange={e => setMotivoNaoQualificado(e.target.value)}
                  placeholder="Ex: Não atende ligações após 5 tentativas nos últimos 20 dias. Lead especulativo sem real interesse de compra."
                  style={{
                    width: "100%", minHeight: 100, padding: "12px 14px",
                    borderRadius: 10, background: "rgba(0,0,0,0.3)",
                    border: motivoNaoQualificado.trim() ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(239,68,68,0.2)",
                    color: "white", fontSize: 13, resize: "vertical", outline: "none",
                    lineHeight: 1.6, fontFamily: "inherit"
                  }}
                />
                {!motivoNaoQualificado.trim() && (
                  <p style={{ fontSize: 11, color: "rgba(248,113,113,0.7)", marginTop: 6 }}>
                    ⚠ Descreva o motivo para poder confirmar.
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <button
                  onClick={() => setModalNaoQualificado({ aberto: false, lead: null })}
                  style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", borderRadius: 10, color: "var(--gray-light)", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={marcarNaoQualificado}
                  disabled={!motivoNaoQualificado.trim()}
                  style={{
                    flex: 1, padding: "12px", background: motivoNaoQualificado.trim() ? "#ef4444" : "rgba(239,68,68,0.2)",
                    border: "none", borderRadius: 10, color: motivoNaoQualificado.trim() ? "white" : "#f87171",
                    fontWeight: 800, cursor: motivoNaoQualificado.trim() ? "pointer" : "not-allowed",
                    fontSize: 14, transition: "0.2s"
                  }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: HISTÓRICO DE ATENDIMENTO
          ========================================================= */}
      {modalHistoricoLeadId !== null && modalHistoricoLead && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setModalHistoricoLeadId(null); setNovoHistorico(""); } }}
          style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div style={{ background: "var(--bg-card)", width: "100%", maxWidth: 520, borderRadius: 24, border: "1px solid var(--border-subtle)", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>

            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 10 }}>
                <MessageSquare size={18} color="#38bdf8" /> Histórico de Atendimento
              </h2>
              <button onClick={() => { setModalHistoricoLeadId(null); setNovoHistorico(""); }} style={{ background: "transparent", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "10px 24px", background: "rgba(56,189,248,0.05)", borderBottom: "1px solid var(--border-subtle)" }}>
              <p style={{ fontSize: 13, color: "var(--gray-light)" }}>
                Cliente: <strong style={{ color: "white" }}>{modalHistoricoLead.nome}</strong>
                <span style={{ color: "var(--gray-dark)", marginLeft: 8 }}>• {modalHistoricoLead.empreendimentoNome}</span>
              </p>
            </div>

            {/* Feed de entradas */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {(modalHistoricoLead.historicoAtendimento || []).length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center" }}>
                  <MessageSquare size={28} color="var(--gray-dark)" style={{ margin: "0 auto 12px" }} />
                  <p style={{ color: "var(--gray-mid)", fontSize: 13 }}>Nenhuma anotação ainda.</p>
                  <p style={{ color: "var(--gray-dark)", fontSize: 12, marginTop: 4 }}>Publique a primeira atualização sobre este cliente.</p>
                </div>
              ) : (
                [...(modalHistoricoLead.historicoAtendimento || [])].reverse().map((entrada, idx) => (
                  <div key={idx} style={{ padding: "14px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8" }}>{entrada.autorNome}</span>
                      <span style={{ fontSize: 11, color: "var(--gray-dark)" }}>
                        {new Date(entrada.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " às")}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.6 }}>{entrada.texto}</p>
                  </div>
                ))
              )}
            </div>

            {/* Input nova anotação */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 10, background: "rgba(0,0,0,0.1)" }}>
              <textarea
                value={novoHistorico}
                onChange={e => setNovoHistorico(e.target.value)}
                placeholder="Ex: Cliente confirmou interesse, aguardando extrato bancário..."
                style={{ width: "100%", minHeight: 72, padding: "10px 14px", borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-active)", color: "white", fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.6 }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={publicarHistorico}
                  disabled={!novoHistorico.trim() || salvandoHistorico}
                  style={{ padding: "10px 20px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 13, cursor: !novoHistorico.trim() || salvandoHistorico ? "not-allowed" : "pointer", transition: "0.2s", display: "flex", alignItems: "center", gap: 8, background: novoHistorico.trim() ? "#38bdf8" : "rgba(56,189,248,0.15)", color: novoHistorico.trim() ? "#082f49" : "#38bdf8" }}
                >
                  <MessageSquare size={14} />
                  {salvandoHistorico ? "Publicando..." : "Publicar Anotação"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

{/* MODAL: STATUS DO LEAD (APROVADO / REPROVADO) */}
      {modalStatusCorretor && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setModalStatusCorretor(null); }} style={{ position: "fixed", inset: 0, zIndex: 160, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-card)", width: "100%", maxWidth: 460, borderRadius: 20, overflow: "hidden", border: (modalStatusCorretor.status === "qualificado" || modalStatusCorretor.status === "credito_aprovado") ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(239,68,68,0.3)" }}>
            <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: (modalStatusCorretor.status === "qualificado" || modalStatusCorretor.status === "credito_aprovado") ? "1px solid rgba(74,222,128,0.2)" : "1px solid rgba(239,68,68,0.2)", background: (modalStatusCorretor.status === "qualificado" || modalStatusCorretor.status === "credito_aprovado") ? "rgba(74,222,128,0.06)" : "rgba(239,68,68,0.06)" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, color: (modalStatusCorretor.status === "qualificado" || modalStatusCorretor.status === "credito_aprovado") ? "#4ade80" : "#f87171" }}>
                  {(modalStatusCorretor.status === "qualificado" || modalStatusCorretor.status === "credito_aprovado")
                    ? <><CheckCircle2 size={18} /> Crédito Aprovado</>
                    : <><Lock size={18} /> Crédito Reprovado</>}
                </h3>
                <p style={{ fontSize: 12, color: "var(--gray-mid)", marginTop: 4 }}>Cliente: <strong style={{ color: "var(--gray-light)" }}>{modalStatusCorretor.nome}</strong></p>
              </div>
              <button onClick={() => setModalStatusCorretor(null)} style={{ background: "none", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {(modalStatusCorretor.status === "qualificado" || modalStatusCorretor.status === "credito_aprovado") ? (
                modalStatusCorretor.creditoAprovadoInfo ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                        <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Valor Liberado</p>
                        <p style={{ fontSize: 18, fontWeight: 800, color: "white" }}>R$ {modalStatusCorretor.creditoAprovadoInfo.valorAprovado?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                        <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Parcela Estimada</p>
                        <p style={{ fontSize: 18, fontWeight: 800, color: "white" }}>R$ {modalStatusCorretor.creditoAprovadoInfo.valorParcela?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    {modalStatusCorretor.creditoAprovadoInfo.observacoes && (
                      <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border-subtle)", borderLeft: "3px solid rgba(74,222,128,0.4)" }}>
                        <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Condicionantes</p>
                        <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.6 }}>{modalStatusCorretor.creditoAprovadoInfo.observacoes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: "14px 16px", background: "rgba(74,222,128,0.06)", borderRadius: 10, border: "1px solid rgba(74,222,128,0.15)" }}>
                    <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.6 }}>Este lead foi <strong style={{ color: "#4ade80" }}>qualificado</strong> e está pronto para avançar no financiamento.</p>
                  </div>
                )
              ) : (
                modalStatusCorretor.motivoReprovacao ? (
                  <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border-subtle)", borderLeft: "3px solid rgba(239,68,68,0.4)" }}>
                    <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: (modalStatusCorretor as any).origemDesqualificacao === "corretor" ? "#fb923c" : "var(--gray-mid)" }}>
                      {(modalStatusCorretor as any).origemDesqualificacao === "corretor" ? "Desqualificado pelo Corretor" : "Reprovado pela Análise de Crédito"}
                    </p>
                    <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.6 }}>{modalStatusCorretor.motivoReprovacao}</p>
                  </div>
                ) : (
                  <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px dashed var(--border-subtle)" }}>
                    <p style={{ fontSize: 13, color: "var(--gray-dark)", fontStyle: "italic" }}>Nenhum motivo foi registrado.</p>
                  </div>
                )
              )}
              <button onClick={() => setModalStatusCorretor(null)} style={{ padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "white", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* DOSSIÊ FLUTUANTE */}
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
                Modo de visualização. Apenas para acompanhamento de vendas.
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
                onLoteClick={() => {}} // Read-only, sem ação ao clicar
              />
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL DE MAPA INTERATIVO (RESERVA DE LOTES)
          ========================================================= */}
      {mapaModalAberto.aberto && mapaModalAberto.empreendimento && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column" }}>
          
          {/* Header do Mapa */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(15,30,22,0.95)" }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
                <MapIcon size={20} color="var(--terracota)" /> 
                Mapa Interativo — {mapaModalAberto.empreendimento.nome}
              </h2>
              <p style={{ fontSize: 13, color: "var(--gray-mid)", marginTop: 4 }}>
                Selecione um lote disponível (Verde) para reservar para <strong style={{ color: "var(--gray-light)" }}>{mapaModalAberto.lead?.nome}</strong>.
              </p>
            </div>
            <button onClick={() => setMapaModalAberto({ aberto: false, empreendimento: null, lead: null })} style={{ padding: 8, background: "rgba(255,255,255,0.1)", borderRadius: 8, border: "none", color: "white", cursor: "pointer" }}>
              <X size={20} />
            </button>
          </div>

          {/* Corpo do Mapa */}
          <div style={{ flex: 1, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
            {loadingLotes ? (
              <div style={{ color: "var(--terracota)", fontWeight: 700, animation: "pulse 2s infinite" }}>Sincronizando lotes do servidor...</div>
            ) : (
              <MapaInterativo 
                mapaUrl={mapaModalAberto.empreendimento.mapaUrl || ""} 
                lotes={lotesMapa} 
                onLoteClick={handleLoteClick} 
              />
            )}
          </div>
        </div>
      )}

      {/* MODAL DE SELEÇÃO DE MODELO (Aparece sobre o mapa) */}
      {loteParaReservar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-card)", padding: 30, borderRadius: 20, width: "100%", maxWidth: 400, textAlign: "center", border: "1px solid var(--border-subtle)" }}>
            <Home size={40} color="var(--terracota)" style={{ marginBottom: 16 }} />
            <h3 style={{ color: "white", fontSize: 18, fontWeight: 800 }}>Lote {loteParaReservar.numero}</h3>
            <p style={{ color: "var(--gray-mid)", marginBottom: 24 }}>Escolha o modelo de casa para este cliente:</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mapaModalAberto.empreendimento?.modelos?.map((modelo: any, idx: number) => (
                <button 
                  key={idx} 
                  onClick={() => confirmarReservaComModelo(modelo.nome, modelo.valor)} 
                  style={{ padding: 16, background: "var(--terracota)", color: "white", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 15, transition: "0.2s" }}
                >
                  {modelo.nome} — {formatBRL(modelo.valor)}
                </button>
              ))}
              {(!mapaModalAberto.empreendimento?.modelos || mapaModalAberto.empreendimento.modelos.length === 0) && (
                <p style={{ color: "var(--gray-mid)", fontSize: 13 }}>Nenhum modelo cadastrado neste empreendimento.</p>
              )}
              <button onClick={() => setLoteParaReservar(null)} style={{ background: "transparent", border: "none", color: "var(--gray-dark)", cursor: "pointer", marginTop: 10, fontWeight: 600 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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