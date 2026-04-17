"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";
import {
  ArrowLeft, Upload, Trash2, Image as ImageIcon,
  DollarSign, FileText, Settings2, Eye, CheckCircle,
  Info, Save, AlertCircle,
} from "lucide-react";

type Section = "valores" | "galeria" | "textos" | "mcmv";
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
        obj = obj[k];
      }
      const last = isNaN(Number(parts[parts.length-1])) ? parts[parts.length-1] : Number(parts[parts.length-1]);
      obj[last] = value;
      return next;
    });
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
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file",file); fd.append("slug",slug); fd.append("tipo",upType); fd.append("titulo",file.name.replace(/\.[^/.]+$/,""));
      const res = await fetch("/api/upload",{method:"POST",body:fd});
      const data = await res.json();
      if (data.url) {
        const novo = [...(emp.vitrine[upType]||[]), {url:data.url,titulo:data.titulo||file.name}];
        update(`vitrine.${upType}`, novo);
        await fetch("/api/empreendimentos",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,field:`vitrine.${upType}`,value:novo})});
      }
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value=""; }
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

  const SECTIONS = [
    {id:"valores" as Section,label:"Valores & CUB",icon:DollarSign},
    {id:"galeria" as Section,label:"Galeria",icon:ImageIcon},
    {id:"textos"  as Section,label:"Textos",icon:FileText},
    {id:"mcmv"   as Section,label:"MCMV",icon:Settings2},
  ];

  const saveCfg = { idle:{bg:"rgba(255,255,255,0.08)",color:"var(--gray-dark)",label:"Salvar alterações",Icon:Save}, saving:{bg:"var(--terracota-dark)",color:"white",label:"Salvando...",Icon:Save}, saved:{bg:"#16a34a",color:"white",label:"Salvo!",Icon:CheckCircle}, error:{bg:"#dc2626",color:"white",label:"Erro ao salvar",Icon:AlertCircle} }[saveState];

  if (loading) return <div className="min-h-screen flex-center" style={{background:"var(--bg-base)"}}><p className="text-muted">Carregando...</p></div>;
  if (!emp) return <div className="min-h-screen flex-center" style={{background:"var(--bg-base)"}}><div className="text-center"><p className="text-muted" style={{marginBottom:16}}>Não encontrado</p><Link href="/admin" className="btn-secondary">Voltar</Link></div></div>;

  return (
    <div className="min-h-screen" style={{background:"var(--bg-base)"}}>

      {/* HEADER STICKY */}
      <header style={{background:"rgba(15,30,22,0.98)",backdropFilter:"blur(24px)",borderBottom:"1px solid var(--border-subtle)",position:"sticky",top:0,zIndex:40}}>
        <div className="container-app">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0"}}>
            <div className="flex items-center gap-3">
              <Link href="/admin" className="btn-ghost p-2" onClick={e=>{if(isDirty&&!confirm("Alterações não salvas. Sair mesmo assim?"))e.preventDefault();}}>
                <ArrowLeft size={20}/>
              </Link>
              <Image src="/logo.png" alt="Habiticon" width={160} height={48} style={{height:64,width:"auto",objectFit:"contain",flexShrink:0}} priority />
              <div style={{width:1,height:28,background:"var(--border-subtle)",flexShrink:0}}/>
              <div>
                <h1 style={{fontSize:15,fontWeight:700,color:"var(--gray-light)"}}>{emp.nome}</h1>
                <p style={{fontSize:12,color:"var(--gray-mid)"}}>{emp.cidade} · {emp.estado}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AnimatePresence>
                {isDirty && saveState==="idle" && (
                  <motion.span initial={{opacity:0,x:8}} animate={{opacity:1,x:0}} exit={{opacity:0,x:8}}
                    style={{fontSize:12,color:"#fb923c",display:"flex",alignItems:"center",gap:6}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:"#fb923c",display:"inline-block"}}/>
                    Não salvo
                  </motion.span>
                )}
              </AnimatePresence>
              <Link href={`/${slug}`} target="_blank" className="btn-ghost text-sm"><Eye size={15}/> Visualizar</Link>
              <button onClick={salvar} disabled={saveState==="saving"||(!isDirty&&saveState==="idle")}
                style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 20px",borderRadius:10,background:isDirty||saveState!=="idle"?(saveState==="idle"?"var(--terracota)":saveCfg.bg):"rgba(255,255,255,0.08)",color:isDirty||saveState!=="idle"?"white":"var(--gray-dark)",border:"none",fontWeight:700,fontSize:13,cursor:isDirty?"pointer":"default",transition:"all 0.2s"}}>
                <saveCfg.Icon size={15}/>{saveCfg.label}
              </button>
            </div>
          </div>
        </div>
        <div className="border-t overflow-x-auto" style={{borderColor:"var(--border-subtle)"}}>
          <div className="flex" style={{minWidth:"max-content"}}>
            {SECTIONS.map(s=>{const Icon=s.icon;return(
              <button key={s.id} onClick={()=>setSection(s.id)} className="flex items-center gap-2 px-6 py-3.5 text-sm font-semibold transition-all relative"
                style={{color:section===s.id?"var(--terracota)":"var(--gray-mid)"}}>
                <Icon size={14}/>{s.label}
                {section===s.id&&<motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5" style={{background:"var(--terracota)"}}/>}
              </button>
            );})}
          </div>
        </div>
      </header>

      <main className="container-app py-10" style={{maxWidth:740}}>
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
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload}/>
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

        </AnimatePresence>

        {/* BOTÃO FLUTUANTE */}
        <AnimatePresence>
          {isDirty&&(
            <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}} style={{position:"fixed",bottom:24,right:24,zIndex:50}}>
              <button onClick={salvar} disabled={saveState==="saving"}
                style={{display:"inline-flex",alignItems:"center",gap:10,padding:"14px 24px",borderRadius:14,background:"var(--terracota)",color:"white",border:"none",fontWeight:700,fontSize:14,cursor:"pointer",boxShadow:"0 8px 30px rgba(175,111,83,0.5)"}}>
                <Save size={17}/>{saveState==="saving"?"Salvando...":"Salvar alterações"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}