"use client";

import { useState, useMemo, useRef } from "react";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Landmark, ChevronDown, ChevronUp, User, 
  CalendarDays, Plus, Building2, ArrowRightLeft, ShieldAlert,
  Car, FileCheck2, Upload, Send, CheckCircle2, Clock, ExternalLink, X
} from "lucide-react";

interface GestaoRecebiveisProps {
  leads: any[];
  empreendimentos: any[];
  onGerarContrato?: (lead: any) => void;
}

const formatBRL = (val: number) => 
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

// ─────────────────────────────────────────────────────────
// COMPONENTE PACOTE DE ASSINATURA
// ─────────────────────────────────────────────────────────

function PacoteAssinatura({ cliente, empreendimento }: { cliente: any, empreendimento: any }) {
  const pacote = cliente.pacoteAssinatura || {};
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadando, setUploadando] = useState<string | null>(null);
  const [seletorMemorial, setSeletorMemorial] = useState(false);

  const documentosPadrao = empreendimento?.documentosPadrao || [];

  const sugestaoMemorial = documentosPadrao.find((d: any) => {
    const nomeArquivo = (d.nomeOriginal || "").toLowerCase();
    const modelo = (cliente.modelo || "").toLowerCase();
    return (
      (modelo.includes("2q") && nomeArquivo.includes("2q")) ||
      (modelo.includes("3q") && nomeArquivo.includes("3q")) ||
      (modelo.includes("2 quart") && (nomeArquivo.includes("2q") || nomeArquivo.includes("2"))) ||
      (modelo.includes("3 quart") && (nomeArquivo.includes("3q") || nomeArquivo.includes("3"))) ||
      nomeArquivo.includes("memorial")
    );
  });

  const importarMemorial = async (docItem: any) => {
    try {
      await updateDoc(doc(db, "leads", cliente.id), {
        "pacoteAssinatura.memorialDescritivo": {
          url: docItem.url,
          nome: docItem.nomeOriginal,
          data: new Date().toISOString()
        }
      });
      setSeletorMemorial(false);
    } catch (e) {
      alert("Erro ao importar memorial.");
    }
  };

  const uploadContratoCaixa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadando("caixa");
    try {
      const path = `leads/${cliente.id}/pacote/contrato_caixa_${Date.now()}.pdf`;
      const storageRef = ref(storage, path);
      const task = await uploadBytesResumable(storageRef, file);
      const url = await getDownloadURL(task.ref);
      await updateDoc(doc(db, "leads", cliente.id), {
        "pacoteAssinatura.contratoCaixa": {
          url,
          nome: file.name,
          data: new Date().toISOString()
        }
      });
    } catch (e) {
      alert("Erro ao fazer upload do contrato da Caixa.");
    } finally {
      setUploadando(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removerDocumento = async (campo: string) => {
    if (!confirm("Remover este documento do pacote?")) return;
    await updateDoc(doc(db, "leads", cliente.id), {
      [`pacoteAssinatura.${campo}`]: null
    });
  };

  const slots = [
    {
      id: "contratoHabiticon",
      label: "Contrato Habiticon",
      cor: "#fb923c",
      descricao: "Gerado pelo botão 'Gerar Contrato' e importado automaticamente",
      dados: pacote.contratoHabiticon,
      acaoManual: null as (() => void) | null,
    },
    {
      id: "memorialDescritivo",
      label: "Memorial Descritivo",
      cor: "#a78bfa",
      descricao: sugestaoMemorial
        ? `Sugestão automática: ${sugestaoMemorial.nomeOriginal}`
        : "Selecione da central de arquivos do empreendimento",
      dados: pacote.memorialDescritivo,
      acaoManual: (() => {
        if (sugestaoMemorial) {
          importarMemorial(sugestaoMemorial);
        } else {
          setSeletorMemorial(true);
        }
      }) as (() => void) | null,
    },
    {
      id: "contratoCaixa",
      label: "Contrato da Caixa",
      cor: "#38bdf8",
      descricao: "Upload do PDF gerado pelo correspondente bancário",
      dados: pacote.contratoCaixa,
      acaoManual: (() => fileInputRef.current?.click()) as (() => void) | null,
    },
  ];

  const totalProntos = slots.filter(s => s.dados).length;
  const tudoPronto = totalProntos === 3;

  return (
    <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "20px 24px", background: "rgba(0,0,0,0.15)" }}>
      
      <input type="file" ref={fileInputRef} accept=".pdf" onChange={uploadContratoCaixa} style={{ display: "none" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h5 style={{ fontSize: 14, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
          <FileCheck2 size={16} color="#a78bfa" />
          Pacote de Assinatura
          <span style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 100, fontWeight: 700,
            background: tudoPronto ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.05)",
            color: tudoPronto ? "#4ade80" : "var(--gray-mid)"
          }}>
            {totalProntos}/3 prontos
          </span>
        </h5>

        {tudoPronto && (
          <button
            onClick={() => window.open("https://app.autentique.com.br/", "_blank")}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
              borderRadius: 10, background: "#4ade80", color: "#052e16",
              border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer",
              boxShadow: "0 4px 14px rgba(74,222,128,0.3)"
            }}
          >
            <Send size={14} /> Enviar Pacote para Autentique
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {slots.map(slot => (
          <div
            key={slot.id}
            style={{
              padding: "12px 16px", borderRadius: 12,
              border: slot.dados ? `1px solid ${slot.cor}40` : "1px solid var(--border-subtle)",
              background: slot.dados ? `${slot.cor}08` : "rgba(0,0,0,0.2)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 200 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: slot.dados ? `${slot.cor}20` : "rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {slot.dados
                  ? <CheckCircle2 size={16} color={slot.cor} />
                  : <Clock size={16} color="var(--gray-dark)" />
                }
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: slot.dados ? "white" : "var(--gray-mid)" }}>
                  {slot.label}
                </p>
                <p style={{ fontSize: 11, color: slot.dados ? slot.cor : "var(--gray-dark)", marginTop: 2 }}>
                  {slot.dados ? slot.dados.nome : slot.descricao}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {slot.dados ? (
                <>
                  <a
                    href={slot.dados.url}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      padding: "6px 12px", borderRadius: 8,
                      background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)",
                      color: "var(--gray-light)", fontSize: 11, fontWeight: 700,
                      textDecoration: "none", display: "flex", alignItems: "center", gap: 4
                    }}
                  >
                    <ExternalLink size={12} /> Ver
                  </a>
                  <button
                    onClick={() => removerDocumento(slot.id)}
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: "rgba(239,68,68,0.1)", border: "none",
                      color: "#f87171", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                  >
                    <X size={12} />
                  </button>
                </>
              ) : (
                slot.acaoManual && (
                  <button
                    onClick={slot.acaoManual}
                    disabled={uploadando === "caixa"}
                    style={{
                      padding: "6px 14px", borderRadius: 8,
                      background: `${slot.cor}15`, border: `1px solid ${slot.cor}40`,
                      color: slot.cor, fontSize: 11, fontWeight: 700,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6
                    }}
                  >
                    <Upload size={12} />
                    {slot.id === "contratoCaixa"
                      ? (uploadando === "caixa" ? "Enviando..." : "Upload PDF")
                      : (slot.id === "memorialDescritivo" && sugestaoMemorial
                        ? "Importar Sugestão"
                        : "Selecionar")
                    }
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* SELETOR MANUAL DE MEMORIAL */}
      {seletorMemorial && (
        <div style={{ marginTop: 12, padding: 16, borderRadius: 12, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>Selecione o Memorial Descritivo:</p>
            <button onClick={() => setSeletorMemorial(false)} style={{ background: "none", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>
          {documentosPadrao.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--gray-dark)" }}>
              Nenhum arquivo disponível. Faça upload na aba "Arquivos Padrão" do Admin.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {documentosPadrao.map((d: any, i: number) => (
                <button
                  key={i}
                  onClick={() => importarMemorial(d)}
                  style={{
                    padding: "10px 14px", borderRadius: 8,
                    background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-subtle)",
                    color: "white", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", textAlign: "left"
                  }}
                >
                  📄 {d.nomeOriginal}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!tudoPronto && (
        <p style={{ fontSize: 11, color: "var(--gray-dark)", marginTop: 12, textAlign: "center" }}>
          O botão de envio para o Autentique aparece quando os 3 documentos estiverem prontos.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────

export function GestaoRecebiveis({ leads, empreendimentos, onGerarContrato }: GestaoRecebiveisProps) {
  const [expandido, setExpandido] = useState<string | null>(null);

  const clientesAtivos = useMemo(() => {
    return leads.filter(l => l.status === "qualificado" || l.status === "credito_aprovado")
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [leads]);

  const adicionarParcelaEntrada = async (leadId: string, atual: any[]) => {
    const descricao = prompt("O que é este recebimento?\nEx: Sinal em PIX, Mensal, Carro Ônix placa XYZ, Lote Permuta...", "Parcela");
    if (!descricao) return;

    const valorStr = prompt(`Qual o valor de avaliação de "${descricao}"? (R$)`);
    if (!valorStr) return;
    
    const valor = parseFloat(valorStr.replace(/\./g, "").replace(",", "."));
    if (isNaN(valor) || valor <= 0) return alert("Valor inválido.");

    const data = prompt("Data de Entrada/Vencimento (DD/MM/AAAA):");
    if (!data) return;

    const isPermuta = descricao.toLowerCase().includes("carro") || descricao.toLowerCase().includes("moto") || descricao.toLowerCase().includes("veículo") || descricao.toLowerCase().includes("lote") || descricao.toLowerCase().includes("permuta");

    const novaParcela = {
      id: `ent_${Date.now()}`,
      descricao,
      valor,
      vencimento: data,
      pago: isPermuta ? true : false,
      tipo: isPermuta ? "permuta" : "parcela"
    };

    try {
      await updateDoc(doc(db, "leads", leadId), {
        "financeiro.entrada": [...atual, novaParcela]
      });
    } catch (e) {
      alert("Erro ao adicionar parcela.");
    }
  };

  const adicionarMedicaoPls = async (leadId: string, atual: any[]) => {
    const valorStr = prompt("Valor esperado da Medição (R$):");
    if (!valorStr) return;
    
    const valor = parseFloat(valorStr.replace(/\./g, "").replace(",", "."));
    if (isNaN(valor) || valor <= 0) return alert("Valor inválido.");

    const previsao = prompt("Previsão de Pagamento (Mês/Ano):");
    if (!previsao) return;

    const novaMedicao = {
      id: `pls_${Date.now()}`,
      valor,
      previsao,
      pago: false
    };

    try {
      await updateDoc(doc(db, "leads", leadId), {
        "financeiro.pls": [...atual, novaMedicao]
      });
    } catch (e) {
      alert("Erro ao adicionar medição.");
    }
  };

  const darBaixa = async (leadId: string, fieldPath: string, arrayAtual: any[], itemId: string) => {
    if (!confirm("Confirmar recebimento deste valor na conta?")) return;
    
    const arrayAtualizado = arrayAtual.map(item => 
      item.id === itemId ? { ...item, pago: true, dataPagamento: new Date().toISOString() } : item
    );

    try {
      await updateDoc(doc(db, "leads", leadId), {
        [fieldPath]: arrayAtualizado
      });
    } catch (e) {
      alert("Erro ao dar baixa.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      <div style={{ background: "rgba(56,189,248,0.08)", padding: "20px", borderRadius: 16, border: "1px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Landmark size={24} color="#38bdf8" />
        </div>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "white", marginBottom: 4 }}>Gestão de Recebíveis & Contratos</h3>
          <p style={{ fontSize: 13, color: "var(--gray-mid)", lineHeight: 1.5 }}>
            Controle o fluxo de caixa individual. Registe o <strong>Sinal</strong>, os parcelamentos e as <strong>Permutas (veículos/lotes)</strong> do lado do cliente, e as <strong>Medições PLS</strong> do lado da Caixa.
          </p>
        </div>
      </div>

      {clientesAtivos.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
          <p style={{ color: "var(--gray-mid)" }}>Nenhum contrato aprovado para gerenciar recebíveis.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {clientesAtivos.map((cliente) => {
            const emp = empreendimentos.find(e => e.slug === cliente.empreendimentoId);
            const fin = cliente.financeiro || { entrada: [], pls: [] };
            const valorContrato = cliente.loteReserva?.valorVenda || cliente.valorImovel || 0;

            const totalClientePago = fin.entrada.filter((e:any) => e.pago).reduce((acc:number, e:any) => acc + e.valor, 0);
            const totalClientePendente = fin.entrada.filter((e:any) => !e.pago).reduce((acc:number, e:any) => acc + e.valor, 0);

            const prontosPacote = [
              cliente.pacoteAssinatura?.contratoHabiticon,
              cliente.pacoteAssinatura?.memorialDescritivo,
              cliente.pacoteAssinatura?.contratoCaixa
            ].filter(Boolean).length;

            return (
              <div key={cliente.id} style={{ background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                
                <div 
                  onClick={() => setExpandido(expandido === cliente.id ? null : cliente.id)}
                  style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-light)", fontWeight: 800 }}>
                      {(cliente.nome || "?")[0]}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h4 style={{ fontSize: 16, fontWeight: 800, color: "white" }}>{cliente.nome}</h4>
                        {onGerarContrato && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onGerarContrato(cliente); }}
                            style={{ padding: "4px 10px", borderRadius: 6, background: "var(--terracota-glow)", color: "var(--terracota-light)", border: "1px solid var(--border-active)", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                          >
                            📄 Gerar Contrato
                          </button>
                        )}
                        {prontosPacote > 0 && (
                          <span style={{
                            fontSize: 10, padding: "2px 8px", borderRadius: 100, fontWeight: 700,
                            background: prontosPacote === 3 ? "rgba(74,222,128,0.15)" : "rgba(167,139,250,0.15)",
                            color: prontosPacote === 3 ? "#4ade80" : "#c084fc"
                          }}>
                            📋 {prontosPacote}/3
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: "var(--gray-mid)", display: "flex", alignItems: "center", gap: 4 }}>
                          <Building2 size={12} /> {emp?.nome || "Empreendimento"}
                        </span>
                        <span style={{ color: "var(--gray-dark)" }}>•</span>
                        <span style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700 }}>
                          Contrato: {formatBRL(valorContrato)}
                        </span>
                        {cliente.loteReserva?.numero && (
                          <>
                            <span style={{ color: "var(--gray-dark)" }}>•</span>
                            <span style={{ fontSize: 11, background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: 4, color: "var(--gray-light)" }}>
                              Lote {cliente.loteReserva.numero}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandido === cliente.id ? <ChevronUp size={20} color="var(--gray-dark)" /> : <ChevronDown size={20} color="var(--gray-dark)" />}
                </div>

                <AnimatePresence>
                  {expandido === cliente.id && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} style={{ overflow: "hidden" }}>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 1, background: "var(--border-subtle)", borderTop: "1px solid var(--border-subtle)" }}>
                        
                        {/* COLUNA ESQUERDA: ENTRADA / PERMUTA */}
                        <div style={{ background: "var(--bg-card)", padding: 24 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                            <h5 style={{ fontSize: 14, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
                              <User size={16} color="#fb923c" /> Pagamentos do Cliente
                            </h5>
                            <button 
                              onClick={() => adicionarParcelaEntrada(cliente.id, fin.entrada)}
                              style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(251,146,60,0.1)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.2)", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <Plus size={12} /> Lançar Pagamento
                            </button>
                          </div>

                          <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", gap: 8, marginBottom: 16 }}>
                            <ShieldAlert size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
                            <p style={{ fontSize: 11, color: "var(--gray-light)", lineHeight: 1.5 }}>
                              <strong style={{ color: "#f87171" }}>Atenção Contratual:</strong> Em caso de distrato, R$ 5.000,00 pagos no Ato ficam retidos para cobrir serviços iniciais. Atrasos nas parcelas sofrem multa de 10% + Juros de 2% a.m. + INCC.
                            </p>
                          </div>

                          {/* Sumário do Cliente */}
                          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                            <div style={{ flex: 1, padding: "8px 12px", background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8 }}>
                              <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase" }}>Já Entrou</p>
                              <p style={{ fontSize: 14, fontWeight: 800, color: "#4ade80" }}>{formatBRL(totalClientePago)}</p>
                            </div>
                            <div style={{ flex: 1, padding: "8px 12px", background: "rgba(251,146,60,0.05)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 8 }}>
                              <p style={{ fontSize: 10, color: "var(--gray-mid)", textTransform: "uppercase" }}>Pendente</p>
                              <p style={{ fontSize: 14, fontWeight: 800, color: "#fb923c" }}>{formatBRL(totalClientePendente)}</p>
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {fin.entrada.length === 0 ? (
                              <p style={{ fontSize: 12, color: "var(--gray-dark)", textAlign: "center", padding: "20px 0" }}>Nenhum valor ou permuta registrado.</p>
                            ) : (
                              fin.entrada.map((p: any) => (
                                <div key={p.id} style={{ padding: "12px 16px", borderRadius: 10, border: p.pago ? "1px solid rgba(74,222,128,0.2)" : "1px solid var(--border-subtle)", background: p.pago ? "rgba(74,222,128,0.05)" : "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <div>
                                    <p style={{ fontSize: 14, fontWeight: 800, color: p.pago ? "#4ade80" : "white", display: "flex", alignItems: "center", gap: 6 }}>
                                      {formatBRL(p.valor)}
                                      {p.tipo === "permuta" && <Car size={14} color="var(--gray-mid)" />}
                                    </p>
                                    <p style={{ fontSize: 12, color: "var(--gray-light)", marginTop: 4, fontWeight: 600 }}>{p.descricao}</p>
                                    <p style={{ fontSize: 11, color: "var(--gray-mid)", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                                      <CalendarDays size={11} /> {p.tipo === "permuta" ? "Avaliado em:" : "Venc:"} {p.vencimento}
                                    </p>
                                  </div>
                                  <div>
                                    {p.pago ? (
                                      <span style={{ fontSize: 10, fontWeight: 800, color: "#4ade80", background: "rgba(74,222,128,0.15)", padding: "4px 8px", borderRadius: 6 }}>PAGO / ENTREGUE</span>
                                    ) : (
                                      <button 
                                        onClick={() => darBaixa(cliente.id, "financeiro.entrada", fin.entrada, p.id)}
                                        style={{ padding: "6px 12px", background: "var(--terracota)", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                      >
                                        Dar Baixa
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* COLUNA DIREITA: REPASSES DA CAIXA */}
                        <div style={{ background: "var(--bg-card)", padding: 24 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                            <h5 style={{ fontSize: 14, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
                              <Building2 size={16} color="#38bdf8" /> Repasses da Caixa (PLS)
                            </h5>
                            <button 
                              onClick={() => adicionarMedicaoPls(cliente.id, fin.pls)}
                              style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <Plus size={12} /> Prever Medição
                            </button>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {fin.pls.length === 0 ? (
                              <p style={{ fontSize: 12, color: "var(--gray-dark)", textAlign: "center", padding: "20px 0" }}>Nenhuma medição prevista.</p>
                            ) : (
                              fin.pls.map((m: any) => (
                                <div key={m.id} style={{ padding: "12px 16px", borderRadius: 10, border: m.pago ? "1px solid rgba(74,222,128,0.2)" : "1px solid var(--border-subtle)", background: m.pago ? "rgba(74,222,128,0.05)" : "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <div>
                                    <p style={{ fontSize: 14, fontWeight: 800, color: m.pago ? "#4ade80" : "white" }}>{formatBRL(m.valor)}</p>
                                    <p style={{ fontSize: 11, color: "var(--gray-mid)", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                                      <ArrowRightLeft size={11} /> Previsão: {m.previsao}
                                    </p>
                                  </div>
                                  <div>
                                    {m.pago ? (
                                      <span style={{ fontSize: 10, fontWeight: 800, color: "#4ade80", background: "rgba(74,222,128,0.15)", padding: "4px 8px", borderRadius: 6 }}>CREDITADO</span>
                                    ) : (
                                      <button 
                                        onClick={() => darBaixa(cliente.id, "financeiro.pls", fin.pls, m.id)}
                                        style={{ padding: "6px 12px", background: "transparent", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.4)", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                      >
                                        Anotar Depósito
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                      </div>

                      {/* PACOTE DE ASSINATURA */}
                      <PacoteAssinatura 
                        cliente={cliente} 
                        empreendimento={emp}
                      />

                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}