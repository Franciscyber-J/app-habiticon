// scripts/migrar-acesso-usuarios.mjs
// Dry-run (diagnóstico):  node scripts/migrar-acesso-usuarios.mjs
// Aplicar:                node scripts/migrar-acesso-usuarios.mjs --aplicar
//
// O QUE FAZ no --aplicar:
//  - Marca acessoConfigurado: true em CORRETORES que já têm empreendimentosPermitidos.
//  - NÃO toca nos coordenadores ausentes (ficam sem acesso de propósito;
//    você libera manualmente no painel admin com um clique).

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

const APLICAR = process.argv.includes("--aplicar");

async function migrar() {
  console.log(APLICAR ? "\n🔧 MODO APLICAR\n" : "\n👀 MODO DRY-RUN (diagnóstico)\n");

  const snap = await db.collection("usuarios").get();

  const corretoresParaMarcar = [];
  const coordenadoresAusentes = [];

  for (const docUser of snap.docs) {
    const d = docUser.data();
    const role = d.role || "(sem role)";
    const nome = d.nome || docUser.id;
    const temPermitidos = Array.isArray(d.empreendimentosPermitidos);
    const temFlag = d.acessoConfigurado === true;

    if (role === "corretor" && temPermitidos && !temFlag) {
      corretoresParaMarcar.push({ nome, ref: docUser.ref });
    }
    if (role === "coordenador" && !temPermitidos) {
      coordenadoresAusentes.push({ nome });
    }
  }

  console.log("── CORRETORES que receberão acessoConfigurado: true ──");
  if (corretoresParaMarcar.length === 0) console.log("  (nenhum)");
  else corretoresParaMarcar.forEach(u => console.log(`  ${u.nome}`));

  console.log("\n── COORDENADORES ausentes (NÃO serão tocados — libere no admin) ──");
  if (coordenadoresAusentes.length === 0) console.log("  (nenhum)");
  else coordenadoresAusentes.forEach(u => console.log(`  ${u.nome}`));

  if (APLICAR) {
    console.log("\n🔧 Aplicando...");
    for (const u of corretoresParaMarcar) {
      await u.ref.update({ acessoConfigurado: true });
      console.log(`  ✅ ${u.nome}`);
    }
    console.log(`\n✅ ${corretoresParaMarcar.length} corretor(es) marcado(s).`);
    console.log(`ℹ️  ${coordenadoresAusentes.length} coordenador(es) deixado(s) sem acesso (configure no admin).\n`);
  } else {
    console.log("\nℹ️  Dry-run. Rode com --aplicar quando o deploy estiver no ar.\n");
  }
  process.exit(0);
}

migrar().catch(err => { console.error("Erro:", err); process.exit(1); });