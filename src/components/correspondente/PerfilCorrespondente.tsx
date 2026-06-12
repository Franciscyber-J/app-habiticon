"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { X, Save, Phone, User as UserIcon, CheckCircle2 } from "lucide-react";

// ─────────────────────────────────────────────────────────
// TIPAGEM
// ─────────────────────────────────────────────────────────

interface PerfilCorrespondenteProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  dadosAtuais: {
    nome: string;
    email: string;
    telefone: string;
  };
  /** Callback chamado após salvar com sucesso */
  onSalvo?: (novosDados: { nome: string; telefone: string }) => void;
}

// ─────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────

export function PerfilCorrespondente({
  isOpen,
  onClose,
  userId,
  dadosAtuais,
  onSalvo,
}: PerfilCorrespondenteProps) {
  const [form, setForm] = useState({
    nome:     dadosAtuais.nome     || "",
    telefone: dadosAtuais.telefone || "",
  });
  const [salvando, setSalvando]   = useState(false);
  const [erro,     setErro]       = useState("");
  const [sucesso,  setSucesso]    = useState(false);

  if (!isOpen) return null;

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    if (!form.nome.trim()) {
      setErro("O nome é obrigatório.");
      return;
    }
    if (form.telefone.replace(/\D/g, "").length < 10) {
      setErro("Informe um WhatsApp válido com DDD.");
      return;
    }

    setSalvando(true);
    try {
      await updateDoc(doc(db, "usuarios", userId), {
        nome:     form.nome.trim(),
        telefone: form.telefone.trim(),
      });

      setSucesso(true);
      onSalvo?.({ nome: form.nome.trim(), telefone: form.telefone.trim() });

      // Fecha após 1.2s para o usuário ver o feedback de sucesso
      setTimeout(() => {
        setSucesso(false);
        onClose();
      }, 1200);
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      setErro("Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--bg-card)", width: "100%", maxWidth: 440,
          borderRadius: 20, border: "1px solid var(--border-subtle)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)", overflow: "hidden",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <h2
            style={{
              fontSize: 16, fontWeight: 800, color: "white",
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <UserIcon size={18} color="#38bdf8" /> Meu Perfil
          </h2>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* FORMULÁRIO */}
        <form
          onSubmit={handleSalvar}
          style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}
        >

          {/* Nome */}
          <div>
            <label
              style={{
                display: "block", fontSize: 11, fontWeight: 700,
                color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 8,
              }}
            >
              Nome Completo
            </label>
            <input
              type="text"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="input-field"
              style={{ fontSize: 14 }}
              placeholder="Seu nome completo"
            />
          </div>

          {/* E-mail (somente leitura) */}
          <div>
            <label
              style={{
                display: "block", fontSize: 11, fontWeight: 700,
                color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 8,
              }}
            >
              E-mail (Acesso)
            </label>
            <input
              type="email"
              value={dadosAtuais.email}
              disabled
              className="input-field"
              style={{ fontSize: 14, opacity: 0.5, cursor: "not-allowed" }}
            />
            <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 6 }}>
              O e-mail de acesso não pode ser alterado.
            </p>
          </div>

          {/* WhatsApp — obrigatório */}
          <div>
            <label
              style={{
                display: "block", fontSize: 11, fontWeight: 700,
                color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 8,
              }}
            >
              WhatsApp <span style={{ color: "#f87171" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <Phone
                size={15}
                color="var(--gray-dark)"
                style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="tel"
                required
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
                className="input-field"
                style={{ fontSize: 14, paddingLeft: 42 }}
              />
            </div>
            <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 6 }}>
              Corretores e clientes usam este número para entrar em contato com você.
            </p>
          </div>

          {/* Feedback de erro */}
          {erro && (
            <div
              style={{
                padding: "10px 14px", background: "rgba(239,68,68,0.1)",
                borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)",
              }}
            >
              <p style={{ fontSize: 12, color: "#f87171" }}>{erro}</p>
            </div>
          )}

          {/* Botões */}
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: "12px", borderRadius: 10,
                background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)",
                color: "white", fontWeight: 600, cursor: "pointer", fontSize: 14,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || sucesso}
              style={{
                flex: 1, padding: "12px", borderRadius: 10, border: "none",
                background: sucesso ? "#4ade80" : "#38bdf8",
                color: sucesso ? "#064e3b" : "#082f49",
                fontWeight: 800, cursor: "pointer", fontSize: 14,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.2s",
              }}
            >
              {sucesso ? (
                <><CheckCircle2 size={16} /> Salvo!</>
              ) : salvando ? (
                "Salvando..."
              ) : (
                <><Save size={16} /> Salvar Perfil</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}