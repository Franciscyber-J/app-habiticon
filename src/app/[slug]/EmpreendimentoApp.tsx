"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  Home, TrendingUp, HardHat, FileText, ImageIcon,
  MapPin, ChevronLeft, Settings2, CheckCircle2,
  ChevronRight, Menu, X, Info, AlertTriangle, Ban,
} from "lucide-react";

import { ModelSelector } from "@/components/simulador/ModelSelector";
import { EntradaSlider } from "@/components/simulador/EntradaSlider";
import { ResultCards } from "@/components/simulador/ResultCards";
import { ComparadorSacPrice } from "@/components/simulador/ComparadorSacPrice";
import { SubsidioGauge } from "@/components/subsidio/SubsidioGauge";
import { ObrasEscadaChart } from "@/components/obra/ObrasEscadaChart";
import { PDFGenerator } from "@/components/proposta/PDFGenerator";
import { GaleriaCarousel } from "@/components/vitrine/GaleriaCarousel";
import {
  simular,
  formatBRL,
  calcularEntradaMinima,
  calcularMaxFinCUB,
  calcularLaudoCUB,
  determinarFaixaEfetiva,
  COTA_MAXIMA_CAIXA,
  type LimitadorEntrada,
  type EntradaMinimaResult,
  type FaixaEfetiva,
} from "@/lib/calculos";

// ─────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────

interface Modelo {
  id: string;
  nome: string;
  quartos: number;
  area: number;
  valor: number;
  imagem: string;
  planta: string;
  valorLote?: number;
}

interface FaixaMCMV {
  id: number;
  nome: string;
  rendaMin: number;
  rendaMax: number;
  subsidioMax: number;
  subsidioMin: number;
  taxa: number;
  taxaCotista?: number;
  tetoImovel?: number;  // teto do valor do imóvel (laudo) para esta faixa
  cor: string;
}

interface Empreendimento {
  slug: string;
  nome: string;
  cidade: string;
  estado: string;
  descricao: string;
  status: string;
  coordenadas: { lat: number; lng: number };
  modelos: Modelo[];
  simulador: {
    entradaMin: number;
    entradaMax: number;
    prazoMeses: number;
    taxaFaixa12: number;
    taxaFaixa3: number;
    taxaFaixa3Cotista?: number;
    taxaMercado: number;
    igpmMensal: number;
    mesesObra: number;
    percentualObraPorMes: number[];
    cub?: {
      bdi: number;
      cubVigente: number; // R$/m² — atualizar mensalmente no admin com o CUB SINDUSCON-GO
    };
  };
  mcmv: {
    faixas: FaixaMCMV[];
    tetoImovel: number;
    observacao: string;
  };
  vitrine: {
    imagens: { url: string; titulo?: string }[];
    plantas: { url: string; titulo?: string }[];
  };
  textos: {
    notasLegais: string;
    tituloObra: string;
    descricaoObra: string;
    alertaF3: string;
    alertaF12: string;
  };
}

// ─────────────────────────────────────────────────────────
// CONFIG DOS MÓDULOS
// ─────────────────────────────────────────────────────────

const MODULOS = [
  { id: "renda",     label: "1. Renda & Subsídio", shortLabel: "Renda",    icon: TrendingUp, hint: "Identifique o enquadramento MCMV" },
  { id: "simulador", label: "2. Simulador",         shortLabel: "Simulador",icon: Home,       hint: "Motor 50/50 com SAC e PRICE" },
  { id: "obra",      label: "3. Obra PCI",           shortLabel: "Obra",     icon: HardHat,    hint: "Juros durante a construção" },
  { id: "proposta",  label: "4. Proposta PDF",       shortLabel: "Proposta", icon: FileText,   hint: "Gere o documento personalizado" },
  { id: "vitrine",   label: "5. Vitrine",            shortLabel: "Vitrine",  icon: ImageIcon,  hint: "Fotos, plantas e localização" },
];

// ─────────────────────────────────────────────────────────
// CONFIG DO ALERTA DE TRAVA — por tipo de limitador
// ─────────────────────────────────────────────────────────

const TRAVA_CONFIG: Record<LimitadorEntrada, {
  cor: string; bgAlpha: string; borderAlpha: string;
  icone: React.ElementType; emoji: string; titulo: string;
}> = {
  renda_30: {
    cor: "#ef4444", bgAlpha: "rgba(239,68,68,0.1)", borderAlpha: "rgba(239,68,68,0.28)",
    icone: AlertTriangle, emoji: "📊", titulo: "Trava de Renda — Regra dos 30%",
  },
  cota_80: {
    cor: "#f97316", bgAlpha: "rgba(249,115,22,0.1)", borderAlpha: "rgba(249,115,22,0.28)",
    icone: Info, emoji: "🏦", titulo: "Teto MCMV — Máximo 80% do Imóvel",
  },
  cub: {
    cor: "#a855f7", bgAlpha: "rgba(168,85,247,0.1)", borderAlpha: "rgba(168,85,247,0.28)",
    icone: Ban, emoji: "📐", titulo: "Laudo CUB Insuficiente",
  },
  entrada_min: {
    cor: "#4ade80", bgAlpha: "rgba(74,222,128,0.07)", borderAlpha: "rgba(74,222,128,0.2)",
    icone: CheckCircle2, emoji: "✅", titulo: "Entrada mínima aplicada",
  },
};

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────

