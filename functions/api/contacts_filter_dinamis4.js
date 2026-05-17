// functions/api/contacts_filter_dinamis.js - Comprehensive API (CRUD + Dynamic Filter)
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

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Table-Name',
  };

  // Handle preflight (OPTIONS method)
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

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
    // Pastikan tabel ada sebelum melakukan operasi CRUD
    await createTableIfNotExists(DB_LIDAN_CO_ID, tableName);

    switch (method) {
      case 'GET':
        if (id) { // Menggunakan 'id' yang sekarang dari query parameter
          // Jika ada ID di URL, ambil satu record
          return await getContactById(DB_LIDAN_CO_ID, tableName, id, corsHeaders);
        } else {
          // Jika tidak ada ID, lakukan filtering dinamis untuk multiple records
          return await getFilteredContacts(request, DB_LIDAN_CO_ID, tableName, corsHeaders);
        }
      case 'POST':
        return await createContact(request, DB_LIDAN_CO_ID, tableName, corsHeaders);
      case 'PUT':
        if (!id) { // Menggunakan 'id'
          throw new Error('Record ID (id_x query parameter) is required for PUT operation.');
        }
        return await updateContact(request, DB_LIDAN_CO_ID, tableName, id, corsHeaders);
      case 'DELETE':
        if (!id) { // Menggunakan 'id'
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
      stack: error.stack // Menyertakan stack trace untuk debugging lebih mudah
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// === Helper Functions ===

// Security function to validate table name
function isValidTableName(tableName) {
  // Hanya izinkan karakter alfanumerik dan garis bawah, dan pastikan tidak kosong
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
      x_16 TEXT, x_17 TEXT, x_18 TEXT, x_19 TEXT, x_20 TEXT
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
  const generalConditions = []; // Untuk filter selain LIKE
  const likeConditions = [];    // Untuk filter LIKE

  const appliedFilters = {};

  // Daftar kolom yang bisa difilter
  const filterableColumns = ['id_x'];
  for (let i = 1; i <= 20; i++) {
      filterableColumns.push(`x_${i < 10 ? '0' : ''}${i}`);
  }

  for (const col of filterableColumns) {
      // Filter _eq (equal)
      const eqValue = url.searchParams.get(`${col}_eq`);
      if (eqValue !== null) { generalConditions.push(`${col} = ?`); params.push(eqValue); appliedFilters[`${col}_eq`] = eqValue; }
      
      // Filter _gt (greater than)
      const gtValue = url.searchParams.get(`${col}_gt`);
      if (gtValue !== null) {
          const parsedValue = (col === 'id_x' || col.startsWith('x_')) ? parseFloat(gtValue) : gtValue;
          if (!isNaN(parsedValue) || typeof parsedValue === 'string') { // Allow string comparison for text fields
              generalConditions.push(`${col} > ?`); params.push(parsedValue); appliedFilters[`${col}_gt`] = gtValue;
          } else { throw new Error(`Invalid numeric value for ${col}_gt`); }
      }
      
      // Filter _lt (less than)
      const ltValue = url.searchParams.get(`${col}_lt`);
      if (ltValue !== null) {
          const parsedValue = (col === 'id_x' || col.startsWith('x_')) ? parseFloat(ltValue) : ltValue;
          if (!isNaN(parsedValue) || typeof parsedValue === 'string') { // Allow string comparison for text fields
              generalConditions.push(`${col} < ?`); params.push(parsedValue); appliedFilters[`${col}_lt`] = ltValue;
          } else { throw new Error(`Invalid numeric value for ${col}_lt`); }
      }
      
      // Filter _ne (not equal)
      // Perbaikan: Mendukung multiple _ne untuk kolom yang sama (misal x_13_ne=&x_13_ne=0)
      const neValues = url.searchParams.getAll(`${col}_ne`);
      if (neValues.length > 0) {
          // Buat kondisi OR untuk multiple _ne, lalu gabungkan dengan AND ke generalConditions
          const colNeConditions = neValues.map(val => {
              params.push(val);
              return `${col} != ?`;
          });
          generalConditions.push(`(${colNeConditions.join(' AND ')})`); // Menggunakan AND untuk multiple _ne dari kolom yang sama
          appliedFilters[`${col}_ne`] = neValues;
      }
      
      // Filter _like (contains) - Perbaikan untuk menggabungkan dengan OR
      // Pastikan likeValue tidak kosong sebelum menambahkan ke likeConditions
      const likeValue = url.searchParams.get(`${col}_like`);
      if (likeValue !== null && likeValue !== '') { // Added check for empty string
          likeConditions.push(`${col} LIKE ?`); 
          params.push(`%${likeValue}%`); 
          appliedFilters[`${col}_like`] = likeValue; 
      }
  }

  // Gabungkan kondisi LIKE dengan OR, lalu tambahkan ke generalConditions
  if (likeConditions.length > 0) {
      generalConditions.push(`(${likeConditions.join(' OR ')})`);
  }

  if (generalConditions.length > 0) { query += ` WHERE ${generalConditions.join(' AND ')}`; }
  
  // Tambahkan limit dan offset
  const limit = parseInt(url.searchParams.get('limit')) || null;
  const offset = parseInt(url.searchParams.get('offset')) || 0;

  // --- DEBUGGING LOG ---
  console.log('--- API Query Debug ---');
  console.log('Generated SQL Query (main):', query);
  console.log('Parameters (main):', JSON.stringify(params));
  console.log('--- End API Query Debug ---');
  // --- END DEBUGGING LOG ---

  // Hitung total count tanpa limit/offset untuk pagination info
  let countQuery = `SELECT COUNT(*) as total FROM ${tableName}`;
  const countParams = [];
  // Perlu membangun kondisi untuk count query secara terpisah dari limit/offset
  const countConditions = [];
  const countLikeConditions = [];

  for (const col of filterableColumns) {
      const eqValue = url.searchParams.get(`${col}_eq`);
      if (eqValue !== null) { countConditions.push(`${col} = ?`); countParams.push(eqValue); }
      
      const gtValue = url.searchParams.get(`${col}_gt`);
      if (gtValue !== null) {
          const parsedValue = (col === 'id_x' || col.startsWith('x_')) ? parseFloat(gtValue) : gtValue;
          if (!isNaN(parsedValue) || typeof parsedValue === 'string') {
              countConditions.push(`${col} > ?`); countParams.push(parsedValue);
          }
      }
      
      const ltValue = url.searchParams.get(`${col}_lt`);
      if (ltValue !== null) {
          const parsedValue = (col === 'id_x' || col.startsWith('x_')) ? parseFloat(ltValue) : ltValue;
          if (!isNaN(parsedValue) || typeof parsedValue === 'string') {
              countConditions.push(`${col} < ?`); countParams.push(parsedValue);
          }
      }
      
      const neValues = url.searchParams.getAll(`${col}_ne`);
      if (neValues.length > 0) {
          const colNeConditions = neValues.map(val => {
              countParams.push(val);
              return `${col} != ?`;
          });
          countConditions.push(`(${colNeConditions.join(' AND ')})`);
      }
      
      const likeValueForCount = url.searchParams.get(`${col}_like`); // Use a different variable name
      if (likeValueForCount !== null && likeValueForCount !== '') { // Added check for empty string
          countLikeConditions.push(`${col} LIKE ?`); 
          countParams.push(`%${likeValueForCount}%`); 
      }
  }

  if (countLikeConditions.length > 0) {
      countConditions.push(`(${countLikeConditions.join(' OR ')})`);
  }

  if (countConditions.length > 0) { countQuery += ` WHERE ${countConditions.join(' AND ')}`; }

  // --- DEBUGGING LOG ---
  console.log('Generated SQL Query (count):', countQuery);
  console.log('Parameters (count):', JSON.stringify(countParams));
  // --- End API Query Debug ---
  // --- END DEBUGGING LOG ---

  const { results: countResults } = await DB_LIDAN_CO_ID.prepare(countQuery).bind(...countParams).all();
  const totalCount = countResults.length > 0 ? countResults[0].total : 0;

  const { results } = await DB_LIDAN_CO_ID.prepare(query).bind(...params).all();

  return new Response(JSON.stringify({
    success: true,
    table: tableName,
    count: totalCount, // Mengembalikan total count yang difilter
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
      // Perbaikan: Jika nilai adalah string kosong, simpan sebagai NULL di DB
      values.push(requestData[colName] === '' ? null : requestData[colName]);
      placeholders.push('?');
    }
  }

  if (columns.length === 0) {
    throw new Error('At least one field (x_01 to x_20) is required for creation.');
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

  for (let i = 1; i <= 20; i++) {
    const colNum = i.toString().padStart(2, '0');
    const colName = `x_${colNum}`;
    if (requestData.hasOwnProperty(colName)) {
      setClauses.push(`${colName} = ?`);
      // Perbaikan: Jika nilai adalah string kosong, simpan sebagai NULL di DB
      values.push(requestData[colName] === '' ? null : requestData[colName]);
    }
  }

  if (setClauses.length === 0) {
    throw new Error('At least one field (x_01 to x_20) is required for update.');
  }

  values.push(id); // Tambahkan ID ke akhir values untuk klausa WHERE
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
