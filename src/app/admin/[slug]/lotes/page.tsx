"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { collection, doc, getDoc, updateDoc, onSnapshot, addDoc, deleteDoc, query, orderBy, writeBatch } from "firebase/firestore";
import { ArrowLeft, Map, Layers, Plus, Trash2, Edit2, CheckCircle2, ChevronDown, ChevronRight, Check, Lock, X, CopyPlus, Unlock, AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/calculos";

// ─────────────────────────────────────────────────────────
// TIPAGENS
// ─────────────────────────────────────────────────────────

interface LoteLeadFila {
  leadId: string;
  nomeCliente: string;
  corretorId: string;
  nomeCorretor: string;
  timestamp: string;
}

interface Lote {
  id: string;
  numero: string;
  area: number;
  valor: number;
  svgPathId: string;
  adjacentes: string[];
  status: "disponivel" | "vinculado" | "vendido" | "bloqueado"; // Adicionado "bloqueado"
  fila: LoteLeadFila[];
  leadAprovadoId: string | null;
}

interface Quadra {
  id: string;
  numero: string;
  bloqueada?: boolean; // Adicionado bloqueio de quadra
  lotes: Lote[];
}

interface Empreendimento {
  slug: string;
  nome: string;
  mapaUrl?: string;
  vendaEmOrdem?: boolean;
}

interface Params { params: Promise<{ slug: string }> }

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────

export default function GestaoLotesPage({ params }: Params) {
  const { slug } = use(params);
  const router = useRouter();

  const [empreendimento, setEmpreendimento] = useState<Empreendimento | null>(null);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Formulário (Quadra)
  const [novaQuadraNome, setNovaQuadraNome] = useState("");
  const [quadraAberta, setQuadraAberta] = useState<string | null>(null);

  // Estados de Formulário (Lote Único)
  const [modalLote, setModalLote] = useState<{aberto: boolean, quadraId: string, lote: Lote | null}>({aberto: false, quadraId: "", lote: null});
  const [formLote, setFormLote] = useState({ numero: "", area: "", valor: "", svgPathId: "", adjacentes: "" });

  // Estados de Formulário (Lote em Massa)
  const [modalMassa, setModalMassa] = useState<{aberto: boolean, quadraId: string}>({aberto: false, quadraId: ""});
  const [formMassa, setFormMassa] = useState({ numInicial: 1, numFinal: 20, area: "", valor: "", prefixoSvg: "lote_" });
  const [salvandoMassa, setSalvandoMassa] = useState(false);

  // ── CARREGAMENTO DE DADOS ──
  useEffect(() => {
    const carregarTudo = async () => {
      const user = auth.currentUser;
      if (!user) { router.push("/login"); return; }
      
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (!userDoc.exists() || userDoc.data().role !== "admin") { router.push("/"); return; }

      const empDoc = await getDoc(doc(db, "empreendimentos", slug));
      if (empDoc.exists()) {
        setEmpreendimento({ slug: empDoc.id, ...empDoc.data() } as Empreendimento);
      } else {
        router.push("/admin");
        return;
      }

      const qQuadras = query(collection(db, "empreendimentos", slug, "quadras"), orderBy("numero", "asc"));
      const unsubQuadras = onSnapshot(qQuadras, (snapQuadras) => {
        const quadrasData: Quadra[] = [];
        
        snapQuadras.forEach((docQuadra) => {
          const q: Quadra = { 
            id: docQuadra.id, 
            numero: docQuadra.data().numero, 
            bloqueada: docQuadra.data().bloqueada || false,
            lotes: [] 
          };
          
          onSnapshot(collection(db, "empreendimentos", slug, "quadras", docQuadra.id, "lotes"), (snapLotes) => {
            const lotesData: Lote[] = [];
            snapLotes.forEach((docLote) => {
              lotesData.push({ id: docLote.id, ...docLote.data() } as Lote);
            });
            lotesData.sort((a,b) => parseInt(a.numero) - parseInt(b.numero));
            
            setQuadras(prev => {
              const copia = [...prev];
              const idx = copia.findIndex(x => x.id === docQuadra.id);
              if(idx >= 0) {
                 copia[idx].lotes = lotesData;
                 // Atualiza também bloqueio para refletir mudanças live
                 copia[idx].bloqueada = docQuadra.data().bloqueada; 
                 return [...copia]; 
              }
              q.lotes = lotesData;
              return [...prev, q].sort((a,b) => a.numero.localeCompare(b.numero, undefined, {numeric: true}));
            });
          });
          
          quadrasData.push(q);
        });
        
        setQuadras(quadrasData);
        setLoading(false);
      });

      return () => { unsubQuadras(); };
    };

    carregarTudo();
  }, [slug, router]);

  // ─────────────────────────────────────────────────────────
  // AÇÕES: QUADRAS
  // ─────────────────────────────────────────────────────────
  const adicionarQuadra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaQuadraNome.trim()) return;
    
    try {
      await addDoc(collection(db, "empreendimentos", slug, "quadras"), {
        numero: novaQuadraNome.trim(),
        bloqueada: false,
        criadoEm: new Date().toISOString()
      });
      setNovaQuadraNome("");
    } catch (error) {
      console.error(error);
      alert("Erro ao adicionar quadra.");
    }
  };

  const deletarQuadra = async (quadraId: string) => {
    if (!confirm("Atenção! Confirma a exclusão da Quadra? Lotes internos deverão ser apagados manualmente no banco de dados por segurança.")) return;
    try {
      await deleteDoc(doc(db, "empreendimentos", slug, "quadras", quadraId));
    } catch (error) {
      alert("Erro ao excluir quadra.");
    }
  };

  const toggleBloqueioQuadra = async (quadraId: string, atual: boolean) => {
    if (!confirm(atual ? "Desbloquear esta quadra para vendas?" : "Bloquear toda a quadra? Nenhum lote poderá ser reservado.")) return;
    try {
      await updateDoc(doc(db, "empreendimentos", slug, "quadras", quadraId), {
        bloqueada: !atual
      });
    } catch (error) {
      alert("Erro ao alterar bloqueio da quadra.");
    }
  };

  // ─────────────────────────────────────────────────────────
  // AÇÕES: LOTES (ÚNICO E MASSA)
  // ─────────────────────────────────────────────────────────
  const abrirModalLote = (quadraId: string, lote?: Lote) => {
    if (lote) {
      setFormLote({
        numero: lote.numero, area: String(lote.area), valor: String(lote.valor),
        svgPathId: lote.svgPathId, adjacentes: lote.adjacentes?.join(", ") || ""
      });
      setModalLote({ aberto: true, quadraId, lote });
    } else {
      setFormLote({ numero: "", area: "", valor: "", svgPathId: "", adjacentes: "" });
      setModalLote({ aberto: true, quadraId, lote: null });
    }
  };

  const salvarLote = async (e: React.FormEvent) => {
    e.preventDefault();
    const adjArray = formLote.adjacentes.split(",").map(s => s.trim()).filter(s => s !== "");

    const payload = {
      numero: formLote.numero.trim(),
      area: Number(formLote.area),
      valor: Number(formLote.valor),
      svgPathId: formLote.svgPathId.trim(),
      adjacentes: adjArray,
      atualizadoEm: new Date().toISOString()
    };

    try {
      if (modalLote.lote) {
        await updateDoc(doc(db, "empreendimentos", slug, "quadras", modalLote.quadraId, "lotes", modalLote.lote.id), payload);
      } else {
        await addDoc(collection(db, "empreendimentos", slug, "quadras", modalLote.quadraId, "lotes"), {
          ...payload,
          status: "disponivel",
          fila: [],
          leadAprovadoId: null,
          criadoEm: new Date().toISOString()
        });
      }
      setModalLote({aberto: false, quadraId: "", lote: null});
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar lote.");
    }
  };

  const gerarLotesEmMassa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMassa.numFinal < formMassa.numInicial) {
      alert("Número final deve ser maior ou igual ao inicial.");
      return;
    }
    if (!confirm(`Tem certeza que deseja criar ${formMassa.numFinal - formMassa.numInicial + 1} lotes de uma vez?`)) return;

    setSalvandoMassa(true);
    try {
      const batch = writeBatch(db);
      
      for (let i = formMassa.numInicial; i <= formMassa.numFinal; i++) {
        const numStr = String(i);
        const refNovo = doc(collection(db, "empreendimentos", slug, "quadras", modalMassa.quadraId, "lotes"));
        batch.set(refNovo, {
          numero: numStr,
          area: Number(formMassa.area),
          valor: Number(formMassa.valor),
          svgPathId: `${formMassa.prefixoSvg}${numStr}`, // Ex: lote_q1_l12
          adjacentes: [], // Em massa inicia vazio
          status: "disponivel",
          fila: [],
          leadAprovadoId: null,
          criadoEm: new Date().toISOString()
        });
      }

      await batch.commit();
      alert("Lotes gerados com sucesso!");
      setModalMassa({aberto: false, quadraId: ""});
    } catch (error) {
      console.error("Erro ao gerar lotes", error);
      alert("Houve um erro ao processar os lotes.");
    } finally {
      setSalvandoMassa(false);
    }
  };

  const deletarLote = async (quadraId: string, loteId: string) => {
    if(!confirm("Excluir este lote permanentemente?")) return;
    try {
       await deleteDoc(doc(db, "empreendimentos", slug, "quadras", quadraId, "lotes", loteId));
    } catch(err) {
       alert("Erro ao excluir lote");
    }
  };

  const toggleBloqueioLote = async (quadraId: string, loteId: string, statusAtual: string) => {
    const novoStatus = statusAtual === "bloqueado" ? "disponivel" : "bloqueado";
    const acao = novoStatus === "bloqueado" ? "Bloquear" : "Desbloquear";
    if (!confirm(`${acao} este lote individualmente?`)) return;
    try {
      await updateDoc(doc(db, "empreendimentos", slug, "quadras", quadraId, "lotes", loteId), {
        status: novoStatus
      });
    } catch (err) { alert("Erro ao alterar bloqueio."); }
  };

  const forcarDisponivel = async (quadraId: string, loteId: string) => {
    if (!confirm("Isso irá remover TODOS da fila e desvincular os leads. O lote ficará DISPONÍVEL verde no mapa. Tem certeza?")) return;
    try {
      const loteRef = doc(db, "empreendimentos", slug, "quadras", quadraId, "lotes", loteId);
      const loteSnap = await getDoc(loteRef);
      
      if (loteSnap.exists()) {
        const loteData = loteSnap.data() as Lote;
        const fila = loteData.fila || [];

        // Remove o lote dos leads um por um, verificando se eles ainda existem (evita o crash do documento fantasma)
        for (const itemFila of fila) {
          const leadRef = doc(db, "leads", itemFila.leadId);
          const leadSnap = await getDoc(leadRef);
          if (leadSnap.exists()) {
            await updateDoc(leadRef, {
              loteReserva: null,
              status: "venda_desfeita" 
            });
          }
        }
      }

      // Atualiza o status do próprio lote para livre
      await updateDoc(loteRef, {
        status: "disponivel", 
        fila: [], 
        leadAprovadoId: null
      });

      alert("Lote libertado e leads atualizados com sucesso.");
    } catch (err) { 
      console.error(err);
      alert("Erro ao limpar lote e desvincular leads."); 
    }
  };

  // ─────────────────────────────────────────────────────────
  // RENDERIZAÇÃO
  // ─────────────────────────────────────────────────────────
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Carregando dados...</div>;
  if (!empreendimento) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Empreendimento não encontrado.</div>;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>

      <header style={{ padding: "16px", background: "rgba(15,30,22,0.98)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 10 }}>
        <Link href={`/admin/${slug}`} className="btn-ghost" style={{ padding: "8px 12px" }}>
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
            <Map size={18} color="var(--terracota)" /> Gestão de Quadras e Lotes
          </h1>
          <p style={{ fontSize: 12, color: "var(--gray-mid)" }}>{empreendimento.nome}</p>
        </div>
      </header>

      <main className="container-app" style={{ padding: "30px 20px", maxWidth: 1000, margin: "0 auto" }}>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
          <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", padding: "16px", borderRadius: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", textTransform: "uppercase" }}>Regra de Venda de Lotes</p>
            <p style={{ fontSize: 14, color: "white", fontWeight: 600 }}>{empreendimento.vendaEmOrdem ? "Sequencial / Adjacentes Ativado" : "Venda Livre (Qualquer lote)"}</p>
            <p style={{ fontSize: 11, color: "var(--gray-mid)" }}>Ajuste na aba "Mapa" das configurações gerais.</p>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", padding: "16px", borderRadius: 16, display: "flex", flexDirection: "column", gap: 8 }}>
             <p style={{ fontSize: 12, fontWeight: 700, color: "var(--terracota)", textTransform: "uppercase" }}>Arquivo Mapa SVG</p>
             {empreendimento.mapaUrl ? (
               <a href={empreendimento.mapaUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#38bdf8", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}><Map size={14}/> Ver SVG Atual</a>
             ) : (
               <p style={{ fontSize: 13, color: "#f87171" }}>⚠️ Mapa SVG não configurado!</p>
             )}
          </div>
        </div>

        {/* CRIAR QUADRA */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", padding: "20px", borderRadius: 16, marginBottom: 32 }}>
          <form onSubmit={adicionarQuadra} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 300px" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Nova Quadra / Bloco</label>
              <input type="text" required value={novaQuadraNome} onChange={e => setNovaQuadraNome(e.target.value)} placeholder="Ex: Quadra 01, Q01 ou Bloco A" className="input-field" style={{ fontSize: 14 }} />
            </div>
            <button type="submit" style={{ padding: "12px 20px", background: "var(--terracota)", color: "white", border: "none", borderRadius: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <Plus size={16} /> Criar Quadra
            </button>
          </form>
        </div>

        {/* LISTA DE QUADRAS E LOTES */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {quadras.length === 0 ? (
             <div style={{ padding: 40, textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
               <Layers size={32} color="var(--gray-dark)" style={{ margin: "0 auto 12px" }} />
               <p style={{ color: "var(--gray-mid)" }}>Nenhuma quadra cadastrada.</p>
             </div>
          ) : (
            quadras.map(quadra => {
              const isAberta = quadraAberta === quadra.id;
              return (
                <div key={quadra.id} style={{ background: "var(--bg-card)", border: quadra.bloqueada ? "1px solid rgba(239,68,68,0.5)" : "1px solid var(--border-subtle)", borderRadius: 16, overflow: "hidden" }}>
                  
                  {/* Cabeçalho da Quadra */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "16px 20px", background: quadra.bloqueada ? "rgba(239,68,68,0.1)" : "rgba(0,0,0,0.3)", borderBottom: isAberta ? "1px solid var(--border-subtle)" : "none" }}>
                    <button onClick={() => setQuadraAberta(isAberta ? null : quadra.id)} style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", color: "white", fontWeight: 800, fontSize: 16, cursor: "pointer", flex: 1, textAlign: "left" }}>
                      {isAberta ? <ChevronDown size={20} color="var(--terracota)" /> : <ChevronRight size={20} color="var(--terracota)" />}
                      {quadra.bloqueada && <Lock size={16} color="#f87171" />}
                      Quadra {quadra.numero}
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-mid)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 100 }}>{quadra.lotes.length} lotes</span>
                    </button>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => toggleBloqueioQuadra(quadra.id, quadra.bloqueada || false)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: quadra.bloqueada ? "rgba(74,222,128,0.1)" : "rgba(239,68,68,0.1)", border: "none", color: quadra.bloqueada ? "#4ade80" : "#f87171", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                         {quadra.bloqueada ? <><Unlock size={14}/> Desbloquear</> : <><Lock size={14}/> Bloquear Quadra</>}
                      </button>
                      <button onClick={() => deletarQuadra(quadra.id)} style={{ padding: 8, background: "transparent", border: "none", color: "var(--gray-dark)", cursor: "pointer" }} title="Apagar Quadra">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Lotes da Quadra (Expansível) */}
                  {isAberta && (
                    <div style={{ padding: "20px" }}>
                      
                      {/* Botões de Ação da Quadra */}
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                        <button onClick={() => abrirModalLote(quadra.id)} style={{ flex: "1 1 200px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 10, border: "1px dashed var(--terracota)", background: "var(--terracota-glow)", color: "var(--terracota)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                          <Plus size={16} /> Lote Individual
                        </button>
                        <button onClick={() => setModalMassa({aberto: true, quadraId: quadra.id})} style={{ flex: "1 1 200px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 10, border: "1px dashed #38bdf8", background: "rgba(56,189,248,0.1)", color: "#38bdf8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                          <CopyPlus size={16} /> Gerar Lotes em Massa
                        </button>
                      </div>

                      {quadra.bloqueada && (
                        <div style={{ padding: "12px", borderRadius: 10, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                          <AlertTriangle size={16} /> Quadra bloqueada. Corretores não poderão reservar lotes aqui pelo mapa.
                        </div>
                      )}

                      {quadra.lotes.length === 0 ? (
                        <p style={{ textAlign: "center", fontSize: 13, color: "var(--gray-dark)", padding: "10px 0" }}>Nenhum lote nesta quadra.</p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                          {quadra.lotes.map(lote => {
                            
                            // Determina Cor baseada no Status
                            let bgStatus = "rgba(74,222,128,0.08)";
                            let borderStatus = "rgba(74,222,128,0.2)";
                            let colorStatus = "#4ade80"; // Verde (Disponível)
                            
                            if (lote.status === "vinculado") { bgStatus = "rgba(251,146,60,0.1)"; borderStatus = "rgba(251,146,60,0.3)"; colorStatus = "#fb923c"; } // Amarelo
                            if (lote.status === "vendido") { bgStatus = "rgba(239,68,68,0.1)"; borderStatus = "rgba(239,68,68,0.3)"; colorStatus = "#ef4444"; } // Vermelho
                            if (lote.status === "bloqueado") { bgStatus = "rgba(0,0,0,0.4)"; borderStatus = "var(--border-active)"; colorStatus = "var(--gray-mid)"; } // Cinza Escuro

                            return (
                              <div key={lote.id} style={{ padding: "14px", borderRadius: 12, background: bgStatus, border: `1px solid ${borderStatus}`, display: "flex", flexDirection: "column", gap: 12 }}>
                                
                                {/* Info Base */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                  <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                      {lote.status === "bloqueado" ? <Lock size={12} color={colorStatus}/> : <div style={{ width: 8, height: 8, borderRadius: "50%", background: colorStatus }} />}
                                      <p style={{ fontSize: 15, fontWeight: 800, color: lote.status === "bloqueado" ? "var(--gray-light)" : "white" }}>Lote {lote.numero}</p>
                                    </div>
                                    <p style={{ fontSize: 11, color: "var(--gray-mid)" }}>SVG ID: <span style={{ color: "var(--gray-light)", fontFamily: "monospace" }}>{lote.svgPathId}</span></p>
                                    <p style={{ fontSize: 11, color: "var(--gray-mid)" }}>{lote.area}m² · {formatBRL(lote.valor)}</p>
                                  </div>
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                    <button onClick={() => toggleBloqueioLote(quadra.id, lote.id, lote.status)} title={lote.status === "bloqueado" ? "Desbloquear" : "Bloquear Individualmente"} style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.08)", border: "none", color: "white", cursor: "pointer" }}>
                                      {lote.status === "bloqueado" ? <Unlock size={14}/> : <Lock size={14}/>}
                                    </button>
                                    <button onClick={() => abrirModalLote(quadra.id, lote)} style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", border: "none", color: "white", cursor: "pointer" }}><Edit2 size={14}/></button>
                                    <button onClick={() => deletarLote(quadra.id, lote.id)} style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.1)", border: "none", color: "#f87171", cursor: "pointer" }}><Trash2 size={14}/></button>
                                  </div>
                                </div>

                                {/* Fila de Leads */}
                                {lote.fila && lote.fila.length > 0 && (
                                  <div style={{ background: "rgba(0,0,0,0.4)", padding: 10, borderRadius: 8, border: "1px dashed var(--border-subtle)" }}>
                                    <p style={{ fontSize: 10, fontWeight: 800, color: "var(--gray-light)", textTransform: "uppercase", marginBottom: 6 }}>Fila de Interessados</p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                      {lote.fila.map((f, i) => (
                                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 4, color: i === 0 ? "#fb923c" : "var(--gray-mid)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            <span style={{ fontWeight: 800 }}>{i+1}º</span> {f.nomeCliente}
                                          </div>
                                          <span style={{ color: "var(--gray-dark)" }}>{f.nomeCorretor?.split(" ")[0]}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <button onClick={() => forcarDisponivel(quadra.id, lote.id)} style={{ marginTop: 10, width: "100%", padding: "6px", fontSize: 10, fontWeight: 700, borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}>
                                      Desvincular (Forçar Livre)
                                    </button>
                                  </div>
                                )}

                                {/* Lote Vendido Info */}
                                {lote.status === "vendido" && (
                                  <div style={{ background: "rgba(239,68,68,0.15)", padding: 10, borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)" }}>
                                    <p style={{ fontSize: 11, fontWeight: 800, color: "#f87171", display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={12}/> VENDIDO DEFINITIVO</p>
                                    <button onClick={() => forcarDisponivel(quadra.id, lote.id)} style={{ marginTop: 8, width: "100%", padding: "6px", fontSize: 10, fontWeight: 700, borderRadius: 6, background: "transparent", color: "white", border: "1px dashed var(--gray-mid)", cursor: "pointer" }}>
                                      Desfazer Venda
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* ════════════════════════════════════════════════════════════════
          MODAL DE CADASTRO/EDIÇÃO LOTE ÚNICO
      ════════════════════════════════════════════════════════════════ */}
      {modalLote.aberto && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "var(--bg-card)", width: "100%", maxWidth: 460, borderRadius: 24, border: "1px solid var(--border-subtle)", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "white" }}>{modalLote.lote ? "Editar Lote" : "Novo Lote Individual"}</h2>
              <button onClick={() => setModalLote({aberto: false, quadraId: "", lote: null})} style={{ background: "transparent", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <form onSubmit={salvarLote} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Número do Lote</label>
                  <input type="text" required value={formLote.numero} onChange={e => setFormLote({...formLote, numero: e.target.value})} className="input-field" style={{ fontSize: 14 }} placeholder="Ex: 01" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>ID no SVG</label>
                  <input type="text" required value={formLote.svgPathId} onChange={e => setFormLote({...formLote, svgPathId: e.target.value})} className="input-field" style={{ fontSize: 14 }} placeholder="Ex: lote_q1_l1" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Área (m²)</label>
                  <input type="number" required value={formLote.area} onChange={e => setFormLote({...formLote, area: e.target.value})} className="input-field" style={{ fontSize: 14 }} placeholder="Ex: 200" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Valor Base (R$)</label>
                  <input type="number" required value={formLote.valor} onChange={e => setFormLote({...formLote, valor: e.target.value})} className="input-field" style={{ fontSize: 14 }} placeholder="Ex: 50000" />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Lotes Adjacentes</label>
                <input type="text" value={formLote.adjacentes} onChange={e => setFormLote({...formLote, adjacentes: e.target.value})} className="input-field" style={{ fontSize: 14 }} placeholder="Ex: lote_q1_l2, lote_q1_l3" />
                <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 4 }}>Separe os IDs do SVG por vírgula para a regra de venda sequencial.</p>
              </div>
              <button type="submit" style={{ marginTop: 8, padding: "14px", background: "var(--terracota)", color: "white", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
                <Check size={18}/> Salvar Lote
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL DE GERAÇÃO EM MASSA
      ════════════════════════════════════════════════════════════════ */}
      {modalMassa.aberto && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "var(--bg-card)", width: "100%", maxWidth: 460, borderRadius: 24, border: "1px solid var(--border-subtle)", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(56,189,248,0.1)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#38bdf8", display: "flex", alignItems: "center", gap: 8 }}><CopyPlus size={20}/> Gerador em Massa</h2>
              <button onClick={() => setModalMassa({aberto: false, quadraId: ""})} style={{ background: "transparent", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <form onSubmit={gerarLotesEmMassa} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
              
              <div style={{ padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px dashed var(--border-subtle)", marginBottom: 4 }}>
                 <p style={{ fontSize: 12, color: "var(--gray-light)", lineHeight: 1.5 }}>O sistema criará lotes automaticamente na sequência numérica. O ID no SVG será o prefixo mais o número (ex: <code>lote_1</code>, <code>lote_2</code>...).</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>De (Lote Nº)</label>
                  <input type="number" required value={formMassa.numInicial} onChange={e => setFormMassa({...formMassa, numInicial: Number(e.target.value)})} className="input-field" style={{ fontSize: 14 }} min={1} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Até (Lote Nº)</label>
                  <input type="number" required value={formMassa.numFinal} onChange={e => setFormMassa({...formMassa, numFinal: Number(e.target.value)})} className="input-field" style={{ fontSize: 14 }} min={1} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Área Padrão (m²)</label>
                  <input type="number" required value={formMassa.area} onChange={e => setFormMassa({...formMassa, area: e.target.value})} className="input-field" style={{ fontSize: 14 }} placeholder="Ex: 200" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Valor Padrão (R$)</label>
                  <input type="number" required value={formMassa.valor} onChange={e => setFormMassa({...formMassa, valor: e.target.value})} className="input-field" style={{ fontSize: 14 }} placeholder="Ex: 48000" />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Prefixo do ID SVG</label>
                <input type="text" required value={formMassa.prefixoSvg} onChange={e => setFormMassa({...formMassa, prefixoSvg: e.target.value})} className="input-field" style={{ fontSize: 14 }} placeholder="Ex: q1_lote_" />
              </div>
              <button type="submit" disabled={salvandoMassa} style={{ marginTop: 8, padding: "14px", background: "#38bdf8", color: "#0c4a6e", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", justifyContent: "center", gap: 8, alignItems: "center", transition: "0.2s" }}>
                {salvandoMassa ? "Gerando..." : <><CopyPlus size={18}/> Gerar {formMassa.numFinal >= formMassa.numInicial ? formMassa.numFinal - formMassa.numInicial + 1 : 0} Lotes</>}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}