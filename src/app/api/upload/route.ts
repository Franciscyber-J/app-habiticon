import { NextRequest, NextResponse } from "next/server";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ─────────────────────────────────────────────────────────
// POST /api/upload — Faz upload para o Storage e atualiza Firestore
// ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file   = formData.get("file")   as File;
    const slug   = formData.get("slug")   as string;
    const tipo   = formData.get("tipo")   as string;
    const titulo = (formData.get("titulo") as string) || file?.name || "";

    if (!file || !slug) {
      return NextResponse.json({ error: "Arquivo e slug são obrigatórios" }, { status: 400 });
    }

    // Transforma o arquivo num buffer para o Firebase
    const buffer = Buffer.from(await file.arrayBuffer());

    // Gera nome único sem precisar de bibliotecas externas (Math.random)
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const randomHash = Math.random().toString(36).substring(2, 10);
    const uniqueFilename = `${tipo}-${Date.now()}-${randomHash}-${cleanName}`;
    
    // Caminho da pasta dentro do Storage
    const storagePath = `${slug}/${tipo}/${uniqueFilename}`;
    const storageRef = ref(storage, storagePath);

    // Faz o Upload
    await uploadBytesResumable(storageRef, buffer, { contentType: file.type });

    // Pega a URL pública permanente
    const url = await getDownloadURL(storageRef);

    // ====================================================================
    // Lógica Original: Atualizar o Banco de Dados (agora Firestore)
    // ====================================================================
    const empRef = doc(db, "empreendimentos", slug);
    const empSnap = await getDoc(empRef);

    if (empSnap.exists()) {
      const empData = empSnap.data();

      if (tipo === "imagens" || tipo === "plantas") {
        if (!empData.vitrine) empData.vitrine = {};
        if (!empData.vitrine[tipo]) empData.vitrine[tipo] = [];
        empData.vitrine[tipo].push({ url, titulo });
      } else if (tipo.startsWith("ambiente_")) {
        const ambId = tipo.replace("ambiente_", "");
        if (!empData.vitrine) empData.vitrine = {};
        if (!empData.vitrine.ambientes) empData.vitrine.ambientes = {};
        if (!empData.vitrine.ambientes[ambId]) {
          empData.vitrine.ambientes[ambId] = { ativo: true, fotos: [] };
        }
        empData.vitrine.ambientes[ambId].fotos.push({ url, titulo });
      }

      await setDoc(empRef, empData);
    }

    return NextResponse.json({ success: true, url, titulo });
  } catch (error) {
    console.error("Erro no upload:", error);
    return NextResponse.json({ error: "Erro interno ao processar upload." }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// DELETE /api/upload — Remove do Storage e limpa no Firestore
// ─────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { slug, url, tipo } = await req.json();

    if (!url || !slug) {
      return NextResponse.json({ error: "URL e slug são obrigatórios." }, { status: 400 });
    }

    // 1. Deleta do Firebase Storage
    try {
      const fileRef = ref(storage, url);
      await deleteObject(fileRef);
    } catch (storageErr) {
      console.warn("Aviso: Falha ao deletar arquivo físico no storage, prosseguindo com limpeza no banco.", storageErr);
    }

    // 2. Remove do Banco de Dados (Firestore)
    const empRef = doc(db, "empreendimentos", slug);
    const empSnap = await getDoc(empRef);

    if (empSnap.exists()) {
      const empData = empSnap.data();

      if (tipo === "imagens" || tipo === "plantas") {
        if (empData.vitrine && empData.vitrine[tipo]) {
          empData.vitrine[tipo] = empData.vitrine[tipo].filter((img: any) => img.url !== url);
        }
      } else if (tipo.startsWith("ambiente_")) {
        const ambId = tipo.replace("ambiente_", "");
        if (empData.vitrine?.ambientes?.[ambId]) {
          empData.vitrine.ambientes[ambId].fotos = empData.vitrine.ambientes[ambId].fotos.filter((f: any) => f.url !== url);
        }
      }

      await setDoc(empRef, empData);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar:", error);
    return NextResponse.json({ error: "Erro ao deletar imagem." }, { status: 500 });
  }
}