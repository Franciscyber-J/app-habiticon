// ===================================================
// MÓDULO DE CÁLCULOS FINANCEIROS — SBPE (Taxa Balcão)
// Desenvolvido com base em simulações reais da Caixa (Maio/2026)
// ===================================================

export interface SimulacaoSBPEInput {
  valorImovel: number;
  entrada: number;
  prazoMeses: number; // Padrão travado em 360 meses
  taxaAnual: number;  // Ex: 11.38 para 11,38% a.a. nominal
  rendaFamiliar: number;
  idadeTomador?: number;
  laudoCalculado?: number; // Injetando o Laudo CUB diretamente no motor para avaliar a cota real
}

export interface ParcelaSBPE {
  mes: number;
  amortizacao: number;
  juros: number;
  segurosETaxas: number;
  parcela: number;
  saldoDevedor: number;
}

export interface ResultadoSimulacaoSBPE {
  valorFinanciado: number;
  taxaMensal: number;
  parcelaPricePrimeira: number;
  parcelaSACPrimeira: number;
  parcelaSACUltima: number;
  totalPagoPrice: number;
  totalPagoSAC: number;
  tabelaSAC: ParcelaSBPE[];
  tabelaPRICE: ParcelaSBPE[];
  entradaMinimaPRICE: number;
  entradaMinimaSAC: number;
  finLiberadoPRICE: number;
  finLiberadoSAC: number;
  laudoPRICE: number;
  laudoSAC: number;
}

// ===================================================
// CONSTANTES SBPE CAIXA — Validadas por Engenharia Reversa
// ===================================================
export const SBPE_TAXA_ADM = 25.00;
export const SBPE_FATOR_DFI = 0.000066; // Fixado: Exatos R$ 39,60 para imóvel de 600k
export const SBPE_FATOR_MIP_BASE = 0.0001157; // Fator aproximado para 35 anos no SBPE

// Limites Estruturais SBPE
export const SBPE_COTA_MAXIMA_SAC = 0.80;   // SAC financia até 80% do Laudo de Avaliação
export const SBPE_COTA_MAXIMA_PRICE = 0.70; // PRICE financia até 70% do Laudo de Avaliação
export const SBPE_COMPROMETIMENTO_SAC = 0.30;   // Parcela SAC trava em 30% da renda bruta
export const SBPE_COMPROMETIMENTO_PRICE = 0.25; // Parcela PRICE trava em 25% da renda bruta

export function taxaAnualParaMensalSBPE(taxaAnual: number): number {
  return taxaAnual / 100 / 12;
}

// ===================================================
// GERAÇÃO DA TABELA PRICE - SBPE
// ===================================================
export function gerarTabelaPRICESBPE(
  valorFinanciado: number,
  valorImovelBaseDFI: number,
  taxaMensal: number,
  prazoMeses: number,
  mipFator = SBPE_FATOR_MIP_BASE
): ParcelaSBPE[] {
  const tabela: ParcelaSBPE[] = [];
  if (valorFinanciado <= 0) return tabela;

  // DFI é cobrado com base na avaliação oficial da Caixa
  const dfi = valorImovelBaseDFI * SBPE_FATOR_DFI;

  // Fator PMT puro da Matemática Financeira
  const fator = Math.pow(1 + taxaMensal, prazoMeses);
  const pmtPuro = valorFinanciado * (taxaMensal * fator) / (fator - 1);

  let saldo = valorFinanciado;

  for (let mes = 1; mes <= prazoMeses; mes++) {
    const juros = saldo * taxaMensal;
    const amortizacao = pmtPuro - juros;

    saldo -= amortizacao;
    const saldoApos = Math.max(0, saldo);

    // MIP cobrado sobre o saldo devedor recém atualizado
    const mip = saldoApos * mipFator;
    const segurosETaxas = mip + dfi + SBPE_TAXA_ADM;

    tabela.push({
      mes,
      amortizacao,
      juros,
      segurosETaxas,
      parcela: pmtPuro + segurosETaxas,
      saldoDevedor: saldoApos,
    });
  }
  return tabela;
}

