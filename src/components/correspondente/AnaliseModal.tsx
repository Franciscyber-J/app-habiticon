"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, CheckCircle2, FileText, ExternalLink, ShieldCheck, AlertCircle,
  MessageSquareWarning, ThumbsUp, ThumbsDown, Calculator, FilePlus, FilePlus2,
  RefreshCcw, UploadCloud, Phone, FileCheck2, Loader2, Edit3
} from "lucide-react";
import { doc, updateDoc, getDoc, getDocs, collection } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db } from "@/lib/firebase";
import { PainelCalculoMinimo } from "@/components/correspondente/PainelCalculoMinimo";
import { ComparadorImoveis } from "@/components/correspondente/ComparadorImoveis";

// ─────────────────────────────────────────────────────────
// TIPAGENS
// ─────────────────────────────────────────────────────────

interface AnaliseModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
}

interface ToastMessage {
  msg: string;
  tipo: "sucesso" | "erro";
}

// ── CHECKLIST PADRÃO (espelha o DossieModal do corretor) ──
const CHECKLIST_BASE = [
  { id: "rg_cnh",               label: "RG ou CNH (Frente e Verso)" },
  { id: "certidao",             label: "Certidão (Nascimento / Casamento / Divórcio)" },
  { id: "comprovante_renda",    label: "Comprovante de Renda (3 últimos meses)" },
  { id: "comprovante_endereco", label: "Comprovante de Endereço Atualizado" },
  { id: "carteira_trabalho",    label: "Carteira de Trabalho — CTPS (se CLT)" },
  { id: "imposto_renda",        label: "Declaração de IR (se declarante)" },
];

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────

