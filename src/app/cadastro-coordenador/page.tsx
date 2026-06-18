"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { User, Mail, Lock, ShieldCheck, ArrowLeft, Loader2, Eye, EyeOff, CreditCard, Landmark, Wallet } from "lucide-react";

export default function CadastroCoordenador() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false); // Estado para o "olhinho"

  // Dados Bancários / Financeiros (Opcionais)
  const [cpf, setCpf] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");

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
        telefone,
        role: "coordenador",
        status: "ativo",
        createdAt: new Date().toISOString(),
        empreendimentosPermitidos: [],
        acessoConfigurado: false,
        dadosBancarios: {
          cpf: cpf.trim(),
          chavePix: chavePix.trim(),
          banco: banco.trim(),
          agencia: agencia.trim(),
          conta: conta.trim()
        }
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

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>WhatsApp</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 16, top: 13, color: "var(--terracota)", fontSize: 16 }}>📞</span>
              <input type="text" required value={telefone} onChange={(e) => setTelefone(e.target.value)} className="input-field" style={{ paddingLeft: 48, height: 48 }} placeholder="(64) 99999-9999" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Senha</label>
              <div style={{ position: "relative" }}>
                <Lock size={18} style={{ position: "absolute", left: 16, top: 14, color: "var(--terracota)" }} />
                <input 
                  type={mostrarSenha ? "text" : "password"} 
                  required 
                  value={senha} 
                  onChange={(e) => setSenha(e.target.value)} 
                  className="input-field" 
                  style={{ paddingLeft: 48, paddingRight: 40, height: 48 }} 
                />
                <button
                  type="button" 
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                >
                  {mostrarSenha ? <EyeOff size={16} color="var(--gray-mid)" /> : <Eye size={16} color="var(--gray-mid)" />}
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Confirmar</label>
              <div style={{ position: "relative" }}>
                <Lock size={18} style={{ position: "absolute", left: 16, top: 14, color: "var(--terracota)" }} />
                <input 
                  type={mostrarSenha ? "text" : "password"} 
                  required 
                  value={confirmarSenha} 
                  onChange={(e) => setConfirmarSenha(e.target.value)} 
                  className="input-field" 
                  style={{ paddingLeft: 48, paddingRight: 40, height: 48 }} 
                />
                 <button
                  type="button" 
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                >
                  {mostrarSenha ? <EyeOff size={16} color="var(--gray-mid)" /> : <Eye size={16} color="var(--gray-mid)" />}
                </button>
              </div>
            </div>
          </div>

          {/* SEÇÃO: DADOS BANCÁRIOS (OPCIONAL) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, background: "rgba(0,0,0,0.2)", padding: 16, borderRadius: 14, border: "1px dashed var(--border-subtle)", marginTop: 4 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-light)", display: "flex", alignItems: "center", gap: 8 }}>
              <Wallet size={15} color="#4ade80" /> Dados para Comissionamento (Opcional)
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>CPF ou CNPJ</label>
                <div style={{ position: "relative" }}>
                  <CreditCard size={15} color="var(--gray-dark)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} className="input-field" style={{ paddingLeft: 36, fontSize: 13 }} placeholder="Apenas números" />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Chave PIX</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--gray-dark)", fontSize: 13 }}>❖</span>
                  <input type="text" value={chavePix} onChange={(e) => setChavePix(e.target.value)} className="input-field" style={{ paddingLeft: 36, fontSize: 13 }} placeholder="CPF, E-mail ou Celular" />
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Banco</label>
                <div style={{ position: "relative" }}>
                  <Landmark size={13} color="var(--gray-dark)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                  <input type="text" value={banco} onChange={(e) => setBanco(e.target.value)} className="input-field" style={{ paddingLeft: 30, fontSize: 12 }} placeholder="Ex: Nubank" />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Agência</label>
                <input type="text" value={agencia} onChange={(e) => setAgencia(e.target.value)} className="input-field" style={{ fontSize: 12 }} placeholder="0001" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>Conta</label>
                <input type="text" value={conta} onChange={(e) => setConta(e.target.value)} className="input-field" style={{ fontSize: 12 }} placeholder="12345-6" />
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