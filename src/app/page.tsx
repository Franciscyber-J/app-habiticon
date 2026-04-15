import Link from "next/link";
import Image from "next/image";
import empreendimentos from "@/data/empreendimentos.json";
import { MapPin, ArrowRight, ChevronRight, Building2 } from "lucide-react";

export default function HomePage() {
  const ativos = empreendimentos.filter((e) => e.status === "ativo");
  const emBreve = empreendimentos.filter((e) => e.status === "em_breve");

  return (
    <main className="min-h-screen gradient-hero">
      {/* Header */}
      <header className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="container-app">
          <div className="flex items-center justify-between py-4">
            <Image src="/logo.png" alt="Habiticon" width={160} height={48} className="h-10 w-auto" />
            <Link href="/admin" className="btn-ghost text-sm">
              Admin
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container-app section-padding">
        <div className="max-w-2xl mb-16">
          <div className="badge badge-info mb-6">
            Motor de Vendas · Versão 2026
          </div>
          <h1 className="text-display mb-6">
            Apresente e simule{" "}
            <span className="text-accent">com transparência</span>
          </h1>
          <p className="text-body text-lg">
            Selecione o empreendimento e tenha acesso ao simulador completo,
            motor de subsídio MCMV, evolução de obra e gerador de propostas em PDF.
          </p>
        </div>

        {/* Empreendimentos Ativos */}
        <div className="mb-12">
          <h2 className="text-title mb-2">Empreendimentos disponíveis</h2>
          <p className="text-muted mb-8">Clique para acessar o simulador completo</p>

          <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
            {ativos.map((emp) => (
              <Link key={emp.slug} href={`/${emp.slug}`} className="glass-card p-6 block group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex-center"
                      style={{ background: "var(--terracota-glow)", border: "1px solid var(--border-active)" }}
                    >
                      <Building2 size={22} color="var(--terracota)" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base" style={{ color: "var(--gray-light)" }}>
                        {emp.nome}
                      </h3>
                      <div className="flex items-center gap-1 mt-0.5" style={{ color: "var(--gray-mid)" }}>
                        <MapPin size={12} />
                        <span className="text-xs">{emp.cidade} · {emp.estado}</span>
                      </div>
                    </div>
                  </div>
                  <div className="badge badge-success">Ativo</div>
                </div>

                <p className="text-body text-sm mb-5">{emp.descricao}</p>

                <div className="flex gap-3 mb-5">
                  {emp.modelos.map((m) => (
                    <div
                      key={m.id}
                      className="flex-1 rounded-xl p-3 text-center"
                      style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-subtle)" }}
                    >
                      <div className="font-bold text-sm" style={{ color: "var(--terracota)" }}>{m.nome}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--gray-mid)" }}>{m.area}m²</div>
                      <div className="font-semibold text-sm mt-1" style={{ color: "var(--gray-light)" }}>
                        R$ {(m.valor / 1000).toFixed(0)}k
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  className="flex items-center justify-between pt-4"
                  style={{ borderTop: "1px solid var(--border-subtle)" }}
                >
                  <span className="text-sm font-medium" style={{ color: "var(--terracota)" }}>
                    Abrir simulador
                  </span>
                  <ArrowRight
                    size={16}
                    color="var(--terracota)"
                    className="transition-transform group-hover:translate-x-1"
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Em Breve */}
        {emBreve.length > 0 && (
          <div>
            <div className="section-divider" />
            <h2 className="text-title mb-2">Em breve</h2>
            <p className="text-muted mb-8">Novos empreendimentos chegando</p>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {emBreve.map((emp) => (
                <div
                  key={emp.slug}
                  className="glass-card-nohover p-5 opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex-center"
                      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)" }}
                    >
                      <Building2 size={18} color="var(--gray-mid)" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm" style={{ color: "var(--gray-light)" }}>
                        {emp.nome}
                      </h3>
                      <div className="flex items-center gap-1" style={{ color: "var(--gray-mid)" }}>
                        <MapPin size={11} />
                        <span className="text-xs">{emp.cidade} · {emp.estado}</span>
                      </div>
                    </div>
                  </div>
                  <div className="badge badge-warning mt-4">Em breve</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer
        className="text-center py-8 text-muted"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <p>© 2026 Habiticon Construção Inteligente · Todos os direitos reservados</p>
      </footer>
    </main>
  );
}
