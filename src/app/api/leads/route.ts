import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "src/data/empreendimentos.json");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nome, whatsapp, empreendimento, modelo, valorImovel, timestamp } = body;

    if (!nome || !whatsapp) {
      return NextResponse.json({ error: "Nome e WhatsApp são obrigatórios" }, { status: 400 });
    }

    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const empreendimentos = JSON.parse(raw);

    const empIndex = empreendimentos.findIndex((e: any) =>
      e.nome === empreendimento || e.slug === empreendimento?.toLowerCase().replace(/\s+/g, "-")
    );

    const lead = { id: Date.now().toString(), nome, whatsapp, modelo, valorImovel, timestamp };

    if (empIndex >= 0) {
      if (!empreendimentos[empIndex].leads) {
        empreendimentos[empIndex].leads = [];
      }
      empreendimentos[empIndex].leads.push(lead);
      await fs.writeFile(DATA_FILE, JSON.stringify(empreendimentos, null, 2));
    }

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error("Erro ao salvar lead:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const empreendimentos = JSON.parse(raw);
    const leads = empreendimentos.flatMap((e: any) =>
      (e.leads || []).map((l: any) => ({ ...l, empreendimento: e.nome }))
    );
    return NextResponse.json({ leads });
  } catch (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
