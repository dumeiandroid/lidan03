export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action"); // Gunakan query parameter untuk membedakan fungsi

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Custom-Auth",
  };

  // 1. Tangani Preflight OPTIONS
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- AKSI GET: LIST DATA ---
    if (request.method === "GET") {
      const list = await env.MY_BUCKET.list();
      const files = list.objects.map(obj => ({
        key: obj.key,
        url: `https://img.cipta.my.id/${obj.key}`,
        uploaded: obj.uploaded
      }));
      return new Response(JSON.stringify(files), { headers: corsHeaders });
    }

    // --- AKSI POST: UPLOAD, RENAME, DELETE ---
    if (request.method === "POST") {
      // Validasi Keamanan (Admin Check)
      const authHeader = request.headers.get("X-Custom-Auth");
      
      // Logika khusus berdasarkan parameter "action"
      if (action === "upload") {
        if (authHeader !== "admin") throw new Error("Unauthorized");
        
        const formData = await request.formData();
        const file = formData.get('file');
        const customName = formData.get('customName');
        const fileName = customName || `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

        await env.MY_BUCKET.put(fileName, file.stream(), {
          httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000' },
        });
        
        return new Response(JSON.stringify({ success: true, key: fileName }), { headers: corsHeaders });
      }

      if (action === "rename") {
        const { oldKey, newKey, auth } = await request.json();
        if (auth !== "admin" && authHeader !== "admin") throw new Error("Unauthorized");

        const obj = await env.MY_BUCKET.get(oldKey);
        if (!obj) return new Response(JSON.stringify({ error: "File tidak ditemukan" }), { status: 404, headers: corsHeaders });

        await env.MY_BUCKET.put(newKey, obj.body, { httpMetadata: obj.httpMetadata });
        await env.MY_BUCKET.delete(oldKey);
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (action === "delete") {
        const { key, auth } = await request.json();
        if (auth !== "admin" && authHeader !== "admin") throw new Error("Unauthorized");

        await env.MY_BUCKET.delete(key);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    return new Response("Action Not Found", { status: 404 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: e.message === "Unauthorized" ? 403 : 500, 
      headers: corsHeaders 
    });
  }
}