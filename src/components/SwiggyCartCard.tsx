import { useState } from "react";
import { ChevronDown, ChevronUp, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

const SWIGGY_ORANGE = "#FC8019";

type Line = { qty: string; name: string; price: string };

function parseCart(raw: string): { lines: Line[]; totals: { label: string; value: string }[] } {
  const lines: Line[] = [];
  const totals: { label: string; value: string }[] = [];
  const rows = raw.split("\n").map((r) => r.trim()).filter(Boolean);
  const totalKeys = /^(sub\s*total|subtotal|delivery|gst|tax|discount|total|grand\s*total)\b/i;
  for (const row of rows) {
    // Skip table separators / headers
    if (/^[-=|+]+$/.test(row)) continue;
    const cleaned = row.replace(/^\|+|\|+$/g, "").trim();
    const priceMatch = cleaned.match(/(₹\s?[\d,]+(?:\.\d+)?)/);
    if (!priceMatch) continue;
    const price = priceMatch[1].replace(/\s+/g, "");
    const before = cleaned.slice(0, priceMatch.index).replace(/\|/g, " ").trim();
    if (totalKeys.test(before)) {
      totals.push({ label: before.replace(/[:|]+$/, "").trim(), value: price });
      continue;
    }
    // item line: try qty x name
    const qtyMatch = before.match(/^(\d+)\s*[x×*]?\s+(.*)$/i);
    if (qtyMatch) {
      lines.push({ qty: qtyMatch[1], name: qtyMatch[2].replace(/\|/g, " ").trim(), price });
    } else if (before) {
      lines.push({ qty: "1", name: before, price });
    }
  }
  return { lines, totals };
}

export default function SwiggyCartCard({ raw }: { raw: string }) {
  const [open, setOpen] = useState(true);
  const { lines, totals } = parseCart(raw);
  const total = totals.find((t) => /total/i.test(t.label) && !/sub/i.test(t.label));
  const itemCount = lines.reduce((n, l) => n + (parseInt(l.qty) || 1), 0);

  if (lines.length === 0 && totals.length === 0) return null;

  return (
    <div
      className="my-3 rounded-2xl border overflow-hidden bg-card/50"
      style={{ borderColor: `${SWIGGY_ORANGE}40` }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-muted/30 transition-colors touch-manipulation"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white"
          style={{ background: SWIGGY_ORANGE }}
        >
          <ShoppingBag className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Your cart
          </div>
          <div className="text-sm font-semibold truncate">
            {itemCount} item{itemCount !== 1 ? "s" : ""}
            {total && <span className="text-muted-foreground font-normal"> · {total.value}</span>}
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-3 sm:px-4 pb-3 pt-1 border-t border-border/40">
          {lines.length > 0 && (
            <ul className="divide-y divide-border/30">
              {lines.map((l, i) => (
                <li key={i} className="flex items-center gap-2 py-2 text-[13px] sm:text-sm">
                  <span
                    className="shrink-0 min-w-[26px] text-center px-1.5 py-0.5 rounded-md text-[11px] font-bold"
                    style={{ background: `${SWIGGY_ORANGE}1A`, color: SWIGGY_ORANGE }}
                  >
                    {l.qty}×
                  </span>
                  <span className="flex-1 truncate text-foreground">{l.name}</span>
                  <span className="shrink-0 font-medium text-foreground tabular-nums">{l.price}</span>
                </li>
              ))}
            </ul>
          )}
          {totals.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
              {totals.map((t, i) => {
                const isGrand = /^(grand\s*)?total$/i.test(t.label);
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex justify-between text-[13px]",
                      isGrand ? "font-bold text-foreground text-[15px] pt-1" : "text-muted-foreground",
                    )}
                  >
                    <span className="capitalize">{t.label}</span>
                    <span className="tabular-nums">{t.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}