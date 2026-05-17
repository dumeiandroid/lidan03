// functions/api/contacts_filter_dinamis.js - Dynamic filter for GET requests
export async function onRequest(context) {
  const { request, env } = context;
  const { DB_LIDAN_CO_ID } = env;
  const url = new URL(request.url);
  const method = request.method;

  // Get table name from query parameter or header
  const tableName = url.searchParams.get('table') || request.headers.get('X-Table-Name') || 'contacts';

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Table-Name',
  };

  // Handle preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204, // Status 204 No Content
      headers: corsHeaders
    });
  }

  // Check if we have DB_LIDAN_CO_ID
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

  if (method === 'GET') {
    try {
      // Check if table exists first
      const tableCheck = await DB_LIDAN_CO_ID.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name=?
      `).bind(tableName).first();

      if (!tableCheck) {
        // If table doesn't exist, try to create it
        await createTableIfNotExists(DB_LIDAN_CO_ID, tableName);
      }

      let query = `SELECT * FROM ${tableName}`;
      const params = [];
      const conditions = [];
      const appliedFilters = {};

      // --- START DYNAMIC FILTERING LOGIC ---
      const filterableColumns = ['id_x'];
      // Menambahkan x_01 hingga x_20 ke daftar kolom yang bisa difilter
      for (let i = 1; i <= 20; i++) {
          filterableColumns.push(`x_${i < 10 ? '0' : ''}${i}`);
      }

      for (const col of filterableColumns) {
          // Equals filter (e.g., ?x_01_eq=value)
          const eqValue = url.searchParams.get(`${col}_eq`);
          if (eqValue !== null) {
              conditions.push(`${col} = ?`);
              params.push(eqValue);
              appliedFilters[`${col}_eq`] = eqValue;
          }

          // Greater than filter (e.g., ?id_x_gt=10 or ?x_05_gt=100)
          const gtValue = url.searchParams.get(`${col}_gt`);
          if (gtValue !== null) {
              // Mencoba parse sebagai float untuk perbandingan numerik, jika gagal gunakan string
              const parsedValue = (col === 'id_x' || col.startsWith('x_')) ? parseFloat(gtValue) : gtValue;
              if (!isNaN(parsedValue) || typeof parsedValue === 'string') {
                  conditions.push(`${col} > ?`);
                  params.push(parsedValue);
                  appliedFilters[`${col}_gt`] = gtValue;
              } else {
                  return new Response(JSON.stringify({ error: `Invalid numeric value for ${col}_gt` }), {
                      status: 400,
                      headers: { 'Content-Type': 'application/json', ...corsHeaders }
                  });
              }
          }

          // Less than filter (e.g., ?id_x_lt=10 or ?x_05_lt=50)
          const ltValue = url.searchParams.get(`${col}_lt`);
          if (ltValue !== null) {
              // Mencoba parse sebagai float untuk perbandingan numerik, jika gagal gunakan string
              const parsedValue = (col === 'id_x' || col.startsWith('x_')) ? parseFloat(ltValue) : ltValue;
              if (!isNaN(parsedValue) || typeof parsedValue === 'string') {
                  conditions.push(`${col} < ?`);
                  params.push(parsedValue);
                  appliedFilters[`${col}_lt`] = ltValue;
              } else {
                  return new Response(JSON.stringify({ error: `Invalid numeric value for ${col}_lt` }), {
                      status: 400,
                      headers: { 'Content-Type': 'application/json', ...corsHeaders }
                  });
              }
          }

          // Like (contains) filter (e.g., ?x_01_like=buah)
          const likeValue = url.searchParams.get(`${col}_like`);
          if (likeValue !== null) {
              conditions.push(`${col} LIKE ?`);
              params.push(`%${likeValue}%`); // Tambahkan wildcard untuk pencarian 'mengandung'
              appliedFilters[`${col}_like`] = likeValue;
          }

          // Not Equals filter (e.g., ?x_01_ne=value) - BARU DITAMBAHKAN
          const neValue = url.searchParams.get(`${col}_ne`);
          if (neValue !== null) {
              conditions.push(`${col} != ?`);
              params.push(neValue);
              appliedFilters[`${col}_ne`] = neValue;
          }
      }
      // --- END DYNAMIC FILTERING LOGIC ---

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY id_x DESC`; // Order data by id_x in descending order

      console.log(`Executing filter query: ${query} with params: ${params}`);
      const { results } = await DB_LIDAN_CO_ID.prepare(query).bind(...params).all();

      return new Response(JSON.stringify({
        success: true,
        table: tableName,
        count: results.length,
        data: results,
        filter: appliedFilters // Echo back all applied filters for debugging
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Filter API Error:', error);
      return new Response(JSON.stringify({
        error: `Failed to get filtered data from table '${tableName}': ${error.message}`,
        stack: error.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  } else {
    return new Response(JSON.stringify({ error: `Method ${method} not allowed` }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Security function to validate table name
function isValidTableName(tableName) {
  // Hanya izinkan karakter alfanumerik dan garis bawah, dan pastikan tidak kosong
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName) && tableName.length <= 50;
}

// Function to create table if not exists (reused from other API files)
async function createTableIfNotExists(DB_LIDAN_CO_ID, tableName) {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id_x INTEGER PRIMARY KEY AUTOINCREMENT,
      x_01 TEXT,
      x_02 TEXT,
      x_03 TEXT,
      x_04 TEXT,
      x_05 TEXT,
      x_06 TEXT,
      x_07 TEXT,
      x_08 TEXT,
      x_09 TEXT,
      x_10 TEXT,
      x_11 TEXT,
      x_12 TEXT,
      x_13 TEXT,
      x_14 TEXT,
      x_15 TEXT,
      x_16 TEXT,
      x_17 TEXT,
      x_18 TEXT,
      x_19 TEXT,
      x_20 TEXT
    )
  `;

  await DB_LIDAN_CO_ID.prepare(createTableQuery).run();
  console.log(`Table '${tableName}' created or already exists`);
}