// ===================================================
// GERAÇÃO DA TABELA SAC - SBPE
// ===================================================
export function gerarTabelaSACSBPE(
  valorFinanciado: number,
  valorImovelBaseDFI: number,
  taxaMensal: number,
  prazoMeses: number,
  mipFator = SBPE_FATOR_MIP_BASE
): ParcelaSBPE[] {
  const tabela: ParcelaSBPE[] = [];
  if (valorFinanciado <= 0) return tabela;

  const amortizacaoConstante = valorFinanciado / prazoMeses;
  const dfi = valorImovelBaseDFI * SBPE_FATOR_DFI;
  let saldo = valorFinanciado;

  for (let mes = 1; mes <= prazoMeses; mes++) {
    const juros = saldo * taxaMensal;

    saldo -= amortizacaoConstante;
    const saldoApos = Math.max(0, saldo);

    const mip = saldoApos * mipFator;
    const segurosETaxas = mip + dfi + SBPE_TAXA_ADM;

    tabela.push({
      mes,
      amortizacao: amortizacaoConstante,
      juros,
      segurosETaxas,
      parcela: amortizacaoConstante + juros + segurosETaxas,
      saldoDevedor: saldoApos,
    });
  }
  return tabela;
}

// ===================================================
// SIMULAÇÃO COMPLETA SBPE
// ===================================================
export function simularSBPE(input: SimulacaoSBPEInput): ResultadoSimulacaoSBPE {
  const taxaMensal = taxaAnualParaMensalSBPE(input.taxaAnual);
  const rendaFam = input.rendaFamiliar || 0;
  const prazo = input.prazoMeses;
  const mipFator = SBPE_FATOR_MIP_BASE;

  // CORREÇÃO ESTRUTURAL: A Caixa financia com base na AVALIAÇÃO DO IMÓVEL (Laudo CUB). 
  // O Laudo Base será o CUB calculado (se for maior que o preço de venda).
  const laudoBase = input.laudoCalculado && input.laudoCalculado > input.valorImovel ? input.laudoCalculado : input.valorImovel;
  
  // O DFI é calculado usando essa mesma base referencial
  const dfiFixo = laudoBase * SBPE_FATOR_DFI;

  // Tetos de parcela calculados em cima do comprometimento máximo bancário
  const tetoParcelaSAC = rendaFam > 0 ? rendaFam * SBPE_COMPROMETIMENTO_SAC : Infinity;
  const tetoParcelaPRICE = rendaFam > 0 ? rendaFam * SBPE_COMPROMETIMENTO_PRICE : Infinity;

  // Matemática da Tabela PRICE
  const fPrice = Math.pow(1 + taxaMensal, prazo);
  const fatorAMJPrice = (taxaMensal * fPrice) / (fPrice - 1);

  // MÁXIMO FINANCIAMENTO PRICE: Limitador 1 (Renda) cruzado com Limitador 2 (Cota 70% sobre o Laudo)
  const maxFinPRICE_Renda = tetoParcelaPRICE > 0 && tetoParcelaPRICE !== Infinity
    ? Math.max(0, (tetoParcelaPRICE - SBPE_TAXA_ADM - dfiFixo) / (fatorAMJPrice + mipFator))
    : Infinity;
  const maxFinPRICE_Cota = laudoBase * SBPE_COTA_MAXIMA_PRICE;
  const maxFinPRICE = Math.min(maxFinPRICE_Renda, maxFinPRICE_Cota);

  // MÁXIMO FINANCIAMENTO SAC: Limitador 1 (Renda) cruzado com Limitador 2 (Cota 80% sobre o Laudo)
  const maxFinSAC_Renda = tetoParcelaSAC > 0 && tetoParcelaSAC !== Infinity
    ? Math.max(0, (tetoParcelaSAC - SBPE_TAXA_ADM - dfiFixo) / ((1 / prazo) + taxaMensal + mipFator))
    : Infinity;
  const maxFinSAC_Cota = laudoBase * SBPE_COTA_MAXIMA_SAC;
  const maxFinSAC = Math.min(maxFinSAC_Renda, maxFinSAC_Cota);

  // ─────────────────────────────────────────────────
  // AVALIAÇÃO E LIBERAÇÃO
  // O Financiamento "Desejado" é o Valor do Imóvel menos a Entrada que o cliente quer dar.
  // O banco libera no máximo o teto calculado acima.
  // ─────────────────────────────────────────────────
  const financiamentoDesejado = Math.max(0, input.valorImovel - input.entrada);

  const finLiberadoPRICE = Math.min(financiamentoDesejado, maxFinPRICE);
  const laudoPRICE = laudoBase; // O Laudo é estático
  const entradaMinimaPRICE = Math.max(0, input.valorImovel - maxFinPRICE);

  const finLiberadoSAC = Math.min(financiamentoDesejado, maxFinSAC);
  const laudoSAC = laudoBase; // O Laudo é estático
  const entradaMinimaSAC = Math.max(0, input.valorImovel - maxFinSAC);

  // ─────────────────────────────────────────────────
  // GERA AS TABELAS FINAIS PARA OS GRÁFICOS
  // ─────────────────────────────────────────────────
  const tabelaPRICE = gerarTabelaPRICESBPE(finLiberadoPRICE, laudoBase, taxaMensal, prazo, mipFator);
  const tabelaSAC   = gerarTabelaSACSBPE(finLiberadoSAC, laudoBase, taxaMensal, prazo, mipFator);

  return {
    valorFinanciado: finLiberadoPRICE, // O default para exibição inicial
    taxaMensal,
    parcelaPricePrimeira: tabelaPRICE[0]?.parcela || 0,
    parcelaSACPrimeira:   tabelaSAC[0]?.parcela   || 0,
    parcelaSACUltima:     tabelaSAC[tabelaSAC.length - 1]?.parcela || 0,
    totalPagoPrice:  tabelaPRICE.reduce((acc, p) => acc + p.parcela, 0),
    totalPagoSAC:    tabelaSAC.reduce((acc, p) => acc + p.parcela, 0),
    tabelaSAC,
    tabelaPRICE,
    entradaMinimaPRICE,
    entradaMinimaSAC,
    finLiberadoPRICE,
    finLiberadoSAC,
    laudoPRICE,
    laudoSAC,
  };
}

