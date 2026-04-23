"use client";

// ─────────────────────────────────────────────────────────
// IMPORTAÇÕES
// ─────────────────────────────────────────────────────────
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, CheckCircle2, FileText, Camera, Loader2, FileCheck2, 
  ExternalLink, FolderOpen, Plus, Users, Trash2, MessageSquareWarning,
  AlertCircle, Lock, Edit3, Phone
} from "lucide-react";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";

// ─────────────────────────────────────────────────────────
// TIPAGENS E CONSTANTES
// ─────────────────────────────────────────────────────────
interface DossieModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  isAdmin?: boolean; 
}

const CHECKLIST_BASE = [
  { id: "rg_cnh", label: "RG ou CNH (Frente e Verso)", obrigatorio: true },
  { id: "estado_civil", label: "Certidão de Nasc./Casamento", obrigatorio: true },
  { id: "comprovante_endereco", label: "Comprovante de Endereço", obrigatorio: true },
  { id: "comprovante_renda", label: "Comprovante de Renda (3 meses)", obrigatorio: true },
  { id: "carteira_trabalho", label: "Carteira de Trabalho (CTPS)", obrigatorio: false },
  { id: "imposto_renda", label: "Declaração de IR", obrigatorio: false },
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
  
  // Calcula o total de ficheiros enviados desta aba para ver se pode ser apagada
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

  // ─────────────────────────────────────────────────────────
  // FUNÇÕES DE GERENCIAMENTO DE PESSOAS (ABAS)
  // ─────────────────────────────────────────────────────────
  const adicionarCompositorRenda = async () => {
    const nomeCompositor = prompt("Qual o nome e grau de parentesco? (Ex: Maria - Cônjuge)");
    if (!nomeCompositor) return;

    const idNovaPessoa = `compositor_${Date.now()}`;
    const novaEstruturaDocumentos = CHECKLIST_BASE.reduce((acc, item) => ({ ...acc, [item.id]: { label: item.label, arquivos: [], pendenciaCorrespondente: "" } }), {});

    const dossieAtualizado = {
      ...dossie,
      [idNovaPessoa]: {
        nome: nomeCompositor,
        documentos: novaEstruturaDocumentos
      }
    };

    try {
      await updateDoc(doc(db, "leads", lead.id), { dossie: dossieAtualizado });
      setAbaAtiva(idNovaPessoa);
      mostrarToast("Compositor de renda adicionado!", "sucesso");
    } catch (error) {
      console.error(error);
      mostrarToast("Erro ao adicionar pessoa.", "erro");
    }
  };

  const editarNomePessoa = async () => {
    if (abaAtiva === "proponente") {
      mostrarToast("O nome do proponente principal deve ser editado no perfil do Lead.", "erro");
      return;
    }
    
    const nomeAtual = dossie[abaAtiva].nome;
    const novoNome = prompt("Edite o nome ou grau de parentesco:", nomeAtual);
    if (!novoNome || novoNome === nomeAtual) return;

    const dossieAtualizado = {
      ...dossie,
      [abaAtiva]: {
        ...dossie[abaAtiva],
        nome: novoNome
      }
    };

    try {
      await updateDoc(doc(db, "leads", lead.id), { dossie: dossieAtualizado });
      mostrarToast("Nome editado com sucesso!", "sucesso");
    } catch (error) {
      console.error(error);
      mostrarToast("Erro ao editar o nome.", "erro");
    }
  };

  const excluirPessoa = async () => {
    if (abaAtiva === "proponente") {
      mostrarToast("Não podes excluir o Proponente Principal.", "erro");
      return;
    }
    
    if (qtdeArquivosEnviadosAbaAtual > 0) {
      mostrarToast("Não é possível excluir um proponente que já tem arquivos enviados. Apague os arquivos primeiro.", "erro");
      return;
    }

    if (!confirm(`Remover definitivamente a aba de "${dossie[abaAtiva].nome}"?`)) return;

    // Criamos uma cópia e deletamos o ID específico
    const dossieAtualizado = { ...dossie };
    delete dossieAtualizado[abaAtiva];

    try {
      await updateDoc(doc(db, "leads", lead.id), { dossie: dossieAtualizado });
      setAbaAtiva("proponente"); // Volta para o principal
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

            <input 
              type="file" ref={inputRef} onChange={handleFileChange} multiple 
              style={{ display: "none" }} accept=".pdf, image/*" capture="environment" 
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
                  
                  {/* NOVO: EXIBIÇÃO DOS NÚMEROS DE CONTACTO NO DOSSIÊ */}
                  <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                     <a 
                       href={`https://wa.me/55${(lead.whatsapp || "").replace(/\D/g, "")}`} 
                       target="_blank" rel="noopener noreferrer"
                       style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#4ade80", textDecoration: "none", background: "rgba(74,222,128,0.1)", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(74,222,128,0.2)" }}
                     >
                       <Phone size={12} /> {lead.whatsapp}
                     </a>
                     
                     {lead.whatsapp2 && lead.whatsapp2.replace(/\D/g, "").length >= 10 && (
                       <a 
                         href={`https://wa.me/55${(lead.whatsapp2 || "").replace(/\D/g, "")}`} 
                         target="_blank" rel="noopener noreferrer"
                         style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#38bdf8", textDecoration: "none", background: "rgba(56,189,248,0.1)", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(56,189,248,0.2)" }}
                       >
                         <Phone size={12} /> {lead.whatsapp2} (Whats 2)
                       </a>
                     )}
                  </div>
                </div>
                
                <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-light)", cursor: "pointer", transition: "0.2s", flexShrink: 0 }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ── ABAS DE PESSOAS (COM FIX CSS DE OVERFLOW + SPACER E BOTÕES DE EDICAO) ── */}
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
                <button
                  onClick={adicionarCompositorRenda}
                  style={{
                    padding: "10px 16px", borderRadius: "10px 10px 0 0", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                    background: "transparent", color: "#fb923c", display: "flex", alignItems: "center", gap: 6
                  }}
                >
                  <Plus size={14} /> Compositor
                </button>
                
                {/* Spacer invisível para impedir que o último item fique cortado no scroll */}
                <div style={{ flexShrink: 0, width: 24 }} />
              </div>
            </div>

            {/* ── CORPO DO MODAL ── */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              
              <div style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 16, padding: "16px", display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
                <FileCheck2 size={22} color="#fb923c" style={{ flexShrink: 0 }} />
                <div style={{ width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#fb923c" }}>Anexos de {pessoaAtual?.nome}</p>
                    
                    {/* Botões de Ação da Aba Ativa (Se não for a Proponente Principal) */}
                    {abaAtiva !== "proponente" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button 
                          onClick={editarNomePessoa}
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

          </motion.div>
        </motion.div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </AnimatePresence>
  );
}