"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Send, X, User, Phone, Download, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { formatBRL, formatBRLDecimal } from "@/lib/calculos";

interface Lead {
  nome: string;
  whatsapp: string;
}

interface PropostaData {
  empreendimento: string;
  cidade: string;
  estado: string;
  modelo: string;
  area: number;
  valorImovel: number;
  entrada: number;
  ato: number;
  valorFinanciado: number;
  subsidio: number;
  taxa: number;
  prazoMeses: number;
  parcelaSACPrimeira: number;
  parcelaSACUltima: number;
  parcelaPRICE: number;
  notasLegais: string;
}

interface PDFGeneratorProps {
  proposta: PropostaData;
}

export function PDFGenerator({ proposta }: PDFGeneratorProps) {
  const [etapa, setEtapa] = useState<"closed" | "lead" | "success">("closed");
  const [lead, setLead] = useState<Lead>({ nome: "", whatsapp: "" });
  const [loading, setLoading] = useState(false);

  const formatWhatsApp = (val: string) => {
    const num = val.replace(/\D/g, "").slice(0, 11);
    if (num.length <= 2) return num;
    if (num.length <= 7) return `(${num.slice(0, 2)}) ${num.slice(2)}`;
    return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
  };

  const gerarPDF = async () => {
    if (!lead.nome.trim() || lead.whatsapp.replace(/\D/g, "").length < 10) return;
    setLoading(true);

    try {
      // Salva o lead via API
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...lead,
          empreendimento: proposta.empreendimento,
          modelo: proposta.modelo,
          valorImovel: proposta.valorImovel,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {}); // não bloquear se API falhar

      // Gera o PDF dinamicamente via jsPDF
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", format: "a4" });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Fundo
      doc.setFillColor(15, 30, 22);
      doc.rect(0, 0, pageW, pageH, "F");

      // Cabeçalho com fundo verde escuro
      doc.setFillColor(33, 57, 43);
      doc.rect(0, 0, pageW, 35, "F");

      // Logo text (sem imagem para simplificar)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(175, 111, 83);
      doc.text("HABITI", 20, 22);
      doc.setTextColor(216, 216, 215);
      doc.text("CON", 20 + doc.getTextWidth("HABITI"), 22);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(154, 154, 153);
      doc.text("CONSTRUÇÃO INTELIGENTE", 20, 29);

      // Título da proposta
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(216, 216, 215);
      doc.text("PROPOSTA COMERCIAL", pageW - 20, 18, { align: "right" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(154, 154, 153);
      doc.text(new Date().toLocaleDateString("pt-BR"), pageW - 20, 25, { align: "right" });

      // Dados do cliente
      let y = 50;
      doc.setFillColor(33, 57, 43);
      doc.roundedRect(15, y - 6, pageW - 30, 28, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(175, 111, 83);
      doc.text("DADOS DO CLIENTE", 20, y + 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(216, 216, 215);
      doc.text(lead.nome.toUpperCase(), 20, y + 11);
      doc.setFontSize(9);
      doc.setTextColor(154, 154, 153);
      doc.text(`WhatsApp: ${lead.whatsapp}`, 20, y + 18);

      // Dados do imóvel
      y += 38;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(175, 111, 83);
      doc.text("IMÓVEL SELECIONADO", 20, y);
      y += 6;
      doc.setFillColor(33, 57, 43);
      doc.roundedRect(15, y - 2, pageW - 30, 34, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(216, 216, 215);
      doc.text(`${proposta.empreendimento} — ${proposta.modelo}`, 20, y + 9);
      doc.setFontSize(10);
      doc.setTextColor(154, 154, 153);
      doc.text(`${proposta.cidade}, ${proposta.estado} · Área: ${proposta.area}m² · Lote: 250m²`, 20, y + 18);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(175, 111, 83);
      doc.text(`R$ ${proposta.valorImovel.toLocaleString("pt-BR")}`, 20, y + 28);

      // Tabela de valores
      y += 46;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(175, 111, 83);
      doc.text("COMPOSIÇÃO FINANCEIRA", 20, y);
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
        doc.setFillColor(isAlt ? 23 : 33, isAlt ? 39 : 57, isAlt ? 28 : 43);
        doc.rect(15, y - 4, pageW - 30, 10, "F");
        doc.setFont("helvetica", linha[0].startsWith("→") ? "normal" : "bold");
        doc.setFontSize(9);
        doc.setTextColor(linha[0].startsWith("→") ? 154 : 216, linha[0].startsWith("→") ? 154 : 216, linha[0].startsWith("→") ? 153 : 215);
        doc.text(linha[0], 20, y + 2);
        doc.setTextColor(175, 111, 83);
        doc.text(linha[1], pageW - 20, y + 2, { align: "right" });
        y += 10;
      });

      // Parcelas
      y += 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(175, 111, 83);
      doc.text("PARCELAS DO FINANCIAMENTO", 20, y);
      y += 8;

      doc.setFillColor(23, 39, 28);
      doc.roundedRect(15, y - 4, (pageW - 35) / 2, 30, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(74, 222, 128);
      doc.text("SISTEMA SAC", 15 + (pageW - 35) / 4, y + 3, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(216, 216, 215);
      doc.text(`1ª: ${formatBRLDecimal(proposta.parcelaSACPrimeira)}`, 15 + (pageW - 35) / 4, y + 12, { align: "center" });
      doc.setFontSize(8);
      doc.setTextColor(154, 154, 153);
      doc.text(`última: ${formatBRLDecimal(proposta.parcelaSACUltima)}`, 15 + (pageW - 35) / 4, y + 20, { align: "center" });

      const col2X = 15 + (pageW - 35) / 2 + 5;
      doc.setFillColor(23, 39, 28);
      doc.roundedRect(col2X, y - 4, (pageW - 35) / 2, 30, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(175, 111, 83);
      doc.text("SISTEMA PRICE", col2X + (pageW - 35) / 4, y + 3, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(216, 216, 215);
      doc.text(formatBRLDecimal(proposta.parcelaPRICE), col2X + (pageW - 35) / 4, y + 12, { align: "center" });
      doc.setFontSize(8);
      doc.setTextColor(154, 154, 153);
      doc.text("parcela fixa", col2X + (pageW - 35) / 4, y + 20, { align: "center" });

      // Notas Legais
      y += 40;
      doc.setFillColor(23, 39, 28);
      doc.roundedRect(15, y - 4, pageW - 30, 35, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(154, 154, 153);
      doc.text("NOTAS LEGAIS", 20, y + 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 89);
      const notasLinhas = doc.splitTextToSize(proposta.notasLegais, pageW - 40);
      doc.text(notasLinhas, 20, y + 10);

      // Rodapé
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(90, 90, 89);
      doc.text("Habiticon Construção Inteligente · CNPJ: 00.000.000/0001-00", pageW / 2, pageH - 15, { align: "center" });

      // Download
      doc.save(`Proposta_Habiticon_${lead.nome.replace(/\s+/g, "_")}.pdf`);
      setEtapa("success");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setLoading(false);
    }
  };

  const whatsappUrl = `https://wa.me/55${lead.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Olá ${lead.nome}! Segue a proposta da Habiticon referente ao ${proposta.modelo} em ${proposta.cidade}-${proposta.estado}. Em caso de dúvidas, estou à disposição!`
  )}`;

  return (
    <>
      {/* Botão de gatilho */}
      <motion.button
        onClick={() => setEtapa("lead")}
        className="btn-primary w-full"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <FileText size={18} />
        Gerar Proposta em PDF
      </motion.button>

      {/* Modal */}
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
                  <div className="flex items-center justify-between mb-16">
                    <div>
                      <h2 className="text-title" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>Dados do Cliente</h2>
                      <p className="text-muted" style={{ marginTop: 6, fontSize: 13 }}>Informações para a proposta personalizada</p>
                    </div>
                    <button onClick={() => setEtapa("closed")} className="btn-ghost p-3 -mr-2">
                      <X size={22} />
                    </button>
                  </div>

                  <div className="space-y-10 mb-12">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.15em] mb-4 block" style={{ color: "var(--gray-mid)" }}>
                        Nome completo
                      </label>
                      <div className="relative">
                        <User size={20} className="absolute left-6 top-1/2 -translate-y-1/2 z-10" style={{ color: "var(--terracota)" }} />
                        <input
                          type="text"
                          className="input-field"
                          style={{ height: 64, fontSize: 16, paddingLeft: 64 }}
                          placeholder="Nome do cliente"
                          value={lead.nome}
                          onChange={(e) => setLead((p) => ({ ...p, nome: e.target.value }))}
                          autoComplete="name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.15em] mb-4 block" style={{ color: "var(--gray-mid)" }}>
                        WhatsApp
                      </label>
                      <div className="relative">
                        <Phone size={20} className="absolute left-6 top-1/2 -translate-y-1/2 z-10" style={{ color: "var(--terracota)" }} />
                        <input
                          type="tel"
                          className="input-field"
                          style={{ height: 64, fontSize: 16, paddingLeft: 64 }}
                          placeholder="(62) 99999-9999"
                          value={lead.whatsapp}
                          onChange={(e) => setLead((p) => ({ ...p, whatsapp: formatWhatsApp(e.target.value) }))}
                          inputMode="numeric"
                          autoComplete="tel"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preview da proposta */}
                  <div
                    style={{ 
                      background: "rgba(0,0,0,0.6)", 
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "24px",
                      padding: "32px 40px",
                      marginBottom: "40px",
                      marginTop: "32px"
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
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm">
                        <span style={{ color: "var(--gray-dark)", fontWeight: "bold", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.15em" }} className="whitespace-nowrap">Parcela (SAC 1ª)</span>
                        <span style={{ color: "var(--terracota-light)", fontWeight: 800, fontSize: 20 }}>{formatBRLDecimal(proposta.parcelaSACPrimeira)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={gerarPDF}
                    disabled={!lead.nome.trim() || lead.whatsapp.replace(/\D/g, "").length < 10 || loading}
                    className="btn-primary w-full"
                    style={{ opacity: !lead.nome.trim() || lead.whatsapp.replace(/\D/g, "").length < 10 ? 0.5 : 1 }}
                  >
                    {loading ? (
                      <span>Gerando PDF...</span>
                    ) : (
                      <>
                        <Download size={18} />
                        Gerar e Baixar Proposta
                      </>
                    )}
                  </button>
                </div>
              )}

              {etapa === "success" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="w-16 h-16 rounded-full flex-center mx-auto mb-4"
                    style={{ background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.4)" }}
                  >
                    <CheckCircle2 size={32} color="#4ade80" />
                  </motion.div>

                  <h2 className="text-title mb-2">PDF Gerado com Sucesso!</h2>
                  <p className="text-muted mb-6">
                    A proposta de <strong style={{ color: "var(--gray-light)" }}>{lead.nome}</strong> foi baixada.
                  </p>

                  <div className="space-y-3">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary w-full"
                      style={{ background: "#22c55e" }}
                    >
                      <Send size={18} />
                      Enviar via WhatsApp
                    </a>
                    <button
                      onClick={() => { setEtapa("closed"); setLead({ nome: "", whatsapp: "" }); }}
                      className="btn-ghost w-full"
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
