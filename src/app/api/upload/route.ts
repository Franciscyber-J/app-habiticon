import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import crypto from "crypto";

// Força a leitura do bucket direto da variável de ambiente
const BUCKET_NAME = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

// ─────────────────────────────────────────────────────────
// POST /api/upload — Faz upload via Admin SDK (Bypass Rules)
// ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    if (!BUCKET_NAME) {
      console.error("ERRO CRÍTICO: Variável NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ausente no .env.local");
      return NextResponse.json({ error: "Configuração de Storage ausente no servidor." }, { status: 500 });
    }

    const formData = await req.formData();
    const file   = formData.get("file")   as File;
    const slug   = formData.get("slug")   as string;
    const tipo   = formData.get("tipo")   as string;
    const titulo = (formData.get("titulo") as string) || file?.name || "";

    if (!file || !slug) {
      return NextResponse.json({ error: "Arquivo e slug são obrigatórios" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const randomHash = Math.random().toString(36).substring(2, 10);
    const uniqueFilename = `${tipo}-${Date.now()}-${randomHash}-${cleanName}`;
    
    const storagePath = `${slug}/${tipo}/${uniqueFilename}`;
    
    // 1. Instância do Bucket via Admin SDK EXPLICITAMENTE NOMEADA
    const bucket = adminStorage.bucket(BUCKET_NAME);
    const fileRef = bucket.file(storagePath);

    // 2. Gerar um Token de Download (Para a imagem gerar a URL pública padrão Firebase)
    const downloadToken = crypto.randomUUID();

    // 3. Fazer o Upload forçando as credenciais Admin
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    // 4. Montar a URL permanente idêntica ao Firebase Client
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;

    // ====================================================================
    // Atualizar o Banco de Dados (Firestore via Admin SDK)
    // ====================================================================
    const empRef = adminDb.collection("empreendimentos").doc(slug);
    const empSnap = await empRef.get();

    if (empSnap.exists) {
      const empData = empSnap.data() as any;

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

      // Salva usando merge para não apagar outros dados
      await empRef.set(empData, { merge: true });
    }

    return NextResponse.json({ success: true, url, titulo });
  } catch (error) {
    console.error("Erro no upload Admin:", error);
    return NextResponse.json({ error: "Erro interno ao processar upload." }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// DELETE /api/upload — Remove do Storage e limpa no Firestore
// ─────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    if (!BUCKET_NAME) {
      return NextResponse.json({ error: "Configuração de Storage ausente no servidor." }, { status: 500 });
    }

    const { slug, url, tipo } = await req.json();

    if (!url || !slug) {
      return NextResponse.json({ error: "URL e slug são obrigatórios." }, { status: 400 });
    }

    // Instância do Bucket EXPLICITAMENTE NOMEADA
    const bucket = adminStorage.bucket(BUCKET_NAME);

    // 1. Extrair o Caminho do Arquivo (FilePath) da URL gerada pelo Firebase
    try {
      const decodedUrl = decodeURIComponent(url);
      const oIndex = decodedUrl.indexOf('/o/');
      const altIndex = decodedUrl.indexOf('?alt=media');
      
      if (oIndex !== -1 && altIndex !== -1) {
        const filePath = decodedUrl.substring(oIndex + 3, altIndex);
        // Exclui usando o privilégio supremo do Admin
        await bucket.file(filePath).delete();
      }
    } catch (storageErr) {
      console.warn("Aviso: Falha ao deletar arquivo físico no storage, prosseguindo com limpeza no banco.", storageErr);
    }

    // 2. Remove do Banco de Dados (Firestore via Admin)
    const empRef = adminDb.collection("empreendimentos").doc(slug);
    const empSnap = await empRef.get();

    if (empSnap.exists) {
      const empData = empSnap.data() as any;

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

      await empRef.set(empData, { merge: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar:", error);
    return NextResponse.json({ error: "Erro ao deletar imagem." }, { status: 500 });
  }
}