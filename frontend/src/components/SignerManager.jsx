import { useState } from "react";
import { UserPlus, UserMinus, ShieldCheck, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

export function SignerManager({ signers, isOwner, onAdd, onRemove }) {
  const [newSigner, setNewSigner] = useState("");
  const [busy, setBusy] = useState(false);

  const validAddress = /^0x[0-9a-fA-F]{40}$/.test(newSigner.trim());

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!validAddress) return;
    setBusy(true);
    try {
      await onAdd(newSigner.trim());
      toast.success(`Signataire ajouté : ${newSigner.slice(0, 10)}…`);
      setNewSigner("");
    } catch (err) {
      toast.error(err.reason ?? err.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (address) => {
    if (!window.confirm(`Retirer ce signataire ?\n${address}`)) return;
    try {
      await onRemove(address);
      toast.success("Signataire retiré");
    } catch (err) {
      toast.error(err.reason ?? err.message ?? "Erreur");
    }
  };

  return (
    <div className="space-y-6">
      {/* Liste des signataires actifs */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Signataires de confiance ({signers.length})
        </h3>

        {signers.length === 0 ? (
          <p className="text-xs text-slate-600 italic">Aucun signataire configuré — seul le mode owner direct est actif.</p>
        ) : (
          <div className="space-y-2">
            {signers.map((addr) => (
              <div key={addr} className="flex items-center justify-between gap-3 bg-slate-800 rounded-xl px-4 py-2.5 border border-slate-700">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full shrink-0 animate-pulse-slow" />
                  <span className="font-mono text-xs text-slate-300 truncate">{addr}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`https://sepolia.etherscan.io/address/${addr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-brand-400 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {isOwner && (
                    <button
                      onClick={() => handleRemove(addr)}
                      className="text-red-500 hover:text-red-400 transition-colors"
                      title="Retirer ce signataire"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ajouter un signataire (owner only) */}
      {isOwner && (
        <form onSubmit={handleAdd} className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Ajouter un signataire CI/CD</h3>
          <p className="text-xs text-slate-500">
            Le signataire peut enregistrer des images off-chain sans accès direct au contrat.
          </p>
          <div className="flex gap-2">
            <input
              className="input flex-1 font-mono"
              placeholder="0x adresse du CI signer..."
              value={newSigner}
              onChange={(e) => setNewSigner(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              disabled={!validAddress || busy}
              className="btn-primary shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              {busy ? "…" : "Ajouter"}
            </button>
          </div>
          {newSigner && !validAddress && (
            <p className="text-xs text-red-400">Adresse Ethereum invalide</p>
          )}
        </form>
      )}
    </div>
  );
}
