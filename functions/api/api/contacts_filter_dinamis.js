// functions/api/contacts_filter_dinamis.js - Dynamic filtering for GET requests
export async function onRequest(context) {
  const { request, env } = context;
  const { DB_LIDAN_CO_ID } = env;
  const url = new URL(request.url);
  const method = request.method;

  // Dapatkan nama tabel dari parameter URL atau header
  const tableName = url.searchParams.get('table') || request.headers.get('X-Table-Name') || 'contacts';

  // Header CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Table-Name',
  };

  // Tangani permintaan preflight (OPTIONS)
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204, // Status 204 No Content untuk preflight yang berhasil
      headers: corsHeaders
    });
  }

  // Periksa ketersediaan database
  if (!DB_LIDAN_CO_ID) {
    console.error('Database tidak tersedia');
    return new Response(JSON.stringify({ error: 'Database tidak tersedia' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Validasi nama tabel (keamanan)
  if (!isValidTableName(tableName)) {
    return new Response(JSON.stringify({
      error: 'Nama tabel tidak valid. Hanya karakter alfanumerik dan garis bawah yang diizinkan.'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  if (method === 'GET') {
    try {
      // Periksa apakah tabel ada, jika tidak, buat
      const tableCheck = await DB_LIDAN_CO_ID.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name=?
      `).bind(tableName).first();

      if (!tableCheck) {
        await createTableIfNotExists(DB_LIDAN_CO_ID, tableName);
      }

      let query = `SELECT * FROM ${tableName}`;
      const params = [];
      const conditions = [];
      const orConditionsUntukX = []; // Array untuk menampung kondisi OR untuk x_13/x_14

      // Filter: id_x kurang dari nilai tertentu (misal: id_x_less_than=10)
      const idXKurangDari = url.searchParams.get('id_x_less_than');
      if (idXKurangDari) {
        const nilai = parseInt(idXKurangDari);
        if (!isNaN(nilai)) {
          conditions.push(`id_x < ?`);
          params.push(nilai);
        } else {
          return new Response(JSON.stringify({ error: 'Nilai tidak valid untuk id_x_less_than' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      // Filter: x_13 tidak kosong/0 (parameter: x_13_tidak_kosong_atau_nol=true)
      const x13TidakKosongAtauNol = url.searchParams.get('x_13_tidak_kosong_atau_nol');
      if (x13TidakKosongAtauNol === 'true') {
        orConditionsUntukX.push(`(x_13 IS NOT NULL AND x_13 != '' AND x_13 != '0')`);
      }

      // Filter: x_14 tidak kosong/0 (parameter: x_14_tidak_kosong_atau_nol=true)
      const x14TidakKosongAtauNol = url.searchParams.get('x_14_tidak_kosong_atau_nol');
      if (x14TidakKosongAtauNol === 'true') {
        orConditionsUntukX.push(`(x_14 IS NOT NULL AND x_14 != '' AND x_14 != '0')`);
      }

      // Gabungkan kondisi x_13 dan x_14 dengan OR, lalu tambahkan ke kondisi utama
      if (orConditionsUntukX.length > 0) {
        conditions.push(`(${orConditionsUntukX.join(' OR ')})`);
      }

      // Tambahkan klausa WHERE jika ada kondisi
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY id_x DESC`; // Urutkan hasil

      console.log(`Menjalankan kueri filter: ${query} dengan params: ${params}`);
      const { results } = await DB_LIDAN_CO_ID.prepare(query).bind(...params).all();

      return new Response(JSON.stringify({
        success: true,
        table: tableName,
        count: results.length,
        data: results,
        filter: { // Echo kembali filter yang diterapkan
          id_x_less_than: idXKurangDari,
          x_13_tidak_kosong_atau_nol: x13TidakKosongAtauNol,
          x_14_tidak_kosong_atau_nol: x14TidakKosongAtauNol
        }
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Error API Filter:', error);
      return new Response(JSON.stringify({
        error: `Gagal mendapatkan data yang difilter dari tabel '${tableName}': ${error.message}`,
        stack: error.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  } else {
    return new Response(JSON.stringify({ error: `Metode ${method} tidak diizinkan` }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Fungsi keamanan untuk memvalidasi nama tabel
function isValidTableName(tableName) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName) && tableName.length <= 50;
}

// Fungsi untuk membuat tabel jika belum ada (digunakan kembali dari file API lain)
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
  console.log(`Tabel '${tableName}' dibuat atau sudah ada`);
}
