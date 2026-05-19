"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  Home, TrendingUp, HardHat, FileText, ImageIcon,
  MapPin, ChevronLeft, CheckCircle2,
  ChevronRight, Menu, X, Info, AlertTriangle, Ban, Share2, Copy, Check
} from "lucide-react";

import { ModelSelector } from "@/components/simulador/ModelSelector";
import { EntradaSlider } from "@/components/simulador/EntradaSlider";
import { ResultCards } from "@/components/simulador/ResultCards";
import { ComparadorSacPrice } from "@/components/simulador/ComparadorSacPrice";
import { SubsidioGauge } from "@/components/subsidio/SubsidioGauge";
import { ObrasEscadaChart } from "@/components/obra/ObrasEscadaChart";
import { PDFGenerator } from "@/components/proposta/PDFGenerator";
import { GaleriaVitrine } from "@/components/vitrine/GaleriaVitrine";

// Cálculos MCMV (Original)
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

// Cálculos SBPE (Novo)
import {
  simularSBPE,
  calcularEntradaEmbutidaSBPE,
  SBPE_COTA_MAXIMA_SAC,
  SBPE_COTA_MAXIMA_PRICE
} from "@/lib/calculos_sbpe";

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
  tetoImovel?: number;
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
    etapasObra?: { id?: string; descricao: string; percentual: number }[]; // <--- FALTAVA DECLARAR ISSO AQUI
    cub?: {
      bdi: number;
      cubVigente: number;
      itensComplementares?: { id: string; descricao: string; valor: number }[];
    };
    taxaSBPE?: number;
    cubSBPE?: number;
    bdiSBPE?: number;
    itensComplementaresSBPE?: { id: string; descricao: string; valor: number }[];
  };
  mcmv: {
    faixas: FaixaMCMV[];
    tetoImovel: number;
    observacao: string;
  };
  vitrine: {
    imagens: { url: string; titulo?: string }[];
    plantas:  { url: string; titulo?: string }[];
    ambientes?: Record<string, { ativo: boolean; fotos: { url: string; titulo?: string }[] }>;
    apresentacoes?: { url: string; titulo?: string }[];
  };
  textos: {
    notasLegais: string;
    tituloObra: string;
    descricaoObra: string;
    alertaF3: string;
    alertaF12: string;
    alertaSBPE?: string;
  };
}

// ─────────────────────────────────────────────────────────
// CONFIG DOS MÓDULOS E TRAVAS
// ─────────────────────────────────────────────────────────

const MODULOS = [
  { id: "renda",     label: "1. Renda & Subsídio", shortLabel: "Renda",    icon: TrendingUp, hint: "Identifique o enquadramento MCMV" },
  { id: "simulador", label: "2. Simulador",        shortLabel: "Simulador",icon: Home,       hint: "Motor 50/50 com SAC e PRICE" },
  { id: "obra",      label: "3. Obra PCI",         shortLabel: "Obra",     icon: HardHat,    hint: "Juros durante a construção" },
  { id: "proposta",  label: "4. Proposta PDF",     shortLabel: "Proposta", icon: FileText,   hint: "Gere o documento personalizado" },
  { id: "vitrine",   label: "5. Vitrine",          shortLabel: "Vitrine",  icon: ImageIcon,  hint: "Fotos, plantas e localização" },
];

