"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, Lock, LogIn } from "lucide-react";

export default function AdminLoginPage() {
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (r.ok) {
        // Usar location.href em vez de router.push
        // Garante full reload para que o cookie seja lido pelo proxy na próxima requisição
        window.location.href = "/admin";
      } else {
        const data = await r.json().catch(() => ({}));
        setErro(data.error || "Senha incorreta. Tente novamente.");
        setSenha("");
      }
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Image
            src="/logo.png"
            alt="Habiticon"
            width={200}
            height={60}
            style={{ height: 56, width: "auto", margin: "0 auto" }}
            priority
          />
          <div style={{ marginTop: 14 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 14px", borderRadius: 100,
              background: "rgba(249,115,22,0.12)",
              border: "1px solid rgba(249,115,22,0.3)",
              fontSize: 11, fontWeight: 800, color: "#fb923c",
              letterSpacing: "0.1em", textTransform: "uppercase",
            }}>
              Painel Administrativo
            </span>
          </div>
        </div>

        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 20,
          padding: "36px 32px",
          boxShadow: "var(--shadow-card)",
        }}>
          <h1 style={{
            fontSize: 20, fontWeight: 800, color: "var(--gray-light)",
            letterSpacing: "-0.02em", marginBottom: 4,
          }}>
            Entrar no Admin
          </h1>
          <p style={{ fontSize: 13, color: "var(--gray-mid)", marginBottom: 28 }}>
            Acesso restrito — use suas credenciais
          </p>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{
                display: "block", fontSize: 11, fontWeight: 700,
                color: "var(--gray-mid)", textTransform: "uppercase",
                letterSpacing: "0.07em", marginBottom: 8,
              }}>Login</label>
              <div style={{
                padding: "14px 16px", borderRadius: 12,
                background: "rgba(0,0,0,0.2)",
                border: "1px solid var(--border-subtle)",
                fontSize: 14, color: "var(--gray-dark)",
              }}>
                operacional@habiticongyn.com
              </div>
            </div>

            <div>
              <label style={{
                display: "block", fontSize: 11, fontWeight: 700,
                color: "var(--gray-mid)", textTransform: "uppercase",
                letterSpacing: "0.07em", marginBottom: 8,
              }}>Senha</label>
              <div style={{ position: "relative" }}>
                <Lock size={16} color="var(--terracota)" style={{
                  position: "absolute", left: 16, top: "50%",
                  transform: "translateY(-50%)", pointerEvents: "none",
                }} />
                <input
                  type={mostrar ? "text" : "password"}
                  className="input-field"
                  style={{ paddingLeft: 44, paddingRight: 48, fontSize: 16, height: 54 }}
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoFocus
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrar(!mostrar)}
                  style={{
                    position: "absolute", right: 14, top: "50%",
                    transform: "translateY(-50%)", background: "none",
                    border: "none", cursor: "pointer", color: "var(--gray-dark)", padding: 4,
                  }}
                >
                  {mostrar ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {erro && (
                <p style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>
                  ⚠️ {erro}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!senha || loading}
              className="btn-primary"
              style={{ height: 52, fontSize: 15, marginTop: 8, opacity: !senha ? 0.5 : 1 }}
            >
              <LogIn size={18} />
              {loading ? "Verificando…" : "Entrar"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "var(--gray-dark)" }}>
          Habiticon Construção Inteligente · CNPJ 61.922.155/0001-70
        </p>
      </div>
    </div>
  );
}