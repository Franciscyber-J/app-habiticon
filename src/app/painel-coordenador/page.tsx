"use client";

import { CorrespondenteTag } from "@/components/shared/CorrespondenteTag";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, updateDoc, arrayUnion } from "firebase/firestore";
import Image from "next/image";
import { Users, LogOut, MessageCircle, Building2, Flame, FolderOpen, FileText, BarChart3, Filter, X, Map as MapIcon, Lock, CheckCircle2, ShieldCheck, Phone, Clock, MessageSquare, Briefcase, Info, Home, Trash2, AlertTriangle } from "lucide-react";
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
  vendaEmOrdem?: boolean;
  modelos?: any[];
  documentosPadrao?: DocumentoPadrao[];
}

export default function PainelCoordenador() {
  const [authVerificado, setAuthVerificado] = useState(false);
  const [todosLeads, setTodosLeads] = useState<LeadData[]>([]);
  const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([]);
  const [listaCorretores, setListaCorretores] = useState<any[]>([]);
  const [userName, setUserName] = useState("");
  const [empreendimentosPermitidos, setEmpreendimentosPermitidos] = useState<string[]>([]);
  const [acessoConfigurado, setAcessoConfigurado] = useState(false);
  const [vetudo, setVetudo] = useState(false); // admin / e-mail supremo vê tudo
  const [abaAtiva, setAbaAtiva] = useState<"gestao" | "corretores" | "arquivos">("gestao");
  
  // Filtros Avançados
  const [filtroCorretor, setFiltroCorretor] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("ativos");
  const [pesquisaNome, setPesquisaNome] = useState("");

  const [leadDossieId, setLeadDossieId] = useState<string | null>(null);
  const leadDossieSelecionado = todosLeads.find(l => l.id === leadDossieId) || null;

  // Estados do Mapa de Lotes (Visão Geral - Coordenador)
  const [mapaVisaoGeral, setMapaVisaoGeral] = useState<{ aberto: boolean, empreendimento: Empreendimento | null }>({ aberto: false, empreendimento: null });
  const [lotesVisaoGeral, setLotesVisaoGeral] = useState<any[]>([]);
  const [loadingVisaoGeral, setLoadingVisaoGeral] = useState(false);
  const [loteDetalhe, setLoteDetalhe] = useState<any | null>(null);
  const [modalStatusCoordenador, setModalStatusCoordenador] = useState<LeadData | null>(null);

  // Lista de correspondentes (para o modal de funções)
  const [listaCorrespondentes, setListaCorrespondentes] = useState<any[]>([]);

  // Histórico
  const [modalHistoricoId, setModalHistoricoId] = useState<string | null>(null);
  const modalHistoricoLead = todosLeads.find(l => l.id === modalHistoricoId) || null;
  const [novoHistorico, setNovoHistorico] = useState("");
  const [salvandoHistorico, setSalvandoHistorico] = useState(false);

  // Acesso de correspondentes por lead
  const [modalAcessoLead, setModalAcessoLead] = useState<LeadData | null>(null);
  const [salvandoAcesso, setSalvandoAcesso] = useState(false);

  // Mapa de reserva de lote
  const [mapaReserva, setMapaReserva] = useState<{aberto: boolean, empreendimento: any | null, lead: LeadData | null}>({aberto: false, empreendimento: null, lead: null});
  const [lotesReserva, setLotesReserva] = useState<any[]>([]);
  const [loadingReserva, setLoadingReserva] = useState(false);
  const [loteParaReservar, setLoteParaReservar] = useState<any | null>(null);

  // Lixeira (soft-delete)
  const [leadParaExcluir, setLeadParaExcluir] = useState<LeadData | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState<string>("");
  const [motivoTextoLivre, setMotivoTextoLivre] = useState<string>("");
  const [salvandoExclusao, setSalvandoExclusao] = useState(false);

  // Gestão de acesso de corretores (item 1)
  const [modalAcessoCorretor, setModalAcessoCorretor] = useState<any | null>(null);
  const [salvandoAcessoCorretor, setSalvandoAcessoCorretor] = useState(false);
  const [buscaCorretor, setBuscaCorretor] = useState("");

  const router = useRouter();

  // Motivos de exclusão (seleção única)
  const MOTIVOS_EXCLUSAO = [
    { id: "duplicado",        label: "Lead duplicado" },
    { id: "dados_incorretos", label: "Dados cadastrais incorretos" },
    { id: "contato_invalido", label: "Contato inválido / inexistente" },
    { id: "teste",            label: "Teste / cadastro acidental" },
    { id: "desistiu",         label: "Cliente desistiu / sem interesse real" },
    { id: "lgpd",             label: "Solicitação do cliente (LGPD)" },
    { id: "outro",            label: "Outro motivo" },
  ];

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
          if (userData.role === "admin") {
            // Admin vê tudo
            setVetudo(true);
            setAcessoConfigurado(true);
          } else {
            setEmpreendimentosPermitidos(Array.isArray(userData.empreendimentosPermitidos) ? userData.empreendimentosPermitidos : []);
            setAcessoConfigurado(userData.acessoConfigurado === true);
          }
          setAuthVerificado(true);
        } else {
          // Fallback para o seu e-mail supremo caso o documento não exista
          if (user.email === "contax002@gmail.com") {
            setUserName("Administrador Supremo");
            setVetudo(true);
            setAcessoConfigurado(true);
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
        vendaEmOrdem: d.data().vendaEmOrdem,
        modelos: d.data().modelos || [],
        documentosPadrao: d.data().documentosPadrao || [] 
      })));
    };
    fetchEmps();
  }, []);

  // ── CARREGAR CORRESPONDENTES (para o modal de funções por lead) ──
  useEffect(() => {
    if (!authVerificado) return;
    const q = query(collection(db, "usuarios"), where("status", "==", "ativo"), where("role", "==", "correspondente"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setListaCorrespondentes(data);
    }, () => {});
    return () => unsub();
  }, [authVerificado]);

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

  // ── PERMISSÃO POR EMPREENDIMENTO ──
  const podeVerEmp = useMemo(() => {
    return (slug: string) => vetudo || empreendimentosPermitidos.includes(slug);
  }, [vetudo, empreendimentosPermitidos]);

  // Leads restritos aos empreendimentos liberados (base de tudo) — exclui os que estão na lixeira
  const leadsPermitidos = useMemo(() => {
    const base = todosLeads.filter(l => !(l as any).excluido);
    if (vetudo) return base;
    return base.filter(l => empreendimentosPermitidos.includes(l.empreendimentoId));
  }, [todosLeads, vetudo, empreendimentosPermitidos]);

  // Corretores restritos: só os que têm ao menos 1 empreendimento em comum com o coordenador
  const corretoresPermitidos = useMemo(() => {
    if (vetudo) return listaCorretores;
    return listaCorretores.filter(c => {
      const permC: string[] = Array.isArray(c.empreendimentosPermitidos) ? c.empreendimentosPermitidos : [];
      return permC.some(slug => empreendimentosPermitidos.includes(slug));
    });
  }, [listaCorretores, vetudo, empreendimentosPermitidos]);

  // Empreendimentos restritos (para a aba de materiais)
  const empreendimentosPermitidosLista = useMemo(() => {
    if (vetudo) return empreendimentos;
    return empreendimentos.filter(e => empreendimentosPermitidos.includes(e.slug));
  }, [empreendimentos, vetudo, empreendimentosPermitidos]);

  // ── LÓGICA DE FILTRAGEM (agora partindo de leadsPermitidos) ──
  const leadsFiltrados = useMemo(() => {
    return leadsPermitidos.filter(lead => {
      const matchCorretor = filtroCorretor === "todos" || 
                            (filtroCorretor === "roleta" && !lead.corretorId) || 
                            lead.corretorId === filtroCorretor;
      const isAtivo = !lead.status || lead.status === "novo" || lead.status === "em_atendimento" || lead.status === "com_pendencia";
      const matchStatus = filtroStatus === "todos" || 
                          (filtroStatus === "ativos" && isAtivo) ||
                          (filtroStatus === "aprovados" && (lead.status === "qualificado" || lead.status === "credito_aprovado")) ||
                          (filtroStatus === "reprovados" && (lead.status === "nao_qualificado" || lead.status === "credito_reprovado" || lead.status === "desqualificado")) ||
                          lead.status === filtroStatus;
      const matchNome = lead.nome.toLowerCase().includes(pesquisaNome.toLowerCase());
      
      return matchCorretor && matchStatus && matchNome;
    });
  }, [leadsPermitidos, filtroCorretor, filtroStatus, pesquisaNome]);

  // Agrupa os leads filtrados por empreendimento
  const leadsAgrupados = useMemo(() => {
    return leadsFiltrados.reduce((acc, lead) => {
      const empId = lead.empreendimentoId || "sem-empreendimento";
      const empNome = lead.empreendimentoNome || "Outros Atendimentos";
      if (!acc[empId]) acc[empId] = { nome: empNome, leads: [] };
      acc[empId].leads.push(lead);
      return acc;
    }, {} as Record<string, { nome: string; leads: LeadData[] }>);
  }, [leadsFiltrados]);

  const leadsNaRoleta = leadsPermitidos.filter(l => !l.corretorId).length;
  const leadsAprovados = leadsPermitidos.filter(l => l.status === "qualificado" || l.status === "credito_aprovado").length;

  // ── HISTÓRICO ──
  const publicarHistorico = async () => {
    if (!modalHistoricoLead || !novoHistorico.trim()) return;
    setSalvandoHistorico(true);
    try {
      const entrada = {
        texto: novoHistorico.trim(),
        autorNome: userName || "Coordenador",
        autorId: auth.currentUser?.uid || "coordenador",
        timestamp: new Date().toISOString()
      };
      const historicoAtual = (modalHistoricoLead as any).historicoAtendimento || [];
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

  // ── FUNÇÕES POR CORRESPONDENTE (igual admin) ──
  const toggleFuncaoCorrespondente = async (correspondentId: string, funcao: 'correspondencia' | 'consultoria', novoValor: boolean) => {
    if (!modalAcessoLead) return;
    setSalvandoAcesso(true);
    try {
      const correspondente = listaCorrespondentes.find(c => c.id === correspondentId);
      const permitidosAtuais = (modalAcessoLead as any).correspondentesPermitidos || [];
      const infoAtuais = (modalAcessoLead as any).correspondentesInfo || [];

      const infoNormalizada = listaCorrespondentes
        .filter(c => permitidosAtuais.includes(c.id))
        .map(c => {
          const ex = infoAtuais.find((i: any) => i.id === c.id);
          return {
            id: c.id,
            nome: c.nome,
            telefone: ex?.telefone || c.telefone || "",
            correspondencia: ex ? (ex.correspondencia ?? true) : true,
            consultoria: ex ? (ex.consultoria ?? false) : false,
          };
        });

      const entradaExistente = infoNormalizada.find(c => c.id === correspondentId);
      let novasInfos: any[];

      if (entradaExistente) {
        const atualizada = { ...entradaExistente, [funcao]: novoValor };
        if (!atualizada.correspondencia && !atualizada.consultoria) {
          novasInfos = infoNormalizada.filter(c => c.id !== correspondentId);
        } else {
          novasInfos = infoNormalizada.map(c => c.id === correspondentId ? atualizada : c);
        }
      } else if (novoValor) {
        novasInfos = [
          ...infoNormalizada,
          {
            id: correspondentId,
            nome: correspondente?.nome || correspondentId,
            telefone: correspondente?.telefone || "",
            correspondencia: funcao === 'correspondencia',
            consultoria: funcao === 'consultoria',
          },
        ];
      } else {
        setSalvandoAcesso(false);
        return;
      }

      const novosPermitidos = novasInfos.map(c => c.id);
      await updateDoc(doc(db, "leads", modalAcessoLead.id), {
        correspondentesPermitidos: novosPermitidos,
        correspondentesInfo: novasInfos,
      });
      setModalAcessoLead(prev => prev ? { ...prev, correspondentesPermitidos: novosPermitidos, correspondentesInfo: novasInfos } as any : null);
    } catch (error) {
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setSalvandoAcesso(false);
    }
  };

  // ── MAPA: RESERVA DE LOTE (igual corretor — reserva na fila) ──
  const abrirMapaReserva = async (lead: LeadData) => {
    const emp = empreendimentos.find(e => e.slug === lead.empreendimentoId) || null;
    if (!emp || !emp.mapaUrl) {
      alert("Este empreendimento ainda não tem um mapa SVG configurado.");
      return;
    }
    setMapaReserva({ aberto: true, empreendimento: emp, lead });
    setLoadingReserva(true);

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
              if (index >= 0) lotesTemp[index] = loteTratado;
              else lotesTemp.push(loteTratado);
            });
            setLotesReserva([...lotesTemp]);
            resolve();
          });
        });
      });
      Promise.all(promises).then(() => setLoadingReserva(false));
    });
  };

  const handleLoteClickReserva = (lote: any) => {
    const { empreendimento, lead } = mapaReserva;
    if (!empreendimento || !lead) return;
    if (lote.status === "bloqueado") { alert("Este lote ou a sua quadra estão bloqueados."); return; }
    if (lote.status === "vendido") { alert("Este lote já foi vendido."); return; }
    if (empreendimento.vendaEmOrdem && lote.adjacentes && lote.adjacentes.length > 0) {
      const adjacenteVendido = lotesReserva.some(l => lote.adjacentes.includes(l.svgPathId) && l.status === "vendido");
      if (!adjacenteVendido) { alert("Pela regra de venda sequencial, só pode reservar se um lote vizinho já estiver vendido."); return; }
    }
    const jaNaFila = lote.fila?.some((f: any) => f.leadId === lead.id);
    if (jaNaFila) { alert("Este cliente já está na fila deste lote."); return; }
    setLoteParaReservar(lote);
  };

  const confirmarReservaComModelo = async (modeloNome: string, valor: number) => {
    const { empreendimento, lead } = mapaReserva;
    const lote = loteParaReservar;
    if (!empreendimento || !lead || !lote) return;
    try {
      const novoFilaItem = {
        leadId: lead.id, nomeCliente: lead.nome, corretorId: lead.corretorId || "",
        nomeCorretor: lead.nomeCorretor || "Coordenação", modeloCasa: modeloNome, valorVenda: valor,
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
      setMapaReserva({ aberto: false, empreendimento: null, lead: null });
    } catch (error) {
      alert("Erro ao processar reserva.");
    }
  };

  // ── LIXEIRA (SOFT-DELETE) — coordenador envia para a lixeira ──
  const abrirModalExcluir = (lead: LeadData) => {
    setLeadParaExcluir(lead);
    setMotivoExclusao("");
    setMotivoTextoLivre("");
  };

  const confirmarExclusao = async () => {
    if (!leadParaExcluir || !motivoExclusao) return;
    if (motivoExclusao === "outro" && !motivoTextoLivre.trim()) return;
    setSalvandoExclusao(true);
    try {
      const motivoObj = MOTIVOS_EXCLUSAO.find(m => m.id === motivoExclusao);
      await updateDoc(doc(db, "leads", leadParaExcluir.id), {
        excluido: true,
        excluidoInfo: {
          motivo: motivoExclusao,
          motivoLabel: motivoObj?.label || motivoExclusao,
          motivoTexto: motivoTextoLivre.trim(),
          por: auth.currentUser?.uid || "coordenador",
          porNome: userName || "Coordenador",
          quando: new Date().toISOString(),
        }
      });
      setLeadParaExcluir(null);
      setMotivoExclusao("");
      setMotivoTextoLivre("");
    } catch (error) {
      console.error("FALHA AO EXCLUIR (lixeira):", error);
      alert("Erro ao mover para a lixeira. Tente novamente. Detalhe: " + ((error as any)?.code || (error as any)?.message || "desconhecido"));
    } finally {
      setSalvandoExclusao(false);
    }
  };

  // ── GESTÃO DE ACESSO DO CORRETOR (item 1) — só mexe nos empreendimentos do coordenador ──
  const toggleEmpreendimentoCorretor = async (empSlug: string) => {
    if (!modalAcessoCorretor) return;
    // Segurança: o coordenador só pode mexer no que ele mesmo tem acesso
    if (!vetudo && !empreendimentosPermitidos.includes(empSlug)) {
      alert("Você não tem acesso a este empreendimento. Apenas o administrador pode liberá-lo.");
      return;
    }
    setSalvandoAcessoCorretor(true);
    try {
      const corretor = modalAcessoCorretor;
      const permitidosAtuais: string[] = Array.isArray(corretor.empreendimentosPermitidos) ? corretor.empreendimentosPermitidos : [];
      const jaPermitido = permitidosAtuais.includes(empSlug);
      const novosPermitidos = jaPermitido
        ? permitidosAtuais.filter(s => s !== empSlug)
        : [...permitidosAtuais, empSlug];

      await updateDoc(doc(db, "usuarios", corretor.id), {
        empreendimentosPermitidos: novosPermitidos,
        acessoConfigurado: true,
      });

      const atualizado = { ...corretor, empreendimentosPermitidos: novosPermitidos, acessoConfigurado: true };
      setModalAcessoCorretor(atualizado);
      setListaCorretores(prev => prev.map(c => c.id === corretor.id ? atualizado : c));
    } catch (error) {
      alert("Erro ao salvar o acesso. Tente novamente.");
    } finally {
      setSalvandoAcessoCorretor(false);
    }
  };

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

        {!vetudo && !acessoConfigurado ? (
          <div style={{ padding: "64px 28px", textAlign: "center", background: "var(--bg-card)", borderRadius: 20, border: "1px dashed rgba(96,165,250,0.3)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Lock size={28} color="#60a5fa" />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "white", marginBottom: 8 }}>Acesso pendente de liberação</h2>
              <p style={{ fontSize: 14, color: "var(--gray-mid)", lineHeight: 1.6, maxWidth: 460 }}>
                Sua conta de coordenação ainda não tem empreendimentos liberados. Solicite ao <strong style={{ color: "#60a5fa" }}>administrador</strong> que habilite os empreendimentos que você irá acompanhar. Assim que liberado, seus leads e equipe aparecerão aqui automaticamente.
              </p>
            </div>
          </div>
        ) : (
        <>

        {/* DASHBOARD RÁPIDO */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
          <div style={{ padding: "18px 16px 16px", background: "rgba(175,111,83,0.08)", border: "1px solid rgba(175,111,83,0.2)", borderRadius: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(175,111,83,0.15)", border: "1px solid rgba(175,111,83,0.3)" }}>
                <Users size={16} color="var(--terracota)" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total de Leads</span>
            </div>
            <p style={{ fontSize: 36, fontWeight: 800, color: "var(--terracota)", lineHeight: 1 }}>{leadsPermitidos.length}</p>
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
          <button
            onClick={() => { setAbaAtiva("gestao"); setFiltroStatus("aprovados"); }}
            title="Ver leads aprovados / qualificados"
            style={{ textAlign: "left", padding: "18px 16px 16px", background: filtroStatus === "aprovados" ? "rgba(74,222,128,0.15)" : "rgba(74,222,128,0.08)", border: filtroStatus === "aprovados" ? "1px solid rgba(74,222,128,0.5)" : "1px solid rgba(74,222,128,0.2)", borderRadius: 16, cursor: "pointer", transition: "0.2s" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)" }}>
                <BarChart3 size={16} color="#4ade80" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Aprovados / Vendidos</span>
            </div>
            <p style={{ fontSize: 36, fontWeight: 800, color: "#4ade80", lineHeight: 1 }}>{leadsAprovados}</p>
          </button>
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
            onClick={() => setAbaAtiva("corretores")}
            style={{ flex: "1 1 min-content", padding: "12px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap", background: abaAtiva === "corretores" ? "rgba(96,165,250,0.15)" : "transparent", color: abaAtiva === "corretores" ? "#60a5fa" : "var(--gray-mid)" }}
          >
            <Users size={18} /> Corretores
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
                  {corretoresPermitidos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Status do Cliente</label>
                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="input-field" style={{ height: 42, fontSize: 13, padding: "0 12px" }}>
                  <option value="ativos">🟢 Em Andamento (Novos + Atendimento)</option>
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

            {/* LISTAGEM DE LEADS AGRUPADA POR EMPREENDIMENTO */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <p style={{ fontSize: 13, color: "var(--gray-mid)", paddingLeft: 8 }}>Exibindo <strong>{leadsFiltrados.length}</strong> clientes.</p>
              
              {leadsFiltrados.length === 0 ? (
                 <div style={{ padding: "40px", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
                   <p style={{ color: "var(--gray-mid)" }}>Nenhum lead encontrado com estes filtros.</p>
                 </div>
              ) : (
                Object.entries(leadsAgrupados).map(([empId, grupo]) => (
                  <div key={empId}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <Building2 size={16} color="var(--terracota)" />
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-light)" }}>{grupo.nome}</h3>
                      <span style={{ fontSize: 12, color: "var(--gray-dark)" }}>({grupo.leads.length})</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {grupo.leads.map((lead) => {
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
                              {lead.correspondentesInfo && lead.correspondentesInfo.length > 0 &&
  (lead.correspondentesInfo as any[])
    .filter((c: any) => (c.correspondencia ?? true) || (c.consultoria ?? false))
    .map((c: any) => <CorrespondenteTag key={c.id} c={c} />)
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
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "9px 20px", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                        {/* Funções por Correspondente */}
                        {listaCorrespondentes.length > 0 && (() => {
                          const qtdLib = ((lead as any).correspondentesPermitidos || []).length;
                          return (
                            <button onClick={() => { const fresco = todosLeads.find(l => l.id === lead.id) || lead; setModalAcessoLead(fresco); }} title="Gerir acesso dos correspondentes" style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", background: qtdLib === 0 ? "rgba(239,68,68,0.06)" : "rgba(74,222,128,0.06)", border: qtdLib === 0 ? "1px solid rgba(239,68,68,0.15)" : "1px solid rgba(74,222,128,0.15)", color: qtdLib === 0 ? "#f87171" : "#4ade80" }}>
                              <ShieldCheck size={12} /> {qtdLib > 0 ? `${qtdLib} lib.` : "Acesso fechado"}
                            </button>
                          );
                        })()}

                        {/* Vincular Lote */}
                        {!(lead as any).loteReserva?.numero && lead.status !== "nao_qualificado" && lead.status !== "credito_reprovado" && (
                          <button onClick={() => abrirMapaReserva(lead)} style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--gray-light)" }}>
                            <MapIcon size={12} /> Vincular Lote
                          </button>
                        )}

                        {/* Histórico */}
                        <button onClick={() => setModalHistoricoId(lead.id)} style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--gray-light)" }}>
                          <MessageSquare size={12} /> Histórico
                          {((lead as any).historicoAtendimento || []).length > 0 && (
                            <span style={{ fontSize: 9, fontWeight: 800, background: "#38bdf8", color: "#082f49", padding: "1px 5px", borderRadius: 100 }}>
                              {((lead as any).historicoAtendimento || []).length}
                            </span>
                          )}
                        </button>

                        {/* Dossiê */}
                        <button onClick={() => setLeadDossieId(lead.id)} style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--gray-light)" }}>
                          <FolderOpen size={12} /> Dossiê
                        </button>

                        {/* Simulação */}
                        {lead.propostaUrl && (
                          <a href={lead.propostaUrl} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--gray-light)", textDecoration: "none" }}>
                            <FileText size={12} /> Simulação
                          </a>
                        )}

                        <div style={{ flex: 1 }} />
                        <a href={`https://wa.me/55${(lead.whatsapp || "").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.15)", color: "#4ade80", textDecoration: "none" }}>
                          <MessageCircle size={12} /> WhatsApp
                        </a>
                        <button onClick={() => abrirModalExcluir(lead)} title="Mover para a lixeira" style={{ padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "flex", gap: 4, alignItems: "center", cursor: "pointer", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171" }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ABA: CORRETORES (gestão de acesso pelo coordenador) */}
        {abaAtiva === "corretores" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: "rgba(96,165,250,0.08)", padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(96,165,250,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
              <ShieldCheck size={18} color="#60a5fa" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.5 }}>
                Libere ou desligue o acesso dos corretores aos <strong style={{ color: "#60a5fa" }}>seus</strong> empreendimentos. Empreendimentos que você não coordena aparecem bloqueados — somente o administrador os gere.
              </p>
            </div>

            <div style={{ position: "relative" }}>
              <input type="text" placeholder="Buscar corretor por nome..." value={buscaCorretor} onChange={e => setBuscaCorretor(e.target.value)} className="input-field" style={{ height: 44, fontSize: 13, padding: "0 14px" }} />
              {buscaCorretor && <button onClick={() => setBuscaCorretor("")} style={{ position: "absolute", right: 12, top: 13, background: "transparent", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={16} /></button>}
            </div>

            {(() => {
              const corretoresLista = listaCorretores.filter(c => {
                // Filtro por busca de nome
                if (!(c.nome || "").toLowerCase().includes(buscaCorretor.toLowerCase())) return false;
                // Admin/email supremo vê todos
                if (vetudo) return true;
                // Coordenador: vê corretores que TÊM ou SOLICITARAM algum dos empreendimentos dele
                const permC: string[] = Array.isArray(c.empreendimentosPermitidos) ? c.empreendimentosPermitidos : [];
                const solicC: string[] = Array.isArray(c.empreendimentosSolicitados) ? c.empreendimentosSolicitados : [];
                const relacionados = [...permC, ...solicC];
                return relacionados.some(slug => empreendimentosPermitidos.includes(slug));
              });
              if (corretoresLista.length === 0) {
                return (
                  <div style={{ padding: "48px 24px", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
                    <p style={{ fontSize: 14, color: "var(--gray-mid)" }}>Nenhum corretor encontrado.</p>
                  </div>
                );
              }
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                  {corretoresLista.map(corretor => {
                    const permitidos: string[] = Array.isArray(corretor.empreendimentosPermitidos) ? corretor.empreendimentosPermitidos : [];
                    const solicitados: string[] = Array.isArray(corretor.empreendimentosSolicitados) ? corretor.empreendimentosSolicitados : [];
                    const configurado = corretor.acessoConfigurado === true;
                    // Empreendimentos do coordenador que o corretor solicitou mas ainda não tem acesso
                    const pendentesNoMeu = solicitados.filter(s => (vetudo || empreendimentosPermitidos.includes(s)) && !permitidos.includes(s));
                    return (
                      <div key={corretor.id} style={{ background: "var(--bg-card)", border: pendentesNoMeu.length > 0 ? "1px solid rgba(251,146,60,0.4)" : "1px solid var(--border-subtle)", borderRadius: 16, overflow: "hidden" }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.15)", display: "flex", gap: 12, alignItems: "center" }}>
                          <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(96,165,250,0.15)", color: "#60a5fa", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, border: "1px solid rgba(96,165,250,0.3)", flexShrink: 0 }}>
                            {(corretor.nome || "?")[0].toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{corretor.nome}</h3>
                            <p style={{ fontSize: 11, color: "var(--gray-mid)" }}>CRECI: {corretor.creci || "—"}</p>
                          </div>
                        </div>
                        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                          {!configurado && (
                            <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)" }}>
                              <p style={{ fontSize: 11, color: "#fb923c", fontWeight: 600 }}>⚠ Aguardando liberação de acesso.</p>
                            </div>
                          )}
                          {pendentesNoMeu.length > 0 && (
                            <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)" }}>
                              <p style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600 }}>Solicitou acesso a {pendentesNoMeu.length} dos seus empreendimentos.</p>
                            </div>
                          )}
                          <p style={{ fontSize: 11, color: "var(--gray-dark)" }}>
                            Liberados: <strong style={{ color: "var(--gray-light)" }}>{permitidos.length}</strong> no total
                            {!vetudo && (
                              <> · <strong style={{ color: "#60a5fa" }}>{permitidos.filter(s => empreendimentosPermitidos.includes(s)).length}</strong> com você</>
                            )}
                          </p>
                          <button
                            onClick={() => setModalAcessoCorretor(corretor)}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 10, cursor: "pointer", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)", color: "#60a5fa", fontSize: 12, fontWeight: 700 }}
                          >
                            <Building2 size={14} /> Gerir Acesso
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ABA 2: MATERIAIS DE VENDAS E MAPAS */}
        {abaAtiva === "arquivos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {empreendimentosPermitidosLista.map((emp) => {
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

        </>
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

      {/* DOSSIÊ FLUTUANTE (COORDENADOR — edita ficha e adiciona docs, não remove consolidados) */}
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

      {/* MODAL: HISTÓRICO DE ATENDIMENTO (COORDENADOR) */}
      {modalHistoricoId !== null && modalHistoricoLead && (
        <div onClick={(e) => { if (e.target === e.currentTarget) { setModalHistoricoId(null); setNovoHistorico(""); } }} style={{ position: "fixed", inset: 0, zIndex: 210, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-card)", width: "100%", maxWidth: 540, borderRadius: 24, border: "1px solid var(--border-subtle)", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 10 }}>
                <MessageSquare size={18} color="#38bdf8" /> Histórico de Atendimento
              </h2>
              <button onClick={() => { setModalHistoricoId(null); setNovoHistorico(""); }} style={{ background: "transparent", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ padding: "10px 24px", background: "rgba(56,189,248,0.05)", borderBottom: "1px solid var(--border-subtle)" }}>
              <p style={{ fontSize: 13, color: "var(--gray-light)" }}>
                Cliente: <strong style={{ color: "white" }}>{modalHistoricoLead.nome}</strong>
                <span style={{ color: "var(--gray-dark)", marginLeft: 8 }}>• {modalHistoricoLead.empreendimentoNome}</span>
              </p>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {((modalHistoricoLead as any).historicoAtendimento || []).length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center" }}>
                  <MessageSquare size={28} color="var(--gray-dark)" style={{ margin: "0 auto 12px" }} />
                  <p style={{ color: "var(--gray-mid)", fontSize: 13 }}>Nenhuma anotação registrada para este cliente.</p>
                </div>
              ) : (
                [...((modalHistoricoLead as any).historicoAtendimento || [])].reverse().map((entrada: any, idx: number) => (
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
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 10, background: "rgba(0,0,0,0.1)" }}>
              <textarea value={novoHistorico} onChange={e => setNovoHistorico(e.target.value)} placeholder="Adicionar nota de acompanhamento..." style={{ width: "100%", minHeight: 72, padding: "10px 14px", borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-active)", color: "white", fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.6 }} />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={publicarHistorico} disabled={!novoHistorico.trim() || salvandoHistorico} style={{ padding: "10px 20px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 13, cursor: !novoHistorico.trim() || salvandoHistorico ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, background: novoHistorico.trim() ? "#38bdf8" : "rgba(56,189,248,0.15)", color: novoHistorico.trim() ? "#082f49" : "#38bdf8" }}>
                  <MessageSquare size={14} /> {salvandoHistorico ? "Publicando..." : "Publicar Nota"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FUNÇÕES POR CORRESPONDENTE (COORDENADOR) */}
      <AnimatePresence>
        {modalAcessoLead && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) setModalAcessoLead(null); }}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 20, width: "100%", maxWidth: 480, overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "rgba(0,0,0,0.2)" }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={18} color="#38bdf8" /> Funções por Correspondente</h3>
                  <p style={{ fontSize: 12, color: "var(--gray-mid)", marginTop: 4 }}>Lead: <strong style={{ color: "var(--gray-light)" }}>{modalAcessoLead.nome}</strong></p>
                </div>
                <button onClick={() => setModalAcessoLead(null)} style={{ background: "none", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={20} /></button>
              </div>
              <div style={{ padding: "16px 24px", background: "rgba(56,189,248,0.06)", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Info size={15} color="#38bdf8" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "var(--gray-light)", lineHeight: 1.6 }}>Defina a função de cada membro para este lead. <strong style={{ color: "#38bdf8" }}>CB</strong> = Correspondência bancária. <strong style={{ color: "#a78bfa" }}>Consultoria</strong> = Assessoria. Desligar ambos remove o acesso.</p>
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: "16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
                {listaCorrespondentes.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center" }}><p style={{ fontSize: 13, color: "var(--gray-dark)" }}>Nenhum correspondente cadastrado ainda.</p></div>
                ) : (
                  listaCorrespondentes.map((correspondente) => {
                    const permitidosAtuais = (modalAcessoLead as any).correspondentesPermitidos || [];
                    const infoAtual = ((modalAcessoLead as any).correspondentesInfo || []).find((c: any) => c.id === correspondente.id);
                    const estaPermitido = permitidosAtuais.includes(correspondente.id);
                    const correspondenciaAtiva = estaPermitido ? (infoAtual?.correspondencia ?? true) : false;
                    const consultoriaAtiva = infoAtual?.consultoria ?? false;
                    const temAcesso = correspondenciaAtiva || consultoriaAtiva;
                    return (
                      <div key={correspondente.id} style={{ padding: "14px 16px", borderRadius: 12, background: temAcesso ? "rgba(56,189,248,0.04)" : "rgba(255,255,255,0.02)", border: temAcesso ? "1px solid rgba(56,189,248,0.2)" : "1px solid var(--border-subtle)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, background: temAcesso ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.05)", color: temAcesso ? "#38bdf8" : "var(--gray-dark)", border: temAcesso ? "1px solid rgba(56,189,248,0.3)" : "1px solid var(--border-subtle)" }}>
                              {(correspondente.nome || "?")[0].toUpperCase()}
                            </div>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{correspondente.nome}</p>
                              <p style={{ fontSize: 11, color: "var(--gray-mid)", marginTop: 2 }}>{correspondente.email}</p>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button onClick={() => toggleFuncaoCorrespondente(correspondente.id, 'correspondencia', !correspondenciaAtiva)} disabled={salvandoAcesso} style={{ padding: "6px 12px", borderRadius: 8, cursor: salvandoAcesso ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 11, border: "none", background: correspondenciaAtiva ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.06)", color: correspondenciaAtiva ? "#38bdf8" : "var(--gray-dark)", opacity: salvandoAcesso ? 0.5 : 1, display: "flex", alignItems: "center", gap: 5 }}>
                              <ShieldCheck size={12} /> CB: {correspondenciaAtiva ? "LIGADO" : "DESLIGADO"}
                            </button>
                            <button onClick={() => toggleFuncaoCorrespondente(correspondente.id, 'consultoria', !consultoriaAtiva)} disabled={salvandoAcesso} style={{ padding: "6px 12px", borderRadius: 8, cursor: salvandoAcesso ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 11, border: "none", background: consultoriaAtiva ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.06)", color: consultoriaAtiva ? "#a78bfa" : "var(--gray-dark)", opacity: salvandoAcesso ? 0.5 : 1, display: "flex", alignItems: "center", gap: 5 }}>
                              <Briefcase size={12} /> Consultoria: {consultoriaAtiva ? "LIGADO" : "DESLIGADO"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setModalAcessoLead(null)} style={{ padding: "10px 20px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-subtle)", color: "white", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Fechar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: MAPA DE RESERVA DE LOTE (COORDENADOR) */}
      {mapaReserva.aberto && mapaReserva.empreendimento && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(15,30,22,0.95)" }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
                <MapIcon size={20} color="var(--terracota)" /> Vincular Lote — {mapaReserva.empreendimento.nome}
              </h2>
              <p style={{ fontSize: 13, color: "var(--gray-mid)", marginTop: 4 }}>
                Selecione um lote disponível (Verde) para reservar para <strong style={{ color: "var(--gray-light)" }}>{mapaReserva.lead?.nome}</strong>.
              </p>
            </div>
            <button onClick={() => setMapaReserva({ aberto: false, empreendimento: null, lead: null })} style={{ padding: 8, background: "rgba(255,255,255,0.1)", borderRadius: 8, border: "none", color: "white", cursor: "pointer" }}><X size={20} /></button>
          </div>
          <div style={{ flex: 1, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
            {loadingReserva ? (
              <div style={{ color: "var(--terracota)", fontWeight: 700, animation: "pulse 2s infinite" }}>Sincronizando lotes...</div>
            ) : (
              <MapaInterativo mapaUrl={mapaReserva.empreendimento.mapaUrl || ""} lotes={lotesReserva} onLoteClick={handleLoteClickReserva} />
            )}
          </div>
        </div>
      )}

      {/* MODAL: SELEÇÃO DE MODELO (sobre o mapa) */}
      {loteParaReservar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-card)", padding: 30, borderRadius: 20, width: "100%", maxWidth: 400, textAlign: "center", border: "1px solid var(--border-subtle)" }}>
            <Home size={40} color="var(--terracota)" style={{ marginBottom: 16 }} />
            <h3 style={{ color: "white", fontSize: 18, fontWeight: 800 }}>Lote {loteParaReservar.numero}</h3>
            <p style={{ color: "var(--gray-mid)", marginBottom: 24 }}>Escolha o modelo de casa para este cliente:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mapaReserva.empreendimento?.modelos?.map((modelo: any, idx: number) => (
                <button key={idx} onClick={() => confirmarReservaComModelo(modelo.nome, modelo.valor)} style={{ padding: 16, background: "var(--terracota)", color: "white", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
                  {modelo.nome} — {formatBRL(modelo.valor)}
                </button>
              ))}
              {(!mapaReserva.empreendimento?.modelos || mapaReserva.empreendimento.modelos.length === 0) && (
                <p style={{ color: "var(--gray-mid)", fontSize: 13 }}>Nenhum modelo cadastrado neste empreendimento.</p>
              )}
              <button onClick={() => setLoteParaReservar(null)} style={{ background: "transparent", border: "none", color: "var(--gray-dark)", cursor: "pointer", marginTop: 10, fontWeight: 600 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GESTÃO DE ACESSO DO CORRETOR (item 1) */}
      <AnimatePresence>
        {modalAcessoCorretor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) setModalAcessoCorretor(null); }}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 20, width: "100%", maxWidth: 480, overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "rgba(0,0,0,0.2)" }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}><Building2 size={18} color="#60a5fa" /> Acesso do Corretor</h3>
                  <p style={{ fontSize: 12, color: "var(--gray-mid)", marginTop: 4 }}>Corretor: <strong style={{ color: "var(--gray-light)" }}>{modalAcessoCorretor.nome}</strong></p>
                </div>
                <button onClick={() => setModalAcessoCorretor(null)} style={{ background: "none", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={20} /></button>
              </div>
              <div style={{ padding: "16px 24px", background: "rgba(96,165,250,0.06)", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Info size={15} color="#60a5fa" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "var(--gray-light)", lineHeight: 1.6 }}>Libere ou desligue o acesso de <strong style={{ color: "#60a5fa" }}>{modalAcessoCorretor.nome}</strong> aos empreendimentos que você coordena.</p>
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: "16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
                {empreendimentos.filter(emp => vetudo || empreendimentosPermitidos.includes(emp.slug)).map((emp) => {
                  const permitidos: string[] = Array.isArray(modalAcessoCorretor.empreendimentosPermitidos) ? modalAcessoCorretor.empreendimentosPermitidos : [];
                  const solicitados: string[] = Array.isArray(modalAcessoCorretor.empreendimentosSolicitados) ? modalAcessoCorretor.empreendimentosSolicitados : [];
                  const temAcesso = permitidos.includes(emp.slug);
                  const foiSolicitado = solicitados.includes(emp.slug);

                  return (
                    <div key={emp.slug} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, background: temAcesso ? "rgba(74,222,128,0.05)" : "rgba(239,68,68,0.05)", border: temAcesso ? "1px solid rgba(74,222,128,0.2)" : "1px solid rgba(239,68,68,0.2)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: temAcesso ? "rgba(74,222,128,0.15)" : "rgba(239,68,68,0.15)", color: temAcesso ? "#4ade80" : "#f87171", border: temAcesso ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(239,68,68,0.3)" }}>
                          <Building2 size={16} />
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{emp.nome}</p>
                          {foiSolicitado && !temAcesso && <p style={{ fontSize: 11, color: "#60a5fa", marginTop: 2, fontWeight: 600 }}>Solicitado no cadastro</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleEmpreendimentoCorretor(emp.slug)}
                        disabled={salvandoAcessoCorretor}
                        style={{ padding: "8px 16px", borderRadius: 10, cursor: salvandoAcessoCorretor ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 12, border: "none", background: temAcesso ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)", color: temAcesso ? "#4ade80" : "#f87171", opacity: salvandoAcessoCorretor ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}
                      >
                        {temAcesso ? <><CheckCircle2 size={15} /> LIGADO</> : <><Lock size={14} /> DESLIGADO</>}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setModalAcessoCorretor(null)} style={{ padding: "10px 20px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-subtle)", color: "white", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Fechar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: MOTIVO DE EXCLUSÃO (ENVIAR PARA LIXEIRA) */}
      {leadParaExcluir && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setLeadParaExcluir(null); }} style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-card)", width: "100%", maxWidth: 480, borderRadius: 20, border: "1px solid rgba(239,68,68,0.3)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f87171", display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={18} /> Mover para a Lixeira
                </h3>
                <p style={{ fontSize: 12, color: "var(--gray-mid)", marginTop: 4 }}>Cliente: <strong style={{ color: "var(--gray-light)" }}>{leadParaExcluir.nome}</strong></p>
              </div>
              <button onClick={() => setLeadParaExcluir(null)} style={{ background: "none", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
              <p style={{ fontSize: 13, color: "var(--gray-light)", marginBottom: 4 }}>Selecione o motivo da exclusão (obrigatório):</p>
              {MOTIVOS_EXCLUSAO.map(m => (
                <button key={m.id} onClick={() => setMotivoExclusao(m.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left", background: motivoExclusao === m.id ? "rgba(239,68,68,0.1)" : "rgba(0,0,0,0.2)", border: motivoExclusao === m.id ? "1px solid rgba(239,68,68,0.4)" : "1px solid var(--border-subtle)" }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, border: motivoExclusao === m.id ? "5px solid #f87171" : "2px solid var(--gray-dark)", transition: "0.15s" }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: motivoExclusao === m.id ? "white" : "var(--gray-light)" }}>{m.label}</span>
                </button>
              ))}

              {motivoExclusao === "outro" && (
                <textarea
                  value={motivoTextoLivre}
                  onChange={e => setMotivoTextoLivre(e.target.value)}
                  placeholder="Descreva o motivo..."
                  autoFocus
                  style={{ width: "100%", minHeight: 70, padding: "10px 14px", borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-active)", color: "white", fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.6, marginTop: 4 }}
                />
              )}
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 10, justifyContent: "flex-end", background: "rgba(0,0,0,0.1)" }}>
              <button onClick={() => setLeadParaExcluir(null)} style={{ padding: "10px 18px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)", color: "white", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button
                onClick={confirmarExclusao}
                disabled={!motivoExclusao || (motivoExclusao === "outro" && !motivoTextoLivre.trim()) || salvandoExclusao}
                style={{ padding: "10px 18px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: (!motivoExclusao || (motivoExclusao === "outro" && !motivoTextoLivre.trim()) || salvandoExclusao) ? "not-allowed" : "pointer", background: (!motivoExclusao || (motivoExclusao === "outro" && !motivoTextoLivre.trim())) ? "rgba(239,68,68,0.2)" : "#ef4444", color: "white", opacity: salvandoExclusao ? 0.6 : 1 }}
              >
                <Trash2 size={14} /> {salvandoExclusao ? "Movendo..." : "Mover para Lixeira"}
              </button>
            </div>
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