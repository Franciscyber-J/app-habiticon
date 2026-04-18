import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// UPLOAD_DIR: diretório persistente FORA da pasta do projeto
// Na Hostinger configure: UPLOAD_PATH = /home/u123456789/uploads
// Sobrevive a novos deploys via Git pois fica fora do repositório
const UPLOAD_DIR = process.env.UPLOAD_PATH
  ? path.resolve(process.env.UPLOAD_PATH)
  : path.join(process.cwd(), "public", "uploads");

// Se UPLOAD_PATH definido → serve via /api/images/ (API route)
// Caso contrário → serve do /public/uploads como antes (dev local)
const URL_BASE = process.env.UPLOAD_PATH ? "/api/images" : "/uploads";

const DATA_FILE = path.join(process.cwd(), "src/data/empreendimentos.json");

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

    const dir = path.join(UPLOAD_DIR, slug);
    await fs.mkdir(dir, { recursive: true });

    const bytes    = await file.arrayBuffer();
    const buffer   = Buffer.from(bytes);
    const filename = `${tipo}-${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const filepath = path.join(dir, filename);
    await fs.writeFile(filepath, buffer);

    const url = `${URL_BASE}/${slug}/${filename}`;

    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const empreendimentos = JSON.parse(raw);
    const idx = empreendimentos.findIndex((e: any) => e.slug === slug);

    if (idx >= 0) {
      if (tipo === "imagens" || tipo === "plantas") {
        if (!empreendimentos[idx].vitrine[tipo]) empreendimentos[idx].vitrine[tipo] = [];
        empreendimentos[idx].vitrine[tipo].push({ url, titulo });
      } else if (tipo.startsWith("ambiente_")) {
        const ambId = tipo.replace("ambiente_", "");
        if (!empreendimentos[idx].vitrine.ambientes) empreendimentos[idx].vitrine.ambientes = {};
        if (!empreendimentos[idx].vitrine.ambientes[ambId])
          empreendimentos[idx].vitrine.ambientes[ambId] = { ativo: true, fotos: [] };
        empreendimentos[idx].vitrine.ambientes[ambId].fotos.push({ url, titulo });
      }
      await fs.writeFile(DATA_FILE, JSON.stringify(empreendimentos, null, 2));
    }

    return NextResponse.json({ success: true, url, titulo });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Erro no upload" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { slug, url, tipo } = await req.json();

    // Calcular caminho real do arquivo
    const relativePath = url.startsWith("/api/images")
      ? url.replace("/api/images", "")
      : url.replace("/uploads", "");
    await fs.unlink(path.join(UPLOAD_DIR, relativePath)).catch(() => {});

    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const empreendimentos = JSON.parse(raw);
    const idx = empreendimentos.findIndex((e: any) => e.slug === slug);

    if (idx >= 0) {
      if (tipo === "imagens" || tipo === "plantas") {
        empreendimentos[idx].vitrine[tipo] = (empreendimentos[idx].vitrine[tipo] || [])
          .filter((img: any) => img.url !== url);
      } else if (tipo.startsWith("ambiente_")) {
        const ambId = tipo.replace("ambiente_", "");
        if (empreendimentos[idx].vitrine?.ambientes?.[ambId]) {
          empreendimentos[idx].vitrine.ambientes[ambId].fotos =
            empreendimentos[idx].vitrine.ambientes[ambId].fotos.filter((f: any) => f.url !== url);
        }
      }
      await fs.writeFile(DATA_FILE, JSON.stringify(empreendimentos, null, 2));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 });
  }
}