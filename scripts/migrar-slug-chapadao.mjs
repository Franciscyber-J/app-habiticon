// scripts/migrar-slug-chapadao.mjs
// Uso:
//   Dry-run (só mostra, não grava):  node scripts/migrar-slug-chapadao.mjs
//   Aplicar de verdade:              node scripts/migrar-slug-chapadao.mjs --aplicar

import admin from "firebase-admin";
import { readFileSync } from "fs";

// ── Carrega o .env.local manualmente (sem depender de libs) ──
const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const env = {};
for (const linha of envText.split("\n")) {
  const m = linha.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2];
}

// ── Inicializa o Admin SDK (mesma mecânica do firebase-admin.ts) ──
const base64 = env.FIREBASE_ADMIN_CREDENTIALS ?? "";
const json = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
admin.initializeApp({ credential: admin.credential.cert(json) });
const db = admin.firestore();

// ── DE-PARA: slug errado → slug certo ──
const DE_PARA = {
  "chapadao-do-ceu---mcmv": "chapadao-do-ceu-mcmv",
};

const APLICAR = process.argv.includes("--aplicar");

async function migrar() {
  console.log(APLICAR ? "\n🔧 MODO APLICAR (vai gravar)\n" : "\n👀 MODO DRY-RUN (só mostra, não grava)\n");

  const snap = await db.collection("leads").get();
  let encontrados = 0;
  let corrigidos = 0;

  for (const docLead of snap.docs) {
    const data = docLead.data();
    const idAtual = data.empreendimentoId;
    const idCorreto = DE_PARA[idAtual];

    if (idCorreto) {
      encontrados++;
      console.log(`  Lead "${data.nome || docLead.id}"  —  ${idAtual}  →  ${idCorreto}`);

      if (APLICAR) {
        await docLead.ref.update({ empreendimentoId: idCorreto });
        corrigidos++;
      }
    }
  }

  console.log(`\n📊 ${encontrados} lead(s) com slug errado encontrado(s).`);
  if (APLICAR) {
    console.log(`✅ ${corrigidos} lead(s) corrigido(s).\n`);
  } else {
    console.log(`ℹ️  Nada foi gravado. Rode com --aplicar para corrigir de verdade.\n`);
  }
  process.exit(0);
}

migrar().catch(err => {
  console.error("Erro na migração:", err);
  process.exit(1);
});