"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { User, Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react"; 
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

// O componente interno que faz a leitura dos parâmetros da URL
function CadastroForm() {
  const searchParams = useSearchParams();
  const roleUrl = searchParams.get("role");
  
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState(""); 
  
  // Controles do "Olhinho"
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
     if (roleUrl !== "corretor" && roleUrl !== "correspondente" && roleUrl !== "admin") {
         setErro("Link de cadastro inválido ou expirado.");
     }
  }, [roleUrl]);

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (erro && !email) return; 

    // ─────────────────────────────────────────────────────────
    // VERIFICAÇÃO DE SEGURANÇA: Senhas Iguais
    // ─────────────────────────────────────────────────────────
    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem. Verifique e digite novamente.");
      return;
    }

    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setErro("");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      await setDoc(doc(db, "usuarios", user.uid), {
         nome,
         email,
         telefone,
         role: roleUrl,
         status: "ativo",
         dataCriacao: new Date().toISOString()
      });

      router.push("/login");

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
         setErro("Este e-mail já está registado.");
      } else {
         setErro("Erro ao criar conta. Tente novamente.");
      }
      setLoading(false);
    }
  };

  if (roleUrl !== "corretor" && roleUrl !== "correspondente" && roleUrl !== "admin") {
      return (
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
              <div style={{ textAlign: "center", padding: 40, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                  <h2 style={{ color: "#f87171", fontSize: 20, marginBottom: 10 }}>Link Inválido</h2>
                  <p style={{ color: "var(--gray-mid)" }}>Solicite um link de cadastro válido ao administrador.</p>
              </div>
          </div>
      );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(circle at center, rgba(15,30,22,1) 0%, var(--bg-base) 100%)",
      padding: "20px"
    }}>
      <div style={{
        width: "100%", maxWidth: 450,
        background: "rgba(10,25,16,0.95)", backdropFilter: "blur(20px)",
        border: "1px solid var(--border-subtle)", borderRadius: 24,
        padding: "40px 32px", boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
      }}>
        
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <Image src="/logo.png" alt="Habiticon" width={240} height={70} style={{ height: 48, width: "auto" }} priority />
        </div>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--gray-light)", marginBottom: 8 }}>
            Cadastro de {roleUrl.charAt(0).toUpperCase() + roleUrl.slice(1)}
          </h1>
          <p style={{ fontSize: 13, color: "var(--gray-mid)" }}>Preencha os dados para criar o seu acesso.</p>
        </div>

        <form onSubmit={handleCadastro} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          
          {/* Nome */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Nome Completo</label>
            <div style={{ position: "relative" }}>
              <User size={16} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input type="text" required value={nome} onChange={(e) => {setNome(e.target.value); setErro("");}} className="input-field" style={{ paddingLeft: 40, fontSize: 14 }} placeholder="Seu nome" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>E-mail</label>
            <div style={{ position: "relative" }}>
              <Mail size={16} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input type="email" required value={email} onChange={(e) => {setEmail(e.target.value); setErro("");}} className="input-field" style={{ paddingLeft: 40, fontSize: 14 }} placeholder="nome@email.com" />
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>WhatsApp</label>
            <div style={{ position: "relative" }}>
               <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--gray-dark)", fontSize: 14 }}>📞</span>
              <input type="text" required value={telefone} onChange={(e) => {setTelefone(e.target.value); setErro("");}} className="input-field" style={{ paddingLeft: 40, fontSize: 14 }} placeholder="(64) 99999-9999" />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Criar Senha (Mínimo 6 dígitos)</label>
            <div style={{ position: "relative" }}>
              <Lock size={16} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type={mostrarSenha ? "text" : "password"} 
                required 
                value={senha} 
                onChange={(e) => {setSenha(e.target.value); setErro("");}} 
                className="input-field" 
                style={{ paddingLeft: 40, paddingRight: 40, fontSize: 14 }} 
                placeholder="••••••••" 
              />
              <button 
                type="button" 
                onClick={() => setMostrarSenha(!mostrarSenha)} 
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--gray-dark)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmar Senha */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Confirmar Senha</label>
            <div style={{ position: "relative" }}>
              <Lock size={16} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type={mostrarConfirmarSenha ? "text" : "password"} 
                required 
                value={confirmarSenha} 
                onChange={(e) => {setConfirmarSenha(e.target.value); setErro("");}} 
                className="input-field" 
                style={{ paddingLeft: 40, paddingRight: 40, fontSize: 14 }} 
                placeholder="••••••••" 
              />
              <button 
                type="button" 
                onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)} 
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--gray-dark)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {mostrarConfirmarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {erro && (
            <div style={{ padding: "10px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <p style={{ fontSize: 13, color: "#f87171", textAlign: "center", fontWeight: 600 }}>{erro}</p>
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px", borderRadius: 12, border: "none", cursor: "pointer",
              background: "var(--terracota)", color: "white", fontSize: 15, fontWeight: 700,
              marginTop: 10, transition: "all 0.2s", boxShadow: "0 4px 14px rgba(175,111,83,0.3)"
            }}
          >
            {loading ? "A criar conta..." : <>Criar Conta <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}

// O componente de página exportado que envole o formulário no Suspense
export default function CadastroPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", color: "var(--gray-mid)" }}>
        Carregando...
      </div>
    }>
      <CadastroForm />
    </Suspense>
  );
}