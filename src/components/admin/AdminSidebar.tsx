"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { 
  Building2, Users, Banknote, Wallet, Landmark, 
  FolderOpen, ArrowLeft, LogOut, X 
} from "lucide-react";

interface AdminSidebarProps {
  tab: string;
  setTab: (tab: any) => void;
  fazerLogout: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  todosLeadsCount: number;
}

export function AdminSidebar({ tab, setTab, fazerLogout, sidebarOpen, setSidebarOpen, todosLeadsCount }: AdminSidebarProps) {
  
  const MENU_ITEMS = [
    { id: "empreendimentos", label: "Empreendimentos", icon: Building2 },
    { id: "leads", label: `Visão de Vendas (${todosLeadsCount})`, icon: Users },
    { id: "financeiro", label: "Dashboard Financeiro", icon: Banknote },
    { id: "equipe", label: "Equipe e Pagamentos", icon: Wallet },
    { id: "recebiveis", label: "Contratos & Recebíveis", icon: Landmark },
    { id: "arquivos", label: "Arquivos Padrão", icon: FolderOpen },
  ];

  const SidebarContent = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
        <Link href="/" className="btn-ghost" style={{ padding: "8px 10px", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--gray-mid)" }}>
          <ArrowLeft size={15} /> Voltar ao Site
        </Link>
        <Image src="/logo.png" alt="Habiticon" width={200} height={56} style={{ height: "clamp(36px,6vw,48px)", width: "auto", objectFit: "contain", display: "block", marginBottom: 12 }} priority />
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#fb923c", letterSpacing: "0.1em", textTransform: "uppercase" }}>Painel Admin</span>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {MENU_ITEMS.map(s => {
            const Icon = s.icon;
            const ativo = tab === s.id;
            return (
              <button key={s.id} onClick={() => { setTab(s.id); setSidebarOpen(false); }} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "11px 14px", borderRadius: 12, border: "none",
                cursor: "pointer", textAlign: "left", width: "100%",
                background: ativo ? "var(--terracota-glow)" : "transparent",
                outline: ativo ? "1px solid var(--border-active)" : "1px solid transparent",
                transition: "all 150ms ease",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: ativo ? "var(--terracota)" : "rgba(0,0,0,0.3)",
                  transition: "all 150ms ease",
                }}>
                  <Icon size={15} color={ativo ? "white" : "var(--gray-mid)"} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: ativo ? "var(--terracota-light)" : "var(--gray-light)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.label}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      <div style={{ padding: "12px 10px 16px", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={fazerLogout}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "9px 16px", borderRadius: 10, cursor: "pointer",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            color: "#f87171", fontSize: 13, fontWeight: 600,
          }}
        >
          <LogOut size={14} /> Sair
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden lg:flex flex-col" style={{
        width: 260, minWidth: 260, flexShrink: 0,
        position: "sticky", top: 0, height: "100vh",
        background: "rgba(15,30,22,0.98)", backdropFilter: "blur(24px)",
        borderRight: "1px solid var(--border-subtle)", overflow: "hidden",
      }}>
        <SidebarContent />
      </aside>

      {/* SIDEBAR MOBILE (DRAWER) */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="lg:hidden" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 49, backdropFilter: "blur(3px)" }} />
      )}
      <div className="lg:hidden" style={{
        position: "fixed", top: 0, left: 0, height: "100%", width: 280,
        background: "rgba(10,25,16,0.99)", backdropFilter: "blur(24px)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 280ms cubic-bezier(.4,0,.2,1)",
        zIndex: 50,
      }}>
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Image src="/logo.png" alt="Habiticon" width={140} height={40} style={{ height: 36, width: "auto" }} priority />
          <button onClick={() => setSidebarOpen(false)} style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-light)" }}>
            <X size={16} />
          </button>
        </div>
        <SidebarContent />
      </div>
    </>
  );
}