export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

  try {
    const { oldKey, newKey, auth } = await request.json();
    if (auth !== "admin") return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });

    // R2 tidak punya RENAME, jadi kita COPY lalu DELETE
    const obj = await env.MY_BUCKET.get(oldKey);
    if (!obj) return new Response(JSON.stringify({ error: "File tidak ditemukan" }), { status: 404, headers: corsHeaders });

    // 1. Simpan ke nama baru
    await env.MY_BUCKET.put(newKey, obj.body, {
      httpMetadata: obj.httpMetadata,
    });

    // 2. Hapus file lama
    await env.MY_BUCKET.delete(oldKey);

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
}