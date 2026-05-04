"use client";

// ─────────────────────────────────────────────────────────
// IMPORTAÇÕES
// ─────────────────────────────────────────────────────────
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, CheckCircle2, FileText, Camera, Loader2, FileCheck2, 
  ExternalLink, FolderOpen, Plus, Users, Trash2, MessageSquareWarning,
  AlertCircle, Lock, Edit3, Phone, Send, Clock
} from "lucide-react";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { notificarTelegram } from "@/lib/notificacoes"; // ← NOVO: IMPORT DO TELEGRAM

// ─────────────────────────────────────────────────────────
// TIPAGENS E CONSTANTES
// ─────────────────────────────────────────────────────────
interface DossieModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  isAdmin?: boolean; 
}

// ── CHECKLIST ATUALIZADO COM LISTA DO CORRESPONDENTE ──
const CHECKLIST_BASE = [
  { id: "rg_cnh",               label: "RG ou CNH (Frente e Verso)",                  obrigatorio: true  },
  { id: "certidao",             label: "Certidão (Nascimento / Casamento / Divórcio)", obrigatorio: true  },
  { id: "comprovante_renda",    label: "Comprovante de Renda (3 últimos meses)",       obrigatorio: true  },
  { id: "comprovante_endereco", label: "Comprovante de Endereço Atualizado",           obrigatorio: true  },
  { id: "carteira_trabalho",    label: "Carteira de Trabalho — CTPS (se CLT)",         obrigatorio: false },
  { id: "imposto_renda",        label: "Declaração de IR (se declarante)",             obrigatorio: false },
];

