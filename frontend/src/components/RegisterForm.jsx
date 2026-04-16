import { useState } from "react";
import { PlusCircle, Hash, Tag } from "lucide-react";
import toast from "react-hot-toast";

export function RegisterForm({ onRegister }) {
  const [name, setName]   = useState("");
  const [hash, setHash]   = useState("");
  const [busy, setBusy]   = useState(false);

  const valid =
    name.trim().length > 0 &&
    /^[0-9a-fA-F]{64}$/.test(hash.trim().replace(/^0x/, ""));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const receipt = await onRegister(name.trim(), hash.trim().replace(/^0x/, ""));
      toast.success(`Image enregistrée ! Bloc #${receipt.blockNumber}`);
      setName("");
      setHash("");
    } catch (err) {
      toast.error(err.reason ?? err.message ?? "Transaction échouée");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-slate-400 font-medium mb-1.5 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" /> Nom de l'image
        </label>
        <input
          className="input"
          placeholder="myapp:v1.2.3"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
      </div>

      <div>
        <label className="text-xs text-slate-400 font-medium mb-1.5 flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5" /> Hash SHA256 (64 hex chars)
        </label>
        <input
          className="input font-mono"
          placeholder="a3f8b2c1d4e5… ou 0xa3f8b2c1…"
          value={hash}
          onChange={(e) => setHash(e.target.value)}
          disabled={busy}
        />
        {hash && !valid && name && (
          <p className="text-xs text-red-400 mt-1">
            Format invalide — 64 caractères hexadécimaux requis
          </p>
        )}
      </div>

      <button type="submit" disabled={!valid || busy} className="btn-primary w-full justify-center">
        <PlusCircle className="w-4 h-4" />
        {busy ? "Envoi en cours…" : "Enregistrer on-chain"}
      </button>
    </form>
  );
}
