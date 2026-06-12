"use client";

import React from "react";
import { ImageIcon, Plus, Trash2, Star, ToggleLeft, ToggleRight } from "lucide-react";

// ─────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────

export interface Fachada {
  id: string;
  nome: string;
  imagemUrl: string;
  diferencaPreco: number;
  ativo: boolean;
  isPadrao: boolean;
}

interface FachadaAdminProps {
  modelo: any;       // modelo atual (precisa de .fachadas e .exibirSeletorFachada)
  idx: number;       // índice do modelo no array emp.modelos
  slug: string;
  update: (field: string, value: any) => void;
}

// ─────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────

export function FachadaAdmin({ modelo, idx, slug, update }: FachadaAdminProps) {
  const fachadas: Fachada[] = modelo.fachadas ?? [];
  const exibir: boolean = modelo.exibirSeletorFachada ?? false;
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);
  const fileRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  const setFachadas = (novas: Fachada[]) => update(`modelos.${idx}.fachadas`, novas);

  const addFachada = () => {
    const nova: Fachada = {
      id: `fachada_${Date.now()}`,
      nome: `Fachada ${fachadas.length + 1}`,
      imagemUrl: "",
      diferencaPreco: 0,
      ativo: true,
      isPadrao: fachadas.length === 0, // primeira criada vira padrão
    };
    setFachadas([...fachadas, nova]);
  };

  const patchFachada = (id: string, patch: Partial<Fachada>) => {
    setFachadas(fachadas.map(f => f.id === id ? { ...f, ...patch } : f));
  };

  const removeFachada = (id: string) => {
    if (!confirm("Remover esta fachada?")) return;
    let novas = fachadas.filter(f => f.id !== id);
    // se removeu a padrão, promove a primeira restante
    if (novas.length > 0 && !novas.some(f => f.isPadrao)) {
      novas = novas.map((f, i) => ({ ...f, isPadrao: i === 0 }));
    }
    setFachadas(novas);
  };

  const setPadrao = (id: string) => {
    setFachadas(fachadas.map(f => ({ ...f, isPadrao: f.id === id })));
  };

  const handleUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", slug);
      fd.append("tipo", "fachadas");
      fd.append("titulo", `Fachada — ${modelo.nome}`);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) patchFachada(id, { imagemUrl: data.url });
    } finally {
      setUploadingId(null);
      const ref = fileRefs.current[id];
      if (ref) ref.value = "";
    }
  };

  return (
    <div>
      {/* Header — toggle global */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-light)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            🏠 Fachadas do Modelo
          </p>
          <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 3 }}>
            Variações de fachada com diferença de preço no simulador
          </p>
        </div>
        <button
          onClick={() => update(`modelos.${idx}.exibirSeletorFachada`, !exibir)}
          style={{
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            padding: "7px 12px", borderRadius: 9, cursor: "pointer",
            fontWeight: 700, fontSize: 11, border: "none", transition: "0.2s",
            background: exibir ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.07)",
            color: exibir ? "#4ade80" : "var(--gray-mid)",
          }}
        >
          {exibir ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          {exibir ? "Seletor Visível" : "Seletor Oculto"}
        </button>
      </div>

      {/* Lista de fachadas */}
      {fachadas.length === 0 ? (
        <div style={{ padding: "16px", borderRadius: 10, background: "rgba(0,0,0,0.15)", border: "1px dashed var(--border-subtle)", textAlign: "center", marginBottom: 10 }}>
          <p style={{ fontSize: 12, color: "var(--gray-dark)" }}>Nenhuma fachada cadastrada — o card usa a imagem padrão do modelo.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
          {fachadas.map(f => (
            <div key={f.id} style={{
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              padding: "10px 12px", borderRadius: 10,
              background: f.ativo ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.35)",
              border: `1px solid ${f.isPadrao ? "var(--border-active)" : "var(--border-subtle)"}`,
              opacity: f.ativo ? 1 : 0.55,
            }}>
              {/* Thumb / upload */}
              <input
                ref={el => { fileRefs.current[f.id] = el; }}
                type="file" accept="image/*" className="hidden"
                onChange={(e) => handleUpload(f.id, e)}
              />
              <button
                onClick={() => fileRefs.current[f.id]?.click()}
                disabled={uploadingId === f.id}
                title={f.imagemUrl ? "Trocar imagem" : "Upload imagem"}
                style={{
                  width: 52, height: 52, borderRadius: 8, flexShrink: 0, cursor: "pointer",
                  border: "1px solid var(--border-subtle)", overflow: "hidden",
                  background: "rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                }}
              >
                {uploadingId === f.id ? (
                  <span style={{ fontSize: 10, color: "var(--gray-mid)" }}>...</span>
                ) : f.imagemUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.imagemUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <ImageIcon size={18} color="var(--gray-dark)" />
                )}
              </button>

              {/* Nome */}
              <input
                value={f.nome}
                onChange={(e) => patchFachada(f.id, { nome: e.target.value })}
                placeholder="Nome da fachada"
                style={{
                  flex: 1, minWidth: 120, padding: "8px 10px", borderRadius: 8,
                  background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)",
                  color: "var(--gray-light)", fontSize: 12, fontWeight: 600,
                }}
              />

              {/* Diferença de preço */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "var(--gray-dark)" }}>±R$</span>
                <input
                  type="number"
                  value={f.diferencaPreco}
                  onChange={(e) => patchFachada(f.id, { diferencaPreco: Number(e.target.value) || 0 })}
                  style={{
                    width: 90, padding: "8px 10px", borderRadius: 8,
                    background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)",
                    color: f.diferencaPreco > 0 ? "#4ade80" : f.diferencaPreco < 0 ? "#fb923c" : "var(--gray-light)",
                    fontSize: 12, fontWeight: 700,
                  }}
                />
              </div>

              {/* Padrão */}
              <button
                onClick={() => setPadrao(f.id)}
                title="Marcar como fachada padrão"
                style={{
                  display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                  padding: "6px 9px", borderRadius: 8, cursor: "pointer", border: "none",
                  fontSize: 10, fontWeight: 700,
                  background: f.isPadrao ? "var(--terracota-glow)" : "rgba(255,255,255,0.05)",
                  color: f.isPadrao ? "var(--terracota-light)" : "var(--gray-dark)",
                }}
              >
                <Star size={12} fill={f.isPadrao ? "currentColor" : "none"} />
                {f.isPadrao ? "Padrão" : ""}
              </button>

              {/* Ativo */}
              <button
                onClick={() => patchFachada(f.id, { ativo: !f.ativo })}
                title={f.ativo ? "Desativar" : "Ativar"}
                style={{
                  flexShrink: 0, padding: "6px 9px", borderRadius: 8, cursor: "pointer", border: "none",
                  fontSize: 10, fontWeight: 700,
                  background: f.ativo ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.05)",
                  color: f.ativo ? "#4ade80" : "var(--gray-dark)",
                }}
              >
                {f.ativo ? "Ativa" : "Inativa"}
              </button>

              {/* Remover */}
              <button
                onClick={() => removeFachada(f.id)}
                style={{
                  flexShrink: 0, padding: 7, borderRadius: 8, cursor: "pointer",
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#f87171", display: "flex",
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Adicionar */}
      <button
        onClick={addFachada}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 16px", borderRadius: 8, cursor: "pointer",
          background: "var(--terracota-glow)", border: "1px solid var(--border-active)",
          color: "var(--terracota)", fontSize: 12, fontWeight: 700,
        }}
      >
        <Plus size={14} /> Adicionar Fachada
      </button>
    </div>
  );
}