/**
 * Swiggy MCP client (real).
 *
 * Calls go through the `swiggy-mcp` edge function which owns OAuth 2.1 + PKCE,
 * Dynamic Client Registration, and the JSON-RPC tools/call transport to
 * https://mcp.swiggy.com/{food,im}. Tokens never reach the browser.
 */

import { supabase } from "@/integrations/supabase/client";

export type SwiggyItem = {
  item_id: string;
  name: string;
  price: number;
  veg: boolean;
  description?: string;
  restaurant_id: string;
};

export type SwiggyRestaurant = {
  restaurant_id: string;
  name: string;
  cuisine: string;
  rating: number;
  eta_min: number;
  cost_for_two: number;
  image?: string;
};

export type SwiggyAddress = {
  address_id: string;
  label: string;
  line1: string;
  city: string;
  pincode: string;
};

export type SwiggyCartLine = { item: SwiggyItem; quantity: number };
export type SwiggyCart = {
  restaurant_id: string | null;
  restaurant_name: string | null;
  lines: SwiggyCartLine[];
  subtotal: number;
  delivery_fee: number;
  discount: number;
  coupon: string | null;
  total: number;
};

export type SwiggyOrder = {
  order_id: string;
  restaurant_name: string;
  total: number;
  status: "CONFIRMED" | "PREPARING" | "PICKED_UP" | "DELIVERED";
  eta_min: number;
  placed_at: string;
};

// ── Tool → MCP server routing ────────────────────────────────────────────────
const FOOD_TOOLS = new Set([
  "search_restaurants", "search_menu", "get_restaurant_menu", "get_addresses",
  "update_food_cart", "get_food_cart", "flush_food_cart",
  "fetch_food_coupons", "apply_food_coupon",
  "place_food_order", "get_food_orders", "track_food_order",
]);
const INSTAMART_TOOLS = new Set([
  "search_instamart", "update_instamart_cart", "get_instamart_cart",
  "place_instamart_order", "track_instamart_order",
]);

function serverFor(tool: string): "food" | "im" {
  if (INSTAMART_TOOLS.has(tool)) return "im";
  if (FOOD_TOOLS.has(tool)) return "food";
  return "food";
}

let cachedOrders: SwiggyOrder[] = [];

function emitOrderTick() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("swiggy-order-tick"));
  }
}

function fnUrl() {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/swiggy-mcp`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export type ConnectionStatus = { server: "food" | "im"; expires_at: string; scope: string | null };

export async function getSwiggyStatus(): Promise<ConnectionStatus[]> {
  const resp = await fetch(fnUrl(), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "status" }),
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.connections ?? []) as ConnectionStatus[];
}

export async function startSwiggyConnect(server: "food" | "im"): Promise<string> {
  const resp = await fetch(fnUrl(), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "start", server }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `Connect failed (${resp.status})`);
  return data.authorize_url as string;
}

export async function disconnectSwiggy(server: "food" | "im"): Promise<void> {
  await fetch(fnUrl(), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "logout", server }),
  });
}

export class SwiggyAuthError extends Error {
  constructor(public server: "food" | "im", public reason: string) {
    super(`Swiggy ${server} needs re-authorization (${reason})`);
    this.name = "SwiggyAuthError";
  }
}

/** MCP results: { content: [{type:"text",text}], structuredContent?, isError? } */
function unwrapMcpResult(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  const r = result as Record<string, unknown>;
  if ("structuredContent" in r && r.structuredContent) return r.structuredContent;
  if (Array.isArray(r.content)) {
    const text = (r.content as Array<{ type?: string; text?: string }>)
      .filter((c) => c?.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("\n");
    if (text) {
      try { return JSON.parse(text); } catch { return { text }; }
    }
  }
  return r;
}

function rememberOrders(name: string, payload: unknown) {
  if (!payload || typeof payload !== "object") return;
  const p = payload as Record<string, unknown>;
  if (name === "get_food_orders" && Array.isArray(p.orders)) {
    cachedOrders = p.orders as SwiggyOrder[];
    emitOrderTick();
  } else if ((name === "place_food_order" || name === "track_food_order") && p.order) {
    const o = p.order as SwiggyOrder;
    const i = cachedOrders.findIndex((x) => x.order_id === o.order_id);
    if (i >= 0) cachedOrders[i] = o;
    else cachedOrders.unshift(o);
    emitOrderTick();
  }
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const server = serverFor(name);
  const resp = await fetch(fnUrl(), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "call", server, tool: name, args }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return { error: data?.error ?? `Tool failed (${resp.status})` };
  if (data.needs_reauth) throw new SwiggyAuthError(server, String(data.reason ?? "unknown"));
  if (data.error) return { error: data.error };
  const payload = unwrapMcpResult(data.result);
  rememberOrders(name, payload);
  return payload;
}

export function getActiveOrders(): SwiggyOrder[] {
  return [...cachedOrders];
}

export function resetSwiggyState() {
  cachedOrders = [];
  emitOrderTick();
}