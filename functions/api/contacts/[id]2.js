// functions/api/contacts/[id].js - Dynamic table version
export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  const id = params.id;
  const url = new URL(request.url);
  
  // Get table name from query parameter or header
  const tableName = url.searchParams.get('table') || request.headers.get('X-Table-Name') || 'contacts';

  console.log(`=== API [${method}] /api/contacts/${id} (table: ${tableName}) ===`);
  console.log('Request URL:', request.url);
  console.log('Params:', params);
  console.log('Method:', method);
  console.log('Table:', tableName);

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Table-Name',
  };

  // Handle preflight
  if (method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  // Check if we have DB_LATIHAN1
  if (!env.DB_LATIHAN1) {
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

  // Validate ID
  if (!id) {
    console.error('No ID provided');
    return new Response(JSON.stringify({ error: 'No ID provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    if (method === 'GET') {
      return await handleGetSingle(env.DB_LATIHAN1, tableName, id, corsHeaders);
    } else if (method === 'PUT') {
      return await handleUpdate(request, env.DB_LATIHAN1, tableName, id, corsHeaders);
    } else if (method === 'DELETE') {
      return await handleDelete(env.DB_LATIHAN1, tableName, id, corsHeaders);
    } else {
      console.log('Method not allowed:', method);
      return new Response(JSON.stringify({ error: `Method ${method} not allowed` }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  } catch (error) {
    console.error('Unhandled error:', error);
    return new Response(JSON.stringify({ 
      error: `Server error: ${error.message}`,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Security function to validate table name
function isValidTableName(tableName) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName) && tableName.length <= 50;
}

// GET single record by id_x - Dynamic table version
async function handleGetSingle(DB_LATIHAN1, tableName, id, corsHeaders) {
  console.log(`--- GET single record from ${tableName} with id_x ${id} ---`);
  
  try {
    // Check if table exists first
    const tableCheck = await DB_LATIHAN1.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name=?
    `).bind(tableName).first();
    
    if (!tableCheck) {
      return new Response(JSON.stringify({ 
        error: `Table '${tableName}' does not exist` 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    const query = `SELECT * FROM ${tableName} WHERE id_x = ?`;
    const result = await DB_LATIHAN1.prepare(query).bind(id).first();
    console.log('Get single result:', result);

    if (!result) {
      return new Response(JSON.stringify({ 
        error: `Record not found in table '${tableName}'` 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      table: tableName,
      data: result
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Get single error:', error);
    return new Response(JSON.stringify({ 
      error: `Get failed from table '${tableName}': ${error.message}`,
      stack: error.stack
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// UPDATE record by id_x - Dynamic table version
async function handleUpdate(request, DB_LATIHAN1, tableName, id, corsHeaders) {
  console.log(`--- UPDATE record ${id} in table ${tableName} ---`);
  
  try {
    // Check if table exists first
    const tableCheck = await DB_LATIHAN1.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name=?
    `).bind(tableName).first();
    
    if (!tableCheck) {
      return new Response(JSON.stringify({ 
        error: `Table '${tableName}' does not exist` 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Get request body
    const contentType = request.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Content-Type must be application/json');
    }

    const body = await request.text();
    console.log('Raw body:', body);
    
    const data = JSON.parse(body);
    console.log('Parsed data:', data);

    // Check if record exists first using id_x
    console.log('Checking if record exists...');
    const existsQuery = `SELECT id_x FROM ${tableName} WHERE id_x = ?`;
    const existsResult = await DB_LATIHAN1.prepare(existsQuery).bind(id).first();
    console.log('Exists check result:', existsResult);

    if (!existsResult) {
      return new Response(JSON.stringify({ 
        error: `Record not found in table '${tableName}'` 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Build dynamic update query for x_01 to x_20 columns
    const updateFields = [];
    const updateValues = [];
    
    for (let i = 1; i <= 20; i++) {
      const colNum = i.toString().padStart(2, '0');
      const colName = `x_${colNum}`;
      
      if (data.hasOwnProperty(colName)) {
        updateFields.push(`${colName} = ?`);
        updateValues.push(data[colName]);
      }
    }

    // Basic validation - require at least one field to update
    if (updateFields.length === 0) {
      throw new Error('At least one field (x_01 to x_20) is required for update');
    }

    // Add id for WHERE clause
    updateValues.push(id);

    // Update record
    console.log('Updating record...');
    const updateQuery = `UPDATE ${tableName} SET ${updateFields.join(', ')} WHERE id_x = ?`;
    console.log('Update query:', updateQuery);
    console.log('Update values:', updateValues);
    
    const updateResult = await DB_LATIHAN1.prepare(updateQuery).bind(...updateValues).run();
    console.log('Update result:', updateResult);

    return new Response(JSON.stringify({ 
      success: true,
      table: tableName,
      message: `Record updated successfully in table '${tableName}'`,
      changes: updateResult.changes,
      updatedFields: updateFields.map(field => field.split(' = ')[0]),
      updatedData: data
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Update error:', error);
    return new Response(JSON.stringify({ 
      error: `Update failed in table '${tableName}': ${error.message}`,
      stack: error.stack
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// DELETE record by id_x - Dynamic table version
async function handleDelete(DB_LATIHAN1, tableName, id, corsHeaders) {
  console.log(`--- DELETE record ${id} from table ${tableName} ---`);
  
  try {
    // Check if table exists first
    const tableCheck = await DB_LATIHAN1.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name=?
    `).bind(tableName).first();
    
    if (!tableCheck) {
      return new Response(JSON.stringify({ 
        error: `Table '${tableName}' does not exist` 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Check if record exists first using id_x
    console.log('Checking if record exists...');
    const existsQuery = `SELECT id_x, x_01, x_02, x_03 FROM ${tableName} WHERE id_x = ?`;
    const existsResult = await DB_LATIHAN1.prepare(existsQuery).bind(id).first();
    console.log('Exists check result:', existsResult);

    if (!existsResult) {
      return new Response(JSON.stringify({ 
        error: `Record not found in table '${tableName}'` 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Delete record using id_x
    console.log('Deleting record...');
    const deleteQuery = `DELETE FROM ${tableName} WHERE id_x = ?`;
    const deleteResult = await DB_LATIHAN1.prepare(deleteQuery).bind(id).run();
    console.log('Delete result:', deleteResult);

    return new Response(JSON.stringify({ 
      success: true,
      table: tableName,
      message: `Record deleted successfully from table '${tableName}'`,
      changes: deleteResult.changes,
      deletedRecord: existsResult
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Delete error:', error);
    return new Response(JSON.stringify({ 
      error: `Delete failed from table '${tableName}': ${error.message}`,
      stack: error.stack
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}