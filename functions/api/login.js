// hitung-cepat/functions/api/login.js

// Ini adalah endpoint handler untuk POST /api/login
// Perhatikan: Pages Functions menggunakan "context" object
// dan tidak menggunakan itty-router secara langsung di dalam file endpoint.

// Untuk demo password plaintext (SANGAT TIDAK AMAN UNTUK PRODUKSI!)
async function verifyPassword(inputPassword, storedPassword) {
    return inputPassword === storedPassword;
}

// Fungsi untuk memetakan nama kolom generik ke nama yang mudah dibaca
const mapUserToReadable = (userRow) => {
    if (!userRow) return null;
    return {
        id_user: userRow.id_x,
        username: userRow.x_01,
        password_hash: userRow.x_02,
        role: userRow.x_03,
        highest_scores_by_op: JSON.parse(userRow.x_04 || '{}'),
        last_played: userRow.x_05,
        created_at: userRow.x_06,
        updated_at: userRow.x_07,
    };
};

// PAGES FUNCTIONS HANDLER UNTUK POST REQUEST
export async function onRequestPOST(context) {
    try {
        const { request, env } = context; // Ambil request dan env dari context
        const { username, password } = await request.json();

        // AKSES D1 MENGGUNAKAN NAMA BINDING DARI WRANGLER.TOML: env.DB_LATIHAN1
        const { results } = await env.DB_LATIHAN1.prepare('SELECT * FROM users WHERE x_01 = ?').bind(username).all();

        if (!results || results.length === 0) {
            return new Response(JSON.stringify({ success: false, message: 'Invalid username or password' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        const user = mapUserToReadable(results[0]);

        const isPasswordValid = await verifyPassword(password, user.password_hash);

        if (!isPasswordValid) {
            return new Response(JSON.stringify({ success: false, message: 'Invalid username or password' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        // Update last_played timestamp
        const now = new Date().toISOString();
        await env.DB_LATIHAN1.prepare('UPDATE users SET x_05 = ?, x_07 = ? WHERE id_x = ?')
                            .bind(now, now, user.id_user)
                            .run();

        const token = user.username; // Untuk demo, token adalah username

        return new Response(JSON.stringify({
            success: true,
            message: 'Login successful',
            user: {
                id_user: user.id_user,
                username: user.username,
                role: user.role,
                highest_scores_by_op: user.highest_scores_by_op
            },
            token: token
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Login error:', error);
        return new Response(JSON.stringify({ success: false, message: error.message || 'Internal server error during login' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

// PAGES FUNCTIONS HANDLER UNTUK OPTIONS REQUEST (CORS Preflight)
export async function onRequestOPTIONS(context) {
    return new Response(null, {
        status: 204, // No Content
        headers: {
            'Access-Control-Allow-Origin': '*', // Sesuaikan dengan domain frontend Anda di produksi
            'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
        }
    });
}