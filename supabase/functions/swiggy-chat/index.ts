// Swiggy AI ordering agent — Gemini via Lovable AI Gateway with OpenAI-compatible tool calling.
// The client runs the tool-call loop: it sends `messages`, receives any tool_calls,
// executes them against the Swiggy MCP (currently mocked client-side), and posts
// the results back as tool messages on the next turn.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM_PROMPT = `You are a Swiggy food ordering assistant for India. Help users discover restaurants, find dishes, manage their cart, apply coupons, and place orders using the tools available.

Rules:
- Always confirm before placing an order: "Shall I place this order for ₹X to [address]?"
- After building the cart, always fetch and apply the best available coupon automatically
- Show a cart summary after every add/remove
- Use the ₹ symbol for all prices
- Be concise, warm, and helpful
- If the user has not chosen a delivery address, call get_addresses first
- Never place an order without explicit user confirmation
- When you show restaurants or dishes, give a short ranked list (max 5) with name, cuisine, rating, ETA, and price`;

// OpenAI-compatible function/tool declarations for the 13 Swiggy Food MCP tools.
const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_restaurants",
      description: "Search restaurants for food delivery by cuisine, name, or location.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query e.g. 'biryani' or 'McDonald's'" },
          address_id: { type: "string", description: "Delivery address id (optional)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_menu",
      description: "Search for specific dishes across restaurants.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          restaurant_id: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_restaurant_menu",
      description: "Get the full menu of a specific restaurant.",
      parameters: {
        type: "object",
        properties: {
          restaurant_id: { type: "string" },
          page: { type: "number" },
        },
        required: ["restaurant_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_addresses",
      description: "Get the user's saved delivery addresses.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "update_food_cart",
      description: "Add or update items in the food cart. Use quantity 0 to remove.",
      parameters: {
        type: "object",
        properties: {
          item_id: { type: "string" },
          quantity: { type: "number" },
          restaurant_id: { type: "string" },
        },
        required: ["item_id", "quantity", "restaurant_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_food_cart",
      description: "Get current cart contents, subtotal, delivery fee and total.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "flush_food_cart",
      description: "Clear all items from the cart.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_food_coupons",
      description: "Get available coupons applicable to the current cart.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_food_coupon",
      description: "Apply a coupon code to the cart.",
      parameters: {
        type: "object",
        properties: { coupon_code: { type: "string" } },
        required: ["coupon_code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "place_food_order",
      description: "Place the food order after explicit user confirmation.",
      parameters: {
        type: "object",
        properties: {
          address_id: { type: "string" },
          payment_method: { type: "string", enum: ["UPI", "COD", "CARD"] },
        },
        required: ["address_id", "payment_method"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_food_orders",
      description: "Get the list of the user's recent and active orders.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "track_food_order",
      description: "Track the live delivery status of an order.",
      parameters: {
        type: "object",
        properties: { order_id: { type: "string" } },
        required: ["order_id"],
      },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: "messages[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...body.messages,
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(
        JSON.stringify({
          error:
            resp.status === 429
              ? "Rate limit reached. Please try again in a moment."
              : resp.status === 402
              ? "AI credits exhausted. Add credits in Settings → Plans."
              : `Gateway error (${resp.status}): ${errText.slice(0, 200)}`,
        }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const choice = data.choices?.[0]?.message;
    return new Response(
      JSON.stringify({
        role: "assistant",
        content: choice?.content ?? "",
        tool_calls: choice?.tool_calls ?? [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});