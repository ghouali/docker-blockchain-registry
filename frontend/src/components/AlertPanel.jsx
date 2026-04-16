import { AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

const STYLES = {
  success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  error:   "bg-red-500/10 border-red-500/30 text-red-300",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  info:    "bg-brand-500/10 border-brand-500/30 text-brand-300",
};

export function AlertPanel({ alerts }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => {
        const Icon = ICONS[alert.type] ?? Info;
        return (
          <div
            key={i}
            className={`flex items-start gap-3 border rounded-xl px-4 py-3 animate-slide-in ${STYLES[alert.type] ?? STYLES.info}`}
          >
            <Icon className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              {alert.title && <p className="font-semibold text-sm">{alert.title}</p>}
              <p className="text-sm opacity-90">{alert.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
