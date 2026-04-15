import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public/uploads");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const slug = formData.get("slug") as string;
    const tipo = formData.get("tipo") as string; // "imagens" ou "plantas"

    if (!file || !slug) {
      return NextResponse.json({ error: "Arquivo e slug são obrigatórios" }, { status: 400 });
    }

    // Cria o diretório se não existir
    const dir = path.join(UPLOAD_DIR, slug);
    await fs.mkdir(dir, { recursive: true });

    // Salva o arquivo
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${tipo}-${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const filepath = path.join(dir, filename);
    await fs.writeFile(filepath, buffer);

    const url = `/uploads/${slug}/${filename}`;

    // Atualiza o JSON do empreendimento
    const DATA_FILE = path.join(process.cwd(), "src/data/empreendimentos.json");
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const empreendimentos = JSON.parse(raw);
    const idx = empreendimentos.findIndex((e: any) => e.slug === slug);

    if (idx >= 0) {
      const titulo = formData.get("titulo") as string || file.name;
      if (!empreendimentos[idx].vitrine[tipo]) {
        empreendimentos[idx].vitrine[tipo] = [];
      }
      empreendimentos[idx].vitrine[tipo].push({ url, titulo });
      await fs.writeFile(DATA_FILE, JSON.stringify(empreendimentos, null, 2));
    }

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Erro no upload" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { slug, url, tipo } = await req.json();

    // Remove o arquivo
    const filepath = path.join(process.cwd(), "public", url);
    await fs.unlink(filepath).catch(() => {});

    // Remove do JSON
    const DATA_FILE = path.join(process.cwd(), "src/data/empreendimentos.json");
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const empreendimentos = JSON.parse(raw);
    const idx = empreendimentos.findIndex((e: any) => e.slug === slug);

    if (idx >= 0 && empreendimentos[idx].vitrine[tipo]) {
      empreendimentos[idx].vitrine[tipo] = empreendimentos[idx].vitrine[tipo].filter(
        (img: any) => img.url !== url
      );
      await fs.writeFile(DATA_FILE, JSON.stringify(empreendimentos, null, 2));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 });
  }
}
