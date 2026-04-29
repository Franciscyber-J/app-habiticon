import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────
// GET /api/empreendimentos — Busca todos do Firebase
// ─────────────────────────────────────────────────────────
export async function GET() {
  try {
    const snapshot = await adminDb.collection("empreendimentos").get();
    const empreendimentos = snapshot.docs.map(doc => doc.data());
    return NextResponse.json(empreendimentos);
  } catch (error) {
    console.error("Erro ao buscar empreendimentos:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// PUT /api/empreendimentos — Salva lista inteira via batch
// ─────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Esperado array" }, { status: 400 });
    }

    const batch = adminDb.batch();

    for (const emp of body) {
      if (emp.slug) {
        // Remove undefined values que o Firebase não aceita
        const empLimpo = JSON.parse(JSON.stringify(emp));
        const ref = adminDb.collection("empreendimentos").doc(emp.slug);
        batch.set(ref, empLimpo);
      }
    }

    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao fazer PUT:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// PATCH /api/empreendimentos — Atualização cirúrgica de campo
// ─────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const { slug, field, value } = await req.json();

    if (!slug || !field) {
      return NextResponse.json({ error: "Slug e Field são obrigatórios" }, { status: 400 });
    }

    // Remove undefined values
    const valueLimpo = JSON.parse(JSON.stringify({ v: value })).v;

    await adminDb.collection("empreendimentos").doc(slug).update({
      [field]: valueLimpo
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao fazer PATCH:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}