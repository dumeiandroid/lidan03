export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  
  // Ambil parameter prefix dari URL untuk mendukung navigasi folder
  const prefix = url.searchParams.get("prefix") || "";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Custom-Auth",
    "Access-Control-Expose-Headers": "X-Debug-Count, X-Debug-Truncated",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (request.method === "GET") {
      // Menggunakan prefix agar R2 hanya mengembalikan file di folder tersebut
      const list = await env.LIDAN_BUCKET.list({
        prefix: prefix,
        limit: 1000
      });

      const files = list.objects.map(obj => ({
        key: obj.key,
        url: `https://assets.lidan.co.id/${obj.key}`,
        uploaded: obj.uploaded
      }));

      // Menambahkan header debug untuk sinkronisasi dengan view_lidan.html
      const responseHeaders = new Headers(corsHeaders);
      responseHeaders.set("Content-Type", "application/json");
      responseHeaders.set("X-Debug-Count", files.length.toString());
      responseHeaders.set("X-Debug-Truncated", list.truncated ? "true" : "false");

      return new Response(JSON.stringify(files), { headers: responseHeaders });
    }

    if (request.method === "POST") {
      const authHeader = request.headers.get("X-Custom-Auth");
      if (authHeader !== "admin") throw new Error("Unauthorized");

      if (action === "upload") {
        const formData = await request.formData();
        const file = formData.get('file');
        const customName = formData.get('customName');
        const fileName = customName || `${Date.now()}-${file.name}`;
        
        await env.LIDAN_BUCKET.put(fileName, file.stream(), {
          httpMetadata: { 
            contentType: file.type, 
            cacheControl: 'public, max-age=31536000' 
          },
        });
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (action === "rename") {
        const { oldKey, newKey, keepOriginal } = await request.json();

        const obj = await env.LIDAN_BUCKET.get(oldKey);
        if (!obj) return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: corsHeaders });

        // Proses Copy ke nama baru
        await env.LIDAN_BUCKET.put(newKey, obj.body, { 
          httpMetadata: obj.httpMetadata 
        });
        
        // Hapus file lama jika action-nya adalah Rename
        if (!keepOriginal) {
          await env.LIDAN_BUCKET.delete(oldKey);
        }
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (action === "delete") {
        const { key } = await request.json();
        await env.LIDAN_BUCKET.delete(key);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}