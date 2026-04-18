"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";
import {
  ArrowLeft, Upload, Trash2, Image as ImageIcon,
  DollarSign, FileText, Settings2, Eye, CheckCircle,
  Info, Save, AlertCircle, MapPin, ExternalLink, LogOut,
} from "lucide-react";

type Section = "valores" | "galeria" | "textos" | "mcmv" | "localizacao";
type SaveState = "idle" | "saving" | "saved" | "error";
interface Params { params: Promise<{ slug: string }> }

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-mid)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {children}
      </label>
      {hint && <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 3, lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );
}

function NumInput({ value, onChange, prefix, suffix, step = 1, min = 0, placeholder }: {
  value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; step?: number; min?: number; placeholder?: string;
}) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const commit = () => { const n = parseFloat(local) || 0; if (n !== value) onChange(n); };
  return (
    <div style={{ position: "relative" }}>
      {prefix && <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--terracota)", fontWeight: 700, pointerEvents: "none" }}>{prefix}</span>}
      <input type="number" className="input-field" style={{ paddingLeft: prefix ? 40 : 14, paddingRight: suffix ? 52 : 14, fontSize: 15 }}
        value={local} step={step} min={min} placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)} onBlur={commit} />
      {suffix && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--gray-dark)", pointerEvents: "none" }}>{suffix}</span>}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 28, boxShadow: "var(--shadow-card)" }}>
      <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-light)" }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: "var(--gray-dark)", marginTop: 4, lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
function Two({ children }: { children: React.ReactNode }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>{children}</div>; }
function Hr() { return <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />; }

import React from "react";

// ─── Ambientes disponíveis ───────────────────────────────
const AMBIENTES_LISTA = [
  { id:"garagem",         label:"Garagem",          icone:"🚗" },
  { id:"sala",            label:"Sala",              icone:"🛋️" },
  { id:"cozinha",         label:"Cozinha",           icone:"🍳" },
  { id:"copa",            label:"Copa",              icone:"🍽️" },
  { id:"quarto_master",   label:"Quarto Master",     icone:"👑" },
  { id:"banheiro_suite",  label:"Banheiro Suíte",    icone:"🚿" },
  { id:"quarto_solteiro", label:"Quarto Solteiro",   icone:"🛏️" },
  { id:"quarto_2",        label:"Quarto 2",          icone:"🛏️" },
  { id:"banheiro_social", label:"Banheiro Social",   icone:"🚽" },
  { id:"lavanderia",      label:"Lavanderia",        icone:"🧺" },
  { id:"area_gourmet",    label:"Área Gourmet",      icone:"🔥" },
] as const;

