import { NextRequest, NextResponse } from "next/server";

// Mapa de clientes conectados: id → controller
const clientes = new Map<string, ReadableStreamDefaultController>();

// Emite um evento para todos os clientes conectados
export function emitirAtualizacao(tipo = "leads") {
  const msg = `event: ${tipo}\ndata: ${Date.now()}\n\n`;
  clientes.forEach((ctrl) => {
    try { ctrl.enqueue(new TextEncoder().encode(msg)); } catch { /* cliente desconectou */ }
  });
}

// GET /api/sse — abre stream SSE
export async function GET(req: NextRequest) {
  const id = crypto.randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      clientes.set(id, controller);

      // Ping a cada 25s para manter a conexão viva (proxies fecham conexões ociosas)
      const ping = setInterval(() => {
        try { controller.enqueue(new TextEncoder().encode(": ping\n\n")); }
        catch { clearInterval(ping); }
      }, 25000);

      // Cleanup ao fechar
      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        clientes.delete(id);
        try { controller.close(); } catch { /* já fechado */ }
      });

      // Confirmação inicial
      controller.enqueue(new TextEncoder().encode("event: connected\ndata: ok\n\n"));
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no", // necessário para Nginx
    },
  });
}