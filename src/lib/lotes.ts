// ─────────────────────────────────────────────────────────
// LÓGICA DE LOTES — fonte única de verdade
//
// Hierarquia do "lote padrão efetivo" de um modelo:
//   1º  lote ★ vinculado especificamente ao modelo (mais específico vence)
//   2º  lote ★ vinculado a "Todos" (padrão global)
//   3º  o lote mais barato visível para o modelo (fallback automático)
//
// Usado por: LoteSelector, ModelSelector, EmpreendimentoApp e admin.
// ─────────────────────────────────────────────────────────

export interface LoteInfo {
  id: string;
  nome: string;
  tipo?: string;
  medida?: string;
  valor: number;
  ativo?: boolean;
  isPadrao?: boolean;
  modelosVinculados?: string[];
  frente?: number;
  profundidade?: number;
  areaM2?: number;
}

/** Lotes ativos visíveis para um modelo (vínculo vazio = todos os modelos). */
export function lotesVisiveis(lotes: LoteInfo[] | undefined, modeloId: string): LoteInfo[] {
  return (lotes || []).filter(l => {
    if (l.ativo === false) return false;
    const vinc = l.modelosVinculados ?? [];
    return vinc.length === 0 || vinc.includes(modeloId);
  });
}

/** Resolve o lote padrão efetivo de um modelo seguindo a hierarquia. */
export function padraoDoModelo(lotes: LoteInfo[] | undefined, modeloId: string): LoteInfo | null {
  const visiveis = lotesVisiveis(lotes, modeloId);
  if (visiveis.length === 0) return null;

  // 1º — padrão específico do modelo
  const especifico = visiveis
    .filter(l => l.isPadrao && (l.modelosVinculados ?? []).length > 0)
    .sort((a, b) => a.valor - b.valor)[0];
  if (especifico) return especifico;

  // 2º — padrão global (vinculado a Todos)
  const global = visiveis.find(l => l.isPadrao && (l.modelosVinculados ?? []).length === 0);
  if (global) return global;

  // 3º — mais barato visível
  return [...visiveis].sort((a, b) => a.valor - b.valor)[0];
}