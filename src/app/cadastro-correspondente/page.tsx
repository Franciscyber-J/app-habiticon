"use client";

// ─────────────────────────────────────────────────────────
// IMPORTAÇÕES
// ─────────────────────────────────────────────────────────
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Building2, Lock, ArrowRight, Mail, User, Phone, CheckCircle2, ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";

export default function CadastroCorrespondentePage() {
  // ── ESTADOS DO FORMULÁRIO ──
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  
  // ── CONTROLE DE INTERFACE E SENHA ──
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();

  // ─────────────────────────────────────────────────────────
  // LÓGICA DE REGISTRO
  // ─────────────────────────────────────────────────────────
  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    
    // Validações básicas
    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      // 1. Cria o usuário no Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      // 2. Atualiza o perfil (nome visível) no Authentication
      await updateProfile(user, { displayName: nome });

      // 3. Salva o Perfil Completo na Coleção 'usuarios' do Firestore
      // A role aqui é fixa como "correspondente" e o status já nasce "ativo"
      await setDoc(doc(db, "usuarios", user.uid), {
        nome,
        email,
        telefone,
        role: "correspondente",
        status: "ativo",
        dataCadastro: new Date().toISOString()
      });

      // Sucesso! Mostra a tela verde e redireciona.
      setSucesso(true);
      
      // Como o createUserWithEmailAndPassword já loga o usuário automaticamente,
      // redirecionamos para o painel correspondente após 3 segundos.
      setTimeout(() => {
        router.push("/painel-correspondente");
      }, 3000);

    } catch (err: any) {
      console.error(err);
      // Tratamento de erros comuns do Firebase
      if (err.code === "auth/email-already-in-use") {
        setErro("Este e-mail já está cadastrado.");
      } else if (err.code === "auth/invalid-email") {
        setErro("E-mail inválido.");
      } else {
        setErro("Ocorreu um erro ao criar a conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // TELA DE SUCESSO (Renderização Condicional)
  // ─────────────────────────────────────────────────────────
  if (sucesso) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(circle at center, rgba(15,30,22,1) 0%, var(--bg-base) 100%)",
        padding: "20px"
      }}>
        <div style={{
          width: "100%", maxWidth: 400, textAlign: "center",
          background: "rgba(10,25,16,0.95)", backdropFilter: "blur(20px)",
          border: "1px solid var(--border-subtle)", borderRadius: 24,
          padding: "50px 32px", boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
        }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(74,222,128,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", border: "1px solid rgba(74,222,128,0.3)" }}>
            <CheckCircle2 size={40} color="#4ade80" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "white", marginBottom: 12 }}>Cadastro Concluído!</h2>
          <p style={{ fontSize: 15, color: "var(--gray-mid)", lineHeight: 1.5, marginBottom: 24 }}>
            Bem-vindo(a) à equipe Habiticon, <strong>{nome}</strong>. Sua conta de Correspondente Bancário foi criada com sucesso.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--terracota)" }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Redirecionando para o seu painel...</span>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 100% { transform: rotate(360deg); } }`}} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDERIZAÇÃO DO FORMULÁRIO DE CADASTRO
  // ─────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(circle at center, rgba(15,30,22,1) 0%, var(--bg-base) 100%)",
      padding: "20px"
    }}>
      <div style={{
        width: "100%", maxWidth: 440,
        background: "rgba(10,25,16,0.95)", backdropFilter: "blur(20px)",
        border: "1px solid var(--border-subtle)", borderRadius: 24,
        padding: "40px 32px", boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
      }}>
        
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <Image src="/logo.png" alt="Habiticon" width={240} height={70} style={{ height: 40, width: "auto" }} priority />
        </div>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "rgba(56,189,248,0.1)", borderRadius: 100, border: "1px solid rgba(56,189,248,0.2)", marginBottom: 12 }}>
            <ShieldCheck size={14} color="#38bdf8" />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Área Restrita</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--gray-light)", marginBottom: 8, letterSpacing: "-0.02em" }}>
            Cadastro de Correspondente
          </h1>
          <p style={{ fontSize: 13, color: "var(--gray-mid)" }}>Crie sua conta para acessar a Mesa de Crédito Habiticon.</p>
        </div>

        <form onSubmit={handleCadastro} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          
          {/* NOME COMPLETO */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Nome Completo</label>
            <div style={{ position: "relative" }}>
              <User size={18} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} className="input-field" style={{ paddingLeft: 42, fontSize: 14 }} placeholder="Seu nome" />
            </div>
          </div>

          {/* E-MAIL E TELEFONE (Lado a lado no Desktop, coluna no Mobile) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>E-mail</label>
              <div style={{ position: "relative" }}>
                <Mail size={18} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                <input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setErro(""); }} className="input-field" style={{ paddingLeft: 42, fontSize: 14 }} placeholder="nome@email.com" />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>WhatsApp</label>
              <div style={{ position: "relative" }}>
                <Phone size={18} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                <input type="tel" required value={telefone} onChange={(e) => setTelefone(e.target.value)} className="input-field" style={{ paddingLeft: 42, fontSize: 14 }} placeholder="(00) 00000-0000" />
              </div>
            </div>
          </div>

          {/* SENHA E CONFIRMAR SENHA */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Senha</label>
              <div style={{ position: "relative" }}>
                <Lock size={18} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                <input type={mostrarSenha ? "text" : "password"} required minLength={6} value={senha} onChange={(e) => { setSenha(e.target.value); setErro(""); }} className="input-field" style={{ paddingLeft: 42, paddingRight: 40, fontSize: 14 }} placeholder="••••••••" />
                <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                  {mostrarSenha ? <EyeOff size={16} color="var(--gray-mid)" /> : <Eye size={16} color="var(--gray-mid)" />}
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Confirmar Senha</label>
              <div style={{ position: "relative" }}>
                <Lock size={18} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                <input type={mostrarConfirmarSenha ? "text" : "password"} required minLength={6} value={confirmarSenha} onChange={(e) => { setConfirmarSenha(e.target.value); setErro(""); }} className="input-field" style={{ paddingLeft: 42, paddingRight: 40, fontSize: 14 }} placeholder="••••••••" />
                <button type="button" onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                  {mostrarConfirmarSenha ? <EyeOff size={16} color="var(--gray-mid)" /> : <Eye size={16} color="var(--gray-mid)" />}
                </button>
              </div>
            </div>
          </div>

          {/* Feedback de Erro */}
          {erro && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", marginTop: 4 }}>
              <p style={{ fontSize: 13, color: "#f87171", textAlign: "center" }}>{erro}</p>
            </div>
          )}

          {/* Botão Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px", borderRadius: 12, border: "none", cursor: "pointer",
              background: "#38bdf8", color: "#082f49", fontSize: 15, fontWeight: 800,
              boxShadow: "0 4px 14px rgba(56,189,248,0.3)", marginTop: 12, transition: "all 0.2s"
            }}
          >
            {loading ? "Criando conta..." : <>Criar Conta de Correspondente <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}