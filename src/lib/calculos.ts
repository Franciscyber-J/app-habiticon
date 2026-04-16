// ===================================================
// MÓDULO DE CÁLCULOS FINANCEIROS — Motor de Vendas Habiticon (Padrão CAIXA + Motor de Aprovação)
// ===================================================

export interface SimulacaoInput {
  valorImovel: number;
  entrada: number;
  prazoMeses: number;
  taxaAnual: number; // taxa nominal anual (ex: 8.16 para 8,16% a.a.)
  subsidio?: number;
  usarSubsidio?: boolean; // Controle de liga/desliga
  rendaFamiliar?: number; // Usado pelo novo motor de aprovação
  tetoImovel?: number;    // Usado pelo novo motor de aprovação
}

export interface Parcela {
  mes: number;
  amortizacao: number;
  juros: number;
  segurosETaxas: number; // MIP + DFI + TxAdm
  parcela: number; // Total pago no mês
  saldoDevedor: number;
}

export interface ResultadoSimulacao {
  valorFinanciado: number;
  taxaMensal: number;
  parcelaPricePrimeira: number;
  parcelaSACPrimeira: number;
  parcelaSACUltima: number;
  totalPagoPrice: number;
  totalPagoSAC: number;
  tabelaSAC: Parcela[];
  tabelaPRICE: Parcela[];
  // Dados do Motor de Aprovação
  entradaMinimaPRICE: number;
  entradaMinimaSAC: number;
  finLiberadoPRICE: number;
  finLiberadoSAC: number;
  laudoPRICE: number;
  laudoSAC: number;
}

// ===================================================
// TAXAS OBRIGATÓRIAS CAIXA (Cálculo Fiel)
// Extraídas matematicamente do simulador oficial
// ===================================================
export const CAIXA_TAXA_ADM = 25.00;
export const CAIXA_FATOR_DFI = 0.000071018; // ~0,0071% a.m. sobre o Valor do Imóvel
export const CAIXA_FATOR_MIP = 0.000107676; // ~0,01076% a.m. sobre o Saldo Devedor

export const C6_MDR = 0.0214;
export const C6_ADICIONAL_PARCELA = 0.0325;
export const C6_FATOR = 1 / (1 - C6_MDR - C6_ADICIONAL_PARCELA);

export const TAXA_BOLETO_MENSAL = 1.99;
export const PRAZO_PADRAO_MESES = 360;
export const COMPROMETIMENTO_MAX_RENDA = 0.30;
export const COTA_MAXIMA_CAIXA = 0.80;

export function taxaNominalAnualParaMensal(taxaNominalAnual: number): number {
  return taxaNominalAnual / 100 / 12;
}

export function taxaAnualParaMensal(taxaAnual: number): number {
  return taxaNominalAnualParaMensal(taxaAnual);
}

/**
 * Gera a tabela PRICE completa incluindo seguros Caixa
 */
export function gerarTabelaPRICE(
  valorFinanciado: number,
  valorLaudo: number,
  taxaMensal: number,
  prazoMeses: number
): Parcela[] {
  const tabela: Parcela[] = [];
  if (valorFinanciado <= 0) return tabela;

  const dfi = valorLaudo * CAIXA_FATOR_DFI;
  const fator = Math.pow(1 + taxaMensal, prazoMeses);
  const pmtPura = valorFinanciado * (taxaMensal * fator) / (fator - 1); // Amortização + Juros fixa

  let saldo = valorFinanciado;

  for (let mes = 1; mes <= prazoMeses; mes++) {
    const juros = saldo * taxaMensal;
    const amortizacao = pmtPura - juros;
    const mip = saldo * CAIXA_FATOR_MIP;
    const segurosETaxas = mip + dfi + CAIXA_TAXA_ADM;
    const parcelaTotal = pmtPura + segurosETaxas;

    saldo -= amortizacao;

    tabela.push({
      mes,
      amortizacao,
      juros,
      segurosETaxas,
      parcela: parcelaTotal,
      saldoDevedor: Math.max(0, saldo),
    });
  }
  return tabela;
}

