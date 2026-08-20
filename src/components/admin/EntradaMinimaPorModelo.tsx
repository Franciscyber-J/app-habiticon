"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, CheckSquare, Square, Info, AlertTriangle } from "lucide-react";

// ─────────────────────────────────────────────────────────
// EntradaMinimaPorModelo
// Override de entrada mínima por modelo.
//   campo vazio         => usa o PADRÃO do empreendimento (simulador.entradaMin)
//   número (inclusive 0) => override próprio daquele modelo
// Grava em modelos[idx].entradaMin — null significa "usar padrão".
// A LEITURA em todo o sistema é feita por entradaMinimaDoModelo() de @/lib/calculos.
// ─────────────────────────────────────────────────────────

interface Props {
  emp: any;
  update: (field: string, value: any) => void;
}

const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR");

function temOverride(m: any): boolean {
  const b = m?.entradaMin;
  if (b === null || b === undefined || b === "") return false;
  const n = Number(b);
  return Number.isFinite(n) && n >= 0;
}

function pisoDe(m: any, padrao: number): number {
  return temOverride(m) ? Number(m.entradaMin) : padrao;
}

// ── Linha de um modelo ──────────────────────────────────
function LinhaModelo({ m, idx, padrao, marcado, onMarcar, update }: {
  m: any;
  idx: number;
  padrao: number;
  marcado: boolean;
  onMarcar: () => void;
  update: (field: string, value: any) => void;
}) {
  const custom = temOverride(m);
  const valorSalvo = custom ? String(Number(m.entradaMin)) : "";
  const [local, setLocal] = useState(valorSalvo);
  useEffect(() => { setLocal(valorSalvo); }, [valorSalvo]);

  const commit = () => {
    const txt = String(local).trim();
    if (txt === "") {
      if (custom) update(`modelos.${idx}.entradaMin`, null);
      return;
    }
    const n = Number(txt.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) { setLocal(valorSalvo); return; }
    if (!custom || n !== Number(m.entradaMin)) update(`modelos.${idx}.entradaMin`, n);
  };

  const voltarAoPadrao = () => {
    setLocal("");
    if (custom) update(`modelos.${idx}.entradaMin`, null);
  };

  const efetivo = pisoDe(m, padrao);
  const Check = marcado ? CheckSquare : Square;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      padding: "12px 14px", borderRadius: 10,
      background: custom ? "rgba(175,111,83,0.07)" : "rgba(0,0,0,0.22)",
      border: `1px solid ${custom ? "var(--border-active)" : "var(--border-subtle)"}`,
    }}>
      <button
        type="button"
        onClick={onMarcar}
        title="Marcar para aplicação em lote"
        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}
      >
        <Check size={17} color={marcado ? "var(--terracota)" : "var(--gray-dark)"} />
      </button>

      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-light)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {m.nome || `Modelo ${idx + 1}`}
        </p>
        <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 2 }}>
          {m.area ? `${m.area}m² · ` : ""}R$ {fmt(m.valor || 0)}
        </p>
      </div>

      <div style={{ position: "relative", flex: "0 1 190px", minWidth: 150 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 700, color: custom ? "var(--terracota)" : "var(--gray-dark)", pointerEvents: "none" }}>
          R$
        </span>
        <input
          type="number"
          min={0}
          step={1000}
          className="input-field"
          style={{ paddingLeft: 38, paddingRight: 12, paddingTop: 10, paddingBottom: 10, fontSize: 14 }}
          value={local}
          placeholder={`padrão (${fmt(padrao)})`}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
          padding: "4px 8px", borderRadius: 6, whiteSpace: "nowrap",
          background: custom ? "rgba(175,111,83,0.18)" : "rgba(255,255,255,0.05)",
          color: custom ? "var(--terracota-light)" : "var(--gray-dark)",
        }}>
          {custom ? `próprio · R$ ${fmt(efetivo)}` : `padrão · R$ ${fmt(efetivo)}`}
        </span>
        <button
          type="button"
          onClick={voltarAoPadrao}
          disabled={!custom}
          title="Voltar ao padrão do empreendimento"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: 8,
            background: "transparent",
            border: `1px solid ${custom ? "var(--border-subtle)" : "transparent"}`,
            cursor: custom ? "pointer" : "default",
            opacity: custom ? 1 : 0.25, flexShrink: 0,
          }}
        >
          <RotateCcw size={13} color="var(--gray-mid)" />
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────
export function EntradaMinimaPorModelo({ emp, update }: Props) {
  const modelos: any[] = emp?.modelos || [];
  const padrao = Number(emp?.simulador?.entradaMin) || 0;

  const [marcados, setMarcados] = useState<string[]>([]);
  const [valorLote, setValorLote] = useState("");

  const idsValidos = useMemo(() => modelos.map((m: any) => m.id), [modelos]);
  const marcadosValidos = useMemo(() => marcados.filter(id => idsValidos.includes(id)), [marcados, idsValidos]);
  const todosMarcados = modelos.length > 0 && marcadosValidos.length === modelos.length;

  const toggle = (id: string) =>
    setMarcados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleTodos = () =>
    setMarcados(todosMarcados ? [] : idsValidos);

  const aplicarEmLote = () => {
    const txt = String(valorLote).trim();
    if (txt === "" || marcadosValidos.length === 0) return;
    const n = Number(txt.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    modelos.forEach((m: any, i: number) => {
      if (marcadosValidos.includes(m.id)) update(`modelos.${i}.entradaMin`, n);
    });
    setValorLote("");
  };

  const padraoEmLote = () => {
    if (marcadosValidos.length === 0) return;
    modelos.forEach((m: any, i: number) => {
      if (marcadosValidos.includes(m.id) && temOverride(m)) update(`modelos.${i}.entradaMin`, null);
    });
  };

  const maiorPiso = modelos.length > 0
    ? Math.max(...modelos.map((m: any) => pisoDe(m, padrao)))
    : padrao;
  const entradaMax = Number(emp?.simulador?.entradaMax) || 0;
  const estouraSlider = entradaMax > 0 && maiorPiso > entradaMax;

  const qtdCustom = modelos.filter(temOverride).length;
  const Check = todosMarcados ? CheckSquare : Square;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Entrada mínima por modelo
        </p>
        <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 3, lineHeight: 1.5 }}>
          Deixe em branco para usar o padrão acima. Preencha para dar um piso próprio ao modelo — vale no simulador,
          no comparador, no cálculo do correspondente e na ficha do corretor.
          {qtdCustom > 0 && ` ${qtdCustom} de ${modelos.length} com valor próprio.`}
        </p>
      </div>

      {/* Aplicação em lote */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "10px 14px", borderRadius: 10,
        background: "rgba(0,0,0,0.28)", border: "1px solid var(--border-subtle)",
      }}>
        <button
          type="button"
          onClick={toggleTodos}
          style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
        >
          <Check size={16} color={todosMarcados ? "var(--terracota)" : "var(--gray-dark)"} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase" }}>
            {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
          </span>
        </button>

        <div style={{ position: "relative", flex: "1 1 150px", minWidth: 140 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 700, color: "var(--terracota)", pointerEvents: "none" }}>
            R$
          </span>
          <input
            type="number"
            min={0}
            step={1000}
            className="input-field"
            style={{ paddingLeft: 38, paddingRight: 12, paddingTop: 9, paddingBottom: 9, fontSize: 14 }}
            value={valorLote}
            placeholder="valor em lote"
            onChange={(e) => setValorLote(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={aplicarEmLote}
          disabled={marcadosValidos.length === 0 || String(valorLote).trim() === ""}
          style={{
            padding: "9px 14px", borderRadius: 9, border: "1px solid var(--border-active)",
            background: marcadosValidos.length > 0 && String(valorLote).trim() !== "" ? "var(--terracota)" : "rgba(255,255,255,0.05)",
            color: marcadosValidos.length > 0 && String(valorLote).trim() !== "" ? "white" : "var(--gray-dark)",
            fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            cursor: marcadosValidos.length > 0 && String(valorLote).trim() !== "" ? "pointer" : "default",
          }}
        >
          Aplicar aos marcados ({marcadosValidos.length})
        </button>

        <button
          type="button"
          onClick={padraoEmLote}
          disabled={marcadosValidos.length === 0}
          style={{
            padding: "9px 14px", borderRadius: 9, border: "1px solid var(--border-subtle)",
            background: "transparent", color: "var(--gray-mid)",
            fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            cursor: marcadosValidos.length > 0 ? "pointer" : "default",
            opacity: marcadosValidos.length > 0 ? 1 : 0.4,
          }}
        >
          Voltar ao padrão
        </button>
      </div>

      {/* Lista de modelos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {modelos.map((m: any, i: number) => (
          <LinhaModelo
            key={m.id || i}
            m={m}
            idx={i}
            padrao={padrao}
            marcado={marcadosValidos.includes(m.id)}
            onMarcar={() => toggle(m.id)}
            update={update}
          />
        ))}
      </div>

      {estouraSlider && (
        <div style={{ display: "flex", gap: 9, padding: "10px 13px", borderRadius: 9, background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.28)" }}>
          <AlertTriangle size={14} color="#fb923c" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11, color: "#fed7aa", lineHeight: 1.55 }}>
            O maior piso configurado (R$ {fmt(maiorPiso)}) passou da <strong>Entrada Máxima</strong> (R$ {fmt(entradaMax)}).
            Suba o teto do slider para o cliente conseguir mover a entrada nesses modelos.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 9, padding: "10px 13px", borderRadius: 9, background: "rgba(175,111,83,0.06)", border: "1px solid var(--border-subtle)" }}>
        <Info size={13} color="var(--terracota)" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 11, color: "var(--gray-mid)", lineHeight: 1.55 }}>
          Este é o <strong>piso comercial</strong>. A entrada real ainda pode subir acima dele quando o laudo CUB ou a
          renda do cliente não cobrirem o financiamento — o motor sempre pega o mais restritivo.
        </p>
      </div>
    </div>
  );
}