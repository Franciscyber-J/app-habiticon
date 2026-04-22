// ===================================================
// MÓDULO DE CÁLCULOS FINANCEIROS — Motor de Vendas Habiticon
// Versão 2.0 — Corrigido por engenharia reversa com 4 simulados reais da Caixa
//
// CONFIRMADO via simulados reais (16/04/2026):
//   ✅ Taxa mensal  = taxa nominal anual / 12  (NÃO é taxa efetiva)
//   ✅ SAC          = amortização constante PV/n
//   ✅ PRICE PMT    = PV * i*(1+i)^n / ((1+i)^n - 1)
//   ✅ DFI          = valorImovel * 0.000071018  (FIX: era sobre laudo, não imóvel)
//   ✅ MIP          = saldoDevedor_após_amort * 0.000108  (FIX: era sobre saldo inicial)
//   ✅ Taxa ADM     = R$ 25,00/mês
//   ✅ Cotista      = diferença de 0,50% a.a. (Faixa 3: 7,66% vs 8,16%)
//
// MIP É AGE-DEPENDENT — confirmado salto de +33,4% no aniversário do tomador:
//   - 35 anos: 0.0001079% a.m.  →  0.000108 a.m. (fator arredondado)
//   - 36 anos: 0.0001439% a.m.  →  0.000144 a.m.
//   - Implementado via tabela MIP_FATOR_POR_IDADE
// ===================================================

export interface SimulacaoInput {
  valorImovel: number;
  entrada: number;
  prazoMeses: number;
  taxaAnual: number;       // taxa nominal anual (ex: 8.16 para 8,16% a.a.)
  subsidio?: number;
  usarSubsidio?: boolean;
  rendaFamiliar?: number;
  tetoImovel?: number;
  idadeTomador?: number;   // NOVO: para MIP preciso. Padrão: 35 anos
}

export interface Parcela {
  mes: number;
  amortizacao: number;
  juros: number;
  segurosETaxas: number;  // MIP + DFI + TxAdm
  parcela: number;        // Total pago no mês
  saldoDevedor: number;   // Saldo APÓS o pagamento
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
  entradaMinimaPRICE: number;
  entradaMinimaSAC: number;
  finLiberadoPRICE: number;
  finLiberadoSAC: number;
  laudoPRICE: number;
  laudoSAC: number;
}

// ===================================================
// CONSTANTES CAIXA — VALIDADAS POR ENGENHARIA REVERSA
// ===================================================
export const CAIXA_TAXA_ADM     = 25.00;
export const CAIXA_FATOR_DFI    = 0.000071018; // Confirmado: 275000 × fator = R$19,53 em TODOS os 4 simulados
export const CAIXA_FATOR_MIP    = 0.000108;    // Confirmado: fator sobre saldo APÓS amortização, tomador 35 anos

// Tabela MIP por idade do tomador (confirmados: 35→0.0001079, 36→0.0001439; demais são aproximações)
// IMPORTANTE: na Caixa real, o MIP muda TODO ANO no aniversário do tomador (+33% a cada bracket)
export const MIP_FATOR_POR_IDADE: { idadeMin: number; idadeMax: number; fator: number }[] = [
  { idadeMin: 18, idadeMax: 25, fator: 0.000061 },
  { idadeMin: 26, idadeMax: 30, fator: 0.000079 },
  { idadeMin: 31, idadeMax: 35, fator: 0.000108 }, // ← CONFIRMADO por engenharia reversa
  { idadeMin: 36, idadeMax: 40, fator: 0.000144 }, // ← CONFIRMADO por engenharia reversa (salto +33,4%)
  { idadeMin: 41, idadeMax: 45, fator: 0.000192 },
  { idadeMin: 46, idadeMax: 50, fator: 0.000256 },
  { idadeMin: 51, idadeMax: 55, fator: 0.000341 },
  { idadeMin: 56, idadeMax: 60, fator: 0.000432 },
  { idadeMin: 61, idadeMax: 65, fator: 0.000490 },
  { idadeMin: 66, idadeMax: 80, fator: 0.000560 },
];

export function getMipFator(idade: number): number {
  const bracket = MIP_FATOR_POR_IDADE.find(b => idade >= b.idadeMin && idade <= b.idadeMax);
  return bracket?.fator ?? CAIXA_FATOR_MIP; // fallback para o fator padrão
}

// ===================================================
// CONSTANTES E CÁLCULOS DA MAQUININHA C6 E BOLETO
// ===================================================
export const C6_MDR               = 0.0214;
export const C6_ADICIONAL_PARCELA = 0.0065; // FIX: era 0.0325, agora é 0.65% correto
export const C6_MDR_A_VISTA       = 0.0289; // Taxa de 1x (2.89%)

