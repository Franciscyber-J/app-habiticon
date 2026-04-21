import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase"; // Importando a conexão do Firebase que criamos
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";

// Evita cache da API
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────
// GET /api/leads — Busca os leads direto do Firebase
// ─────────────────────────────────────────────────────────
export async function GET() {
  try {
    const leadsRef = collection(db, "leads");
    const snapshot = await getDocs(leadsRef);
    
    // Mapeia os documentos do Firestore para um array de objetos
    const leads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("Erro ao buscar leads no Firebase:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// POST /api/leads — Salva novo lead no Firebase
// ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nome, whatsapp, nomeCorretor, empreendimento, modelo, valorImovel, timestamp } = body;

    if (!nome || !whatsapp) {
      return NextResponse.json({ error: "Nome e WhatsApp são obrigatórios" }, { status: 400 });
    }

    // ─────────────────────────────────────────────────────────────────
    // CORREÇÃO CRÍTICA: Geração do Slug para o Filtro Funcionar
    // O painel de admin precisa do empreendimentoId ("habiticon-ipora")
    // para mostrar o lead na tela certa.
    // ─────────────────────────────────────────────────────────────────
    let slug = empreendimento;
    if (slug) {
      slug = slug.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
    }

    // Estrutura do documento que será salvo na coleção "leads"
    const novoLead = {
      nome, 
      whatsapp,
      nomeCorretor: nomeCorretor || "",
      empreendimentoNome: empreendimento || "Nova Iporá II", // Guarda o nome legível
      empreendimentoId: slug,                                // Guarda o Slug (fundamental para o Admin)
      modelo: modelo || "",
      valorImovel: valorImovel || 0,
      timestamp: timestamp || new Date().toISOString(),
      status: "novo",
    };

    // Salva no Firestore
    const docRef = await addDoc(collection(db, "leads"), novoLead);

    // Nota: O emitirAtualizacao() foi removido pois o onSnapshot no frontend 
    // já cuida da atualização em tempo real automaticamente.

    return NextResponse.json({ success: true, lead: { id: docRef.id, ...novoLead } });
  } catch (error) {
    console.error("Erro ao salvar lead no Firebase:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// PATCH /api/leads — Atualiza status de um lead no Firebase
// Body: { leadId, status }
// ─────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const { leadId, status } = await req.json();
    
    if (!leadId || !status) {
      return NextResponse.json({ error: "leadId e status são obrigatórios" }, { status: 400 });
    }

    // Aponta para o documento exato no banco de dados
    const leadDocRef = doc(db, "leads", leadId);
    await updateDoc(leadDocRef, { status: status });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar lead:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// DELETE /api/leads — Remove um lead do Firebase
// Body: { leadId }
// ─────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { leadId } = await req.json();
    
    if (!leadId) {
      return NextResponse.json({ error: "leadId é obrigatório" }, { status: 400 });
    }

    const leadDocRef = doc(db, "leads", leadId);
    await deleteDoc(leadDocRef);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar lead:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}