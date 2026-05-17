export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const prefix = url.searchParams.get("prefix") || "";
  const recursive = url.searchParams.get("recursive") === "true";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Custom-Auth",
    "Access-Control-Max-Age": "86400",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!action || action === "version") {
    return new Response(JSON.stringify({
      version: "1.3.0",
      bucket: "tabi_bucket",
      status: "Protected",
      message: "API Active. Access only via authorized applications."
    }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  try {
    if (request.method === "GET") {
      if (!recursive) {
        let files = [];
        let folders = [];
        let cursor = undefined;
        do {
          const listOptions = { prefix, delimiter: "/", limit: 1000 };
          if (cursor) listOptions.cursor = cursor;
          const list = await env.TABI_BUCKET.list(listOptions);
          files.push(...list.objects.map(obj => ({
            key: obj.key, url: `https://file.tabi.my.id/${obj.key}`,
            size: obj.size, uploaded: obj.uploaded, type: "file"
          })));
          if (list.delimitedPrefixes) {
            folders.push(...list.delimitedPrefixes.map(p => ({ key: p, type: "folder" })));
          }
          cursor = list.truncated ? list.cursor : undefined;
        } while (cursor);
        return new Response(JSON.stringify({ files, folders }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } else {
        let files = [];
        let cursor = undefined;
        do {
          const listOptions = { prefix, limit: 1000 };
          if (cursor) listOptions.cursor = cursor;
          const list = await env.TABI_BUCKET.list(listOptions);
          files.push(...list.objects.map(obj => ({
            key: obj.key, url: `https://file.tabi.my.id/${obj.key}`,
            size: obj.size, uploaded: obj.uploaded, type: "file"
          })));
          cursor = list.truncated ? list.cursor : undefined;
        } while (cursor);
        return new Response(JSON.stringify({ files, folders: [] }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    if (request.method === "POST") {
      const authHeader = request.headers.get("X-Custom-Auth");
      if (authHeader !== "admin") {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      if (action === "upload") {
        const formData = await request.formData();
        const file = formData.get('file');
        const customName = formData.get('customName');
        const fileName = customName || `uploads/${Date.now()}_${file.name}`;
        await env.TABI_BUCKET.put(fileName, file.stream(), {
          httpMetadata: { contentType: file.type || 'application/octet-stream', cacheControl: 'public, max-age=31536000' },
        });
        return new Response(JSON.stringify({ success: true, url: `https://file.tabi.my.id/${fileName}` }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      if (action === "rename") {
        const { oldKey, newKey, keepOriginal } = await request.json();
        const obj = await env.TABI_BUCKET.get(oldKey);
        if (!obj) return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: corsHeaders });
        await env.TABI_BUCKET.put(newKey, obj.body, { httpMetadata: obj.httpMetadata });
        if (!keepOriginal) await env.TABI_BUCKET.delete(oldKey);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
      if (action === "delete") {
        const { key } = await request.json();
        await env.TABI_BUCKET.delete(key);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}