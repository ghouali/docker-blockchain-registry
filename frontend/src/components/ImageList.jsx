import { useState } from "react";
import { Package, Trash2, ChevronDown, ChevronUp, Copy, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { ImageStatus } from "./ImageStatus.jsx";

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  toast.success("Copié !");
}

function shortHash(h) {
  return h ? `${h.slice(0, 10)}…${h.slice(-8)}` : "—";
}

function ImageRow({ image, isOwner, onRevoke }) {
  const [expanded, setExpanded] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = async () => {
    if (!window.confirm(`Révoquer "${image.name}" ? Cette action est irréversible.`)) return;
    setRevoking(true);
    try {
      await onRevoke(image.name);
      toast.success(`"${image.name}" révoquée avec succès`);
    } catch (e) {
      toast.error(e.reason ?? e.message ?? "Erreur lors de la révocation");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-800/50 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Package className="w-4 h-4 text-brand-400 shrink-0" />
          <span className="font-mono text-sm text-slate-200 truncate">{image.name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ImageStatus revoked={image.revoked} exists={image.exists} />
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-3 animate-slide-in">
          <DetailRow label="Hash SHA256" value={image.hash}>
            <button onClick={() => copyToClipboard(image.hash)} className="text-slate-500 hover:text-brand-400 transition-colors">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </DetailRow>
          <DetailRow label="Enregistré par" value={image.registeredBy}>
            <a
              href={`https://sepolia.etherscan.io/address/${image.registeredBy}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-brand-400 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </DetailRow>
          <DetailRow
            label="Date"
            value={new Date(image.timestamp * 1000).toLocaleString("fr-FR", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          />

          {isOwner && !image.revoked && (
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="mt-2 flex items-center gap-2 text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors border border-red-500/20 hover:border-red-500/40 rounded-lg px-3 py-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {revoking ? "Révocation…" : "Révoquer cette image"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, children }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-500 shrink-0 w-32">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-xs text-slate-300 break-all">{value}</span>
        {children}
      </div>
    </div>
  );
}

export function ImageList({ images, loading, isOwner, onRevoke }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = images.filter((img) => {
    const matchSearch = img.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "valid"   && !img.revoked) ||
      (filter === "revoked" && img.revoked);
    return matchSearch && matchFilter;
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          className="input flex-1"
          placeholder="Rechercher une image…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          {["all", "valid", "revoked"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-brand-600 text-white"
                  : "text-slate-400 hover:text-slate-200 border border-slate-700"
              }`}
            >
              {f === "all" ? "Toutes" : f === "valid" ? "Valides" : "Révoquées"}
              <span className="ml-1.5 opacity-60">
                {f === "all"
                  ? images.length
                  : images.filter((i) => f === "valid" ? !i.revoked : i.revoked).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-600">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune image trouvée</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((img) => (
            <ImageRow key={img.name} image={img} isOwner={isOwner} onRevoke={onRevoke} />
          ))}
        </div>
      )}
    </div>
  );
}
