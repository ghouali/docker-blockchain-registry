import { useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldOff, Search } from "lucide-react";
import { AlertPanel } from "./AlertPanel.jsx";

const IDLE = "idle";

export function VerifyForm({ onVerify }) {
  const [name, setName]     = useState("");
  const [hash, setHash]     = useState("");
  const [busy, setBusy]     = useState(false);
  const [result, setResult] = useState(IDLE);

  const valid =
    name.trim().length > 0 &&
    /^[0-9a-fA-F]{64}$/.test(hash.trim().replace(/^0x/, ""));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setResult(IDLE);
    try {
      const ok = await onVerify(name.trim(), hash.trim().replace(/^0x/, ""));
      setResult(ok ? "valid" : "tampered");
    } catch (err) {
      if (err.message?.includes("not found")) setResult("notfound");
      else setResult("error");
    } finally {
      setBusy(false);
    }
  };

  const alerts = {
    valid: [{ type: "success", title: "Intégrité confirmée", message: `"${name}" correspond au hash enregistré on-chain.` }],
    tampered: [{ type: "error", title: "ALERTE : Image falsifiée", message: `Le hash de "${name}" ne correspond pas à l'enregistrement blockchain. Déploiement bloqué.` }],
    notfound: [{ type: "warning", title: "Image non trouvée", message: `"${name}" n'est pas enregistrée on-chain.` }],
    error: [{ type: "error", title: "Erreur", message: "La vérification a échoué. Vérifiez votre connexion." }],
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 font-medium mb-1.5 block">Nom de l'image</label>
          <input
            className="input"
            placeholder="myapp:v1.2.3"
            value={name}
            onChange={(e) => { setName(e.target.value); setResult(IDLE); }}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium mb-1.5 block">Hash SHA256 local</label>
          <input
            className="input font-mono"
            placeholder="Hash recalculé localement…"
            value={hash}
            onChange={(e) => { setHash(e.target.value); setResult(IDLE); }}
            disabled={busy}
          />
        </div>

        <button type="submit" disabled={!valid || busy} className="btn-primary w-full justify-center">
          <Search className="w-4 h-4" />
          {busy ? "Vérification…" : "Vérifier l'intégrité"}
        </button>
      </form>

      {result !== IDLE && (
        <div className="animate-slide-in">
          <AlertPanel alerts={alerts[result] ?? []} />
        </div>
      )}

      <ResultIcon result={result} />
    </div>
  );
}

function ResultIcon({ result }) {
  if (result === "valid")
    return (
      <div className="flex flex-col items-center py-4 animate-slide-in">
        <ShieldCheck className="w-14 h-14 text-emerald-400 drop-shadow-lg" />
        <p className="text-emerald-300 font-semibold mt-2 text-sm">VALID</p>
      </div>
    );
  if (result === "tampered")
    return (
      <div className="flex flex-col items-center py-4 animate-slide-in">
        <ShieldAlert className="w-14 h-14 text-red-400 animate-pulse drop-shadow-lg" />
        <p className="text-red-300 font-semibold mt-2 text-sm">TAMPERED</p>
      </div>
    );
  if (result === "notfound")
    return (
      <div className="flex flex-col items-center py-4 animate-slide-in">
        <ShieldOff className="w-14 h-14 text-amber-400 drop-shadow-lg" />
        <p className="text-amber-300 font-semibold mt-2 text-sm">NOT FOUND</p>
      </div>
    );
  return null;
}
