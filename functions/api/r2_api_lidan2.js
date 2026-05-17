export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Custom-Auth",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (request.method === "GET") {
      const list = await env.LIDAN_BUCKET.list();
      const files = list.objects.map(obj => ({
        key: obj.key,
        url: `https://assets.lidan.co.id/${obj.key}`,
        uploaded: obj.uploaded
      }));
      return new Response(JSON.stringify(files), { headers: corsHeaders });
    }

    if (request.method === "POST") {
      const authHeader = request.headers.get("X-Custom-Auth");
      
      if (action === "upload") {
        if (authHeader !== "admin") throw new Error("Unauthorized");
        const formData = await request.formData();
        const file = formData.get('file');
        const customName = formData.get('customName');
        const fileName = customName || `${Date.now()}-${file.name}`;
        await env.LIDAN_BUCKET.put(fileName, file.stream(), {
          httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000' },
        });
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (action === "rename") {
        const { oldKey, newKey, keepOriginal } = await request.json(); // Ambil flag keepOriginal
        if (authHeader !== "admin") throw new Error("Unauthorized");

        const obj = await env.LIDAN_BUCKET.get(oldKey);
        if (!obj) return new Response(JSON.stringify({ error: "File not found" }), { status: 404 });

        // Simpan file ke lokasi baru
        await env.LIDAN_BUCKET.put(newKey, obj.body, { httpMetadata: obj.httpMetadata });
        
        // HANYA hapus file lama jika keepOriginal TIDAK true (Rename murni)
        if (!keepOriginal) {
          await env.LIDAN_BUCKET.delete(oldKey);
        }
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (action === "delete") {
        const { key } = await request.json();
        if (authHeader !== "admin") throw new Error("Unauthorized");
        await env.LIDAN_BUCKET.delete(key);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
}