// Tabela de Fatores Reais da Maquininha (Para bater os centavos físicos)
// Fator = Total Simulado na Máquina / Valor Original (ex: 5324.25 / 5000 = 1.06485)
export const C6_FATORES_MAQUININHA: Record<number, number> = {
  1: 1 / (1 - C6_MDR_A_VISTA), // 1.02976
  2: 1.03815, // Estimativa (Teste 5000 em 2x na máquina e divida por 5000 para ter o fator exato)
  3: 1.04685, // Estimativa (Teste 3x na máquina...)
  4: 1.05575, // Estimativa (Teste 4x na máquina...)
  5: 1.06485, // Fator EXATO relatado: 5324.25 / 5000
};

export const TAXA_BOLETO_MENSAL   = 3.59; // Nova taxa com prêmio de risco (+70% vs Cartão)
export const PRAZO_PADRAO_MESES   = 360; // Máximo usado no simulador Habiticon
export const COMPROMETIMENTO_MAX_RENDA = 0.30;
export const COTA_MAXIMA_CAIXA    = 0.80;

export function parcelamentoCartao(valor: number, parcelas = 5) {
  // Puxa o fator real da máquina para garantir precisão de centavos
  let fatorDinamico = C6_FATORES_MAQUININHA[parcelas];

  if (!fatorDinamico) {
    const taxaTotal = parcelas === 1 ? C6_MDR_A_VISTA : C6_MDR + (C6_ADICIONAL_PARCELA * parcelas);
    fatorDinamico = 1 / (1 - taxaTotal);
  }
  
  const totalComJuros = valor * fatorDinamico;
  
  // Calcula a taxa efetiva real que a máquina cobrou para mostrar no app
  const taxaEfetiva = (1 - (valor / totalComJuros)) * 100;
  
  return { 
    parcelaComJuros: totalComJuros / parcelas, 
    totalComJuros, 
    totalJuros: totalComJuros - valor,
    taxaEfetiva
  };
}

export function parcelamentoBoleto(valor: number, parcelas = 5, taxaMensalPct = TAXA_BOLETO_MENSAL) {
  const i = taxaMensalPct / 100;
  const fator = Math.pow(1 + i, parcelas);
  const parcelaPorParcela = valor * (i * fator) / (fator - 1);
  const totalComJuros = parcelaPorParcela * parcelas;
  return { parcelaPorParcela, totalComJuros, totalJuros: totalComJuros - valor };
}

// ===================================================
// CONVERSÃO DE TAXA
// CONFIRMADO: Caixa usa taxa NOMINAL / 12 (não taxa efetiva composta)
// Verificado: 190.260,51 × (8,16/1200) = R$1.293,77 = exato no simulado
// ===================================================
export function taxaAnualParaMensal(taxaAnual: number): number {
  return taxaAnual / 100 / 12;
}
// mantido por compatibilidade
export const taxaNominalAnualParaMensal = taxaAnualParaMensal;

