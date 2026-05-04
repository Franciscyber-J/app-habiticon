import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type TipoAlerta = "novoLead" | "vendaDireta" | "documentoAnexado";

// ─────────────────────────────────────────────────────────
// Chama a API do Telegram diretamente, sem depender de
// fetch para a própria aplicação — funciona em qualquer
// contexto (client, server-side API routes, Edge, etc.)
// ─────────────────────────────────────────────────────────
async function enviarMensagemTelegram(mensagem: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN  ?? process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID    ?? process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn(
      "[notificacoes] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados. " +
      "Adicione essas variáveis de ambiente na Hostinger."
    );
    return;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: mensagem,
      parse_mode: "HTML",
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error("[notificacoes] Telegram recusou a mensagem:", data.description);
  }
}

// ─────────────────────────────────────────────────────────
// Verifica se o tipo de alerta está ativado no Firestore
// (somente quando chamado do client-side — no servidor a
// verificação é ignorada com segurança por falta de contexto
// de auth, e o envio ocorre normalmente)
// ─────────────────────────────────────────────────────────
export async function notificarTelegram(tipo: TipoAlerta, mensagem: string): Promise<void> {
  try {
    // Tenta verificar configuração no Firestore
    try {
      const configSnap = await getDoc(doc(db, "configuracoes", "alertas"));
      if (configSnap.exists()) {
        const config = configSnap.data();
        if (config[tipo] === false) return; // notificação desligada pelo admin
      }
    } catch {
      // Erro de permissão (server-side) ou Firestore indisponível:
      // assume que está ativada e prossegue normalmente.
    }

    await enviarMensagemTelegram(mensagem);

  } catch (error) {
    console.error("[notificacoes] Erro inesperado ao notificar Telegram:", error);
  }
}