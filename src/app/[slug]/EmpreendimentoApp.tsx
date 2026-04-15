"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  Home, TrendingUp, HardHat, FileText, ImageIcon,
  MapPin, ChevronLeft, Settings2, CheckCircle2,
  ChevronRight, Menu, X, Info
} from "lucide-react";

import { ModelSelector } from "@/components/simulador/ModelSelector";
import { EntradaSlider } from "@/components/simulador/EntradaSlider";
import { ResultCards } from "@/components/simulador/ResultCards";
import { ComparadorSacPrice } from "@/components/simulador/ComparadorSacPrice";
import { SubsidioGauge } from "@/components/subsidio/SubsidioGauge";
import { ObrasEscadaChart } from "@/components/obra/ObrasEscadaChart";
import { PDFGenerator } from "@/components/proposta/PDFGenerator";
import { GaleriaCarousel } from "@/components/vitrine/GaleriaCarousel";
import { simular, formatBRL } from "@/lib/calculos";

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
    taxaMercado: number;
    igpmMensal: number;
    mesesObra: number;
    percentualObraPorMes: number[];
  };
  mcmv: {
    faixas: FaixaMCMV[];
    tetoImovel: number;
    observacao: string;
  };
  vitrine: { imagens: { url: string; titulo?: string }[]; plantas: { url: string; titulo?: string }[] };
  textos: {
    notasLegais: string;
    tituloObra: string;
    descricaoObra: string;
    alertaF3: string;
    alertaF12: string;
  };
}

// FLUXO: Renda → Simulador → Obra → Proposta → Vitrine
const MODULOS = [
  {
    id: "renda",
    label: "1. Renda & Subsídio",
    shortLabel: "Renda",
    icon: TrendingUp,
    hint: "Identifique o enquadramento MCMV",
  },
  {
    id: "simulador",
    label: "2. Simulador",
    shortLabel: "Simulador",
    icon: Home,
    hint: "Motor 50/50 com SAC e PRICE",
  },
  {
    id: "obra",
    label: "3. Obra PCI",
    shortLabel: "Obra",
    icon: HardHat,
    hint: "Juros durante a construção",
  },
  {
    id: "proposta",
    label: "4. Proposta PDF",
    shortLabel: "Proposta",
    icon: FileText,
    hint: "Gere o documento personalizado",
  },
  {
    id: "vitrine",
    label: "5. Vitrine",
    shortLabel: "Vitrine",
    icon: ImageIcon,
    hint: "Fotos, plantas e localização",
  },
];

