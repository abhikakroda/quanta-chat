/**
 * Swiggy Food MCP client.
 *
 * This module currently runs against an in-memory MOCK that mimics the shape of
 * real Swiggy Food MCP responses. To go live:
 *  1. Add a Swiggy OAuth 2.1 PKCE flow and store the access token (memory only).
 *  2. Replace `callTool` body with a real POST to https://mcp.swiggy.com/food
 *     using JSON-RPC 2.0 (`tools/call`) and Bearer auth.
 *
 * The function signatures, tool names, and return shapes are stable, so the
 * agent loop and UI do NOT need to change when wiring real credentials.
 */

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

export type SwiggyCoupon = {
  code: string;
  description: string;
  flat_off?: number;
  percent_off?: number;
  min_order?: number;
};

export type SwiggyOrder = {
  order_id: string;
  restaurant_name: string;
  total: number;
  status: "CONFIRMED" | "PREPARING" | "PICKED_UP" | "DELIVERED";
  eta_min: number;
  placed_at: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Mock data (replace with real MCP responses when credentials are available).
// ────────────────────────────────────────────────────────────────────────────

const MOCK_RESTAURANTS: SwiggyRestaurant[] = [
  { restaurant_id: "r1", name: "Paradise Biryani", cuisine: "Biryani, Hyderabadi", rating: 4.4, eta_min: 32, cost_for_two: 450 },
  { restaurant_id: "r2", name: "Behrouz Biryani", cuisine: "Biryani, Mughlai", rating: 4.3, eta_min: 38, cost_for_two: 550 },
  { restaurant_id: "r3", name: "Domino's Pizza", cuisine: "Pizza, Italian", rating: 4.2, eta_min: 28, cost_for_two: 400 },
  { restaurant_id: "r4", name: "McDonald's", cuisine: "Burgers, Fast Food", rating: 4.3, eta_min: 25, cost_for_two: 350 },
  { restaurant_id: "r5", name: "Sagar Ratna", cuisine: "South Indian", rating: 4.1, eta_min: 30, cost_for_two: 300 },
  { restaurant_id: "r6", name: "Wow! Momo", cuisine: "Chinese, Tibetan", rating: 4.0, eta_min: 26, cost_for_two: 250 },
  { restaurant_id: "r7", name: "Burger King", cuisine: "Burgers, American", rating: 4.2, eta_min: 30, cost_for_two: 400 },
];

const MOCK_MENUS: Record<string, SwiggyItem[]> = {
  r1: [
    { item_id: "r1-i1", restaurant_id: "r1", name: "Chicken Dum Biryani", price: 329, veg: false, description: "Long-grain basmati with tender chicken, dum-cooked." },
    { item_id: "r1-i2", restaurant_id: "r1", name: "Veg Dum Biryani", price: 249, veg: true, description: "Aromatic veg biryani with raita." },
    { item_id: "r1-i3", restaurant_id: "r1", name: "Mutton Biryani", price: 399, veg: false },
    { item_id: "r1-i4", restaurant_id: "r1", name: "Double Ka Meetha", price: 129, veg: true },
  ],
  r2: [
    { item_id: "r2-i1", restaurant_id: "r2", name: "Royal Chicken Biryani", price: 349, veg: false },
    { item_id: "r2-i2", restaurant_id: "r2", name: "Subz Biryani", price: 279, veg: true },
    { item_id: "r2-i3", restaurant_id: "r2", name: "Phirni", price: 119, veg: true },
  ],
  r3: [
    { item_id: "r3-i1", restaurant_id: "r3", name: "Farmhouse Pizza (M)", price: 449, veg: true },
    { item_id: "r3-i2", restaurant_id: "r3", name: "Pepper Barbecue Chicken Pizza (M)", price: 469, veg: false },
    { item_id: "r3-i3", restaurant_id: "r3", name: "Garlic Breadsticks", price: 159, veg: true },
    { item_id: "r3-i4", restaurant_id: "r3", name: "Choco Lava Cake", price: 109, veg: true },
  ],
  r4: [
    { item_id: "r4-i1", restaurant_id: "r4", name: "McChicken Burger", price: 199, veg: false },
    { item_id: "r4-i2", restaurant_id: "r4", name: "McAloo Tikki Burger", price: 59, veg: true },
    { item_id: "r4-i3", restaurant_id: "r4", name: "Fries (Medium)", price: 119, veg: true },
    { item_id: "r4-i4", restaurant_id: "r4", name: "McFlurry Oreo", price: 149, veg: true },
  ],
  r5: [
    { item_id: "r5-i1", restaurant_id: "r5", name: "Masala Dosa", price: 169, veg: true },
    { item_id: "r5-i2", restaurant_id: "r5", name: "Idli Sambhar", price: 129, veg: true },
    { item_id: "r5-i3", restaurant_id: "r5", name: "Filter Coffee", price: 79, veg: true },
  ],
  r6: [
    { item_id: "r6-i1", restaurant_id: "r6", name: "Steam Veg Momo (8 pc)", price: 149, veg: true },
    { item_id: "r6-i2", restaurant_id: "r6", name: "Pan-fried Chicken Momo (8 pc)", price: 199, veg: false },
  ],
  r7: [
    { item_id: "r7-i1", restaurant_id: "r7", name: "Whopper", price: 259, veg: false },
    { item_id: "r7-i2", restaurant_id: "r7", name: "Veg Whopper", price: 199, veg: true },
  ],
};

const MOCK_ADDRESSES: SwiggyAddress[] = [
  { address_id: "a1", label: "Home", line1: "Flat 402, Skyline Apartments, MG Road", city: "Bengaluru", pincode: "560001" },
  { address_id: "a2", label: "Work", line1: "Floor 7, Innov8 HSR Layout", city: "Bengaluru", pincode: "560102" },
];

const MOCK_COUPONS: SwiggyCoupon[] = [
  { code: "TRYNEW", description: "₹100 off on orders above ₹299", flat_off: 100, min_order: 299 },
  { code: "SAVE20", description: "20% off up to ₹120", percent_off: 20 },
  { code: "WELCOME50", description: "Flat ₹50 off, no minimum", flat_off: 50 },
];

// ────────────────────────────────────────────────────────────────────────────
// In-memory state for the mock (would live on the Swiggy server in real life).
// ────────────────────────────────────────────────────────────────────────────

let cart: SwiggyCart = emptyCart();
const orders: SwiggyOrder[] = [];

function emptyCart(): SwiggyCart {
  return {
    restaurant_id: null,
    restaurant_name: null,
    lines: [],
    subtotal: 0,
    delivery_fee: 0,
    discount: 0,
    coupon: null,
    total: 0,
  };
}

function recomputeCart() {
  cart.subtotal = cart.lines.reduce((s, l) => s + l.item.price * l.quantity, 0);
  cart.delivery_fee = cart.subtotal > 0 ? (cart.subtotal >= 199 ? 0 : 35) : 0;

  if (cart.coupon) {
    const c = MOCK_COUPONS.find((x) => x.code === cart.coupon);
    if (c && (!c.min_order || cart.subtotal >= c.min_order)) {
      if (c.flat_off) cart.discount = c.flat_off;
      else if (c.percent_off) cart.discount = Math.min(Math.round((cart.subtotal * c.percent_off) / 100), 120);
    } else {
      cart.coupon = null;
      cart.discount = 0;
    }
  } else {
    cart.discount = 0;
  }
  cart.total = Math.max(0, cart.subtotal + cart.delivery_fee - cart.discount);
}

function getRestaurant(id: string) {
  return MOCK_RESTAURANTS.find((r) => r.restaurant_id === id);
}
function getItem(id: string) {
  for (const items of Object.values(MOCK_MENUS)) {
    const found = items.find((i) => i.item_id === id);
    if (found) return found;
  }
  return undefined;
}

export function getCartSnapshot(): SwiggyCart {
  return JSON.parse(JSON.stringify(cart));
}

// ────────────────────────────────────────────────────────────────────────────
// Tool dispatcher — the agent calls this for every tool_call returned by Gemini.
// ────────────────────────────────────────────────────────────────────────────

export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // Simulate slight network latency to feel real.
  await new Promise((r) => setTimeout(r, 250));

  switch (name) {
    case "search_restaurants": {
      const q = String(args.query || "").toLowerCase();
      const results = MOCK_RESTAURANTS.filter(
        (r) => r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q),
      );
      return { restaurants: results.length ? results : MOCK_RESTAURANTS.slice(0, 5) };
    }
    case "search_menu": {
      const q = String(args.query || "").toLowerCase();
      const scope = args.restaurant_id
        ? MOCK_MENUS[String(args.restaurant_id)] || []
        : Object.values(MOCK_MENUS).flat();
      const items = scope.filter((i) => i.name.toLowerCase().includes(q));
      return {
        items: items.slice(0, 8).map((i) => ({
          ...i,
          restaurant_name: getRestaurant(i.restaurant_id)?.name,
        })),
      };
    }
    case "get_restaurant_menu": {
      const id = String(args.restaurant_id);
      const restaurant = getRestaurant(id);
      if (!restaurant) return { error: "Restaurant not found" };
      return { restaurant, items: MOCK_MENUS[id] || [] };
    }
    case "get_addresses": {
      return { addresses: MOCK_ADDRESSES };
    }
    case "update_food_cart": {
      const item = getItem(String(args.item_id));
      const qty = Number(args.quantity ?? 0);
      const rid = String(args.restaurant_id);
      if (!item) return { error: "Item not found" };

      if (cart.restaurant_id && cart.restaurant_id !== rid && cart.lines.length > 0) {
        cart = emptyCart();
      }
      cart.restaurant_id = rid;
      cart.restaurant_name = getRestaurant(rid)?.name ?? null;

      const existing = cart.lines.find((l) => l.item.item_id === item.item_id);
      if (qty <= 0) {
        cart.lines = cart.lines.filter((l) => l.item.item_id !== item.item_id);
      } else if (existing) {
        existing.quantity = qty;
      } else {
        cart.lines.push({ item, quantity: qty });
      }
      if (cart.lines.length === 0) cart = emptyCart();
      recomputeCart();
      return { ok: true, cart };
    }
    case "get_food_cart": {
      recomputeCart();
      return { cart };
    }
    case "flush_food_cart": {
      cart = emptyCart();
      return { ok: true, cart };
    }
    case "fetch_food_coupons": {
      const applicable = MOCK_COUPONS.filter((c) => !c.min_order || cart.subtotal >= c.min_order);
      return { coupons: applicable };
    }
    case "apply_food_coupon": {
      const code = String(args.coupon_code || "").toUpperCase();
      const c = MOCK_COUPONS.find((x) => x.code === code);
      if (!c) return { error: `Coupon ${code} not found` };
      if (c.min_order && cart.subtotal < c.min_order) {
        return { error: `Add ₹${c.min_order - cart.subtotal} more to use ${code}` };
      }
      cart.coupon = c.code;
      recomputeCart();
      return { ok: true, applied: c.code, discount: cart.discount, cart };
    }
    case "place_food_order": {
      if (cart.lines.length === 0) return { error: "Cart is empty" };
      const order: SwiggyOrder = {
        order_id: "o" + Date.now().toString(36),
        restaurant_name: cart.restaurant_name || "Restaurant",
        total: cart.total,
        status: "CONFIRMED",
        eta_min: 32,
        placed_at: new Date().toISOString(),
      };
      orders.unshift(order);
      // Auto-progress order status in background to simulate live tracking.
      const progress: SwiggyOrder["status"][] = ["PREPARING", "PICKED_UP", "DELIVERED"];
      progress.forEach((s, i) =>
        setTimeout(() => {
          const o = orders.find((x) => x.order_id === order.order_id);
          if (o) o.status = s;
          window.dispatchEvent(new CustomEvent("swiggy-order-tick"));
        }, (i + 1) * 8000),
      );
      cart = emptyCart();
      window.dispatchEvent(new CustomEvent("swiggy-order-tick"));
      return { ok: true, order };
    }
    case "get_food_orders": {
      return { orders };
    }
    case "track_food_order": {
      const o = orders.find((x) => x.order_id === String(args.order_id));
      return o ? { order: o } : { error: "Order not found" };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export function getActiveOrders(): SwiggyOrder[] {
  return JSON.parse(JSON.stringify(orders));
}

export function resetSwiggyState() {
  cart = emptyCart();
  orders.length = 0;
}