"use client";

import { useState } from "react";
import { X, FileText, Download, Send, Upload, CheckCircle2 } from "lucide-react";
import { PDFDownloadLink, pdf } from "@react-pdf/renderer";
import { ContratoPDF } from "./ContratoPDF";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";

export function GeradorContratoModal({ lead, onClose }: { lead: any, onClose: () => void }) {
  const [formData, setFormData] = useState({
    nome: lead.nome || "",
    cpf: lead.dossie?.cpf || "",
    rg: lead.dossie?.rg || "",
    estadoCivil: lead.dossie?.estadoCivil || "",
    profissao: lead.dossie?.profissao || "",
    endereco: lead.dossie?.endereco || "",
    nacionalidade: "brasileiro(a)",
    area: lead.loteReserva?.area || lead.area || "60",
    lote: lead.loteReserva?.numero || "",
    empreendimentoNome: lead.empreendimentoNome || "",
    cidade: lead.cidade || "Firminópolis",
    estado: lead.estado || "GO",
    valorTotal: lead.loteReserva?.valorVenda || lead.valorImovel || 0,
  });

  const [importando, setImportando] = useState(false);
  const [importado, setImportado] = useState(!!lead.pacoteAssinatura?.contratoHabiticon);

  const handleImportarParaDossie = async () => {
    setImportando(true);
    try {
      const blob = await pdf(<ContratoPDF data={formData} />).toBlob();
      const nomeArquivo = `CONTRATO_HABITICON_${formData.nome.toUpperCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      const path = `leads/${lead.id}/pacote/${nomeArquivo}`;
      const storageRef = ref(storage, path);
      const task = await uploadBytesResumable(storageRef, blob);
      const url = await getDownloadURL(task.ref);

      await updateDoc(doc(db, "leads", lead.id), {
        "pacoteAssinatura.contratoHabiticon": {
          url,
          nome: nomeArquivo,
          data: new Date().toISOString()
        }
      });

      setImportado(true);
    } catch (e) {
      console.error("Erro ao importar contrato:", e);
      alert("Erro ao importar o contrato para o dossiê. Tente novamente.");
    } finally {
      setImportando(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 20, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}>
        
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 10 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={20} color="var(--terracota)" /> Gerar Contrato Habiticon
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--gray-mid)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 6, textTransform: "uppercase" }}>Nome Completo</label>
            <input className="input-field" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 6, textTransform: "uppercase" }}>CPF</label>
            <input className="input-field" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 6, textTransform: "uppercase" }}>RG</label>
            <input className="input-field" value={formData.rg} onChange={e => setFormData({...formData, rg: e.target.value})} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 6, textTransform: "uppercase" }}>Estado Civil</label>
            <select className="input-field" value={formData.estadoCivil} onChange={e => setFormData({...formData, estadoCivil: e.target.value})}>
              <option value="">Selecione...</option>
              <option value="solteiro(a)">Solteiro(a)</option>
              <option value="casado(a)">Casado(a)</option>
              <option value="divorciado(a)">Divorciado(a)</option>
              <option value="viúvo(a)">Viúvo(a)</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 6, textTransform: "uppercase" }}>Profissão</label>
            <input className="input-field" value={formData.profissao} onChange={e => setFormData({...formData, profissao: e.target.value})} />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 6, textTransform: "uppercase" }}>Endereço Completo</label>
            <input className="input-field" value={formData.endereco} onChange={e => setFormData({...formData, endereco: e.target.value})} placeholder="Rua, nº, Bairro, Cidade-UF" />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 6, textTransform: "uppercase" }}>Cidade</label>
            <input className="input-field" value={formData.cidade} onChange={e => setFormData({...formData, cidade: e.target.value})} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 6, textTransform: "uppercase" }}>Estado (UF)</label>
            <input className="input-field" value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})} placeholder="GO" maxLength={2} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 6, textTransform: "uppercase" }}>Área (m²)</label>
            <input className="input-field" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", marginBottom: 6, textTransform: "uppercase" }}>Nacionalidade</label>
            <input className="input-field" value={formData.nacionalidade} onChange={e => setFormData({...formData, nacionalidade: e.target.value})} />
          </div>
          
          <div style={{ padding: 16, background: "rgba(175,111,83,0.05)", borderRadius: 12, border: "1px solid rgba(175,111,83,0.15)", gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Valor do Contrato</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: "white" }}>R$ {formData.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "var(--gray-mid)", textTransform: "uppercase", fontWeight: 700 }}>Lote / Empreendimento</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: "var(--terracota-light)" }}>Lote {formData.lote} — {formData.empreendimentoNome}</p>
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 12 }}>
          
          {/* LINHA 1: BAIXAR + AUTENTIQUE */}
          <div style={{ display: "flex", gap: 12 }}>
            <PDFDownloadLink 
              document={<ContratoPDF data={formData} />} 
              fileName={`CONTRATO_HABITICON_${formData.nome.toUpperCase().replace(/\s+/g, '_')}.pdf`}
              style={{ flex: 1, textDecoration: 'none' }}
            >
              {({ loading }) => (
                <button disabled={loading} style={{ width: '100%', padding: "14px", borderRadius: 12, background: "var(--terracota)", color: "white", border: "none", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Download size={18} /> {loading ? "A processar..." : "Gerar e Baixar PDF"}
                </button>
              )}
            </PDFDownloadLink>

            <button 
              onClick={() => window.open('https://app.autentique.com.br/', '_blank')}
              style={{ flex: 1, padding: "14px", borderRadius: 12, background: "rgba(255,255,255,0.05)", color: "white", border: "1px solid var(--border-subtle)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Send size={18} /> Subir para Assinatura
            </button>
          </div>

          {/* LINHA 2: IMPORTAR PARA DOSSIÊ */}
          <button
            onClick={handleImportarParaDossie}
            disabled={importando || importado}
            style={{
              width: "100%", padding: "12px", borderRadius: 12, fontWeight: 700,
              cursor: importado ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13,
              background: importado ? "rgba(74,222,128,0.1)" : "rgba(167,139,250,0.15)",
              color: importado ? "#4ade80" : "#c084fc",
              border: importado ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(167,139,250,0.3)",
              opacity: importando ? 0.6 : 1,
              transition: "all 0.2s"
            }}
          >
            {importado ? (
              <><CheckCircle2 size={16} /> Contrato já importado para o Pacote de Assinatura</>
            ) : importando ? (
              <><Upload size={16} /> Gerando e enviando para o dossiê...</>
            ) : (
              <><Upload size={16} /> Gerar e Importar para o Pacote de Assinatura</>
            )}
          </button>

          {!importado && (
            <p style={{ fontSize: 11, color: "var(--gray-dark)", textAlign: "center" }}>
              Ao importar, o PDF é gerado automaticamente e salvo no Pacote de Assinatura do cliente na aba Recebíveis.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}