// ===================================================
// GERAÇÃO DA TABELA PRICE — CORRIGIDA
// ===================================================
// FIXES aplicados vs versão anterior:
//   1. DFI sobre laudo efetivo = max(valorImovel, fin/0.80)
//   2. MIP calculado sobre saldo APÓS amortização (não saldo inicial)
// ===================================================
export function gerarTabelaPRICE(
  valorFinanciado: number,
  valorImovel: number,    // ← FIX: era valorLaudo (fin/0.8). Agora é o valor real do imóvel.
  taxaMensal: number,
  prazoMeses: number,
  mipFator = CAIXA_FATOR_MIP
): Parcela[] {
  const tabela: Parcela[] = [];
  if (valorFinanciado <= 0) return tabela;

  // DFI sobre LAUDO EFETIVO = max(valorImovel, fin/0.80)
  const laudoEfetivo = Math.max(valorImovel, valorFinanciado / COTA_MAXIMA_CAIXA);
  const dfi = laudoEfetivo * CAIXA_FATOR_DFI;

  // PMT puro (amortização + juros): constante ao longo do tempo
  const fator = Math.pow(1 + taxaMensal, prazoMeses);
  const pmtPuro = valorFinanciado * (taxaMensal * fator) / (fator - 1);

  let saldo = valorFinanciado;

  for (let mes = 1; mes <= prazoMeses; mes++) {
    const juros = saldo * taxaMensal;
    const amortizacao = pmtPuro - juros;

    // FIX: saldo é reduzido ANTES de calcular MIP (MIP é sobre saldo após amortização)
    saldo -= amortizacao;
    const saldoApos = Math.max(0, saldo);

    // MIP sobre saldo devedor APÓS amortização (confirmado por engenharia reversa)
    const mip = saldoApos * mipFator;
    const segurosETaxas = mip + dfi + CAIXA_TAXA_ADM;

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
// GERAÇÃO DA TABELA SAC — CORRIGIDA
// ===================================================
export function gerarTabelaSAC(
  valorFinanciado: number,
  valorImovel: number,    // ← FIX: era valorLaudo. Agora é o valor real do imóvel.
  taxaMensal: number,
  prazoMeses: number,
  mipFator = CAIXA_FATOR_MIP
): Parcela[] {
  const tabela: Parcela[] = [];
  if (valorFinanciado <= 0) return tabela;

  const amortizacaoConstante = valorFinanciado / prazoMeses;
  // DFI constante sobre valor do imóvel
  const laudoEfetivo = Math.max(valorImovel, valorFinanciado / COTA_MAXIMA_CAIXA);
  const dfi = laudoEfetivo * CAIXA_FATOR_DFI;
  let saldo = valorFinanciado;

  for (let mes = 1; mes <= prazoMeses; mes++) {
    const juros = saldo * taxaMensal;

    // FIX: saldo é reduzido ANTES de calcular MIP
    saldo -= amortizacaoConstante;
    const saldoApos = Math.max(0, saldo);

    // MIP sobre saldo devedor APÓS amortização
    const mip = saldoApos * mipFator;
    const segurosETaxas = mip + dfi + CAIXA_TAXA_ADM;

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
// SIMULAÇÃO COMPLETA — Motor Principal (Padrão Caixa)
// ===================================================
export function simular(input: SimulacaoInput): ResultadoSimulacao {
  const subsidioEfetivo = input.usarSubsidio !== false ? (input.subsidio || 0) : 0;
  const taxaMensal = taxaAnualParaMensal(input.taxaAnual);
  const rendaFam   = input.rendaFamiliar || 0;
  const tetoMCMV   = input.tetoImovel || 500000;
  const prazo      = input.prazoMeses;
  const mipFator   = getMipFator(input.idadeTomador ?? 35);

  // Financiamento desejado sem considerar trava de renda
  const financiamentoDesejado = Math.max(0, input.valorImovel - input.entrada - subsidioEfetivo);

  // Teto de parcela pela regra dos 30%
  const tetoParcela = rendaFam > 0 ? rendaFam * COMPROMETIMENTO_MAX_RENDA : Infinity;

  // ─────────────────────────────────────────────────
  // FIX PRINCIPAL: DFI É FIXO SOBRE VALOR DO IMÓVEL
  // Antes: usava fatorDfiImplicito = CAIXA_FATOR_DFI / 0.8 (errado — subestimava DFI)
  // Agora: dfiFixo = valorImovel × CAIXA_FATOR_DFI (confirmado em 4 simulados)
  // Impacto: SIM2 tinha R$6,35/mês de erro → 360 × R$6,35 = R$2.286 na soma total
  // ─────────────────────────────────────────────────
  const dfiFixo = input.valorImovel * CAIXA_FATOR_DFI;

  // ─────────────────────────────────────────────────
  // MOTOR DE ENGENHARIA REVERSA — Capacidade máxima pela renda
  // Fórmula: encargo = PMT(PV) + MIP(PV) + DFI_fixo + TxAdm ≤ tetoParcela
  // ─────────────────────────────────────────────────

  // Fator PRICE: i*(1+i)^n / ((1+i)^n - 1)
  const fPrice = Math.pow(1 + taxaMensal, prazo);
  const fatorAMJPrice = (taxaMensal * fPrice) / (fPrice - 1);

  // MAX FINANCIAMENTO PRICE
  // PV × (fatorAMJ + mipFator) = tetoParcela - dfiFixo - taxaAdm
  const maxFinPRICE = tetoParcela > 0 && tetoParcela !== Infinity
    ? Math.max(0, (tetoParcela - CAIXA_TAXA_ADM - dfiFixo) / (fatorAMJPrice + mipFator))
    : Infinity;

  // MAX FINANCIAMENTO SAC
  // PV × (1/n + i + mipFator) = tetoParcela - dfiFixo - taxaAdm
  const maxFinSAC = tetoParcela > 0 && tetoParcela !== Infinity
    ? Math.max(0, (tetoParcela - CAIXA_TAXA_ADM - dfiFixo) / ((1 / prazo) + taxaMensal + mipFator))
    : Infinity;

  // ─────────────────────────────────────────────────
  // AVALIAÇÃO MAJORADA + TETO MCMV
  // ─────────────────────────────────────────────────

  // Cenário PRICE
  let finLiberadoPRICE = Math.min(financiamentoDesejado, maxFinPRICE === Infinity ? financiamentoDesejado : maxFinPRICE);
  let laudoPRICE = finLiberadoPRICE / COTA_MAXIMA_CAIXA;
  if (laudoPRICE > tetoMCMV) {
    laudoPRICE = tetoMCMV;
    finLiberadoPRICE = Math.min(finLiberadoPRICE, laudoPRICE * COTA_MAXIMA_CAIXA);
  }
  const entradaMinimaPRICE = Math.max(0, input.valorImovel - finLiberadoPRICE - subsidioEfetivo);

  // Cenário SAC
  let finLiberadoSAC = Math.min(financiamentoDesejado, maxFinSAC === Infinity ? financiamentoDesejado : maxFinSAC);
  let laudoSAC = finLiberadoSAC / COTA_MAXIMA_CAIXA;
  if (laudoSAC > tetoMCMV) {
    laudoSAC = tetoMCMV;
    finLiberadoSAC = Math.min(finLiberadoSAC, laudoSAC * COTA_MAXIMA_CAIXA);
  }
  const entradaMinimaSAC = Math.max(0, input.valorImovel - finLiberadoSAC - subsidioEfetivo);

  // ─────────────────────────────────────────────────
  // GERA AS TABELAS COM PARÂMETROS CORRIGIDOS
  // Passa input.valorImovel para DFI (não mais laudoPRICE/laudoSAC)
  // ─────────────────────────────────────────────────
  const tabelaPRICE = gerarTabelaPRICE(finLiberadoPRICE, input.valorImovel, taxaMensal, prazo, mipFator);
  const tabelaSAC   = gerarTabelaSAC(finLiberadoSAC,   input.valorImovel, taxaMensal, prazo, mipFator);

  return {
    valorFinanciado: finLiberadoPRICE,
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
// MOTOR DE CAPACIDADE DE RENDA (regra 30%)
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
  const rendaMinimaSAC   = parcelaSAC1a / comprometimentoMax;
  let status: CapacidadeRenda["status"] = "nao_informada";
  let comprometimentoAtual = 0;

  if (rendaFamiliar > 0) {
    comprometimentoAtual = parcelaPRICE / rendaFamiliar;
    if      (rendaFamiliar >= rendaMinimaSAC)   status = "aprovado";
    else if (rendaFamiliar >= rendaMinimaPrice) status = "margem";
    else                                        status = "insuficiente";
  }

  return { rendaMinimaPrice, rendaMinimaSAC, status, comprometimentoAtual, parcelaPRICE, parcelaSAC1a };
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

// ===================================================
// PATCH — calcularEntradaEmbutida corrigida
// Substitui a função e interface existentes em calculos.ts
//
// ANTES (errado):
//   valorFinanciadoCaixa = contrato - entrada = 230.000
//   valorAvaliadoCaixa   = 230.000 / 0.80    = 287.500  ← laudo inventado
//   entradaEmbutida      = 287.500 × 20% - 10k = 47.500  ← errado
//
// DEPOIS (correto):
//   laudoCUB já vem calculado do calcularLaudoCUB()
//   cotaCaixa       = laudoCUB × 80%          = 233.601,85
//   saldoAFinanciar = contrato - entrada       = 230.000
//   entradaEmbutida = saldoAFinanciar - (contrato × 80%) = 38.000
// ===================================================

export interface EntradaEmbutidaInfo {
  valorContratual: number;
  valorAvaliadoCaixa: number;  // laudo CUB real (lote + construção + BDI)
  cotaCaixa: number;            // 80% do laudo CUB
  entradaRealComprador: number;
  entradaEmbutida: number;      // saldoAFinanciar - (contrato × 80%)
  saldoAFinanciar: number;      // contrato - entradaRealComprador (o que o banco libera)
}

// ===================================================
// PATCH — calcularEntradaEmbutida corrigida
// Substitui a função e interface existentes em calculos.ts
//
// ANTES (errado):
//   valorFinanciadoCaixa = contrato - entrada = 230.000
//   valorAvaliadoCaixa   = 230.000 / 0.80    = 287.500  ← laudo inventado
//   entradaEmbutida      = 287.500 × 20% - 10k = 47.500  ← errado
//
// DEPOIS (correto):
//   laudoCUB já vem calculado do calcularLaudoCUB()
//   cotaCaixa       = laudoCUB × 80%          = 233.601,85
//   saldoAFinanciar = contrato - entrada       = 230.000
//   entradaEmbutida = saldoAFinanciar - (contrato × 80%) = 38.000
// ===================================================

export interface EntradaEmbutidaInfo {
  valorContratual: number;
  valorAvaliadoCaixa: number;  // laudo CUB real (lote + construção + BDI)
  cotaCaixa: number;            // 80% do laudo CUB
  entradaCaixa: number;         // mantido por compatibilidade (= cotaCaixa × 20%)
  entradaRealComprador: number;
  entradaEmbutida: number;      // saldoAFinanciar - (contrato × 80%)
  saldoAFinanciar: number;      // contrato - entradaRealComprador (o que o banco libera)
}

export function calcularEntradaEmbutida(
  valorContratual: number,
  entradaRealComprador: number,
  subsidio = 0,
  cotaMaxima = COTA_MAXIMA_CAIXA,
  laudoCUB = 0   // ← NOVO: laudo real via calcularLaudoCUB(). 0 = fallback para comportamento antigo
): EntradaEmbutidaInfo {

  // Quanto o banco efetivamente libera ao incorporador
  const saldoAFinanciar = Math.max(0, valorContratual - entradaRealComprador - subsidio);

  // Se laudoCUB não foi fornecido, usa fallback: deriva o laudo do financiado
  // (comportamento antigo — mantido para não quebrar chamadas sem CUB configurado)
  const laudoEfetivo = laudoCUB > 0
    ? laudoCUB
    : saldoAFinanciar / cotaMaxima;

  const cotaCaixa = laudoEfetivo * cotaMaxima;

  // Entrada embutida = quanto a mais o banco financia vs os 80% simples do contrato
  // Sem estratégia: banco financia valorContratual × 80%
  // Com estratégia: banco financia saldoAFinanciar (pode ser > 80% do contrato)
  const baseSeEstrategia = valorContratual * cotaMaxima; // 80% simples do contrato
  const entradaEmbutida = Math.max(0, saldoAFinanciar - baseSeEstrategia);

  return {
    valorContratual,
    valorAvaliadoCaixa: laudoEfetivo,
    cotaCaixa,
    entradaCaixa: laudoEfetivo * (1 - cotaMaxima), // mantido por compatibilidade
    entradaRealComprador,
    entradaEmbutida,
    saldoAFinanciar,
  };
}

// ===================================================
// JUROS DE OBRA (PCI)
// ===================================================
export interface JurosObra {
  mes: number;
  percentualLiberado: number;
  valorLiberado: number;
  jurosMensal: number;
  descricao: string;
}

export function calcularJurosObra(
  valorFinanciado: number,
  taxaAnual: number,
  valorLote = 48000,
  // Percentuais cumulativos por mês (ex: [18,44,63,85,95,100])
  // O mês 0 = assinatura (80% do lote) é sempre inserido automaticamente
  percentuaisCustom?: number[]
): JurosObra[] {
  const taxaMensal     = taxaAnualParaMensal(taxaAnual);
  const libertaInicial = valorLote * 0.80;
  const construirSaldo = valorFinanciado - libertaInicial;

  // Descrições automáticas baseadas no número de medições
  const descricoesPadrao = [
    "Fundações e Infraestrutura",
    "Supraestrutura e Alvenaria",
    "Cobertura e Revestimentos",
    "Pisos, Instalações e Acabamentos",
    "Pinturas e Louças",
    "Habite-se — Retenção Final (5%)",
  ];

  // Percentuais padrão caso não haja custom (retrocompatível)
  const pctsCumulativos = percentuaisCustom && percentuaisCustom.length > 0
    ? percentuaisCustom
    : [25, 50, 75, 100];

  // Mês 0 = assinatura (80% do lote) + medições seguintes
  const etapas = [
    {
      pctDoConstruir: 0,
      desc: `Assinatura: 80% do Lote (${formatBRL(libertaInicial)})`,
    },
    ...pctsCumulativos.map((pctAcum, i) => ({
      pctDoConstruir: pctAcum / 100,
      desc: descricoesPadrao[i] ?? `Medição ${i + 1}`,
    })),
  ];

  return etapas.map((etapa, i) => {
    const valorAcumulado = libertaInicial + construirSaldo * etapa.pctDoConstruir;
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
export interface FaixaMCMV {
  id: number;
  nome: string;
  rendaMin: number;
  rendaMax: number;
  subsidioMax: number;
  subsidioMin: number;
  taxa: number;          // taxa não-cotista (padrão)
  taxaCotista?: number;   // taxa cotista FGTS (≥3 anos)
  tetoImovel?: number;    // valor máximo do imóvel (laudo) permitido nesta faixa
  cor: string;
}

export function calcularSubsidio(
  renda: number,
  faixas: FaixaMCMV[],
  isCotista = false
): { faixa: FaixaMCMV | null; subsidio: number; taxa: number; taxaCotista: number; taxaNaoCotista: number } {
  const faixa = faixas.find(f => renda >= f.rendaMin && renda <= f.rendaMax) ?? null;

  if (!faixa) return { faixa: null, subsidio: 0, taxa: 12.0, taxaCotista: 12.0, taxaNaoCotista: 12.0 };

  let subsidio = 0;
  if (faixa.subsidioMax > 0) {
    const progresso = (renda - faixa.rendaMin) / Math.max(1, faixa.rendaMax - faixa.rendaMin);
    subsidio = faixa.subsidioMax - progresso * (faixa.subsidioMax - faixa.subsidioMin);
  }

  const taxaNaoCotista = faixa.taxa;
  const taxaCotista    = faixa.taxaCotista ?? faixa.taxa;
  const taxa           = isCotista ? taxaCotista : taxaNaoCotista;

  return {
    faixa,
    subsidio: Math.max(0, subsidio),
    taxa,
    taxaCotista,
    taxaNaoCotista,
  };
}

// ===================================================
// MOTOR CUB SINDUSCON — Base de Laudo para Construção
// ===================================================
// A Caixa usa o CUB SINDUSCON como base do laudo técnico para financiamentos
// de construção. A estratégia de entrada embutida funciona assim:
//   laudoCUB = valorLote + (areaMQ × cubVigente × (1 + bdi))
//   maxFinanciamento = laudoCUB × 80%
// Se maxFinanciamento ≥ valorVenda × 80%, a entrada pode ser totalmente embutida.
// BDI máximo aceito: 18% (eleva o laudo legitimamente sem distorcer o CUB).
// ===================================================

export type LimitadorEntrada = "renda_30" | "cota_80" | "cub" | "entrada_min";

export interface EntradaMinimaResult {
  entradaMinima: number;
  maxFinanciamento: number;
  laudoFinal: number;
  limitador: LimitadorEntrada;
  detalhe: string;
  maxFinRenda: number;
  maxFinCota80: number;
  maxFinCUB: number;
  // campos de diagnóstico da entrada embutida
  ganhoEntradaEmbutida: number;   // quanto o CUB "ganhou" vs 80% simples do contrato
  cubCobre: boolean;               // true = laudo CUB cobre 100% da estratégia embutida
  pctFinanciadoSobreVenda: number; // ex: 0.917 = 91,7% do preço financiado
}

export interface LaudoCUBResult {
  laudoTotal: number;
  valorLote: number;
  valorConstrucao: number;
  areaMQ: number;
  cubVigente: number;
  bdi: number;
  maxFinanciamento: number;
  coberturaVenda: boolean; // true = 80% do laudo ≥ 80% do valor de venda
}

/**
 * Calcula o laudo técnico baseado no CUB SINDUSCON
 * laudoCUB = valorLote + (areaMQ × cubVigente × (1 + bdi))
 */
export function calcularLaudoCUB(
  valorLote: number,
  areaMQ: number,
  cubVigente: number,
  bdi = 0.18,
  valorVenda = 0,
  cotaMaxima = COTA_MAXIMA_CAIXA
): LaudoCUBResult {
  const valorConstrucao = areaMQ * cubVigente * (1 + bdi);
  const laudoTotal = valorLote + valorConstrucao;
  const maxFinanciamento = laudoTotal * cotaMaxima;
  const coberturaVenda = valorVenda > 0
    ? maxFinanciamento >= valorVenda * cotaMaxima
    : false;

  return { laudoTotal, valorLote, valorConstrucao, areaMQ, cubVigente, bdi, maxFinanciamento, coberturaVenda };
}

export function calcularMaxFinCUB(
  valorLote: number,
  areaMQ: number,
  cubVigente: number,
  bdi = 0.18,
  cotaMaxima = COTA_MAXIMA_CAIXA
): number {
  return calcularLaudoCUB(valorLote, areaMQ, cubVigente, bdi).laudoTotal * cotaMaxima;
}

/**
 * Motor unificado de entrada mínima — ENTRADA EMBUTIDA como motor chefe.
 *
 * A Caixa avalia pelo laudo CUB SINDUSCON, NÃO pelo preço de venda.
 * O financiamento é 80% do LAUDO. Se laudoCUB > valorVenda, a Caixa
 * financia mais de 80% do contrato → a entrada do comprador cai abaixo
 * dos 20% tradicionais. Isso é a "entrada embutida".
 *
 * Dois motores competem — o mais restritivo (maior entrada) prevalece:
 *
 * Motor A (CHEFE) — CUB:
 * laudoCUB = lote + área × cub × (1+bdi)
 * maxFinCUB = min(laudoCUB, tetoMCMV) × 80%
 * entradaMinCUB = max(entradaMinConfig, valorVenda − maxFinCUB)
 * → Quando CUB=0: fallback para 80% do contrato (comportamento padrão)
 *
 * Motor B — Renda 30%:
 * maxFinRenda = motor de parcela (Infinity se sem renda)
 * entradaMinRenda = max(entradaMinConfig, valorVenda − maxFinRenda)
 *
 * NÃO existe "regra dos 80% do contrato" como terceiro limitador separado.
 * Esse papel pertence ao Motor A (via tetoMCMV já embutido no laudoCUB).
 */
export function calcularEntradaMinima(
  valorVenda: number,
  maxFinRenda: number,        // saída do motor de renda (Infinity se sem renda)
  maxFinCUB: number,          // saída de calcularMaxFinCUB (0 se CUB não configurado)
  entradaMinConfig: number,   // entrada mínima da construtora (ex: R$ 10.000)
  cotaMaxima = COTA_MAXIMA_CAIXA,
  tetoMCMV = 0                // teto MCMV (0 = sem limite extra além do laudo)
): EntradaMinimaResult {
  // ── Motor A: CUB (CHEFE) ────────────────────────────────────────
  // Quando CUB não está configurado (maxFinCUB = 0), usa 80% do contrato
  // como fallback — mesmo comportamento de antes, sem quebrar nada.
  const maxFinCota80Fallback = valorVenda * cotaMaxima;
  const maxFinCUBEfetivo = maxFinCUB > 0 ? maxFinCUB : maxFinCota80Fallback;

  // Aplica teto MCMV ao laudo (se fornecido)
  const maxFinCUBFinal = tetoMCMV > 0
    ? Math.min(maxFinCUBEfetivo, tetoMCMV * cotaMaxima)
    : maxFinCUBEfetivo;

  const entradaMinCUB = Math.max(entradaMinConfig, valorVenda - maxFinCUBFinal);

  // Quanto o CUB "ganhou" em relação ao 80% simples do contrato
  const ganhoEntradaEmbutida = Math.max(0, maxFinCUBFinal - maxFinCota80Fallback);
  const cubCobre = maxFinCUBFinal >= (valorVenda - entradaMinConfig);

  // ── Motor B: Renda 30% ──────────────────────────────────────────
  const maxFinRendaEfetivo = maxFinRenda < Infinity ? maxFinRenda : maxFinCUBFinal;
  const entradaMinRenda = Math.max(entradaMinConfig, valorVenda - maxFinRendaEfetivo);

  // ── Resultado: o mais restritivo vence ─────────────────────────
  const maxFinEfetivo = Math.min(maxFinCUBFinal, maxFinRendaEfetivo);
  const entradaFinal  = Math.max(entradaMinConfig, valorVenda - maxFinEfetivo);
  const laudoFinal    = maxFinCUBFinal / cotaMaxima;

  // ── Identifica o limitador ──────────────────────────────────────
  let limitador: LimitadorEntrada;
  let detalhe: string;

  if (entradaFinal <= entradaMinConfig + 1) {
    limitador = "entrada_min";
    detalhe = `Entrada mínima de R$ ${entradaMinConfig.toLocaleString("pt-BR")} aplicada. Renda e laudo cobrem o restante.`;
  } else if (entradaMinCUB >= entradaMinRenda) {
    // CUB é o limitador
    if (maxFinCUB > 0) {
      limitador = "cub";
      detalhe = `O laudo CUB cobre até R$ ${maxFinCUBFinal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} (${(maxFinCUBFinal / valorVenda * 100).toFixed(1)}% do imóvel). Aumente o CUB vigente para reduzir a entrada.`;
    } else {
      // CUB não configurado — é o fallback do 80% do contrato
      limitador = "cota_80";
      detalhe = `Configure o CUB SINDUSCON no painel admin para ativar a estratégia de entrada embutida. Atualmente usando 80% do contrato base.`;
    }
  } else {
    limitador = "renda_30";
    detalhe = `A renda informada limita o financiamento a R$ ${maxFinRendaEfetivo.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} (parcela máxima = 30% da renda).`;
  }

  return {
    entradaMinima:     entradaFinal,
    maxFinanciamento:  maxFinEfetivo,
    laudoFinal,
    limitador,
    detalhe,
    maxFinRenda:       maxFinRendaEfetivo,
    maxFinCota80:      maxFinCota80Fallback,
    maxFinCUB:         maxFinCUBFinal,
    // extras para o card de diagnóstico no frontend
    ganhoEntradaEmbutida,
    cubCobre,
    pctFinanciadoSobreVenda: maxFinEfetivo / valorVenda,
  } as EntradaMinimaResult;
}

// ===================================================
// FORMATAÇÃO
// ===================================================
export function formatBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(valor);
}

export function formatBRLDecimal(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(valor);
}

// ===================================================
// MOTOR DE FAIXA EFETIVA
// ===================================================
// Determina a faixa REAL de enquadramento considerando
// DUAS dimensões:
//   1. Faixa pelo laudo CUB (R2) — qual faixa o imóvel exige
//   2. Faixa pela renda (R3)     — qual faixa o cliente está
// A faixa efetiva é a mais restritiva (maior id).
// Se incompatíveis → cliente BLOQUEADO para este modelo.
// ===================================================

export interface FaixaEfetiva {
  faixaEfetiva: FaixaMCMV | null;
  faixaPeloLaudo: FaixaMCMV | null;   // qual faixa o laudo exige
  faixaPelaRenda: FaixaMCMV | null;   // qual faixa a renda permite
  aprovado: boolean;
  bloqueio: string | null;             // mensagem se não aprovado
  laudoForcouFaixaSuperior: boolean;   // true = laudo subiu a faixa
  rendaMinimaParaAprovacao: number;    // renda mínima para aprovar com este laudo
  subsidioEfetivo: number;             // subsídio real (0 se não for Faixa 2)
  taxaEfetiva: number;                 // taxa não-cotista da faixa efetiva
  taxaEfetivaCotista: number;          // taxa cotista da faixa efetiva
}

/**
 * Determina a faixa de enquadramento efetiva.
 *
 * @param laudoCUB  - Valor do laudo (lote + construção CUB). null = CUB não configurado.
 * @param renda     - Renda bruta familiar do cliente (0 = não informada).
 * @param faixas    - Lista de faixas do empreendimento (com tetoImovel por faixa).
 * @param subsidioCalculado - Subsídio calculado pelo calcularSubsidio() para a faixa de renda.
 */
export function determinarFaixaEfetiva(
  laudoCUB: number | null,
  renda: number,
  faixas: FaixaMCMV[],
  subsidioCalculado = 0,
): FaixaEfetiva {
  const semFaixa: FaixaEfetiva = {
    faixaEfetiva: null, faixaPeloLaudo: null, faixaPelaRenda: null,
    aprovado: false, bloqueio: null,
    laudoForcouFaixaSuperior: false, rendaMinimaParaAprovacao: 0,
    subsidioEfetivo: 0, taxaEfetiva: 12, taxaEfetivaCotista: 12,
  };

  // ── Faixa pela RENDA ───────────────────────────────
  const faixaPelaRenda = renda > 0
    ? faixas.find(f => renda >= f.rendaMin && renda <= f.rendaMax) ?? null
    : null;

  // ── Faixa pelo LAUDO (CUB) ─────────────────────────
  // Se CUB não configurado (laudoCUB = null), não há restrição por laudo
  let faixaPeloLaudo: FaixaMCMV | null = null;
  if (laudoCUB !== null && laudoCUB > 0) {
    // Encontra a faixa mais baixa cujo tetoImovel comporta o laudo
    const faixasComTeto = faixas.filter(f => f.tetoImovel != null);
    if (faixasComTeto.length > 0) {
      faixaPeloLaudo = faixasComTeto.find(f => laudoCUB <= (f.tetoImovel ?? Infinity)) ?? null;
      if (!faixaPeloLaudo) {
        // Laudo acima de todos os tetos configurados
        return {
          ...semFaixa,
          bloqueio: `O laudo CUB de R$ ${Math.round(laudoCUB).toLocaleString("pt-BR")} ultrapassa o teto de todas as faixas disponíveis.`,
        };
      }
    }
  }

  // ── Sem renda informada → sem faixa efetiva ────────
  if (!faixaPelaRenda) {
    return { ...semFaixa, faixaPeloLaudo };
  }

  // ── Faixa efetiva = a mais restritiva ──────────────
  const laudoForcouFaixaSuperior =
    faixaPeloLaudo !== null && faixaPeloLaudo.id > faixaPelaRenda.id;

  const faixaEfetiva = laudoForcouFaixaSuperior ? faixaPeloLaudo! : faixaPelaRenda;

  // ── Verifica compatibilidade renda × faixa efetiva ─
  if (laudoForcouFaixaSuperior) {
    // O laudo exige faixa superior à que a renda permite
    const rendaMinNecessaria = faixaEfetiva.rendaMin;
    return {
      faixaEfetiva,
      faixaPeloLaudo,
      faixaPelaRenda,
      aprovado: false,
      bloqueio: `O laudo CUB (R$ ${Math.round(laudoCUB!).toLocaleString("pt-BR")}) exige ${faixaEfetiva.nome}, mas a renda de R$ ${renda.toLocaleString("pt-BR")} só qualifica para ${faixaPelaRenda.nome}. Renda mínima necessária: R$ ${rendaMinNecessaria.toLocaleString("pt-BR")}.`,
      laudoForcouFaixaSuperior: true,
      rendaMinimaParaAprovacao: rendaMinNecessaria,
      subsidioEfetivo: 0,
      taxaEfetiva: faixaEfetiva.taxa,
      taxaEfetivaCotista: faixaEfetiva.taxaCotista ?? faixaEfetiva.taxa,
    };
  }

  // ── Aprovado — calcula subsídio real ───────────────
  // Subsídio só existe na Faixa 2
  const subsidioEfetivo = faixaEfetiva.id === 2 ? subsidioCalculado : 0;

  return {
    faixaEfetiva,
    faixaPeloLaudo,
    faixaPelaRenda,
    aprovado: true,
    bloqueio: null,
    laudoForcouFaixaSuperior: false,
    rendaMinimaParaAprovacao: faixaEfetiva.rendaMin,
    subsidioEfetivo,
    taxaEfetiva: faixaEfetiva.taxa,
    taxaEfetivaCotista: faixaEfetiva.taxaCotista ?? faixaEfetiva.taxa,
  };
}