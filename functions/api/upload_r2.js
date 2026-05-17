export async function onRequest(context) {
  const { request, env } = context;
  
  // Pengaturan CORS agar bisa diakses dari Localhost maupun Domain Utama
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Custom-Auth",
  };

  // Tangani Preflight Request (OPTIONS)
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Hanya izinkan metode POST
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // 1. Validasi Keamanan (Kunci Admin)
    const authHeader = request.headers.get("X-Custom-Auth");
    if (authHeader !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized: Kunci salah!" }), { 
        status: 403, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 2. Ambil data dari FormData
    const formData = await request.formData();
    const file = formData.get('file');
    const customName = formData.get('customName'); // Nama/Path dari Explorer

    if (!file) {
      return new Response(JSON.stringify({ error: "File tidak ditemukan" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // 3. Tentukan Nama File (Prioritaskan customName jika ada)
    // Jika customName ada, kita gunakan langsung (ini mendukung struktur folder)
    // Jika tidak, kita buat nama baru yang unik
    const fileName = customName ? customName : `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

    // 4. Proses Simpan ke R2
    // Pastikan "MY_BUCKET" sudah di-binding di dashboard Cloudflare Pages
    await env.MY_BUCKET.put(fileName, file.stream(), {
      httpMetadata: { 
        contentType: file.type,
        // Opsional: memaksa browser untuk mendownload atau menampilkan langsung
        cacheControl: 'public, max-age=31536000',
      },
    });

    // 5. Berikan Respon Sukses
    return new Response(JSON.stringify({ 
      success: true, 
      key: fileName,
      url: `https://img.cipta.my.id/${fileName}` 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    // Tangani Error jika Binding R2 belum dilakukan
    return new Response(JSON.stringify({ 
      error: "Server Error: " + e.message,
      tip: "Pastikan R2 Bucket sudah di-binding dengan nama MY_BUCKET di Dashboard Cloudflare."
    }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}