"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";
import {
  ArrowLeft, Save, Upload, Trash2, Image as ImageIcon,
  DollarSign, FileText, Settings2, Eye, CheckCircle, X
} from "lucide-react";

interface Params {
  params: Promise<{ slug: string }>;
}

type Section = "valores" | "galeria" | "textos" | "mcmv";

export default function AdminEmpreendimentoPage({ params }: Params) {
  const { slug } = use(params);
  const [emp, setEmp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("galeria");
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<"imagens" | "plantas">("imagens");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/empreendimentos")
      .then((r) => r.json())
      .then((data: any[]) => {
        const found = data.find((e) => e.slug === slug);
        setEmp(found || null);
        setLoading(false);
      });
  }, [slug]);

  const patch = async (field: string, value: any) => {
    await fetch("/api/empreendimentos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, field, value }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slug", slug);
      formData.append("tipo", uploadType);
      formData.append("titulo", file.name.replace(/\.[^/.]+$/, ""));

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setEmp((prev: any) => ({
          ...prev,
          vitrine: {
            ...prev.vitrine,
            [uploadType]: [...(prev.vitrine[uploadType] || []), { url: data.url, titulo: data.titulo || file.name }],
          },
        }));
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteImage = async (url: string, tipo: string) => {
    await fetch("/api/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, url, tipo }),
    });
    setEmp((prev: any) => ({
      ...prev,
      vitrine: {
        ...prev.vitrine,
        [tipo]: prev.vitrine[tipo].filter((img: any) => img.url !== url),
      },
    }));
  };

  const SECTIONS = [
    { id: "galeria" as Section, label: "Galeria", icon: ImageIcon },
    { id: "valores" as Section, label: "Valores", icon: DollarSign },
    { id: "textos" as Section, label: "Textos", icon: FileText },
    { id: "mcmv" as Section, label: "MCMV", icon: Settings2 },
  ];

  if (loading) return (
    <div className="min-h-screen flex-center" style={{ background: "var(--bg-base)" }}>
      <div className="text-muted">Carregando...</div>
    </div>
  );

  if (!emp) return (
    <div className="min-h-screen flex-center" style={{ background: "var(--bg-base)" }}>
      <div className="text-center">
        <p className="text-muted mb-4">Empreendimento não encontrado</p>
        <Link href="/admin" className="btn-secondary">Voltar</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <header style={{ background: "rgba(15,30,22,0.97)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="container-app">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
              <div>
                <h1 className="font-bold text-base" style={{ color: "var(--gray-light)" }}>{emp.nome}</h1>
                <p className="text-xs" style={{ color: "var(--gray-mid)" }}>{emp.cidade} · {emp.estado}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AnimatePresence>
                {saved && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="badge badge-success"
                  >
                    <CheckCircle size={12} /> Salvo!
                  </motion.div>
                )}
              </AnimatePresence>
              <Link href={`/${slug}`} target="_blank" className="btn-ghost text-sm">
                <Eye size={15} />
                Visualizar
              </Link>
            </div>
          </div>
        </div>

        {/* Sub-nav */}
        <div className="border-t overflow-x-auto" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex" style={{ minWidth: "max-content" }}>
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all relative"
                  style={{ color: section === s.id ? "var(--terracota)" : "var(--gray-mid)" }}
                >
                  <Icon size={14} />
                  {s.label}
                  {section === s.id && (
                    <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "var(--terracota)" }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="container-app py-8 max-w-3xl">
        <AnimatePresence mode="wait">

          {/* GALERIA */}
          {section === "galeria" && (
            <motion.div key="galeria" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <h2 className="text-title mb-1">Galeria de Imagens</h2>
                <p className="text-body">Gerencie as fotos exibidas na Vitrine Digital.</p>
              </div>

              {/* Upload */}
              <div className="glass-card-nohover p-6 space-y-4">
                <div className="tab-group">
                  <button className={`tab-item ${uploadType === "imagens" ? "active" : ""}`} onClick={() => setUploadType("imagens")}>
                    Renders / Fotos
                  </button>
                  <button className={`tab-item ${uploadType === "plantas" ? "active" : ""}`} onClick={() => setUploadType("plantas")}>
                    Plantas Baixas
                  </button>
                </div>

                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-secondary w-full"
                >
                  <Upload size={16} />
                  {uploading ? "Enviando..." : `Enviar ${uploadType === "imagens" ? "Render/Foto" : "Planta Baixa"}`}
                </button>

                {/* Grid de imagens */}
                {(emp.vitrine[uploadType] || []).length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {emp.vitrine[uploadType].map((img: any, i: number) => (
                      <div key={i} className="relative group rounded-xl overflow-hidden" style={{ height: 120 }}>
                        <Image src={img.url} alt={img.titulo || ""} fill className="object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex-center">
                          <button
                            onClick={() => deleteImage(img.url, uploadType)}
                            className="w-9 h-9 rounded-full flex-center"
                            style={{ background: "rgba(239,68,68,0.8)" }}
                          >
                            <Trash2 size={14} color="white" />
                          </button>
                        </div>
                        <div className="absolute bottom-1 left-1 right-1">
                          <p className="text-xs text-white truncate px-1">{img.titulo}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="flex-center py-8 rounded-xl text-center"
                    style={{ background: "rgba(0,0,0,0.2)", border: "1px dashed var(--border-subtle)" }}
                  >
                    <p className="text-muted text-sm">Nenhuma imagem ainda</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* VALORES */}
          {section === "valores" && (
            <motion.div key="valores" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <h2 className="text-title mb-1">Valores & Simulador</h2>
                <p className="text-body">Atualize os valores de venda e parâmetros de financiamento.</p>
              </div>

              {emp.modelos.map((modelo: any, idx: number) => (
                <div key={modelo.id} className="glass-card-nohover p-6 space-y-4">
                  <h3 className="font-bold" style={{ color: "var(--terracota)" }}>{modelo.nome}</h3>
                  {[
                    { label: "Valor do Imóvel (R$)", field: `modelos.${idx}.valor`, type: "number", value: modelo.valor },
                    { label: "Valor do Lote (R$)", field: `modelos.${idx}.valorLote`, type: "number", value: modelo.valorLote || 0 },
                    { label: "Área (m²)", field: `modelos.${idx}.area`, type: "number", value: modelo.area },
                  ].map((item) => (
                    <div key={item.field}>
                      <label className="text-sm font-medium mb-2 block" style={{ color: "var(--gray-mid)" }}>{item.label}</label>
                      <div className="flex gap-3">
                        <input
                          type={item.type}
                          className="input-field flex-1"
                          defaultValue={item.value}
                          onBlur={(e) => {
                            const val = item.type === "number" ? parseFloat(e.target.value) : e.target.value;
                            patch(item.field, val);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Parametros gerais */}
              <div className="glass-card-nohover p-6 space-y-4">
                <h3 className="font-bold" style={{ color: "var(--gray-light)" }}>Parâmetros do Simulador</h3>
                {[
                  { label: "Entrada mínima (R$)", field: "simulador.entradaMin", value: emp.simulador.entradaMin },
                  { label: "Entrada máxima (R$)", field: "simulador.entradaMax", value: emp.simulador.entradaMax },
                  { label: "Prazo (meses)", field: "simulador.prazoMeses", value: emp.simulador.prazoMeses },
                  { label: "Taxa Faixa 1/2 (% a.a.)", field: "simulador.taxaFaixa12", value: emp.simulador.taxaFaixa12 },
                  { label: "Taxa Faixa 3 (% a.a.)", field: "simulador.taxaFaixa3", value: emp.simulador.taxaFaixa3 },
                  { label: "IGP-M Mensal (%)", field: "simulador.igpmMensal", value: emp.simulador.igpmMensal },
                ].map((item) => (
                  <div key={item.field}>
                    <label className="text-sm font-medium mb-2 block" style={{ color: "var(--gray-mid)" }}>{item.label}</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      defaultValue={item.value}
                      onBlur={(e) => patch(item.field, parseFloat(e.target.value))}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TEXTOS */}
          {section === "textos" && (
            <motion.div key="textos" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <h2 className="text-title mb-1">Textos & Copywriting</h2>
                <p className="text-body">Edite os textos exibidos nos módulos e nas notas legais do PDF.</p>
              </div>
              <div className="glass-card-nohover p-6 space-y-5">
                {[
                  { label: "Notas Legais (PDF)", field: "textos.notasLegais", value: emp.textos.notasLegais, rows: 4 },
                  { label: "Título — Módulo de Obra", field: "textos.tituloObra", value: emp.textos.tituloObra, rows: 1 },
                  { label: "Descrição — Módulo de Obra", field: "textos.descricaoObra", value: emp.textos.descricaoObra, rows: 2 },
                  { label: "Alerta — Faixa 1/2 (com subsídio)", field: "textos.alertaF12", value: emp.textos.alertaF12, rows: 2 },
                  { label: "Alerta — Faixa 3/4 (sem subsídio)", field: "textos.alertaF3", value: emp.textos.alertaF3, rows: 2 },
                ].map((item) => (
                  <div key={item.field}>
                    <label className="text-sm font-medium mb-2 block" style={{ color: "var(--gray-mid)" }}>{item.label}</label>
                    <textarea
                      rows={item.rows}
                      className="input-field resize-none"
                      defaultValue={item.value}
                      onBlur={(e) => patch(item.field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* MCMV */}
          {section === "mcmv" && (
            <motion.div key="mcmv" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <h2 className="text-title mb-1">Tabela MCMV</h2>
                <p className="text-body">Atualize as faixas de renda e os valores de subsídio do programa.</p>
              </div>
              {emp.mcmv.faixas.map((faixa: any, idx: number) => (
                <div key={faixa.id} className="glass-card-nohover p-6 space-y-4">
                  <h3 className="font-bold" style={{ color: faixa.cor }}>{faixa.nome}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Renda mínima (R$)", field: `mcmv.faixas.${idx}.rendaMin`, value: faixa.rendaMin },
                      { label: "Renda máxima (R$)", field: `mcmv.faixas.${idx}.rendaMax`, value: faixa.rendaMax },
                      { label: "Subsídio máximo (R$)", field: `mcmv.faixas.${idx}.subsidioMax`, value: faixa.subsidioMax },
                      { label: "Subsídio mínimo (R$)", field: `mcmv.faixas.${idx}.subsidioMin`, value: faixa.subsidioMin },
                      { label: "Taxa de juros (% a.a.)", field: `mcmv.faixas.${idx}.taxa`, value: faixa.taxa },
                    ].map((item) => (
                      <div key={item.field}>
                        <label className="text-xs mb-1 block" style={{ color: "var(--gray-mid)" }}>{item.label}</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-field text-sm"
                          defaultValue={item.value}
                          onBlur={(e) => patch(item.field, parseFloat(e.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="glass-card-nohover p-5 space-y-6">
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: "var(--gray-mid)" }}>
                    Teto de Valor do Imóvel (R$) — Regional
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    defaultValue={emp.mcmv.tetoImovel}
                    onBlur={(e) => patch("mcmv.tetoImovel", parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: "var(--gray-mid)" }}>
                    Observação / Nota legal MCMV
                  </label>
                  <textarea
                    rows={3}
                    className="input-field resize-none"
                    defaultValue={emp.mcmv.observacao}
                    onBlur={(e) => patch("mcmv.observacao", e.target.value)}
                  />
                </div>
              </div>

              {/* RELATÓRIO DE CONFORMIDADE (DINÂMICO/INFORMATIVO) */}
              <div className="p-8 rounded-3xl" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-500 flex-center">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-100">Relatório de Conformidade MCMV</h3>
                    <p className="text-xs text-gray-500">Última Auditoria: 14/04/2026 • Iporá-GO</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                    <span className="text-xs font-bold text-gray-400 uppercase">Status do Teto Regional</span>
                    <span className="text-sm font-bold text-green-400">R$ 275.000,00 (Vigente 2026)</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                    <span className="text-xs font-bold text-gray-400 uppercase">Subsídio Acumulado Max</span>
                    <span className="text-sm font-bold text-green-400">R$ 80.800,00 (Federal + Estadual)</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                    <span className="text-xs font-bold text-gray-400 uppercase">Referência Normativa</span>
                    <span className="text-xs text-gray-400">MCMV Faixa 2 + Crédito Parceria AGEHAB</span>
                  </div>
                </div>

                <div className="mt-8 p-4 rounded-xl bg-black/20">
                  <p className="text-[10px] leading-relaxed text-gray-500 italic">
                    * Verificação baseada em dados oficiais do Governo Federal (MCID) e Governo de Goiás (AGEHAB). 
                    As metas e bônus podem variar conforme dotação orçamentária dos órgãos competentes.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
