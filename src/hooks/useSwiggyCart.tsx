import { useEffect, useState } from "react";

export type CartLine = { qty: string; name: string; price: string };
export type CartTotal = { label: string; value: string };
export type CartSnapshot = {
  raw: string;
  lines: CartLine[];
  totals: CartTotal[];
  updatedAt: number;
};

let current: CartSnapshot | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function looksLikeSwiggyCart(text: string): boolean {
  if (!text) return false;
  const hasRupee = /₹\s?\d/.test(text);
  const hasTotal = /\btotal\b/i.test(text);
  const hasCartCue = /(subtotal|delivery\s*fee|gst|cart|qty)/i.test(text);
  return hasRupee && hasTotal && hasCartCue;
}

export function parseCart(raw: string): { lines: CartLine[]; totals: CartTotal[] } {
  const lines: CartLine[] = [];
  const totals: CartTotal[] = [];
  const rows = raw.split("\n").map((r) => r.trim()).filter(Boolean);
  const totalKeys = /^(sub\s*total|subtotal|delivery|gst|tax|discount|total|grand\s*total)\b/i;
  for (const row of rows) {
    if (/^[-=|+]+$/.test(row)) continue;
    const cleaned = row.replace(/^\|+|\|+$/g, "").trim();
    const m = cleaned.match(/(₹\s?[\d,]+(?:\.\d+)?)/);
    if (!m) continue;
    const price = m[1].replace(/\s+/g, "");
    const before = cleaned.slice(0, m.index).replace(/\|/g, " ").trim();
    if (totalKeys.test(before)) {
      totals.push({ label: before.replace(/[:|]+$/, "").trim(), value: price });
      continue;
    }
    const qty = before.match(/^(\d+)\s*[x×*]?\s+(.*)$/i);
    if (qty) lines.push({ qty: qty[1], name: qty[2].replace(/\|/g, " ").trim(), price });
    else if (before) lines.push({ qty: "1", name: before, price });
  }
  return { lines, totals };
}

export function pushSwiggyCart(raw: string) {
  if (!looksLikeSwiggyCart(raw)) return;
  const { lines, totals } = parseCart(raw);
  if (lines.length === 0 && totals.length === 0) return;
  current = { raw, lines, totals, updatedAt: Date.now() };
  emit();
}

export function clearSwiggyCart() {
  current = null;
  emit();
}

export function useSwiggyCart() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return current;
}