export default function EmpreendimentoApp({ emp }: { emp: Empreendimento }) {
  const [moduloAtivo, setModuloAtivo] = useState("renda");
  const [modeloSelecionado, setModeloSelecionado] = useState(emp.modelos[0]?.id || "");
  const [entrada, setEntrada] = useState(emp.simulador.entradaMin);
  const [subsidio, setSubsidio] = useState(0);
  const [taxaAtual, setTaxaAtual] = useState(emp.simulador.taxaFaixa12);
  const [rendaPreenchida, setRendaPreenchida] = useState(false);
  const [rendaFamiliar, setRendaFamiliar] = useState(0);
  const [atoPercent, setAtoPercent] = useState(0.5); // 50% mínimo, até 100%
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const modelo = emp.modelos.find((m) => m.id === modeloSelecionado) || emp.modelos[0];

  const handleSubsidioChange = useCallback((sub: number, taxa: number, rendaDigitada: boolean, rendaVal = 0) => {
    setSubsidio(sub);
    setTaxaAtual(taxa);
    setRendaPreenchida(rendaDigitada);
    if (rendaVal > 0) setRendaFamiliar(rendaVal);
  }, []);

  const valorFinanciado = useMemo(
    () => Math.max(0, (modelo?.valor || 0) - entrada - subsidio),
    [modelo, entrada, subsidio]
  );

  const resultadoSimulacao = useMemo(() => {
    if (!modelo || valorFinanciado <= 0) return null;
    return simular({
      valorImovel: modelo.valor,
      entrada,
      prazoMeses: emp.simulador.prazoMeses,
      taxaAnual: taxaAtual,
      subsidio,
    });
  }, [modelo, entrada, emp.simulador.prazoMeses, taxaAtual, subsidio, valorFinanciado]);

  const propostaData = useMemo(() => {
    if (!modelo || !resultadoSimulacao) return null;
    return {
      empreendimento: emp.nome,
      cidade: emp.cidade,
      estado: emp.estado,
      modelo: modelo.nome,
      area: modelo.area,
      valorImovel: modelo.valor,
      entrada: entrada,
      ato: entrada * atoPercent,
      valorFinanciado,
      subsidio,
      taxa: taxaAtual,
      prazoMeses: emp.simulador.prazoMeses,
      parcelaSACPrimeira: resultadoSimulacao?.parcelaSACPrimeira || 0,
      parcelaSACUltima: resultadoSimulacao?.parcelaSACUltima || 0,
      parcelaPRICE: resultadoSimulacao?.parcelaPricePrimeira || 0,
      notasLegais: emp.textos.notasLegais,
    };
  }, [modelo, resultadoSimulacao, emp, entrada, subsidio, taxaAtual, atoPercent, rendaFamiliar]);

  const getModuloStatus = (modId: string) => {
    if (modId === "renda") return rendaPreenchida ? "done" : "active";
    if (modId === "simulador") return modelo && entrada > emp.simulador.entradaMin ? "done" : "pending";
    if (modId === "obra") return valorFinanciado > 0 ? "done" : "pending";
    if (modId === "proposta") return propostaData ? "done" : "pending";
    return "pending";
  };

  // ==============================
  // SIDEBAR CONTENT (Desktop + Mobile drawer)
  // ==============================
  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Topo: logo/back + info empreendimento */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
        <Link
          href="/"
          className="btn-ghost flex items-center gap-2 text-sm mb-5 px-0 py-1 w-fit"
          style={{ color: "var(--gray-mid)" }}
        >
          <ChevronLeft size={15} />
          Voltar à lista
        </Link>
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex-center shrink-0 mt-0.5"
            style={{ background: "var(--terracota-glow)", border: "1px solid var(--border-active)" }}
          >
            <Home size={15} color="var(--terracota)" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight" style={{ color: "var(--gray-light)" }}>
              {emp.nome}
            </p>
            <p className="text-xs flex items-center gap-1 mt-1" style={{ color: "var(--gray-mid)" }}>
              <MapPin size={10} />
              {emp.cidade} · {emp.estado}
            </p>
          </div>
        </div>
      </div>

      {/* Módulos de navegação */}
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
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: isActive ? "1px solid var(--border-active)" : "1px solid transparent",
                  background: isActive ? "var(--terracota-glow)" : "transparent",
                  cursor: "pointer",
                  transition: "all 150ms ease",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                {/* Ícone */}
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isActive ? "var(--terracota)" : "rgba(0,0,0,0.3)",
                    flexShrink: 0,
                    transition: "all 150ms ease",
                  }}
                >
                  {status === "done" && !isActive ? (
                    <CheckCircle2 size={15} color="#4ade80" />
                  ) : (
                    <Icon size={15} color={isActive ? "white" : "var(--gray-mid)"} />
                  )}
                </div>

                {/* Texto */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: isActive ? "var(--terracota-light)" : "var(--gray-light)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {mod.label}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--gray-dark)",
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {mod.hint}
                  </p>
                </div>

                {isActive && <ChevronRight size={13} color="var(--terracota)" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Rodapé sidebar */}
      <div style={{ padding: "16px 12px 20px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        <Link
          href="/admin"
          className="btn-ghost w-full justify-start gap-2"
          style={{ fontSize: 13, padding: "10px 14px" }}
        >
          <Settings2 size={14} />
          Painel Admin
        </Link>

        {/* Mini-card do modelo ativo */}
        {modelo && (
          <div
            style={{
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.3)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <p style={{ fontSize: 11, color: "var(--gray-mid)", marginBottom: 4 }}>Modelo ativo</p>
            <p style={{ fontWeight: 700, fontSize: 13, color: "var(--terracota)" }}>{modelo.nome}</p>
            <p style={{ fontSize: 11, color: "var(--gray-mid)", marginTop: 2 }}>
              {modelo.area}m² · {formatBRL(modelo.valor)}
            </p>
            {subsidio > 0 && (
              <p style={{ fontSize: 11, color: "#4ade80", marginTop: 4 }}>
                Subsídio: {formatBRL(subsidio)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-base)" }}>

      {/* ============================
          SIDEBAR DESKTOP (fixa)
          ============================ */}
      <aside
        className="hidden lg:flex flex-col sticky top-0 h-screen"
        style={{
          width: 272,
          minWidth: 272,
          background: "rgba(15,30,22,0.98)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid var(--border-subtle)",
          overflow: "hidden",
        }}
      >
        <SidebarContent />
      </aside>

      {/* ============================
          SIDEBAR MOBILE (drawer)
          ============================ */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              className="fixed left-0 top-0 bottom-0 z-50 flex flex-col lg:hidden"
              style={{
                width: 288,
                background: "rgba(15,30,22,0.99)",
                backdropFilter: "blur(20px)",
                borderRight: "1px solid var(--border-subtle)",
                overflow: "hidden",
              }}
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
            >
              {/* Header do drawer mobile */}
              <div
                className="flex items-center justify-between"
                style={{ padding: "16px 16px", borderBottom: "1px solid var(--border-subtle)" }}
              >
                <Image src="/logo.png" alt="Habiticon" width={100} height={28} className="h-7 w-auto" />
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="btn-ghost"
                  style={{ padding: "8px" }}
                >
                  <X size={18} />
                </button>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <SidebarContent onNavigate={() => setSidebarOpen(false)} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ============================
          ÁREA DE CONTEÚDO PRINCIPAL
          ============================ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar mobile */}
        <header
          className="lg:hidden sticky top-0 z-30 flex items-center justify-between"
          style={{
            padding: "12px 20px",
            background: "rgba(15,30,22,0.97)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost" style={{ padding: "8px" }}>
            <Menu size={20} />
          </button>
          <Image src="/logo.png" alt="Habiticon" width={90} height={28} className="h-7 w-auto" />
          <div className="badge badge-info" style={{ fontSize: 11 }}>
            {MODULOS.find((m) => m.id === moduloAtivo)?.shortLabel}
          </div>
        </header>

        {/* Breadcrumb desktop */}
        <div
          className="hidden lg:flex items-center gap-3"
          style={{ padding: "16px 40px", borderBottom: "1px solid var(--border-subtle)" }}
        >
          <Image src="/logo.png" alt="Habiticon" width={90} height={28} className="h-7 w-auto" />
          <div style={{ width: 1, height: 20, background: "var(--border-subtle)" }} />
          {(() => {
            const mod = MODULOS.find((m) => m.id === moduloAtivo);
            const Icon = mod?.icon || Home;
            return (
              <div className="flex items-center gap-2">
                <Icon size={14} color="var(--gray-mid)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-light)" }}>
                  {mod?.label}
                </span>
                <span style={{ fontSize: 12, color: "var(--gray-dark)" }}>· {mod?.hint}</span>
              </div>
            );
          })()}
        </div>

        {/* Conteúdo dos módulos */}
        <main
          style={{
            flex: 1,
            padding: "40px 40px 60px",
            overflowY: "auto",
          }}
        >
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <AnimatePresence mode="wait">

              {/* ========================
                  MÓDULO 1: RENDA & SUBSÍDIO
                  ======================== */}
              {moduloAtivo === "renda" && (
                <motion.div
                  key="renda"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  style={{ display: "flex", flexDirection: "column", gap: 40 }}
                >
                  <div>
                    <h2 className="text-title" style={{ marginBottom: 10 }}>Renda &amp; Subsídio MCMV</h2>
                    <p className="text-body">
                      Comece informando a renda bruta familiar. O sistema identifica o enquadramento
                      no programa MCMV e calcula o subsídio e a taxa de juros automaticamente.
                    </p>
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
                      <button
                        onClick={() => setModuloAtivo("simulador")}
                        className="btn-primary w-full"
                        style={{ padding: "16px 28px", fontSize: 15 }}
                      >
                        Ir para o Simulador
                        <ChevronRight size={18} />
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ========================
                  MÓDULO 2: SIMULADOR
                  ======================== */}
              {moduloAtivo === "simulador" && (
                <motion.div
                  key="simulador"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  style={{ display: "flex", flexDirection: "column", gap: 40 }}
                >
                  <div>
                    <h2 className="text-title" style={{ marginBottom: 10 }}>Motor de Vendas 50/50</h2>
                    <p className="text-body">
                      Selecione o modelo e ajuste a entrada.
                      {subsidio > 0
                        ? ` O subsídio de ${formatBRL(subsidio)} e a taxa de ${taxaAtual}% já estão aplicados.`
                        : " Configure a renda no passo anterior para aplicar subsídio automaticamente."}
                    </p>
                  </div>

                  {/* Banner de subsídio aplicado */}
                  {subsidio > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "16px 20px",
                        borderRadius: 14,
                        background: "rgba(34,197,94,0.08)",
                        border: "1px solid rgba(34,197,94,0.25)",
                      }}
                    >
                      <CheckCircle2 size={18} color="#4ade80" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#4ade80", marginBottom: 2 }}>
                          Subsídio MCMV aplicado: {formatBRL(subsidio)}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--gray-mid)" }}>
                          Taxa de juros: {taxaAtual}% a.a. · Já descontado do saldo a financiar
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Seleção de Modelo */}
                  <div className="glass-card-nohover">
                    <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 20 }}>
                      Escolha o Modelo
                    </h3>
                    <ModelSelector
                      modelos={emp.modelos}
                      selected={modeloSelecionado}
                      onSelect={setModeloSelecionado}
                    />
                  </div>

                  {/* Slider de Entrada */}
                  {modelo && (
                    <div className="glass-card-nohover">
                      <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 20 }}>
                        Defina a Entrada Total
                      </h3>
                      <EntradaSlider
                        value={entrada}
                        min={emp.simulador.entradaMin}
                        max={emp.simulador.entradaMax}
                        onChange={setEntrada}
                      />
                    </div>
                  )}

                  {/* Cards de resultado */}
                  {modelo && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gray-mid)" }}>
                          Composição da Entrada
                        </h3>
                        <ResultCards
                          valorImovel={modelo.valor}
                          entrada={entrada}
                          subsidio={subsidio}
                          atoPercent={atoPercent}
                          onAtoPercentChange={setAtoPercent}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gray-mid)" }}>
                          Simulador de Financiamento
                        </h3>
                        {valorFinanciado > 0 ? (
                          <ComparadorSacPrice
                            valorFinanciado={valorFinanciado}
                            taxaAnual={taxaAtual}
                            prazoMeses={emp.simulador.prazoMeses}
                            rendaFamiliar={rendaFamiliar}
                          />
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minHeight: 160,
                              borderRadius: 16,
                              border: "1px dashed var(--border-subtle)",
                              background: "rgba(0,0,0,0.15)",
                            }}
                          >
                            <p className="text-muted">Ajuste a entrada ou configure o subsídio</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Nota MCMV */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <Info size={15} color="var(--gray-dark)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 12, color: "var(--gray-dark)", lineHeight: 1.6 }}>
                      Simulação para {emp.cidade}-{emp.estado} com taxa nominal de <strong style={{ color: "var(--gray-mid)" }}>{taxaAtual}% a.a.</strong> 
                      e prazo de {emp.simulador.prazoMeses} meses. Parcelas financeiras não incluem seguros obrigatórios de DFI e MIP (~R$ 70-130/mês). 
                      Sujeito à análise de crédito da Caixa Econômica Federal conforme regras do programa MCMV.
                    </p>
                  </div>

                  {/* Ações */}
                  {valorFinanciado > 0 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                      {propostaData && <PDFGenerator proposta={propostaData} />}
                      <button onClick={() => setModuloAtivo("obra")} className="btn-secondary">
                        Ver Juros de Obra
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ========================
                  MÓDULO 3: OBRA PCI
                  ======================== */}
              {moduloAtivo === "obra" && (
                <motion.div
                  key="obra"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  style={{ display: "flex", flexDirection: "column", gap: 28 }}
                >
                  <div>
                    <h2 className="text-title" style={{ marginBottom: 10 }}>Evolução de Obra (PCI)</h2>
                    <p className="text-body">
                      Durante a construção, você paga apenas os juros sobre o valor que a Caixa
                      já liberou. Após as chaves, inicia o financiamento completo.
                    </p>
                  </div>

                  {modelo && valorFinanciado > 0 ? (
                    <div className="glass-card-nohover">
                      <ObrasEscadaChart
                        valorFinanciado={valorFinanciado}
                        taxaAnual={taxaAtual}
                        percentuaisPorMes={emp.simulador.percentualObraPorMes}
                        titulo={emp.textos.tituloObra}
                        descricao={emp.textos.descricaoObra}
                        valorLote={modelo.valorLote || 48000}
                        parcelaSAC={resultadoSimulacao?.parcelaSACPrimeira || 0}
                        parcelaPRICE={resultadoSimulacao?.parcelaPricePrimeira || 0}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 220,
                        borderRadius: 16,
                        border: "1px dashed var(--border-subtle)",
                        background: "rgba(0,0,0,0.15)",
                        gap: 16,
                      }}
                    >
                      <p className="text-muted">Complete o Simulador primeiro</p>
                      <button onClick={() => setModuloAtivo("simulador")} className="btn-secondary">
                        Ir ao Simulador
                      </button>
                    </div>
                  )}

                  {valorFinanciado > 0 && (
                    <button
                      onClick={() => setModuloAtivo("proposta")}
                      className="btn-primary w-full"
                      style={{ padding: "16px 28px", fontSize: 15 }}
                    >
                      Gerar Proposta PDF
                      <ChevronRight size={18} />
                    </button>
                  )}
                </motion.div>
              )}

              {/* ========================
                  MÓDULO 4: PROPOSTA
                  ======================== */}
              {moduloAtivo === "proposta" && (
                <motion.div
                  key="proposta"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 600 }}
                >
                  <div>
                    <h2 className="text-title" style={{ marginBottom: 10 }}>Gerar Proposta Comercial</h2>
                    <p className="text-body">
                      Capture os dados do cliente e gere um PDF profissional com a simulação completa.
                    </p>
                  </div>

                  {propostaData ? (
                    <>
                      <div className="glass-card-nohover" style={{ padding: 32 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--terracota)", marginBottom: 24 }}>
                          Resumo Técnico da Simulação
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {[
                            ["Empreendimento", emp.nome],
                            ["Modelo sugerido", `${modelo?.nome} · ${modelo?.area}m²`],
                            ["Valor do Imóvel", formatBRL(modelo?.valor || 0)],
                            ["Valor do Lote", formatBRL(modelo?.valorLote || 48000)],
                            ["Entrada Total", formatBRL(entrada)],
                            ["  ↳ Ato mínimo no contrato", formatBRL(entrada * atoPercent)],
                            ["  ↳ Restante a parcelar", formatBRL(entrada - entrada * atoPercent)],
                            ...(subsidio > 0 ? [["Subsídio MCMV aplicado", formatBRL(subsidio)]] : []),
                            ["Saldo total a financiar", formatBRL(valorFinanciado)],
                            ["Taxa de juros anual", `${taxaAtual}% a.a.`],
                            ["Prazo selecionado", `${emp.simulador.prazoMeses} meses (${emp.simulador.prazoMeses / 12} anos)`],
                            ["Parcela SAC (1ª)", formatBRL(resultadoSimulacao?.parcelaSACPrimeira || 0)],
                            ["Parcela PRICE (Fixa)", formatBRL(resultadoSimulacao?.parcelaPricePrimeira || 0)],
                          ].map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "14px 0",
                                borderBottom: "1px solid rgba(255,255,255,0.05)",
                              }}
                            >
                              <span style={{ fontSize: 13, color: k.startsWith("  ") ? "var(--gray-dark)" : "var(--gray-mid)" }}>
                                {k.trim()}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: k.includes("MCMV") || k.includes("Parcela") ? "var(--terracota-light)" : "var(--gray-light)" }}>
                                {v}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <PDFGenerator proposta={propostaData} />
                    </>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 220,
                        borderRadius: 16,
                        border: "1px dashed var(--border-subtle)",
                        background: "rgba(0,0,0,0.15)",
                        gap: 16,
                      }}
                    >
                      <p className="text-muted">Configure o Simulador primeiro</p>
                      <button onClick={() => setModuloAtivo("simulador")} className="btn-secondary">
                        Ir ao Simulador
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ========================
                  MÓDULO 5: VITRINE
                  ======================== */}
              {moduloAtivo === "vitrine" && (
                <motion.div
                  key="vitrine"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  style={{ display: "flex", flexDirection: "column", gap: 28 }}
                >
                  <div>
                    <h2 className="text-title" style={{ marginBottom: 10 }}>Vitrine Digital</h2>
                    <p className="text-body">Plantas baixas, renders 3D e localização no mapa.</p>
                  </div>

                  <div className="glass-card-nohover">
                    <GaleriaCarousel
                      imagens={emp.vitrine.imagens}
                      plantas={emp.vitrine.plantas}
                      nomeModelo={modelo?.nome || emp.nome}
                    />
                  </div>

                  <div className="glass-card-nohover">
                    <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 20 }}>
                      Localização — {emp.cidade}, {emp.estado}
                    </h3>
                    <div style={{ borderRadius: 12, overflow: "hidden", height: 340 }}>
                      <iframe
                        src={`https://maps.google.com/maps?q=${emp.coordenadas.lat},${emp.coordenadas.lng}&z=14&output=embed`}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
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
