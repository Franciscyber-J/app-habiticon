import { notFound } from "next/navigation";
import empreendimentos from "@/data/empreendimentos.json";
import EmpreendimentoApp from "./EmpreendimentoApp";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
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

export default async function EmpreendimentoPage({ params }: Props) {
  const { slug } = await params;
  const emp = empreendimentos.find((e) => e.slug === slug);
  if (!emp) notFound();
  return <EmpreendimentoApp emp={emp as any} />;
}
