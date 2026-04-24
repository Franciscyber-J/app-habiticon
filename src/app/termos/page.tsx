import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function TermosPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--gray-light)" }}>
      <header style={{ padding: "16px", background: "rgba(15,30,22,0.98)", borderBottom: "1px solid var(--border-subtle)", position: "sticky", top: 0, zIndex: 10 }}>
        <div className="container-app" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" className="btn-ghost" style={{ padding: "8px" }}>
            <ArrowLeft size={20} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={20} color="var(--terracota)" />
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "white" }}>Privacidade e Termos</h1>
          </div>
        </div>
      </header>

      <main className="container-app" style={{ padding: "40px 20px", maxWidth: 800, margin: "0 auto", lineHeight: 1.7 }}>
        
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "white", marginBottom: 16 }}>1. Termos de Uso</h2>
          <p style={{ color: "var(--gray-mid)", marginBottom: 12 }}>
            Bem-vindo ao Motor de Vendas Habiticon. Ao utilizar a nossa plataforma de simulação e geração de propostas, você concorda com os termos aqui descritos.
          </p>
          <ul style={{ color: "var(--gray-mid)", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <li><strong>Finalidade:</strong> A plataforma fornece simulações de financiamento e evolução de obras com base nas regras do programa Minha Casa Minha Vida (MCMV).</li>
            <li><strong>Isenção de Garantia:</strong> Todas as simulações e Laudos CUB apresentados são <strong>estimativas matemáticas</strong> baseadas nas taxas vigentes. A aprovação final, os valores liberados e os subsídios dependem <strong>exclusivamente da análise de crédito da Caixa Econômica Federal</strong>.</li>
            <li><strong>Reserva de Lotes:</strong> A reserva de um lote através da plataforma representa uma intenção de compra e está sujeita à validação documental pelo nosso correspondente bancário. A Habiticon reserva-se o direito de cancelar a reserva caso haja reprovação de crédito.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "white", marginBottom: 16 }}>2. Política de Privacidade (LGPD)</h2>
          <p style={{ color: "var(--gray-mid)", marginBottom: 16 }}>
            A Habiticon Construção Inteligente compromete-se a proteger a sua privacidade. Esta política explica como os seus dados são tratados em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </p>

          <h3 style={{ fontSize: 16, fontWeight: 700, color: "white", marginTop: 24, marginBottom: 8 }}>O que coletamos?</h3>
          <p style={{ color: "var(--gray-mid)" }}>Coletamos o seu nome, WhatsApp, renda familiar estimada e, posteriormente (caso decida avançar com a compra), documentos pessoais necessários para a montagem do dossiê habitacional.</p>

          <h3 style={{ fontSize: 16, fontWeight: 700, color: "white", marginTop: 24, marginBottom: 8 }}>Como usamos os seus dados?</h3>
          <p style={{ color: "var(--gray-mid)", marginBottom: 8 }}>Os seus dados são utilizados estritamente para:</p>
          <ul style={{ color: "var(--gray-mid)", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>Gerar a sua proposta personalizada em formato PDF.</li>
            <li>Permitir que um corretor parceiro exclusivo da Habiticon entre em contato via WhatsApp para dar seguimento ao seu atendimento.</li>
            <li>Realizar a avaliação e aprovação de crédito junto ao banco financiador.</li>
          </ul>

          <h3 style={{ fontSize: 16, fontWeight: 700, color: "white", marginTop: 24, marginBottom: 8 }}>Com quem compartilhamos?</h3>
          <p style={{ color: "var(--gray-mid)" }}>
            Os seus dados são partilhados apenas com <strong>Corretores Parceiros</strong> vinculados à Habiticon, <strong>Correspondentes Bancários</strong> credenciados e com a <strong>Caixa Econômica Federal</strong> (para fins de simulação e aprovação de crédito). Não vendemos nem partilhamos os seus dados com terceiros não envolvidos no processo de aquisição do seu imóvel.
          </p>

          <h3 style={{ fontSize: 16, fontWeight: 700, color: "white", marginTop: 24, marginBottom: 8 }}>Segurança</h3>
          <p style={{ color: "var(--gray-mid)" }}>
            Os seus dados e documentos são armazenados em servidores criptografados de alta segurança. Os documentos anexados no Dossiê ficam bloqueados e acessíveis apenas pela equipe técnica responsável pela sua aprovação.
          </p>

          <h3 style={{ fontSize: 16, fontWeight: 700, color: "white", marginTop: 24, marginBottom: 8 }}>Os seus direitos</h3>
          <p style={{ color: "var(--gray-mid)" }}>
            Você pode, a qualquer momento, solicitar a exclusão dos seus dados da nossa base de dados ou a revogação do atendimento, enviando-nos uma solicitação através dos nossos canais de atendimento.
          </p>

          {/* NOVO: CLAUSULA DE ARMAZENAMENTO E TRANSFERÊNCIA (FIREBASE E DPO) */}
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "white", marginTop: 24, marginBottom: 8 }}>Armazenamento e Transferência</h3>
          <p style={{ color: "var(--gray-mid)" }}>
            Os seus dados são processados através da infraestrutura de nuvem da Google (Firebase), que adota os mais altos padrões globais de segurança, podendo envolver a transferência internacional dos dados estritamente para fins de armazenamento. Para dúvidas ou solicitação de exclusão definitiva dos seus dados e dossiê habitacional, entre em contato através do e-mail: <strong style={{ color: "var(--gray-light)" }}>contato@habiticon.com.br</strong>.
          </p>
        </section>

        <p style={{ fontSize: 13, color: "var(--gray-dark)", textAlign: "center", marginTop: 60, borderTop: "1px solid var(--border-subtle)", paddingTop: 20 }}>
          Última atualização: Abril de 2026<br/>
          Habiticon Construção Inteligente · CNPJ: 61.922.155/0001-70
        </p>
      </main>
    </div>
  );
}