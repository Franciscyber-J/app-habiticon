import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase"; 
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
// Precisamos importar o storage caso vocÊ tenha inicializado, mas para simplificar
// vamos focar na deleção do documento e usar uma lógica robusta se o storage admin não estiver configurado.
import { getStorage, ref, deleteObject } from "firebase/storage"; 

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────
// GET /api/leads
// ─────────────────────────────────────────────────────────
export async function GET() {
  try {
    const leadsRef = collection(db, "leads");
    const snapshot = await getDocs(leadsRef);
    
    const leads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("Erro ao buscar leads:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// POST /api/leads
// ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // ATUALIZADO: Adicionado whatsapp2 na desestruturação
    const { nome, whatsapp, whatsapp2, nomeCorretor, corretorId, empreendimento, modelo, valorImovel, area, quartos, simulacao, timestamp } = body;

    if (!nome || !whatsapp) {
      return NextResponse.json({ error: "Nome e WhatsApp são obrigatórios" }, { status: 400 });
    }

    let slug = empreendimento;
    if (slug) {
      slug = slug.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
    }

    const novoLead = {
      nome, 
      whatsapp,
      whatsapp2: whatsapp2 || "", // ATUALIZADO: Salva no banco de dados se existir
      nomeCorretor: nomeCorretor || "",
      corretorId: corretorId || "",                          
      empreendimentoNome: empreendimento || "Nova Iporá II",
      empreendimentoId: slug,
      modelo: modelo || "",
      valorImovel: valorImovel || 0,
      area: area || 0,           
      quartos: quartos || 0,     
      simulacao: simulacao || null, 
      timestamp: timestamp || new Date().toISOString(),
      status: "novo",
    };

    const docRef = await addDoc(collection(db, "leads"), novoLead);

    return NextResponse.json({ success: true, lead: { id: docRef.id, ...novoLead } });
  } catch (error) {
    console.error("Erro ao salvar lead:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// PATCH /api/leads
// ─────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const { leadId, status } = await req.json();
    if (!leadId || !status) return NextResponse.json({ error: "leadId e status são obrigatórios" }, { status: 400 });
    const leadDocRef = doc(db, "leads", leadId);
    await updateDoc(leadDocRef, { status: status });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// DELETE /api/leads — Deleta o lead E os arquivos no Storage
// ─────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { leadId } = await req.json();
    if (!leadId) return NextResponse.json({ error: "leadId é obrigatório" }, { status: 400 });

    const leadDocRef = doc(db, "leads", leadId);
    
    // 1. Busca os dados atuais do lead para encontrar os arquivos
    const leadSnap = await getDoc(leadDocRef);
    if (!leadSnap.exists()) {
      return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }
    
    const leadData = leadSnap.data();
    const arquivosParaDeletar: string[] = [];

    // 2. Coleta caminhos (paths) do Dossiê do Corretor
    if (leadData.dossie) {
      Object.values(leadData.dossie).forEach((pessoa: any) => {
        if (pessoa.documentos) {
          Object.values(pessoa.documentos).forEach((docInfo: any) => {
            if (docInfo.arquivos && Array.isArray(docInfo.arquivos)) {
              docInfo.arquivos.forEach((arq: any) => {
                const path = typeof arq === 'string' ? arq : arq.path;
                if (path && !path.startsWith("http")) { // Garante que temos um path real do Storage e não apenas uma URL
                   arquivosParaDeletar.push(path);
                }
              });
            }
          });
        }
      });
    }

    // 3. Coleta caminhos dos Documentos da Construtora
    if (leadData.documentosConstrutora) {
      const d = leadData.documentosConstrutora;
      // Arquivos de slots fixos
      Object.keys(d).forEach(key => {
        if (key !== 'pls' && key !== 'outros' && d[key] && d[key].path) {
          arquivosParaDeletar.push(d[key].path);
        }
      });
      // Arquivos de PLs
      if (Array.isArray(d.pls)) {
        d.pls.forEach((item: any) => { if (item.path) arquivosParaDeletar.push(item.path); });
      }
      // Outros documentos
      if (Array.isArray(d.outros)) {
        d.outros.forEach((item: any) => { if (item.path) arquivosParaDeletar.push(item.path); });
      }
    }

    // 4. Apaga arquivos físicos no Storage
    const storage = getStorage();
    const promisesDelete = arquivosParaDeletar.map(path => {
      const fileRef = ref(storage, path);
      return deleteObject(fileRef).catch(err => {
         console.warn(`Aviso: falha ao deletar arquivo no storage ${path}`, err);
         // Não quebra o processo se um arquivo não for encontrado
         return Promise.resolve(); 
      });
    });

    await Promise.all(promisesDelete);

    // 5. Finalmente, apaga o documento no Firestore
    await deleteDoc(leadDocRef);

    return NextResponse.json({ success: true, filesDeleted: arquivosParaDeletar.length });
  } catch (error) {
    console.error("Erro na exclusão do lead:", error);
    return NextResponse.json({ error: "Erro interno ao deletar" }, { status: 500 });
  }
}