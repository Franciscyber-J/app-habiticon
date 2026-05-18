import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("empreendimentos")
      .where("status", "==", "ativo")
      .get();

    const empreendimentos = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ empreendimentos });
  } catch (error) {
    console.error("Erro ao buscar catálogo:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}