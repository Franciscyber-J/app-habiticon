"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, CheckCircle2, FileText, ExternalLink, ShieldCheck, AlertCircle,
  MessageSquareWarning, ThumbsUp, ThumbsDown, Calculator, FilePlus, FilePlus2, RefreshCcw, UploadCloud
} from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db } from "@/lib/firebase";

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

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────

export function AnaliseModal({ isOpen, onClose, lead }: AnaliseModalProps) {
  const [abaAtiva, setAbaAtiva] = useState<string>("proponente");
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

  if (!isOpen || !lead) return null;

  const dossie = lead.dossie || {};

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
    setTimeout(() => setToast(null), 3000);
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
      e.target.value = ""; // reseta o input
    }
  };

  const iniciarProcessoAprovacao = async (novoStatus: "qualificado" | "nao_qualificado") => {
    if (isDecidido) return;

    if (novoStatus === "nao_qualificado") {
      const resposta = prompt("Descreva o motivo da reprovação (obrigatório para feedback ao corretor):");
      if (!resposta || !resposta.trim()) {
        mostrarToast("Ação cancelada: O motivo da reprovação é obrigatório.", "erro");
        return; 
      }
      
      try {
        await updateDoc(doc(db, "leads", lead.id), { 
          status: novoStatus,
          motivoReprovacao: resposta.trim(),
          creditoAprovadoInfo: null 
        });
        mostrarToast("Crédito Reprovado registado!", "sucesso");
        setTimeout(() => onClose(), 1500);
      } catch (error) {
        mostrarToast("Erro ao atualizar status.", "erro");
      }
    } else {
      // Se for aprovado, abre o modal de detalhamento
      setDadosAprovacao({
        valorAprovado: dadosFinanceiros.valorFinanciado.toString(),
        valorParcela: "",
        observacoes: ""
      });
      setModalAprovacaoAberto(true);
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
      setModalAprovacaoAberto(false);
      mostrarToast("Crédito Aprovado com sucesso!", "sucesso");
      setTimeout(() => onClose(), 1500);
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
              maxHeight: "92vh", display: "flex", flexDirection: "column",
              border: "1px solid var(--border-subtle)", borderBottom: "none",
              boxShadow: "0 -10px 40px rgba(0,0,0,0.5)", position: "relative"
            }}
          >

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

            {/* HEADER: RESUMO FINANCEIRO */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", position: "sticky", top: 0, background: "var(--bg-base)", zIndex: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
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

              {/* MINI DASHBOARD FINANCEIRO */}
              <div style={{ display: "flex", gap: 12, background: "rgba(0,0,0,0.3)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border-subtle)", overflowX: "auto" }}>
                {[
                  { label: "Renda Familiar",          value: dadosFinanceiros.rendaFamiliar,   tooltip: "" },
                  { label: "Avaliação SICAQ (Laudo)", value: dadosFinanceiros.valorAvaliacao,  tooltip: "Valor alvo da avaliação de engenharia no sistema da Caixa" }, 
                  { label: "Crédito Caixa (Repasse)", value: dadosFinanceiros.valorFinanciado, tooltip: "Valor do repasse do banco para fechar a matemática do contrato" },
                  { label: "Subsídio",                value: dadosFinanceiros.subsidio,        tooltip: "" },
                ].map((item, i) => (
                  <div key={i} title={item.tooltip} style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 16, borderRight: i < 3 ? "1px solid var(--border-subtle)" : "none", flexShrink: 0, cursor: item.tooltip ? "help" : "default" }}>
                    {i === 0 && <Calculator size={16} color="var(--terracota)" />}
                    <div>
                      <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, borderBottom: item.tooltip ? "1px dotted var(--gray-dark)" : "none", paddingBottom: item.tooltip ? 2 : 0 }}>
                        {item.label}
                      </p>
                      <p style={{ fontSize: 14, fontWeight: 800, color: item.label === "Subsídio" ? "#4ade80" : "white" }}>
                        {item.value > 0 ? `R$ ${Number(item.value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
              {listaDocumentosPessoa.length === 0 ? (
                <p style={{ color: "var(--gray-mid)", textAlign: "center", padding: "40px 0" }}>Nenhum documento salvo ainda.</p>
              ) : (
                listaDocumentosPessoa.map(([docId, docDados]: any) => {
                  const arquivos = docDados.arquivos || [];
                  const isEnviado = arquivos.length > 0;
                  const temPendencia = !!docDados.pendenciaCorrespondente;
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

            {/* FOOTER: DECISÃO DE CRÉDITO E BOTÃO DE REVERTER */}
            <div style={{
              padding: "16px 24px", background: "var(--bg-base)", borderTop: "1px solid var(--border-subtle)",
              position: "sticky", bottom: 0, zIndex: 10, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center"
            }}>
              {isDecidido ? (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", padding: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isAprovado ? <ThumbsUp size={20} color="#4ade80" /> : <ThumbsDown size={20} color="#f87171" />}
                    <p style={{ color: isAprovado ? "#4ade80" : "#f87171", fontWeight: 800, fontSize: 16 }}>
                      {isAprovado ? "Crédito Qualificado/Aprovado." : "Crédito Reprovado/Não Qualificado."}
                    </p>
                  </div>
                  
                  {isReprovado && lead.motivoReprovacao && (
                    <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "12px 16px", width: "100%", textAlign: "center" }}>
                      <p style={{ fontSize: 13, color: "#fca5a5" }}>
                        <strong>Motivo:</strong> {lead.motivoReprovacao}
                      </p>
                    </div>
                  )}

                  {isAprovado && lead.creditoAprovadoInfo && (
                    <div style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 12, padding: "16px", width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(74,222,128,0.1)", paddingBottom: 8 }}>
                        <span style={{ fontSize: 12, color: "var(--gray-mid)" }}>Valor Aprovado Liberado:</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "white" }}>R$ {lead.creditoAprovadoInfo.valorAprovado?.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(74,222,128,0.1)", paddingBottom: 8 }}>
                        <span style={{ fontSize: 12, color: "var(--gray-mid)" }}>Parcela Estimada:</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "white" }}>R$ {lead.creditoAprovadoInfo.valorParcela?.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {lead.creditoAprovadoInfo.observacoes && (
                        <div>
                          <span style={{ fontSize: 11, color: "var(--gray-dark)", textTransform: "uppercase", fontWeight: 700 }}>Condicionantes:</span>
                          <p style={{ fontSize: 13, color: "var(--gray-light)", marginTop: 4, lineHeight: 1.5 }}>{lead.creditoAprovadoInfo.observacoes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={reverterDecisao}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, marginTop: 8,
                      padding: "8px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)",
                      borderRadius: 8, color: "var(--gray-light)", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "0.2s"
                    }}
                  >
                    <RefreshCcw size={14} /> Reverter Decisão (Voltar para Análise)
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => iniciarProcessoAprovacao("nao_qualificado")}
                    className="flex-1 sm:flex-none"
                    style={{ padding: "12px 20px", background: "transparent", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    <ThumbsDown size={16} /> Reprovar
                  </button>
                  <button
                    onClick={() => iniciarProcessoAprovacao("qualificado")}
                    className="flex-1 sm:flex-none"
                    style={{ padding: "12px 24px", background: "#4ade80", color: "#064e3b", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 14px rgba(74,222,128,0.3)" }}
                  >
                    <ThumbsUp size={16} /> Aprovar Crédito
                  </button>
                </>
              )}
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}