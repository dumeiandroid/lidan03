export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix") || "";
  const cursor = url.searchParams.get("cursor") || undefined;

  const API_VERSION = "2.0.6-HIERARCHY-FINAL";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // KUNCINYA: Menggunakan delimiter "/" agar R2 mengelompokkan folder secara otomatis
    const list = await env.LIDAN_BUCKET.list({
      prefix: prefix,
      delimiter: "/", 
      limit: 1000,
      cursor: cursor
    });

    return new Response(JSON.stringify({
      version: API_VERSION,
      // Folders diambil dari commonPrefixes (ini yang membuat folder Z muncul)
      folders: (list.commonPrefixes || []).map(p => ({
        key: p,
        name: p.replace(prefix, "").replace("/", "")
      })),
      // Files diambil dari objects di folder saat ini saja
      files: (list.objects || []).filter(obj => obj.key !== prefix).map(obj => ({
        key: obj.key,
        url: `https://assets.indahabadi.my.id/${obj.key}`,
        uploaded: obj.uploaded
      })),
      nextCursor: list.truncated ? list.cursor : null
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
}