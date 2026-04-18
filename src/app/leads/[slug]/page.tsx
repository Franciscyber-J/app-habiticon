"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import Image from "next/image";
import { Users, Phone, Calendar, RefreshCw, MapPin } from "lucide-react";
import { useSSE } from "@/hooks/useSSE";

// ─── Status de lead ──────────────────────────────────────
const STATUS_LEAD = {
  novo:           { label: "Novo",           cor: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.3)"  },
  em_atendimento: { label: "Em atendimento", cor: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)"  },
  qualificado:    { label: "Qualificado",    cor: "#4ade80", bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.3)"  },
  nao_qualificado:{ label: "Não qualificado",cor: "#6b7280", bg: "rgba(107,114,128,0.12)", border: "rgba(107,114,128,0.3)" },
} as const;
type LeadStatus = keyof typeof STATUS_LEAD;

interface Lead {
  id: string;
  nome: string;
  whatsapp: string;
  timestamp: string;
  modelo?: string;
  nomeCorretor?: string;
  status?: LeadStatus;
}

interface Empreendimento {
  slug: string;
  nome: string;
  cidade: string;
  estado: string;
  leads: Lead[];
}

export default function LeadsPublicosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [emp, setEmp] = useState<Empreendimento | null>(null);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [ultimaAtu, setUltimaAtu] = useState<Date | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    else setAtualizando(true);
    try {
      const r = await fetch("/api/empreendimentos");
      const data: Empreendimento[] = await r.json();
      const found = data.find((e) => e.slug === slug);
      // Atualiza o estado preservando atualizações otimistas locais:
      // só substitui se o dado veio do servidor (evita race condition
      // entre o polling e a atualização imediata de status/delete)
      setEmp(found || null);
      setUltimaAtu(new Date());
    } catch {
      // Silencia erros de rede — não interrompe a UI
    } finally {
      setLoading(false);
      setAtualizando(false);
    }
  }, [slug]);

  // Carga inicial
  useEffect(() => { carregar(); }, [carregar]);

  // SSE — rebusca dados somente quando o servidor sinalizar uma mudança
  // (sem polling — conexão persistente, zero requisições desnecessárias)
  useSSE("leads", () => carregar(true));

  const atualizarStatus = async (leadId: string, status: LeadStatus) => {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugEmp: slug, leadId, status }),
    });
    setEmp((prev) => prev ? {
      ...prev,
      leads: prev.leads.map((l) => l.id === leadId ? { ...l, status } : l),
    } : prev);
  };

  const leads = (emp?.leads || [])
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--gray-mid)" }}>
        <RefreshCw size={18} />
        <span>Carregando leads…</span>
      </div>
    </div>
  );

  if (!emp) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--gray-mid)" }}>Empreendimento não encontrado.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>

      {/* Header */}
      <header style={{
        background: "rgba(15,30,22,0.98)",
        backdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--border-subtle)",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div className="container-app">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Image
                src="/logo.png" alt="Habiticon"
                width={280} height={80}
                style={{ height: "clamp(36px, 8vw, 56px)", width: "auto" }}
                priority
              />
              <div style={{ height: 28, width: 1, background: "var(--border-subtle)" }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-light)" }}>{emp.nome}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--gray-mid)" }}>
                  <MapPin size={11} />
                  <span style={{ fontSize: 11 }}>{emp.cidade} · {emp.estado}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {ultimaAtu && (
                <span className="hidden sm:flex" style={{ fontSize: 11, color: "var(--gray-dark)", alignItems: "center", gap: 5 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%", display: "inline-block", flexShrink: 0,
                    background: atualizando ? "#fbbf24" : "#4ade80",
                    boxShadow: atualizando ? "0 0 6px #fbbf24" : "0 0 6px #4ade80",
                    transition: "all 0.3s ease",
                  }} />
                  {atualizando ? "Sync…" : `${ultimaAtu.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                </span>
              )}
              <button
                onClick={() => carregar(true)}
                disabled={atualizando}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                  background: "rgba(175,111,83,0.12)",
                  border: "1px solid rgba(175,111,83,0.25)",
                  color: "var(--terracota)", fontSize: 12, fontWeight: 600,
                }}
              >
                <RefreshCw size={13} style={{ animation: atualizando ? "spin 1s linear infinite" : "none" }} />
                Atualizar
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container-app" style={{ padding: "clamp(20px,4vw,36px) clamp(16px,4vw,32px) 80px" }}>

        {/* Título + contador */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--gray-light)", letterSpacing: "-0.02em", marginBottom: 4 }}>
              Leads Capturados
            </h1>
            <p style={{ fontSize: 14, color: "var(--gray-mid)" }}>
              Lista de contatos interessados em {emp.nome}
            </p>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 20px", borderRadius: 12,
            background: "rgba(175,111,83,0.12)",
            border: "1px solid rgba(175,111,83,0.25)",
          }}>
            <Users size={18} color="var(--terracota)" />
            <span style={{ fontSize: 24, fontWeight: 800, color: "var(--terracota)" }}>{leads.length}</span>
            <span style={{ fontSize: 12, color: "var(--gray-mid)", fontWeight: 600 }}>leads</span>
          </div>
        </div>

        {/* Lista */}
        {leads.length === 0 ? (
          <div style={{
            padding: "64px 24px", borderRadius: 16, textAlign: "center",
            background: "rgba(0,0,0,0.2)", border: "1px dashed var(--border-subtle)",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 14, color: "var(--gray-mid)" }}>Nenhum lead capturado ainda.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {leads.map((lead, i) => (
              <div key={lead.id || i} style={{
                padding: "14px 16px",
                background: "var(--bg-card)",
                border: `1px solid ${STATUS_LEAD[lead.status as LeadStatus]?.border ?? "var(--border-subtle)"}`,
                borderRadius: 14,
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: STATUS_LEAD[lead.status as LeadStatus]?.bg ?? "var(--terracota-glow)",
                    border: `1px solid ${STATUS_LEAD[lead.status as LeadStatus]?.border ?? "var(--border-active)"}`,
                    fontSize: 16, fontWeight: 800,
                    color: STATUS_LEAD[lead.status as LeadStatus]?.cor ?? "var(--terracota)",
                  }}>
                    {(lead.nome || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-light)", marginBottom: 5 }}>
                      {lead.nome}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "var(--gray-mid)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Phone size={11} /> {lead.whatsapp}
                      </span>
                      {lead.modelo && (
                        <span style={{ fontSize: 11, color: "var(--terracota-light)", fontWeight: 600, padding: "1px 8px", borderRadius: 5, background: "rgba(175,111,83,0.1)" }}>
                          {lead.modelo}
                        </span>
                      )}
                      {lead.nomeCorretor && (
                        <span style={{ fontSize: 11, color: "#93c5fd", fontWeight: 600, padding: "1px 8px", borderRadius: 5, background: "rgba(96,165,250,0.1)" }}>
                          {lead.nomeCorretor}
                        </span>
                      )}
                      {lead.timestamp && (
                        <span style={{ fontSize: 11, color: "var(--gray-dark)", display: "flex", alignItems: "center", gap: 3 }}>
                          <Calendar size={11} />
                          {new Date(lead.timestamp).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {/* Seletor de status — corretor pode atualizar */}
                  <select
                    value={lead.status ?? "novo"}
                    onChange={(e) => atualizarStatus(lead.id, e.target.value as LeadStatus)}
                    style={{
                      padding: "6px 10px", borderRadius: 8, cursor: "pointer",
                      fontSize: 11, fontWeight: 700, border: "none",
                      background: STATUS_LEAD[lead.status as LeadStatus]?.bg ?? STATUS_LEAD.novo.bg,
                      color: STATUS_LEAD[lead.status as LeadStatus]?.cor ?? STATUS_LEAD.novo.cor,
                      outline: `1px solid ${STATUS_LEAD[lead.status as LeadStatus]?.border ?? STATUS_LEAD.novo.border}`,
                    }}
                  >
                    {Object.entries(STATUS_LEAD).map(([key, cfg]) => (
                      <option key={key} value={key} style={{ background: "#17271C", color: "#D8D8D7" }}>
                        {cfg.label}
                      </option>
                    ))}
                  </select>

                  <a
                    href={`https://wa.me/55${lead.whatsapp?.replace(/\D/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 8,
                      background: "rgba(22,163,74,0.15)",
                      border: "1px solid rgba(22,163,74,0.3)",
                      color: "#4ade80", fontSize: 12, fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Rodapé */}
      <footer style={{ borderTop: "1px solid var(--border-subtle)", padding: "20px 0" }}>
        <div className="container-app" style={{ textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "var(--gray-dark)" }}>
            Habiticon Construção Inteligente · CNPJ 61.922.155/0001-70
          </p>
        </div>
      </footer>

      {/* CSS para spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}