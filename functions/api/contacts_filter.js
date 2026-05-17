// functions/api/contacts_filter.js - Dynamic filter for GET requests
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS', // Only GET and OPTIONS for this filter endpoint
    'Access-Control-Allow-Headers': 'Content-Type, X-Table-Name',
  };

  // Handle preflight
  if (method === 'OPTIONS') {
    // KOREKSI: Pastikan status 204 No Content untuk preflight yang sukses
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
        // If table doesn't exist, try to create it (similar to other endpoints)
        await createTableIfNotExists(DB_LIDAN_CO_ID, tableName);
      }

      let query = `SELECT * FROM ${tableName}`;
      const params = [];
      const conditions = [];

      // Dynamic filtering based on URL parameters
      // Example: ?id_x_less_than=10
      const idXLessThan = url.searchParams.get('id_x_less_than');
      if (idXLessThan) {
        const value = parseInt(idXLessThan);
        if (!isNaN(value)) {
          conditions.push(`id_x < ?`);
          params.push(value);
        } else {
          return new Response(JSON.stringify({ error: 'Invalid value for id_x_less_than' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      // Add more dynamic filters here if needed
      // Example: ?x_01_equals=value
      // const x01Equals = url.searchParams.get('x_01_equals');
      // if (x01Equals) {
      //   conditions.push(`x_01 = ?`);
      //   params.push(x01Equals);
      // }


      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY id_x DESC`; // Add ordering

      console.log(`Executing filter query: ${query} with params: ${params}`);
      const { results } = await DB_LIDAN_CO_ID.prepare(query).bind(...params).all();

      return new Response(JSON.stringify({
        success: true,
        table: tableName,
        count: results.length,
        data: results,
        filter: { id_x_less_than: idXLessThan } // Echo back applied filter
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
