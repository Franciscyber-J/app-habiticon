"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User, Lock, Mail, ArrowRight, Eye, EyeOff, CreditCard, Landmark, Wallet, FileBadge } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default function CadastroCorretorPage() {
  // Dados de Acesso
  const [creci, setCreci] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  
  // Dados Bancários / Financeiros (Opcionais)
  const [cpf, setCpf] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (erro && !email) return; 

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

      // Cria o documento do usuário com todos os dados (obrigatórios + opcionais)
      await setDoc(doc(db, "usuarios", user.uid), {
         nome,
         email,
         telefone,
         creci: creci.trim(),
         role: "corretor",
         status: "ativo",
         dataCriacao: new Date().toISOString(),
         dadosBancarios: {
           cpf: cpf.trim(),
           chavePix: chavePix.trim(),
           banco: banco.trim(),
           agencia: agencia.trim(),
           conta: conta.trim()
         }
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

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(circle at center, rgba(15,30,22,1) 0%, var(--bg-base) 100%)",
      padding: "40px 20px"
    }}>
      <div style={{
        width: "100%", maxWidth: 600,
        background: "rgba(10,25,16,0.95)", backdropFilter: "blur(20px)",
        border: "1px solid var(--border-subtle)", borderRadius: 24,
        padding: "40px 32px", boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
      }}>
        
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <Image src="/logo.png" alt="Habiticon" width={240} height={70} style={{ height: 48, width: "auto" }} priority />
        </div>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--gray-light)", marginBottom: 8 }}>
            Cadastro de Corretor Parceiro
          </h1>
          <p style={{ fontSize: 13, color: "var(--gray-mid)" }}>Crie seu acesso e preencha seus dados para recebimento de comissões.</p>
        </div>

        <form onSubmit={handleCadastro} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* SESSÃO 1: DADOS OBRIGATÓRIOS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--terracota)", borderBottom: "1px solid rgba(175,111,83,0.3)", paddingBottom: 8 }}>
              Dados de Acesso (Obrigatório)
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Nome Completo</label>
                <div style={{ position: "relative" }}>
                  <User size={16} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                  <input type="text" required value={nome} onChange={(e) => {setNome(e.target.value); setErro("");}} className="input-field" style={{ paddingLeft: 40, fontSize: 14 }} placeholder="Seu nome" />
                </div>
              </div>
              
              {/* NOVO CAMPO: CRECI */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Número do CRECI</label>
                <div style={{ position: "relative" }}>
                  <FileBadge size={16} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                  <input type="text" required value={creci} onChange={(e) => {setCreci(e.target.value); setErro("");}} className="input-field" style={{ paddingLeft: 40, fontSize: 14 }} placeholder="Ex: 12345-F" />
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>E-mail</label>
                <div style={{ position: "relative" }}>
                  <Mail size={16} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                  <input type="email" required value={email} onChange={(e) => {setEmail(e.target.value); setErro("");}} className="input-field" style={{ paddingLeft: 40, fontSize: 14 }} placeholder="nome@email.com" />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>WhatsApp</label>
                <div style={{ position: "relative" }}>
                   <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--gray-dark)", fontSize: 14 }}>📞</span>
                  <input type="text" required value={telefone} onChange={(e) => {setTelefone(e.target.value); setErro("");}} className="input-field" style={{ paddingLeft: 40, fontSize: 14 }} placeholder="(64) 99999-9999" />
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Criar Senha</label>
                <div style={{ position: "relative" }}>
                  <Lock size={16} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                  <input type={mostrarSenha ? "text" : "password"} required value={senha} onChange={(e) => {setSenha(e.target.value); setErro("");}} className="input-field" style={{ paddingLeft: 40, paddingRight: 40, fontSize: 14 }} placeholder="Mín. 6 dígitos" />
                  <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--gray-dark)", display: "flex", alignItems: "center" }}>
                    {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Confirmar Senha</label>
                <div style={{ position: "relative" }}>
                  <Lock size={16} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                  <input type={mostrarConfirmarSenha ? "text" : "password"} required value={confirmarSenha} onChange={(e) => {setConfirmarSenha(e.target.value); setErro("");}} className="input-field" style={{ paddingLeft: 40, paddingRight: 40, fontSize: 14 }} placeholder="Repita a senha" />
                  <button type="button" onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--gray-dark)", display: "flex", alignItems: "center" }}>
                    {mostrarConfirmarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SESSÃO 2: DADOS FINANCEIROS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, background: "rgba(0,0,0,0.2)", padding: 20, borderRadius: 16, border: "1px dashed var(--border-subtle)" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-light)", display: "flex", alignItems: "center", gap: 8 }}>
              <Wallet size={16} color="#4ade80" />
              Dados para Comissionamento (Opcional)
            </h2>
            <p style={{ fontSize: 12, color: "var(--gray-mid)", marginTop: -10 }}>Pode preencher agora ou atualizar depois no seu painel.</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>CPF ou CNPJ</label>
                <div style={{ position: "relative" }}>
                  <CreditCard size={16} color="var(--gray-dark)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                  <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} className="input-field" style={{ paddingLeft: 40, fontSize: 14 }} placeholder="Apenas números" />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Chave PIX</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--gray-dark)", fontSize: 14 }}>❖</span>
                  <input type="text" value={chavePix} onChange={(e) => setChavePix(e.target.value)} className="input-field" style={{ paddingLeft: 40, fontSize: 14 }} placeholder="CPF, E-mail ou Celular" />
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Banco</label>
                <div style={{ position: "relative" }}>
                  <Landmark size={14} color="var(--gray-dark)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input type="text" value={banco} onChange={(e) => setBanco(e.target.value)} className="input-field" style={{ paddingLeft: 34, fontSize: 13 }} placeholder="Ex: Nubank" />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Agência</label>
                <input type="text" value={agencia} onChange={(e) => setAgencia(e.target.value)} className="input-field" style={{ fontSize: 13 }} placeholder="0001" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Conta</label>
                <input type="text" value={conta} onChange={(e) => setConta(e.target.value)} className="input-field" style={{ fontSize: 13 }} placeholder="12345-6" />
              </div>
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
              padding: "16px", borderRadius: 12, border: "none", cursor: "pointer",
              background: "var(--terracota)", color: "white", fontSize: 15, fontWeight: 800,
              transition: "all 0.2s", boxShadow: "0 4px 14px rgba(175,111,83,0.3)"
            }}
          >
            {loading ? "A criar conta..." : <>Finalizar Cadastro e Acessar Painel <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}