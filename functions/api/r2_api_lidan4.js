export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const prefix = url.searchParams.get("prefix") || "";

  // 1. Header CORS yang dioptimalkan untuk akses dari localhost maupun domain lain
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Custom-Auth",
    "Access-Control-Max-Age": "86400", 
  };

  // 2. WAJIB: Menjawab permintaan OPTIONS (Preflight) agar browser mengizinkan POST
  if (request.method === "OPTIONS") {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  // Informasi Versi & Proteksi Dasar
  if (!action || action === "version") {
    return new Response(JSON.stringify({
      version: "1.2.4",
      status: "Protected",
      message: "API Active. Access only via authorized applications."
    }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  try {
    // --- FUNGSI GET (Tetap dipertahankan sesuai file asli) ---
    if (request.method === "GET") {
      const list = await env.LIDAN_BUCKET.list({ prefix: prefix, limit: 1000 });
      const files = list.objects.map(obj => ({
        key: obj.key,
        url: `https://assets.lidan.co.id/${obj.key}`,
        uploaded: obj.uploaded
      }));
      const responseHeaders = new Headers(corsHeaders);
      responseHeaders.set("Content-Type", "application/json");
      return new Response(JSON.stringify(files), { headers: responseHeaders });
    }

    // --- FUNGSI POST (Upload, Rename, Delete) ---
    if (request.method === "POST") {
      const authHeader = request.headers.get("X-Custom-Auth");
      
      // Validasi Kunci: Menggunakan key 'admin'
      if (authHeader !== "admin") {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { 
          status: 401, 
          headers: corsHeaders 
        });
      }

      // PERBAIKAN FUNGSI UPLOAD
      if (action === "upload") {
        const formData = await request.formData();
        const file = formData.get('file');
        const customName = formData.get('customName');
        
        // Pastikan nama file unik jika customName tidak dikirim
        const fileName = customName || `absensi/${Date.now()}.jpg`;
        
        await env.LIDAN_BUCKET.put(fileName, file.stream(), {
          httpMetadata: { 
            contentType: file.type || 'image/jpeg', 
            cacheControl: 'public, max-age=31536000' 
          },
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          url: `https://assets.lidan.co.id/${fileName}` 
        }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      // FUNGSI RENAME (Sesuai kode asli Anda)
      if (action === "rename") {
        const { oldKey, newKey, keepOriginal } = await request.json();
        const obj = await env.LIDAN_BUCKET.get(oldKey);
        if (!obj) return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: corsHeaders });
        await env.LIDAN_BUCKET.put(newKey, obj.body, { httpMetadata: obj.httpMetadata });
        if (!keepOriginal) await env.LIDAN_BUCKET.delete(oldKey);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // FUNGSI DELETE (Sesuai kode asli Anda)
      if (action === "delete") {
        const { key } = await request.json();
        await env.LIDAN_BUCKET.delete(key);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  }
}