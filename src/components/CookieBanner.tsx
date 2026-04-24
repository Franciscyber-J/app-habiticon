"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export function CookieBanner() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    // Verifica se o usuário já aceitou os cookies anteriormente
    const consentimento = localStorage.getItem("habiticon_cookies_aceitos");
    if (!consentimento) {
      setVisivel(true);
    }
  }, []);

  const aceitarCookies = () => {
    localStorage.setItem("habiticon_cookies_aceitos", "true");
    setVisivel(false);
  };

  if (!visivel) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "rgba(15,30,22,0.95)", backdropFilter: "blur(10px)",
      borderTop: "1px solid var(--border-active)", padding: "16px 20px",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 -4px 20px rgba(0,0,0,0.5)"
    }}>
      <div style={{
        maxWidth: 1000, width: "100%", display: "flex", flexWrap: "wrap",
        alignItems: "center", justifyContent: "space-between", gap: 16
      }}>
        <p style={{ fontSize: 13, color: "var(--gray-mid)", flex: "1 1 300px", lineHeight: 1.5 }}>
          Utilizamos cookies e tecnologias de rastreamento para garantir o funcionamento do nosso motor de vendas, vincular seu atendimento ao corretor correto e melhorar sua experiência. Ao continuar navegando, você concorda com nossa{" "}
          <Link href="/termos" style={{ color: "var(--terracota-light)", textDecoration: "underline" }}>
            Política de Privacidade
          </Link>.
        </p>
        <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
          <button 
            onClick={aceitarCookies}
            style={{
              padding: "10px 24px", background: "var(--terracota)", color: "white",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 14px rgba(175,111,83,0.3)"
            }}
          >
            Aceitar e Continuar
          </button>
          <button 
            onClick={() => setVisivel(false)}
            style={{
              padding: "10px", background: "transparent", color: "var(--gray-dark)",
              border: "none", cursor: "pointer"
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}