// ===================================================
// CÁLCULO DE ENTRADA EMBUTIDA SBPE (CUB Alto Padrão)
// ===================================================
export interface EntradaEmbutidaSBPEInfo {
  valorContratual: number;
  valorAvaliadoCaixa: number; // laudo CUB real (lote + construção + BDI)
  cotaCaixa: number;          // Varia entre 70% (PRICE) ou 80% (SAC) do laudo
  entradaRealComprador: number;
  entradaEmbutida: number;    // A margem adicional que o laudo garantiu de financiamento
  saldoAFinanciar: number;    
}

export function calcularEntradaEmbutidaSBPE(
  valorContratual: number,
  entradaRealComprador: number,
  cotaMaxima: number, // Injetar SBPE_COTA_MAXIMA_SAC ou SBPE_COTA_MAXIMA_PRICE dependendo da tabela escolhida
  laudoCUBSBPE: number 
): EntradaEmbutidaSBPEInfo {

  // O montante que precisa de crédito para fechar a conta do imóvel
  const saldoAFinanciar = Math.max(0, valorContratual - entradaRealComprador);
  
  // O banco aceita o Laudo se ele justificar o preço, caso contrário o teto é o próprio preço de venda
  const laudoEfetivo = laudoCUBSBPE > valorContratual ? laudoCUBSBPE : valorContratual;
  
  // O Teto absoluto da cota aprovada pelo banco (Ex: 80% de 634k)
  const cotaCaixa = laudoEfetivo * cotaMaxima;

  // Quanto o banco liberaria sem a estratégia do laudo CUB (Ex: 80% de 600k)
  const baseSeEstrategia = valorContratual * cotaMaxima; 
  
  // A diferença pura que o CUB trouxe de benefício ao financiamento
  const entradaEmbutida = Math.max(0, cotaCaixa - baseSeEstrategia); 

  return {
    valorContratual,
    valorAvaliadoCaixa: laudoEfetivo,
    cotaCaixa,
    entradaRealComprador,
    entradaEmbutida,
    saldoAFinanciar,
  };
}