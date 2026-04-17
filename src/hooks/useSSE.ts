"use client";

import { useEffect } from "react";

/**
 * Hook que conecta a /api/sse e chama onUpdate() quando chegar
 * um evento do tipo `eventName`.
 *
 * A conexão é aberta uma vez e fechada automaticamente ao desmontar.
 * Não há polling — só reage a eventos do servidor.
 */
export function useSSE(eventName: string, onUpdate: () => void) {
  useEffect(() => {
    const es = new EventSource("/api/sse");

    es.addEventListener(eventName, () => {
      onUpdate();
    });

    es.onerror = () => {
      // Reconecta automaticamente — o browser faz isso por padrão com SSE
    };

    return () => es.close();
  }, [eventName, onUpdate]);
}