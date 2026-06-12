"use client";

import { ShieldCheck, Briefcase } from "lucide-react";

// ─────────────────────────────────────────────────────────
// TIPAGEM
// ─────────────────────────────────────────────────────────

interface CorrespondenteTagProps {
  c: {
    id: string;
    nome: string;
    telefone?: string;
    correspondencia?: boolean;
    consultoria?: boolean;
  };
}

// ─────────────────────────────────────────────────────────
// COMPONENTE
// Renderiza: · 🛡 CB: Nome  |  · 💼 Consultoria: Nome  |  · 🛡💼 CB + Consultoria: Nome
// Se `telefone` presente → nome vira link clicável para WhatsApp
// Inclui o separador "·" internamente para facilitar o uso em .map()
// ─────────────────────────────────────────────────────────

export function CorrespondenteTag({ c }: CorrespondenteTagProps) {
  const hasCB   = c.correspondencia ?? true;
  const hasCons = c.consultoria     ?? false;

  const temFone = !!(c.telefone && c.telefone.replace(/\D/g, "").length >= 10);

  const label =
    hasCB && hasCons ? `CB + Consultoria: ${c.nome}` :
    hasCB            ? `CB: ${c.nome}`                :
                       `Consultoria: ${c.nome}`;

  const corTexto =
    hasCB && hasCons ? "var(--gray-light)" :
    hasCB            ? "#38bdf8"           :
                       "#a78bfa";

  // ── Conteúdo visual (ícone + label) ──
  const inner = (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      {hasCB   && <ShieldCheck size={10} color="#38bdf8" />}
      {hasCons && <Briefcase   size={10} color="#a78bfa" />}
      <span style={{ color: corTexto }}>{label}</span>
    </span>
  );

  return (
    <>
      {/* Separador de meta-info */}
      <span style={{ color: "var(--border-subtle)" }}>·</span>

      {/* Se tem telefone → link clicável com tooltip */}
      {temFone ? (
        <a
          href={`https://wa.me/55${c.telefone!.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`Clique para falar com ${c.nome} via WhatsApp`}
          onClick={(e) => e.stopPropagation()} // evita acionar o card pai
          style={{
            textDecoration: "none",
            cursor: "pointer",
            borderRadius: 4,
            // sublinhado sutil pontilhado para sinalizar que é clicável
            borderBottom: "1px dotted rgba(255,255,255,0.2)",
          }}
        >
          {inner}
        </a>
      ) : (
        inner
      )}
    </>
  );
}