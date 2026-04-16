import { useState } from "react";
import {
  Wallet, RefreshCw, LayoutDashboard, PlusCircle,
  ShieldCheck, List, AlertTriangle, ExternalLink, Boxes,
  Lock, Eye, Globe, KeyRound, ShieldAlert, CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useContract }    from "./hooks/useContract.js";
import { ImageList }      from "./components/ImageList.jsx";
import { RegisterForm }   from "./components/RegisterForm.jsx";
import { VerifyForm }     from "./components/VerifyForm.jsx";
import { SignerManager }  from "./components/SignerManager.jsx";

const TABS = [
  { id: "dashboard", label: "Dashboard",   icon: LayoutDashboard },
  { id: "register",  label: "Enregistrer", icon: PlusCircle      },
  { id: "verify",    label: "Vérifier",    icon: ShieldCheck      },
  { id: "list",      label: "Images",      icon: List             },
  { id: "signers",   label: "Signataires", icon: KeyRound         },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const {
    account, isOwner, chainOk, connecting,
    images, signers, loading,
    connect, fetchImages,
    registerImage, addSigner, removeSigner, revokeImage, verifyImage,
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
              <p className="text-xs text-slate-500 leading-none mt-0.5">Décentralisé · Sepolia</p>
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
                {isOwner ? (
                  <span className="badge-valid text-xs">
                    <KeyRound className="w-3 h-3" /> Owner · Contrôle total
                  </span>
                ) : (
                  <span className="badge-pending text-xs">
                    <Eye className="w-3 h-3" /> Lecture seule
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

      {/* Decentralized Banner */}
      {account && (
        <div className="bg-brand-900/30 border-b border-brand-800/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-6 overflow-x-auto">
            <span className="flex items-center gap-1.5 text-xs text-brand-300 whitespace-nowrap">
              <Globe className="w-3.5 h-3.5" /> Application décentralisée sur Ethereum
            </span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5" /> Données immuables on-chain
            </span>
            <span className="flex items-center gap-1.5 text-xs text-amber-400 whitespace-nowrap">
              <Lock className="w-3.5 h-3.5" /> Contrôle réservé au owner
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
              <Eye className="w-3.5 h-3.5" /> Révocations publiques et transparentes
            </span>
          </div>
        </div>
      )}

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
                <SectionHeader
                  title="Enregistrer une image"
                  subtitle="Ancrez le hash SHA256 d'une image Docker sur la blockchain Sepolia."
                />
                {/* Access Control Notice */}
                <div className="mt-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">
                    <span className="font-semibold">Contrôle d'accès :</span> seul le owner du contrat peut enregistrer des images.
                    Cette restriction est imposée par le smart contract via le modifier <code className="bg-amber-500/10 px-1 rounded">onlyOwner</code>.
                  </p>
                </div>
                {isOwner ? (
                  <div className="card mt-4">
                    <RegisterForm onRegister={registerImage} />
                  </div>
                ) : (
                  <div className="card mt-4 flex items-center gap-3 text-red-400">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">Accès refusé</p>
                      <p className="text-xs text-slate-500 mt-0.5">Votre adresse n'est pas le owner du contrat.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {tab === "verify" && (
              <div className="max-w-xl">
                <SectionHeader title="Vérifier l'intégrité" subtitle="Comparez le hash local d'une image avec l'enregistrement on-chain." />
                <div className="mt-4 flex items-start gap-3 bg-brand-500/10 border border-brand-500/20 rounded-xl px-4 py-3">
                  <Eye className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-brand-300">
                    <span className="font-semibold">Vérification publique :</span> toute adresse peut vérifier l'intégrité d'une image.
                    La vérification est gratuite (lecture seule, pas de gas requis).
                  </p>
                </div>
                <div className="card mt-4">
                  <VerifyForm onVerify={verifyImage} />
                </div>
              </div>
            )}
            {tab === "list" && (
              <div>
                <SectionHeader
                  title="Images enregistrées"
                  subtitle={`${stats.total} image${stats.total > 1 ? "s" : ""} au total — ${stats.valid} valide${stats.valid > 1 ? "s" : ""}, ${stats.revoked} révoquée${stats.revoked > 1 ? "s" : ""}.`}
                />
                <div className="mt-4 flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                  <Eye className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-300">
                    <span className="font-semibold">Transparence totale :</span> toutes les révocations sont enregistrées on-chain via <code className="bg-emerald-500/10 px-1 rounded">ImageRevoked</code>. Seul le owner peut révoquer.
                  </p>
                </div>
                <div className="card mt-4">
                  <ImageList images={images} loading={loading} isOwner={isOwner} onRevoke={revokeImage} />
                </div>
              </div>
            )}
            {tab === "signers" && (
              <div className="max-w-xl">
                <SectionHeader
                  title="Signataires ECDSA"
                  subtitle="Gestion des adresses autorisées à signer off-chain (CI/CD pipelines)."
                />
                <div className="mt-4 flex items-start gap-3 bg-brand-500/10 border border-brand-500/20 rounded-xl px-4 py-3">
                  <KeyRound className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-brand-300">
                    <span className="font-semibold">Signature-based attestation :</span> le CI signe <code className="bg-brand-500/10 px-1 rounded">keccak256(imageName, imageHash, version, contractAddress)</code> off-chain.
                    N'importe qui peut soumettre la transaction — seule la signature d'un signer de confiance est acceptée.
                  </p>
                </div>
                <div className="card mt-4">
                  <SignerManager signers={signers} isOwner={isOwner} onAdd={addSigner} onRemove={removeSigner} />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
        Docker Blockchain Registry · Décentralisé · Ethereum Sepolia ·{" "}
        <a
          href={`https://sepolia.etherscan.io/address/${import.meta.env.VITE_CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-500 hover:text-brand-400 inline-flex items-center gap-1"
        >
          Voir le contrat sur Etherscan <ExternalLink className="w-3 h-3" />
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

      {/* Architecture Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ArchCard
          icon={<Globe className="w-5 h-5 text-brand-400" />}
          title="Application décentralisée"
          desc="Aucun serveur central. Les données sont stockées sur la blockchain Ethereum — disponibles partout, censurables par personne."
          color="border-brand-500/20 bg-brand-500/5"
        />
        <ArchCard
          icon={<Lock className="w-5 h-5 text-amber-400" />}
          title="Contrôle owner uniquement"
          desc="Seul le owner du smart contract peut enregistrer ou révoquer des images. Le modifier onlyOwner bloque toute autre adresse au niveau du contrat."
          color="border-amber-500/20 bg-amber-500/5"
        />
        <ArchCard
          icon={<Eye className="w-5 h-5 text-emerald-400" />}
          title="Révocations transparentes"
          desc="Chaque révocation émet un événement ImageRevoked visible publiquement sur Etherscan. Personne ne peut révoquer en secret."
          color="border-emerald-500/20 bg-emerald-500/5"
        />
      </div>

      {/* Account Info */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Informations wallet</h3>
        <InfoRow label="Adresse" value={account} mono />
        <InfoRow
          label="Rôle"
          value={isOwner ? "Owner — peut enregistrer et révoquer" : "Lecteur — peut vérifier uniquement"}
          highlight={isOwner ? "green" : "amber"}
        />
        <InfoRow label="Réseau" value="Ethereum Sepolia Testnet (décentralisé)" />
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

function ArchCard({ icon, title, desc, color }) {
  return (
    <div className={`card border ${color} space-y-2`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-semibold text-slate-200 text-sm">{title}</p>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
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

function InfoRow({ label, value, mono, highlight }) {
  const color = highlight === "green"
    ? "text-emerald-400"
    : highlight === "amber"
    ? "text-amber-400"
    : "text-slate-300";
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-500 shrink-0 w-24">{label}</span>
      <span className={`text-xs break-all text-right ${mono ? "font-mono text-slate-300" : color}`}>{value}</span>
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
          Registre <strong className="text-slate-200">décentralisé</strong> pour ancrer et vérifier l'intégrité
          des images Docker sur Ethereum. Hash SHA256 immuable on-chain.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full">
        {[
          {
            icon: <Globe className="w-6 h-6 text-brand-400" />,
            title: "Décentralisé",
            desc: "Aucun serveur central. Données sur Ethereum, disponibles partout.",
          },
          {
            icon: <Lock className="w-6 h-6 text-amber-400" />,
            title: "Owner Control",
            desc: "Seul le owner peut enregistrer / révoquer. Imposé par le smart contract.",
          },
          {
            icon: <Eye className="w-6 h-6 text-emerald-400" />,
            title: "Révocations transparentes",
            desc: "Chaque révocation est publique et vérifiable sur Etherscan.",
          },
        ].map((f) => (
          <div key={f.title} className="card text-left space-y-2">
            {f.icon}
            <p className="font-semibold text-slate-200 text-sm">{f.title}</p>
            <p className="text-xs text-slate-500">{f.desc}</p>
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
