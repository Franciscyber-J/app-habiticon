import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "src/data/empreendimentos.json");

export async function GET() {
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return NextResponse.json(JSON.parse(raw));
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    // Valida que é um array
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Esperado array" }, { status: 400 });
    }
    await fs.writeFile(DATA_FILE, JSON.stringify(body, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { slug, field, value } = await req.json();
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const empreendimentos = JSON.parse(raw);
    const idx = empreendimentos.findIndex((e: any) => e.slug === slug);
    if (idx < 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    // Suporta campos aninhados com dot notation: "simulador.prazoMeses"
    const keys = field.split(".");
    let obj = empreendimentos[idx];
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;

    await fs.writeFile(DATA_FILE, JSON.stringify(empreendimentos, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
