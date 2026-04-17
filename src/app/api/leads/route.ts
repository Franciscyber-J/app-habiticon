import { NextRequest, NextResponse } from "next/server";
import { emitirAtualizacao } from "@/app/api/sse/route";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "src/data/empreendimentos.json");

// ─────────────────────────────────────────────────────────
// GET /api/leads
// ─────────────────────────────────────────────────────────
export async function GET() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const empreendimentos = JSON.parse(raw);
    const leads = empreendimentos.flatMap((e: any) =>
      (e.leads || []).map((l: any) => ({ ...l, empreendimento: e.nome }))
    );
    return NextResponse.json({ leads });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// POST /api/leads — salva novo lead
// ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nome, whatsapp, nomeCorretor, empreendimento, modelo, valorImovel, timestamp } = body;

    if (!nome || !whatsapp) {
      return NextResponse.json({ error: "Nome e WhatsApp são obrigatórios" }, { status: 400 });
    }

    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const empreendimentos = JSON.parse(raw);
    const empIndex = empreendimentos.findIndex((e: any) =>
      e.nome === empreendimento || e.slug === empreendimento?.toLowerCase().replace(/\s+/g, "-")
    );

    const lead = {
      id: Date.now().toString(),
      nome, whatsapp,
      nomeCorretor: nomeCorretor || "",
      modelo, valorImovel, timestamp,
      status: "novo",
    };

    if (empIndex >= 0) {
      if (!empreendimentos[empIndex].leads) empreendimentos[empIndex].leads = [];
      empreendimentos[empIndex].leads.push(lead);
      await fs.writeFile(DATA_FILE, JSON.stringify(empreendimentos, null, 2));
      emitirAtualizacao("leads");
    }

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error("Erro ao salvar lead:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// PATCH /api/leads — atualiza status de um lead
// Body: { slugEmp, leadId, status }
// ─────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const { slugEmp, leadId, status } = await req.json();
    if (!slugEmp || !leadId) {
      return NextResponse.json({ error: "slugEmp e leadId são obrigatórios" }, { status: 400 });
    }
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const empreendimentos = JSON.parse(raw);
    const idx = empreendimentos.findIndex((e: any) => e.slug === slugEmp);
    if (idx < 0) return NextResponse.json({ error: "Empreendimento não encontrado" }, { status: 404 });
    const leadIdx = empreendimentos[idx].leads?.findIndex((l: any) => l.id === leadId);
    if (leadIdx < 0 || leadIdx === undefined) {
      return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }
    empreendimentos[idx].leads[leadIdx].status = status;
    await fs.writeFile(DATA_FILE, JSON.stringify(empreendimentos, null, 2));
    emitirAtualizacao("leads");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// DELETE /api/leads — remove um lead
// Body: { slugEmp, leadId }
// ─────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { slugEmp, leadId } = await req.json();
    if (!slugEmp || !leadId) {
      return NextResponse.json({ error: "slugEmp e leadId são obrigatórios" }, { status: 400 });
    }
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const empreendimentos = JSON.parse(raw);
    const idx = empreendimentos.findIndex((e: any) => e.slug === slugEmp);
    if (idx < 0) return NextResponse.json({ error: "Empreendimento não encontrado" }, { status: 404 });
    const antes = empreendimentos[idx].leads?.length || 0;
    empreendimentos[idx].leads = (empreendimentos[idx].leads || []).filter(
      (l: any) => l.id !== leadId
    );
    if (empreendimentos[idx].leads.length === antes) {
      return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }
    await fs.writeFile(DATA_FILE, JSON.stringify(empreendimentos, null, 2));
    emitirAtualizacao("leads");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}