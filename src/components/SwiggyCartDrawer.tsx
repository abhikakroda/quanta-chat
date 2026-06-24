import { useEffect, useState } from "react";
import { ShoppingBag, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSwiggyCart, clearSwiggyCart } from "@/hooks/useSwiggyCart";

const SWIGGY_ORANGE = "#FC8019";

export function SwiggyCartButton({ onClick }: { onClick: () => void }) {
  const cart = useSwiggyCart();
  const count = cart?.lines.reduce((n, l) => n + (parseInt(l.qty) || 1), 0) || 0;
  if (!cart || count === 0) return null;
  return (
    <button
      onClick={onClick}
      aria-label={`Open cart, ${count} items`}
      className="relative shrink-0 p-1.5 rounded-md hover:bg-accent transition-colors touch-manipulation"
    >
      <ShoppingBag className="w-4 h-4" style={{ color: SWIGGY_ORANGE }} />
      <span
        className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
        style={{ background: SWIGGY_ORANGE }}
      >
        {count}
      </span>
    </button>
  );
}

export default function SwiggyCartDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const cart = useSwiggyCart();
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    else {
      const t = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!mounted) return null;

  const total = cart?.totals.find((t) => /total/i.test(t.label) && !/sub/i.test(t.label));
  const itemCount = cart?.lines.reduce((n, l) => n + (parseInt(l.qty) || 1), 0) || 0;

  return (
    <div
      className="fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-label="Cart"
    >
      {/* Backdrop */}
      <button
        aria-label="Close cart"
        onClick={() => onOpenChange(false)}
        className={cn(
          "absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Sheet */}
      <div
        className={cn(
          "absolute left-0 right-0 bottom-0 mx-auto max-w-[640px] bg-card border-t border-x border-border/60 rounded-t-3xl shadow-2xl flex flex-col max-h-[85dvh] transition-transform duration-200 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* Grab handle */}
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="px-4 sm:px-5 pt-1 pb-3 flex items-center gap-3 border-b border-border/40">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: SWIGGY_ORANGE }}
          >
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              Your Swiggy cart
            </div>
            <div className="text-sm font-semibold truncate">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
              {total && <span className="text-muted-foreground font-normal"> · {total.value}</span>}
            </div>
          </div>
          {cart && (
            <button
              onClick={() => clearSwiggyCart()}
              aria-label="Clear cart"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation"
              title="Clear cart"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close cart"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
          {!cart ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Your cart is empty. Ask the chat to add items from any restaurant.
            </div>
          ) : (
            <>
              {cart.lines.length > 0 && (
                <ul className="divide-y divide-border/30">
                  {cart.lines.map((l, i) => (
                    <li key={i} className="flex items-center gap-3 py-2.5 text-[14px]">
                      <span
                        className="shrink-0 min-w-[28px] text-center px-1.5 py-0.5 rounded-md text-[11px] font-bold"
                        style={{ background: `${SWIGGY_ORANGE}1A`, color: SWIGGY_ORANGE }}
                      >
                        {l.qty}×
                      </span>
                      <span className="flex-1 text-foreground break-words">{l.name}</span>
                      <span className="shrink-0 font-medium text-foreground tabular-nums">{l.price}</span>
                    </li>
                  ))}
                </ul>
              )}
              {cart.totals.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
                  {cart.totals.map((t, i) => {
                    const isGrand = /^(grand\s*)?total$/i.test(t.label);
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex justify-between",
                          isGrand
                            ? "font-bold text-foreground text-[16px] pt-1.5 border-t border-border/40"
                            : "text-[13px] text-muted-foreground",
                        )}
                      >
                        <span className="capitalize">{t.label}</span>
                        <span className="tabular-nums">{t.value}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer CTA */}
        {cart && (
          <div className="px-4 sm:px-5 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] border-t border-border/40">
            <button
              onClick={() => onOpenChange(false)}
              className="w-full h-11 rounded-xl text-white font-semibold text-sm flex items-center justify-between px-4 transition-opacity hover:opacity-90"
              style={{ background: SWIGGY_ORANGE }}
            >
              <span>Continue in chat</span>
              <span className="tabular-nums">{total?.value || ""}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}