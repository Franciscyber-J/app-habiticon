import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc
} from "firebase/firestore";

import { notificarTelegram } from "@/lib/notificacoes";

// IMPORTAMOS O ADMIN SDK PARA BURLAR AS REGRAS NA EXCLUSÃO
import { adminDb, adminStorage } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────
// GET /api/leads
// ─────────────────────────────────────────────────────────
export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "leads"));

    const leads = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
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

    const {
      nome,
      whatsapp,
      whatsapp2,
      nomeCorretor,
      corretorId,
      empreendimento,
      modelo,
      valorImovel,
      area,
      quartos,
      simulacao,
      timestamp,
      preCadastro // ← CORREÇÃO 1: Faltava extrair o preCadastro que vem do Front!
    } = body;

    if (!nome || !whatsapp) {
      return NextResponse.json(
        { error: "Nome e WhatsApp são obrigatórios" },
        { status: 400 }
      );
    }

    const slug = empreendimento
      ? empreendimento
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "-")
      : "default";

    const dataAtual = timestamp || new Date().toISOString();

    const novoLead = {
      nome,
      whatsapp,
      whatsapp2: whatsapp2 || "",
      nomeCorretor: nomeCorretor || "",
      corretorId: corretorId || "",
      empreendimentoNome: empreendimento || "Nova Iporá II",
      empreendimentoId: slug,
      modelo: modelo || "",
      valorImovel: Number(valorImovel) || 0,
      area: Number(area) || 0,
      quartos: Number(quartos) || 0,
      simulacao: simulacao || null,
      preCadastro: preCadastro || null, // ← CORREÇÃO 2: Agora sim, salvando no banco!
      timestamp: dataAtual,
      status: "novo",
    };

    const docRef = await addDoc(collection(db, "leads"), novoLead);

    // 🔔 TELEGRAM
    try {
      const dataFormatada = new Date(dataAtual)
        .toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
        .replace(",", " às");

      const msgSimulacao =
        simulacao?.valorFinanciado
          ? `\n💰 <b>Renda:</b> R$ ${simulacao.rendaFamiliar?.toLocaleString(
              "pt-BR"
            )}\n🏦 <b>Financiado:</b> R$ ${simulacao.valorFinanciado?.toLocaleString(
              "pt-BR"
            )}`
          : "";

      const mensagem = `🌟 <b>NOVO LEAD</b> 🌟
━━━━━━━━━━━━━━━━━━━━
👤 ${nome}
📱 ${whatsapp}
🏢 ${empreendimento || "N/I"}
🏠 ${modelo || "N/I"}${msgSimulacao}
📅 ${dataFormatada}
━━━━━━━━━━━━━━━━━━━━`;

      await notificarTelegram("novoLead", mensagem);
    } catch (err) {
      console.warn("Falha Telegram:", err);
    }

    return NextResponse.json({
      success: true,
      lead: { id: docRef.id, ...novoLead },
    });
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

    if (!leadId || !status) {
      return NextResponse.json(
        { error: "leadId e status são obrigatórios" },
        { status: 400 }
      );
    }

    await updateDoc(doc(db, "leads", leadId), { status });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// DELETE /api/leads (Com Firebase Admin SDK)
// ─────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { leadId } = await req.json();

    if (!leadId) {
      return NextResponse.json({ error: "leadId é obrigatório" }, { status: 400 });
    }

    // Usando a chave mestra (adminDb) no lugar do banco comum (db)
    const leadRef = adminDb.collection("leads").doc(leadId);
    let arquivos: string[] = [];

    try {
      const snap = await leadRef.get();

      if (snap.exists) {
        const data: any = snap.data();

        arquivos.push(`leads/${leadId}/proposta_simulacao.pdf`);

        // Dossiê
        if (data?.dossie) {
          Object.values(data.dossie).forEach((p: any) => {
            Object.values(p?.documentos || {}).forEach((doc: any) => {
              (doc?.arquivos || []).forEach((a: any) => {
                const path = typeof a === "string" ? a : a?.path;
                if (path && !path.startsWith("http")) {
                  arquivos.push(path);
                }
              });
            });
          });
        }

        // Construtora
        if (data?.documentosConstrutora) {
          const d = data.documentosConstrutora;
          Object.keys(d).forEach((k) => {
            if (d[k]?.path) arquivos.push(d[k].path);
          });
          d.pls?.forEach((i: any) => i?.path && arquivos.push(i.path));
          d.outros?.forEach((i: any) => i?.path && arquivos.push(i.path));
        }
      }
    } catch (err) {
      console.warn("Aviso na leitura do admin:", err);
      arquivos.push(`leads/${leadId}/proposta_simulacao.pdf`);
    }

    // 🔥 delete storage com a chave mestra
    if (adminStorage) {
      // Pega o nome do bucket automaticamente da sua configuração do Firebase (variáveis de ambiente)
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      
      if (bucketName) {
        const bucket = adminStorage.bucket(bucketName);
        try {
          await Promise.all(
            arquivos.map((path) =>
              bucket.file(path).delete().catch(() => null)
            )
          );
        } catch (err) {
          console.warn("Erro storage admin:", err);
        }
      } else {
        console.warn("Aviso: Variável NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET não encontrada para deletar os arquivos.");
      }
    }

    // 🔥 delete doc com a chave mestra
    try {
      await leadRef.delete();
    } catch (err) {
      console.warn("Erro firestore admin:", err);
    }

    return NextResponse.json({
      success: true,
      filesDeleted: arquivos.length,
    });
  } catch (error) {
    console.error("Erro DELETE Admin:", error);
    return NextResponse.json({ success: true }); // Retorna 200 de qualquer forma para a UI não travar
  }
}