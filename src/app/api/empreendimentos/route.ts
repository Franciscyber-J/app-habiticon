import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { promises as fs } from "fs";
import path from "path";

// Evita o cache agressivo do Next.js para garantir dados sempre frescos
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────
// GET /api/empreendimentos — Busca do Firebase + Auto-Migração
// ─────────────────────────────────────────────────────────
export async function GET() {
  try {
    const empRef = collection(db, "empreendimentos");
    const snapshot = await getDocs(empRef);
    
    let empreendimentos = snapshot.docs.map(doc => doc.data());
    
    // Se o banco do Firebase estiver vazio, ele lê o seu arquivo JSON original
    // e planta tudo perfeitamente dentro do Firebase de forma automática.
    if (empreendimentos.length === 0) {
       console.log("Banco vazio! Migrando dados do JSON para o Firebase...");
       
       const DATA_FILE = path.join(process.cwd(), "src/data/empreendimentos.json");
       const raw = await fs.readFile(DATA_FILE, "utf-8");
       const jsonOriginal = JSON.parse(raw);

       for (const emp of jsonOriginal) {
         if (emp.slug) {
           await setDoc(doc(db, "empreendimentos", emp.slug), emp);
         }
       }
       
       empreendimentos = jsonOriginal;
       console.log("Migração para o Firebase concluída com sucesso!");
    }

    return NextResponse.json(empreendimentos);
  } catch (error) {
    console.error("Erro ao buscar empreendimentos no Firebase:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// PUT /api/empreendimentos — Salva lista inteira
// ─────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Esperado array" }, { status: 400 });
    }

    for (const emp of body) {
      if (emp.slug) {
        await setDoc(doc(db, "empreendimentos", emp.slug), emp);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao fazer PUT no Firebase:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// PATCH /api/empreendimentos — Atualização cirúrgica
// ─────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const { slug, field, value } = await req.json();
    
    if (!slug || !field) {
      return NextResponse.json({ error: "Slug e Field são obrigatórios" }, { status: 400 });
    }

    const docRef = doc(db, "empreendimentos", slug);
    
    // Suporte nativo do Firebase para dot notation (ex: vitrine.ambientes.sala)
    await updateDoc(docRef, {
      [field]: value
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao fazer PATCH no Firebase:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}