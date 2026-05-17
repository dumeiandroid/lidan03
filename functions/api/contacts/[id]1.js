// functions/api/contacts/[id].js - Simplified version for debugging
export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  const id = params.id;

  console.log(`=== API [${method}] /api/contacts/${id} ===`);
  console.log('Request URL:', request.url);
  console.log('Params:', params);
  console.log('Method:', method);

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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

  // Validate ID
  if (!id) {
    console.error('No ID provided');
    return new Response(JSON.stringify({ error: 'No ID provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    if (method === 'PUT') {
      return await handleUpdate(request, env.DB_LATIHAN1, id, corsHeaders);
    } else if (method === 'DELETE') {
      return await handleDelete(env.DB_LATIHAN1, id, corsHeaders);
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

async function handleUpdate(request, DB_LATIHAN1, id, corsHeaders) {
  console.log(`--- UPDATE contact ${id} ---`);
  
  try {
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

    const { name, email, message } = data;

    // Basic validation
    if (!name || !email || !message) {
      throw new Error('Missing required fields: name, email, message');
    }

    // Check if contact exists first
    console.log('Checking if contact exists...');
    const existsQuery = "SELECT id FROM contacts WHERE id = ?";
    const existsResult = await DB_LATIHAN1.prepare(existsQuery).bind(id).first();
    console.log('Exists check result:', existsResult);

    if (!existsResult) {
      return new Response(JSON.stringify({ error: 'Contact not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Update contact
    console.log('Updating contact...');
    const updateQuery = "UPDATE contacts SET name = ?, email = ?, message = ? WHERE id = ?";
    const updateResult = await DB_LATIHAN1.prepare(updateQuery).bind(name, email, message, id).run();
    console.log('Update result:', updateResult);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Contact updated successfully',
      changes: updateResult.changes,
      meta: updateResult.meta
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Update error:', error);
    return new Response(JSON.stringify({ 
      error: `Update failed: ${error.message}`,
      stack: error.stack
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleDelete(DB_LATIHAN1, id, corsHeaders) {
  console.log(`--- DELETE contact ${id} ---`);
  
  try {
    // Check if contact exists first
    console.log('Checking if contact exists...');
    const existsQuery = "SELECT id, name FROM contacts WHERE id = ?";
    const existsResult = await DB_LATIHAN1.prepare(existsQuery).bind(id).first();
    console.log('Exists check result:', existsResult);

    if (!existsResult) {
      return new Response(JSON.stringify({ error: 'Contact not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Delete contact
    console.log('Deleting contact...');
    const deleteQuery = "DELETE FROM contacts WHERE id = ?";
    const deleteResult = await DB_LATIHAN1.prepare(deleteQuery).bind(id).run();
    console.log('Delete result:', deleteResult);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Contact deleted successfully',
      changes: deleteResult.changes,
      meta: deleteResult.meta,
      deletedContact: existsResult
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Delete error:', error);
    return new Response(JSON.stringify({ 
      error: `Delete failed: ${error.message}`,
      stack: error.stack
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