export function AnaliseModal({ isOpen, onClose, lead }: AnaliseModalProps) {
  const [abaAtiva, setAbaAtiva] = useState<string>("proponente");
  const [abaModal, setAbaModal] = useState<"analise" | "dossie">("analise");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [docPendenciaAtivo, setDocPendenciaAtivo] = useState<string | null>(null);
  const [textoPendencia, setTextoPendencia] = useState("");
  const [mostrandoNovaSolicitacao, setMostrandoNovaSolicitacao] = useState(false);
  const [novaSolicitacaoNome, setNovaSolicitacaoNome] = useState("");
  const [novaSolicitacaoDescricao, setNovaSolicitacaoDescricao] = useState("");
  
  // Estados para o Modal de Aprovação Detalhada
  const [modalAprovacaoAberto, setModalAprovacaoAberto] = useState(false);
  const [dadosAprovacao, setDadosAprovacao] = useState({ valorAprovado: "", valorParcela: "", observacoes: "" });
  const [uploadingGeral, setUploadingGeral] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  // ── ESTADOS DO MODAL DE REPROVAÇÃO ──
  const [modalReprovacaoAberto, setModalReprovacaoAberto] = useState(false);
  const [motivoReprovacao, setMotivoReprovacao] = useState("");

  // ── NOVO: WhatsApp do corretor ──
  const [telefoneCorretor, setTelefoneCorretor] = useState<string>("");

  // ── NOVO: Upload de documento de aprovação de crédito ──
  const [uploadingAprovacao, setUploadingAprovacao] = useState(false);
  const fileInputAprovacaoRef = useRef<HTMLInputElement>(null);

  // ── EDIÇÃO DE FICHA ──
  const [editandoFicha, setEditandoFicha] = useState(false);
  const [fichaForm, setFichaForm] = useState<any>({});
  const [empreendimento, setEmpreendimento] = useState<any>(null);

  // ── BUSCA TELEFONE DO CORRETOR QUANDO O MODAL ABRE ──
  useEffect(() => {
    if (!isOpen || !lead?.corretorId || lead.corretorId === "interno" || lead.corretorId === "") {
      setTelefoneCorretor("");
      return;
    }
    getDoc(doc(db, "usuarios", lead.corretorId))
      .then(snap => { if (snap.exists()) setTelefoneCorretor(snap.data().telefone || ""); })
      .catch(() => {});
  }, [isOpen, lead?.corretorId]);

  // ── BUSCA O EMPREENDIMENTO PARA LISTAR OS MODELOS NA EDIÇÃO DA FICHA ──
  useEffect(() => {
    if (isOpen && lead?.empreendimentoId) {
      getDoc(doc(db, "empreendimentos", lead.empreendimentoId)).then(snap => {
        if (snap.exists()) setEmpreendimento(snap.data());
      });
    }
  }, [isOpen, lead?.empreendimentoId]);

  // ── LÊ OS LOTES FÍSICOS VENDIDOS (varre todas as quadras) ──
  // Cruzamento por NÚMERO do lote: o item comercial "Quadra 21 - Lote 22" casa
  // com o lote físico numero:"22" status:"vendido". Exclui o lote do próprio lead.
  const [lotesVendidos, setLotesVendidos] = useState<string[]>([]);
  useEffect(() => {
    if (!isOpen || !lead?.empreendimentoId) { setLotesVendidos([]); return; }
    let cancelado = false;
    (async () => {
      try {
        const numeroDoLead = String(lead?.loteReserva?.numero ?? "");
        const quadrasSnap = await getDocs(collection(db, "empreendimentos", lead.empreendimentoId, "quadras"));
        const vendidos: string[] = [];
        for (const q of quadrasSnap.docs) {
          const lotesSnap = await getDocs(collection(db, "empreendimentos", lead.empreendimentoId, "quadras", q.id, "lotes"));
          lotesSnap.forEach(l => {
            const d = l.data();
            const numero = String(d.numero ?? "");
            // Só conta como bloqueado se vendido E não for o lote do próprio lead
            if (d.status === "vendido" && numero && numero !== numeroDoLead) {
              vendidos.push(numero);
            }
          });
        }
        if (!cancelado) setLotesVendidos(vendidos);
      } catch (e) {
        console.error("Erro ao ler lotes vendidos:", e);
        if (!cancelado) setLotesVendidos([]);
      }
    })();
    return () => { cancelado = true; };
  }, [isOpen, lead?.empreendimentoId, lead?.loteReserva?.numero]);

  if (!isOpen || !lead) return null;

  // Sem dossiê salvo → mostra o checklist padrão (igual ao painel do corretor),
  // assim o correspondente já vê os slots e o 1º anexo/pendência persiste a estrutura.
  const dossie = (lead.dossie && Object.keys(lead.dossie).length > 0)
    ? lead.dossie
    : {
        proponente: {
          nome: "Proponente Principal",
          documentos: CHECKLIST_BASE.reduce(
            (acc, item) => ({ ...acc, [item.id]: { label: item.label, arquivos: [], pendenciaCorrespondente: "" } }),
            {}
          ),
        },
      };

  // MAPEAMENTO INTELIGENTE DAS VARIÁVEIS
  const dadosFinanceiros = {
    rendaFamiliar:  lead?.simulacao?.rendaFamiliar  || lead?.rendaFamiliar  || 0,
    valorAvaliacao: lead?.simulacao?.valorAvaliacao || lead?.valorAvaliacao || 0,
    valorFinanciado:lead?.simulacao?.valorFinanciado|| lead?.valorFinanciado|| 0,
    subsidio:       lead?.simulacao?.subsidio       || lead?.subsidio       || 0,
  };

  const isAprovado = lead.status === "qualificado" || lead.status === "credito_aprovado"; 
  const isReprovado = lead.status === "nao_qualificado" || lead.status === "credito_reprovado";
  const isDecidido = isAprovado || isReprovado;

  // ─────────────────────────────────────────────────────────
  // FUNÇÕES
  // ─────────────────────────────────────────────────────────

  const mostrarToast = (msg: string, tipo: "sucesso" | "erro") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000); 
  };

  const iniciarEdicaoFicha = () => {
    setFichaForm({ ...(lead.preCadastro || {}), modelo: lead.modelo || "" });
    setEditandoFicha(true);
  };

  const salvarFicha = async () => {
    try {
      const { modelo, ...restoPreCadastro } = fichaForm;
      const updates: any = { preCadastro: restoPreCadastro };

      if (modelo && modelo !== lead.modelo) {
        const modeloCompleto = empreendimento?.modelos?.find((m: any) => m.nome === modelo);
        if (modeloCompleto) {
          updates.modelo = modeloCompleto.nome;
          updates.valorImovel = modeloCompleto.valor || 0;
          updates.area = modeloCompleto.area || 0;
          updates.quartos = modeloCompleto.quartos || 0;
        } else {
          updates.modelo = modelo;
        }
      }

      await updateDoc(doc(db, "leads", lead.id), updates);
      setEditandoFicha(false);
      mostrarToast("Ficha atualizada com sucesso!", "sucesso");
    } catch (error) {
      console.error(error);
      mostrarToast("Erro ao atualizar ficha.", "erro");
    }
  };

  const abrirFormularioPendencia = (docId: string, textoAtual: string) => {
    if (isDecidido) {
      mostrarToast("Não é possível solicitar correção de um crédito já finalizado.", "erro");
      return;
    }
    setDocPendenciaAtivo(docId);
    setTextoPendencia(textoAtual || "");
  };

  const salvarPendencia = async (pessoaId: string, docId: string) => {
    if (isDecidido) return;
    const pessoaAlvo = dossie[pessoaId];
    const docAlvo = pessoaAlvo.documentos[docId];

    const dossieAtualizado = {
      ...dossie,
      [pessoaId]: {
        ...pessoaAlvo,
        documentos: {
          ...pessoaAlvo.documentos,
          [docId]: {
            ...docAlvo,
            pendenciaCorrespondente: textoPendencia,
            arquivos: (docAlvo.arquivos || []).map((arq: any) =>
              typeof arq === "string"
                ? { url: arq, path: "", bloqueado: false }
                : { ...arq, bloqueado: false }
            ),
          },
        },
      },
    };

    try {
      await updateDoc(doc(db, "leads", lead.id), {
        dossie: dossieAtualizado,
        status: "com_pendencia",
      });
      setDocPendenciaAtivo(null);
      setTextoPendencia("");
      mostrarToast("Pendência notificada ao corretor!", "sucesso");
    } catch (error) {
      console.error(error);
      mostrarToast("Erro ao registrar pendência.", "erro");
    }
  };

  const limparPendencia = async (pessoaId: string, docId: string) => {
    if (isDecidido) return;
    const pessoaAlvo = dossie[pessoaId];
    const docAlvo = pessoaAlvo.documentos[docId];

    const dossieAtualizado = {
      ...dossie,
      [pessoaId]: {
        ...pessoaAlvo,
        documentos: {
          ...pessoaAlvo.documentos,
          [docId]: {
            ...docAlvo,
            pendenciaCorrespondente: "",
            arquivos: (docAlvo.arquivos || []).map((arq: any) =>
              typeof arq === "string"
                ? { url: arq, path: "", bloqueado: true }
                : { ...arq, bloqueado: true }
            ),
          },
        },
      },
    };

    try {
      await updateDoc(doc(db, "leads", lead.id), { dossie: dossieAtualizado });
      mostrarToast("Pendência resolvida e arquivo validado.", "sucesso");
    } catch (error) {
      console.error(error);
      mostrarToast("Erro ao validar documento.", "erro");
    }
  };

  // UPLOAD DIRETO PELO CORRESPONDENTE
  const handleUploadCorrespondente = async (e: React.ChangeEvent<HTMLInputElement>, pessoaId: string, docId: string) => {
    if (isDecidido) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingGeral(true);
    setUploadingDocId(docId);
    mostrarToast("A anexar documentos...", "sucesso");

    const storage = getStorage();
    const pessoaAlvo = dossie[pessoaId];
    const docAlvo = pessoaAlvo.documentos[docId];
    const novosArquivos = [...(docAlvo.arquivos || [])];

    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${docId}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const fileRef = ref(storage, `leads/${lead.id}/dossie/${pessoaId}/${fileName}`);
        
        await uploadBytesResumable(fileRef, file);
        const url = await getDownloadURL(fileRef);
        
        // Fica bloqueado automaticamente, pois foi o correspondente que subiu
        novosArquivos.push({ url, path: fileRef.fullPath, bloqueado: true }); 
      }

      const dossieAtualizado = {
        ...dossie,
        [pessoaId]: {
          ...pessoaAlvo,
          documentos: {
            ...pessoaAlvo.documentos,
            [docId]: {
              ...docAlvo,
              arquivos: novosArquivos,
              pendenciaCorrespondente: "" // Limpa pendência se o próprio correspondente resolveu anexando
            }
          }
        }
      };

      await updateDoc(doc(db, "leads", lead.id), { dossie: dossieAtualizado });
      mostrarToast("Ficheiros anexados com sucesso!", "sucesso");
    } catch (error) {
      console.error("Erro no upload do correspondente:", error);
      mostrarToast("Erro ao anexar arquivo.", "erro");
    } finally {
      setUploadingGeral(false);
      setUploadingDocId(null);
      e.target.value = ""; // reseta o input
    }
  };

  // ── NOVO: Upload de Documentos de Análise (Múltiplos) ──
  const handleUploadDocumentosAnalise = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setUploadingAprovacao(true);
    const storage = getStorage();
    
    try {
      const novosDocs = [];
      for (const file of files) {
        const path = `leads/${lead.id}/analise_credito/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, path);
        await uploadBytesResumable(fileRef, file);
        const url = await getDownloadURL(fileRef);
        
        novosDocs.push({
          url, 
          path,
          nome: file.name,
          uploadedAt: new Date().toISOString()
        });
      }

      const documentosAtuais = lead.documentosAnaliseCredito || [];
      const listaAtualizada = [...documentosAtuais, ...novosDocs];

      await updateDoc(doc(db, "leads", lead.id), {
        documentosAnaliseCredito: listaAtualizada
      });
      
      mostrarToast(`${files.length} documento(s) anexado(s) com sucesso!`, "sucesso");
    } catch (error) {
      console.error("Erro no upload da análise:", error);
      mostrarToast("Erro ao anexar documentos.", "erro");
    } finally {
      setUploadingAprovacao(false);
      e.target.value = "";
    }
  };

  const removerDocumentoAnalise = async (indexParaRemover: number) => {
    if (!confirm("Remover definitivamente este documento de análise?")) return;
    
    const docsAtuais = lead.documentosAnaliseCredito || [];
    const docParaRemover = docsAtuais[indexParaRemover];
    
    try {
      if (docParaRemover.path) {
        const { deleteObject } = await import("firebase/storage");
        const storage = getStorage();
        const fileRef = ref(storage, docParaRemover.path);
        await deleteObject(fileRef).catch(() => console.warn("Arquivo já não existia no storage"));
      }

      const novaLista = docsAtuais.filter((_: any, index: number) => index !== indexParaRemover);
      
      await updateDoc(doc(db, "leads", lead.id), {
        documentosAnaliseCredito: novaLista
      });
      mostrarToast("Documento removido.", "sucesso");
    } catch (error) {
      console.error("Erro ao remover:", error);
      mostrarToast("Erro ao excluir arquivo.", "erro");
    }
  };

  const iniciarProcessoAprovacao = (novoStatus: "qualificado" | "nao_qualificado") => {
    if (isDecidido) return;

    if (novoStatus === "nao_qualificado") {
      setMotivoReprovacao("");
      setModalReprovacaoAberto(true);
    } else {
      // Pré-preenche com o valor REAL do contrato (não o valorFinanciado antigo do simulador)
      const contratoReal = (typeof lead?.loteReserva?.valorVenda === "number" && lead.loteReserva.valorVenda > 0)
        ? lead.loteReserva.valorVenda
        : (lead?.valorImovel || dadosFinanceiros.valorFinanciado || 0);
      setDadosAprovacao({
        valorAprovado: contratoReal ? contratoReal.toString() : "",
        valorParcela: "",
        observacoes: ""
      });
      setModalAprovacaoAberto(true);
    }
  };

  const confirmarReprovacao = async () => {
    if (!motivoReprovacao.trim()) {
      mostrarToast("O motivo da reprovação é obrigatório.", "erro");
      return; 
    }
    
    try {
      await updateDoc(doc(db, "leads", lead.id), { 
        status: "nao_qualificado",
        motivoReprovacao: motivoReprovacao.trim(),
        origemDesqualificacao: "correspondente",
        creditoAprovadoInfo: null,
        loteReserva: null
      });

      if (lead.loteReserva && lead.empreendimentoId) {
        const { quadraId, loteId } = lead.loteReserva;
        if (quadraId && loteId) {
          const loteRef = doc(db, "empreendimentos", lead.empreendimentoId, "quadras", quadraId, "lotes", loteId);
          const loteSnap = await getDoc(loteRef);
          
          if (loteSnap.exists()) {
            const filaAtual = loteSnap.data().fila || [];
            const novaFila = filaAtual.filter((f: any) => f.leadId !== lead.id);
            const statusLot = novaFila.length === 0 ? "disponivel" : "vinculado";

            await updateDoc(loteRef, { fila: novaFila, status: statusLot })
              .catch(err => console.error("Erro ao liberar lote:", err));
          }
        }
      }

      setModalReprovacaoAberto(false);
      mostrarToast("Crédito Reprovado com sucesso!", "sucesso");
    } catch (error) {
      mostrarToast("Erro ao atualizar status.", "erro");
    }
  };

  const confirmarAprovacaoComDetalhes = async () => {
    try {
      await updateDoc(doc(db, "leads", lead.id), {
        status: "qualificado",
        motivoReprovacao: "", 
        creditoAprovadoInfo: {
          valorAprovado: Number(dadosAprovacao.valorAprovado) || dadosFinanceiros.valorFinanciado,
          valorParcela: Number(dadosAprovacao.valorParcela) || 0,
          observacoes: dadosAprovacao.observacoes.trim(),
          dataAprovacao: new Date().toISOString()
        }
      });

      // ─── AUTOMAÇÃO DE VENDA DO LOTE ───
      if (lead.loteReserva && lead.empreendimentoId) {
        const { quadraId, loteId } = lead.loteReserva;
        if (quadraId && loteId) {
          const loteRef = doc(db, "empreendimentos", lead.empreendimentoId, "quadras", quadraId, "lotes", loteId);
          await updateDoc(loteRef, {
            status: "vendido"
          }).catch(err => console.error("Erro ao marcar lote como vendido (background):", err));
        }
      }
      // ──────────────────────────────────

      setModalAprovacaoAberto(false);
      mostrarToast("Crédito Aprovado! Role para baixo para anexar o Laudo SICAQ.", "sucesso");
    } catch (error) {
      mostrarToast("Erro ao salvar aprovação.", "erro");
    }
  };

  const reverterDecisao = async () => {
    if (!confirm("Tem certeza que deseja reverter a decisão e voltar o lead para análise?\n\nIsso permitirá novas solicitações de documentos.")) return;
    try {
      await updateDoc(doc(db, "leads", lead.id), { 
        status: "em_atendimento",
        motivoReprovacao: "",
        creditoAprovadoInfo: null
      });

      // ─── AUTOMAÇÃO DE REVERSÃO DO LOTE ───
      if (lead.loteReserva && lead.empreendimentoId) {
        const { quadraId, loteId } = lead.loteReserva;
        if (quadraId && loteId) {
          const loteRef = doc(db, "empreendimentos", lead.empreendimentoId, "quadras", quadraId, "lotes", loteId);
          await updateDoc(loteRef, {
            status: "vinculado"
          }).catch(err => console.error("Erro ao voltar lote para vinculado:", err));
        }
      }
      // ──────────────────────────────────────

      mostrarToast("Decisão revertida. Lead de volta à análise.", "sucesso");
    } catch (error) {
      mostrarToast("Erro ao reverter decisão.", "erro");
    }
  };

  const criarNovaSolicitacao = async () => {
    if (isDecidido) return;
    if (!novaSolicitacaoNome.trim()) return;

    const pessoaAlvo = dossie[abaAtiva];
    const idNovoDoc = `solicitacao_${Date.now()}`;

    const dossieAtualizado = {
      ...dossie,
      [abaAtiva]: {
        ...pessoaAlvo,
        documentos: {
          ...pessoaAlvo.documentos,
          [idNovoDoc]: {
            label: novaSolicitacaoNome.trim(),
            arquivos: [],
            pendenciaCorrespondente: novaSolicitacaoDescricao.trim() || novaSolicitacaoNome.trim(),
          },
        },
      },
    };

    try {
      await updateDoc(doc(db, "leads", lead.id), {
        dossie: dossieAtualizado,
        status: "com_pendencia",
      });
      setNovaSolicitacaoNome("");
      setNovaSolicitacaoDescricao("");
      setMostrandoNovaSolicitacao(false);
      mostrarToast("Nova solicitação criada!", "sucesso");
    } catch (error) {
      console.error(error);
      mostrarToast("Erro ao criar solicitação.", "erro");
    }
  };

  // ─────────────────────────────────────────────────────────
  // RENDERIZAÇÃO
  // ─────────────────────────────────────────────────────────

  const pessoaAtual = dossie[abaAtiva];
  const listaDocumentosPessoa = Object.entries(pessoaAtual?.documentos || {});

  return (
    <AnimatePresence>
      {isOpen && lead && (
        <motion.div
          key="analise-modal-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center"
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            key="analise-modal-content"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{
              background: "var(--bg-base)", width: "100%", maxWidth: 700,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              height: "92vh", maxHeight: "92vh", display: "flex", flexDirection: "column",
              border: "1px solid var(--border-subtle)", borderBottom: "none",
              boxShadow: "0 -10px 40px rgba(0,0,0,0.5)", position: "relative",
              overflow: "hidden"
            }}
          >

            {/* Input oculto para o upload de aprovação/análise de crédito */}
            <input
              type="file" ref={fileInputAprovacaoRef} onChange={handleUploadDocumentosAnalise} multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: "none" }}
            />

            {/* TOAST */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  style={{
                    position: "absolute", top: 20, left: "50%", x: "-50%", zIndex: 999,
                    background: toast.tipo === "sucesso" ? "rgba(22,163,74,0.95)" : "rgba(239,68,68,0.95)",
                    border: `1px solid ${toast.tipo === "sucesso" ? "#4ade80" : "#fca5a5"}`,
                    color: "white", padding: "12px 20px", borderRadius: 12,
                    display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700,
                    boxShadow: "0 8px 30px rgba(0,0,0,0.3)", backdropFilter: "blur(8px)"
                  }}
                >
                  {toast.tipo === "sucesso" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {toast.msg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* MODAL SOBREPOSTO DE APROVAÇÃO DETALHADA */}
            <AnimatePresence>
              {modalAprovacaoAberto && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{
                    position: "absolute", inset: 0, zIndex: 110,
                    background: "rgba(15,30,22,0.95)", backdropFilter: "blur(10px)",
                    borderTopLeftRadius: 28, borderTopRightRadius: 28,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: 24
                  }}
                >
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 500, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(74,222,128,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ThumbsUp size={22} color="#4ade80" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "white" }}>Aprovação de Crédito</h3>
                        <p style={{ fontSize: 12, color: "var(--gray-mid)" }}>Informações para o corretor e cliente</p>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Valor Aprovado Liberado (R$)</label>
                        <input
                          type="number" className="input-field" style={{ fontSize: 15 }}
                          value={dadosAprovacao.valorAprovado}
                          onChange={(e) => setDadosAprovacao(p => ({ ...p, valorAprovado: e.target.value }))}
                          placeholder="Ex: 230000"
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Valor da Parcela Estimada (R$)</label>
                        <input
                          type="number" className="input-field" style={{ fontSize: 15 }}
                          value={dadosAprovacao.valorParcela}
                          onChange={(e) => setDadosAprovacao(p => ({ ...p, valorParcela: e.target.value }))}
                          placeholder="Ex: 1450.50"
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Observações / Condicionantes</label>
                        <textarea
                          className="input-field" style={{ fontSize: 13, resize: "vertical", minHeight: 80 }}
                          value={dadosAprovacao.observacoes}
                          onChange={(e) => setDadosAprovacao(p => ({ ...p, observacoes: e.target.value }))}
                          placeholder="Ex: Aprovação sujeita à apresentação do IR atualizado. Condicionada à quitação de empréstimo ativo no Bradesco..."
                        />
                      </div>
                    </div>

                    {/* ── ANEXO DE DOCUMENTOS DE ANÁLISE DENTRO DO MODAL ── */}
                    <div style={{ padding: "16px", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 12, marginBottom: 24 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", display: "flex", alignItems: "center", gap: 6 }}><FileCheck2 size={16}/> Documentos de Análise</p>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", marginTop: 2 }}>Parecer, Laudo, Prints (Uso Interno)</p>
                        </div>
                        <button onClick={() => fileInputAprovacaoRef.current?.click()} disabled={uploadingAprovacao} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: uploadingAprovacao ? 0.5 : 1 }}>
                          {uploadingAprovacao ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Enviando...</> : <><UploadCloud size={13} /> Anexar</>}
                        </button>
                      </div>
                      
                      {lead.documentosAnaliseCredito && lead.documentosAnaliseCredito.length > 0 && (
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                          {lead.documentosAnaliseCredito.map((doc: any, i: number) => (
                            <p key={i} style={{ fontSize: 11, color: "#4ade80", display: "flex", alignItems: "center", gap: 4 }}>
                              <CheckCircle2 size={12}/> {doc.nome}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 12 }}>
                      <button
                        onClick={() => setModalAprovacaoAberto(false)}
                        style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", borderRadius: 12, color: "var(--gray-light)", fontWeight: 700, cursor: "pointer" }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={confirmarAprovacaoComDetalhes}
                        style={{ flex: 1, padding: "12px", background: "#4ade80", border: "none", borderRadius: 12, color: "#064e3b", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px rgba(74,222,128,0.3)" }}
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* MODAL SOBREPOSTO DE REPROVAÇÃO DETALHADA */}
            <AnimatePresence>
              {modalReprovacaoAberto && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{
                    position: "absolute", inset: 0, zIndex: 110,
                    background: "rgba(15,30,22,0.95)", backdropFilter: "blur(10px)",
                    borderTopLeftRadius: 28, borderTopRightRadius: 28,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: 24
                  }}
                >
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 500, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ThumbsDown size={22} color="#f87171" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "white" }}>Reprovação de Crédito</h3>
                        <p style={{ fontSize: 12, color: "var(--gray-mid)" }}>Informações para o corretor e cliente</p>
                      </div>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Motivo da Reprovação *</label>
                      <textarea
                        className="input-field" style={{ fontSize: 13, resize: "vertical", minHeight: 80 }}
                        value={motivoReprovacao}
                        onChange={(e) => setMotivoReprovacao(e.target.value)}
                        placeholder="Ex: Restrição interna na CAIXA impeditiva de financiamento..."
                      />
                    </div>

                    {/* ── ANEXO DE DOCUMENTOS DE ANÁLISE DENTRO DO MODAL ── */}
                    <div style={{ padding: "16px", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 12, marginBottom: 24 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", display: "flex", alignItems: "center", gap: 6 }}><FileCheck2 size={16}/> Documentos de Análise</p>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", marginTop: 2 }}>Parecer, Laudo, Prints (Uso Interno)</p>
                        </div>
                        <button onClick={() => fileInputAprovacaoRef.current?.click()} disabled={uploadingAprovacao} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: uploadingAprovacao ? 0.5 : 1 }}>
                          {uploadingAprovacao ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Enviando...</> : <><UploadCloud size={13} /> Anexar</>}
                        </button>
                      </div>
                      
                      {lead.documentosAnaliseCredito && lead.documentosAnaliseCredito.length > 0 && (
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                          {lead.documentosAnaliseCredito.map((doc: any, i: number) => (
                            <p key={i} style={{ fontSize: 11, color: "#4ade80", display: "flex", alignItems: "center", gap: 4 }}>
                              <CheckCircle2 size={12}/> {doc.nome}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 12 }}>
                      <button
                        onClick={() => setModalReprovacaoAberto(false)}
                        style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", borderRadius: 12, color: "var(--gray-light)", fontWeight: 700, cursor: "pointer" }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={confirmarReprovacao}
                        style={{ flex: 1, padding: "12px", background: "#f87171", border: "none", borderRadius: 12, color: "#450a0a", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px rgba(239,68,68,0.3)" }}
                      >
                        Confirmar Reprovação
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* HEADER: RESUMO FINANCEIRO */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0, background: "var(--bg-base)", zIndex: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 10 }}>
                    <ShieldCheck size={22} color="#38bdf8" /> Auditoria de Crédito
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--gray-mid)", marginTop: 2 }}>
                    <strong style={{ color: "var(--gray-light)" }}>{lead.nome}</strong> • {lead.empreendimentoNome}
                  </p>
                </div>
                <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-light)", cursor: "pointer" }}>
                  <X size={18} />
                </button>
              </div>

              {/* ── NOVO: WhatsApp do Cliente e do Corretor com identificação ── */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                {lead.whatsapp && (
                  <a
                    href={`https://wa.me/55${(lead.whatsapp || "").replace(/\D/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#4ade80", textDecoration: "none", background: "rgba(74,222,128,0.1)", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(74,222,128,0.25)" }}
                  >
                    <Phone size={13} />
                    <span style={{ fontWeight: 400, color: "rgba(74,222,128,0.7)", fontSize: 11 }}>Cliente:</span>
                    {lead.whatsapp}
                  </a>
                )}
                {lead.whatsapp2 && lead.whatsapp2.replace(/\D/g, "").length >= 10 && (
                  <a
                    href={`https://wa.me/55${(lead.whatsapp2 || "").replace(/\D/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#4ade80", textDecoration: "none", background: "rgba(74,222,128,0.1)", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(74,222,128,0.25)" }}
                  >
                    <Phone size={13} />
                    <span style={{ fontWeight: 400, color: "rgba(74,222,128,0.7)", fontSize: 11 }}>Cliente 2:</span>
                    {lead.whatsapp2}
                  </a>
                )}
                {telefoneCorretor && (
                  <a
                    href={`https://wa.me/55${telefoneCorretor.replace(/\D/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#38bdf8", textDecoration: "none", background: "rgba(56,189,248,0.1)", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(56,189,248,0.25)" }}
                  >
                    <Phone size={13} />
                    <span style={{ fontWeight: 400, color: "rgba(56,189,248,0.7)", fontSize: 11 }}>Corretor:</span>
                    {lead.nomeCorretor ? `${lead.nomeCorretor} — ${telefoneCorretor}` : telefoneCorretor}
                  </a>
                )}
              </div>

              {/* BARRA DE ABAS DO MODAL */}
              <div style={{ display: "flex", gap: 8, background: "rgba(0,0,0,0.25)", padding: 5, borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                <button
                  onClick={() => setAbaModal("analise")}
                  style={{
                    flex: 1, padding: "9px 14px", borderRadius: 9, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    background: abaModal === "analise" ? "rgba(56,189,248,0.15)" : "transparent",
                    color: abaModal === "analise" ? "#38bdf8" : "var(--gray-mid)",
                    transition: "0.2s"
                  }}
                >
                  <Calculator size={15} /> Análise Financeira
                </button>
                <button
                  onClick={() => setAbaModal("dossie")}
                  style={{
                    flex: 1, padding: "9px 14px", borderRadius: 9, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    background: abaModal === "dossie" ? "rgba(56,189,248,0.15)" : "transparent",
                    color: abaModal === "dossie" ? "#38bdf8" : "var(--gray-mid)",
                    transition: "0.2s"
                  }}
                >
                  <FileText size={15} /> Dossiê
                </button>
              </div>
            </div>

            {/* ════════ ABA: ANÁLISE FINANCEIRA ════════ */}
            {abaModal === "analise" && (
              <div style={{ padding: "24px", overflowY: "auto", flex: "1 1 auto", minHeight: 0, maxHeight: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
                <PainelCalculoMinimo lead={lead} empreendimento={empreendimento} lotesVendidos={lotesVendidos} />
                <ComparadorImoveis lead={lead} empreendimento={empreendimento} />
              </div>
            )}

            {/* ════════ ABA: DOSSIÊ ════════ */}
            {abaModal === "dossie" && (
            <>
            {/* ABAS DE PESSOAS */}
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", gap: 8, paddingTop: 16, paddingLeft: 24, paddingBottom: 0, overflowX: "auto", overflowY: "visible", borderBottom: "1px solid var(--border-subtle)" }}>
                {Object.entries(dossie).map(([id, pessoa]: any) => (
                  <button
                    key={id} onClick={() => setAbaAtiva(id)}
                    style={{
                      padding: "10px 16px", borderRadius: "10px 10px 0 0", border: "none",
                      fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                      background: abaAtiva === id ? "rgba(56,189,248,0.15)" : "transparent",
                      color: abaAtiva === id ? "#38bdf8" : "var(--gray-mid)",
                      borderBottom: abaAtiva === id ? "2px solid #38bdf8" : "2px solid transparent"
                    }}
                  >
                    {pessoa.nome}
                  </button>
                ))}
                <div style={{ flexShrink: 0, width: 24 }} />
              </div>
            </div>

            {/* CORPO: AUDITORIA DE DOCUMENTOS */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              
              {/* ── FICHA DE PRÉ-CADASTRO DO CLIENTE ── */}
              {abaAtiva === "proponente" && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#38bdf8", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                      <FileText size={16} /> Ficha de Pré-Cadastro
                    </h3>
                    
                    {/* Não permite editar se o crédito já foi finalizado (isDecidido) */}
                    {!editandoFicha && !isDecidido ? (
                      <button onClick={iniciarEdicaoFicha} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "6px 12px", borderRadius: 8, color: "var(--gray-light)", fontSize: 12, cursor: "pointer", transition: "0.2s" }}>
                        <Edit3 size={14} /> Editar
                      </button>
                    ) : editandoFicha ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setEditandoFicha(false)} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.1)", border: "none", padding: "6px 12px", borderRadius: 8, color: "#f87171", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                          <X size={14} /> Cancelar
                        </button>
                        <button onClick={salvarFicha} style={{ display: "flex", alignItems: "center", gap: 6, background: "#38bdf8", border: "none", padding: "6px 12px", borderRadius: 8, color: "#082f49", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                          <CheckCircle2 size={14} /> Salvar
                        </button>
                      </div>
                    ) : null}
                  </div>
                  
                  {editandoFicha ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>E-mail</label>
                        <input type="email" value={fichaForm.email || ""} onChange={e => setFichaForm({...fichaForm, email: e.target.value})} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", color: "white", fontSize: 13, marginTop: 4, outline: "none" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>PIS / NIT</label>
                        <input type="text" value={fichaForm.pisnit || ""} onChange={e => setFichaForm({...fichaForm, pisnit: e.target.value})} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", color: "white", fontSize: 13, marginTop: 4, outline: "none" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Estado Civil</label>
                        <select value={fichaForm.estadoCivil || ""} onChange={e => setFichaForm({...fichaForm, estadoCivil: e.target.value})} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", color: "white", fontSize: 13, marginTop: 4, outline: "none" }}>
                          <option value="">Selecione...</option>
                          <option value="solteiro">Solteiro(a)</option>
                          <option value="casado">Casado(a)</option>
                          <option value="divorciado">Divorciado(a)</option>
                          <option value="viuvo">Viúvo(a)</option>
                          <option value="uniao_estavel">União Estável</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Filhos Menores</label>
                        <select value={fichaForm.temFilhosMenores || ""} onChange={e => setFichaForm({...fichaForm, temFilhosMenores: e.target.value})} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", color: "white", fontSize: 13, marginTop: 4, outline: "none" }}>
                          <option value="">Selecione...</option>
                          <option value="sim">Sim</option>
                          <option value="nao">Não</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Vínculo</label>
                        <select value={fichaForm.tipoVinculo || ""} onChange={e => setFichaForm({...fichaForm, tipoVinculo: e.target.value})} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", color: "white", fontSize: 13, marginTop: 4, outline: "none" }}>
                          <option value="">Selecione...</option>
                          <option value="clt">CLT (Carteira Assinada)</option>
                          <option value="autonomo">Autônomo</option>
                          <option value="empresario">Empresário / MEI</option>
                          <option value="aposentado">Aposentado / Pensionista</option>
                          <option value="servidor_publico">Servidor Público</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>+3 Anos Carteira</label>
                        <select value={fichaForm.temCarteiraAssinada3Anos || ""} onChange={e => setFichaForm({...fichaForm, temCarteiraAssinada3Anos: e.target.value})} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", color: "white", fontSize: 13, marginTop: 4, outline: "none" }}>
                          <option value="">Selecione...</option>
                          <option value="sim">Sim (várias empresas)</option>
                          <option value="nao">Não</option>
                          <option value="nao_se_aplica">Não se aplica</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Financ. Caixa</label>
                        <select value={fichaForm.temFinanciamentoCaixa || ""} onChange={e => setFichaForm({...fichaForm, temFinanciamentoCaixa: e.target.value})} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", color: "white", fontSize: 13, marginTop: 4, outline: "none" }}>
                          <option value="">Selecione...</option>
                          <option value="nunca">Nunca teve</option>
                          <option value="ativo">Possui ativo</option>
                          <option value="quitado">Já quitado</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Modelo da Casa</label>
                        <select
                          value={fichaForm.modelo || ""}
                          onChange={e => setFichaForm({...fichaForm, modelo: e.target.value})}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", color: "white", fontSize: 13, marginTop: 4, outline: "none" }}
                        >
                          <option value="">Selecione um modelo...</option>
                          {empreendimento?.modelos?.map((m: any) => (
                            <option key={m.id} value={m.nome}>{m.nome} — R$ {m.valor?.toLocaleString('pt-BR')}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Observações do Corretor / Analista</label>
                        <textarea value={fichaForm.observacoesCorretor || ""} onChange={e => setFichaForm({...fichaForm, observacoesCorretor: e.target.value})} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", color: "white", fontSize: 13, marginTop: 4, minHeight: 60, outline: "none" }} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                        <div>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>E-mail</p>
                          <p style={{ fontSize: 13, color: "white", fontWeight: 600 }}>{lead.preCadastro?.email || "-"}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>PIS / NIT</p>
                          <p style={{ fontSize: 13, color: "white", fontWeight: 600 }}>{lead.preCadastro?.pisnit || "-"}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Estado Civil</p>
                          <p style={{ fontSize: 13, color: "white", fontWeight: 600, textTransform: "capitalize" }}>{lead.preCadastro?.estadoCivil ? lead.preCadastro?.estadoCivil.replace("_", " ") : "-"}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Filhos Menores</p>
                          <p style={{ fontSize: 13, color: "white", fontWeight: 600, textTransform: "capitalize" }}>{lead.preCadastro?.temFilhosMenores || "-"}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Vínculo</p>
                          <p style={{ fontSize: 13, color: "white", fontWeight: 600, textTransform: "capitalize" }}>{lead.preCadastro?.tipoVinculo ? lead.preCadastro?.tipoVinculo.replace("_", " ") : "-"}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>+3 Anos Carteira</p>
                          <p style={{ fontSize: 13, color: "white", fontWeight: 600, textTransform: "capitalize" }}>{lead.preCadastro?.temCarteiraAssinada3Anos ? lead.preCadastro?.temCarteiraAssinada3Anos.replace(/_/g, " ") : "-"}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Financ. Caixa</p>
                          <p style={{ fontSize: 13, color: "white", fontWeight: 600, textTransform: "capitalize" }}>{lead.preCadastro?.temFinanciamentoCaixa || "-"}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Modelo Escolhido</p>
                          <p style={{ fontSize: 13, color: "#38bdf8", fontWeight: 700 }}>{lead.modelo || "Ainda não definido"}</p>
                        </div>
                      </div>

                      {lead.preCadastro?.observacoesCorretor && (
                        <div style={{ marginTop: 4, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Observações do Corretor / Analista:</p>
                          <p style={{ fontSize: 13, color: "var(--gray-light)", marginTop: 4, lineHeight: 1.5 }}>{lead.preCadastro?.observacoesCorretor}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {listaDocumentosPessoa.length === 0 ? (
                <p style={{ color: "var(--gray-mid)", textAlign: "center", padding: "40px 0" }}>Nenhum documento salvo ainda.</p>
              ) : (
                listaDocumentosPessoa.map(([docId, docDados]: any) => {
                  const arquivos = docDados.arquivos || [];
                  const isEnviado = arquivos.length > 0;
                  const isUploading = uploadingDocId === docId;
                  const temPendencia = docDados.pendenciaCorrespondente && docDados.pendenciaCorrespondente !== "";
                  const isEditandoPendencia = docPendenciaAtivo === docId;

                  return (
                    <div key={docId} style={{
                      background: "var(--bg-card)",
                      border: temPendencia ? "1px solid rgba(239,68,68,0.5)" : "1px solid var(--border-subtle)",
                      borderRadius: 16, padding: "16px", display: "flex", flexDirection: "column", gap: 12,
                      opacity: isDecidido ? 0.7 : 1 
                    }}>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>

                        {/* INFO DO DOCUMENTO */}
                        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "1 1 min-content", minWidth: 200 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: temPendencia ? "rgba(239,68,68,0.15)" : (isEnviado ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.05)"),
                            color: temPendencia ? "#ef4444" : (isEnviado ? "#38bdf8" : "var(--gray-mid)")
                          }}>
                            {temPendencia ? <MessageSquareWarning size={20} /> : <FileText size={20} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: temPendencia ? "#fca5a5" : "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {docDados.label}
                            </p>
                            <p style={{ fontSize: 11, color: temPendencia ? "#ef4444" : "var(--gray-mid)", marginTop: 2 }}>
                              {temPendencia
                                ? "Aguardando correção do corretor"
                                : isEnviado
                                  ? `${arquivos.length} anexo(s) disponível(is)`
                                  : "Não enviado"}
                            </p>
                          </div>
                        </div>

                        {/* BOTÕES DE AÇÃO */}
                        {!isEditandoPendencia && !isDecidido && (
                          <div className="w-full sm:w-auto" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            
                            {/* Botão de Upload Direto para o Correspondente */}
                            <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px dashed #38bdf8", background: "rgba(56,189,248,0.05)", color: "#38bdf8", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: uploadingGeral ? 0.5 : 1 }}>
                              <UploadCloud size={14} />
                              <span className="hidden sm:inline">Anexar Direto</span>
                              <input type="file" multiple disabled={uploadingGeral} className="hidden" onChange={(e) => handleUploadCorrespondente(e, abaAtiva, docId)} />
                            </label>

                            {temPendencia ? (
                              <button
                                onClick={() => limparPendencia(abaAtiva, docId)}
                                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.1)", color: "#4ade80", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                              >
                                <CheckCircle2 size={14} /> <span className="hidden sm:inline">Validar</span>
                              </button>
                            ) : isEnviado ? (
                              <button
                                onClick={() => abrirFormularioPendencia(docId, docDados.pendenciaCorrespondente)}
                                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                              >
                                <AlertCircle size={14} /> Solicitar Correção
                              </button>
                            ) : (
                              <button
                                onClick={() => abrirFormularioPendencia(docId, docDados.pendenciaCorrespondente)}
                                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.1)", color: "#fbbf24", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                              >
                                <FilePlus size={14} /> Solicitar Documento
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* FORMULÁRIO DE PENDÊNCIA */}
                      {isEditandoPendencia && !isDecidido && (
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: "16px", borderRadius: 12, marginTop: 8, border: "1px dashed #ef4444" }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5", marginBottom: 8 }}>
                            {isEnviado ? "Motivo da pendência (notificará o corretor):" : "Descreva o documento solicitado (notificará o corretor):"}
                          </p>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <input
                              autoFocus type="text"
                              value={textoPendencia}
                              onChange={(e) => setTextoPendencia(e.target.value)}
                              placeholder={isEnviado ? "Ex: Foto do RG está ilegível ou cortada." : "Ex: Enviar extrato bancário dos últimos 3 meses."}
                              style={{ flex: "1 1 200px", padding: "10px 14px", borderRadius: 8, border: "1px solid #ef4444", background: "rgba(0,0,0,0.5)", color: "white", fontSize: 13, outline: "none" }}
                            />
                            <button
                              onClick={() => salvarPendencia(abaAtiva, docId)}
                              disabled={!textoPendencia.trim()}
                              style={{ padding: "0 16px", background: "#ef4444", color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", opacity: textoPendencia.trim() ? 1 : 0.5 }}
                            >
                              Enviar Alerta
                            </button>
                            <button
                              onClick={() => setDocPendenciaAtivo(null)}
                              style={{ padding: "0 12px", background: "rgba(255,255,255,0.1)", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ANEXOS ENVIADOS */}
                      {isEnviado && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          {arquivos.map((arq: any, idx: number) => {
                            const url = typeof arq === "string" ? arq : arq.url;
                            return (
                              <a
                                key={idx} href={url} target="_blank" rel="noopener noreferrer"
                                style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid var(--border-subtle)", padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "white", textDecoration: "none" }}
                              >
                                <ExternalLink size={14} color="#38bdf8" /> Abrir Anexo {idx + 1}
                              </a>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>

            {/* NOVA SOLICITAÇÃO DE DOCUMENTO */}
            {!isDecidido && (
              <div style={{ marginTop: 8, background: "rgba(255,255,255,0.02)", border: "1px dashed var(--border-subtle)", borderRadius: 14, padding: "16px" }}>
                {!mostrandoNovaSolicitacao ? (
                  <button
                    onClick={() => setMostrandoNovaSolicitacao(true)}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", border: "none", color: "#38bdf8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    <FilePlus2 size={16} /> Criar Nova Solicitação de Documento
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", display: "flex", alignItems: "center", gap: 6 }}>
                      <FilePlus2 size={16} /> Nova Solicitação
                    </p>
                    <input
                      autoFocus type="text"
                      value={novaSolicitacaoNome}
                      onChange={e => setNovaSolicitacaoNome(e.target.value)}
                      placeholder="Nome do documento (ex: Extrato Bancário)"
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-active)", background: "rgba(0,0,0,0.4)", color: "white", fontSize: 13, outline: "none" }}
                    />
                    <input
                      type="text"
                      value={novaSolicitacaoDescricao}
                      onChange={e => setNovaSolicitacaoDescricao(e.target.value)}
                      placeholder="Descrição (ex: Extrato dos últimos 3 meses, todas as páginas)"
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-active)", background: "rgba(0,0,0,0.4)", color: "white", fontSize: 13, outline: "none" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={criarNovaSolicitacao}
                        disabled={!novaSolicitacaoNome.trim()}
                        style={{ flex: 1, padding: "10px", background: "#38bdf8", color: "#082f49", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: novaSolicitacaoNome.trim() ? 1 : 0.5 }}
                      >
                        Criar Solicitação
                      </button>
                      <button
                        onClick={() => { setMostrandoNovaSolicitacao(false); setNovaSolicitacaoNome(""); setNovaSolicitacaoDescricao(""); }}
                        style={{ padding: "10px 16px", background: "rgba(255,255,255,0.1)", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            </>
            )}

            {/* FOOTER: DECISÃO DE CRÉDITO E BOTÃO DE REVERTER */}
            <div style={{
              padding: "16px 24px", background: "var(--bg-base)", borderTop: "1px solid var(--border-subtle)",
              flexShrink: 0, zIndex: 10, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center"
            }}>
              {isDecidido ? (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>

                  {/* STATUS + ORIGEM */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    {isAprovado
                      ? <CheckCircle2 size={15} color="#4ade80" />
                      : <AlertCircle size={15} color="#f87171" />
                    }
                    <span style={{ fontSize: 13, fontWeight: 700, color: isAprovado ? "#4ade80" : "#f87171" }}>
                      {isAprovado ? "Crédito aprovado" : "Crédito reprovado"}
                    </span>
                    {isReprovado && lead.origemDesqualificacao && (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, fontWeight: 600,
                        background: lead.origemDesqualificacao === "corretor" ? "rgba(251,146,60,0.1)" : "rgba(239,68,68,0.08)",
                        color: lead.origemDesqualificacao === "corretor" ? "#fb923c" : "#f87171",
                        border: lead.origemDesqualificacao === "corretor" ? "1px solid rgba(251,146,60,0.2)" : "1px solid rgba(239,68,68,0.15)"
                      }}>
                        {lead.origemDesqualificacao === "corretor" ? "pelo Corretor" : "pela Análise de Crédito"}
                      </span>
                    )}
                  </div>

                  {/* MOTIVO */}
                  {isReprovado && lead.motivoReprovacao && (
                    <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border-subtle)", borderLeft: "3px solid rgba(239,68,68,0.4)" }}>
                      <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6, letterSpacing: "0.04em" }}>Motivo registrado</p>
                      <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.6 }}>{lead.motivoReprovacao}</p>
                    </div>
                  )}

                  {/* DETALHES DA APROVAÇÃO */}
                  {isAprovado && lead.creditoAprovadoInfo && (
                    <div style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 10, padding: "14px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <span style={{ fontSize: 12, color: "var(--gray-mid)" }}>Valor liberado</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "white" }}>
                          R$ {lead.creditoAprovadoInfo.valorAprovado?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "var(--gray-mid)" }}>Parcela estimada</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "white" }}>
                          R$ {lead.creditoAprovadoInfo.valorParcela?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {lead.creditoAprovadoInfo.observacoes && (
                        <div style={{ paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Condicionantes</p>
                          <p style={{ fontSize: 12, color: "var(--gray-light)", lineHeight: 1.5 }}>{lead.creditoAprovadoInfo.observacoes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* DOCUMENTOS DE ANÁLISE */}
                  <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(0,0,0,0.15)", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FileCheck2 size={14} color="var(--gray-mid)" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-light)" }}>Documentos de Análise</span>
                        <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 100, background: "rgba(255,255,255,0.05)", color: "var(--gray-dark)", fontWeight: 600 }}>Uso interno</span>
                      </div>
                      <button
                        onClick={() => fileInputAprovacaoRef.current?.click()}
                        disabled={uploadingAprovacao}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--gray-light)", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: uploadingAprovacao ? 0.5 : 1 }}
                      >
                        {uploadingAprovacao ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Enviando</> : <><UploadCloud size={12} /> Anexar</>}
                      </button>
                    </div>
                    <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                      {lead.documentosAnaliseCredito && lead.documentosAnaliseCredito.length > 0 ? (
                        lead.documentosAnaliseCredito.map((docItem: any, index: number) => (
                          <div key={index} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "rgba(0,0,0,0.15)", borderRadius: 7, border: "1px solid var(--border-subtle)" }}>
                            <FileText size={13} color="var(--gray-mid)" style={{ flexShrink: 0 }} />
                            <p style={{ fontSize: 12, color: "var(--gray-light)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{docItem.nome}</p>
                            <a href={docItem.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: "var(--gray-mid)", textDecoration: "none", padding: "3px 8px", borderRadius: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <ExternalLink size={11} />
                            </a>
                            <button onClick={() => removerDocumentoAnalise(index)} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3px 6px", borderRadius: 5, background: "transparent", border: "none", color: "rgba(248,113,113,0.4)", cursor: "pointer" }}>
                              <X size={11} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: 11, color: "var(--gray-dark)", padding: "4px 0" }}>Nenhum documento anexado.</p>
                      )}
                    </div>
                  </div>

                  {/* REVERTER */}
                  <button
                    onClick={reverterDecisao}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "var(--gray-dark)", fontSize: 12, cursor: "pointer", padding: "2px 0", alignSelf: "flex-start", transition: "0.2s" }}
                  >
                    <RefreshCcw size={12} /> Reverter decisão (voltar para análise)
                  </button>

                </div>
              ) : (
                <>
                  <button
                    onClick={() => iniciarProcessoAprovacao("nao_qualificado")}
                    className="flex-1 sm:flex-none"
                    style={{ padding: "9px 18px", background: "transparent", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
                  >
                    <ThumbsDown size={15} /> Reprovar
                  </button>
                  <button
                    onClick={() => iniciarProcessoAprovacao("qualificado")}
                    className="flex-1 sm:flex-none"
                    style={{ padding: "9px 20px", background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.35)", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
                  >
                    <ThumbsUp size={15} /> Aprovar Crédito
                  </button>
                </>
              )}
            </div>

          </motion.div>
        </motion.div>
      )}
      <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 100% { transform: rotate(360deg); } }`}} />
    </AnimatePresence>
  );
}