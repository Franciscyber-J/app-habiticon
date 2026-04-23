"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, ArrowRight, Building2, Home, BarChart3, FileText, Loader2 } from "lucide-react";

interface Modelo {
  id: string;
  nome: string;
  area: number;
  valor: number;
}

interface Empreendimento {
  slug: string;
  nome: string;
  cidade: string;
  estado: string;
  descricao: string;
  status: string;
  modelos: Modelo[];
}

export default function HomePage() {
  const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([]);
  const [loading, setLoading] = useState(true);

  // Busca os empreendimentos em tempo real da API (Firebase)
  useEffect(() => {
    fetch("/api/empreendimentos")
      .then((res) => res.json())
      .then((data) => {
        setEmpreendimentos(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Erro ao carregar empreendimentos:", error);
        setLoading(false);
      });
  }, []);

  const ativos  = empreendimentos.filter((e) => e.status === "ativo");
  const emBreve = empreendimentos.filter((e) => e.status === "em_breve" || e.status === "inativo"); // Considerei inativo como em_breve para não o perder de vista

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-base)" }}>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header style={{
        background: "rgba(15,30,22,0.98)",
        backdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--border-subtle)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}>
        <div className="container-app">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "clamp(6px,1.5vw,12px) 0" }}>

            {/* Logo — tamanho generoso */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Image
                src="/logo.png"
                alt="Habiticon"
                width={280}
                height={80}
                style={{ height: "clamp(40px,6vw,96px)", width: "auto", objectFit: "contain" }}
                priority
              />
            </div>

            
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section style={{
        background: [
          "radial-gradient(ellipse 80% 60% at 10% 0%, rgba(175,111,83,0.14) 0%, transparent 60%)",
          "radial-gradient(ellipse 60% 80% at 90% 100%, rgba(33,57,43,0.8) 0%, transparent 60%)",
          "var(--bg-base)",
        ].join(", "),
        padding: "80px 0 64px",
      }}>
        <div className="container-app">

          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 100,
            background: "rgba(175,111,83,0.12)",
            border: "1px solid rgba(175,111,83,0.3)",
            marginBottom: 28,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--terracota)", display: "inline-block",
              boxShadow: "0 0 8px var(--terracota)",
            }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--terracota)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Motor de Vendas · Versão 2026
            </span>
          </div>

          {/* Título */}
          <h1 style={{
            fontSize: "clamp(2.2rem, 5vw, 3.6rem)",
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: "var(--gray-light)",
            maxWidth: 680,
            marginBottom: 20,
          }}>
            Apresente e simule{" "}
            <span style={{ color: "var(--terracota)" }}>com transparência</span>
          </h1>

          {/* Subtítulo */}
          <p style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: "var(--gray-mid)",
            maxWidth: 540,
            marginBottom: 52,
          }}>
            Simulador completo MCMV, motor de subsídio, evolução de obra e
            gerador de propostas em PDF — tudo em um só lugar.
          </p>

          {/* Pills de features */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
            {[
              { icon: BarChart3, label: "Simulador SAC + PRICE" },
              { icon: Home,      label: "Motor de Subsídio" },
              { icon: FileText,  label: "Proposta em PDF" },
              { icon: Building2, label: "Entrada Embutida CUB" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 8,
                background: "rgba(33,57,43,0.5)",
                border: "1px solid var(--border-subtle)",
              }}>
                <Icon size={14} color="var(--terracota)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-mid)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EMPREENDIMENTOS ─────────────────────────────────────────── */}
      <section style={{ padding: "16px 0 80px" }}>
        <div className="container-app">

          {/* Heading da seção */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{
              fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--gray-light)",
              marginBottom: 6,
            }}>
              Empreendimentos disponíveis
            </h2>
            <p style={{ fontSize: 14, color: "var(--gray-mid)" }}>
              Clique para acessar o simulador completo
            </p>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
               <Loader2 size={32} color="var(--terracota)" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <>
              {/* Grid de cards ativos */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                gap: 24,
              }}>
                {ativos.map((emp) => (
                  <Link
                    key={emp.slug}
                    href={`/${emp.slug}`}
                    style={{ textDecoration: "none", display: "block" }}
                    className="glass-card"
                  >
                    <div style={{ padding: "28px 28px 24px" }}>

                      {/* Topo: ícone + nome + badge */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <div style={{
                            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "var(--terracota-glow)",
                            border: "1px solid var(--border-active)",
                          }}>
                            <Building2 size={24} color="var(--terracota)" />
                          </div>
                          <div>
                            <h3 style={{
                              fontSize: 17, fontWeight: 700,
                              color: "var(--gray-light)", marginBottom: 4,
                            }}>
                              {emp.nome}
                            </h3>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--gray-mid)" }}>
                              <MapPin size={13} />
                              <span style={{ fontSize: 13 }}>{emp.cidade} · {emp.estado}</span>
                            </div>
                          </div>
                        </div>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 12px", borderRadius: 100,
                          background: "rgba(22,163,74,0.15)",
                          border: "1px solid rgba(22,163,74,0.3)",
                          fontSize: 11, fontWeight: 700,
                          color: "#4ade80", letterSpacing: "0.05em",
                          textTransform: "uppercase", flexShrink: 0,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                          Ativo
                        </span>
                      </div>

                      {/* Descrição */}
                      <p style={{
                        fontSize: 14, lineHeight: 1.6,
                        color: "var(--gray-mid)", marginBottom: 24,
                      }}>
                        {emp.descricao}
                      </p>

                      {/* Cards dos modelos */}
                      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                        {emp.modelos?.map((m) => (
                          <div key={m.id} style={{
                            flex: "1 1 100px", borderRadius: 12, padding: "16px 14px",
                            textAlign: "center",
                            background: "rgba(0,0,0,0.25)",
                            border: "1px solid var(--border-subtle)",
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--terracota)", marginBottom: 4 }}>
                              {m.nome}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--gray-mid)", marginBottom: 6 }}>
                              {m.area}m²
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-light)" }}>
                              R$ {(m.valor / 1000).toFixed(0)}k
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Rodapé do card */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        paddingTop: 18,
                        borderTop: "1px solid var(--border-subtle)",
                      }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--terracota)" }}>
                          Abrir simulador
                        </span>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "var(--terracota-glow)",
                          border: "1px solid var(--border-active)",
                        }}>
                          <ArrowRight size={15} color="var(--terracota)" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Em breve */}
              {emBreve.length > 0 && (
                <div style={{ marginTop: 56 }}>
                  <div style={{
                    height: 1,
                    background: "linear-gradient(to right, transparent, var(--border-subtle), transparent)",
                    marginBottom: 40,
                  }} />
                  <h2 style={{
                    fontSize: "clamp(1.1rem, 2vw, 1.4rem)",
                    fontWeight: 700, letterSpacing: "-0.02em",
                    color: "var(--gray-light)", marginBottom: 6,
                  }}>
                    Em breve
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--gray-mid)", marginBottom: 28 }}>
                    Novos empreendimentos chegando
                  </p>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 16,
                  }}>
                    {emBreve.map((emp) => (
                      <div key={emp.slug} style={{
                        padding: "22px 24px", borderRadius: 16, opacity: 0.55,
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                          <div style={{
                            width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)",
                          }}>
                            <Building2 size={18} color="var(--gray-mid)" />
                          </div>
                          <div>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-light)", marginBottom: 3 }}>
                              {emp.nome}
                            </h3>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--gray-mid)" }}>
                              <MapPin size={11} />
                              <span style={{ fontSize: 12 }}>{emp.cidade} · {emp.estado}</span>
                            </div>
                          </div>
                        </div>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 12px", borderRadius: 100,
                          background: "rgba(249,115,22,0.12)",
                          border: "1px solid rgba(249,115,22,0.25)",
                          fontSize: 11, fontWeight: 700, color: "#fb923c",
                          textTransform: "uppercase", letterSpacing: "0.05em",
                        }}>
                          Em breve
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid var(--border-subtle)",
        padding: "clamp(12px,2vw,18px) 0",
      }}>
        <div className="container-app" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
        }}>
          <Image
            src="/logo.png"
            alt="Habiticon"
            width={120}
            height={34}
            style={{ height: "clamp(28px,4vw,40px)", width: "auto", opacity: 0.8 }}
          />
          <p style={{ fontSize: 12, color: "var(--gray-dark)" }}>
            © 2026 Habiticon Construção Inteligente · CNPJ 61.922.155/0001-70
          </p>
        </div>
      </footer>

      {/* Adicionar a animação de spin */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />

    </main>
  );
}