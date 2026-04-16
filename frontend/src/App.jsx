import { useState } from "react";
import {
  Wallet, RefreshCw, LayoutDashboard, PlusCircle,
  ShieldCheck, List, AlertTriangle, ExternalLink, Boxes,
} from "lucide-react";
import toast from "react-hot-toast";
import { useContract } from "./hooks/useContract.js";
import { ImageList }   from "./components/ImageList.jsx";
import { RegisterForm } from "./components/RegisterForm.jsx";
import { VerifyForm }   from "./components/VerifyForm.jsx";

const TABS = [
  { id: "dashboard", label: "Dashboard",   icon: LayoutDashboard },
  { id: "register",  label: "Enregistrer", icon: PlusCircle      },
  { id: "verify",    label: "Vérifier",    icon: ShieldCheck      },
  { id: "list",      label: "Images",      icon: List             },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const {
    account, isOwner, chainOk, connecting,
    images, loading,
    connect, fetchImages,
    registerImage, revokeImage, verifyImage,
  } = useContract();

  const stats = {
    total:   images.length,
    valid:   images.filter((i) => !i.revoked).length,
    revoked: images.filter((i) => i.revoked).length,
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-lg">
              🐳
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 leading-none">Docker Registry</h1>
              <p className="text-xs text-slate-500 leading-none mt-0.5">Blockchain · Sepolia</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {account && (
              <button
                onClick={() => { fetchImages(); toast.success("Actualisé"); }}
                className="btn-outline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Actualiser</span>
              </button>
            )}

            {!account ? (
              <button onClick={() => connect().catch((e) => toast.error(e.message))} disabled={connecting} className="btn-primary">
                <Wallet className="w-4 h-4" />
                {connecting ? "Connexion…" : "Connecter MetaMask"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {isOwner && (
                  <span className="badge-valid text-xs">
                    <Boxes className="w-3 h-3" /> Owner
                  </span>
                )}
                {!chainOk && (
                  <span className="badge-revoked text-xs">
                    <AlertTriangle className="w-3 h-3" /> Mauvais réseau
                  </span>
                )}
                <span className="font-mono text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                  {account.slice(0, 6)}…{account.slice(-4)}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tab Nav */}
      {account && (
        <nav className="border-b border-slate-800 bg-slate-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === id
                    ? "border-brand-500 text-brand-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {!account ? (
          <LandingScreen onConnect={() => connect().catch((e) => toast.error(e.message))} connecting={connecting} />
        ) : (
          <>
            {tab === "dashboard" && <DashboardTab stats={stats} images={images} loading={loading} account={account} isOwner={isOwner} />}
            {tab === "register"  && (
              <div className="max-w-xl">
                <SectionHeader title="Enregistrer une image" subtitle="Ancrez le hash SHA256 d'une image Docker sur la blockchain Sepolia." />
                {isOwner ? (
                  <div className="card mt-6">
                    <RegisterForm onRegister={registerImage} />
                  </div>
                ) : (
                  <div className="card mt-6 flex items-center gap-3 text-amber-400">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p className="text-sm">Seul le propriétaire du contrat peut enregistrer des images.</p>
                  </div>
                )}
              </div>
            )}
            {tab === "verify" && (
              <div className="max-w-xl">
                <SectionHeader title="Vérifier l'intégrité" subtitle="Comparez le hash local d'une image avec l'enregistrement on-chain." />
                <div className="card mt-6">
                  <VerifyForm onVerify={verifyImage} />
                </div>
              </div>
            )}
            {tab === "list" && (
              <div>
                <SectionHeader title="Images enregistrées" subtitle={`${stats.total} image${stats.total > 1 ? "s" : ""} au total — ${stats.valid} valide${stats.valid > 1 ? "s" : ""}, ${stats.revoked} révoquée${stats.revoked > 1 ? "s" : ""}.`} />
                <div className="card mt-6">
                  <ImageList images={images} loading={loading} isOwner={isOwner} onRevoke={revokeImage} />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
        Docker Blockchain Registry · Sepolia Testnet ·{" "}
        <a
          href={`https://sepolia.etherscan.io/address/${import.meta.env.VITE_CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-500 hover:text-brand-400 inline-flex items-center gap-1"
        >
          Contrat <ExternalLink className="w-3 h-3" />
        </a>
      </footer>
    </div>
  );
}

function DashboardTab({ stats, images, loading, account, isOwner }) {
  const recentImages = [...images].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

  return (
    <div className="space-y-8">
      <SectionHeader title="Dashboard" subtitle="Vue d'ensemble du registre décentralisé." />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total images" value={stats.total} color="text-slate-300" loading={loading} />
        <StatCard label="Images valides" value={stats.valid} color="text-emerald-400" loading={loading} />
        <StatCard label="Images révoquées" value={stats.revoked} color="text-red-400" loading={loading} />
      </div>

      {/* Account Info */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Informations wallet</h3>
        <InfoRow label="Adresse" value={account} mono />
        <InfoRow label="Rôle" value={isOwner ? "Owner (peut écrire)" : "Lecteur (peut vérifier)"} />
        <InfoRow label="Réseau" value="Ethereum Sepolia Testnet" />
        <InfoRow label="Contrat" value={import.meta.env.VITE_CONTRACT_ADDRESS} mono />
      </div>

      {/* Recent Images */}
      {recentImages.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Dernières images enregistrées</h3>
          <div className="space-y-2">
            {recentImages.map((img) => (
              <div key={img.name} className="flex items-center justify-between gap-4 py-2 border-b border-slate-800 last:border-0">
                <span className="font-mono text-sm text-slate-300 truncate">{img.name}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-500">
                    {new Date(img.timestamp * 1000).toLocaleDateString("fr-FR")}
                  </span>
                  {img.revoked ? (
                    <span className="badge-revoked">Révoquée</span>
                  ) : (
                    <span className="badge-valid">Valide</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-100">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function StatCard({ label, value, color, loading }) {
  return (
    <div className="card text-center">
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      {loading ? (
        <div className="h-8 bg-slate-800 rounded animate-pulse mx-auto w-12" />
      ) : (
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-500 shrink-0 w-24">{label}</span>
      <span className={`text-xs text-slate-300 break-all text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function LandingScreen({ onConnect, connecting }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
      <div className="space-y-4">
        <div className="w-20 h-20 rounded-3xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-4xl mx-auto">
          🐳
        </div>
        <h2 className="text-3xl font-bold text-slate-100">Docker Blockchain Registry</h2>
        <p className="text-slate-400 max-w-md text-sm leading-relaxed">
          Registre décentralisé pour ancrer et vérifier l'intégrité des images Docker sur Ethereum.
          Chaque hash SHA256 est stocké de façon immuable on-chain.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
        {[
          { icon: "🔒", title: "Immuable",   desc: "Hash stocké on-chain, impossible à falsifier" },
          { icon: "🔍", title: "Vérifiable", desc: "Toute image peut être vérifiée en quelques secondes" },
          { icon: "🤖", title: "CI/CD Ready",desc: "Intégration GitHub Actions pour bloquer les déploiements" },
        ].map((f) => (
          <div key={f.title} className="card text-left">
            <span className="text-2xl">{f.icon}</span>
            <p className="font-semibold text-slate-200 mt-2 text-sm">{f.title}</p>
            <p className="text-xs text-slate-500 mt-1">{f.desc}</p>
          </div>
        ))}
      </div>

      <button onClick={onConnect} disabled={connecting} className="btn-primary text-base px-8 py-3">
        <Wallet className="w-5 h-5" />
        {connecting ? "Connexion en cours…" : "Connecter MetaMask"}
      </button>
    </div>
  );
}
