export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const prefix = url.searchParams.get("prefix") || "";

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store, no-cache, must-revalidate", // Mencegah cache
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const startTime = Date.now();
      
      // Melakukan listing dengan delimiter '/'
      const list = await env.LIDAN_BUCKET.list({
        prefix: prefix,
        delimiter: "/",
      });

      const executionTime = Date.now() - startTime;

      // Data yang dikirim ke Frontend
      const responseData = {
        debug: {
          timestamp: new Date().toISOString(),
          executionTimeMs: executionTime,
          objectsScanned: list.objects.length,
          rawPrefixesFound: list.commonPrefixes.length
        },
        folders: list.commonPrefixes.map(p => ({
          name: p,
          type: "folder"
        }))
      };

      return new Response(JSON.stringify(responseData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
};