/**
 * Gera a tabela SAC completa incluindo seguros Caixa
 */
export function gerarTabelaSAC(
  valorFinanciado: number,
  valorLaudo: number,
  taxaMensal: number,
  prazoMeses: number
): Parcela[] {
  const tabela: Parcela[] = [];
  if (valorFinanciado <= 0) return tabela;

  const amortizacaoConstante = valorFinanciado / prazoMeses;
  const dfi = valorLaudo * CAIXA_FATOR_DFI;
  let saldo = valorFinanciado;

  for (let mes = 1; mes <= prazoMeses; mes++) {
    const juros = saldo * taxaMensal;
    const mip = saldo * CAIXA_FATOR_MIP;
    const segurosETaxas = mip + dfi + CAIXA_TAXA_ADM;
    const parcelaTotal = amortizacaoConstante + juros + segurosETaxas;

    saldo -= amortizacaoConstante;

    tabela.push({
      mes,
      amortizacao: amortizacaoConstante,
      juros,
      segurosETaxas,
      parcela: parcelaTotal,
      saldoDevedor: Math.max(0, saldo),
    });
  }
  return tabela;
}

/**
 * Simulação completa SAC + PRICE (Padrão Caixa com Motor de Engenharia Reversa)
 */
export function simular(input: SimulacaoInput): ResultadoSimulacao {
  const subsidioEfetivo = input.usarSubsidio !== false ? (input.subsidio || 0) : 0;
  const taxaMensal = taxaAnualParaMensal(input.taxaAnual);
  const rendaFam = input.rendaFamiliar || 0;
  const tetoMCMV = input.tetoImovel || 275000;

  // O Máximo que o cliente pode pagar de parcela (Trava 30%)
  const tetoParcela = rendaFam > 0 ? rendaFam * COMPROMETIMENTO_MAX_RENDA : Infinity;

  // O financiamento que a Habiticon deseja aprovar com a entrada fornecida
  const financiamentoDesejado = Math.max(0, input.valorImovel - input.entrada - subsidioEfetivo);

  // Fator Matemático DFI (DFI é cobrado sobre o laudo, e laudo = fin/0.8)
  const fatorDfiImplicito = CAIXA_FATOR_DFI / COTA_MAXIMA_CAIXA;

  // --- MOTOR DE ENGENHARIA REVERSA ---
  
  // Limites da SAC
  const fatorSAC = (1 / input.prazoMeses) + taxaMensal + CAIXA_FATOR_MIP + fatorDfiImplicito;
  const maxFinSAC = (tetoParcela - CAIXA_TAXA_ADM) / fatorSAC;

  // Limites da PRICE
  const fPrice = Math.pow(1 + taxaMensal, input.prazoMeses);
  const amortizacaoJurosPrice = (taxaMensal * fPrice) / (fPrice - 1);
  const fatorPRICE = amortizacaoJurosPrice + CAIXA_FATOR_MIP + fatorDfiImplicito;
  const maxFinPRICE = (tetoParcela - CAIXA_TAXA_ADM) / fatorPRICE;

  // --- AVALIAÇÃO MAJORADA AUTOMÁTICA ---
  
  // Cenário PRICE
  let finLiberadoPRICE = Math.min(financiamentoDesejado, maxFinPRICE);
  let laudoPRICE = finLiberadoPRICE / COTA_MAXIMA_CAIXA;
  if (laudoPRICE > tetoMCMV) {
    laudoPRICE = tetoMCMV;
    finLiberadoPRICE = Math.min(finLiberadoPRICE, laudoPRICE * COTA_MAXIMA_CAIXA);
  }
  const entradaMinimaPRICE = Math.max(0, input.valorImovel - finLiberadoPRICE - subsidioEfetivo);

  // Cenário SAC
  let finLiberadoSAC = Math.min(financiamentoDesejado, maxFinSAC);
  let laudoSAC = finLiberadoSAC / COTA_MAXIMA_CAIXA;
  if (laudoSAC > tetoMCMV) {
    laudoSAC = tetoMCMV;
    finLiberadoSAC = Math.min(finLiberadoSAC, laudoSAC * COTA_MAXIMA_CAIXA);
  }
  const entradaMinimaSAC = Math.max(0, input.valorImovel - finLiberadoSAC - subsidioEfetivo);

  // Gera as Tabelas com base no financiamento Liberado REAL (Trava de Renda Aplicada)
  const tabelaPRICE = gerarTabelaPRICE(finLiberadoPRICE, laudoPRICE, taxaMensal, input.prazoMeses);
  const tabelaSAC = gerarTabelaSAC(finLiberadoSAC, laudoSAC, taxaMensal, input.prazoMeses);

  return {
    valorFinanciado: finLiberadoPRICE, // Usa PRICE como referencial de capacidade padrão
    taxaMensal,
    parcelaPricePrimeira: tabelaPRICE[0]?.parcela || 0,
    parcelaSACPrimeira: tabelaSAC[0]?.parcela || 0,
    parcelaSACUltima: tabelaSAC[tabelaSAC.length - 1]?.parcela || 0,
    totalPagoPrice: tabelaPRICE.reduce((acc, p) => acc + p.parcela, 0),
    totalPagoSAC: tabelaSAC.reduce((acc, p) => acc + p.parcela, 0),
    tabelaSAC,
    tabelaPRICE,
    entradaMinimaPRICE,
    entradaMinimaSAC,
    finLiberadoPRICE,
    finLiberadoSAC,
    laudoPRICE,
    laudoSAC
  };
}

