"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, CheckCircle2, AlertCircle, Trash2, ExternalLink,
  FileText, Plus, Loader2, Upload, FileCheck2, FolderOpen
} from "lucide-react";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";

// ─────────────────────────────────────────────────────────
// TIPAGENS E CONSTANTES
// ─────────────────────────────────────────────────────────

interface DocumentosConstrutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  isAdmin: boolean;
}

interface ToastMessage {
  msg: string;
  tipo: "sucesso" | "erro";
}

// Exportado para que o painel do correspondente possa
// calcular o badge de não lidos sem duplicar a lista
export const SLOTS_FIXOS = [
  { id: "pci",                            label: "PCI — Proposta de Crédito Imobiliário" },
  { id: "carimbo_projeto_aprovado",       label: "Carimbo Projeto Aprovado"              },
  { id: "art",                            label: "ART"                                   },
  { id: "projeto_arquitetonico_aprovado", label: "Projeto Arquitetônico Aprovado"        },
  { id: "planta_baixa_a4",               label: "Planta Baixa em Folha A4"              },
  { id: "alvara",                         label: "Alvará"                                },
  { id: "crea_profissional",              label: "CREA Profissional"                     },
  { id: "cno",                            label: "CNO"                                   },
  { id: "certidao_inteiro_teor",          label: "Certidão Inteiro Teor"                 },
];

// Alvo do upload em andamento — discrimina tipo para o handleFileChange saber o que fazer
type UploadAlvo =
  | { tipo: "fixo";   slotId: string  }
  | { tipo: "pls"                     }
  | { tipo: "outros"; label: string   };

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────

