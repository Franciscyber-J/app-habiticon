// ===================================================
// MÓDULO DE CÁLCULOS FINANCEIROS — Motor de Vendas Habiticon
// ===================================================

export interface SimulacaoInput {
  valorImovel: number;
  entrada: number;
  prazoMeses: number;
  taxaAnual: number; // taxa nominal anual (ex: 8.16 para 8,16% a.a.)
  subsidio?: number;
}

export interface ParcelaSAC {
  mes: number;
  amortizacao: number;
  juros: number;
  parcela: number;
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
  tabelaSAC: ParcelaSAC[];
}

// ===================================================
// TAXAS DO CARTÃO C6 (maquininha)
// Fórmula comprovada: total = principal / (1 - MDR - adicionalPorParcela)
// Verificação: R$10.000 / (1 - 0,0214 - 0,0325) = R$10.569,70 ✓
// ===================================================
export const C6_MDR = 0.0214;               // Taxa contratada MDR (2,14%)
export const C6_ADICIONAL_PARCELA = 0.0325; // Adicional por parcela (3,25%)
export const C6_FATOR = 1 / (1 - C6_MDR - C6_ADICIONAL_PARCELA); // ≈ 1,05697

// Taxa do boleto — opção de ÚLTIMO RECURSO
// CDC / promissória — reflete risco de inadimplência
export const TAXA_BOLETO_MENSAL = 1.99; // % ao mês (≈ 26,8% a.a.)

// Prazo padrão do financiamento MCMV
export const PRAZO_PADRAO_MESES = 360; // 30 anos

// Comprometimento máximo de renda (regra Caixa)
export const COMPROMETIMENTO_MAX_RENDA = 0.30; // 30%

// Cota máxima de financiamento Caixa (MCMV Faixa 1-3)
export const COTA_MAXIMA_CAIXA = 0.80; // 80%

/**
 * Converte taxa anual nominal para mensal
 * Para MCMV Faixa 3: 8,16% a.a. nominal → 0,68% a.m.
 * (divisão, não capitalização composta — padrão BCB para taxa nominal)
 */
export function taxaNominalAnualParaMensal(taxaNominalAnual: number): number {
  return taxaNominalAnual / 100 / 12;
}

/**
 * Converte taxa anual efetiva para mensal (capitalização composta)
 */
export function taxaAnualParaMensal(taxaAnual: number): number {
  return taxaNominalAnualParaMensal(taxaAnual);
  // Nota: Caixa usa divisão simples (nominal), não capitalização composta
}

/**
 * Calcula a parcela fixa do sistema PRICE (PMT)
 * PMT = PV * (i * (1+i)^n) / ((1+i)^n - 1)
 */
export function calcularParcelaPRICE(
  valorFinanciado: number,
  taxaMensal: number,
  prazoMeses: number
): number {
  if (taxaMensal === 0) return valorFinanciado / prazoMeses;
  const fator = Math.pow(1 + taxaMensal, prazoMeses);
  return valorFinanciado * (taxaMensal * fator) / (fator - 1);
}

/**
 * Gera a tabela completa do sistema SAC
 */
export function gerarTabelaSAC(
  valorFinanciado: number,
  taxaMensal: number,
  prazoMeses: number
): ParcelaSAC[] {
  const amortizacao = valorFinanciado / prazoMeses;
  const tabela: ParcelaSAC[] = [];
  let saldo = valorFinanciado;

  for (let mes = 1; mes <= prazoMeses; mes++) {
    const juros = saldo * taxaMensal;
    const parcela = amortizacao + juros;
    saldo -= amortizacao;
    tabela.push({
      mes,
      amortizacao,
      juros,
      parcela,
      saldoDevedor: Math.max(0, saldo),
    });
  }
  return tabela;
}

/**
 * Simulação completa SAC + PRICE
 */
export function simular(input: SimulacaoInput): ResultadoSimulacao {
  const subsidio = input.subsidio || 0;
  const valorFinanciado = Math.max(0, input.valorImovel - input.entrada - subsidio);
  const taxaMensal = taxaAnualParaMensal(input.taxaAnual);

  const parcelaPricePrimeira = calcularParcelaPRICE(valorFinanciado, taxaMensal, input.prazoMeses);
  const tabelaSAC = gerarTabelaSAC(valorFinanciado, taxaMensal, input.prazoMeses);

  const parcelaSACPrimeira = tabelaSAC[0]?.parcela || 0;
  const parcelaSACUltima = tabelaSAC[tabelaSAC.length - 1]?.parcela || 0;

  const totalPagoPrice = parcelaPricePrimeira * input.prazoMeses;
  const totalPagoSAC = tabelaSAC.reduce((acc, p) => acc + p.parcela, 0);

  return {
    valorFinanciado,
    taxaMensal,
    parcelaPricePrimeira,
    parcelaSACPrimeira,
    parcelaSACUltima,
    totalPagoPrice,
    totalPagoSAC,
    tabelaSAC,
  };
}