interface ToastMessage {
  msg: string;
  tipo: "sucesso" | "erro";
}

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────
export function DossieModal({ isOpen, onClose, lead, isAdmin = false }: DossieModalProps) {
  // ── ESTADOS DA INTERFACE ──
  const [abaAtiva, setAbaAtiva] = useState<string>("proponente");
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [novoDocNome, setNovoDocNome] = useState("");
  const [mostrandoInputNovoDoc, setMostrandoInputNovoDoc] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // 👇 ADICIONE ESTAS DUAS LINHAS 👇
  const [editandoFicha, setEditandoFicha] = useState(false);
  const [fichaForm, setFichaForm] = useState<any>({});
  
  // ── ESTADO DO MODAL PARA ADICIONAR/EDITAR PESSOA ──
  const [promptConfig, setPromptConfig] = useState<{isOpen: boolean, tipo: "adicionar" | "editar", valor: string}>({isOpen: false, tipo: "adicionar", valor: ""});

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadAlvo, setUploadAlvo] = useState<{ pessoaId: string, docId: string } | null>(null);

  if (!isOpen || !lead) return null;

  // ─────────────────────────────────────────────────────────
  // ESTRUTURA DE DADOS DO DOSSIÊ
  // ─────────────────────────────────────────────────────────
  const dossie = lead.dossie || {
    proponente: {
      nome: "Proponente Principal",
      documentos: CHECKLIST_BASE.reduce((acc, item) => ({ ...acc, [item.id]: { label: item.label, arquivos: [], pendenciaCorrespondente: "" } }), {})
    }
  };

  const pessoaAtual = dossie[abaAtiva];
  const listaDocumentosPessoa = Object.entries(pessoaAtual?.documentos || {});
  
  const qtdeArquivosEnviadosAbaAtual = listaDocumentosPessoa.reduce((total: number, [_, doc]: any) => {
    return total + (doc.arquivos ? doc.arquivos.length : 0);
  }, 0);

  // ─────────────────────────────────────────────────────────
  // FUNÇÕES DE FEEDBACK VISUAL (TOAST)
  // ─────────────────────────────────────────────────────────
  const mostrarToast = (msg: string, tipo: "sucesso" | "erro") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  // 👇 ADICIONE ESTE BLOCO 👇
  const iniciarEdicaoFicha = () => {
    setFichaForm(lead.preCadastro || {});
    setEditandoFicha(true);
  };

  const salvarFicha = async () => {
    try {
      await updateDoc(doc(db, "leads", lead.id), { preCadastro: fichaForm });
      setEditandoFicha(false);
      mostrarToast("Ficha atualizada com sucesso!", "sucesso");
    } catch (error) {
      console.error(error);
      mostrarToast("Erro ao atualizar ficha.", "erro");
    }
  };

  // ─────────────────────────────────────────────────────────
  // FUNÇÕES DE GERENCIAMENTO DE PESSOAS (ABAS)
  // ─────────────────────────────────────────────────────────
  const iniciarAdicionarCompositor = () => {
    setPromptConfig({ isOpen: true, tipo: "adicionar", valor: "" });
  };

  const iniciarEditarNome = () => {
    if (abaAtiva === "proponente") {
      mostrarToast("O nome do proponente principal deve ser editado no perfil do Lead.", "erro");
      return;
    }
    setPromptConfig({ isOpen: true, tipo: "editar", valor: dossie[abaAtiva].nome });
  };

  const confirmarPromptPessoa = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = promptConfig.valor.trim();
    if (!nome) return;

    if (promptConfig.tipo === "adicionar") {
      const idNovaPessoa = `compositor_${Date.now()}`;
      const novaEstruturaDocumentos = CHECKLIST_BASE.reduce((acc, item) => ({ ...acc, [item.id]: { label: item.label, arquivos: [], pendenciaCorrespondente: "" } }), {});
      
      const dossieAtualizado = {
        ...dossie,
        [idNovaPessoa]: { nome: nome, documentos: novaEstruturaDocumentos }
      };

      try {
        await updateDoc(doc(db, "leads", lead.id), { dossie: dossieAtualizado });
        setAbaAtiva(idNovaPessoa);
        mostrarToast("Compositor de renda adicionado!", "sucesso");
      } catch (error) {
        mostrarToast("Erro ao adicionar pessoa.", "erro");
      }
    } else if (promptConfig.tipo === "editar") {
      if (nome === dossie[abaAtiva].nome) {
        setPromptConfig({ ...promptConfig, isOpen: false });
        return;
      }
      
      const dossieAtualizado = {
        ...dossie,
        [abaAtiva]: { ...dossie[abaAtiva], nome: nome }
      };

      try {
        await updateDoc(doc(db, "leads", lead.id), { dossie: dossieAtualizado });
        mostrarToast("Nome editado com sucesso!", "sucesso");
      } catch (error) {
        mostrarToast("Erro ao editar o nome.", "erro");
      }
    }
    setPromptConfig({ ...promptConfig, isOpen: false });
  };

  const excluirPessoa = async () => {
    if (abaAtiva === "proponente") {
      mostrarToast("Não podes excluir o Proponente Principal.", "erro");
      return;
    }
    
    // Se NÃO for Admin e a aba tiver arquivos, ele barra. (Ou seja, Admin tem passe livre)
    if (!isAdmin && qtdeArquivosEnviadosAbaAtual > 0) {
      mostrarToast("Não é possível excluir um proponente que já tem arquivos enviados. Apague os arquivos primeiro.", "erro");
      return;
    }

    if (!window.confirm(`Remover definitivamente a aba de "${dossie[abaAtiva].nome}"?`)) return;

    const dossieAtualizado = { ...dossie };
    delete dossieAtualizado[abaAtiva];

    try {
      await updateDoc(doc(db, "leads", lead.id), { dossie: dossieAtualizado });
      setAbaAtiva("proponente");
      mostrarToast("Proponente removido.", "sucesso");
    } catch (error) {
      console.error(error);
      mostrarToast("Erro ao remover a aba.", "erro");
    }
  };

  // ─────────────────────────────────────────────────────────
  // FUNÇÕES DE GERENCIAMENTO DE PASTAS E UPLOADS
  // ─────────────────────────────────────────────────────────
  const adicionarDocumentoExtra = async () => {
    if (!novoDocNome.trim()) return;

    const idNovoDoc = `extra_${Date.now()}`;
    const pessoaAtual = dossie[abaAtiva];

    const dossieAtualizado = {
      ...dossie,
      [abaAtiva]: {
        ...pessoaAtual,
        documentos: {
          ...pessoaAtual.documentos,
          [idNovoDoc]: { label: novoDocNome, arquivos: [], pendenciaCorrespondente: "" }
        }
      }
    };

    try {
      await updateDoc(doc(db, "leads", lead.id), { dossie: dossieAtualizado });
      setNovoDocNome("");
      setMostrandoInputNovoDoc(false);
      mostrarToast("Pasta criada com sucesso!", "sucesso");
    } catch (error) {
      console.error(error);
      mostrarToast("Erro ao criar nova pasta.", "erro");
    }
  };

  const acionarUpload = (pessoaId: string, docId: string) => {
    setUploadAlvo({ pessoaId, docId });
    if (inputRef.current) inputRef.current.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !uploadAlvo) return;

    setUploadingDocId(uploadAlvo.docId);

    try {
      const pessoaAlvo = dossie[uploadAlvo.pessoaId];
      const docAlvo = pessoaAlvo.documentos[uploadAlvo.docId];
      const arquivosAtuais = docAlvo.arquivos || [];
      const novosArquivos: any[] = [];

      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExtension = file.name.split('.').pop() || "jpg";
        const fileName = `${uploadAlvo.docId}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExtension}`;
        const caminhoStorage = `leads/${lead.id}/dossie/${uploadAlvo.pessoaId}/${fileName}`;
        
        const storageRef = ref(storage, caminhoStorage);
        const uploadTask = await uploadBytesResumable(storageRef, file);
        const downloadURL = await getDownloadURL(uploadTask.ref);
        
        return {
          url: downloadURL,
          path: caminhoStorage,
          bloqueado: false 
        };
      });

      const arquivosCompletos = await Promise.all(uploadPromises);
      novosArquivos.push(...arquivosCompletos);

      const dossieAtualizado = {
        ...dossie,
        [uploadAlvo.pessoaId]: {
          ...pessoaAlvo,
          documentos: {
            ...pessoaAlvo.documentos,
            [uploadAlvo.docId]: {
              ...docAlvo,
              arquivos: [...arquivosAtuais, ...novosArquivos],
              pendenciaCorrespondente: ""
            }
          }
        }
      };

      await updateDoc(doc(db, "leads", lead.id), { dossie: dossieAtualizado });
      mostrarToast(`${files.length} anexo(s) adicionado(s)!`, "sucesso");

      // ─────────────────────────────────────────────────────────
      // ← NOVO: DISPARO DE TELEGRAM AO ANEXAR DOCUMENTO
      // ─────────────────────────────────────────────────────────
      try {
        const dataFormatada = new Date().toLocaleString("pt-BR", { 
          day: "2-digit", month: "2-digit", year: "numeric", 
          hour: "2-digit", minute: "2-digit" 
        }).replace(",", " às");

        const mensagemDoc = 
`📎 <b>DOCUMENTOS ATUALIZADOS</b> 📎
━━━━━━━━━━━━━━━━━━━━
👤 <b>Cliente:</b> ${lead.nome}
👷‍♂️ <b>Corretor:</b> ${lead.nomeCorretor || "Não atribuído (House)"}
📂 <b>Arquivo anexado:</b> ${docAlvo.label}
👥 <b>Referente a:</b> ${pessoaAlvo.nome}
📅 <b>Data:</b> ${dataFormatada}
━━━━━━━━━━━━━━━━━━━━
🎯 <i>Novos arquivos foram anexados ao dossiê. Acesse a mesa de crédito para analisar a documentação.</i>`;

        await notificarTelegram("documentoAnexado", mensagemDoc);
      } catch (telegramErr) {
        console.error("Erro ao enviar notificação do Telegram:", telegramErr);
      }

      if (inputRef.current) inputRef.current.value = "";

    } catch (error) {
      console.error("Erro no upload:", error);
      mostrarToast("Erro de conexão ao salvar arquivo.", "erro");
    } finally {
      setUploadingDocId(null);
      setUploadAlvo(null);
    }
  };

  const removerArquivo = async (pessoaId: string, docId: string, arquivoIndex: number) => {
    const pessoaAlvo = dossie[pessoaId];
    const docAlvo = pessoaAlvo.documentos[docId];
    const arquivoAlvo = docAlvo.arquivos[arquivoIndex];

    const isLegacy = typeof arquivoAlvo === 'string'; 
    const isBloqueado = isLegacy ? true : arquivoAlvo.bloqueado;

    if (isBloqueado && !isAdmin) {
      mostrarToast("Este arquivo já foi salvo e não pode ser apagado.", "erro");
      return;
    }

    if (!confirm(isAdmin ? "Atenção (Admin): Remover definitivamente este arquivo de cliente?" : "Remover esta foto/arquivo?")) return;

    try {
      if (arquivoAlvo.path) {
        const fileRef = ref(storage, arquivoAlvo.path);
        await deleteObject(fileRef);
      }

      const arquivosAtualizados = docAlvo.arquivos.filter((_: any, index: number) => index !== arquivoIndex);

      const dossieAtualizado = {
        ...dossie,
        [pessoaId]: {
          ...pessoaAlvo,
          documentos: {
            ...pessoaAlvo.documentos,
            [docId]: {
              ...docAlvo,
              arquivos: arquivosAtualizados
            }
          }
        }
      };

      await updateDoc(doc(db, "leads", lead.id), { dossie: dossieAtualizado });
      mostrarToast("Arquivo excluído do sistema.", "sucesso");
    } catch (error) {
      console.error("Erro ao remover:", error);
      mostrarToast("Erro ao tentar excluir fisicamente o arquivo.", "erro");
    }
  };

  // ─────────────────────────────────────────────────────────
  // FINALIZAR DOSSIÊ (TRANCA TODOS OS ARQUIVOS)
  // ─────────────────────────────────────────────────────────
  const finalizarDossie = async () => {
    try {
      const leadRef = doc(db, "leads", lead.id);
      const dossieAtualizado = { ...dossie };

      for (const pessoaId in dossieAtualizado) {
        for (const docId in dossieAtualizado[pessoaId].documentos) {
          const docData = dossieAtualizado[pessoaId].documentos[docId];
          
          if (docData.arquivos && docData.arquivos.length > 0) {
            docData.arquivos = docData.arquivos.map((arq: any) => {
              if (typeof arq === 'string') {
                return { url: arq, path: "", bloqueado: true }; 
              }
              return { ...arq, bloqueado: true }; 
            });
          }
        }
      }

      await updateDoc(leadRef, {
        status: "em_atendimento",
        dossie: dossieAtualizado
      });

      mostrarToast("Dossiê concluído e documentos bloqueados!", "sucesso");
      
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (error) {
      console.error(error);
      mostrarToast("Erro ao finalizar dossiê.", "erro");
    }
  };

  // ─────────────────────────────────────────────────────────
  // DADOS DO PACOTE DE ASSINATURA
  // ─────────────────────────────────────────────────────────
  const pacote = lead.pacoteAssinatura || {};
  const slotsContrato = [
    { campo: "contratoHabiticon", label: "Contrato Habiticon", cor: "#fb923c" },
    { campo: "memorialDescritivo", label: "Memorial Descritivo", cor: "#a78bfa" },
    { campo: "contratoCaixa",      label: "Contrato da Caixa",  cor: "#38bdf8" },
  ];
  const totalProntosContrato = slotsContrato.filter(s => pacote[s.campo]).length;

  // ─────────────────────────────────────────────────────────
  // RENDERIZAÇÃO
  // ─────────────────────────────────────────────────────────
  const totalEnviados = listaDocumentosPessoa.filter(([_, doc]: any) => doc.arquivos && doc.arquivos.length > 0).length;
  const progresso = (totalEnviados / listaDocumentosPessoa.length) * 100;

  return (
    <AnimatePresence>
      {isOpen && lead && (
        <motion.div
          key="dossie-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-overlay"
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center"
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            key="dossie-modal-content"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{
              background: "var(--bg-base)", width: "100%", maxWidth: 640,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              maxHeight: "92vh", display: "flex", flexDirection: "column",
              border: "1px solid var(--border-subtle)", borderBottom: "none",
              boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
              position: "relative"
            }}
          >
            
            {/* ── NOTIFICAÇÃO FLUTUANTE (TOAST) ── */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  style={{
                    position: "absolute", top: 20, left: "50%", x: "-50%", zIndex: 999,
                    background: toast.tipo === "sucesso" ? "rgba(22, 163, 74, 0.95)" : "rgba(239, 68, 68, 0.95)",
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

            {/* Apenas retirei o capture="environment" */}
            <input 
              type="file" ref={inputRef} onChange={handleFileChange} multiple 
              style={{ display: "none" }} accept=".pdf, image/*" 
            />

            {/* ── HEADER DO MODAL ── */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", position: "sticky", top: 0, background: "var(--bg-base)", zIndex: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 10 }}>
                    <FolderOpen size={22} color="var(--terracota)" /> 
                    {isAdmin ? "Dossiê Cliente (Admin)" : "Dossiê Digital"}
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--gray-mid)", marginTop: 2 }}>
                    <strong style={{ color: "var(--gray-light)" }}>{lead.nome}</strong> • {lead.empreendimentoNome}
                  </p>
                  
                  {/* ── WhatsApps com identificação ── */}
                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                     <a 
                       href={`https://wa.me/55${(lead.whatsapp || "").replace(/\D/g, "")}`} 
                       target="_blank" rel="noopener noreferrer"
                       style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#4ade80", textDecoration: "none", background: "rgba(74,222,128,0.1)", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(74,222,128,0.2)" }}
                     >
                       <Phone size={12} />
                       <span style={{ fontWeight: 400, color: "rgba(74,222,128,0.7)" }}>Cliente:</span>
                       {lead.whatsapp}
                     </a>
                     
                     {lead.whatsapp2 && lead.whatsapp2.replace(/\D/g, "").length >= 10 && (
                       <a 
                         href={`https://wa.me/55${(lead.whatsapp2 || "").replace(/\D/g, "")}`} 
                         target="_blank" rel="noopener noreferrer"
                         style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#38bdf8", textDecoration: "none", background: "rgba(56,189,248,0.1)", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(56,189,248,0.2)" }}
                       >
                         <Phone size={12} />
                         <span style={{ fontWeight: 400, color: "rgba(56,189,248,0.7)" }}>Cliente 2:</span>
                         {lead.whatsapp2}
                       </a>
                     )}
                  </div>
                </div>
                
                <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-light)", cursor: "pointer", transition: "0.2s", flexShrink: 0 }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ── ABAS DE PESSOAS ── */}
            <div style={{ position: "relative" }}>
              <div style={{ 
                display: "flex", gap: 8, paddingTop: 12, paddingLeft: 24, 
                overflowX: "auto", overflowY: "visible", 
                borderBottom: "1px solid var(--border-subtle)"
              }}>
                {Object.entries(dossie).map(([id, pessoa]: any) => (
                  <button
                    key={id} onClick={() => setAbaAtiva(id)}
                    style={{
                      padding: "10px 16px", borderRadius: "10px 10px 0 0", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                      background: abaAtiva === id ? "var(--terracota-glow)" : "transparent",
                      color: abaAtiva === id ? "var(--terracota-light)" : "var(--gray-mid)",
                      borderBottom: abaAtiva === id ? "2px solid var(--terracota)" : "2px solid transparent"
                    }}
                  >
                    <Users size={14} style={{ display: "inline", marginRight: 6, marginBottom: -2 }} />
                    {pessoa.nome}
                  </button>
                ))}
                <button onClick={iniciarAdicionarCompositor} style={{
  padding: "10px 16px", borderRadius: "10px 10px 0 0", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  background: "transparent", color: "#fb923c", display: "flex", alignItems: "center", gap: 6
}}>
                  <Plus size={14} /> Compositor
                </button>
                <div style={{ flexShrink: 0, width: 24 }} />
              </div>
            </div>

            {/* ── CORPO DO MODAL ── */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              
              {/* ── FICHA DE PRÉ-CADASTRO DO CLIENTE ── */}
              {abaAtiva === "proponente" && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--terracota-light)", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                      <FileText size={16} /> Ficha de Pré-Cadastro
                    </h3>
                    
                    {!editandoFicha ? (
                      <button onClick={iniciarEdicaoFicha} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "6px 12px", borderRadius: 8, color: "var(--gray-light)", fontSize: 12, cursor: "pointer", transition: "0.2s" }}>
                        <Edit3 size={14} /> Editar
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setEditandoFicha(false)} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.1)", border: "none", padding: "6px 12px", borderRadius: 8, color: "#f87171", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                          <X size={14} /> Cancelar
                        </button>
                        <button onClick={salvarFicha} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--terracota)", border: "none", padding: "6px 12px", borderRadius: 8, color: "white", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                          <CheckCircle2 size={14} /> Salvar
                        </button>
                      </div>
                    )}
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
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Observações do Corretor</label>
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
                      </div>

                      {lead.preCadastro?.observacoesCorretor && (
                        <div style={{ marginTop: 4, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                          <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Observações do Corretor:</p>
                          <p style={{ fontSize: 13, color: "var(--gray-light)", marginTop: 4, lineHeight: 1.5 }}>{lead.preCadastro?.observacoesCorretor}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

{/* 👇 CAIXA LARANJA RESTAURADA COM OS BOTÕES DE EDITAR/EXCLUIR COMPOSITOR 👇 */}
              <div style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 16, padding: "16px", display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
                <FileCheck2 size={22} color="#fb923c" style={{ flexShrink: 0 }} />
                <div style={{ width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#fb923c" }}>Anexos de {pessoaAtual?.nome}</p>
                    
                    {abaAtiva !== "proponente" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button 
                          onClick={iniciarEditarNome}
                          style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "4px 8px", borderRadius: 6, color: "var(--gray-light)", fontSize: 11, cursor: "pointer" }}
                        >
                          <Edit3 size={12} /> Editar Nome
                        </button>
                        
                        {qtdeArquivosEnviadosAbaAtual === 0 && (
                          <button 
                            onClick={excluirPessoa}
                            style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", padding: "4px 8px", borderRadius: 6, color: "#fca5a5", fontSize: 11, cursor: "pointer" }}
                          >
                            <Trash2 size={12} /> Excluir
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: 12, color: "rgba(251,146,60,0.85)", lineHeight: 1.5 }}>
                    O sistema salva os documentos automaticamente. O envio de várias fotos no mesmo arquivo é permitido.
                  </p>
                  <div style={{ display: "center", alignItems: "center", gap: 12, marginTop: 12 }}>
                    <div style={{ flex: 1, height: 6, background: "rgba(0,0,0,0.4)", borderRadius: 10, overflow: "hidden" }}>
                       <div style={{ height: "100%", width: `${progresso}%`, background: progresso === 100 ? "#4ade80" : "#fb923c", transition: "width 0.5s ease" }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: progresso === 100 ? "#4ade80" : "var(--gray-mid)" }}>
                      {totalEnviados}/{listaDocumentosPessoa.length} Pastas
                    </span>
                  </div>
                </div>
              </div>

              {/* Listagem de Documentos */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {listaDocumentosPessoa.map(([docId, docDados]: any) => {
                  const arquivos = docDados.arquivos || [];
                  const isEnviado = arquivos.length > 0;
                  const isUploading = uploadingDocId === docId;
                  const temPendencia = docDados.pendenciaCorrespondente && docDados.pendenciaCorrespondente !== "";

                  return (
                    <div key={docId} style={{
                      background: "var(--bg-card)", 
                      border: temPendencia ? "1px solid rgba(239,68,68,0.5)" : (isEnviado ? "1px solid rgba(74,222,128,0.3)" : "1px solid var(--border-subtle)"),
                      borderRadius: 16, padding: "16px", display: "flex", flexDirection: "column", gap: 12
                    }}>
                      
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "1 1 min-content", minWidth: 200 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            background: temPendencia ? "rgba(239,68,68,0.15)" : (isEnviado ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.05)"),
                            color: temPendencia ? "#ef4444" : (isEnviado ? "#4ade80" : "var(--gray-mid)")
                          }}>
                            {temPendencia ? <MessageSquareWarning size={20} /> : (isEnviado ? <CheckCircle2 size={20} /> : <FileText size={20} />)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: temPendencia ? "#fca5a5" : (isEnviado ? "white" : "var(--gray-light)"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {docDados.label}
                            </p>
                            <p style={{ fontSize: 11, color: temPendencia ? "#ef4444" : (isEnviado ? "#4ade80" : "var(--gray-dark)"), marginTop: 2 }}>
                              {temPendencia ? "Ação Necessária" : (isEnviado ? `${arquivos.length} anexo(s) salvo(s)` : "Pendente")}
                            </p>
                          </div>
                        </div>

                        <button 
                          onClick={() => acionarUpload(abaAtiva, docId)}
                          disabled={isUploading}
                          className="w-full sm:w-auto"
                          style={{
                            padding: "10px 16px", borderRadius: 10, border: "none", cursor: isUploading ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, fontWeight: 800, transition: "0.2s",
                            background: "var(--terracota)", color: "white"
                          }}
                        >
                          {isUploading ? (
                            <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Carregando...</>
                          ) : (
                            <><Camera size={14} /> {isEnviado ? "+ Anexar mais" : "Anexar"}</>
                          )}
                        </button>
                      </div>

                      {temPendencia && (
                        <div style={{ background: "rgba(239,68,68,0.1)", padding: "10px 14px", borderRadius: 8, borderLeft: "3px solid #ef4444", marginTop: 4 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", marginBottom: 2 }}>Correspondente solicitou:</p>
                          <p style={{ fontSize: 13, color: "#fca5a5" }}>{docDados.pendenciaCorrespondente}</p>
                        </div>
                      )}

                      {/* LISTA DE ARQUIVOS */}
                      {isEnviado && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          {arquivos.map((arq: any, idx: number) => {
                            const isLegacy = typeof arq === 'string';
                            const url = isLegacy ? arq : arq.url;
                            const isBloqueado = isLegacy ? true : arq.bloqueado;

                            return (
                              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 0, background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                                <a 
                                  href={url} target="_blank" rel="noopener noreferrer"
                                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: 11, color: "var(--gray-light)", textDecoration: "none" }}
                                >
                                  <ExternalLink size={12} color="var(--terracota)" /> Anexo {idx + 1}
                                </a>
                                
                                {(!isBloqueado || isAdmin) ? (
                                  <button 
                                    onClick={() => removerArquivo(abaAtiva, docId, idx)}
                                    style={{ 
                                      background: "rgba(239,68,68,0.1)", border: "none", borderLeft: "1px solid var(--border-subtle)", 
                                      padding: "6px 10px", cursor: "pointer", color: "#f87171", display: "flex", alignItems: "center" 
                                    }}
                                    title={isAdmin && isBloqueado ? "Remover forçadamente (Poder de Admin)" : "Remover anexo"}
                                  >
                                    <X size={12} />
                                  </button>
                                ) : (
                                  <span 
                                    style={{ padding: "6px 10px", background: "rgba(0,0,0,0.4)", borderLeft: "1px solid var(--border-subtle)", color: "var(--gray-dark)", display: "flex", alignItems: "center" }} 
                                    title="Arquivo já consolidado. Apenas administradores podem excluir."
                                  >
                                    <Lock size={12} />
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>

              {/* ── PACOTE DE ASSINATURA (RESTRITO AO ADMIN) ── */}
              <div style={{ borderRadius: 14, border: isAdmin ? "1px solid rgba(167,139,250,0.25)" : "1px solid var(--border-subtle)", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", background: isAdmin ? "rgba(167,139,250,0.08)" : "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FileCheck2 size={16} color={isAdmin ? "#a78bfa" : "var(--gray-dark)"} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: isAdmin ? "#a78bfa" : "var(--gray-dark)" }}>
                      Pacote de Assinatura
                    </span>
                    {!isAdmin && (
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(255,255,255,0.05)", color: "var(--gray-dark)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Lock size={10} /> Restrito à Construtora
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <span style={{ fontSize: 11, color: "var(--gray-mid)" }}>{totalProntosContrato}/3 prontos</span>
                  )}
                </div>

                {isAdmin ? (
                  <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {slotsContrato.map(item => {
                      const dados = pacote[item.campo];
                      return (
                        <div key={item.campo} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: dados ? `${item.cor}10` : "rgba(0,0,0,0.15)", border: dados ? `1px solid ${item.cor}30` : "1px solid var(--border-subtle)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {dados ? <CheckCircle2 size={14} color={item.cor} /> : <Clock size={14} color="var(--gray-dark)" />}
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 700, color: dados ? "white" : "var(--gray-mid)" }}>{item.label}</p>
                              {dados && <p style={{ fontSize: 10, color: item.cor, marginTop: 1 }}>{dados.nome}</p>}
                            </div>
                          </div>
                          {dados && (
                            <a href={dados.url} target="_blank" rel="noopener noreferrer" style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "var(--gray-light)", fontSize: 10, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                              <ExternalLink size={10} /> Abrir
                            </a>
                          )}
                        </div>
                      );
                    })}

                    {totalProntosContrato === 3 && (
                      <button
                        onClick={() => window.open("https://app.autentique.com.br/", "_blank")}
                        style={{ marginTop: 8, padding: "12px", borderRadius: 10, background: "#4ade80", color: "#052e16", border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 14px rgba(74,222,128,0.3)" }}
                      >
                        <Send size={14} /> Enviar Pacote para Autentique
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "20px 16px", textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "var(--gray-dark)" }}>Os contratos são gerenciados internamente pela construtora.</p>
                  </div>
                )}
              </div>

              {/* Botão Extra */}
              <div style={{ marginTop: 8, background: "rgba(255,255,255,0.02)", border: "1px dashed var(--border-subtle)", borderRadius: 14, padding: "16px" }}>
                {!mostrandoInputNovoDoc ? (
                  <button 
                    onClick={() => setMostrandoInputNovoDoc(true)}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", border: "none", color: "var(--gray-mid)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    <Plus size={16} /> Adicionar tipo de documento extra
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
                    <p style={{ fontSize: 12, color: "var(--gray-light)", fontWeight: 600 }}>Nome do Documento (Ex: Extrato Nubank):</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input 
                        autoFocus
                        type="text" 
                        value={novoDocNome}
                        onChange={e => setNovoDocNome(e.target.value)}
                        placeholder="Digite o nome do documento..."
                        style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-active)", background: "rgba(0,0,0,0.4)", color: "white", fontSize: 13, outline: "none" }}
                      />
                      <button 
                        onClick={adicionarDocumentoExtra}
                        disabled={!novoDocNome.trim()}
                        style={{ padding: "0 16px", background: "var(--terracota)", color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", opacity: novoDocNome.trim() ? 1 : 0.5 }}
                      >
                        Salvar
                      </button>
                      <button onClick={() => {setMostrandoInputNovoDoc(false); setNovoDocNome("");}} style={{ padding: "0 12px", background: "rgba(255,255,255,0.1)", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* ── FOOTER: BOTÃO DE CONCLUIR ── */}
            <div style={{ 
              padding: "16px 24px", background: "var(--bg-base)", borderTop: "1px solid var(--border-subtle)", 
              position: "sticky", bottom: 0, zIndex: 10, display: "flex", justifyContent: "flex-end"
            }}>
              <button 
                onClick={finalizarDossie}
                className="w-full sm:w-auto"
                style={{
                  padding: "14px 24px", background: "#4ade80", color: "#064e3b", border: "none", borderRadius: 12,
                  fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 4px 14px rgba(74, 222, 128, 0.3)", transition: "all 0.2s"
                }}
              >
                <CheckCircle2 size={18} />
                Salvar e Concluir Dossiê
              </button>
            </div>

          {/* ── MODAL PARA NOME DO COMPOSITOR ── */}
            <AnimatePresence>
              {promptConfig.isOpen && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{
                    position: "absolute", inset: 0, zIndex: 200,
                    background: "rgba(15,30,22,0.95)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
                    borderRadius: 28
                  }}
                >
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 20, padding: 24, width: "100%", maxWidth: 400, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "white", marginBottom: 8 }}>
                      {promptConfig.tipo === "adicionar" ? "Adicionar Compositor" : "Editar Nome"}
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--gray-mid)", marginBottom: 16 }}>
                      {promptConfig.tipo === "adicionar" ? "Qual o nome e grau de parentesco? (Ex: Maria - Cônjuge)" : "Altere o nome ou grau de parentesco do compositor."}
                    </p>
                    <form onSubmit={confirmarPromptPessoa} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <input
                        autoFocus
                        type="text"
                        className="input-field"
                        value={promptConfig.valor}
                        onChange={e => setPromptConfig({...promptConfig, valor: e.target.value})}
                        placeholder="Ex: João Silva - Irmão"
                        style={{ fontSize: 14 }}
                      />
                      <div style={{ display: "flex", gap: 12 }}>
                        <button type="button" onClick={() => setPromptConfig({...promptConfig, isOpen: false})} style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", borderRadius: 10, color: "var(--gray-light)", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                        <button type="submit" disabled={!promptConfig.valor.trim()} style={{ flex: 1, padding: "10px", background: "var(--terracota)", border: "none", borderRadius: 10, color: "white", fontWeight: 700, cursor: "pointer", opacity: promptConfig.valor.trim() ? 1 : 0.5 }}>Confirmar</button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        </motion.div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </AnimatePresence>
  );
}