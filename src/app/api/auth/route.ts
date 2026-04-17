import { NextRequest, NextResponse } from "next/server";

// Credenciais hardcoded — não precisam de banco de dados
const SENHA_CORRETA = "Operacional123*";
const COOKIE        = "habiticon_admin_auth";
const TOKEN         = "hbt_adm_2026_ipora";

// POST /api/auth — faz login, seta cookie
export async function POST(req: NextRequest) {
  try {
    const { senha } = await req.json();
    if (senha !== SENHA_CORRETA) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    }
    const res = NextResponse.json({ success: true });
    res.cookies.set(COOKIE, TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/auth — logout, limpa cookie
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}