export function DocumentosConstrutorModal({
  isOpen, onClose, lead, isAdmin
}: DocumentosConstrutorModalProps) {

  // ── ESTADOS ──
  const [uploadAlvo, setUploadAlvo]               = useState<UploadAlvo | null>(null);
  const [uploadingSlot, setUploadingSlot]         = useState<string | null>(null);
  const [toast, setToast]                         = useState<ToastMessage | null>(null);
  const [mostrandoInputOutros, setMostrandoInputOutros] = useState(false);
  const [novoOutrosLabel, setNovoOutrosLabel]     = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  // ── MARCAR COMO LIDO ao abrir (somente correspondente) ──
  // CORREÇÃO: O useEffect deve estar ACIMA de qualquer "return" condicional.
  useEffect(() => {
    if (!isOpen || isAdmin || !lead?.documentosConstrutora) return;

    const d = lead.documentosConstrutora;
    const temNaoLido =
      SLOTS_FIXOS.some(s => d[s.id] && !d[s.id].lido) ||
      (d.pls    || []).some((p: any) => !p.lido)       ||
      (d.outros || []).some((o: any) => !o.lido);

    if (!temNaoLido) return;

    const atualizado = { ...d };
    SLOTS_FIXOS.forEach(s => {
      if (atualizado[s.id]) atualizado[s.id] = { ...atualizado[s.id], lido: true };
    });
    atualizado.pls    = (atualizado.pls    || []).map((p: any) => ({ ...p, lido: true }));
    atualizado.outros = (atualizado.outros || []).map((o: any) => ({ ...o, lido: true }));

    updateDoc(doc(db, "leads", lead.id), { documentosConstrutora: atualizado })
      .catch(err => console.error("Erro ao marcar lidos:", err));
  }, [isOpen, isAdmin, lead]);

  // CORREÇÃO: O "early return" foi movido para DEPOIS de todos os hooks
  if (!isOpen || !lead) return null;

  // Lê sempre do lead reativo (onSnapshot do pai) — nunca estado local para documentos
  const docs = lead.documentosConstrutora || {};

  // ─────────────────────────────────────────────────────────
  // FUNÇÕES DE FEEDBACK
  // ─────────────────────────────────────────────────────────

  const mostrarToast = (msg: string, tipo: "sucesso" | "erro") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  // ─────────────────────────────────────────────────────────
  // UPLOAD — handler unificado para todos os tipos de slot
  // ─────────────────────────────────────────────────────────

  const acionarUpload = (alvo: UploadAlvo) => {
    setUploadAlvo(alvo);
    if (inputRef.current) inputRef.current.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadAlvo) return;

    if (uploadAlvo.tipo === "fixo")   await uploadSlotFixo(uploadAlvo.slotId, file);
    if (uploadAlvo.tipo === "pls")    await uploadPLS(file);
    if (uploadAlvo.tipo === "outros") await uploadOutros(uploadAlvo.label, file);

    if (inputRef.current) inputRef.current.value = "";
    setUploadAlvo(null);
  };

  // ─────────────────────────────────────────────────────────
  // UPLOAD — SLOT FIXO
  // ─────────────────────────────────────────────────────────

  const uploadSlotFixo = async (slotId: string, file: File) => {
    setUploadingSlot(slotId);
    try {
      const ext  = file.name.split(".").pop() || "pdf";
      const path = `leads/${lead.id}/documentos_construtora/${slotId}.${ext}`;

      // Remove arquivo antigo do Storage para não acumular lixo
      if (docs[slotId]?.path) {
        try { await deleteObject(ref(storage, docs[slotId].path)); } catch {}
      }

      const snap = await uploadBytesResumable(ref(storage, path), file);
      const url  = await getDownloadURL(snap.ref);

      // Dot notation do Firestore: atualiza só o slot sem sobrescrever os outros
      await updateDoc(doc(db, "leads", lead.id), {
        [`documentosConstrutora.${slotId}`]: {
          url, path, nome: file.name,
          uploadedAt: new Date().toISOString(),
          lido: false,
        },
      });
      mostrarToast("Arquivo enviado com sucesso!", "sucesso");
    } catch (err) {
      console.error(err);
      mostrarToast("Erro ao enviar arquivo.", "erro");
    } finally {
      setUploadingSlot(null);
    }
  };

  // ─────────────────────────────────────────────────────────
  // REMOVER — SLOT FIXO (somente admin)
  // ─────────────────────────────────────────────────────────

  const removerSlotFixo = async (slotId: string, slotLabel: string) => {
    if (!confirm(`Remover "${slotLabel}"?\n\nO arquivo será excluído permanentemente.`)) return;
    try {
      if (docs[slotId]?.path) await deleteObject(ref(storage, docs[slotId].path));
      await updateDoc(doc(db, "leads", lead.id), {
        [`documentosConstrutora.${slotId}`]: null,
      });
      mostrarToast("Arquivo removido.", "sucesso");
    } catch (err) {
      console.error(err);
      mostrarToast("Erro ao remover arquivo.", "erro");
    }
  };

  // ─────────────────────────────────────────────────────────
  // UPLOAD — PLS
  // ─────────────────────────────────────────────────────────

  const uploadPLS = async (file: File) => {
    const plsAtual = docs.pls || [];
    const etapa    = plsAtual.length + 1;
    setUploadingSlot("pls");
    try {
      const ext  = file.name.split(".").pop() || "pdf";
      const path = `leads/${lead.id}/documentos_construtora/pls_etapa_${etapa}.${ext}`;

      const snap = await uploadBytesResumable(ref(storage, path), file);
      const url  = await getDownloadURL(snap.ref);

      await updateDoc(doc(db, "leads", lead.id), {
        "documentosConstrutora.pls": [
          ...plsAtual,
          { etapa, url, path, nome: file.name, uploadedAt: new Date().toISOString(), lido: false },
        ],
      });
      mostrarToast(`PLS Etapa ${etapa} enviada!`, "sucesso");
    } catch (err) {
      console.error(err);
      mostrarToast("Erro ao enviar PLS.", "erro");
    } finally {
      setUploadingSlot(null);
    }
  };

  // ─────────────────────────────────────────────────────────
  // REMOVER — PLS (somente admin)
  // ─────────────────────────────────────────────────────────

  const removerPLS = async (etapa: number) => {
    if (!confirm(`Remover PLS Etapa ${etapa}? Esta ação é permanente.`)) return;
    try {
      const item = (docs.pls || []).find((p: any) => p.etapa === etapa);
      if (item?.path) await deleteObject(ref(storage, item.path));

      await updateDoc(doc(db, "leads", lead.id), {
        "documentosConstrutora.pls": (docs.pls || []).filter((p: any) => p.etapa !== etapa),
      });
      mostrarToast(`PLS Etapa ${etapa} removida.`, "sucesso");
    } catch (err) {
      console.error(err);
      mostrarToast("Erro ao remover PLS.", "erro");
    }
  };

  // ─────────────────────────────────────────────────────────
  // UPLOAD — OUTROS
  // ─────────────────────────────────────────────────────────

  const uploadOutros = async (label: string, file: File) => {
    setUploadingSlot("outros");
    try {
      const id   = `outros_${Date.now()}`;
      const ext  = file.name.split(".").pop() || "pdf";
      const path = `leads/${lead.id}/documentos_construtora/${id}.${ext}`;

      const snap = await uploadBytesResumable(ref(storage, path), file);
      const url  = await getDownloadURL(snap.ref);

      await updateDoc(doc(db, "leads", lead.id), {
        "documentosConstrutora.outros": [
          ...(docs.outros || []),
          { id, label, url, path, nome: file.name, uploadedAt: new Date().toISOString(), lido: false },
        ],
      });
      setNovoOutrosLabel("");
      setMostrandoInputOutros(false);
      mostrarToast("Documento adicionado!", "sucesso");
    } catch (err) {
      console.error(err);
      mostrarToast("Erro ao enviar documento.", "erro");
    } finally {
      setUploadingSlot(null);
    }
  };

  // ─────────────────────────────────────────────────────────
  // REMOVER — OUTROS (somente admin)
  // ─────────────────────────────────────────────────────────

  const removerOutros = async (id: string, label: string) => {
    if (!confirm(`Remover "${label}"? Esta ação é permanente.`)) return;
    try {
      const item = (docs.outros || []).find((o: any) => o.id === id);
      if (item?.path) await deleteObject(ref(storage, item.path));

      await updateDoc(doc(db, "leads", lead.id), {
        "documentosConstrutora.outros": (docs.outros || []).filter((o: any) => o.id !== id),
      });
      mostrarToast("Documento removido.", "sucesso");
    } catch (err) {
      console.error(err);
      mostrarToast("Erro ao remover documento.", "erro");
    }
  };

  // ─────────────────────────────────────────────────────────
  // HELPERS DE RENDERIZAÇÃO
  // ─────────────────────────────────────────────────────────

  const formatarData = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const plsAtual   = docs.pls    || [];
  const outrosAtual = docs.outros || [];
  const totalEnviados = SLOTS_FIXOS.filter(s => docs[s.id]).length;

  // ─────────────────────────────────────────────────────────
  // RENDERIZAÇÃO
  // ─────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {isOpen && lead && (
        <motion.div
          key="docs-modal-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center"
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            key="docs-modal-content"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{
              background: "var(--bg-base)", width: "100%", maxWidth: 680,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              maxHeight: "92vh", display: "flex", flexDirection: "column",
              border: "1px solid var(--border-subtle)", borderBottom: "none",
              boxShadow: "0 -10px 40px rgba(0,0,0,0.5)", position: "relative"
            }}
          >

            {/* Input de arquivo oculto — único para todos os tipos de upload */}
            <input
              type="file" ref={inputRef} onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png,.dwg,.doc,.docx"
              style={{ display: "none" }}
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
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 14, fontWeight: 700,
                    boxShadow: "0 8px 30px rgba(0,0,0,0.3)", backdropFilter: "blur(8px)"
                  }}
                >
                  {toast.tipo === "sucesso" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {toast.msg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── HEADER ── */}
            <div style={{
              padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              position: "sticky", top: 0, background: "var(--bg-base)", zIndex: 10,
              borderTopLeftRadius: 28, borderTopRightRadius: 28
            }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 10 }}>
                  <FolderOpen size={22} color="var(--terracota)" />
                  Documentos da Construtora
                </h2>
                <p style={{ fontSize: 13, color: "var(--gray-mid)", marginTop: 2 }}>
                  <strong style={{ color: "var(--gray-light)" }}>{lead.nome}</strong> • {lead.empreendimentoNome}
                  {!isAdmin && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#38bdf8", fontWeight: 600 }}>
                      — Somente leitura
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%",
                  width: 36, height: 36, display: "flex", alignItems: "center",
                  justifyContent: "center", color: "var(--gray-light)", cursor: "pointer"
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* ── CORPO SCROLLÁVEL ── */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 32 }}>

              {/* ═══════════════════════════════════════════
                 SEÇÃO 1 — DOCUMENTOS FIXOS (9 slots)
                 ═══════════════════════════════════════════ */}
              <div>
                {/* Cabeçalho da seção */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 4, height: 20, background: "var(--terracota)", borderRadius: 2 }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-light)" }}>
                    Documentos de Aprovação
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--gray-dark)" }}>
                    ({totalEnviados}/{SLOTS_FIXOS.length} enviados)
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {SLOTS_FIXOS.map((slot) => {
                    const arquivo = docs[slot.id];
                    const isUploading = uploadingSlot === slot.id;

                    return (
                      <div
                        key={slot.id}
                        style={{
                          background: "var(--bg-card)",
                          border: arquivo
                            ? "1px solid rgba(74,222,128,0.3)"
                            : "1px solid var(--border-subtle)",
                          borderRadius: 14, padding: "14px 16px",
                          display: "flex", alignItems: "center",
                          justifyContent: "space-between", gap: 16, flexWrap: "wrap"
                        }}
                      >
                        {/* Info do slot */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 min-content", minWidth: 200 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: arquivo ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.04)",
                            color: arquivo ? "#4ade80" : "var(--gray-dark)"
                          }}>
                            {arquivo ? <FileCheck2 size={18} /> : <FileText size={18} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: arquivo ? "white" : "var(--gray-mid)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {slot.label}
                            </p>
                            {arquivo && (
                              <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 2 }}>
                                Enviado em {formatarData(arquivo.uploadedAt)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Ações */}
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                          {arquivo ? (
                            <>
                              {/* Link para abrir o arquivo */}
                              <a
                                href={arquivo.url} target="_blank" rel="noopener noreferrer"
                                style={{
                                  display: "flex", alignItems: "center", gap: 6,
                                  padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                  background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)",
                                  color: "#38bdf8", textDecoration: "none"
                                }}
                              >
                                <ExternalLink size={13} /> Abrir
                              </a>
                              {/* Substituir (admin) */}
                              {isAdmin && (
                                <button
                                  onClick={() => acionarUpload({ tipo: "fixo", slotId: slot.id })}
                                  disabled={!!uploadingSlot}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 6,
                                    padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                    background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
                                    color: "#fbbf24", cursor: "pointer"
                                  }}
                                >
                                  <Upload size={13} /> Substituir
                                </button>
                              )}
                              {/* Apagar (admin) */}
                              {isAdmin && (
                                <button
                                  onClick={() => removerSlotFixo(slot.id, slot.label)}
                                  style={{
                                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                                    color: "#f87171", cursor: "pointer"
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </>
                          ) : (
                            // Slot vazio
                            isAdmin ? (
                              <button
                                onClick={() => acionarUpload({ tipo: "fixo", slotId: slot.id })}
                                disabled={!!uploadingSlot}
                                style={{
                                  display: "flex", alignItems: "center", gap: 6,
                                  padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                                  background: "var(--terracota)", border: "none",
                                  color: "white", cursor: isUploading ? "not-allowed" : "pointer"
                                }}
                              >
                                {isUploading
                                  ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Enviando...</>
                                  : <><Upload size={13} /> Enviar</>
                                }
                              </button>
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--gray-dark)", fontWeight: 600, padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)" }}>
                                Aguardando
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ═══════════════════════════════════════════
                 SEÇÃO 2 — PLS POR ETAPAS
                 Cada medição de obra gera uma nova etapa,
                 salva permanentemente no array pls[]
                 ═══════════════════════════════════════════ */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 4, height: 20, background: "#38bdf8", borderRadius: 2 }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-light)" }}>
                    PLS — Acompanhamento de Medições
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--gray-dark)" }}>
                    ({plsAtual.length} etapa{plsAtual.length !== 1 ? "s" : ""})
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {plsAtual.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--gray-dark)", padding: "12px 0" }}>
                      Nenhuma medição registrada ainda.
                    </p>
                  )}

                  {plsAtual.map((item: any) => (
                    <div
                      key={item.etapa}
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid rgba(56,189,248,0.2)",
                        borderRadius: 14, padding: "14px 16px",
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between", gap: 16, flexWrap: "wrap"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 min-content", minWidth: 160 }}>
                        {/* Badge de número da etapa */}
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)",
                          fontSize: 14, fontWeight: 800, color: "#38bdf8"
                        }}>
                          {item.etapa}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
                            Etapa {item.etapa}
                          </p>
                          <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 2 }}>
                            {formatarData(item.uploadedAt)}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                        <a
                          href={item.url} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                            background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)",
                            color: "#38bdf8", textDecoration: "none"
                          }}
                        >
                          <ExternalLink size={13} /> Abrir
                        </a>
                        {isAdmin && (
                          <button
                            onClick={() => removerPLS(item.etapa)}
                            style={{
                              width: 32, height: 32, borderRadius: 8,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                              color: "#f87171", cursor: "pointer"
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Botão para adicionar próxima etapa (somente admin) */}
                  {isAdmin && (
                    <button
                      onClick={() => acionarUpload({ tipo: "pls" })}
                      disabled={!!uploadingSlot}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        padding: "12px", borderRadius: 12, cursor: uploadingSlot === "pls" ? "not-allowed" : "pointer",
                        border: "1px dashed rgba(56,189,248,0.3)", background: "rgba(56,189,248,0.05)",
                        color: "#38bdf8", fontSize: 13, fontWeight: 700, width: "100%"
                      }}
                    >
                      {uploadingSlot === "pls"
                        ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Enviando Etapa {plsAtual.length + 1}...</>
                        : <><Plus size={15} /> Adicionar PLS Etapa {plsAtual.length + 1}</>
                      }
                    </button>
                  )}
                </div>
              </div>

              {/* ═══════════════════════════════════════════
                 SEÇÃO 3 — OUTROS DOCUMENTOS
                 Array livre com label definido pelo admin
                 ═══════════════════════════════════════════ */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 4, height: 20, background: "#a78bfa", borderRadius: 2 }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-light)" }}>
                    Outros Documentos
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--gray-dark)" }}>
                    ({outrosAtual.length} arquivo{outrosAtual.length !== 1 ? "s" : ""})
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {outrosAtual.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--gray-dark)", padding: "12px 0" }}>
                      Nenhum documento adicional ainda.
                    </p>
                  )}

                  {outrosAtual.map((item: any) => (
                    <div
                      key={item.id}
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid rgba(167,139,250,0.2)",
                        borderRadius: 14, padding: "14px 16px",
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between", gap: 16, flexWrap: "wrap"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 min-content", minWidth: 160 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(167,139,250,0.12)", color: "#a78bfa"
                        }}>
                          <FileCheck2 size={18} />
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{item.label}</p>
                          <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 2 }}>
                            {formatarData(item.uploadedAt)}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                        <a
                          href={item.url} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                            background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)",
                            color: "#a78bfa", textDecoration: "none"
                          }}
                        >
                          <ExternalLink size={13} /> Abrir
                        </a>
                        {isAdmin && (
                          <button
                            onClick={() => removerOutros(item.id, item.label)}
                            style={{
                              width: 32, height: 32, borderRadius: 8,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                              color: "#f87171", cursor: "pointer"
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Formulário para adicionar novo "outro" documento (somente admin) */}
                  {isAdmin && (
                    <div style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px dashed rgba(167,139,250,0.3)",
                      borderRadius: 14, padding: "16px"
                    }}>
                      {!mostrandoInputOutros ? (
                        <button
                          onClick={() => setMostrandoInputOutros(true)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center",
                            justifyContent: "center", gap: 8, background: "transparent",
                            border: "none", color: "#a78bfa", fontSize: 13, fontWeight: 700,
                            cursor: "pointer"
                          }}
                        >
                          <Plus size={15} /> Adicionar Outro Documento
                        </button>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-light)" }}>
                            Nome do documento:
                          </p>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              autoFocus type="text"
                              value={novoOutrosLabel}
                              onChange={e => setNovoOutrosLabel(e.target.value)}
                              placeholder="Ex: Contrato Social, Memorial Descritivo..."
                              onKeyDown={e => {
                                if (e.key === "Enter" && novoOutrosLabel.trim()) {
                                  acionarUpload({ tipo: "outros", label: novoOutrosLabel.trim() });
                                }
                              }}
                              style={{
                                flex: 1, padding: "10px 14px", borderRadius: 8,
                                border: "1px solid var(--border-active)",
                                background: "rgba(0,0,0,0.4)", color: "white",
                                fontSize: 13, outline: "none"
                              }}
                            />
                            <button
                              onClick={() => {
                                if (novoOutrosLabel.trim()) {
                                  acionarUpload({ tipo: "outros", label: novoOutrosLabel.trim() });
                                }
                              }}
                              disabled={!novoOutrosLabel.trim() || !!uploadingSlot}
                              style={{
                                padding: "0 16px", background: "#a78bfa", color: "white",
                                border: "none", borderRadius: 8, fontWeight: 700,
                                cursor: novoOutrosLabel.trim() ? "pointer" : "not-allowed",
                                opacity: novoOutrosLabel.trim() ? 1 : 0.5,
                                display: "flex", alignItems: "center", gap: 6, fontSize: 13
                              }}
                            >
                              {uploadingSlot === "outros"
                                ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                                : <Upload size={14} />
                              }
                              Selecionar Arquivo
                            </button>
                            <button
                              onClick={() => { setMostrandoInputOutros(false); setNovoOutrosLabel(""); }}
                              style={{
                                padding: "0 12px", background: "rgba(255,255,255,0.1)",
                                color: "white", border: "none", borderRadius: 8, cursor: "pointer"
                              }}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>{/* fim do body */}
          </motion.div>
        </motion.div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </AnimatePresence>
  );
}