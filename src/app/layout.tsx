import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Habiticon | Motor de Vendas",
  description:
    "Plataforma de simulação e apresentação comercial Habiticon — Construção Inteligente. Simule seu financiamento MCMV com transparência e segurança.",
  keywords: ["habiticon", "imóveis", "MCMV", "minha casa minha vida", "Iporá", "financiamento"],
  authors: [{ name: "Habiticon Construção Inteligente" }],
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#17271C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <head>
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}