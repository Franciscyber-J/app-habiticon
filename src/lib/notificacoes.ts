import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type TipoAlerta = "novoLead" | "vendaDireta" | "documentoAnexado";

export async function notificarTelegram(tipo: TipoAlerta, mensagem: string) {
  try {
    // 1. Verifica no banco se a notificação está ativada
    const configSnap = await getDoc(doc(db, "configuracoes", "alertas"));
    
    // O padrão será enviar (true). Só não envia se você explicitamente desligar (false).
    if (configSnap.exists()) {
      const config = configSnap.data();
      if (config[tipo] === false) return; 
    }

    // 2. Dispara a mensagem para a nossa API segura
    await fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem }),
    });
  } catch (error) {
    console.error("Erro ao enviar notificação para o Telegram:", error);
  }
}