// ===================================================
// MOTOR DE CAPACIDADE DE RENDA REVERSO (CAIXA)
// ===================================================
export interface CapacidadeRenda {
  rendaMinimaPrice: number;
  rendaMinimaSAC: number;
  status: "aprovado" | "margem" | "insuficiente" | "nao_informada";
  comprometimentoAtual: number;
  parcelaPRICE: number;
  parcelaSAC1a: number;
}

export function calcularCapacidadeRenda(
  parcelaPRICE: number,
  parcelaSAC1a: number,
  rendaFamiliar: number,
  comprometimentoMax = COMPROMETIMENTO_MAX_RENDA
): CapacidadeRenda {
  const rendaMinimaPrice = parcelaPRICE / comprometimentoMax;
  const rendaMinimaSAC = parcelaSAC1a / comprometimentoMax;

  let status: CapacidadeRenda["status"] = "nao_informada";
  let comprometimentoAtual = 0;

  if (rendaFamiliar > 0) {
    comprometimentoAtual = parcelaPRICE / rendaFamiliar;
    if (rendaFamiliar >= rendaMinimaSAC) {
      status = "aprovado";
    } else if (rendaFamiliar >= rendaMinimaPrice) {
      status = "margem";
    } else {
      status = "insuficiente";
    }
  }

  return {
    rendaMinimaPrice,
    rendaMinimaSAC,
    status,
    comprometimentoAtual,
    parcelaPRICE,
    parcelaSAC1a,
  };
}

// ===================================================
// ENTRADA EMBUTIDA
// ===================================================
export interface EntradaEmbutidaInfo {
  valorContratual: number;
  valorAvaliadoCaixa: number;
  entradaCaixa: number;
  entradaRealComprador: number;
  entradaEmbutida: number;
  cotaCaixa: number;
}

