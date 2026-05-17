// functions/api/contacts_filter_dinamis.js - Comprehensive API (CRUD + Dynamic Filter)
const API_VERSION = "v3.3-drop-fix";
const API_NAME    = "contacts_filter_dinamis6";
const API_UPDATED = "2026-05-14";
export async function onRequest(context) {
  const { request, env } = context;
  const { DB_LIDAN_CO_ID } = env;
  const url = new URL(request.url);
  const method = request.method;

  // Get table name from query parameter or header
  const tableName = url.searchParams.get('table') || request.headers.get('X-Table-Name') || 'contacts';

  // --- Perbaikan: Mendapatkan ID dari QUERY PARAMETER (id_x) ---
  const idFromUrlParam = url.searchParams.get('id_x');
  const id = !isNaN(parseInt(idFromUrlParam)) ? parseInt(idFromUrlParam) : null;
  // --- Akhir Perbaikan ID ---

  // --- KONFIGURASI KEAMANAN ---
  const origin = request.headers.get('Origin');
  const secretKey = request.headers.get('X-Custom-Auth');

  // 1. Daftar Domain yang diizinkan (Whitelist) — subdomain otomatis diizinkan
  const allowedOrigins = [
    'https://lidan-co-id.pages.dev',
    'https://lidan.co.id',
    'https://lidan-psikologi.my.id',
    'https://lidanpsikologi.my.id',
    'https://psikotest.my.id',
    'https://cipta.my.id'
  ];

  // 2. Kunci Rahasia untuk akses Lokal/Luar Domain
  const mySecret = 'admin';

  // 1. Cek apakah pengirim sah (mendukung subdomain)
  const isAllowedOrigin = (() => {
    if (!origin) return false;
    try {
      const originHostname = new URL(origin).hostname;
      return allowedOrigins.some(allowed => {
        const allowedHostname = new URL(allowed).hostname;
        // Cocokkan exact domain ATAU subdomain (misal: sub.lidan.co.id)
        return originHostname === allowedHostname || originHostname.endsWith('.' + allowedHostname);
      });
    } catch (e) {
      return false;
    }
  })();

  const isCorrectKey = secretKey === mySecret;

  // 2. CORS headers: Harus menjawab sesuai siapa yang bertanya agar browser tidak memblokir
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Table-Name, X-Custom-Auth, X-Role, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  };

  // --- PERBAIKAN CORS PREFLIGHT ---
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  // --- AKHIR PERBAIKAN ---

  // Check for database availability
  if (!DB_LIDAN_CO_ID) {
    console.error('Database not available');
    return new Response(JSON.stringify({ error: 'Database not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Validate table name (security check)
  if (!isValidTableName(tableName)) {
    return new Response(JSON.stringify({
      error: 'Invalid table name. Only alphanumeric characters and underscores allowed.'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Main request handling logic
  try {
    // Pintu Gerbang: Izinkan jika domain resmi ATAU jika kuncinya benar (untuk localhost)
    const isLocal = !origin || origin === 'null' || origin.includes('localhost') || origin.includes('127.0.0.1');

    if (method !== 'OPTIONS') {
      // Gunakan logika: jika domain tidak terdaftar DAN kunci rahasia juga salah, maka blokir.
      if (!isAllowedOrigin && !isCorrectKey && !isLocal) {
        return new Response(JSON.stringify({
          error: 'Akses Ditolak: Domain tidak sah atau kunci rahasia salah.'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    const role = request.headers.get('X-Role');
    const action = url.searchParams.get('action');

    // LOGIKA LOGIN KHUSUS
    if (method === 'POST' && action === 'login') {
      let loginData;
      try {
        loginData = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: 'Data JSON tidak valid' }), {
          status: 400, headers: corsHeaders
        });
      }

      const username = loginData.username;
      const password = loginData.password;
      const targetTable = role === 'admin' ? 'admins' : 'users';

      await createTableIfNotExists(DB_LIDAN_CO_ID, targetTable);

      // Mencocokkan username dengan x_01 dan password dengan x_02
      const user = await DB_LIDAN_CO_ID.prepare(
        `SELECT * FROM ${targetTable} WHERE x_01 = ? AND x_02 = ?`
      ).bind(username, password).first();

      if (user) {
        return new Response(JSON.stringify({
          success: true,
          role: role,
          message: `Login ${role} berhasil`,
          data: user
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } else {
        return new Response(JSON.stringify({ success: false, message: 'Username atau Password Salah' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // ── BLOK AKSES LANGSUNG BROWSER (tanpa auth & tanpa table param) ──
    // Jika dibuka langsung di browser (GET, tidak ada X-Custom-Auth, tidak ada ?table=)
    const isBrowserDirect = (
      method === 'GET' &&
      !isAllowedOrigin &&
      !isCorrectKey &&
      !isLocal &&
      !url.searchParams.get('table') &&
      action !== 'version'
    );
    if (isBrowserDirect) {
      const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${API_NAME} — API Info</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0d0f14;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#161922;border:1px solid #252b3b;border-radius:16px;padding:40px 36px;max-width:480px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.6)}
  .badge{display:inline-flex;align-items:center;gap:8px;background:#1e2230;border:1px solid #252b3b;border-radius:999px;padding:6px 14px;margin-bottom:24px}
  .dot{width:8px;height:8px;border-radius:50%;background:#34d399;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .dot-label{font-size:12px;color:#34d399;font-family:monospace;letter-spacing:.5px}
  h1{font-size:22px;font-weight:800;margin-bottom:6px;letter-spacing:-.3px}
  h1 span{color:#4f9cf9}
  .sub{font-size:13px;color:#64748b;margin-bottom:28px;line-height:1.6}
  .row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #1e2230;font-size:13px}
  .row:last-child{border-bottom:none}
  .lbl{color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.6px;font-weight:600}
  .val{font-family:monospace;font-size:13px;color:#e2e8f0;background:#1e2230;padding:3px 10px;border-radius:6px}
  .val.green{color:#34d399}
  .warn{margin-top:24px;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);border-radius:10px;padding:14px 16px;font-size:12px;color:#f87171;line-height:1.7}
  .warn strong{display:block;margin-bottom:4px;font-size:13px}
</style>
</head>
<body>
<div class="card">
  <div class="badge"><span class="dot"></span><span class="dot-label">ONLINE</span></div>
  <h1>Multi<span>DB</span> API</h1>
  <p class="sub">Cloudflare D1 REST API — hanya dapat diakses oleh aplikasi resmi yang telah terdaftar.</p>
  <div class="row"><span class="lbl">Nama File</span><span class="val">${API_NAME}</span></div>
  <div class="row"><span class="lbl">Versi</span><span class="val green">${API_VERSION}</span></div>
  <div class="row"><span class="lbl">Diperbarui</span><span class="val">${API_UPDATED}</span></div>
  <div class="row"><span class="lbl">Status</span><span class="val green">✓ Aktif</span></div>
  <div class="warn">
    <strong>⛔ Akses Ditolak</strong>
    Endpoint ini tidak dapat diakses langsung dari browser. Permintaan hanya diproses dari domain resmi atau dengan kunci API yang valid.
  </div>
</div>
</body>
</html>`;
      return new Response(html, {
        status: 403,
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    if (method === 'GET' && action === 'version') {
      return new Response(JSON.stringify({ success: true, api: API_NAME, version: API_VERSION, updated: API_UPDATED }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (method === 'GET' && action === 'list_tables') {
      const { results } = await DB_LIDAN_CO_ID.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
      ).all();
      return new Response(JSON.stringify({
        success: true,
        tables: results.map(r => r.name),
        version: API_VERSION
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    // --- AKHIR FITUR TAMBAHAN ---

    // createTableIfNotExists hanya untuk POST agar GET/PUT tidak ada overhead query ekstra
    if (method === 'POST') {
      await createTableIfNotExists(DB_LIDAN_CO_ID, tableName);
    }

    switch (method) {
      case 'GET':
        if (id) {
          return await getContactById(DB_LIDAN_CO_ID, tableName, id, corsHeaders);
        } else {
          return await getFilteredContacts(request, DB_LIDAN_CO_ID, tableName, corsHeaders);
        }
      case 'POST':
        if (action === 'bulk_insert') {
          return await bulkInsert(request, DB_LIDAN_CO_ID, tableName, corsHeaders);
        }
        return await createContact(request, DB_LIDAN_CO_ID, tableName, corsHeaders);
      case 'PUT':
        if (!id) {
          throw new Error('Record ID (id_x query parameter) is required for PUT operation.');
        }
        return await updateContact(request, DB_LIDAN_CO_ID, tableName, id, corsHeaders);
      case 'DELETE':
        // --- DROP TABLE: hapus tabel permanen (tidak dibuat ulang) ---
        if (action === 'drop_table') {
          const protectedTables = ['admins', 'users', 'cover'];
          if (protectedTables.includes(tableName)) {
            return new Response(JSON.stringify({
              success: false,
              message: `Table '${tableName}' is protected and cannot be dropped.`
            }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
          }
          await DB_LIDAN_CO_ID.prepare(`DROP TABLE IF EXISTS "${tableName}"`).run();
          return new Response(JSON.stringify({
            success: true,
            message: `Table '${tableName}' permanently dropped.`
          }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        // --- CLEAR TABLE: kosongkan data, tabel tetap ada, id_x reset dari 1 ---
        if (action === 'clear_table') {
          await DB_LIDAN_CO_ID.prepare(`DROP TABLE IF EXISTS "${tableName}"`).run();
          await createTableIfNotExists(DB_LIDAN_CO_ID, tableName);
          return new Response(JSON.stringify({
            success: true,
            message: `Table '${tableName}' cleared successfully (data deleted, structure kept).`
          }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        // --- RESET TABLE: alias clear_table (hapus data + buat ulang) ---
        if (action === 'reset_table') {
          await DB_LIDAN_CO_ID.prepare(`DROP TABLE IF EXISTS "${tableName}"`).run();
          await createTableIfNotExists(DB_LIDAN_CO_ID, tableName);
          return new Response(JSON.stringify({
            success: true,
            message: `Table '${tableName}' reset successfully (data deleted, structure kept).`
          }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        if (!id) {
          throw new Error('Record ID (id_x query parameter) is required for DELETE operation.');
        }
        return await deleteContact(DB_LIDAN_CO_ID, tableName, id, corsHeaders);
      default:
        return new Response(JSON.stringify({ error: `Method ${method} not allowed` }), {
          status: 405,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// === Helper Functions ===

// Security function to validate table name
function isValidTableName(tableName) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName) && tableName.length <= 50;
}

// Function to create table if not exists
async function createTableIfNotExists(DB_LIDAN_CO_ID, tableName) {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id_x INTEGER PRIMARY KEY AUTOINCREMENT,
      x_01 TEXT, x_02 TEXT, x_03 TEXT, x_04 TEXT, x_05 TEXT,
      x_06 TEXT, x_07 TEXT, x_08 TEXT, x_09 TEXT, x_10 TEXT,
      x_11 TEXT, x_12 TEXT, x_13 TEXT, x_14 TEXT, x_15 TEXT,
      x_16 TEXT, x_17 TEXT, x_18 TEXT, x_19 TEXT, x_20 TEXT,
      x_21 TEXT, x_22 TEXT, x_23 TEXT, x_24 TEXT, x_25 TEXT
    )
  `;
  try {
    await DB_LIDAN_CO_ID.prepare(createTableQuery).run();
    console.log(`Table '${tableName}' created or already exists.`);
  } catch (error) {
    console.error(`Error creating table '${tableName}':`, error);
    throw new Error(`Failed to create table '${tableName}': ${error.message}`);
  }
}

// GET (Filtered) - Retrieves multiple records with dynamic filters + PAGINATION
async function getFilteredContacts(request, DB_LIDAN_CO_ID, tableName, corsHeaders) {
  const url = new URL(request.url);

  // ── PAGINATION: ambil limit & offset dari query param ──
  const MAX_LIMIT     = 200;
  const DEFAULT_LIMIT = 100;
  const rawLimit  = parseInt(url.searchParams.get('limit'))  || DEFAULT_LIMIT;
  const rawOffset = parseInt(url.searchParams.get('offset')) || 0;
  const limit  = Math.min(Math.max(1, rawLimit), MAX_LIMIT);
  const offset = Math.max(0, rawOffset);

  let query = `SELECT * FROM ${tableName}`;
  const params = [];
  const conditions = [];
  const appliedFilters = {};

  // Daftar kolom yang bisa difilter
  const filterableColumns = ['id_x'];
  for (let i = 1; i <= 20; i++) {
    filterableColumns.push(`x_${i < 10 ? '0' : ''}${i}`);
  }

  for (const col of filterableColumns) {
    // Filter _eq (equal)
    const eqValue = url.searchParams.get(`${col}_eq`);
    if (eqValue !== null) { conditions.push(`${col} = ?`); params.push(eqValue); appliedFilters[`${col}_eq`] = eqValue; }

    // Filter _gt (greater than)
    const gtValue = url.searchParams.get(`${col}_gt`);
    if (gtValue !== null) {
      const parsedValue = (col === 'id_x' || col.startsWith('x_')) ? parseFloat(gtValue) : gtValue;
      if (!isNaN(parsedValue) || typeof parsedValue === 'string') {
        conditions.push(`${col} > ?`); params.push(parsedValue); appliedFilters[`${col}_gt`] = gtValue;
      } else { throw new Error(`Invalid numeric value for ${col}_gt`); }
    }

    // Filter _lt (less than)
    const ltValue = url.searchParams.get(`${col}_lt`);
    if (ltValue !== null) {
      const parsedValue = (col === 'id_x' || col.startsWith('x_')) ? parseFloat(ltValue) : ltValue;
      if (!isNaN(parsedValue) || typeof parsedValue === 'string') {
        conditions.push(`${col} < ?`); params.push(parsedValue); appliedFilters[`${col}_lt`] = ltValue;
      } else { throw new Error(`Invalid numeric value for ${col}_lt`); }
    }

    // Filter _like (contains)
    const likeValue = url.searchParams.get(`${col}_like`);
    if (likeValue !== null) { conditions.push(`${col} LIKE ?`); params.push(`%${likeValue}%`); appliedFilters[`${col}_like`] = likeValue; }

    // Filter _ne (not equal)
    const neValue = url.searchParams.get(`${col}_ne`);
    if (neValue !== null) { conditions.push(`${col} != ?`); params.push(neValue); appliedFilters[`${col}_ne`] = neValue; }
  }

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

  // ── Hitung total dulu (query COUNT ringan, tanpa bawa data) ──
  const countQuery = `SELECT COUNT(*) as total FROM ${tableName}${whereClause}`;
  const countResult = await DB_LIDAN_CO_ID.prepare(countQuery).bind(...params).first();
  const total = countResult ? countResult.total : 0;

  // ── Query data dengan LIMIT & OFFSET ──
  query += whereClause;
  query += ` ORDER BY id_x DESC LIMIT ? OFFSET ?`;
  const dataParams = [...params, limit, offset];

  const { results } = await DB_LIDAN_CO_ID.prepare(query).bind(...dataParams).all();

  return new Response(JSON.stringify({
    success: true,
    table: tableName,
    total:  total,          // <-- total semua baris (untuk pagination frontend)
    count:  results.length, // <-- jumlah baris di response ini
    limit:  limit,
    offset: offset,
    data:   results,
    filter: appliedFilters
  }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

// GET (By ID) - Retrieves a single record by its ID
async function getContactById(DB_LIDAN_CO_ID, tableName, id, corsHeaders) {
  const query = `SELECT * FROM ${tableName} WHERE id_x = ?`;
  const { results } = await DB_LIDAN_CO_ID.prepare(query).bind(id).all();

  if (results.length === 0) {
    return new Response(JSON.stringify({ success: false, message: `Record with id_x ${id} not found in table '${tableName}'` }), {
      status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    table: tableName,
    data: results[0]
  }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

// POST - Creates a new record
// ── BULK INSERT ──
async function bulkInsert(request, DB_LIDAN_CO_ID, tableName, corsHeaders) {
  let rows;
  try { rows = await request.json(); } catch (e) { throw new Error('Invalid JSON.'); }
  if (!Array.isArray(rows) || rows.length === 0)
    throw new Error('Body harus berupa array dengan minimal 1 baris.');

  await createTableIfNotExists(DB_LIDAN_CO_ID, tableName);

  const CHUNK = 100;
  let totalInserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const stmts = chunk.map(row => {
      const cols = [], vals = [], phs = [];
      for (let c = 1; c <= 20; c++) {
        const col = 'x_' + String(c).padStart(2, '0');
        if (Object.prototype.hasOwnProperty.call(row, col)) {
          cols.push(col); vals.push(row[col] === '' ? null : row[col]); phs.push('?');
        }
      }
      if (cols.length === 0) return null;
      return DB_LIDAN_CO_ID.prepare(
        `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${phs.join(', ')})`
      ).bind(...vals);
    }).filter(Boolean);
    if (stmts.length > 0) {
      await DB_LIDAN_CO_ID.batch(stmts);
      totalInserted += stmts.length;
    }
  }
  return new Response(JSON.stringify({
    success: true, table: tableName,
    inserted: totalInserted, total: rows.length,
    message: `Bulk insert selesai: ${totalInserted} baris.`
  }), { status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function createContact(request, DB_LIDAN_CO_ID, tableName, corsHeaders) {
  let requestData;
  try {
    requestData = await request.json();
  } catch (error) {
    throw new Error('Invalid JSON data in request body.');
  }

  const columns = [];
  const values = [];
  const placeholders = [];

  for (let i = 1; i <= 20; i++) {
    const colNum = i.toString().padStart(2, '0');
    const colName = `x_${colNum}`;
    if (requestData.hasOwnProperty(colName)) {
      columns.push(colName);
      values.push(requestData[colName] === '' ? null : requestData[colName]);
      placeholders.push('?');
    }
  }

  if (columns.length === 0) {
    throw new Error('At least one field (x_01 to x_25) is required for creation.');
  }

  const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
  const result = await DB_LIDAN_CO_ID.prepare(query).bind(...values).run();

  return new Response(JSON.stringify({
    success: true,
    table: tableName,
    id_x: result.meta.last_row_id,
    message: `Record created successfully in table '${tableName}'`,
    insertedFields: columns,
    insertedData: requestData
  }), { status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

// PUT - Updates an existing record dynamically by ID
async function updateContact(request, DB_LIDAN_CO_ID, tableName, id, corsHeaders) {
  let requestData;
  try {
    requestData = await request.json();
  } catch (error) {
    throw new Error('Invalid JSON data in request body.');
  }

  const setClauses = [];
  const values = [];

  for (let i = 1; i <= 25; i++) {
    const colNum = i.toString().padStart(2, '0');
    const colName = `x_${colNum}`;
    if (requestData.hasOwnProperty(colName)) {
      setClauses.push(`${colName} = ?`);
      values.push(requestData[colName] === '' ? null : requestData[colName]);
    }
  }

  if (setClauses.length === 0) {
    throw new Error('At least one field (x_01 to x_25) is required for update.');
  }

  values.push(id);
  const query = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id_x = ?`;
  const result = await DB_LIDAN_CO_ID.prepare(query).bind(...values).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ success: false, message: `Record with id_x ${id} not found or no changes made in table '${tableName}'` }), {
      status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    table: tableName,
    id_x: id,
    message: `Record with id_x ${id} updated successfully in table '${tableName}'`,
    updatedFields: Object.keys(requestData)
  }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

// DELETE - Deletes a record by ID
async function deleteContact(DB_LIDAN_CO_ID, tableName, id, corsHeaders) {
  const query = `DELETE FROM ${tableName} WHERE id_x = ?`;
  const result = await DB_LIDAN_CO_ID.prepare(query).bind(id).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ success: false, message: `Record with id_x ${id} not found in table '${tableName}'` }), {
      status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    table: tableName,
    id_x: id,
    message: `Record with id_x ${id} deleted successfully from table '${tableName}'`
  }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}