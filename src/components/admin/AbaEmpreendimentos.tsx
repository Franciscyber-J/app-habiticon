"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Building2, MapPin, Map as MapIcon, ToggleRight, ToggleLeft, 
  Trash2, Settings, ExternalLink, Users, ChevronRight, Plus, Link2, Check, Copy
} from "lucide-react";

interface AbaEmpreendimentosProps {
  empreendimentos: any[];
  todosLeads: any[];
  abrirVisaoGeralMapa: (emp: any) => void;
  toggleStatus: (slug: string, currentStatus: string) => void;
  excluirEmpreendimento: (slug: string, nome: string) => void;
  clonarEmpreendimento: (emp: any) => void;
  setTab: (tab: any) => void;
  criarEmpreendimento: () => void;
}

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
      <a
        href={link} target="_blank" rel="noopener noreferrer"
        style={{
          fontSize: 11, color: "var(--gray-dark)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
          padding: "5px 10px", borderRadius: 6, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-subtle)",
          maxWidth: "min(220px, 40vw)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        <Link2 size={11} />
        {link.replace(/^https?:\/\//, "")}
      </a>
      <button
        onClick={copiar}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, cursor: "pointer",
          border: "none", fontSize: 12, fontWeight: 700, transition: "all 200ms ease",
          background: copiado ? "rgba(22,163,74,0.15)" : "rgba(175,111,83,0.12)", color: copiado ? "#4ade80" : "var(--terracota)",
        }}
      >
        {copiado ? <><Check size={13} /> Copiado!</> : <><Copy size={13} /> Copiar link</>}
      </button>
    </div>
  );
}

export function AbaEmpreendimentos({
  empreendimentos, todosLeads, abrirVisaoGeralMapa, toggleStatus,
  excluirEmpreendimento, clonarEmpreendimento, setTab, criarEmpreendimento
}: AbaEmpreendimentosProps) {
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {empreendimentos.map((emp) => {
        const leadsDoEmp = todosLeads.filter(l => l.empreendimentoId === emp.slug);
        const linkLista = `${typeof window !== "undefined" ? window.location.origin : ""}/leads/${emp.slug}`;
        
        return (
          <motion.div
            key={emp.slug} layout
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-card)" }}
          >
            <div style={{ padding: "18px 18px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flex: 1 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--terracota-glow)", border: "1px solid var(--border-active)" }}>
                  <Building2 size={22} color="var(--terracota)" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--gray-light)", marginBottom: 5 }}>{emp.nome}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 14, color: "var(--gray-mid)" }}>
                    <MapPin size={13} />
                    <span style={{ fontSize: 13 }}>{emp.cidade} · {emp.estado}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {emp.modelos?.map((m: any) => (
                      <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, background: "rgba(175,111,83,0.12)", border: "1px solid rgba(175,111,83,0.25)", fontSize: 12, fontWeight: 700, color: "var(--terracota-light)" }}>
                        {m.nome} <span style={{ color: "var(--gray-dark)" }}>·</span> <span style={{ color: "var(--gray-mid)", fontWeight: 600 }}>R$ {(m.valor / 1000).toFixed(0)}k</span>
                      </span>
                    ))}
                    {(!emp.modelos || emp.modelos.length === 0) && (
                      <span style={{ fontSize: 12, color: "var(--gray-dark)" }}>Sem modelos</span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

                <button
                  onClick={() => abrirVisaoGeralMapa(emp)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, cursor: "pointer", background: "var(--terracota-glow)", border: "1px solid var(--border-active)", color: "var(--terracota-light)", fontSize: 13, fontWeight: 600 }}
                >
                  <MapIcon size={14} /> Mapa
                </button>

                <button
                  onClick={() => toggleStatus(emp.slug, emp.status)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 8, cursor: "pointer", border: "none", fontSize: 12, fontWeight: 700, transition: "all 150ms ease", background: emp.status === "ativo" ? "rgba(22,163,74,0.15)" : "rgba(249,115,22,0.12)", color: emp.status === "ativo" ? "#4ade80" : "#fb923c" }}
                >
                  {emp.status === "ativo" ? <><ToggleRight size={15} /> Ativo</> : <><ToggleLeft size={15} /> Inativo</>}
                </button>
                <button
                  onClick={() => excluirEmpreendimento(emp.slug, emp.nome)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 10, cursor: "pointer", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 13, fontWeight: 600 }}
                >
                  <Trash2 size={13} /> <span className="hidden sm:inline">Excluir</span>
                </button>
                <button
                  onClick={() => clonarEmpreendimento(emp)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, cursor: "pointer", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)", color: "#93c5fd", fontSize: 13, fontWeight: 600 }}
                >
                  Clonar
                </button>
                <Link
                  href={`/admin/${emp.slug}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, background: "transparent", border: "1.5px solid var(--border-active)", color: "var(--terracota)", fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "all 150ms ease" }}
                >
                  <Settings size={14} /> Editar
                </Link>
                <a
                  href={linkLista} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border-subtle)", color: "var(--gray-mid)", textDecoration: "none", transition: "all 150ms ease", background: "transparent" }}
                >
                  <ExternalLink size={15} />
                </a>
              </div>
            </div>
            {leadsDoEmp.length > 0 && (
              <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "rgba(0,0,0,0.15)" }}>
                <Users size={14} color="var(--gray-dark)" />
                <span style={{ fontSize: 13, color: "var(--gray-mid)" }}>{leadsDoEmp.length} lead{leadsDoEmp.length !== 1 ? "s" : ""} capturado{leadsDoEmp.length !== 1 ? "s" : ""}</span>
                <ChevronRight size={13} color="var(--gray-dark)" />
                <button onClick={() => setTab("leads")} style={{ fontSize: 12, color: "var(--terracota)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  Ver leads
                </button>
              </div>
            )}
          </motion.div>
        );
      })}

      <button
        onClick={criarEmpreendimento}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "28px 24px", borderRadius: 16, border: "2px dashed var(--border-subtle)", background: "transparent", transition: "all 150ms ease", cursor: "pointer", width: "100%" }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--terracota-glow)", border: "1px solid var(--border-active)" }}>
          <Plus size={18} color="var(--terracota)" />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--terracota)" }}>Adicionar Novo Empreendimento</p>
          <p style={{ fontSize: 12, color: "var(--gray-dark)", marginTop: 2 }}>Cria um empreendimento em branco para edição</p>
        </div>
      </button>
    </div>
  );
}