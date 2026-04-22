"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, ArrowRight, Mail, Eye, EyeOff } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, "usuarios", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();

        if (userData.status === "inativo") {
          setErro("A sua conta foi desativada pelo administrador.");
          await auth.signOut();
          setLoading(false);
          return;
        }

        if (userData.role === "admin")           router.push("/admin");
        else if (userData.role === "corretor")   router.push("/painel-corretor");
        else if (userData.role === "correspondente") router.push("/painel-correspondente");
        else router.push("/admin");
      } else {
        router.push("/admin");
      }
    } catch (err: any) {
      // Evita o console.error bruto que aciona a tela de erro do Next.js no ambiente de desenvolvimento
      const errorCode = err?.code || "";
      
      // Tratamento elegante do erro do Firebase
      if (errorCode === "auth/invalid-credential" || errorCode === "auth/wrong-password" || errorCode === "auth/user-not-found") {
        setErro("E-mail ou senha incorretos.");
      } else if (errorCode === "auth/too-many-requests") {
        setErro("Muitas tentativas falhadas. Tente novamente mais tarde.");
      } else {
        setErro("Ocorreu um erro ao tentar acessar. Verifique os dados e tente novamente.");
      }
      
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setErro("Preencha o e-mail primeiro para recuperar a senha.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setErro("");
    } catch {
      setErro("Erro ao enviar e-mail de recuperação. Verifique o endereço.");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(circle at center, rgba(15,30,22,1) 0%, var(--bg-base) 100%)",
      padding: "20px"
    }}>
      <div style={{
        width: "100%", maxWidth: 400,
        background: "rgba(10,25,16,0.95)", backdropFilter: "blur(20px)",
        border: "1px solid var(--border-subtle)", borderRadius: 24,
        padding: "40px 32px", boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
      }}>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <Image src="/logo.png" alt="Habiticon" width={240} height={70} style={{ height: 48, width: "auto" }} priority />
        </div>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--gray-light)", marginBottom: 8, letterSpacing: "-0.02em" }}>
            Acesso ao Portal
          </h1>
          <p style={{ fontSize: 14, color: "var(--gray-mid)" }}>Insira as suas credenciais para continuar.</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* E-MAIL */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              E-mail
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={18} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="email" required value={email}
                onChange={(e) => { setEmail(e.target.value); setErro(""); }}
                className="input-field"
                style={{ paddingLeft: 42, fontSize: 15 }}
                placeholder="nome@email.com"
              />
            </div>
          </div>

          {/* SENHA */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Senha
              </label>
              <button
                type="button" onClick={handleResetPassword} disabled={loading}
                style={{ fontSize: 12, color: "var(--terracota)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Esqueci a senha
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <Lock size={18} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type={mostrarSenha ? "text" : "password"} required value={senha}
                onChange={(e) => { setSenha(e.target.value); setErro(""); }}
                className="input-field"
                style={{ paddingLeft: 42, paddingRight: 42, fontSize: 15 }}
                placeholder="••••••••"
              />
              <button
                type="button" onClick={() => setMostrarSenha(!mostrarSenha)}
                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
              >
                {mostrarSenha ? <EyeOff size={18} color="var(--gray-mid)" /> : <Eye size={18} color="var(--gray-mid)" />}
              </button>
            </div>
          </div>

          {erro && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <p style={{ fontSize: 13, color: "#f87171", textAlign: "center" }}>{erro}</p>
            </div>
          )}
          {resetSent && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)" }}>
              <p style={{ fontSize: 13, color: "#4ade80", textAlign: "center" }}>E-mail de recuperação enviado! Verifique a sua caixa de entrada.</p>
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px", borderRadius: 12, border: "none", cursor: "pointer",
              background: "var(--terracota)", color: "white", fontSize: 15, fontWeight: 700,
              boxShadow: "0 4px 14px rgba(175,111,83,0.3)", marginTop: 8, transition: "all 0.2s"
            }}
          >
            {loading ? "Aguarde..." : <>Acessar Portal <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}