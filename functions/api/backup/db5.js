// functions/api/db_gbkp1.js
// =========================================================
// KONFIGURASI — hanya ubah bagian ini untuk database baru
// =========================================================
const CONFIG = {
  DB_BINDING : 'DB5',   // nama binding di Cloudflare Pages
  DB_NAME    : 'db5',   // nama database D1 (info saja)
};
// =========================================================

export async function onRequest(context) {
  const { request, env } = context;
  const db = env[CONFIG.DB_BINDING];
  const url = new URL(request.url);
  const method = request.method;

  const tableName = url.searchParams.get('table') || request.headers.get('X-Table-Name') || 'contacts';
  const idFromUrlParam = url.searchParams.get('id_x');
  const id = !isNaN(parseInt(idFromUrlParam)) ? parseInt(idFromUrlParam) : null;

  // --- KEAMANAN ---
  const origin = request.headers.get('Origin');
  const secretKey = request.headers.get('X-Custom-Auth');

  const allowedDomains = [
    'lidan.co.id',
    'lidan-co-id.pages.dev',
    'lidan-psikologi.my.id',
    'lidanpsikologi.my.id',
    'psikotest.my.id',
    'cipta.my.id',
  ];

  const mySecret = 'admin';

  const isAllowedOrigin = origin && allowedDomains.some(domain =>
    origin === `https://${domain}` ||
    origin.endsWith(`.${domain}`)
  );
  const isCorrectKey = secretKey === mySecret;

  const corsHeaders = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Table-Name, X-Custom-Auth, X-Role',
    'Access-Control-Allow-Credentials': 'true',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  if (!isValidTableName(tableName)) {
    return new Response(JSON.stringify({ error: 'Invalid table name.' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    if (method !== 'OPTIONS') {
      if (!isAllowedOrigin && !isCorrectKey) {
        return new Response(JSON.stringify({ error: 'Akses Ditolak.' }), {
          status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    const role   = request.headers.get('X-Role');
    const action = url.searchParams.get('action');

    // --- LOGIN ---
    if (method === 'POST' && action === 'login') {
      let loginData;
      try { loginData = await request.json(); }
      catch (e) {
        return new Response(JSON.stringify({ success: false, message: 'Data JSON tidak valid' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const targetTable = role === 'admin' ? 'admins' : 'users';
      await createTableIfNotExists(db, targetTable);

      const user = await db.prepare(
        `SELECT * FROM ${targetTable} WHERE x_01 = ? AND x_02 = ?`
      ).bind(loginData.username, loginData.password).first();

      if (user) {
        return new Response(JSON.stringify({ success: true, role, message: `Login ${role} berhasil`, data: user }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      return new Response(JSON.stringify({ success: false, message: 'Username atau Password Salah' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // --- LIST TABLES ---
    if (method === 'GET' && action === 'list_tables') {
      const { results } = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
      ).all();
      return new Response(JSON.stringify({ success: true, tables: results.map(r => r.name) }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if ((method === 'POST' || method === 'GET') && action !== 'login' && action !== 'list_tables') {
      await createTableIfNotExists(db, tableName);
    }

    switch (method) {
      case 'GET':
        if (id) {
          return await getContactById(db, tableName, id, corsHeaders);
        }
        return await getFilteredContacts(request, db, tableName, corsHeaders);

      case 'POST':
        return await createContact(request, db, tableName, corsHeaders);

      case 'PUT':
        if (!id) throw new Error('id_x required for PUT.');
        return await updateContact(request, db, tableName, id, corsHeaders);

      case 'DELETE':
        if (!id) throw new Error('id_x required for DELETE.');
        return await deleteContact(db, tableName, id, corsHeaders);

      default:
        return new Response(JSON.stringify({ error: `Method ${method} not allowed` }), {
          status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ── Helpers ──

function isValidTableName(name) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && name.length <= 50;
}

async function createTableIfNotExists(db, tableName) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id_x INTEGER PRIMARY KEY AUTOINCREMENT,
      x_01 TEXT, x_02 TEXT, x_03 TEXT, x_04 TEXT, x_05 TEXT,
      x_06 TEXT, x_07 TEXT, x_08 TEXT, x_09 TEXT, x_10 TEXT,
      x_11 TEXT, x_12 TEXT, x_13 TEXT, x_14 TEXT, x_15 TEXT,
      x_16 TEXT, x_17 TEXT, x_18 TEXT, x_19 TEXT, x_20 TEXT,
      x_21 TEXT, x_22 TEXT, x_23 TEXT, x_24 TEXT, x_25 TEXT
    )
  `).run();
}

async function getFilteredContacts(request, db, tableName, corsHeaders) {
  const url = new URL(request.url);
  let query = `SELECT * FROM ${tableName}`;
  const params = [];
  const conditions = [];
  const appliedFilters = {};

  const filterableColumns = ['id_x'];
  for (let i = 1; i <= 20; i++) {
    filterableColumns.push(`x_${i < 10 ? '0' : ''}${i}`);
  }

  for (const col of filterableColumns) {
    const eqValue   = url.searchParams.get(`${col}_eq`);
    const gtValue   = url.searchParams.get(`${col}_gt`);
    const ltValue   = url.searchParams.get(`${col}_lt`);
    const likeValue = url.searchParams.get(`${col}_like`);
    const neValue   = url.searchParams.get(`${col}_ne`);

    if (eqValue !== null)   { conditions.push(`${col} = ?`);    params.push(eqValue);           appliedFilters[`${col}_eq`]   = eqValue; }
    if (gtValue !== null)   { conditions.push(`${col} > ?`);    params.push(gtValue);           appliedFilters[`${col}_gt`]   = gtValue; }
    if (ltValue !== null)   { conditions.push(`${col} < ?`);    params.push(ltValue);           appliedFilters[`${col}_lt`]   = ltValue; }
    if (likeValue !== null) { conditions.push(`${col} LIKE ?`); params.push(`%${likeValue}%`); appliedFilters[`${col}_like`] = likeValue; }
    if (neValue !== null)   { conditions.push(`${col} != ?`);   params.push(neValue);           appliedFilters[`${col}_ne`]   = neValue; }
  }

  if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
  query += ` ORDER BY id_x DESC LIMIT 500`;

  const { results } = await db.prepare(query).bind(...params).all();

  return new Response(JSON.stringify({
    success: true, table: tableName, count: results.length,
    data: results, filter: appliedFilters
  }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function getContactById(db, tableName, id, corsHeaders) {
  const { results } = await db.prepare(`SELECT * FROM ${tableName} WHERE id_x = ?`).bind(id).all();
  if (results.length === 0) {
    return new Response(JSON.stringify({ success: false, message: `id_x ${id} not found` }), {
      status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  return new Response(JSON.stringify({ success: true, table: tableName, data: results[0] }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function createContact(request, db, tableName, corsHeaders) {
  let data;
  try { data = await request.json(); } catch (e) { throw new Error('Invalid JSON.'); }

  const columns = [], values = [], placeholders = [];
  for (let i = 1; i <= 20; i++) {
    const col = `x_${i.toString().padStart(2,'0')}`;
    if (data.hasOwnProperty(col)) {
      columns.push(col);
      values.push(data[col] === '' ? null : data[col]);
      placeholders.push('?');
    }
  }
  if (columns.length === 0) throw new Error('At least one field required.');

  const result = await db.prepare(
    `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`
  ).bind(...values).run();

  return new Response(JSON.stringify({
    success: true, table: tableName, id_x: result.meta.last_row_id,
    message: 'Created', insertedFields: columns
  }), { status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function updateContact(request, db, tableName, id, corsHeaders) {
  let data;
  try { data = await request.json(); } catch (e) { throw new Error('Invalid JSON.'); }

  const setClauses = [], values = [];
  for (let i = 1; i <= 25; i++) {
    const col = `x_${i.toString().padStart(2,'0')}`;
    if (data.hasOwnProperty(col)) {
      setClauses.push(`${col} = ?`);
      values.push(data[col] === '' ? null : data[col]);
    }
  }
  if (setClauses.length === 0) throw new Error('At least one field required.');

  values.push(id);
  const result = await db.prepare(
    `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id_x = ?`
  ).bind(...values).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ success: false, message: `id_x ${id} not found` }), {
      status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  return new Response(JSON.stringify({ success: true, table: tableName, id_x: id, message: 'Updated' }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function deleteContact(db, tableName, id, corsHeaders) {
  const result = await db.prepare(`DELETE FROM ${tableName} WHERE id_x = ?`).bind(id).run();
  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ success: false, message: `id_x ${id} not found` }), {
      status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  return new Response(JSON.stringify({ success: true, table: tableName, id_x: id, message: 'Deleted' }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}