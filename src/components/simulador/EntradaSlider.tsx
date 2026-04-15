"use client";

import { useEffect, useRef } from "react";
import { formatBRL } from "@/lib/calculos";

interface EntradaSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  step?: number;
}

export function EntradaSlider({ value, min, max, onChange, step = 1000 }: EntradaSliderProps) {
  const sliderRef = useRef<HTMLInputElement>(null);

  // Atualiza o CSS custom property para o gradiente do slider
  useEffect(() => {
    if (sliderRef.current) {
      const pct = ((value - min) / (max - min)) * 100;
      sliderRef.current.style.setProperty("--slider-pct", `${pct}%`);
    }
  }, [value, min, max]);

  const marks = [min, min + (max - min) * 0.25, min + (max - min) * 0.5, min + (max - min) * 0.75, max];

  return (
    <div className="space-y-8">
      {/* Valor atual */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--gray-mid)" }}>
          Entrada Total
        </span>
        <div
          className="px-4 py-2 rounded-xl font-bold text-lg"
          style={{
            background: "var(--terracota-glow)",
            color: "var(--terracota-light)",
            border: "1px solid var(--border-active)",
            minWidth: "160px",
            textAlign: "center",
          }}
        >
          {formatBRL(value)}
        </div>
      </div>

      {/* Slider */}
      <div className="relative pt-1">
        <input
          ref={sliderRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider-custom w-full"
        />
      </div>

      {/* Marcadores */}
      <div className="flex justify-between">
        {marks.map((mark, i) => (
          <button
            key={i}
            onClick={() => onChange(mark)}
            className="text-xs transition-all"
            style={{
              color: mark === value ? "var(--terracota)" : "var(--gray-dark)",
              fontWeight: mark === value ? "600" : "400",
            }}
          >
            {mark >= 1000 ? `R$ ${(mark / 1000).toFixed(0)}k` : formatBRL(mark)}
          </button>
        ))}
      </div>
    </div>
  );
}
