"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  Building2, Settings, Users, MapPin, ToggleLeft, ToggleRight,
  Plus, ExternalLink, ArrowLeft, ChevronRight, BarChart3
} from "lucide-react";

interface Empreendimento {
  slug: string;
  nome: string;
  cidade: string;
  estado: string;
  status: string;
  modelos: { id: string; nome: string; valor: number }[];
  leads: { id: string; nome: string; whatsapp: string; timestamp: string; modelo?: string }[];
}

export default function AdminPage() {
  const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"empreendimentos" | "leads">("empreendimentos");

  useEffect(() => {
    fetch("/api/empreendimentos")
      .then((r) => r.json())
      .then((data) => { setEmpreendimentos(data); setLoading(false); });
  }, []);

  const totalLeads = empreendimentos.reduce((acc, e) => acc + (e.leads?.length || 0), 0);
  const ativos = empreendimentos.filter((e) => e.status === "ativo").length;

  const toggleStatus = async (slug: string, current: string) => {
    const newStatus = current === "ativo" ? "inativo" : "ativo";
    await fetch("/api/empreendimentos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, field: "status", value: newStatus }),
    });
    setEmpreendimentos((prev) =>
      prev.map((e) => (e.slug === slug ? { ...e, status: newStatus } : e))
    );
  };

  const allLeads = empreendimentos.flatMap((e) =>
    (e.leads || []).map((l) => ({ ...l, empreendimento: e.nome }))
  ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Header Admin */}
      <header
        style={{
          background: "rgba(15,30,22,0.97)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="container-app">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="btn-ghost p-2">
                <ArrowLeft size={18} />
              </Link>
              <Image src="/logo.png" alt="Habiticon" width={120} height={36} className="h-8 w-auto" />
              <div className="badge badge-warning">Admin</div>
            </div>
          </div>
        </div>
      </header>

      <main className="container-app py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Empreendimentos", value: empreendimentos.length, icon: Building2, color: "var(--terracota)" },
            { label: "Ativos", value: ativos, icon: ToggleRight, color: "#4ade80" },
            { label: "Leads Capturados", value: totalLeads, icon: Users, color: "#60a5fa" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="glass-card-nohover p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Icon size={18} color={stat.color} />
                  <span className="text-xs uppercase tracking-wider" style={{ color: "var(--gray-mid)" }}>
                    {stat.label}
                  </span>
                </div>
                <div className="text-3xl font-bold" style={{ color: stat.color }}>
                  {loading ? "..." : stat.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="tab-group max-w-sm">
          <button className={`tab-item ${tab === "empreendimentos" ? "active" : ""}`} onClick={() => setTab("empreendimentos")}>
            Empreendimentos
          </button>
          <button className={`tab-item ${tab === "leads" ? "active" : ""}`} onClick={() => setTab("leads")}>
            Leads ({totalLeads})
          </button>
        </div>

        {/* Lista de Empreendimentos */}
        {tab === "empreendimentos" && (
          <div className="space-y-4">
            {empreendimentos.map((emp) => (
              <motion.div
                key={emp.slug}
                layout
                className="glass-card p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className="w-12 h-12 rounded-xl flex-center shrink-0"
                      style={{ background: "var(--terracota-glow)", border: "1px solid var(--border-active)" }}
                    >
                      <Building2 size={20} color="var(--terracota)" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base" style={{ color: "var(--gray-light)" }}>
                        {emp.nome}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5" style={{ color: "var(--gray-mid)" }}>
                        <MapPin size={12} />
                        <span className="text-xs">{emp.cidade} · {emp.estado}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {emp.modelos.map((m) => (
                          <span key={m.id} className="badge badge-info text-xs">
                            {m.nome} · R$ {(m.valor / 1000).toFixed(0)}k
                          </span>
                        ))}
                        {emp.modelos.length === 0 && (
                          <span className="text-xs" style={{ color: "var(--gray-dark)" }}>Sem modelos</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Toggle status */}
                    <button
                      onClick={() => toggleStatus(emp.slug, emp.status)}
                      className={`badge ${emp.status === "ativo" ? "badge-success" : "badge-warning"} cursor-pointer`}
                    >
                      {emp.status === "ativo" ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      {emp.status === "ativo" ? "Ativo" : "Inativo"}
                    </button>

                    <Link
                      href={`/admin/${emp.slug}`}
                      className="btn-secondary py-2 px-4 text-sm"
                    >
                      <Settings size={14} />
                      Editar
                    </Link>

                    <Link
                      href={`/${emp.slug}`}
                      target="_blank"
                      className="btn-ghost py-2 px-3"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  </div>
                </div>

                {/* Leads count */}
                {(emp.leads?.length || 0) > 0 && (
                  <div
                    className="mt-4 pt-4 flex items-center gap-2"
                    style={{ borderTop: "1px solid var(--border-subtle)" }}
                  >
                    <Users size={14} color="var(--gray-mid)" />
                    <span className="text-sm" style={{ color: "var(--gray-mid)" }}>
                      {emp.leads.length} lead{emp.leads.length > 1 ? "s" : ""} capturado{emp.leads.length > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}

            {/* Novo Empreendimento */}
            <Link
              href="/admin/novo"
              className="glass-card-nohover p-6 flex items-center justify-center gap-3 border-dashed cursor-pointer"
              style={{ borderStyle: "dashed", borderColor: "var(--border-subtle)" }}
            >
              <Plus size={20} color="var(--terracota)" />
              <span className="font-medium" style={{ color: "var(--terracota)" }}>
                Adicionar Novo Empreendimento
              </span>
            </Link>
          </div>
        )}

        {/* Lista de Leads */}
        {tab === "leads" && (
          <div className="space-y-3">
            {allLeads.length === 0 ? (
              <div
                className="flex-center py-16 rounded-2xl text-center"
                style={{ background: "rgba(0,0,0,0.2)", border: "1px dashed var(--border-subtle)" }}
              >
                <div>
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-muted">Nenhum lead capturado ainda</p>
                </div>
              </div>
            ) : (
              allLeads.map((lead, i) => (
                <motion.div
                  key={lead.id || i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card-nohover p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex-center text-sm font-bold"
                      style={{ background: "var(--terracota-glow)", color: "var(--terracota)" }}
                    >
                      {(lead.nome || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--gray-light)" }}>{lead.nome}</p>
                      <p className="text-xs" style={{ color: "var(--gray-mid)" }}>
                        {lead.whatsapp} · {lead.empreendimento}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs" style={{ color: "var(--gray-mid)" }}>
                        {lead.modelo || "—"}
                      </p>
                      <p className="text-xs" style={{ color: "var(--gray-dark)" }}>
                        {lead.timestamp ? new Date(lead.timestamp).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    </div>
                    <a
                      href={`https://wa.me/55${lead.whatsapp?.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="badge badge-success cursor-pointer"
                    >
                      WhatsApp
                    </a>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
