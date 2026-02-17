import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) throw new Error("URL is required");

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Crawling:", formattedUrl);

    const response = await fetch(formattedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OpenClaw/1.0; +https://quanta.ai)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/json")) {
      throw new Error("URL does not return text content");
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i);
    const description = descMatch ? descMatch[1].trim() : "";

    // Extract text content - strip HTML tags, scripts, styles
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .trim();

    // Limit text size
    text = text.slice(0, 15000);

    // Extract links
    const linkRegex = /<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const links: { url: string; text: string }[] = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null && links.length < 50) {
      const linkText = match[2].replace(/<[^>]+>/g, "").trim();
      if (linkText) links.push({ url: match[1], text: linkText });
    }

    // Extract headings
    const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
    const headings: { level: number; text: string }[] = [];
    while ((match = headingRegex.exec(html)) !== null && headings.length < 30) {
      const hText = match[2].replace(/<[^>]+>/g, "").trim();
      if (hText) headings.push({ level: parseInt(match[1]), text: hText });
    }

    // Extract images
    const imgRegex = /<img[^>]*src=["'](https?:\/\/[^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi;
    const images: { src: string; alt: string }[] = [];
    while ((match = imgRegex.exec(html)) !== null && images.length < 20) {
      images.push({ src: match[1], alt: match[2] || "" });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        url: formattedUrl,
        title,
        description,
        text,
        links,
        headings,
        images,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        charCount: text.length,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Crawl error:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Failed to crawl"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
