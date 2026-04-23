"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";

// ─────────────────────────────────────────────────────────
// TIPAGENS
// ─────────────────────────────────────────────────────────
interface LoteMin {
  id: string;
  quadraId: string;
  numero: string;
  svgPathId: string;
  status: "disponivel" | "vinculado" | "vendido" | "bloqueado";
  valor: number;
  area: number;
}

interface MapaInterativoProps {
  mapaUrl: string;
  lotes: LoteMin[];
  onLoteClick: (lote: LoteMin) => void;
}

// ─────────────────────────────────────────────────────────
// CORES DE STATUS
// ─────────────────────────────────────────────────────────
const CORES = {
  disponivel: "#4ade80", // Verde
  vinculado: "#fb923c",  // Laranja/Amarelo
  vendido: "#ef4444",    // Vermelho
  bloqueado: "#6b7280",  // Cinzento
  hoverOutline: "#ffffff"
};

export function MapaInterativo({ mapaUrl, lotes, onLoteClick }: MapaInterativoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [escala, setEscala] = useState(1);

  // 1. FAZ O DOWNLOAD DO FICHEIRO SVG
  useEffect(() => {
    // Se não houver URL ou se não for um link válido, não tenta o fetch
    if (!mapaUrl || !mapaUrl.startsWith("http")) {
      console.warn("URL do mapa inválida ou ausente.");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    fetch(mapaUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const cleanSvg = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
        setSvgContent(cleanSvg);
        setErro(false);
      })
      .catch((err) => {
        console.error("Erro no fetch do mapa:", err);
        setErro(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [mapaUrl]);

  // 2. APLICA AS CORES E OS CLIQUES DIRETAMENTE NO DOM DO SVG
  useEffect(() => {
    if (!svgContent || !containerRef.current) return;

    const svgElement = containerRef.current.querySelector("svg");
    if (!svgElement) return;

    // Configura o SVG para ser responsivo e ocupar 100% do container
    svgElement.style.width = "100%";
    svgElement.style.height = "100%";
    svgElement.style.transition = "transform 0.3s ease";
    svgElement.style.transform = `scale(${escala})`;
    svgElement.style.transformOrigin = "center center";

    // Mapeamento interativo
    lotes.forEach((lote) => {
      if (!lote.svgPathId) return;

      // Procura o elemento no SVG pelo ID (ex: id="lote_q1_l1")
      const pathElement = svgElement.querySelector(`#${lote.svgPathId}`) as SVGPathElement | SVGPolygonElement;

      if (pathElement) {
        // Aplica a cor base e força opacidade total para ignorar o 0.01 do Figma
        pathElement.style.fill = CORES[lote.status];
        pathElement.style.fillOpacity = "1";
        pathElement.setAttribute("fill-opacity", "1");
        
        pathElement.style.stroke = "rgba(0,0,0,0.5)";
        pathElement.style.strokeWidth = "1px";
        pathElement.style.transition = "all 0.2s ease";
        
        // Se não estiver bloqueado, põe cursor de clique
        if (lote.status !== "bloqueado") {
          pathElement.style.cursor = "pointer";

          // Efeitos de Hover interativos
          pathElement.onmouseenter = () => {
            pathElement.style.stroke = CORES.hoverOutline;
            pathElement.style.strokeWidth = "3px";
            pathElement.style.filter = "brightness(1.2)";
            pathElement.style.fillOpacity = "0.9";
          };
          pathElement.onmouseleave = () => {
            pathElement.style.stroke = "rgba(0,0,0,0.5)";
            pathElement.style.strokeWidth = "1px";
            pathElement.style.filter = "none";
            pathElement.style.fillOpacity = "1";
          };

          // Ação de Clique que devolve o Lote selecionado para o sistema
          pathElement.onclick = () => onLoteClick(lote);
        } else {
           // Lote Bloqueado: remove eventos e cursor
           pathElement.style.cursor = "not-allowed";
           pathElement.onmouseenter = null;
           pathElement.onmouseleave = null;
           pathElement.onclick = null;
           pathElement.style.fillOpacity = "0.5";
        }
      }
    });

  }, [svgContent, lotes, onLoteClick, escala]);

  // Controlos de Zoom
  const zoomIn = () => setEscala(prev => Math.min(prev + 0.3, 3));
  const zoomOut = () => setEscala(prev => Math.max(prev - 0.3, 0.5));
  const resetZoom = () => setEscala(1);

  if (loading) {
    return (
      <div style={{ width: "100%", height: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
        <p style={{ color: "var(--gray-mid)", fontWeight: 600, animation: "pulse 2s infinite" }}>A carregar mapa interativo...</p>
      </div>
    );
  }

  if (erro || !svgContent) {
    return (
      <div style={{ width: "100%", height: 300, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.1)", borderRadius: 16, border: "1px dashed rgba(239,68,68,0.3)" }}>
        <p style={{ color: "#f87171", fontWeight: 600 }}>Não foi possível carregar o mapa. Verifique a URL do arquivo SVG.</p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 400, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
      
      {/* Controles de Zoom Flutuantes */}
      <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 10, display: "flex", flexDirection: "column", gap: 8, background: "rgba(15,30,22,0.8)", backdropFilter: "blur(10px)", padding: 8, borderRadius: 12, border: "1px solid var(--border-active)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
        <button onClick={zoomIn} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ZoomIn size={18} />
        </button>
        <button onClick={resetZoom} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Maximize2 size={16} />
        </button>
        <button onClick={zoomOut} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ZoomOut size={18} />
        </button>
      </div>

      {/* Legenda do Mapa */}
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10, display: "flex", gap: 12, background: "rgba(15,30,22,0.8)", backdropFilter: "blur(10px)", padding: "8px 12px", borderRadius: 12, border: "1px solid var(--border-active)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: CORES.disponivel }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "white" }}>Livre</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: CORES.vinculado }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "white" }}>Fila</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: CORES.vendido }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "white" }}>Vendido</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: CORES.bloqueado }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "white" }}>Bloq.</span>
        </div>
      </div>

      {/* Container de Injeção do SVG */}
      <div 
        ref={containerRef}
        style={{ width: "100%", height: "100%", overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab" }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />

      {/* CSS Embutido para interatividade do SVG */}
      <style dangerouslySetInnerHTML={{__html: `
        /* Impede que o texto/número dos lotes bloqueie o clique do rato */
        svg text, svg tspan {
          pointer-events: none;
          user-select: none;
        }
        /* Garante que a linha do lote não engrosse horrivelmente ao dar zoom */
        svg rect, svg path, svg polygon {
          vector-effect: non-scaling-stroke;
        }
      `}} />
    </div>
  );
}