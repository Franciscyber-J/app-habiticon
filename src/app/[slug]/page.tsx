import { notFound } from "next/navigation";
import empreendimentos from "@/data/empreendimentos.json";
import EmpreendimentoApp from "./EmpreendimentoApp";
import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin"; // ← adiciona

export const dynamicParams = true; // ← aceita slugs fora do JSON

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateStaticParams() {
  return empreendimentos.map((e) => ({ slug: e.slug }));
}

// Helper: busca no JSON primeiro, depois no Firestore
async function getEmpreendimento(slug: string) {
  const local = empreendimentos.find((e) => e.slug === slug);
  if (local) return local;
  const snap = await adminDb.collection("empreendimentos").doc(slug).get();
  if (!snap.exists) return null;
  return snap.data() as any;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const emp = await getEmpreendimento(slug);
  if (!emp) return { title: "Não encontrado" };
  return {
    title: `${emp.nome} | Motor de Vendas Habiticon`,
    description: emp.descricao,
  };
}

export default async function EmpreendimentoPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  const emp = await getEmpreendimento(slug);
  if (!emp) notFound();

  const corretorId = typeof resolvedSearchParams?.ref === "string" ? resolvedSearchParams.ref : "";
  const origem = typeof resolvedSearchParams?.source === "string"
    ? resolvedSearchParams.source
    : typeof resolvedSearchParams?.utm_source === "string"
      ? resolvedSearchParams.utm_source
      : "organico";

  return <EmpreendimentoApp emp={emp as any} corretorIdUrl={corretorId} origemUrl={origem} />;
}