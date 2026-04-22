import { notFound } from "next/navigation";
import empreendimentos from "@/data/empreendimentos.json";
import EmpreendimentoApp from "./EmpreendimentoApp";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateStaticParams() {
  return empreendimentos.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const emp = empreendimentos.find((e) => e.slug === slug);
  if (!emp) return { title: "Não encontrado" };
  return {
    title: `${emp.nome} | Motor de Vendas Habiticon`,
    description: emp.descricao,
  };
}

export default async function EmpreendimentoPage({ params, searchParams }: Props) {
  const { slug } = await params;
  
  // No Next.js 15/16 com Turbopack, os searchParams são uma Promise
  const resolvedSearchParams = await searchParams;
  
  const emp = empreendimentos.find((e) => e.slug === slug);
  if (!emp) notFound();

  // ── CAPTURA ESTRATÉGICA DE RASTREAMENTO ──
  const corretorId = typeof resolvedSearchParams?.ref === 'string' ? resolvedSearchParams.ref : "";
  const origem = typeof resolvedSearchParams?.source === 'string' 
    ? resolvedSearchParams.source 
    : typeof resolvedSearchParams?.utm_source === 'string' 
      ? resolvedSearchParams.utm_source 
      : "organico";

  // Repassamos as variáveis de rastreamento para o App Principal
  return <EmpreendimentoApp emp={emp as any} corretorIdUrl={corretorId} origemUrl={origem} />;
}