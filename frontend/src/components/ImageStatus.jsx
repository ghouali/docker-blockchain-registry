import { CheckCircle2, XCircle, Clock } from "lucide-react";

export function ImageStatus({ revoked, exists }) {
  if (!exists) {
    return (
      <span className="badge-pending">
        <Clock className="w-3 h-3" /> Inconnu
      </span>
    );
  }
  if (revoked) {
    return (
      <span className="badge-revoked">
        <XCircle className="w-3 h-3" /> Révoquée
      </span>
    );
  }
  return (
    <span className="badge-valid">
      <CheckCircle2 className="w-3 h-3" /> Valide
    </span>
  );
}
