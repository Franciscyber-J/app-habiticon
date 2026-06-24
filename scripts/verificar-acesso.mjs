// scripts/verificar-acesso.mjs
// SOMENTE LEITURA — não grava nada. Audita o estado das permissões.
// Uso: node scripts/verificar-acesso.mjs

import admin from "firebase-admin";
import { readFileSync } from "fs";

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const env = {};
for (const linha of envText.split("\n")) {
  const m = linha.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2];
}

const base64 = env.FIREBASE_ADMIN_CREDENTIALS ?? "";
const json = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
admin.initializeApp({ credential: admin.credential.cert(json) });
const db = admin.firestore();

async function verificar() {
  console.log("\n🔍 AUDITORIA DE ACESSO (somente leitura)\n");

  // Slugs reais dos empreendimentos
  const empSnap = await db.collection("empreendimentos").get();
  const slugsValidos = new Set(empSnap.docs.map(d => d.id));
  console.log("📦 Empreendimentos existentes:", [...slugsValidos].join(", "), "\n");

  const usuariosSnap = await db.collection("usuarios").where("status", "==", "ativo").get();

  const problemas = [];
  const tabela = { corretor: [], coordenador: [], correspondente: [], outro: [] };

  for (const docUser of usuariosSnap.docs) {
    const d = docUser.data();
    const role = d.role || "outro";
    const nome = d.nome || docUser.id;
    const lista = Array.isArray(d.empreendimentosPermitidos) ? d.empreendimentosPermitidos : null;
    const flag = d.acessoConfigurado === true;

    const linha = {
      nome,
      lista: lista ? lista.length : "AUSENTE",
      flag: flag ? "sim" : "NÃO",
      slugs: lista ? lista.join(", ") : "—",
    };
    (tabela[role] || tabela.outro).push(linha);

    // Só corretor e coordenador entram no sistema de permissão
    if (role === "corretor" || role === "coordenador") {
      // Problema 1: tem lista mas sem flag (cairia no card de aviso indevidamente)
      if (lista && lista.length > 0 && !flag) {
        problemas.push(`⚠ [${role}] ${nome}: tem ${lista.length} empreendimento(s) mas acessoConfigurado != true → vai cair no card "solicite acesso".`);
      }
      // Problema 2: slug inválido na lista (empreendimento que não existe mais)
      if (lista) {
        for (const slug of lista) {
          if (!slugsValidos.has(slug)) {
            problemas.push(`⚠ [${role}] ${nome}: tem slug inválido "${slug}" (empreendimento não existe).`);
          }
        }
      }
      // Info: campo ausente
      if (lista === null) {
        problemas.push(`ℹ [${role}] ${nome}: empreendimentosPermitidos AUSENTE (verá card de acesso pendente, ou tudo se for lógica antiga).`);
      }
    }
  }

  // Imprime tabela por role
  for (const role of ["corretor", "coordenador", "correspondente"]) {
    const linhas = tabela[role];
    if (!linhas || linhas.length === 0) continue;
    console.log(`\n── ${role.toUpperCase()}ES (${linhas.length}) ──`);
    linhas.forEach(l => {
      console.log(`  ${l.flag === "sim" ? "✅" : "⬜"} ${l.nome}  |  empreendimentos: ${l.lista}  |  configurado: ${l.flag}${l.slugs !== "—" ? `  |  [${l.slugs}]` : ""}`);
    });
  }

  console.log("\n────────────────────────────────");
  if (problemas.length === 0) {
    console.log("✅ Nenhum problema encontrado. Tudo consistente.\n");
  } else {
    console.log(`⚠ ${problemas.length} ponto(s) de atenção:\n`);
    problemas.forEach(p => console.log("  " + p));
    console.log("");
  }
  process.exit(0);
}

verificar().catch(err => { console.error("Erro:", err); process.exit(1); });