// ===================================================
// MOTOR DE CAPACIDADE DE RENDA
// Regra Caixa: prestação ≤ 30% da renda bruta familiar
// ===================================================
export interface CapacidadeRenda {
  rendaMinimaPrice: number;    // Renda mínima para qualificar no PRICE
  rendaMinimaSAC: number;      // Renda mínima para qualificar no SAC (1ª parcela = maior)
  status: "aprovado" | "margem" | "insuficiente" | "nao_informada";
  comprometimentoAtual: number; // % da renda comprometida com PRICE
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
      status = "aprovado"; // qualifica até SAC (mais conservador)
    } else if (rendaFamiliar >= rendaMinimaPrice) {
      status = "margem";   // qualifica PRICE mas não SAC 1ª
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
// "ENTRADA EMBUTIDA" — Cálculo do Laudo Caixa
// Caixa financia até 80% do valor avaliado.
// Ao declarar um valor maior que o contrato, a Caixa
// libera mais capital, reduzindo a entrada real do comprador.
// ===================================================
export interface EntradaEmbutidaInfo {
  valorContratual: number;     // Preço real do imóvel (contrato com construtor)
  valorAvaliadoCaixa: number;  // Valor declarado ao laudo Caixa = valorFinanciado / 0.80
  entradaCaixa: number;        // Entrada exigida pela Caixa = 20% do valorAvaliado
  entradaRealComprador: number; // O que o comprador paga de fato = entrada do slider
  entradaEmbutida: number;     // Diferença coberta pela inflação do valor = entradaCaixa - entradaRealComprador
  cotaCaixa: number;           // Valor liberado pela Caixa = 80% do avaliado
}

export function calcularEntradaEmbutida(
  valorContratual: number,
  entradaRealComprador: number,
  subsidio = 0,
  cotaMaxima = COTA_MAXIMA_CAIXA
): EntradaEmbutidaInfo {
  const valorFinanciadoCaixa = Math.max(0, valorContratual - entradaRealComprador - subsidio);
  // valorAvaliado é calculado para que 80% = valorFinanciado
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
// PARCELAMENTO DA ENTRADA — CARTÃO C6
// ===================================================
export function parcelamentoCartao(
  valor: number,
  parcelas = 5
): { parcelaComJuros: number; totalComJuros: number; totalJuros: number } {
  const totalComJuros = valor * C6_FATOR;
  const parcelaComJuros = totalComJuros / parcelas;
  return {
    parcelaComJuros,
    totalComJuros,
    totalJuros: totalComJuros - valor,
  };
}

// ===================================================
// PARCELAMENTO DA ENTRADA — BOLETO (ÚLTIMO RECURSO)
// ===================================================
export function parcelamentoBoleto(
  valor: number,
  parcelas = 5,
  taxaMensalPct = TAXA_BOLETO_MENSAL
): { parcelaPorParcela: number; totalComJuros: number; totalJuros: number } {
  const i = taxaMensalPct / 100;
  const fator = Math.pow(1 + i, parcelas);
  const parcelaPorParcela = valor * (i * fator) / (fator - 1);
  const totalComJuros = parcelaPorParcela * parcelas;
  return {
    parcelaPorParcela,
    totalComJuros,
    totalJuros: totalComJuros - valor,
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
  valorLote: number = 48000
): JurosObra[] {
  const taxaMensal = taxaAnualParaMensal(taxaAnual);

  // Mês 1: 80% do Lote (Liberado na assinatura)
  // Mês 5: 100% (Obra concluída)
  // Intermediário: Progressão linear entre Assinatura e Conclusão
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
export interface FaixaMCMV {
  id: number;
  nome: string;
  rendaMin: number;
  rendaMax: number;
  subsidioMax: number;
  subsidioMin: number;
  taxa: number;
  cor: string;
}

export function calcularSubsidio(
  renda: number,
  faixas: FaixaMCMV[]
): { faixa: FaixaMCMV | null; subsidio: number; taxa: number } {
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
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

export function formatBRLDecimal(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}