export function calcularEntradaEmbutida(
  valorContratual: number,
  entradaRealComprador: number,
  subsidio = 0,
  cotaMaxima = COTA_MAXIMA_CAIXA
): EntradaEmbutidaInfo {
  const valorFinanciadoCaixa = Math.max(0, valorContratual - entradaRealComprador - subsidio);
  const valorAvaliadoCaixa = valorFinanciadoCaixa / cotaMaxima;
  const entradaCaixa = valorAvaliadoCaixa * (1 - cotaMaxima);
  const entradaEmbutida = Math.max(0, entradaCaixa - entradaRealComprador);

  return {
    valorContratual,
    valorAvaliadoCaixa,
    entradaCaixa,
    entradaRealComprador,
    entradaEmbutida,
    cotaCaixa: valorFinanciadoCaixa,
  };
}

// ===================================================
// PARCELAMENTOS E JUROS DE OBRA
// ===================================================
export function parcelamentoCartao(valor: number, parcelas = 5) {
  const totalComJuros = valor * C6_FATOR;
  return { parcelaComJuros: totalComJuros / parcelas, totalComJuros, totalJuros: totalComJuros - valor };
}

export function parcelamentoBoleto(valor: number, parcelas = 5, taxaMensalPct = TAXA_BOLETO_MENSAL) {
  const i = taxaMensalPct / 100;
  const fator = Math.pow(1 + i, parcelas);
  const parcelaPorParcela = valor * (i * fator) / (fator - 1);
  const totalComJuros = parcelaPorParcela * parcelas;
  return { parcelaPorParcela, totalComJuros, totalJuros: totalComJuros - valor };
}

export interface JurosObra { mes: number; percentualLiberado: number; valorLiberado: number; jurosMensal: number; descricao: string; }
export function calcularJurosObra(valorFinanciado: number, taxaAnual: number, valorLote: number = 48000): JurosObra[] {
  const taxaMensal = taxaAnualParaMensal(taxaAnual);
  const libertaInicial = valorLote * 0.80;
  const construirSaldo = valorFinanciado - libertaInicial;

  const etapas = [
    { pct: 0, add: 0, desc: `Assinatura: 80% do Lote (${formatBRL(libertaInicial)})` },
    { pct: 0.25, add: 0.25, desc: "Fundações e Estrutura" },
    { pct: 0.50, add: 0.25, desc: "Alvenaria e Revestimento" },
    { pct: 0.75, add: 0.25, desc: "Pintura e Instalações" },
    { pct: 1.00, add: 0.25, desc: "Habite-se / Entrega" },
  ];

  return etapas.map((etapa, i) => {
    const valorAcumulado = libertaInicial + (construirSaldo * etapa.pct);
    return {
      mes: i + 1,
      percentualLiberado: Math.round((valorAcumulado / valorFinanciado) * 100),
      valorLiberado: valorAcumulado,
      jurosMensal: valorAcumulado * taxaMensal,
      descricao: etapa.desc,
    };
  });
}

// ===================================================
// SUBSÍDIO MCMV
// ===================================================
export interface FaixaMCMV { id: number; nome: string; rendaMin: number; rendaMax: number; subsidioMax: number; subsidioMin: number; taxa: number; cor: string; }
export function calcularSubsidio(renda: number, faixas: FaixaMCMV[]): { faixa: FaixaMCMV | null; subsidio: number; taxa: number } {
  const faixa = faixas.find((f) => renda >= f.rendaMin && renda <= f.rendaMax) || null;
  if (!faixa) return { faixa: null, subsidio: 0, taxa: 12.0 };
  let subsidio = 0;
  if (faixa.subsidioMax > 0) {
    const progresso = (renda - faixa.rendaMin) / (faixa.rendaMax - faixa.rendaMin);
    subsidio = faixa.subsidioMax - progresso * (faixa.subsidioMax - faixa.subsidioMin);
  }
  return { faixa, subsidio: Math.max(0, subsidio), taxa: faixa.taxa };
}

// ===================================================
// FORMATAÇÃO
// ===================================================
export function formatBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(valor);
}
export function formatBRLDecimal(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
}