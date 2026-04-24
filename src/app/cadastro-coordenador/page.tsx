"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { User, Mail, Lock, ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";

export default function CadastroCoordenador() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const router = useRouter();

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      // 1. Criar usuário no Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      // 2. Salvar no Firestore com role 'coordenador'
      await setDoc(doc(db, "usuarios", user.uid), {
        nome,
        email,
        role: "coordenador",
        status: "ativo",
        createdAt: new Date().toISOString()
      });

      alert("Cadastro de coordenador realizado com sucesso!");
      router.push("/painel-coordenador");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setErro("Este e-mail já está em uso.");
      } else {
        setErro("Ocorreu um erro ao realizar o cadastro.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
      
      <div style={{ width: "100%", maxWidth: 450, background: "var(--bg-card)", borderRadius: 24, border: "1px solid var(--border-subtle)", padding: "40px 32px", boxShadow: "var(--shadow-card)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Image src="/logo.png" alt="Habiticon" width={180} height={50} style={{ margin: "0 auto 24px", height: "auto" }} priority />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>Cadastro de Coordenador</h1>
          <p style={{ color: "var(--gray-mid)", fontSize: 14, marginTop: 8 }}>Acesso total à gestão de vendas e equipe.</p>
        </div>

        {erro && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", padding: 12, borderRadius: 10, color: "#f87171", fontSize: 13, marginBottom: 24, textAlign: "center" }}>
            {erro}
          </div>
        )}

        <form onSubmit={handleCadastro} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Nome Completo</label>
            <div style={{ position: "relative" }}>
              <User size={18} style={{ position: "absolute", left: 16, top: 14, color: "var(--terracota)" }} />
              <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} className="input-field" style={{ paddingLeft: 48, height: 48 }} placeholder="Nome do coordenador(a)" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>E-mail Profissional</label>
            <div style={{ position: "relative" }}>
              <Mail size={18} style={{ position: "absolute", left: 16, top: 14, color: "var(--terracota)" }} />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" style={{ paddingLeft: 48, height: 48 }} placeholder="email@exemplo.com" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Senha</label>
              <div style={{ position: "relative" }}>
                <Lock size={18} style={{ position: "absolute", left: 16, top: 14, color: "var(--terracota)" }} />
                <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} className="input-field" style={{ paddingLeft: 48, height: 48 }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Confirmar</label>
              <div style={{ position: "relative" }}>
                <Lock size={18} style={{ position: "absolute", left: 16, top: 14, color: "var(--terracota)" }} />
                <input type="password" required value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} className="input-field" style={{ paddingLeft: 48, height: 48 }} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ height: 52, borderRadius: 14, background: "var(--terracota)", color: "white", fontSize: 16, fontWeight: 800, border: "none", cursor: loading ? "not-allowed" : "pointer", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {loading ? <Loader2 size={20} className="animate-spin" /> : <><ShieldCheck size={20} /> Finalizar Cadastro</>}
          </button>
        </form>

        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link href="/login" style={{ fontSize: 13, color: "var(--gray-mid)", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <ArrowLeft size={14} /> Já tenho acesso. Fazer Login
          </Link>
        </div>
      </div>
    </div>
  );
}