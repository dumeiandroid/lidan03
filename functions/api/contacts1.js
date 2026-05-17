// functions/api/contacts.js - Complete CRUD API
export async function onRequest(context) {
  const { request, env } = context;
  const { DB_LATIHAN1 } = env;
  const method = request.method;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  // Handle preflight
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Debug logging
  console.log(`API ${method} request to /api/contacts`);
  
  try {
    switch (method) {
      case 'GET':
        return await getContacts(DB_LATIHAN1, corsHeaders);
      case 'POST':
        return await createContact(request, DB_LATIHAN1, corsHeaders);
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

// GET all contacts
async function getContacts(DB_LATIHAN1, corsHeaders) {
  console.log('Getting all contacts...');
  const { results } = await DB_LATIHAN1.prepare("SELECT * FROM contacts ORDER BY created_at DESC").all();
  console.log(`Found ${results.length} contacts`);
  
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// POST create contact
async function createContact(request, DB_LATIHAN1, corsHeaders) {
  console.log('Creating new contact...');
  
  let requestData;
  try {
    requestData = await request.json();
    console.log('Request data:', requestData);
  } catch (error) {
    throw new Error('Invalid JSON data');
  }
  
  const { name, email, message } = requestData;
  
  // Validation
  if (!name || !email || !message) {
    throw new Error('Name, email, and message are required');
  }
  
  if (!email.includes('@')) {
    throw new Error('Invalid email format');
  }
  
  try {
    const result = await DB_LATIHAN1.prepare(
      "INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)"
    ).bind(name.trim(), email.trim(), message.trim()).run();
    
    console.log('Insert result:', result);
    
    return new Response(JSON.stringify({ 
      success: true, 
      id: result.meta.last_row_id,
      message: 'Contact created successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (dbError) {
    console.error('Database error:', dbError);
    throw new Error('Failed to save contact to database');
  }
}
