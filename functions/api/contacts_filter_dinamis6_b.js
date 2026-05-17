// functions/api/contacts_filter_dinamis.js - Comprehensive API (CRUD + Dynamic Filter)
const API_VERSION = "v3.1-no-cache-fix";
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
    'Access-Control-Allow-Headers': 'Content-Type, X-Table-Name, X-Custom-Auth, X-Role',
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

    if (method === 'GET' && action === 'version') {
      return new Response(JSON.stringify({ success: true, api: 'dinamis6', version: API_VERSION }), {
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
        // --- DROP TABLE (reset id_x) ---
        if (action === 'drop_table') {
          await DB_LIDAN_CO_ID.prepare(`DROP TABLE IF EXISTS ${tableName}`).run();
          await createTableIfNotExists(DB_LIDAN_CO_ID, tableName);
          return new Response(JSON.stringify({ success: true, message: `Table '${tableName}' reset successfully.` }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        // --- CLEAR TABLE: DROP + recreate agar id_x reset dari 1 ---
        if (action === 'clear_table') {
          await DB_LIDAN_CO_ID.prepare(`DROP TABLE IF EXISTS ${tableName}`).run();
          await createTableIfNotExists(DB_LIDAN_CO_ID, tableName);
          return new Response(JSON.stringify({ success: true, message: `Table '${tableName}' cleared successfully.` }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
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

// GET (Filtered) - Retrieves multiple records with dynamic filters
async function getFilteredContacts(request, DB_LIDAN_CO_ID, tableName, corsHeaders) {
  const url = new URL(request.url);
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

  if (conditions.length > 0) { query += ` WHERE ${conditions.join(' AND ')}`; }
  query += ` ORDER BY id_x DESC`;

  const { results } = await DB_LIDAN_CO_ID.prepare(query).bind(...params).all();

  return new Response(JSON.stringify({
    success: true,
    table: tableName,
    count: results.length,
    data: results,
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