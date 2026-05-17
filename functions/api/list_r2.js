export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Mengambil daftar objek dari R2
    const list = await env.MY_BUCKET.list();
    
    const files = list.objects.map(obj => ({
      key: obj.key,
      url: `https://img.cipta.my.id/${obj.key}`,
      uploaded: obj.uploaded
    }));

    return new Response(JSON.stringify(files), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}