// Mini-componente de upload por ambiente
function AmbienteUpload({ amb, fotos, slug, onAdd, onRemove }: {
  amb: {id:string;label:string;icone:string};
  fotos: {url:string;titulo?:string}[];
  slug: string;
  onAdd: (foto:{url:string;titulo:string}) => void;
  onRemove: (url:string) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const ref = React.useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file); fd.append("slug", slug);
        fd.append("tipo", `ambiente_${amb.id}`); fd.append("titulo", amb.label);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.url) onAdd({ url: data.url, titulo: amb.label });
      }
    } finally { setUploading(false); if (ref.current) ref.current.value = ""; }
  };

  return (
    <div style={{padding:"16px",borderRadius:12,background:"rgba(0,0,0,0.15)",border:"1px solid var(--border-subtle)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>{amb.icone}</span>
          <span style={{fontSize:13,fontWeight:700,color:"var(--gray-light)"}}>{amb.label}</span>
          <span style={{fontSize:11,color:"var(--gray-dark)"}}>{fotos.length} foto{fotos.length!==1?"s":""}</span>
        </div>
        <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={handleFile}/>
        <button onClick={()=>ref.current?.click()} disabled={uploading}
          style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,cursor:"pointer",border:"1px solid var(--border-active)",background:"transparent",color:"var(--terracota)",fontSize:12,fontWeight:600}}>
          {uploading?"Enviando...":"+ Foto"}
        </button>
      </div>
      {fotos.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {fotos.map((f,i)=>(
            <div key={i} className="relative group rounded-xl overflow-hidden" style={{height:80}}>
              <Image src={f.url} alt={f.titulo||""} fill className="object-cover"/>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex-center">
                <button onClick={()=>onRemove(f.url)} className="w-7 h-7 rounded-full flex-center" style={{background:"rgba(239,68,68,0.85)"}}>
                  <Trash2 size={11} color="white"/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Parser de coordenadas DMS ────────────────────────────
// Aceita: 16°24'17.1"S 51°06'50.3"W  ← cópia direta do Google Maps
// Aceita: -16.4047, -51.1140          ← decimal simples
function parseDMS(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();

  // Já está em decimal (ex: -16.4047, -51.1140)
  const dec = trimmed.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
  if (dec) return { lat: parseFloat(dec[1]), lng: parseFloat(dec[2]) };

  // DMS com símbolos (ex: 16°24'17.1"S 51°06'50.3"W)
  const dms = trimmed.match(
    /(\d+)[°\s](\d+)['\s](\d+\.?\d*)["]?\s*([NSns])[,\s]+(\d+)[°\s](\d+)['\s](\d+\.?\d*)["]?\s*([EWew])/
  );
  if (!dms) return null;

  const lat = (parseInt(dms[1]) + parseInt(dms[2]) / 60 + parseFloat(dms[3]) / 3600)
    * (/[Ss]/.test(dms[4]) ? -1 : 1);
  const lng = (parseInt(dms[5]) + parseInt(dms[6]) / 60 + parseFloat(dms[7]) / 3600)
    * (/[Ww]/.test(dms[8]) ? -1 : 1);

  return { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };
}

function CoordParser({ lat, lng, onChange }: {
  lat: number; lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const [texto, setTexto] = React.useState("");
  const [erro, setErro] = React.useState("");
  const [ok, setOk] = React.useState(false);
  const [parsed, setParsed] = React.useState<{lat:number;lng:number}|null>(null);

  const aplicar = () => {
    if (!texto.trim()) return;
    const result = parseDMS(texto);
    if (result) {
      onChange(result.lat, result.lng);
      setParsed(result);
      setErro("");
      setOk(true);
      setTimeout(() => { setOk(false); setParsed(null); }, 4000);
    } else {
      setErro("Formato não reconhecido. Cole as coordenadas como aparecem no Google Maps.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <FieldLabel hint="Cole diretamente do Google Maps — qualquer formato aceito">
        Colar Coordenadas
      </FieldLabel>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          className="input-field"
          style={{ flex: 1, fontSize: 14 }}
          placeholder={`16°24'17.1"S 51°06'50.3"W`}
          value={texto}
          onChange={e => { setTexto(e.target.value); setErro(""); setOk(false); }}
          onKeyDown={e => e.key === "Enter" && aplicar()}
        />
        <button
          onClick={aplicar}
          style={{
            padding: "0 18px", borderRadius: 10, cursor: "pointer", border: "none",
            fontWeight: 700, fontSize: 13, flexShrink: 0,
            background: ok ? "#16a34a" : "var(--terracota)", color: "white",
            transition: "background 0.3s",
          }}
        >
          {ok ? "✓ Aplicado" : "Aplicar"}
        </button>
      </div>
      {erro && <p style={{ fontSize: 11, color: "#f87171" }}>⚠️ {erro}</p>}
      {ok && parsed && (
        <p style={{ fontSize: 11, color: "#4ade80" }}>
          ✓ Lat: {parsed.lat} · Lng: {parsed.lng}
        </p>
      )}
    </div>
  );
}

export default function AdminEmpreendimentoPage({ params }: Params) {
  const { slug } = use(params);
  const [emp, setEmp]   = useState<any>(null);
  const [orig, setOrig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("valores");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const fileRef = useRef<HTMLInputElement>(null);
  const [upType, setUpType] = useState<"imagens"|"plantas">("imagens");
  const [uploading, setUploading] = useState(false);

  const isDirty = emp && orig && JSON.stringify(emp) !== JSON.stringify(orig);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (isDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);

  useEffect(() => {
    fetch("/api/empreendimentos").then(r=>r.json()).then((data:any[]) => {
      const f = data.find(e=>e.slug===slug);
      if (f) {
        if (!f.simulador.cub) f.simulador.cub = { bdi:0.18, cubVigente:0 };
        if (!f.simulador.taxaFaixa3Cotista) f.simulador.taxaFaixa3Cotista = 7.66;
        setEmp(f); setOrig(JSON.parse(JSON.stringify(f)));
      }
      setLoading(false);
    });
  }, [slug]);

  const update = useCallback((field: string, value: any) => {
    setEmp((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = field.split(".");
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const k = isNaN(Number(parts[i])) ? parts[i] : Number(parts[i]);
        // Cria objeto intermediário se não existir (ex: vitrine.ambientes.copa)
        if (obj[k] === undefined || obj[k] === null) {
          obj[k] = isNaN(Number(parts[i + 1])) ? {} : [];
        }
        obj = obj[k];
      }
      const last = isNaN(Number(parts[parts.length-1])) ? parts[parts.length-1] : Number(parts[parts.length-1]);
      obj[last] = value;
      return next;
    });
  }, []);

  const fazerLogout = useCallback(async () => {
    if (!confirm("Sair do painel administrativo?")) return;
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/admin/login";
  }, []);

  const salvar = useCallback(async () => {
    if (!emp) return;
    setSaveState("saving");
    try {
      // A API PUT espera o array completo — busca a lista, substitui este item e salva tudo
      const listaAtual = await fetch("/api/empreendimentos").then(r => r.json()) as any[];
      const listaAtualizada = listaAtual.map((e: any) => e.slug === emp.slug ? emp : e);
      const r = await fetch("/api/empreendimentos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(listaAtualizada),
      });
      if (!r.ok) throw new Error(await r.text());
      setOrig(JSON.parse(JSON.stringify(emp)));
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 4000);
    }
  }, [emp]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      // Upload sequencial de múltiplos arquivos
      let listaAtual = [...(emp.vitrine[upType] || [])];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file); fd.append("slug", slug);
        fd.append("tipo", upType); fd.append("titulo", file.name.replace(/\.[^/.]+$/, ""));
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.url) listaAtual = [...listaAtual, { url: data.url, titulo: data.titulo || file.name }];
      }
      update(`vitrine.${upType}`, listaAtual);
      await fetch("/api/empreendimentos", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, field: `vitrine.${upType}`, value: listaAtual }),
      });
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const deleteImage = async (url:string, tipo:string) => {
    await fetch("/api/upload",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,url,tipo})});
    const nova = emp.vitrine[tipo].filter((i:any)=>i.url!==url);
    update(`vitrine.${tipo}`,nova);
    await fetch("/api/empreendimentos",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,field:`vitrine.${tipo}`,value:nova})});
  };

  const diagCUB = emp?.simulador?.cub?.cubVigente > 0 ? emp.modelos.map((m:any) => {
    const {cubVigente,bdi} = emp.simulador.cub;
    const lote = emp.modelos[0]?.valorLote||48000;
    const laudo = lote + m.area*cubVigente*(1+bdi);
    const maxFin = laudo*0.80;
    return { nome:m.nome, laudo, maxFin, entradaMin:Math.max(10000,m.valor-maxFin), funciona:maxFin>=m.valor-10000, cubMin:((m.valor-10000)/0.80-lote)/(m.area*(1+bdi)) };
  }) : null;

  if (loading) return <div className="min-h-screen flex-center" style={{background:"var(--bg-base)"}}><p className="text-muted">Carregando...</p></div>;
  if (!emp) return <div className="min-h-screen flex-center" style={{background:"var(--bg-base)"}}><div className="text-center"><p className="text-muted" style={{marginBottom:16}}>Não encontrado</p><Link href="/admin" className="btn-secondary">Voltar</Link></div></div>;

  const SECTIONS = [
    {id:"valores"     as Section, label:"Valores & CUB",  icon:DollarSign, hint:"Modelos, lotes e CUB"},
    {id:"galeria"     as Section, label:"Galeria",         icon:ImageIcon,  hint:"Fotos e ambientes"},
    {id:"textos"      as Section, label:"Textos",          icon:FileText,   hint:"Textos e alertas"},
    {id:"mcmv"        as Section, label:"MCMV",            icon:Settings2,  hint:"Faixas e subsídios"},
    {id:"localizacao" as Section, label:"Localização",     icon:MapPin,     hint:"Endereço e mapa"},
  ];

  const saveCfg = {
    idle:   { bg: isDirty ? "var(--terracota)" : "rgba(255,255,255,0.08)", color: isDirty ? "white" : "var(--gray-dark)", label: "Salvar alterações", Icon: Save },
    saving: { bg: "var(--terracota-dark)", color: "white", label: "Salvando...", Icon: Save },
    saved:  { bg: "#16a34a",               color: "white", label: "Salvo!",      Icon: CheckCircle },
    error:  { bg: "#dc2626",               color: "white", label: "Erro",        Icon: AlertCircle },
  }[saveState];

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-base)" }}>

      {/* ── SIDEBAR ──────────────────────────────────────── */}
      <aside style={{
        width: 260, minWidth: 260, height: "100vh", position: "sticky", top: 0,
        background: "rgba(15,30,22,0.98)", backdropFilter: "blur(24px)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        flexShrink: 0,
      }}>
        {/* Topo: logo + voltar */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <Link href="/admin" className="btn-ghost" style={{ padding: "8px 10px", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--gray-mid)" }}
            onClick={e => { if (isDirty && !confirm("Alterações não salvas. Sair mesmo assim?")) e.preventDefault(); }}>
            <ArrowLeft size={15} /> Voltar ao Admin
          </Link>
          <Image src="/logo.png" alt="Habiticon" width={200} height={56}
            style={{ height: 56, width: "auto", objectFit: "contain", display: "block", marginBottom: 12 }} priority />
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-subtle)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-light)", marginBottom: 2 }}>{emp.nome}</p>
            <p style={{ fontSize: 11, color: "var(--gray-mid)", display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={10} /> {emp.cidade} · {emp.estado}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const ativo = section === s.id;
              return (
                <button key={s.id} onClick={() => setSection(s.id)} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 14px", borderRadius: 12, border: "none",
                  cursor: "pointer", textAlign: "left", width: "100%",
                  background: ativo ? "var(--terracota-glow)" : "transparent",
                  outline: ativo ? "1px solid var(--border-active)" : "1px solid transparent",
                  transition: "all 150ms ease",
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: ativo ? "var(--terracota)" : "rgba(0,0,0,0.3)",
                    transition: "all 150ms ease",
                  }}>
                    <Icon size={15} color={ativo ? "white" : "var(--gray-mid)"} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: ativo ? "var(--terracota-light)" : "var(--gray-light)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.label}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 1 }}>{s.hint}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Rodapé da sidebar: salvar + visualizar */}
        <div style={{ padding: "12px 10px 16px", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 8 }}>
          <AnimatePresence>
            {isDirty && saveState === "idle" && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 11, color: "#fb923c", display: "flex", alignItems: "center", gap: 6, padding: "0 4px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fb923c", display: "inline-block", flexShrink: 0 }} />
                Alterações não salvas
              </motion.p>
            )}
          </AnimatePresence>
          <button onClick={salvar} disabled={saveState === "saving" || (!isDirty && saveState === "idle")} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "11px 16px", borderRadius: 10, border: "none", cursor: isDirty ? "pointer" : "default",
            fontWeight: 700, fontSize: 13, transition: "all 0.2s",
            background: isDirty || saveState !== "idle" ? (saveState === "idle" ? "var(--terracota)" : saveCfg.bg) : "rgba(255,255,255,0.07)",
            color: isDirty || saveState !== "idle" ? "white" : "var(--gray-dark)",
          }}>
            <saveCfg.Icon size={15} />{saveCfg.label}
          </button>
          <Link href={`/${slug}`} target="_blank" className="btn-ghost" style={{ justifyContent: "center", fontSize: 13, gap: 6 }}>
            <Eye size={14} /> Visualizar site
          </Link>
          <button
            onClick={fazerLogout}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "9px 16px", borderRadius: 10, cursor: "pointer",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#f87171", fontSize: 13, fontWeight: 600,
            }}
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      {/* ── CONTEÚDO ─────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

        {/* Breadcrumb top */}
        <div style={{
          padding: "14px 32px", background: "rgba(15,30,22,0.6)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          {(() => { const s = SECTIONS.find(x => x.id === section); const Icon = s?.icon ?? DollarSign; return (
            <>
              <Icon size={14} color="var(--terracota)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-light)" }}>{s?.label}</span>
              <span style={{ fontSize: 12, color: "var(--gray-dark)" }}>· {s?.hint}</span>
            </>
          ); })()}
        </div>

        <main style={{ flex: 1, overflowY: "auto", padding: "36px 40px 80px" }}>
          <div style={{ maxWidth: 740, margin: "0 auto" }}>

            <AnimatePresence mode="wait">

          {/* VALORES */}
          {section==="valores"&&(
            <motion.div key="v" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{display:"flex",flexDirection:"column",gap:32}}>
              <div><h2 className="text-title" style={{marginBottom:8}}>Valores & Simulador</h2><p className="text-body">Valores de venda, lotes e parâmetros de financiamento.</p></div>

              {emp.modelos.map((m:any,idx:number)=>(
                <Card key={m.id} title={`🏠 ${m.nome} · ${m.area}m²`} subtitle="Valor de venda e configurações">
                  <div style={{display:"flex",flexDirection:"column",gap:20}}>
                    <Two>
                      <div><FieldLabel hint="Preço final ao comprador">Valor do Imóvel (R$)</FieldLabel><NumInput value={m.valor} prefix="R$" onChange={v=>update(`modelos.${idx}.valor`,v)}/></div>
                      <div><FieldLabel hint="Único para todos os modelos">Valor do Lote (R$)</FieldLabel><NumInput value={m.valorLote||48000} prefix="R$" onChange={v=>emp.modelos.forEach((_:any,i:number)=>update(`modelos.${i}.valorLote`,v))}/></div>
                    </Two>
                    <Two>
                      <div><FieldLabel>Área (m²)</FieldLabel><NumInput value={m.area} suffix="m²" onChange={v=>update(`modelos.${idx}.area`,v)}/></div>
                      <div><FieldLabel>Quartos</FieldLabel><NumInput value={m.quartos} min={1} onChange={v=>update(`modelos.${idx}.quartos`,v)}/></div>
                    </Two>
                    {idx===0&&emp.modelos.length>1&&(
                      <div style={{display:"flex",gap:8,padding:"10px 12px",borderRadius:8,background:"rgba(175,111,83,0.07)",border:"1px solid rgba(175,111,83,0.2)"}}>
                        <Info size={13} color="var(--terracota)" style={{flexShrink:0,marginTop:1}}/><p style={{fontSize:11,color:"var(--gray-mid)",lineHeight:1.5}}>Lote único — alterar aqui atualiza todos os modelos.</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}

              <Card title="⚙️ Parâmetros do Simulador" subtitle="Prazo, entradas e taxas">
                <div style={{display:"flex",flexDirection:"column",gap:20}}>
                  <Two>
                    <div><FieldLabel hint="Mínimo da construtora">Entrada Mínima (R$)</FieldLabel><NumInput value={emp.simulador.entradaMin} prefix="R$" onChange={v=>update("simulador.entradaMin",v)}/></div>
                    <div><FieldLabel hint="Teto do slider">Entrada Máxima (R$)</FieldLabel><NumInput value={emp.simulador.entradaMax} prefix="R$" onChange={v=>update("simulador.entradaMax",v)}/></div>
                  </Two>
                  <div><FieldLabel hint="Caixa aceita até 420 meses">Prazo (meses)</FieldLabel><NumInput value={emp.simulador.prazoMeses} suffix="meses" onChange={v=>update("simulador.prazoMeses",v)}/></div>
                  <Hr/>
                  <p style={{fontSize:11,fontWeight:700,color:"var(--gray-mid)",textTransform:"uppercase",letterSpacing:"0.05em"}}>Taxas de Juros Nominais</p>
                  <Two>
                    <div><FieldLabel hint="Não-cotista — Faixa 2">Taxa Faixa 2 (% a.a.)</FieldLabel><NumInput value={emp.simulador.taxaFaixa12} suffix="% a.a." step={0.01} onChange={v=>update("simulador.taxaFaixa12",v)}/></div>
                    <div><FieldLabel hint="Confirmado: 8,16%">Taxa Faixa 3 não-cotista</FieldLabel><NumInput value={emp.simulador.taxaFaixa3} suffix="% a.a." step={0.01} onChange={v=>update("simulador.taxaFaixa3",v)}/></div>
                    <div><FieldLabel hint="Confirmado: 7,66%">Taxa Faixa 3 cotista</FieldLabel><NumInput value={emp.simulador.taxaFaixa3Cotista||7.66} suffix="% a.a." step={0.01} onChange={v=>update("simulador.taxaFaixa3Cotista",v)}/></div>
                    <div><FieldLabel hint="Mercado livre">Taxa Mercado</FieldLabel><NumInput value={emp.simulador.taxaMercado} suffix="% a.a." step={0.01} onChange={v=>update("simulador.taxaMercado",v)}/></div>
                  </Two>
                </div>
              </Card>

              <Card title="📐 CUB SINDUSCON — Entrada Embutida" subtitle="Preencha o CUB vigente e clique em Salvar. Se o laudo superar o preço de venda, a Caixa financiará mais de 80% do contrato.">
                <div style={{display:"flex",flexDirection:"column",gap:20}}>
                  <div style={{padding:"10px 14px",borderRadius:8,background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.2)",display:"flex",gap:8,alignItems:"center"}}>
                    <Info size={13} color="#fb923c" style={{flexShrink:0}}/><p style={{fontSize:12,color:"#fb923c"}}>Atualizar mensalmente. <strong>Clique em "Salvar alterações" após preencher.</strong></p>
                  </div>
                  <Two>
                    <div><FieldLabel hint="SINDUSCON-GO deste mês">CUB Vigente (R$/m²)</FieldLabel><NumInput value={emp.simulador.cub?.cubVigente||0} prefix="R$" suffix="/m²" step={1} placeholder="Ex: 2900" onChange={v=>update("simulador.cub.cubVigente",v)}/></div>
                    <div><FieldLabel hint="Máximo 18% aceito pela Caixa">BDI (%)</FieldLabel><NumInput value={emp.simulador.cub?.bdi?Math.round(emp.simulador.cub.bdi*100):18} suffix="%" step={0.5} min={0} onChange={v=>update("simulador.cub.bdi",v/100)}/></div>
                  </Two>
                  {diagCUB?(
                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      <p style={{fontSize:11,fontWeight:700,color:"var(--gray-mid)",textTransform:"uppercase",letterSpacing:"0.05em"}}>Diagnóstico automático</p>
                      {diagCUB.map((d:any)=>{const cor=d.funciona?"#4ade80":"#facc15";return(
                        <div key={d.nome} style={{padding:"16px 18px",borderRadius:12,background:`${cor}0d`,border:`1px solid ${cor}28`}}>
                          <p style={{fontSize:13,fontWeight:700,color:cor,marginBottom:12}}>{d.funciona?"✅":"⚡"} {d.nome} — entrada embutida {d.funciona?"funciona":"parcial"}</p>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                            {[["Laudo CUB",`R$ ${Math.round(d.laudo).toLocaleString("pt-BR")}`],["Máx fin (80%)",`R$ ${Math.round(d.maxFin).toLocaleString("pt-BR")}`],["Entrada mín",`R$ ${Math.round(d.entradaMin).toLocaleString("pt-BR")}`]].map(([l,v])=>(
                              <div key={l}><p style={{fontSize:10,color:"var(--gray-dark)",marginBottom:3}}>{l}</p><p style={{fontSize:13,fontWeight:700,color:"var(--gray-light)"}}>{v}</p></div>
                            ))}
                          </div>
                          {!d.funciona&&<p style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)"}}>CUB mínimo para 100%: R$ {Math.ceil(d.cubMin).toLocaleString("pt-BR")}/m²</p>}
                        </div>
                      );})}
                    </div>
                  ):(
                    <div style={{padding:"14px 16px",borderRadius:10,background:"rgba(168,85,247,0.07)",border:"1px solid rgba(168,85,247,0.2)",display:"flex",gap:10}}>
                      <Info size={14} color="#a855f7" style={{flexShrink:0,marginTop:1}}/><p style={{fontSize:12,color:"var(--gray-mid)",lineHeight:1.6}}>Preencha o <strong style={{color:"var(--gray-light)"}}>CUB vigente</strong> e salve para ativar o diagnóstico automático.</p>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* GALERIA */}
          {section==="galeria"&&(
            <motion.div key="g" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{display:"flex",flexDirection:"column",gap:32}}>
              <div><h2 className="text-title" style={{marginBottom:8}}>Galeria de Imagens</h2><p className="text-body">Fotos e plantas da Vitrine Digital.</p></div>
              <Card title="📷 Uploads">
                <div style={{display:"flex",flexDirection:"column",gap:20}}>
                  <div className="tab-group">
                    <button className={`tab-item ${upType==="imagens"?"active":""}`} onClick={()=>setUpType("imagens")}>Renders / Fotos</button>
                    <button className={`tab-item ${upType==="plantas"?"active":""}`} onClick={()=>setUpType("plantas")}>Plantas Baixas</button>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload}/>
                  <button onClick={()=>fileRef.current?.click()} disabled={uploading} className="btn-secondary w-full">
                    <ImageIcon size={16}/>{uploading?"Enviando...":`Enviar ${upType==="imagens"?"Render / Foto":"Planta Baixa"}`}
                  </button>
                  {(emp.vitrine[upType]||[]).length>0?(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                      {emp.vitrine[upType].map((img:any,i:number)=>(
                        <div key={i} className="relative group rounded-xl overflow-hidden" style={{height:120}}>
                          <Image src={img.url} alt={img.titulo||""} fill className="object-cover"/>
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex-center">
                            <button onClick={()=>deleteImage(img.url,upType)} className="w-9 h-9 rounded-full flex-center" style={{background:"rgba(239,68,68,0.8)"}}><Trash2 size={14} color="white"/></button>
                          </div>
                          <div className="absolute bottom-1 left-1 right-1"><p className="text-xs text-white truncate px-1">{img.titulo}</p></div>
                        </div>
                      ))}
                    </div>
                  ):(
                    <div className="flex-center py-8 rounded-xl" style={{background:"rgba(0,0,0,0.2)",border:"1px dashed var(--border-subtle)"}}>
                      <p className="text-muted text-sm">Nenhuma imagem ainda</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* AMBIENTES */}
              <Card title="🏠 Ambientes" subtitle="Ative os ambientes disponíveis no empreendimento. Cada um aparece como ícone clicável na vitrine com sua galeria.">
                <div style={{display:"flex",flexDirection:"column",gap:20}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10}}>
                    {AMBIENTES_LISTA.map(amb=>{
                      const ativo = emp.vitrine?.ambientes?.[amb.id]?.ativo ?? false;
                      return (
                        <button
                          key={amb.id}
                          onClick={()=>{
                            const atual = emp.vitrine?.ambientes?.[amb.id] ?? {ativo:false,fotos:[]};
                            update(`vitrine.ambientes.${amb.id}`,{...atual,ativo:!ativo});
                          }}
                          style={{
                            display:"flex",alignItems:"center",gap:10,padding:"11px 12px",
                            borderRadius:12,cursor:"pointer",textAlign:"left",
                            border:`1.5px solid ${ativo?"var(--border-active)":"var(--border-subtle)"}`,
                            background:ativo?"var(--terracota-glow)":"rgba(0,0,0,0.15)",
                            transition:"all 150ms ease",
                          }}
                        >
                          <span style={{fontSize:20,lineHeight:1,flexShrink:0}}>{amb.icone}</span>
                          <span style={{fontSize:12,fontWeight:ativo?700:500,color:ativo?"var(--gray-light)":"var(--gray-dark)",lineHeight:1.3,flex:1}}>{amb.label}</span>
                          <span style={{fontSize:10,color:ativo?"#4ade80":"var(--gray-dark)",fontWeight:800}}>{ativo?"ON":"OFF"}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Upload por ambiente ativo */}
                  {AMBIENTES_LISTA.filter(a=>emp.vitrine?.ambientes?.[a.id]?.ativo).length>0&&<Hr/>}
                  {AMBIENTES_LISTA.filter(a=>emp.vitrine?.ambientes?.[a.id]?.ativo).map(amb=>(
                    <AmbienteUpload
                      key={amb.id}
                      amb={amb}
                      fotos={emp.vitrine?.ambientes?.[amb.id]?.fotos??[]}
                      slug={slug}
                      onAdd={foto=>{
                        const atual=emp.vitrine?.ambientes?.[amb.id]??{ativo:true,fotos:[]};
                        update(`vitrine.ambientes.${amb.id}`,{...atual,fotos:[...atual.fotos,foto]});
                      }}
                      onRemove={url=>{
                        const atual=emp.vitrine?.ambientes?.[amb.id]??{ativo:true,fotos:[]};
                        update(`vitrine.ambientes.${amb.id}`,{...atual,fotos:atual.fotos.filter((f:any)=>f.url!==url)});
                      }}
                    />
                  ))}
                </div>
              </Card>

            </motion.div>
          )}

          {/* TEXTOS */}
          {section==="textos"&&(
            <motion.div key="t" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{display:"flex",flexDirection:"column",gap:32}}>
              <div><h2 className="text-title" style={{marginBottom:8}}>Textos & Copywriting</h2><p className="text-body">Textos dos módulos e notas do PDF.</p></div>
              <Card title="📄 Textos e Alertas">
                <div style={{display:"flex",flexDirection:"column",gap:24}}>
                  <div><FieldLabel hint="Rodapé do PDF">Notas Legais (PDF)</FieldLabel><textarea rows={4} className="input-field" style={{resize:"vertical",fontSize:13,lineHeight:1.6}} value={emp.textos.notasLegais} onChange={e=>update("textos.notasLegais",e.target.value)}/></div>
                  <Hr/>
                  <div><FieldLabel>Título — Módulo de Obra</FieldLabel><input type="text" className="input-field" style={{fontSize:15}} value={emp.textos.tituloObra} onChange={e=>update("textos.tituloObra",e.target.value)}/></div>
                  <div><FieldLabel hint="Introdução do módulo de obra">Descrição — Módulo de Obra</FieldLabel><textarea rows={2} className="input-field" style={{resize:"none",fontSize:13,lineHeight:1.6}} value={emp.textos.descricaoObra} onChange={e=>update("textos.descricaoObra",e.target.value)}/></div>
                  <Hr/>
                  <div><FieldLabel hint="Faixa 2 (com subsídio)">Alerta Faixa 2</FieldLabel><textarea rows={2} className="input-field" style={{resize:"none",fontSize:13,lineHeight:1.6}} value={emp.textos.alertaF12} onChange={e=>update("textos.alertaF12",e.target.value)}/></div>
                  <div><FieldLabel hint="Faixa 3 e 4 (sem subsídio)">Alerta Faixa 3/4</FieldLabel><textarea rows={2} className="input-field" style={{resize:"none",fontSize:13,lineHeight:1.6}} value={emp.textos.alertaF3} onChange={e=>update("textos.alertaF3",e.target.value)}/></div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* MCMV */}
          {section==="mcmv"&&(
            <motion.div key="m" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{display:"flex",flexDirection:"column",gap:32}}>
              <div><h2 className="text-title" style={{marginBottom:8}}>Programa MCMV</h2><p className="text-body">Faixas, subsídios e taxas — DOU 16/04/2026.</p></div>
              {emp.mcmv.faixas.map((faixa:any,idx:number)=>(
                <Card key={faixa.id} title={faixa.nome} subtitle={`Renda R$ ${faixa.rendaMin.toLocaleString("pt-BR")} → R$ ${faixa.rendaMax.toLocaleString("pt-BR")}`}>
                  <div style={{display:"flex",flexDirection:"column",gap:20}}>
                    <Two>
                      <div><FieldLabel>Renda mínima (R$)</FieldLabel><NumInput value={faixa.rendaMin} prefix="R$" onChange={v=>update(`mcmv.faixas.${idx}.rendaMin`,v)}/></div>
                      <div><FieldLabel>Renda máxima (R$)</FieldLabel><NumInput value={faixa.rendaMax} prefix="R$" onChange={v=>update(`mcmv.faixas.${idx}.rendaMax`,v)}/></div>
                    </Two>
                    {faixa.subsidioMax>0&&(
                      <Two>
                        <div><FieldLabel hint="Renda mínima da faixa">Subsídio máximo (R$)</FieldLabel><NumInput value={faixa.subsidioMax} prefix="R$" onChange={v=>update(`mcmv.faixas.${idx}.subsidioMax`,v)}/></div>
                        <div><FieldLabel hint="Renda máxima da faixa">Subsídio mínimo (R$)</FieldLabel><NumInput value={faixa.subsidioMin} prefix="R$" onChange={v=>update(`mcmv.faixas.${idx}.subsidioMin`,v)}/></div>
                      </Two>
                    )}
                    {faixa.subsidioMax===0&&<div style={{padding:"10px 14px",borderRadius:8,background:"rgba(251,146,60,0.07)",border:"1px solid rgba(251,146,60,0.2)"}}><p style={{fontSize:12,color:"#fb923c"}}>⚠️ Sem subsídio — apenas taxas reduzidas.</p></div>}
                    <Hr/>
                    <Two>
                      <div><FieldLabel hint="FGTS &lt; 3 anos">Taxa não-cotista (% a.a.)</FieldLabel><NumInput value={faixa.taxa} suffix="% a.a." step={0.01} onChange={v=>update(`mcmv.faixas.${idx}.taxa`,v)}/></div>
                      <div><FieldLabel hint="FGTS ≥ 3 anos">Taxa cotista (% a.a.)</FieldLabel><NumInput value={faixa.taxaCotista??faixa.taxa-0.5} suffix="% a.a." step={0.01} onChange={v=>update(`mcmv.faixas.${idx}.taxaCotista`,v)}/></div>
                    </Two>
                  </div>
                </Card>
              ))}
              <Card title="🏠 Teto Regional">
                <div style={{display:"flex",flexDirection:"column",gap:20}}>
                  <div><FieldLabel hint="Valor máximo do imóvel para MCMV">Teto do Imóvel (R$)</FieldLabel><NumInput value={emp.mcmv.tetoImovel} prefix="R$" onChange={v=>update("mcmv.tetoImovel",v)}/></div>
                  <div><FieldLabel>Observação MCMV</FieldLabel><textarea rows={3} className="input-field" style={{resize:"vertical",fontSize:13,lineHeight:1.6}} value={emp.mcmv.observacao} onChange={e=>update("mcmv.observacao",e.target.value)}/></div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ═══ LOCALIZAÇÃO ══════════════════════════════ */}
          {section==="localizacao"&&(
            <motion.div key="loc" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{display:"flex",flexDirection:"column",gap:32}}>
              <div>
                <h2 className="text-title" style={{marginBottom:8}}>Localização</h2>
                <p className="text-body">Endereço e coordenadas do empreendimento.</p>
              </div>

              <Card title="📍 Endereço">
                <div style={{display:"flex",flexDirection:"column",gap:20}}>
                  <Two>
                    <div>
                      <FieldLabel>Cidade</FieldLabel>
                      <input type="text" className="input-field" style={{fontSize:15}}
                        value={emp.cidade}
                        onChange={e=>update("cidade",e.target.value)}/>
                    </div>
                    <div>
                      <FieldLabel>Estado (sigla)</FieldLabel>
                      <input type="text" className="input-field" style={{fontSize:15,textTransform:"uppercase"}}
                        value={emp.estado}
                        onChange={e=>update("estado",e.target.value.toUpperCase().slice(0,2))}
                        maxLength={2}
                        placeholder="GO"/>
                    </div>
                  </Two>

                  <div>
                    <FieldLabel hint="Nome completo para identificação">Nome do Empreendimento</FieldLabel>
                    <input type="text" className="input-field" style={{fontSize:15}}
                      value={emp.nome}
                      onChange={e=>update("nome",e.target.value)}/>
                  </div>

                  <div>
                    <FieldLabel hint="Descrição exibida na página inicial">Descrição Curta</FieldLabel>
                    <textarea rows={2} className="input-field" style={{resize:"none",fontSize:13,lineHeight:1.6}}
                      value={emp.descricao || ""}
                      onChange={e=>update("descricao",e.target.value)}/>
                  </div>
                </div>
              </Card>

              <Card title="🗺️ Coordenadas GPS" subtitle={`Cole as coordenadas do Google Maps em qualquer formato — DMS (16°24'17.1"S 51°06'50.3"W) ou decimal (-16.4047, -51.1140).`}>
                <div style={{display:"flex",flexDirection:"column",gap:20}}>

                  {/* Input DMS — cola direto do Google Maps */}
                  <CoordParser
                    lat={emp.coordenadas?.lat ?? 0}
                    lng={emp.coordenadas?.lng ?? 0}
                    onChange={(lat,lng)=>{
                      // Um único update evita condição de corrida entre os dois setState
                      update("coordenadas", { ...(emp.coordenadas ?? {}), lat, lng });
                    }}
                  />

                  {/* Campos individuais para ajuste fino */}
                  <Two>
                    <div>
                      <FieldLabel hint="Latitude decimal (sul = negativo)">Latitude</FieldLabel>
                      <NumInput
                        value={emp.coordenadas?.lat ?? 0}
                        step={0.000001}
                        placeholder="-16.404750"
                        onChange={v=>update("coordenadas.lat",v)}/>
                    </div>
                    <div>
                      <FieldLabel hint="Longitude decimal (oeste = negativo)">Longitude</FieldLabel>
                      <NumInput
                        value={emp.coordenadas?.lng ?? 0}
                        step={0.000001}
                        placeholder="-51.113972"
                        onChange={v=>update("coordenadas.lng",v)}/>
                    </div>
                  </Two>

                  {/* Link para conferir */}
                  {(emp.coordenadas?.lat !== 0 && emp.coordenadas?.lat !== undefined && emp.coordenadas?.lng !== 0 && emp.coordenadas?.lng !== undefined) && (
                    <a
                      href={`https://www.google.com/maps?q=${emp.coordenadas.lat},${emp.coordenadas.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        display:"inline-flex",alignItems:"center",gap:8,
                        padding:"10px 16px",borderRadius:10,width:"fit-content",
                        background:"rgba(175,111,83,0.1)",border:"1px solid rgba(175,111,83,0.3)",
                        color:"var(--terracota)",fontSize:13,fontWeight:600,textDecoration:"none",
                      }}
                    >
                      <ExternalLink size={14}/>
                      Conferir no Google Maps
                    </a>
                  )}
                </div>
              </Card>

            </motion.div>
          )}

        </AnimatePresence>



      
          </div>
        </main>
      </div>

      {/* BOTÃO FLUTUANTE quando há alterações */}
      <AnimatePresence>
        {isDirty && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: "fixed", bottom: 24, right: 24, zIndex: 50 }}>
            <button onClick={salvar} disabled={saveState === "saving"}
              style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 24px", borderRadius: 14, background: "var(--terracota)", color: "white", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 8px 30px rgba(175,111,83,0.5)" }}>
              <Save size={17} />{saveState === "saving" ? "Salvando..." : "Salvar alterações"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}