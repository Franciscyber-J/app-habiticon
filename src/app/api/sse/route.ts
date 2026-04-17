import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────
// Usa globalThis para garantir que o mapa de clientes seja
// compartilhado entre TODAS as instâncias de módulo do Next.js.
// Sem isso, /api/leads e /api/sse podem ter Maps separados
// e o emitirAtualizacao não alcança os clientes conectados.
// ─────────────────────────────────────────────────────────
const g = globalThis as any;
if (!g._sseClientes) g._sseClientes = new Map<string, ReadableStreamDefaultController>();
const clientes: Map<string, ReadableStreamDefaultController> = g._sseClientes;

// Exportada e importada por outros routes (ex: /api/leads)
export function emitirAtualizacao(tipo = "leads") {
  const msg = `event: ${tipo}\ndata: ${Date.now()}\n\n`;
  const encoder = new TextEncoder();
  clientes.forEach((ctrl, id) => {
    try {
      ctrl.enqueue(encoder.encode(msg));
    } catch {
      // Cliente desconectou — remove do mapa
      clientes.delete(id);
    }
  });
}

// GET /api/sse — abre stream SSE
export async function GET(req: NextRequest) {
  const id = crypto.randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      clientes.set(id, controller);

      // Ping a cada 25s para manter vivo (proxies fecham conexões ociosas)
      const ping = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          clearInterval(ping);
        }
      }, 25000);

      // Cleanup ao fechar
      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        clientes.delete(id);
        try { controller.close(); } catch { /* já fechado */ }
      });

      // Confirmação inicial
      controller.enqueue(
        new TextEncoder().encode("event: connected\ndata: ok\n\n")
      );
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}