const TRAVA_CONFIG: Record<LimitadorEntrada, {
  cor: string; bgAlpha: string; borderAlpha: string;
  icone: React.ElementType; emoji: string; titulo: string;
}> = {
  renda_30: {
    cor: "#ef4444", bgAlpha: "rgba(239,68,68,0.1)", borderAlpha: "rgba(239,68,68,0.28)",
    icone: AlertTriangle, emoji: "📊", titulo: "Trava de Renda — Comprometimento Máximo",
  },
  cota_80: {
    cor: "#f97316", bgAlpha: "rgba(249,115,22,0.1)", borderAlpha: "rgba(249,115,22,0.28)",
    icone: Info, emoji: "🏦", titulo: "Teto de Financiamento da Linha",
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

export default function EmpreendimentoApp({ 
  emp, 
  corretorIdUrl = "", 
  origemUrl = "organico" 
}: { 
  emp: Empreendimento;
  corretorIdUrl?: string;
  origemUrl?: string;
}) {
  const [moduloAtivo,       setModuloAtivo]       = useState("renda");
  const [empFresh, setEmpFresh] = useState(emp);
  const [linkCopiado, setLinkCopiado] = useState(false); 

  useEffect(() => {
    fetch("/api/empreendimentos")
      .then(r => r.json())
      .then((lista: any[]) => {
        const fresco = lista.find((e: any) => e.slug === emp.slug);
        if (fresco) setEmpFresh(fresco);
      })
      .catch(() => {});
  }, [emp.slug]);

  const [modeloSelecionado, setModeloSelecionado] = useState(empFresh.modelos[0]?.id || "");
  const [entrada,           setEntrada]           = useState(empFresh.simulador.entradaMin);
  const [subsidio,          setSubsidio]          = useState(0);
  const [taxaAtual,         setTaxaAtual]         = useState(empFresh.simulador.taxaFaixa12);
  const [rendaPreenchida,   setRendaPreenchida]   = useState(false);
  const [rendaFamiliar,     setRendaFamiliar]     = useState(0);
  const [faixaIdPelaRenda,  setFaixaIdPelaRenda] = useState<number | null>(null);
  const [atoPercent,        setAtoPercent]        = useState(0.5);
  const [sidebarOpen,       setSidebarOpen]       = useState(false);
  const [usarSubsidio,      setUsarSubsidio]      = useState(true);

  const valorLoteEmpreendimento = empFresh.modelos[0]?.valorLote ?? 48000;
  const modelo = empFresh.modelos.find((m) => m.id === modeloSelecionado) || empFresh.modelos[0];

  const tetoRendaMCMV = useMemo(() => Math.max(...empFresh.mcmv.faixas.map((f: any) => f.rendaMax), 13000), [empFresh.mcmv.faixas]);
  
  // O Teto do Imóvel deve olhar para o maior teto cadastrado nas faixas (geralmente a Faixa 4 = 600k)
  const tetoMaximoMCMVGlobal = useMemo(() => Math.max(...empFresh.mcmv.faixas.map((f: any) => f.tetoImovel || 0), empFresh.mcmv.tetoImovel || 600000), [empFresh.mcmv.faixas, empFresh.mcmv.tetoImovel]);
  
  const isSBPE = useMemo(() => {
    if (!modelo) return false;
    
    // Calcula o Laudo CUB puro para ver se a casa estoura o programa independentemente do contrato
    const cubCfg = empFresh.simulador.cub;
    const totalItens = cubCfg?.itensComplementares?.reduce((acc, item) => acc + (Number(item.valor) || 0), 0) || 0;
    const laudoPotencialMCMV = cubCfg && cubCfg.cubVigente > 0
      ? calcularLaudoCUB(empFresh.modelos[0]?.valorLote || 48000, modelo.area, cubCfg.cubVigente, cubCfg.bdi, 0, 0.8, totalItens).laudoTotal
      : modelo.valor;

    // Regra da Caixa: SBPE se renda for gigante, se contrato for gigante, ou se LAUDO CUB for gigante
    return (
      (rendaFamiliar > tetoRendaMCMV) || 
      (modelo.valor > tetoMaximoMCMVGlobal) || 
      (laudoPotencialMCMV > tetoMaximoMCMVGlobal)
    );
  }, [rendaFamiliar, tetoRendaMCMV, modelo, tetoMaximoMCMVGlobal, empFresh.simulador.cub, empFresh.modelos]);

  const handleSubsidioChange = useCallback((
    sub: number, taxa: number, rendaDigitada: boolean, rendaVal = 0, faixaId?: number
  ) => {
    setSubsidio(sub);
    setTaxaAtual(taxa);
    setRendaPreenchida(rendaDigitada);
    if (rendaVal > 0) setRendaFamiliar(rendaVal);
    setFaixaIdPelaRenda(faixaId ?? null);
  }, []);

  // ── HELPER: AVALIAÇÃO SBPE (CUB + COMPLEMENTARES) ──
  const getLaudoSBPE = useCallback((mod: Modelo) => {
    const cubCfg = empFresh.simulador.cubSBPE || 0;
    if (cubCfg <= 0) return 0;
    const bdiCfg = empFresh.simulador.bdiSBPE ?? 0.18;
    const itens = empFresh.simulador.itensComplementaresSBPE || [];
    const totalItens = itens.reduce((acc: number, item: any) => acc + (Number(item.valor) || 0), 0);
    const cubEquivalente = cubCfg + (totalItens / mod.area);
    return calcularLaudoCUB(valorLoteEmpreendimento, mod.area, cubEquivalente, bdiCfg).laudoTotal;
  }, [empFresh.simulador.cubSBPE, empFresh.simulador.bdiSBPE, empFresh.simulador.itensComplementaresSBPE, valorLoteEmpreendimento]);

  // ── HELPER: AVALIAÇÃO MCMV (CUB + COMPLEMENTARES) ──
  const getLaudoMCMV = useCallback((mod: Modelo) => {
    const cubCfg = empFresh.simulador.cub;
    if (!cubCfg || !cubCfg.cubVigente) return 0;
    const itens = cubCfg.itensComplementares || [];
    const totalItens = itens.reduce((acc: number, item: any) => acc + (Number(item.valor) || 0), 0);
    return calcularLaudoCUB(valorLoteEmpreendimento, mod.area, cubCfg.cubVigente, cubCfg.bdi, 0, COTA_MAXIMA_CAIXA, totalItens).laudoTotal;
  }, [empFresh.simulador.cub, valorLoteEmpreendimento]);

  // ── Teto efetivo por modelo (MCMV) ──────────────────────────────────────────
  const tetoEfetivo = useMemo(() => {
    if (!modelo || isSBPE) return empFresh.mcmv.tetoImovel;
    const laudoCalc = getLaudoMCMV(modelo);
    if (laudoCalc === 0) return empFresh.mcmv.tetoImovel;
    const faixaPeloLaudo = empFresh.mcmv.faixas.find((f: any) => laudoCalc <= (f.tetoImovel ?? Infinity));
    return faixaPeloLaudo?.tetoImovel ?? empFresh.mcmv.tetoImovel;
  }, [modelo, empFresh.mcmv.faixas, empFresh.mcmv.tetoImovel, isSBPE, getLaudoMCMV]);

  // ─────────────────────────────────────────────────────
  // MOTOR ENTRADA EMBUTIDA E RENDA (SBPE vs MCMV)
  // ─────────────────────────────────────────────────────
  const motorEntrada = useMemo((): EntradaMinimaResult | null => {
    if (!modelo) return null;

    if (isSBPE) {
      const taxaSBPE = empFresh.simulador.taxaSBPE || 11.38;
      const laudoCalculado = getLaudoSBPE(modelo);

      const info = calcularEntradaEmbutidaSBPE(
        modelo.valor,
        0,
        SBPE_COTA_MAXIMA_SAC,
        laudoCalculado
      );

      const sim = simularSBPE({
        valorImovel: modelo.valor,
        entrada: 0,
        prazoMeses: empFresh.simulador.prazoMeses,
        taxaAnual: taxaSBPE,
        rendaFamiliar: rendaFamiliar,
        laudoCalculado: laudoCalculado
      });

      const maxFinRenda = sim.finLiberadoSAC;
      const maxFinCUB = info.cotaCaixa;
      
      const maxFinEfetivo = Math.min(maxFinCUB, maxFinRenda);
      const entradaFinal = Math.max(empFresh.simulador.entradaMin, modelo.valor - maxFinEfetivo);

      let limitador: LimitadorEntrada = "cota_80";
      let detalhe = "Teto SBPE — Máximo 80% (SAC)";

      if (entradaFinal <= empFresh.simulador.entradaMin + 1) {
        limitador = "entrada_min";
        detalhe = `Entrada mínima de R$ ${empFresh.simulador.entradaMin.toLocaleString("pt-BR")} aplicada.`;
      } else if (maxFinRenda >= maxFinCUB) {
        limitador = laudoCalculado > 0 ? "cub" : "cota_80";
        detalhe = laudoCalculado > 0 ? `Laudo Alto Padrão liberou máximo de R$ ${maxFinCUB.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}.` : "Teto SBPE (80%) limitou o financiamento.";
      } else {
        limitador = "renda_30";
        detalhe = `A renda limita o financiamento SBPE a R$ ${maxFinRenda.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} (Trava de 30% na SAC).`;
      }

      const financiamentoPadraoSemCUB = modelo.valor * SBPE_COTA_MAXIMA_SAC;
      const ganhoReal = Math.max(0, maxFinEfetivo - financiamentoPadraoSemCUB);

      return {
        entradaMinima: entradaFinal,
        maxFinanciamento: maxFinEfetivo,
        laudoFinal: info.valorAvaliadoCaixa,
        limitador,
        detalhe,
        maxFinRenda: maxFinRenda,
        maxFinCota80: financiamentoPadraoSemCUB,
        maxFinCUB: maxFinCUB,
        ganhoEntradaEmbutida: ganhoReal, 
        cubCobre: maxFinEfetivo >= (modelo.valor - empFresh.simulador.entradaMin),
        pctFinanciadoSobreVenda: maxFinEfetivo / modelo.valor
      };
    }

    // --- MCMV ---
    const subsidioEfetivo = usarSubsidio ? subsidio : 0;
    const valorVenda = modelo.valor - subsidioEfetivo;

    let maxFinRenda = Infinity;
    if (rendaFamiliar > 0) {
      const sim = simular({
        valorImovel: modelo.valor,
        entrada: 0,
        prazoMeses: empFresh.simulador.prazoMeses,
        taxaAnual: taxaAtual,
        subsidio,
        usarSubsidio,
        rendaFamiliar,
        tetoImovel: tetoEfetivo,  
      });
      maxFinRenda = sim.finLiberadoPRICE;
    }

    const cubCfg = empFresh.simulador.cub;
    const totalItensMCMV = cubCfg?.itensComplementares?.reduce((acc, item) => acc + (Number(item.valor) || 0), 0) || 0;
    
    const maxFinCUB =
      cubCfg && cubCfg.cubVigente > 0
        ? calcularMaxFinCUB(
            valorLoteEmpreendimento,
            modelo.area,
            cubCfg.cubVigente,
            cubCfg.bdi,
            COTA_MAXIMA_CAIXA,
            totalItensMCMV
          )
        : 0;

    return calcularEntradaMinima(
      valorVenda,
      maxFinRenda,
      maxFinCUB,
      empFresh.simulador.entradaMin,
      COTA_MAXIMA_CAIXA,
      tetoEfetivo,
    );
  }, [
    modelo, rendaFamiliar, empFresh.simulador.entradaMin, empFresh.simulador.prazoMeses, 
    empFresh.simulador.cub, empFresh.simulador.taxaSBPE, 
    taxaAtual, subsidio, usarSubsidio, tetoEfetivo, valorLoteEmpreendimento, isSBPE, getLaudoSBPE, getLaudoMCMV
  ]);

  const laudoCUBAtual = useMemo(() => {
    if (!modelo) return 0;
    if (isSBPE) return getLaudoSBPE(modelo);
    return getLaudoMCMV(modelo);
  }, [modelo, isSBPE, getLaudoSBPE, getLaudoMCMV]);

  const minEntradaPermitida = motorEntrada?.entradaMinima ?? empFresh.simulador.entradaMin;

  const faixaEfetiva = useMemo((): FaixaEfetiva | null => {
    if (!modelo || rendaFamiliar <= 0 || isSBPE) return null; 
    const laudoTotal = getLaudoMCMV(modelo);
    const subsidioBase = usarSubsidio ? subsidio : 0;
    return determinarFaixaEfetiva(laudoTotal > 0 ? laudoTotal : null, rendaFamiliar, empFresh.mcmv.faixas, subsidioBase);
  }, [modelo, rendaFamiliar, empFresh.mcmv.faixas, subsidio, usarSubsidio, isSBPE, getLaudoMCMV]);

  useEffect(() => {
    if (isSBPE) return; 
    if (!faixaEfetiva?.faixaEfetiva) return;
    const taxaCorreta = faixaEfetiva.taxaEfetiva;
    if (Math.abs(taxaCorreta - taxaAtual) > 0.001) {
      setTaxaAtual(taxaCorreta);
    }
    if (faixaEfetiva.laudoForcouFaixaSuperior && faixaEfetiva.faixaEfetiva.id > 2) {
      setUsarSubsidio(false);
    }
  }, [faixaEfetiva, isSBPE, taxaAtual]);

  const prevMinEntrada = useRef(minEntradaPermitida);
  useEffect(() => {
    if (prevMinEntrada.current !== minEntradaPermitida) {
      setEntrada(minEntradaPermitida);
      prevMinEntrada.current = minEntradaPermitida;
    } else if (entrada < minEntradaPermitida) {
      setEntrada(minEntradaPermitida);
    }
  }, [minEntradaPermitida, entrada]);

  // ─────────────────────────────────────────────────────
  // SIMULAÇÃO PRINCIPAL (Alterna entre MCMV e SBPE)
  // ─────────────────────────────────────────────────────
  const resultadoSimulacao = useMemo(() => {
    if (!modelo) return null;
    
    if (isSBPE) {
      return simularSBPE({
        valorImovel: modelo.valor,
        entrada,
        prazoMeses: empFresh.simulador.prazoMeses,
        taxaAnual: empFresh.simulador.taxaSBPE || 11.38,
        rendaFamiliar,
        laudoCalculado: getLaudoSBPE(modelo)
      });
    }

    return simular({
      valorImovel: modelo.valor,
      entrada,
      prazoMeses: empFresh.simulador.prazoMeses,
      taxaAnual: taxaAtual,
      subsidio,
      usarSubsidio,
      rendaFamiliar,
      tetoImovel: tetoEfetivo,
    });
  }, [modelo, entrada, empFresh.simulador.prazoMeses, taxaAtual, subsidio, usarSubsidio, rendaFamiliar, tetoEfetivo, empFresh.simulador.taxaSBPE, isSBPE, getLaudoSBPE]);

  // ─────────────────────────────────────────────────────
  // DADOS DA PROPOSTA PDF E API
  // ─────────────────────────────────────────────────────
  const propostaData = useMemo(() => {
    if (!modelo || !resultadoSimulacao) return null;

    const pv = resultadoSimulacao.finLiberadoPRICE;
    const i  = taxaAtual / 100 / 12;
    const amort = pv / empFresh.simulador.prazoMeses;
    const saldoAposAmort = pv - amort;
    
    const sacPrimeiraSobrePrice = isSBPE 
      ? (resultadoSimulacao.parcelaSACPrimeira || 0)
      : (amort + pv * i + saldoAposAmort * 0.000108 + modelo.valor * 0.000071018 + 25);

    const sacAprovadoPDF = rendaFamiliar > 0
      ? sacPrimeiraSobrePrice <= rendaFamiliar * 0.30
      : true; 

    const valorLaudo = isSBPE 
      ? (getLaudoSBPE(modelo) || resultadoSimulacao.laudoPRICE || modelo.valor)
      : (resultadoSimulacao.laudoPRICE || modelo.valor);

    return {
      empreendimento: empFresh.nome,
      cidade: empFresh.cidade,
      estado: empFresh.estado,
      modelo: modelo.nome,
      area: modelo.area,
      quartos: modelo.quartos, 
      valorImovel: modelo.valor,
      valorAvaliacao: valorLaudo, 
      entrada,
      ato: entrada * atoPercent,
      valorFinanciado: resultadoSimulacao.finLiberadoPRICE,
      subsidio: usarSubsidio && !isSBPE ? subsidio : 0,
      taxa: isSBPE ? (empFresh.simulador.taxaSBPE || 11.38) : taxaAtual,
      prazoMeses: empFresh.simulador.prazoMeses,
      parcelaSACPrimeira: sacPrimeiraSobrePrice,
      parcelaSACUltima: resultadoSimulacao.parcelaSACUltima,
      parcelaPRICE: resultadoSimulacao.parcelaPricePrimeira,
      sacAprovadoPDF,
      rendaFamiliar,
      notasLegais: empFresh.textos.notasLegais,
      corretorId: corretorIdUrl, 
      origem: origemUrl,
    };
  }, [modelo, resultadoSimulacao, empFresh, entrada, subsidio, usarSubsidio, taxaAtual, atoPercent, rendaFamiliar, corretorIdUrl, origemUrl, isSBPE, getLaudoSBPE]);

  const getModuloStatus = (modId: string) => {
    if (modId === "renda")     return rendaPreenchida ? "done" : "active";
    if (modId === "simulador") return modelo && entrada >= empFresh.simulador.entradaMin ? "done" : "pending";
    if (modId === "obra")      return resultadoSimulacao && resultadoSimulacao.finLiberadoPRICE > 0 ? "done" : "pending";
    if (modId === "proposta")  return propostaData ? "done" : "pending";
    return "pending";
  };

  const handleCompartilharLocalizacao = async () => {
    const mapsLink = `https://maps.google.com/?q=${empFresh.coordenadas.lat},${empFresh.coordenadas.lng}`;
    
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Localização - ${empFresh.nome}`,
          text: `Confira a localização do empreendimento ${empFresh.nome}:`,
          url: mapsLink,
        });
      } catch (err) {
        console.log("Compartilhamento nativo cancelado ou sem suporte.");
      }
    } else {
      try {
        await navigator.clipboard.writeText(mapsLink);
        setLinkCopiado(true);
        setTimeout(() => setLinkCopiado(false), 2500);
      } catch (err) {
        console.error("Erro ao copiar link:", err);
      }
    }
  };

  const AlertaTrava = () => {
    if (!motorEntrada) return null;
    if (minEntradaPermitida <= empFresh.simulador.entradaMin) return null;
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

          {motorEntrada.limitador === "cota_80" && rendaFamiliar > 0 && (
            <p style={{
              fontSize: 11, color: "rgba(255,255,255,0.45)",
              marginTop: 8, paddingTop: 8,
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}>
              💡 A renda de {formatBRL(rendaFamiliar)} está confortável — suportaria até{" "}
              {formatBRL(motorEntrada.maxFinRenda)} de financiamento (
              {((motorEntrada.maxFinRenda / (rendaFamiliar * 12)) * 100).toFixed(0)}×
              renda anual). O limitador foi o teto da cota de financiamento.
            </p>
          )}

          {motorEntrada.limitador === "cub" && (
            <p style={{
              fontSize: 11, color: "rgba(255,255,255,0.45)",
              marginTop: 8, paddingTop: 8,
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}>
              📐 Laudo CUB cobre {formatBRL(motorEntrada.maxFinCUB)} ({isSBPE ? '80%' : '80%'} do laudo).
              Para cobrir 100% atualize o CUB e itens complementares no painel admin ou revise o BDI.
            </p>
          )}
        </div>
      </div>
    );
  };

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", minWidth: 0 }}>
      <div style={{ padding: "16px 12px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
        <Link href="/" className="btn-ghost flex items-center gap-2 text-sm mb-5 px-0 py-1 w-fit" style={{ color: "var(--gray-mid)" }}>
          <ChevronLeft size={15} /> Voltar à lista
        </Link>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex-center shrink-0 mt-0.5" style={{ background: "var(--terracota-glow)", border: "1px solid var(--border-active)" }}>
            <Home size={15} color="var(--terracota)" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight" style={{ color: "var(--gray-light)" }}>{empFresh.nome}</p>
            <p className="text-xs flex items-center gap-1 mt-1" style={{ color: "var(--gray-mid)" }}>
              <MapPin size={10} /> {empFresh.cidade} · {empFresh.estado}
            </p>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto", minHeight: 0 }}>
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
                  padding: "9px 10px", borderRadius: "10px",
                  border: isActive ? "1px solid var(--border-active)" : "1px solid transparent",
                  background: isActive ? "var(--terracota-glow)" : "transparent",
                  cursor: "pointer", transition: "all 150ms ease",
                  textAlign: "left", width: "100%",
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isActive ? "var(--terracota)" : "rgba(0,0,0,0.3)",
                  flexShrink: 0, transition: "all 150ms ease",
                }}>
                  {status === "done" && !isActive
                    ? <CheckCircle2 size={15} color="#4ade80" />
                    : <Icon size={15} color={isActive ? "white" : "var(--gray-mid)"} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 11, color: isActive ? "var(--terracota-light)" : "var(--gray-light)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {mod.label}
                  </p>
                  <p style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {mod.hint}
                  </p>
                </div>
                {isActive && <ChevronRight size={13} color="var(--terracota)" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      </nav>

      {(corretorIdUrl || origemUrl !== 'organico') && (
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.15)" }}>
           <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
             <Share2 size={12} color="var(--terracota)" />
             <span style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Rastreamento Ativo</span>
           </div>
           {origemUrl !== 'organico' && <p style={{ fontSize: 10, color: "var(--gray-dark)", marginTop: 4, marginLeft: 20 }}>Origem: {origemUrl.replace(/_/g, " ")}</p>}
        </div>
      )}

      <div style={{ padding: "10px 8px 14px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        {modelo && (
          <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)" }}>
            <p style={{ fontSize: 11, color: "var(--gray-mid)", marginBottom: 4 }}>Modelo ativo</p>
            <p style={{ fontWeight: 700, fontSize: 13, color: "var(--terracota)" }}>{modelo.nome}</p>
            <p style={{ fontSize: 11, color: "var(--gray-mid)", marginTop: 2 }}>{modelo.area}m² · {formatBRL(modelo.valor)}</p>
            {subsidio > 0 && usarSubsidio && !isSBPE && (
              <p style={{ fontSize: 11, color: "#4ade80", marginTop: 4 }}>Subsídio: {formatBRL(subsidio)}</p>
            )}
            {isSBPE && (
              <p style={{ fontSize: 11, color: "#60a5fa", marginTop: 4 }}>Linha SBPE Ativa</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-base)" }}>

      <aside className="hidden lg:flex flex-col sticky top-0 h-screen" style={{ width: 200, minWidth: 200, background: "rgba(15,30,22,0.98)", backdropFilter: "blur(20px)", borderRight: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 lg:hidden" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />
            <motion.aside className="fixed left-0 top-0 bottom-0 z-50 flex flex-col lg:hidden" style={{ width: 288, background: "rgba(15,30,22,0.99)", backdropFilter: "blur(20px)", borderRight: "1px solid var(--border-subtle)", overflow: "hidden" }} initial={{ x: -288 }} animate={{ x: 0 }} exit={{ x: -288 }} transition={{ type: "spring", damping: 28, stiffness: 320 }}>
              <div className="flex items-center justify-between" style={{ padding: "16px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
                <Image src="/logo.png" alt="Habiticon" width={280} height={80} style={{ height: 44, width: "auto" }} />
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

        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between" style={{ padding: "12px 20px", background: "rgba(15,30,22,0.97)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border-subtle)" }}>
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost" style={{ padding: "8px" }}><Menu size={20} /></button>
          <Image src="/logo.png" alt="Habiticon" width={280} height={80} style={{ height: 44, width: "auto" }} />
          <div className="badge badge-info" style={{ fontSize: 11 }}>{MODULOS.find((m) => m.id === moduloAtivo)?.shortLabel}</div>
        </header>

        <div className="hidden lg:flex items-center gap-3" style={{ padding: "16px 40px", borderBottom: "1px solid var(--border-subtle)" }}>
          <Image src="/logo.png" alt="Habiticon" width={280} height={80} style={{ height: 56, width: "auto" }} loading="eager" priority />
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

        <main style={{ flex: 1, padding: "clamp(20px,4vw,40px) clamp(16px,4vw,40px) 60px", overflowY: "auto" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <AnimatePresence mode="wait">

              {/* RENDA */}
              {moduloAtivo === "renda" && (
                <motion.div key="renda" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                  <div>
                    <h2 className="text-title" style={{ marginBottom: 10 }}>Renda & Subsídio MCMV</h2>
                    <p className="text-body">Comece informando a renda bruta familiar. O sistema identifica o enquadramento no programa MCMV ou a transição para SBPE.</p>
                  </div>
                  <div className="glass-card-nohover" style={{ padding: 48 }}>
                    <SubsidioGauge
                      faixas={empFresh.mcmv.faixas}
                      onSubsidioChange={handleSubsidioChange}
                      initialRenda={rendaFamiliar}
                      valorImovel={modelo?.valor || 0}
                      tetoMcmv={empFresh.mcmv.tetoImovel}
                    />
                  </div>
                  {rendaPreenchida && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <button onClick={() => setModuloAtivo("simulador")} className="btn-primary w-full" style={{ padding: "clamp(14px,3vw,16px) 24px", fontSize: 15 }}>
                        Ir para o Simulador <ChevronRight size={18} />
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* SIMULADOR */}
              {moduloAtivo === "simulador" && (
                <motion.div key="simulador" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <h2 className="text-title" style={{ marginBottom: 0 }}>Motor de Vendas 50/50</h2>
                    {isSBPE ? (
                      <span style={{ background: "#3b82f6", color: "white", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, letterSpacing: "0.05em" }}>LINHA SBPE</span>
                    ) : (
                      <span style={{ background: "#16a34a", color: "white", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, letterSpacing: "0.05em" }}>LINHA MCMV</span>
                    )}
                  </div>
                  <p className="text-body" style={{ marginTop: -30 }}>
                    Selecione o modelo e ajuste a entrada.
                    {isSBPE 
                       ? " Cliente enquadrado no SBPE por ultrapassar os limites do MCMV."
                       : (subsidio > 0 ? ` O subsídio e a taxa de ${taxaAtual}% já estão mapeados.` : " Configure a renda no passo anterior para calcular o subsídio.")}
                  </p>

                  {/* Toggle subsídio */}
                  {subsidio > 0 && !isSBPE && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{
                        borderRadius: 16,
                        border: `1px solid ${usarSubsidio ? "rgba(74,222,128,0.25)" : "rgba(251,146,60,0.25)"}`,
                        background: usarSubsidio ? "rgba(74,222,128,0.04)" : "rgba(251,146,60,0.04)",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between", gap: 20,
                        padding: "20px 24px",
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <h4 style={{ fontWeight: 700, color: "var(--gray-light)", fontSize: 15, lineHeight: 1.3 }}>
                            Aplicar Subsídio MCMV de {formatBRL(subsidio)}?
                          </h4>
                          <p style={{ fontSize: 12, color: "var(--gray-mid)", lineHeight: 1.5 }}>
                            A Caixa pode zerar o subsídio para compradores solteiros e sem dependentes.
                          </p>
                        </div>
                        <button
                          onClick={() => setUsarSubsidio(!usarSubsidio)}
                          style={{
                            flexShrink: 0,
                            padding: "10px 20px", borderRadius: 10,
                            fontWeight: 800, fontSize: 13, letterSpacing: "0.05em",
                            transition: "all 0.2s", cursor: "pointer",
                            background: usarSubsidio ? "#4ade80" : "rgba(255,255,255,0.08)",
                            color: usarSubsidio ? "#052e16" : "var(--gray-mid)",
                            border: usarSubsidio ? "none" : "1px solid var(--border-subtle)",
                          }}
                        >
                          {usarSubsidio ? "LIGADO" : "DESLIGADO"}
                        </button>
                      </div>

                      <div style={{
                        padding: "12px 24px",
                        borderTop: `1px solid ${usarSubsidio ? "rgba(74,222,128,0.15)" : "rgba(251,146,60,0.15)"}`,
                        background: usarSubsidio ? "rgba(74,222,128,0.06)" : "rgba(251,146,60,0.06)",
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        {usarSubsidio ? (
                          <>
                            <CheckCircle2 size={14} color="#4ade80" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>
                              Subsídio descontado do saldo a financiar · Taxa de {taxaAtual}% a.a.
                            </span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>⚠️</span>
                            <span style={{ fontSize: 12, color: "#fb923c", fontWeight: 600 }}>
                              Simulando sem subsídio — pior cenário para o comprador.
                            </span>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* ★ CARD DE BLOQUEIO MCMV */}
                  {!isSBPE && faixaEfetiva && !faixaEfetiva.aprovado && faixaEfetiva.bloqueio && (
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

                  {/* ★ CARD INFORMATIVO MCMV */}
                  {!isSBPE && faixaEfetiva?.aprovado && faixaEfetiva.laudoForcouFaixaSuperior && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)", display: "flex", gap: 12, alignItems: "flex-start" }}
                    >
                      <AlertTriangle size={15} color="#fb923c" style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 12, color: "#fed7aa", lineHeight: 1.6 }}>
                        <strong>Atenção:</strong> O laudo CUB deste modelo (R$ {Math.round(calcularLaudoCUB(valorLoteEmpreendimento, modelo.area, empFresh.simulador.cub!.cubVigente, empFresh.simulador.cub!.bdi).laudoTotal).toLocaleString("pt-BR")}) ultrapassa o teto da Faixa 2 (R$ {faixaEfetiva.faixaPeloLaudo?.tetoImovel?.toLocaleString("pt-BR")}). O financiamento foi enquadrado automaticamente na{" "}
                        <strong>{faixaEfetiva.faixaEfetiva?.nome}</strong> — sem subsídio, taxa {faixaEfetiva.taxaEfetiva}% a.a.
                      </p>
                    </motion.div>
                  )}

                  {/* Alerta Opcional Personalizado SBPE */}
                  {isSBPE && empFresh.textos.alertaSBPE && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", display: "flex", gap: 12, alignItems: "flex-start" }}
                    >
                      <Info size={15} color="#60a5fa" style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 12, color: "#93c5fd", lineHeight: 1.6 }}>
                        {empFresh.textos.alertaSBPE}
                      </p>
                    </motion.div>
                  )}

                  <div className="glass-card-nohover">
                    <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 20 }}>
                      Escolha o Modelo
                    </h3>
                    <ModelSelector modelos={empFresh.modelos} selected={modeloSelecionado} onSelect={setModeloSelecionado} />
                  </div>

                  {modelo && (
                    <div className="glass-card-nohover">
                      <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 20 }}>
                        Defina a Entrada Total
                      </h3>

                      <AlertaTrava />

                      {/* ★ CARD DIAGNÓSTICO — entrada embutida CUB */}
                      {motorEntrada && ((!isSBPE && empFresh.simulador.cub && empFresh.simulador.cub.cubVigente > 0) || (isSBPE && empFresh.simulador.cubSBPE !== undefined && empFresh.simulador.cubSBPE > 0)) && (() => {
                        const { cubCobre, ganhoEntradaEmbutida, pctFinanciadoSobreVenda, maxFinCUB, entradaMinima, maxFinRenda, maxFinCota80 } = motorEntrada;
                        const pct = (pctFinanciadoSobreVenda * 100).toFixed(1);
                        
                        // Nova Lógica Inteligente para Cores e Status
                        const laudoPotencialCobre = maxFinCUB >= (modelo.valor - empFresh.simulador.entradaMin);
                        const aRendaEsmagou = maxFinRenda < maxFinCUB && maxFinRenda < maxFinCota80;
                        
                        let cor = "#f87171"; // Vermelho
                        let status = "⚠️ Laudo insuficiente";
                        
                        if (ganhoEntradaEmbutida > 0) {
                          cor = cubCobre ? "#4ade80" : "#facc15"; // Verde ou Amarelo
                          status = cubCobre ? "✅ Entrada embutida: FUNCIONA" : "⚡ Parcialmente coberta";
                        } else if (aRendaEsmagou && laudoPotencialCobre) {
                          cor = "#ef4444"; // Vermelho
                          status = "⛔ A Renda bloqueou a Estratégia";
                        } else if (aRendaEsmagou && !laudoPotencialCobre) {
                          cor = "#ef4444"; // Vermelho
                          status = "⛔ Renda e Laudo insuficientes";
                        }

                        const bdi = isSBPE ? (empFresh.simulador.bdiSBPE || 0.18) : (empFresh.simulador.cub?.bdi ?? 0.18);
                        const cotaMax = isSBPE ? SBPE_COTA_MAXIMA_SAC : COTA_MAXIMA_CAIXA;

                        return (
                          <div style={{ marginBottom: 20, padding: "16px 18px", borderRadius: 10, background: `${cor}10`, border: `1px solid ${cor}30` }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: cor, marginBottom: 10 }}>{status}</p>
                            
                            {aRendaEsmagou && ganhoEntradaEmbutida === 0 && (
                              <p style={{ fontSize: 11, color: "var(--gray-mid)", marginBottom: 14, lineHeight: 1.5 }}>
                                O laudo de avaliação permitia até <strong>{formatBRL(maxFinCUB)}</strong> de financiamento, mas a renda do cliente limitou a liberação.
                              </p>
                            )}

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 10 }}>
                              <div>
                                <p style={{ fontSize: 10, color: "var(--gray-dark)", marginBottom: 4 }}>Laudo cobre</p>
                                <p style={{ fontSize: 16, fontWeight: 800, color: cor }}>{pct}%</p>
                                <p style={{ fontSize: 10, color: "var(--gray-dark)" }}>do imóvel</p>
                              </div>
                              <div>
                                <p style={{ fontSize: 10, color: "var(--gray-dark)", marginBottom: 4 }}>Ganho da estratégia</p>
                                <p style={{ fontSize: 16, fontWeight: 800, color: ganhoEntradaEmbutida > 0 ? "#4ade80" : "var(--gray-mid)" }}>{formatBRL(ganhoEntradaEmbutida)}</p>
                                <p style={{ fontSize: 10, color: "var(--gray-dark)" }}>vs limite padrão</p>
                              </div>
                              <div>
                                <p style={{ fontSize: 10, color: "var(--gray-dark)", marginBottom: 4 }}>Entrada mín real</p>
                                <p style={{ fontSize: 16, fontWeight: 800, color: "var(--gray-light)" }}>{formatBRL(entradaMinima)}</p>
                                <p style={{ fontSize: 10, color: "var(--gray-dark)" }}>pelo laudo</p>
                              </div>
                            </div>
                            {!laudoPotencialCobre && (
                              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                                📐 Para embutir 100% da entrada (mín R$10k), o CUB equivalente precisaria ser ≥ R${
                                  Math.ceil(((modelo.valor - empFresh.simulador.entradaMin) / cotaMax - valorLoteEmpreendimento) / (modelo.area * (1 + bdi))).toLocaleString("pt-BR")
                                }/m²
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      <EntradaSlider
                        value={entrada}
                        min={minEntradaPermitida}
                        max={empFresh.simulador.entradaMax}
                        onChange={setEntrada}
                      />
                    </div>
                  )}

                  {/* Cards resultado */}
                  {modelo && resultadoSimulacao && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gray-mid)" }}>
                          Composição da Entrada
                        </h3>
                        <ResultCards
                          valorImovel={modelo.valor}
                          entrada={entrada}
                          subsidio={usarSubsidio && !isSBPE ? subsidio : 0}
                          atoPercent={atoPercent}
                          onAtoPercentChange={setAtoPercent}
                          laudoCUB={laudoCUBAtual}
                        />

                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gray-mid)" }}>
                          Simulador de Financiamento
                        </h3>
                        {resultadoSimulacao.finLiberadoPRICE > 0 ? (
                          <ComparadorSacPrice
                            resultadoSimulacao={resultadoSimulacao}
                            taxaAnual={isSBPE ? (empFresh.simulador.taxaSBPE || 11.38) : taxaAtual}
                            prazoMeses={empFresh.simulador.prazoMeses}
                            rendaFamiliar={rendaFamiliar}
                            isSBPE={isSBPE}
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
                      Simulação para {empFresh.cidade}-{empFresh.estado} com taxa nominal de{" "}
                      <strong style={{ color: "var(--gray-mid)" }}>{isSBPE ? (empFresh.simulador.taxaSBPE || 11.38) : taxaAtual}% a.a.</strong> e prazo de{" "}
                      {empFresh.simulador.prazoMeses} meses.{" "}
                      <strong>Os seguros obrigatórios (DFI/MIP) e taxas administrativas já estão embutidos no cálculo das parcelas.</strong>{" "}
                      O Laudo de Avaliação exibido é uma estimativa inteligente para viabilizar o financiamento.
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
                        taxaAnual={isSBPE ? (empFresh.simulador.taxaSBPE || 11.38) : taxaAtual}
                        etapasObra={empFresh.simulador.etapasObra} // <- A variável NOVA E DINÂMICA
                        titulo={empFresh.textos.tituloObra}
                        descricao={empFresh.textos.descricaoObra}
                        valorLote={valorLoteEmpreendimento}
                        parcelaSAC={propostaData?.parcelaSACPrimeira ?? 0}
                        parcelaPRICE={propostaData?.parcelaPRICE ?? resultadoSimulacao.parcelaPricePrimeira}
                        sacAprovado={propostaData?.sacAprovadoPDF ?? true}
                      />
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 220, borderRadius: 16, border: "1px dashed var(--border-subtle)", background: "rgba(0,0,0,0.15)", gap: 16 }}>
                      <p className="text-muted">Complete o Simulador primeiro</p>
                      <button onClick={() => setModuloAtivo("simulador")} className="btn-secondary">Ir ao Simulador</button>
                    </div>
                  )}
                  {resultadoSimulacao && resultadoSimulacao.finLiberadoPRICE > 0 && (
                    <button onClick={() => setModuloAtivo("proposta")} className="btn-primary w-full" style={{ padding: "clamp(14px,3vw,16px) 24px", fontSize: 15 }}>
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
                            ["Empreendimento",                       empFresh.nome],
                            ["Modelo sugerido",                      `${modelo?.nome} · ${modelo?.area}m²`],
                            ["Valor do Contrato",                    formatBRL(modelo?.valor || 0)],
                            ["Valor de Avaliação Estimado (Laudo)",  formatBRL(propostaData.valorAvaliacao || 0)], 
                            ["Valor do Lote",                        formatBRL(valorLoteEmpreendimento)],
                            ["Entrada Real Exigida",                 formatBRL(entrada)],
                            ["  ↳ Ato mínimo no contrato",           formatBRL(entrada * atoPercent)],
                            ["  ↳ Restante a parcelar",              formatBRL(entrada - entrada * atoPercent)],
                            ...(subsidio > 0 && usarSubsidio && !isSBPE
                              ? [["Subsídio MCMV aplicado", formatBRL(subsidio)]]
                              : []),
                            [isSBPE ? "Financiamento Aprovado (SBPE)" : "Financiamento Aprovado (80% do Laudo)", formatBRL(resultadoSimulacao?.finLiberadoPRICE || 0)],
                            ["Taxa de juros anual",                  `${isSBPE ? (empFresh.simulador.taxaSBPE || 11.38) : taxaAtual}% a.a.`],
                            ["Prazo selecionado",                    `${empFresh.simulador.prazoMeses} meses (${empFresh.simulador.prazoMeses / 12} anos)`],
                            ...(propostaData?.sacAprovadoPDF !== false ? [
                              ["Parcela SAC (1ª)", formatBRL(propostaData?.parcelaSACPrimeira || 0)],
                            ] : [
                              ["Parcela SAC (1ª)", "⛔ Não aprovado (excede limite de renda)"],
                            ]),
                            ["Parcela PRICE (Fixa)",                 formatBRL(resultadoSimulacao?.parcelaPricePrimeira || 0)],
                          ].map(([k, v]) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
                              <span style={{ fontSize: 13, color: k.startsWith("  ") ? "var(--gray-dark)" : k.includes("Laudo") ? "var(--terracota)" : "var(--gray-mid)" }}>
                                {k.trim()}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: k.includes("MCMV") || k.includes("SBPE") || k.includes("Parcela") || k.includes("Aprovado") ? "var(--terracota-light)" : "var(--gray-light)" }}>
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
                    <p className="text-body">Fotos da fachada, ambientes e localização no mapa.</p>
                  </div>

                  {/* Galeria com ambientes, carrossel e zoom */}
                  {(empFresh.vitrine.imagens.length > 0 ||
                    empFresh.vitrine.plantas.length > 0 ||
                    Object.values(empFresh.vitrine.ambientes ?? {}).some(a => a.ativo && a.fotos?.length > 0)
                  ) ? (
                    <div className="glass-card-nohover">
                      <GaleriaVitrine
                        imagens={empFresh.vitrine.imagens}
                        plantas={empFresh.vitrine.plantas}
                        ambientes={empFresh.vitrine.ambientes}
                      />
                    </div>
                  ) : (
                    <div style={{ padding: "40px 20px", borderRadius: 16, textAlign: "center", background: "rgba(0,0,0,0.15)", border: "1px dashed var(--border-subtle)" }}>
                      <p style={{ fontSize: 14, color: "var(--gray-dark)" }}>Nenhuma foto disponível ainda.</p>
                    </div>
                  )}

                  {/* Documentos para Download */}
                    {(empFresh.vitrine.apresentacoes || []).length > 0 && (
                      <div className="glass-card-nohover">
                        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)", marginBottom: 16 }}>
                          📄 Documentos para Download
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {(empFresh.vitrine.apresentacoes || []).map((pdf, i) => (
                            <a key={i} href={pdf.url} target="_blank" rel="noopener noreferrer"
                              style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px", borderRadius:12,
                                background:"var(--terracota-glow)", border:"1px solid var(--border-active)", textDecoration:"none" }}>
                              <FileText size={20} color="var(--terracota)" style={{ flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--terracota-light)" }}>
                                  {pdf.titulo || "Apresentação"}
                                </p>
                                <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 2 }}>PDF · Clique para abrir</p>
                              </div>
                              <span style={{ fontSize: 12, color: "var(--terracota)", fontWeight: 700, flexShrink: 0 }}>↓ Baixar</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Mapa + Novo botão de Compartilhar Localização */}
                  {empFresh.coordenadas?.lat && empFresh.coordenadas?.lng && (
                    <div className="glass-card-nohover">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-mid)" }}>
                          Localização — {empFresh.cidade}, {empFresh.estado}
                        </h3>
                        
                        <button
                          onClick={handleCompartilharLocalizacao}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                            background: linkCopiado ? "rgba(74,222,128,0.15)" : "var(--terracota-glow)",
                            border: `1px solid ${linkCopiado ? "rgba(74,222,128,0.3)" : "var(--border-active)"}`,
                            color: linkCopiado ? "#4ade80" : "var(--terracota-light)",
                            fontSize: 12, fontWeight: 700, transition: "0.2s"
                          }}
                        >
                          {linkCopiado ? <Check size={14} /> : <Share2 size={14} />}
                          {linkCopiado ? "Link Copiado!" : "Compartilhar Localização"}
                        </button>
                      </div>

                      <div style={{ borderRadius: 12, overflow: "hidden", height: "clamp(220px, 40vw, 340px)" }}>
                        <iframe
                          src={`https://maps.google.com/maps?q=${empFresh.coordenadas.lat},${empFresh.coordenadas.lng}&z=15&output=embed`}
                          width="100%" height="100%" style={{ border: 0 }}
                          loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                          title={`Mapa ${empFresh.cidade}`}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}