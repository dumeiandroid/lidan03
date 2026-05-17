export async function onRequest(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("X-Custom-Auth");
  const VERSION = "1.0.12-FOLDER-ONLY"; // Identitas untuk Sublime/GitHub

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Custom-Auth",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 1. Kirim versi meskipun Unauthorized (Sesuai permintaan Anda)
    if (authHeader !== "admin") {
      return new Response(JSON.stringify({ 
        error: "Unauthorized", 
        version: VERSION 
      }), { status: 403, headers: corsHeaders });
    }

    // 2. LOGIKA INTI: Menggunakan Delimiter untuk Folder
    // Ini akan mengabaikan file individu dan hanya mencari struktur '/'
    const list = await env.LIDAN_BUCKET.list({
      delimiter: "/",
      limit: 1000 // Sekarang 1000 ini adalah 1000 FOLDER, bukan 1000 file
    });

    // Ambil daftar folder virtual (commonPrefixes)
    const folders = list.commonPrefixes.map(name => ({
      key: name,
      type: "folder"
    }));

    return new Response(JSON.stringify({
      version: VERSION,
      folders: folders,
      count: folders.length
    }), { headers: corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, version: VERSION }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}