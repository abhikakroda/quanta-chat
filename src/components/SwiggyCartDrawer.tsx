import { useEffect, useRef, useState } from "react";
import {
  ShoppingBag,
  X,
  Trash2,
  ArrowLeft,
  ChevronRight,
  Smartphone,
  CreditCard,
  Wallet,
  Banknote,
  Check,
  Loader2,
  CheckCircle2,
  MapPin,
  Clock,
  ShieldCheck,
} from "lucide-react";
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
  const [step, setStep] = useState<"cart" | "pay" | "processing" | "done">("cart");
  const [method, setMethod] = useState<PayMethodId>("upi");
  const [order, setOrder] = useState<{ id: string; eta: number; partner: string; otp: string } | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""]);
  const [otpStatus, setOtpStatus] = useState<"idle" | "verifying" | "verified" | "wrong">("idle");

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

  // Reset to cart step when reopened (unless an order just finished and is still in view)
  useEffect(() => {
    if (open && step !== "done") setStep("cart");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;

  const total = cart?.totals.find((t) => /total/i.test(t.label) && !/sub/i.test(t.label));
  const itemCount = cart?.lines.reduce((n, l) => n + (parseInt(l.qty) || 1), 0) || 0;
  const totalValue = total?.value || "";

  const startProcessing = () => {
    setStep("processing");
    setTimeout(() => {
      const id =
        "SW" +
        Math.random().toString(36).slice(2, 6).toUpperCase() +
        Math.floor(Math.random() * 90 + 10);
      const partners = ["Rohit S.", "Anil K.", "Priya M.", "Vikram T.", "Suresh P."];
      setOrder({
        id,
        eta: 25 + Math.floor(Math.random() * 20),
        partner: partners[Math.floor(Math.random() * partners.length)],
        otp: String(Math.floor(1000 + Math.random() * 9000)),
      });
      setStep("done");
    }, 1600);
  };

  const closeAndReset = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("cart");
      setOrder(null);
      setOtpDigits(["", "", "", ""]);
      setOtpStatus("idle");
      if (step === "done") clearSwiggyCart();
    }, 250);
  };

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
        onClick={closeAndReset}
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
          {(step === "pay" || step === "processing") && (
            <button
              onClick={() => step === "pay" && setStep("cart")}
              aria-label="Back to cart"
              disabled={step === "processing"}
              className="p-1.5 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: SWIGGY_ORANGE }}
          >
            {step === "done" ? <CheckCircle2 className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              {step === "cart" && "Your Swiggy cart"}
              {step === "pay" && "Choose payment"}
              {step === "processing" && "Processing payment"}
              {step === "done" && "Order confirmed"}
            </div>
            <div className="text-sm font-semibold truncate">
              {step === "done" && order
                ? `#${order.id} · ${totalValue}`
                : `${itemCount} item${itemCount !== 1 ? "s" : ""}${totalValue ? ` · ${totalValue}` : ""}`}
            </div>
          </div>
          {cart && step === "cart" && (
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
            onClick={closeAndReset}
            aria-label="Close cart"
            disabled={step === "processing"}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
          {step === "cart" && !cart && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Your cart is empty. Ask the chat to add items from any restaurant.
            </div>
          )}

          {step === "cart" && cart && (
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

          {step === "pay" && (
            <PaymentStep method={method} onSelect={setMethod} total={totalValue} />
          )}

          {step === "processing" && (
            <div className="py-14 flex flex-col items-center justify-center gap-4 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white"
                style={{ background: SWIGGY_ORANGE }}
              >
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Processing your payment</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Charging {totalValue} via {PAY_METHODS.find((m) => m.id === method)?.label}…
                </div>
              </div>
            </div>
          )}

          {step === "done" && order && (
            <OrderConfirmation
              order={order}
              method={method}
              total={totalValue}
              otpDigits={otpDigits}
              onOtpChange={setOtpDigits}
              otpStatus={otpStatus}
              onVerify={() => {
                setOtpStatus("verifying");
                setTimeout(() => {
                  const entered = otpDigits.join("");
                  if (entered === order.otp) {
                    setOtpStatus("verified");
                  } else {
                    setOtpStatus("wrong");
                    setOtpDigits(["", "", "", ""]);
                  }
                }, 900);
              }}
            />
          )}
        </div>

        {/* Footer CTA */}
        {step === "cart" && cart && (
          <div className="px-4 sm:px-5 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] border-t border-border/40">
            <button
              onClick={() => setStep("pay")}
              className="w-full h-11 rounded-xl text-white font-semibold text-sm flex items-center justify-between px-4 transition-opacity hover:opacity-90"
              style={{ background: SWIGGY_ORANGE }}
            >
              <span>Proceed to pay</span>
              <span className="flex items-center gap-1 tabular-nums">
                {totalValue} <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          </div>
        )}

        {step === "pay" && (
          <div className="px-4 sm:px-5 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] border-t border-border/40">
            <button
              onClick={startProcessing}
              className="w-full h-11 rounded-xl text-white font-semibold text-sm flex items-center justify-between px-4 transition-opacity hover:opacity-90"
              style={{ background: SWIGGY_ORANGE }}
            >
              <span>Pay {totalValue}</span>
              <span className="text-xs opacity-80">
                {PAY_METHODS.find((m) => m.id === method)?.label}
              </span>
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="px-4 sm:px-5 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] border-t border-border/40">
            {otpStatus === "verified" ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={closeAndReset}
                  className="h-11 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-muted/50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => onOpenChange(false)}
                  className="h-11 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
                  style={{ background: SWIGGY_ORANGE }}
                >
                  Track order
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setOtpStatus("verifying");
                  setTimeout(() => {
                    const entered = otpDigits.join("");
                    if (entered === order?.otp) {
                      setOtpStatus("verified");
                    } else {
                      setOtpStatus("wrong");
                      setOtpDigits(["", "", "", ""]);
                    }
                  }, 900);
                }}
                disabled={otpDigits.some((d) => !d) || otpStatus === "verifying"}
                className="w-full h-11 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: SWIGGY_ORANGE }}
              >
                {otpStatus === "verifying" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" /> Verify OTP
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────── Payment step ───────────────────────────── */

type PayMethodId = "upi" | "card" | "wallet" | "cod";

const PAY_METHODS: {
  id: PayMethodId;
  label: string;
  sub: string;
  Icon: typeof Smartphone;
  badge?: string;
}[] = [
  { id: "upi", label: "UPI", sub: "GPay · PhonePe · Paytm", Icon: Smartphone, badge: "Recommended" },
  { id: "card", label: "Credit / Debit card", sub: "Visa, Mastercard, RuPay", Icon: CreditCard },
  { id: "wallet", label: "Swiggy Money", sub: "Balance ₹248.00", Icon: Wallet },
  { id: "cod", label: "Cash on delivery", sub: "Pay when it arrives", Icon: Banknote },
];

function PaymentStep({
  method,
  onSelect,
  total,
}: {
  method: PayMethodId;
  onSelect: (id: PayMethodId) => void;
  total: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border/40">
        <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: SWIGGY_ORANGE }} />
        <div className="flex-1 text-[13px]">
          <div className="font-semibold text-foreground">Deliver to: Home</div>
          <div className="text-muted-foreground">Koramangala 5th Block, Bangalore · 560095</div>
        </div>
        <button className="text-[12px] font-semibold" style={{ color: SWIGGY_ORANGE }}>
          Change
        </button>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          Payment method
        </div>
        <div className="space-y-2">
          {PAY_METHODS.map((m) => {
            const active = method === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors touch-manipulation",
                  active
                    ? "border-transparent ring-2"
                    : "border-border/60 hover:bg-muted/40",
                )}
                style={active ? { boxShadow: `inset 0 0 0 2px ${SWIGGY_ORANGE}` } : undefined}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                    active ? "text-white" : "bg-muted text-muted-foreground",
                  )}
                  style={active ? { background: SWIGGY_ORANGE } : undefined}
                >
                  <m.Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">{m.label}</span>
                    {m.badge && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: `${SWIGGY_ORANGE}1A`, color: SWIGGY_ORANGE }}
                      >
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-muted-foreground truncate">{m.sub}</div>
                </div>
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    active ? "border-transparent text-white" : "border-border",
                  )}
                  style={active ? { background: SWIGGY_ORANGE } : undefined}
                >
                  {active && <Check className="w-3 h-3" strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground text-center pt-1">
        Demo checkout · no real payment is processed · {total}
      </div>
    </div>
  );
}

/* ─────────────────────────── Order confirmation ─────────────────────────── */

function OrderConfirmation({
  order,
  method,
  total,
}: {
  order: { id: string; eta: number; partner: string; otp: string };
  method: PayMethodId;
  total: string;
}) {
  const m = PAY_METHODS.find((x) => x.id === method);
  return (
    <div className="space-y-4 py-1">
      <div className="flex flex-col items-center text-center gap-2 py-3">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white animate-in zoom-in-50 duration-300"
          style={{ background: "#16a34a" }}
        >
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <div>
          <div className="text-base font-bold text-foreground">Order placed!</div>
          <div className="text-[13px] text-muted-foreground">
            Paid {total}{method !== "cod" ? ` via ${m?.label}` : ""}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 divide-y divide-border/40">
        <Row label="Order ID" value={`#${order.id}`} mono />
        <Row
          label="Arriving in"
          value={
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" style={{ color: SWIGGY_ORANGE }} />
              <span style={{ color: SWIGGY_ORANGE }} className="font-semibold">
                ~{order.eta} min
              </span>
            </span>
          }
        />
        <Row label="Delivery partner" value={order.partner} />
        <Row label="OTP for handover" value={order.otp} mono highlight />
        <Row label="Payment" value={m?.label || ""} />
      </div>

      <div className="text-[11px] text-muted-foreground text-center">
        Demo order · nothing was actually ordered or charged.
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold text-foreground",
          mono && "font-mono tracking-wider",
          highlight && "px-2 py-0.5 rounded-md",
        )}
        style={highlight ? { background: `${SWIGGY_ORANGE}1A`, color: SWIGGY_ORANGE } : undefined}
      >
        {value}
      </span>
    </div>
  );
}