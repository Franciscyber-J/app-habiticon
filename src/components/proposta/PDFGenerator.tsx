"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Send, X, User, Phone, Download, CheckCircle2, ShieldCheck } from "lucide-react";
import { formatBRL, formatBRLDecimal } from "@/lib/calculos";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, doc, getDoc } from "firebase/firestore";

interface Lead {
  nome: string;
  whatsapp: string;
  whatsapp2: string; // Adicionado telefone secundário
  nomeCorretor: string;
  corretorId: string;
}

interface PropostaData {
  empreendimento: string;
  cidade: string;
  estado: string;
  modelo: string;
  quartos?: number;       
  area: number;
  valorImovel: number;
  valorAvaliacao?: number; 
  entrada: number;
  ato: number;
  valorFinanciado: number;
  subsidio: number;
  taxa: number;
  prazoMeses: number;
  parcelaSACPrimeira: number;   
  parcelaSACUltima: number;
  parcelaPRICE: number;
  sacAprovadoPDF: boolean;      
  rendaFamiliar?: number;
  notasLegais: string;
  corretorId?: string; 
  origem?: string;     
}

interface PDFGeneratorProps {
  proposta: PropostaData;
}

export function PDFGenerator({ proposta }: PDFGeneratorProps) {
  const [etapa, setEtapa] = useState<"closed" | "lead" | "success">("closed");
  const [lead, setLead] = useState<Lead>({ nome: "", whatsapp: "", whatsapp2: "", nomeCorretor: "", corretorId: "" });
  const [loading, setLoading] = useState(false);
  
  const [listaCorretores, setListaCorretores] = useState<{id: string, nome: string}[]>([]);
  const [carregandoCorretores, setCarregandoCorretores] = useState(false);
  const [temCorretor, setTemCorretor] = useState(false);

  const isLinkProtegido = Boolean(proposta.corretorId);

  useEffect(() => {
    if (isLinkProtegido) {
      setTemCorretor(true);
      setLead(prev => ({ ...prev, corretorId: proposta.corretorId! }));
    }
  }, [isLinkProtegido, proposta.corretorId]);

  useEffect(() => {
    if (etapa !== "lead") return;

    const fetchCorretores = async () => {
      setCarregandoCorretores(true);
      try {
        const q = query(collection(db, "usuarios"), where("status", "==", "ativo"), where("role", "==", "corretor"));
        const snap = await getDocs(q);
        const corretores = snap.docs
          .map(d => ({ id: d.id, nome: d.data().nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome));
        
        setListaCorretores(corretores);
      } catch (err) {
        console.error("Erro ao buscar corretores:", err);
      } finally {
        setCarregandoCorretores(false);
      }
    };

    fetchCorretores();
  }, [etapa]);

  const formatWhatsApp = (val: string) => {
    const num = val.replace(/\D/g, "").slice(0, 11);
    if (num.length <= 2) return num;
    if (num.length <= 7) return `(${num.slice(0, 2)}) ${num.slice(2)}`;
    return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
  };

  const handleToggleTemCorretor = (valor: boolean) => {
     if (isLinkProtegido) return;
     setTemCorretor(valor);
     if (!valor) {
        setLead(prev => ({ ...prev, corretorId: "", nomeCorretor: "" }));
     }
  };

  const formValido = Boolean(
    lead.nome.trim() && 
    lead.whatsapp.replace(/\D/g, "").length >= 10 && 
    (!temCorretor || lead.corretorId)
  );

  const gerarPDF = async () => {
    if (!formValido) return;
    setLoading(true);

    try {
      const finalCorretorId = temCorretor ? lead.corretorId : "";
      let finalNomeCorretor = temCorretor ? lead.nomeCorretor : "";

      if (isLinkProtegido && !finalNomeCorretor) {
         try {
           const corretorDoc = await getDoc(doc(db, "usuarios", proposta.corretorId!));
           if(corretorDoc.exists()){
             finalNomeCorretor = (corretorDoc.data() as any).nome;
           }
         } catch(err){
           console.error("Erro ao resgatar nome do corretor dono do link", err);
         }
      } else if (temCorretor && lead.corretorId) {
          const c = listaCorretores.find(x => x.id === lead.corretorId);
          if (c) finalNomeCorretor = c.nome;
      }

      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...lead,
          corretorId: finalCorretorId,
          nomeCorretor: finalNomeCorretor,
          empreendimento: proposta.empreendimento,
          modelo: proposta.modelo,
          area: proposta.area || 0,
          quartos: proposta.quartos || 0,
          valorImovel: proposta.valorImovel,
          origem: proposta.origem || "organico",
          simulacao: {
            valorImovel: proposta.valorImovel,
            valorAvaliacao: proposta.valorAvaliacao || proposta.valorImovel,
            entrada: proposta.entrada,
            valorFinanciado: proposta.valorFinanciado,
            rendaFamiliar: proposta.rendaFamiliar || 0,
            subsidio: proposta.subsidio
          },
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});

      const { jsPDF } = await import("jspdf");
      const pdfDoc = new jsPDF({ orientation: "portrait", format: "a4" });
      const pageW = pdfDoc.internal.pageSize.getWidth();
      const pageH = pdfDoc.internal.pageSize.getHeight();

      pdfDoc.setFillColor(15, 30, 22);
      pdfDoc.rect(0, 0, pageW, pageH, "F");

      pdfDoc.setFillColor(33, 57, 43);
      pdfDoc.rect(0, 0, pageW, 35, "F");

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(20);
      pdfDoc.setTextColor(175, 111, 83);
      pdfDoc.text("HABITI", 20, 22);
      pdfDoc.setTextColor(216, 216, 215);
      pdfDoc.text("CON", 20 + pdfDoc.getTextWidth("HABITI"), 22);

      pdfDoc.setFontSize(9);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setTextColor(154, 154, 153);
      pdfDoc.text("CONSTRUÇÃO INTELIGENTE", 20, 29);

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(12);
      pdfDoc.setTextColor(216, 216, 215);
      pdfDoc.text("PROPOSTA COMERCIAL", pageW - 20, 18, { align: "right" });
      pdfDoc.setFontSize(9);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setTextColor(154, 154, 153);
      pdfDoc.text(new Date().toLocaleDateString("pt-BR"), pageW - 20, 25, { align: "right" });

      let y = 50;
      pdfDoc.setFillColor(33, 57, 43);
      pdfDoc.roundedRect(15, y - 6, pageW - 30, 28, 3, 3, "F");
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(175, 111, 83);
      pdfDoc.text("DADOS DO CLIENTE", 20, y + 2);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(11);
      pdfDoc.setTextColor(216, 216, 215);
      pdfDoc.text(lead.nome.toUpperCase(), 20, y + 11);
      pdfDoc.setFontSize(9);
      pdfDoc.setTextColor(154, 154, 153);
      pdfDoc.text(`WhatsApp: ${lead.whatsapp}`, 20, y + 18);
      
      if (finalNomeCorretor) {
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(154, 154, 153);
        pdfDoc.text(`Corretor(a): ${finalNomeCorretor}`, pageW - 20, y + 18, { align: "right" });
      }

      y += 38;
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(175, 111, 83);
      pdfDoc.text("IMÓVEL SELECIONADO", 20, y);
      y += 6;
      pdfDoc.setFillColor(33, 57, 43);
      pdfDoc.roundedRect(15, y - 2, pageW - 30, 34, 3, 3, "F");
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(14);
      pdfDoc.setTextColor(216, 216, 215);
      pdfDoc.text(`${proposta.empreendimento} — ${proposta.modelo}`, 20, y + 9);
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(154, 154, 153);
      pdfDoc.text(`${proposta.cidade}, ${proposta.estado} · Área: ${proposta.area}m²`, 20, y + 18);
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(13);
      pdfDoc.setTextColor(175, 111, 83);
      pdfDoc.text(`R$ ${proposta.valorImovel.toLocaleString("pt-BR")}`, 20, y + 28);

      y += 46;
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(175, 111, 83);
      pdfDoc.text("COMPOSIÇÃO FINANCEIRA", 20, y);
      y += 8;

      const linhas = [
        ["Entrada Total", formatBRL(proposta.entrada)],
        ["→ Ato Mínimo (50% — na assinatura)", formatBRL(proposta.ato)],
        ["→ Parcelamento (50% — 5x)", formatBRL(proposta.entrada - proposta.ato)],
        ...(proposta.subsidio > 0 ? [["Subsídio MCMV estimado", formatBRL(proposta.subsidio)]] : []),
        ["Saldo a financiar na Caixa", formatBRL(proposta.valorFinanciado)],
        ["Prazo do financiamento", `${proposta.prazoMeses / 12} anos (${proposta.prazoMeses} meses)`],
        ["Taxa de juros MCMV", `${proposta.taxa}% a.a.`],
      ];

      linhas.forEach((linha, i) => {
        const isAlt = i % 2 === 0;
        pdfDoc.setFillColor(isAlt ? 23 : 33, isAlt ? 39 : 57, isAlt ? 28 : 43);
        pdfDoc.rect(15, y - 4, pageW - 30, 10, "F");
        pdfDoc.setFont("helvetica", linha[0].startsWith("→") ? "normal" : "bold");
        pdfDoc.setFontSize(9);
        pdfDoc.setTextColor(linha[0].startsWith("→") ? 154 : 216, linha[0].startsWith("→") ? 154 : 216, linha[0].startsWith("→") ? 153 : 215);
        pdfDoc.text(linha[0], 20, y + 2);
        pdfDoc.setTextColor(175, 111, 83);
        pdfDoc.text(linha[1], pageW - 20, y + 2, { align: "right" });
        y += 10;
      });

      y += 8;
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(175, 111, 83);
      pdfDoc.text("PARCELAS DO FINANCIAMENTO", 20, y);
      y += 8;

      if (proposta.sacAprovadoPDF) {
        pdfDoc.setFillColor(23, 39, 28);
        pdfDoc.roundedRect(15, y - 4, (pageW - 35) / 2, 30, 3, 3, "F");
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(9);
        pdfDoc.setTextColor(74, 222, 128);
        pdfDoc.text("SISTEMA SAC", 15 + (pageW - 35) / 4, y + 3, { align: "center" });
        pdfDoc.setFontSize(10);
        pdfDoc.setTextColor(216, 216, 215);
        pdfDoc.text(`1ª: ${formatBRLDecimal(proposta.parcelaSACPrimeira)}`, 15 + (pageW - 35) / 4, y + 12, { align: "center" });
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(154, 154, 153);
        pdfDoc.text(`última: ${formatBRLDecimal(proposta.parcelaSACUltima)}`, 15 + (pageW - 35) / 4, y + 20, { align: "center" });

        const col2X = 15 + (pageW - 35) / 2 + 5;
        pdfDoc.setFillColor(23, 39, 28);
        pdfDoc.roundedRect(col2X, y - 4, (pageW - 35) / 2, 30, 3, 3, "F");
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(9);
        pdfDoc.setTextColor(175, 111, 83);
        pdfDoc.text("SISTEMA PRICE", col2X + (pageW - 35) / 4, y + 3, { align: "center" });
        pdfDoc.setFontSize(10);
        pdfDoc.setTextColor(216, 216, 215);
        pdfDoc.text(formatBRLDecimal(proposta.parcelaPRICE), col2X + (pageW - 35) / 4, y + 12, { align: "center" });
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(154, 154, 153);
        pdfDoc.text("parcela fixa", col2X + (pageW - 35) / 4, y + 20, { align: "center" });
      } else {
        pdfDoc.setFillColor(23, 39, 28);
        pdfDoc.roundedRect(15, y - 4, pageW - 30, 30, 3, 3, "F");
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(9);
        pdfDoc.setTextColor(175, 111, 83);
        pdfDoc.text("SISTEMA PRICE — TABELA INDICADA", pageW / 2, y + 3, { align: "center" });
        pdfDoc.setFontSize(13);
        pdfDoc.setTextColor(216, 216, 215);
        pdfDoc.text(formatBRLDecimal(proposta.parcelaPRICE), pageW / 2, y + 15, { align: "center" });
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(154, 154, 153);
        pdfDoc.text("parcela fixa · 360 meses", pageW / 2, y + 22, { align: "center" });
        
        y += 34;
        pdfDoc.setFont("helvetica", "italic");
        pdfDoc.setFontSize(7);
        pdfDoc.setTextColor(90, 90, 89);
        pdfDoc.text("* Sistema SAC não apresentado — parcela inicial excederia o limite de comprometimento de renda (30%).", 20, y);
        y -= 34; 
      }

      y += 40;
      pdfDoc.setFillColor(23, 39, 28);
      pdfDoc.roundedRect(15, y - 4, pageW - 30, 35, 3, 3, "F");
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(8);
      pdfDoc.setTextColor(154, 154, 153);
      pdfDoc.text("NOTAS LEGAIS", 20, y + 2);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(7);
      pdfDoc.setTextColor(90, 90, 89);
      const notasLinhas = pdfDoc.splitTextToSize(proposta.notasLegais, pageW - 40);
      pdfDoc.text(notasLinhas, 20, y + 10);

      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(8);
      pdfDoc.setTextColor(90, 90, 89);
      pdfDoc.text("Habiticon Construção Inteligente · CNPJ: 61.922.155/0001-70", pageW / 2, pageH - 15, { align: "center" });

      const nomeArquivo = `Proposta_Habiticon_${lead.nome.replace(/\s+/g, "_")}.pdf`;
      const mensagemWpp = `Olá ${lead.nome}! Segue a proposta da Habiticon referente ao ${proposta.modelo} em ${proposta.cidade}-${proposta.estado}.\n\nValor do imóvel: R$ ${proposta.valorImovel.toLocaleString("pt-BR")}\nEntrada: R$ ${proposta.entrada.toLocaleString("pt-BR")}\nFinanciamento: R$ ${proposta.valorFinanciado.toLocaleString("pt-BR")}\n\nEm caso de dúvidas, estou à disposição!`;

      const pdfBlob = pdfDoc.output("blob");
      const pdfFile = new File([pdfBlob], nomeArquivo, { type: "application/pdf" });

      const canShareFile = typeof navigator !== "undefined"
        && "share" in navigator
        && "canShare" in navigator
        && navigator.canShare({ files: [pdfFile] });

      if (canShareFile) {
        try {
          if (temCorretor) {
            await navigator.share({
              files: [pdfFile],
              title: nomeArquivo,
              text: mensagemWpp,
            });
          } else {
             pdfDoc.save(nomeArquivo);
          }
          setEtapa("success");
        } catch (shareErr: any) {
          if (shareErr?.name === "AbortError") {
            setLoading(false);
            return;
          }
          pdfDoc.save(nomeArquivo);
          setEtapa("success");
        }
      } else {
        pdfDoc.save(nomeArquivo);
        if (temCorretor) {
          const wppUrl = `https://wa.me/55${lead.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(mensagemWpp)}`;
          window.open(wppUrl, "_blank");
        }
        setEtapa("success");
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Erro ao gerar PDF:", err);
      }
      setEtapa("success");
    } finally {
      setLoading(false);
    }
  };

  const whatsappUrl = `https://wa.me/55${lead.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Olá ${lead.nome}! Segue a proposta da Habiticon referente ao ${proposta.modelo} em ${proposta.cidade}-${proposta.estado}.\n\nValor do imóvel: R$ ${proposta.valorImovel.toLocaleString("pt-BR")} | Entrada: R$ ${proposta.entrada.toLocaleString("pt-BR")}\n\nEm caso de dúvidas, estou à disposição!`
  )}`;
  const podeCompartilharNativo = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <>
      <motion.button
        onClick={() => setEtapa("lead")}
        className="btn-primary w-full"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <FileText size={18} />
        Gerar Proposta em PDF
      </motion.button>

      <AnimatePresence>
        {etapa !== "closed" && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setEtapa("closed"); }}
          >
            <motion.div
              className="modal-box"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              {etapa === "lead" && (
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-title" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>Dados do Cliente</h2>
                      <p className="text-muted" style={{ marginTop: 6, fontSize: 13 }}>Informações para a proposta personalizada</p>
                    </div>
                    <button onClick={() => setEtapa("closed")} className="btn-ghost p-3 -mr-2">
                      <X size={22} />
                    </button>
                  </div>

                  {/* LÓGICA DO CORRETOR — BLOQUEADA SE O LINK FOR PROTEGIDO */}
                  {isLinkProtegido ? (
                    <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 12, background: "rgba(175,111,83,0.1)", border: "1px solid rgba(175,111,83,0.25)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                       <ShieldCheck size={18} color="var(--terracota)" style={{ marginTop: 2, flexShrink: 0 }} />
                       <div>
                         <p style={{ fontSize: 13, fontWeight: 700, color: "var(--terracota-light)", marginBottom: 4 }}>Atendimento Exclusivo</p>
                         <p style={{ fontSize: 12, color: "var(--gray-mid)", lineHeight: 1.5 }}>
                           Você está a ser atendido de forma exclusiva por um dos nossos consultores parceiros. Ele entrará em contacto com a sua simulação guardada.
                         </p>
                       </div>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 24, display: "flex", gap: 10, background: "rgba(0,0,0,0.2)", padding: 8, borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                      <button 
                        type="button" 
                        onClick={() => handleToggleTemCorretor(false)} 
                        style={{ flex: 1, padding: "10px", borderRadius: 8, background: !temCorretor ? "var(--terracota)" : "transparent", color: !temCorretor ? "white" : "var(--gray-mid)", fontSize: 12, fontWeight: 700, transition: "0.2s", border: "none", cursor: "pointer" }}
                      >
                        Quero ser atendido
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleToggleTemCorretor(true)} 
                        style={{ flex: 1, padding: "10px", borderRadius: 8, background: temCorretor ? "var(--terracota)" : "transparent", color: temCorretor ? "white" : "var(--gray-mid)", fontSize: 12, fontWeight: 700, transition: "0.2s", border: "none", cursor: "pointer" }}
                      >
                        Já tenho corretor
                      </button>
                    </div>
                  )}

                  <div className="space-y-4 mb-8">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.15em] mb-2 block" style={{ color: "var(--gray-mid)" }}>
                        Nome completo
                      </label>
                      <div className="relative">
                        <User size={20} className="absolute left-6 top-1/2 -translate-y-1/2 z-10" style={{ color: "var(--terracota)" }} />
                        <input
                          type="text"
                          className="input-field"
                          style={{ height: 50, fontSize: 15, paddingLeft: 64 }}
                          placeholder="Nome do cliente"
                          value={lead.nome}
                          onChange={(e) => setLead((p) => ({ ...p, nome: e.target.value }))}
                          autoComplete="name"
                        />
                      </div>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.15em] mb-2 block" style={{ color: "var(--gray-mid)" }}>
                          WhatsApp
                        </label>
                        <div className="relative">
                          <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 z-10" style={{ color: "var(--terracota)" }} />
                          <input
                            type="tel"
                            className="input-field"
                            style={{ height: 50, fontSize: 15, paddingLeft: 44 }}
                            placeholder="(62) 99999-9999"
                            value={lead.whatsapp}
                            onChange={(e) => setLead((p) => ({ ...p, whatsapp: formatWhatsApp(e.target.value) }))}
                            inputMode="numeric"
                            autoComplete="tel"
                          />
                        </div>
                      </div>

                      {/* NOVO CAMPO: TELEFONE 2 */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.15em] mb-2 block" style={{ color: "var(--gray-mid)" }}>
                          WhatsApp 2 (Opcional)
                        </label>
                        <div className="relative">
                          <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 z-10" style={{ color: "var(--gray-dark)" }} />
                          <input
                            type="tel"
                            className="input-field"
                            style={{ height: 50, fontSize: 15, paddingLeft: 44 }}
                            placeholder="(62) 99999-9999"
                            value={lead.whatsapp2}
                            onChange={(e) => setLead((p) => ({ ...p, whatsapp2: formatWhatsApp(e.target.value) }))}
                            inputMode="numeric"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{ 
                      background: "rgba(0,0,0,0.6)", 
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "24px",
                      padding: "32px 40px",
                      marginBottom: "32px"
                    }}
                  >
                    <p 
                      style={{ 
                        color: "var(--terracota)", 
                        fontSize: "10px", 
                        fontWeight: "900", 
                        textTransform: "uppercase", 
                        letterSpacing: "0.2em", 
                        marginBottom: "24px",
                        marginTop: "4px"
                      }}
                    >
                      Resumo Técnico da Proposta
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm">
                        <span style={{ color: "var(--gray-dark)", fontWeight: "bold", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.15em" }} className="whitespace-nowrap">Imóvel Sugerido</span>
                        <span style={{ color: "var(--gray-light)", fontWeight: 600 }} className="text-right sm:text-left">{proposta.modelo} · {formatBRL(proposta.valorImovel)}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm" style={{ paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                        <span style={{ color: "var(--gray-dark)", fontWeight: "bold", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.15em" }} className="whitespace-nowrap">Entrada Total</span>
                        <span style={{ color: "var(--gray-light)", fontWeight: 600 }}>{formatBRL(proposta.entrada)}</span>
                      </div>
                      
                      {proposta.sacAprovadoPDF ? (
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm">
                          <span style={{ color: "var(--gray-dark)", fontWeight: "bold", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.15em" }} className="whitespace-nowrap">Parcela SAC (1ª)</span>
                          <span style={{ color: "var(--terracota-light)", fontWeight: 800, fontSize: 20 }}>{formatBRLDecimal(proposta.parcelaSACPrimeira)}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm">
                          <span style={{ color: "var(--gray-dark)", fontWeight: "bold", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.15em" }} className="whitespace-nowrap">Parcela PRICE (fixa)</span>
                          <span style={{ color: "var(--terracota-light)", fontWeight: 800, fontSize: 20 }}>{formatBRLDecimal(proposta.parcelaPRICE)}</span>
                        </div>
                      )}
                      
                      {!proposta.sacAprovadoPDF && (
                        <div style={{ fontSize: 11, color: "var(--gray-dark)", paddingTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ color: "#fb923c" }}>⚠️</span>
                          <span>SAC omitido — parcela inicial excederia 30% da renda. Apenas PRICE na proposta.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {temCorretor && !isLinkProtegido && (
                    <div style={{ marginBottom: 24 }}>
                      <label className="text-[10px] font-black uppercase tracking-[0.15em] mb-4 block" style={{ color: "var(--gray-mid)" }}>
                        Selecione o Corretor(a) <span style={{ color: "var(--terracota)" }}>*</span>
                      </label>
                      <div className="relative">
                        <User size={20} className="absolute left-6 top-1/2 -translate-y-1/2 z-10" style={{ color: "var(--terracota)", pointerEvents: "none" }} />
                        
                        <select
                          className="input-field"
                          style={{ height: 56, fontSize: 16, paddingLeft: 64, appearance: "none", cursor: "pointer", color: lead.corretorId ? "white" : "var(--gray-dark)" }}
                          value={lead.corretorId}
                          onChange={(e) => {
                            const selecionado = listaCorretores.find(c => c.id === e.target.value);
                            setLead(p => ({ ...p, corretorId: e.target.value, nomeCorretor: selecionado?.nome || "" }));
                          }}
                          disabled={carregandoCorretores}
                        >
                          <option value="" disabled>
                            {carregandoCorretores ? "Carregando equipe..." : "Selecione quem está te atendendo"}
                          </option>
                          {listaCorretores.map(c => (
                             <option key={c.id} value={c.id} style={{ background: "#17271C", color: "#D8D8D7" }}>
                               {c.nome}
                             </option>
                          ))}
                        </select>
                        <div style={{ position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                           <svg width="14" height="8" viewBox="0 0 14 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <path d="M1 1L7 7L13 1" stroke="var(--terracota)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                           </svg>
                        </div>
                      </div>
                    </div>
                  )}

                  {!temCorretor && !isLinkProtegido && (
                    <div style={{ marginBottom: 24, padding: "16px", borderRadius: 12, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
                       <p style={{ fontSize: 13, color: "#4ade80", textAlign: "center", lineHeight: 1.5 }}>
                         Após gerar a proposta, um de nossos especialistas em financiamento analisará seu perfil e entrará em contato!
                       </p>
                    </div>
                  )}

                  <button
                    onClick={gerarPDF}
                    disabled={!formValido || loading}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                      width: "100%", padding: "18px", borderRadius: "14px", border: "none",
                      fontSize: "16px", fontWeight: 800, transition: "all 0.3s ease",
                      background: formValido ? "var(--terracota)" : "rgba(255,255,255,0.08)",
                      color: formValido ? "#ffffff" : "var(--gray-mid)",
                      boxShadow: formValido ? "0 8px 24px rgba(175,111,83,0.4)" : "none",
                      cursor: formValido ? "pointer" : "not-allowed",
                      transform: formValido ? "translateY(-2px)" : "none"
                    }}
                  >
                    {loading ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                           <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                         </svg>
                         Gerando Proposta...
                      </span>
                    ) : (
                      <>
                        <Download size={22} />
                        Gerar e Baixar Proposta
                      </>
                    )}
                  </button>
                  <style dangerouslySetInnerHTML={{__html: `
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                  `}} />
                </div>
              )}

              {etapa === "success" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center"
                  style={{ padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center" }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="w-16 h-16 rounded-full flex-center mx-auto mb-4"
                    style={{ background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <CheckCircle2 size={32} color="#4ade80" />
                  </motion.div>

                  <h2 className="text-title mb-2" style={{ fontSize: 20, fontWeight: 800, color: "white", marginBottom: 8 }}>Proposta Gerada!</h2>
                  
                  {temCorretor ? (
                     <p className="text-muted mb-6" style={{ fontSize: 14, color: "var(--gray-mid)", lineHeight: 1.5, marginBottom: 24 }}>
                       A proposta de <strong style={{ color: "var(--gray-light)" }}>{lead.nome}</strong> foi gerada com sucesso e vinculada de forma segura ao corretor.
                     </p>
                  ) : (
                     <p className="text-muted mb-6" style={{ fontSize: 14, color: "var(--gray-mid)", lineHeight: 1.5, marginBottom: 24 }}>
                       A sua proposta foi gerada! <strong style={{ color: "var(--gray-light)" }}>A nossa equipe entrará em contato em breve pelo WhatsApp.</strong>
                     </p>
                  )}

                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
                    {temCorretor && !podeCompartilharNativo && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary w-full"
                        style={{ background: "#22c55e", padding: "14px", borderRadius: 12, display: "flex", justifyContent: "center", gap: 8, color: "white", fontWeight: 700, textDecoration: "none" }}
                      >
                        <Send size={18} />
                        Abrir WhatsApp Web
                      </a>
                    )}
                    {temCorretor && podeCompartilharNativo && (
                      <p style={{ fontSize: 13, color: "var(--gray-mid)", textAlign: "center" }}>
                        PDF enviado via compartilhamento nativo 📲
                      </p>
                    )}
                    
                    <button
                      onClick={() => { setEtapa("closed"); setLead({ nome: "", whatsapp: "", whatsapp2: "", nomeCorretor: "", corretorId: "" }); }}
                      style={{ padding: "14px", background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--gray-light)", borderRadius: 12, fontWeight: 700, cursor: "pointer", width: "100%" }}
                    >
                      Fechar
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}