export default function EmpreendimentoApp({ emp }: { emp: Empreendimento }) {
  const [moduloAtivo,       setModuloAtivo]       = useState("renda");
  const [modeloSelecionado, setModeloSelecionado] = useState(emp.modelos[0]?.id || "");
  const [entrada,           setEntrada]           = useState(emp.simulador.entradaMin);
  const [subsidio,          setSubsidio]          = useState(0);
  const [taxaAtual,         setTaxaAtual]         = useState(emp.simulador.taxaFaixa12);
  const [rendaPreenchida,   setRendaPreenchida]   = useState(false);
  const [rendaFamiliar,     setRendaFamiliar]     = useState(0);
  const [faixaIdPelaRenda,  setFaixaIdPelaRenda] = useState<number | null>(null);
  const [atoPercent,        setAtoPercent]        = useState(0.5);
  const [sidebarOpen,       setSidebarOpen]       = useState(false);
  const [usarSubsidio,      setUsarSubsidio]      = useState(true);

  // Lote único do empreendimento — sempre o do primeiro modelo (regra: lote igual para todos)
  const valorLoteEmpreendimento = emp.modelos[0]?.valorLote ?? 48000;

  const modelo = emp.modelos.find((m) => m.id === modeloSelecionado) || emp.modelos[0];

  const handleSubsidioChange = useCallback((
    sub: number, taxa: number, rendaDigitada: boolean, rendaVal = 0, faixaId?: number
  ) => {
    setSubsidio(sub);
    setTaxaAtual(taxa);
    setRendaPreenchida(rendaDigitada);
    if (rendaVal > 0) setRendaFamiliar(rendaVal);
    setFaixaIdPelaRenda(faixaId ?? null);
  }, []);

  // ─────────────────────────────────────────────────────
  // MOTOR ENTRADA EMBUTIDA (Motor A, CHEFE) + RENDA (Motor B)
  //
  // Motor A — CUB SINDUSCON:
  //   laudoCUB = lote + área × cub × (1+bdi)
  //   maxFinCUB = min(laudoCUB, tetoMCMV) × 80%
  //   Se laudoCUB > preço de venda → 80% do laudo cobre mais
  //   que 80% do contrato → comprador entra com menos ("entrada embutida")
  //   Fallback quando CUB=0: usa 80% do contrato normalmente.
  //
  // Motor B — Renda 30%:
  //   maxFinRenda = motor de parcela (Infinity se sem renda)
  //
  // O mais restritivo dos dois determina a entrada final.
  // ─────────────────────────────────────────────────────
  const motorEntrada = useMemo((): EntradaMinimaResult | null => {
    if (!modelo) return null;

    const subsidioEfetivo = usarSubsidio ? subsidio : 0;
    const valorVenda = modelo.valor - subsidioEfetivo;

    // Motor B: 30% da renda → simulação silenciosa com entrada 0
    let maxFinRenda = Infinity;
    if (rendaFamiliar > 0) {
      const sim = simular({
        valorImovel: modelo.valor,
        entrada: 0,
        prazoMeses: emp.simulador.prazoMeses,
        taxaAnual: taxaAtual,
        subsidio,
        usarSubsidio,
        rendaFamiliar,
        tetoImovel: emp.mcmv.tetoImovel,
      });
      maxFinRenda = sim.finLiberadoPRICE;
    }

    // Motor A: CUB SINDUSCON (0 = não configurado → fallback 80% contrato)
    const cubCfg = emp.simulador.cub;
    const maxFinCUB =
      cubCfg && cubCfg.cubVigente > 0
        ? calcularMaxFinCUB(
            valorLoteEmpreendimento,
            modelo.area,
            cubCfg.cubVigente,
            cubCfg.bdi,
          )
        : 0;

    return calcularEntradaMinima(
      valorVenda,
      maxFinRenda,
      maxFinCUB,
      emp.simulador.entradaMin,
      COTA_MAXIMA_CAIXA,
      emp.mcmv.tetoImovel,  // teto MCMV aplicado ao laudo dentro do Motor A
    );
  }, [
    modelo,
    rendaFamiliar,
    emp.simulador.entradaMin,
    emp.simulador.prazoMeses,
    emp.simulador.cub,
    taxaAtual,
    subsidio,
    usarSubsidio,
    emp.mcmv.tetoImovel,
    valorLoteEmpreendimento,
  ]);

  const minEntradaPermitida = motorEntrada?.entradaMinima ?? emp.simulador.entradaMin;

  // ─── Motor de Faixa Efetiva ─────────────────────────────────
  // Cruza: faixa exigida pelo LAUDO CUB (R2) vs faixa da RENDA (R3)
  // Se laudo força faixa superior → cliente pode estar bloqueado
  const faixaEfetiva = useMemo((): FaixaEfetiva | null => {
    if (!modelo || rendaFamiliar <= 0) return null;
    const cubCfg = emp.simulador.cub;
    const laudoTotal = cubCfg && cubCfg.cubVigente > 0
      ? calcularLaudoCUB(valorLoteEmpreendimento, modelo.area, cubCfg.cubVigente, cubCfg.bdi).laudoTotal
      : null;
    const subsidioBase = usarSubsidio ? subsidio : 0;
    return determinarFaixaEfetiva(laudoTotal, rendaFamiliar, emp.mcmv.faixas, subsidioBase);
  }, [modelo, rendaFamiliar, emp.simulador.cub, emp.mcmv.faixas, valorLoteEmpreendimento, subsidio, usarSubsidio]);

  // Quando a faixa efetiva mudar, sincroniza a taxa e zera subsídio se necessário
  useEffect(() => {
    if (!faixaEfetiva?.faixaEfetiva) return;
    const taxaCorreta = faixaEfetiva.taxaEfetiva;
    if (Math.abs(taxaCorreta - taxaAtual) > 0.001) {
      setTaxaAtual(taxaCorreta);
    }
    // Se o laudo forçou para Faixa 3/4, desabilita subsídio automaticamente
    if (faixaEfetiva.laudoForcouFaixaSuperior && faixaEfetiva.faixaEfetiva.id > 2) {
      setUsarSubsidio(false);
    }
  }, [faixaEfetiva]);

  // Slider avança automaticamente se a entrada atual ficou abaixo do novo mínimo
  useEffect(() => {
    if (entrada < minEntradaPermitida) {
      setEntrada(minEntradaPermitida);
    }
  }, [minEntradaPermitida, entrada]);

  // ─────────────────────────────────────────────────────
  // SIMULAÇÃO PRINCIPAL
  // ─────────────────────────────────────────────────────
  const resultadoSimulacao = useMemo(() => {
    if (!modelo) return null;
    return simular({
      valorImovel: modelo.valor,
      entrada,
      prazoMeses: emp.simulador.prazoMeses,
      taxaAnual: taxaAtual,
      subsidio,
      usarSubsidio,
      rendaFamiliar,
      tetoImovel: emp.mcmv.tetoImovel,
    });
  }, [modelo, entrada, emp.simulador.prazoMeses, taxaAtual, subsidio, usarSubsidio, rendaFamiliar, emp.mcmv.tetoImovel]);

  // ─────────────────────────────────────────────────────
  // DADOS DA PROPOSTA PDF
  // ─────────────────────────────────────────────────────
  const propostaData = useMemo(() => {
    if (!modelo || !resultadoSimulacao) return null;
    return {
      empreendimento: emp.nome,
      cidade: emp.cidade,
      estado: emp.estado,
      modelo: modelo.nome,
      area: modelo.area,
      valorImovel: modelo.valor,
      entrada,
      ato: entrada * atoPercent,
      valorFinanciado: resultadoSimulacao.finLiberadoPRICE,
      subsidio: usarSubsidio ? subsidio : 0,
      taxa: taxaAtual,
      prazoMeses: emp.simulador.prazoMeses,
      parcelaSACPrimeira: resultadoSimulacao.parcelaSACPrimeira,
      parcelaSACUltima: resultadoSimulacao.parcelaSACUltima,
      parcelaPRICE: resultadoSimulacao.parcelaPricePrimeira,
      notasLegais: emp.textos.notasLegais,
    };
  }, [modelo, resultadoSimulacao, emp, entrada, subsidio, usarSubsidio, taxaAtual, atoPercent]);

  const getModuloStatus = (modId: string) => {
    if (modId === "renda")     return rendaPreenchida ? "done" : "active";
    if (modId === "simulador") return modelo && entrada >= emp.simulador.entradaMin ? "done" : "pending";
    if (modId === "obra")      return resultadoSimulacao && resultadoSimulacao.finLiberadoPRICE > 0 ? "done" : "pending";
    if (modId === "proposta")  return propostaData ? "done" : "pending";
    return "pending";
  };

  // ─────────────────────────────────────────────────────
  // ALERTA DE TRAVA — componente inline inteligente
  // ─────────────────────────────────────────────────────
  const AlertaTrava = () => {
    if (!motorEntrada) return null;
    if (minEntradaPermitida <= emp.simulador.entradaMin) return null;
    if (motorEntrada.limitador === "entrada_min") return null;

    const cfg = TRAVA_CONFIG[motorEntrada.limitador];
    const Icone = cfg.icone;

    return (
      <div style={{
        marginBottom: 20, padding: "16px 18px", borderRadius: 10,
        background: cfg.bgAlpha, border: `1px solid ${cfg.borderAlpha}`,
        display: "flex", alignItems: "flex-start", gap: 14,
      }}>
        <Icone size={16} color={cfg.cor} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: cfg.cor, marginBottom: 5 }}>
            {cfg.emoji} {cfg.titulo}
          </p>
          <p style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.65 }}>
            {motorEntrada.detalhe}{" "}
            A entrada obrigatória passou para{" "}
            <strong style={{ color: "#fff" }}>{formatBRL(minEntradaPermitida)}</strong>.
          </p>

          {/* Nota extra quando limitador é 80%: mostra que a renda está folgada */}
          {motorEntrada.limitador === "cota_80" && rendaFamiliar > 0 && (
            <p style={{
              fontSize: 11, color: "rgba(255,255,255,0.45)",
              marginTop: 8, paddingTop: 8,
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}>
              💡 A renda de {formatBRL(rendaFamiliar)} está confortável — suportaria até{" "}
              {formatBRL(motorEntrada.maxFinRenda)} de financiamento (
              {((motorEntrada.maxFinRenda / (rendaFamiliar * 12)) * 100).toFixed(0)}×
              renda anual). O limitador foi o teto de 80% do valor do imóvel.
            </p>
          )}

          {/* Nota extra quando limitador é CUB */}
          {motorEntrada.limitador === "cub" && (
            <p style={{
              fontSize: 11, color: "rgba(255,255,255,0.45)",
              marginTop: 8, paddingTop: 8,
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}>
              📐 Laudo CUB cobre {formatBRL(motorEntrada.maxFinCUB)} (80% do laudo).
              Para cobrir 100% atualize o CUB vigente no painel admin ou revise o BDI.
            </p>
          )}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────
  // SIDEBAR
  // ─────────────────────────────────────────────────────
  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
        <Link href="/" className="btn-ghost flex items-center gap-2 text-sm mb-5 px-0 py-1 w-fit" style={{ color: "var(--gray-mid)" }}>
          <ChevronLeft size={15} /> Voltar à lista
        </Link>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex-center shrink-0 mt-0.5" style={{ background: "var(--terracota-glow)", border: "1px solid var(--border-active)" }}>
            <Home size={15} color="var(--terracota)" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight" style={{ color: "var(--gray-light)" }}>{emp.nome}</p>
            <p className="text-xs flex items-center gap-1 mt-1" style={{ color: "var(--gray-mid)" }}>
              <MapPin size={10} /> {emp.cidade} · {emp.estado}
            </p>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto", minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {MODULOS.map((mod) => {
            const Icon = mod.icon;
            const isActive = moduloAtivo === mod.id;
            const status = getModuloStatus(mod.id);
            return (
              <button
                key={mod.id}
                onClick={() => { setModuloAtivo(mod.id); onNavigate?.(); }}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px 14px", borderRadius: "12px",
                  border: isActive ? "1px solid var(--border-active)" : "1px solid transparent",
                  background: isActive ? "var(--terracota-glow)" : "transparent",
                  cursor: "pointer", transition: "all 150ms ease",
                  textAlign: "left", width: "100%",
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isActive ? "var(--terracota)" : "rgba(0,0,0,0.3)",
                  flexShrink: 0, transition: "all 150ms ease",
                }}>
                  {status === "done" && !isActive
                    ? <CheckCircle2 size={15} color="#4ade80" />
                    : <Icon size={15} color={isActive ? "white" : "var(--gray-mid)"} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, color: isActive ? "var(--terracota-light)" : "var(--gray-light)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {mod.label}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {mod.hint}
                  </p>
                </div>
                {isActive && <ChevronRight size={13} color="var(--terracota)" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      </nav>

      <div style={{ padding: "16px 12px 20px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        <Link href="/admin" className="btn-ghost w-full justify-start gap-2" style={{ fontSize: 13, padding: "10px 14px" }}>
          <Settings2 size={14} /> Painel Admin
        </Link>
        {modelo && (
          <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)" }}>
            <p style={{ fontSize: 11, color: "var(--gray-mid)", marginBottom: 4 }}>Modelo ativo</p>
            <p style={{ fontWeight: 700, fontSize: 13, color: "var(--terracota)" }}>{modelo.nome}</p>
            <p style={{ fontSize: 11, color: "var(--gray-mid)", marginTop: 2 }}>{modelo.area}m² · {formatBRL(modelo.valor)}</p>
            {subsidio > 0 && usarSubsidio && (
              <p style={{ fontSize: 11, color: "#4ade80", marginTop: 4 }}>Subsídio: {formatBRL(subsidio)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-base)" }}>

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col sticky top-0 h-screen" style={{ width: 272, minWidth: 272, background: "rgba(15,30,22,0.98)", backdropFilter: "blur(20px)", borderRight: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <SidebarContent />
      </aside>

      {/* Sidebar mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 lg:hidden" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />
            <motion.aside className="fixed left-0 top-0 bottom-0 z-50 flex flex-col lg:hidden" style={{ width: 288, background: "rgba(15,30,22,0.99)", backdropFilter: "blur(20px)", borderRight: "1px solid var(--border-subtle)", overflow: "hidden" }} initial={{ x: -288 }} animate={{ x: 0 }} exit={{ x: -288 }} transition={{ type: "spring", damping: 28, stiffness: 320 }}>
              <div className="flex items-center justify-between" style={{ padding: "16px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
                <Image src="/logo.png" alt="Habiticon" width={100} height={28} className="h-7 w-auto" />
                <button onClick={() => setSidebarOpen(false)} className="btn-ghost" style={{ padding: "8px" }}><X size={18} /></button>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <SidebarContent onNavigate={() => setSidebarOpen(false)} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">

        {/* Header mobile */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between" style={{ padding: "12px 20px", background: "rgba(15,30,22,0.97)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border-subtle)" }}>
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost" style={{ padding: "8px" }}><Menu size={20} /></button>
          <Image src="/logo.png" alt="Habiticon" width={90} height={28} className="h-7 w-auto" />
          <div className="badge badge-info" style={{ fontSize: 11 }}>{MODULOS.find((m) => m.id === moduloAtivo)?.shortLabel}</div>
        </header>

        {/* Breadcrumb desktop */}
        <div className="hidden lg:flex items-center gap-3" style={{ padding: "16px 40px", borderBottom: "1px solid var(--border-subtle)" }}>
          <Image src="/logo.png" alt="Habiticon" width={90} height={28} className="h-7 w-auto" />
          <div style={{ width: 1, height: 20, background: "var(--border-subtle)" }} />
          {(() => {
            const mod = MODULOS.find((m) => m.id === moduloAtivo);
            const Icon = mod?.icon || Home;
            return (
              <div className="flex items-center gap-2">
                <Icon size={14} color="var(--gray-mid)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-light)" }}>{mod?.label}</span>
                <span style={{ fontSize: 12, color: "var(--gray-dark)" }}>· {mod?.hint}</span>
              </div>
            );
          })()}
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <main style={{ flex: 1, padding: "40px 40px 60px", overflowY: "auto" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <AnimatePresence mode="wait">

              {/* ══════════════════════════════════════════
                  MÓDULO 1 — RENDA & SUBSÍDIO
              ══════════════════════════════════════════ */}
              {moduloAtivo === "renda" && (
                <motion.div key="renda" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                  <div>
                    <h2 className="text-title" style={{ marginBottom: 10 }}>Renda & Subsídio MCMV</h2>
                    <p className="text-body">Comece informando a renda bruta familiar. O sistema identifica o enquadramento no programa MCMV e calcula o subsídio e a taxa de juros automaticamente.</p>
                  </div>
                  <div className="glass-card-nohover" style={{ padding: 48 }}>
                    <SubsidioGauge
                      faixas={emp.mcmv.faixas}
                      onSubsidioChange={handleSubsidioChange}
                      initialRenda={rendaFamiliar}
                      valorImovel={modelo?.valor || 0}
                      tetoMcmv={emp.mcmv.tetoImovel}
                    />
                  </div>
                  {rendaPreenchida && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <button onClick={() => setModuloAtivo("simulador")} className="btn-primary w-full" style={{ padding: "16px 28px", fontSize: 15 }}>
                        Ir para o Simulador <ChevronRight size={18} />
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ══════════════════════════════════════════
                  MÓDULO 2 — SIMULADOR
              ══════════════════════════════════════════ */}
              {moduloAtivo === "simulador" && (
                <motion.div key="simulador" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                  <div>
                    <h2 className="text-title" style={{ marginBottom: 10 }}>Motor de Vendas 50/50</h2>
                    <p className="text-body">
                      Selecione o modelo e ajuste a entrada.
                      {subsidio > 0
                        ? ` O subsídio e a taxa de ${taxaAtual}% já estão mapeados.`
                        : " Configure a renda no passo anterior para calcular o subsídio."}
                    </p>
                  </div>

                  {/* Toggle subsídio */}
                  {subsidio > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="glass-card p-5"
                      style={{ borderLeft: usarSubsidio ? "4px solid #4ade80" : "4px solid #fb923c" }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 style={{ fontWeight: 700, color: "var(--gray-light)", fontSize: 14 }}>
                            Aplicar Subsídio MCMV de {formatBRL(subsidio)}?
                          </h4>
                          <p style={{ fontSize: 12, color: "var(--gray-mid)", marginTop: 4 }}>
                            A Caixa pode zerar o subsídio para compradores solteiros e sem dependentes.
                          </p>
                        </div>
                        <button
                          onClick={() => setUsarSubsidio(!usarSubsidio)}
                          style={{ padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 12, transition: "all 0.2s", background: usarSubsidio ? "#4ade80" : "rgba(255,255,255,0.1)", color: usarSubsidio ? "#000" : "var(--gray-mid)", border: usarSubsidio ? "none" : "1px solid var(--border-subtle)" }}
                        >
                          {usarSubsidio ? "LIGADO" : "DESLIGADO"}
                        </button>
                      </div>
                      {!usarSubsidio ? (
                        <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "rgba(251,146,60,0.1)", color: "#fb923c", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                          ⚠️ Mostrando valores reais sem o desconto do governo (pior cenário).
                        </div>
                      ) : (
                        <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "rgba(74,222,128,0.1)", color: "#4ade80", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                          <CheckCircle2 size={15} /> Subsídio descontado do saldo a financiar! Taxa de {taxaAtual}% a.a.
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ★ CARD DE BLOQUEIO — laudo CUB força faixa incompatível com renda */}
                  {faixaEfetiva && !faixaEfetiva.aprovado && faixaEfetiva.bloqueio && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      style={{ padding: "20px 22px", borderRadius: 14, background: "rgba(239,68,68,0.08)", border: "2px solid rgba(239,68,68,0.3)", display: "flex", gap: 14, alignItems: "flex-start" }}
                    >
                      <Ban size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>
                          ⛔ Este modelo não pode ser aprovado com esta renda
                        </p>
                        <p style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.6 }}>
                          {faixaEfetiva.bloqueio}
                        </p>
                        <p style={{ fontSize: 12, color: "rgba(252,165,165,0.7)", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(239,68,68,0.2)" }}>
                          💡 Para aprovar este modelo, o cliente precisa declarar renda mínima de{" "}
                          <strong style={{ color: "#fca5a5" }}>{formatBRL(faixaEfetiva.rendaMinimaParaAprovacao)}/mês</strong>.
                          Ou escolha o Modelo 2Q, cujo laudo CUB fica dentro do teto da Faixa 2.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* ★ CARD INFORMATIVO — laudo forçou faixa superior mas renda compatível */}
                  {faixaEfetiva?.aprovado && faixaEfetiva.laudoForcouFaixaSuperior && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)", display: "flex", gap: 12, alignItems: "flex-start" }}
                    >
                      <AlertTriangle size={15} color="#fb923c" style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 12, color: "#fed7aa", lineHeight: 1.6 }}>
                        <strong>Atenção:</strong> O laudo CUB deste modelo (R$ {Math.round(calcularLaudoCUB(valorLoteEmpreendimento, modelo.area, emp.simulador.cub!.cubVigente, emp.simulador.cub!.bdi).laudoTotal).toLocaleString("pt-BR")}) ultrapassa o teto da Faixa 2 (R$ {faixaEfetiva.faixaPeloLaudo?.tetoImovel?.toLocaleString("pt-BR")}). O financiamento foi enquadrado automaticamente na{" "}
                        <strong>{faixaEfetiva.faixaEfetiva?.nome}</strong> — sem subsídio, taxa {faixaEfetiva.taxaEfetiva}% a.a.
                      </p>
                    </motion.div>
                  )}

                  {/* Seletor de modelo */}
                  <div className="glass-card-nohover">
                    <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 20 }}>
                      Escolha o Modelo
                    </h3>
                    <ModelSelector modelos={emp.modelos} selected={modeloSelecionado} onSelect={setModeloSelecionado} />
                  </div>

                  {/* Entrada slider + alerta trava */}
                  {modelo && (
                    <div className="glass-card-nohover">
                      <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 20 }}>
                        Defina a Entrada Total
                      </h3>

                      {/* ★ ALERTA INTELIGENTE — mostra o limitador correto */}
                      <AlertaTrava />

                      {/* ★ CARD DIAGNÓSTICO — entrada embutida CUB */}
                      {motorEntrada && emp.simulador.cub && emp.simulador.cub.cubVigente > 0 && (() => {
                        const { cubCobre, ganhoEntradaEmbutida, pctFinanciadoSobreVenda, maxFinCUB, entradaMinima } = motorEntrada;
                        const pct = (pctFinanciadoSobreVenda * 100).toFixed(1);
                        const cor = cubCobre ? "#4ade80" : ganhoEntradaEmbutida > 0 ? "#facc15" : "#f87171";
                        const status = cubCobre ? "✅ Entrada embutida: FUNCIONA" : ganhoEntradaEmbutida > 0 ? "⚡ Parcialmente coberta" : "⚠️ CUB insuficiente";
                        return (
                          <div style={{ marginBottom: 20, padding: "16px 18px", borderRadius: 10, background: `${cor}10`, border: `1px solid ${cor}30` }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: cor, marginBottom: 10 }}>{status}</p>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                              <div>
                                <p style={{ fontSize: 10, color: "var(--gray-dark)", marginBottom: 4 }}>Laudo CUB cobre</p>
                                <p style={{ fontSize: 16, fontWeight: 800, color: cor }}>{pct}%</p>
                                <p style={{ fontSize: 10, color: "var(--gray-dark)" }}>do imóvel</p>
                              </div>
                              <div>
                                <p style={{ fontSize: 10, color: "var(--gray-dark)", marginBottom: 4 }}>Ganho do CUB</p>
                                <p style={{ fontSize: 16, fontWeight: 800, color: ganhoEntradaEmbutida > 0 ? "#4ade80" : "var(--gray-mid)" }}>{formatBRL(ganhoEntradaEmbutida)}</p>
                                <p style={{ fontSize: 10, color: "var(--gray-dark)" }}>vs 80% contrato</p>
                              </div>
                              <div>
                                <p style={{ fontSize: 10, color: "var(--gray-dark)", marginBottom: 4 }}>Entrada mín real</p>
                                <p style={{ fontSize: 16, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRL(entradaMinima)}</p>
                                <p style={{ fontSize: 10, color: "var(--gray-dark)" }}>pelo laudo</p>
                              </div>
                            </div>
                            {!cubCobre && (
                              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                                📐 Para embutir 100% da entrada (mín R$10k), o CUB precisaria ser ≥ R${
                                  Math.ceil(((modelo.valor - emp.simulador.entradaMin) / COTA_MAXIMA_CAIXA - valorLoteEmpreendimento) / (modelo.area * (1 + (emp.simulador.cub?.bdi ?? 0.18)))).toLocaleString("pt-BR")
                                }/m²
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      <EntradaSlider
                        value={entrada}
                        min={minEntradaPermitida}
                        max={emp.simulador.entradaMax}
                        onChange={setEntrada}
                      />
                    </div>
                  )}

                  {/* Cards resultado */}
                  {modelo && resultadoSimulacao && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gray-mid)" }}>
                          Composição da Entrada
                        </h3>
                        <ResultCards
                          valorImovel={modelo.valor}
                          entrada={entrada}
                          subsidio={usarSubsidio ? subsidio : 0}
                          atoPercent={atoPercent}
                          onAtoPercentChange={setAtoPercent}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gray-mid)" }}>
                          Simulador de Financiamento
                        </h3>
                        {resultadoSimulacao.finLiberadoPRICE > 0 ? (
                          <ComparadorSacPrice
                            valorFinanciado={resultadoSimulacao.finLiberadoPRICE}
                            taxaAnual={taxaAtual}
                            prazoMeses={emp.simulador.prazoMeses}
                            rendaFamiliar={rendaFamiliar}
                          />
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 160, borderRadius: 16, border: "1px dashed var(--border-subtle)", background: "rgba(0,0,0,0.15)" }}>
                            <p className="text-muted">Ajuste a entrada ou configure o subsídio</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Nota de rodapé */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 12, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-subtle)" }}>
                    <Info size={15} color="var(--gray-dark)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 12, color: "var(--gray-dark)", lineHeight: 1.6 }}>
                      Simulação para {emp.cidade}-{emp.estado} com taxa nominal de{" "}
                      <strong style={{ color: "var(--gray-mid)" }}>{taxaAtual}% a.a.</strong> e prazo de{" "}
                      {emp.simulador.prazoMeses} meses.{" "}
                      <strong>Os seguros obrigatórios (DFI/MIP) e taxas administrativas já estão embutidos no cálculo das parcelas.</strong>{" "}
                      O Laudo de Avaliação exibido é uma estimativa inteligente para viabilizar o financiamento no teto do MCMV.
                      Sujeito à análise de crédito da Caixa Econômica Federal.
                    </p>
                  </div>

                  {resultadoSimulacao && resultadoSimulacao.finLiberadoPRICE > 0 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                      {propostaData && <PDFGenerator proposta={propostaData} />}
                      <button onClick={() => setModuloAtivo("obra")} className="btn-secondary">
                        Ver Juros de Obra <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ══════════════════════════════════════════
                  MÓDULO 3 — OBRA PCI
              ══════════════════════════════════════════ */}
              {moduloAtivo === "obra" && (
                <motion.div key="obra" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                  <div>
                    <h2 className="text-title" style={{ marginBottom: 10 }}>Evolução de Obra (PCI)</h2>
                    <p className="text-body">Durante a construção, você paga apenas os juros sobre o valor que a Caixa já liberou.</p>
                  </div>
                  {modelo && resultadoSimulacao && resultadoSimulacao.finLiberadoPRICE > 0 ? (
                    <div className="glass-card-nohover">
                      <ObrasEscadaChart
                        valorFinanciado={resultadoSimulacao.finLiberadoPRICE}
                        taxaAnual={taxaAtual}
                        percentuaisPorMes={emp.simulador.percentualObraPorMes}
                        titulo={emp.textos.tituloObra}
                        descricao={emp.textos.descricaoObra}
                        valorLote={valorLoteEmpreendimento}
                        parcelaSAC={resultadoSimulacao.parcelaSACPrimeira}
                        parcelaPRICE={resultadoSimulacao.parcelaPricePrimeira}
                      />
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 220, borderRadius: 16, border: "1px dashed var(--border-subtle)", background: "rgba(0,0,0,0.15)", gap: 16 }}>
                      <p className="text-muted">Complete o Simulador primeiro</p>
                      <button onClick={() => setModuloAtivo("simulador")} className="btn-secondary">Ir ao Simulador</button>
                    </div>
                  )}
                  {resultadoSimulacao && resultadoSimulacao.finLiberadoPRICE > 0 && (
                    <button onClick={() => setModuloAtivo("proposta")} className="btn-primary w-full" style={{ padding: "16px 28px", fontSize: 15 }}>
                      Gerar Proposta PDF <ChevronRight size={18} />
                    </button>
                  )}
                </motion.div>
              )}

              {/* ══════════════════════════════════════════
                  MÓDULO 4 — PROPOSTA PDF
              ══════════════════════════════════════════ */}
              {moduloAtivo === "proposta" && (
                <motion.div key="proposta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 600 }}>
                  <div>
                    <h2 className="text-title" style={{ marginBottom: 10 }}>Gerar Proposta Comercial</h2>
                    <p className="text-body">Capture os dados do cliente e gere um PDF profissional com a simulação completa.</p>
                  </div>
                  {propostaData ? (
                    <>
                      <div className="glass-card-nohover" style={{ padding: 32 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--terracota)", marginBottom: 24 }}>
                          Resumo Técnico da Simulação
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {[
                            ["Empreendimento",                       emp.nome],
                            ["Modelo sugerido",                      `${modelo?.nome} · ${modelo?.area}m²`],
                            ["Valor do Contrato",                    formatBRL(modelo?.valor || 0)],
                            ["Valor de Avaliação Estimado (Laudo)",  formatBRL(resultadoSimulacao?.laudoPRICE || 0)],
                            // ★ FIX: lote único do empreendimento — igual para todos os modelos
                            ["Valor do Lote",                        formatBRL(valorLoteEmpreendimento)],
                            ["Entrada Real Exigida",                 formatBRL(entrada)],
                            ["  ↳ Ato mínimo no contrato",           formatBRL(entrada * atoPercent)],
                            ["  ↳ Restante a parcelar",              formatBRL(entrada - entrada * atoPercent)],
                            ...(subsidio > 0 && usarSubsidio
                              ? [["Subsídio MCMV aplicado", formatBRL(subsidio)]]
                              : []),
                            ["Financiamento Aprovado (80% do Laudo)",formatBRL(resultadoSimulacao?.finLiberadoPRICE || 0)],
                            ["Taxa de juros anual",                  `${taxaAtual}% a.a.`],
                            ["Prazo selecionado",                    `${emp.simulador.prazoMeses} meses (${emp.simulador.prazoMeses / 12} anos)`],
                            ["Parcela SAC (1ª)",                     formatBRL(resultadoSimulacao?.parcelaSACPrimeira || 0)],
                            ["Parcela PRICE (Fixa)",                 formatBRL(resultadoSimulacao?.parcelaPricePrimeira || 0)],
                          ].map(([k, v]) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              <span style={{ fontSize: 13, color: k.startsWith("  ") ? "var(--gray-dark)" : k.includes("Laudo") ? "var(--terracota)" : "var(--gray-mid)" }}>
                                {k.trim()}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: k.includes("MCMV") || k.includes("Parcela") || k.includes("Aprovado") ? "var(--terracota-light)" : "var(--gray-light)" }}>
                                {v}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <PDFGenerator proposta={propostaData} />
                    </>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 220, borderRadius: 16, border: "1px dashed var(--border-subtle)", background: "rgba(0,0,0,0.15)", gap: 16 }}>
                      <p className="text-muted">Configure o Simulador primeiro</p>
                      <button onClick={() => setModuloAtivo("simulador")} className="btn-secondary">Ir ao Simulador</button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ══════════════════════════════════════════
                  MÓDULO 5 — VITRINE
              ══════════════════════════════════════════ */}
              {moduloAtivo === "vitrine" && (
                <motion.div key="vitrine" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                  <div>
                    <h2 className="text-title" style={{ marginBottom: 10 }}>Vitrine Digital</h2>
                    <p className="text-body">Plantas baixas, renders 3D e localização no mapa.</p>
                  </div>
                  <div className="glass-card-nohover">
                    <GaleriaCarousel imagens={emp.vitrine.imagens} plantas={emp.vitrine.plantas} nomeModelo={modelo?.nome || emp.nome} />
                  </div>
                  <div className="glass-card-nohover">
                    <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 20 }}>
                      Localização — {emp.cidade}, {emp.estado}
                    </h3>
                    <div style={{ borderRadius: 12, overflow: "hidden", height: 340 }}>
                      <iframe
                        src={`https://maps.google.com/maps?q=${emp.coordenadas.lat},${emp.coordenadas.lng}&z=14&output=embed`}
                        width="100%" height="100%" style={{ border: 0 }}
                        loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                        title={`Mapa ${emp.cidade}`}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}