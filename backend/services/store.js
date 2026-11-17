// Data-access layer for users and dataset metadata.
//
//   mode 'supabase' - persistent, used when SUPABASE_URL and a key are configured
//   mode 'memory'   - explicit development fallback when Supabase is NOT configured
//                     (refused when NODE_ENV=production). Data is lost on restart.
//
// There is deliberately no automatic fallback from Supabase to memory when a query fails:
// silently switching stores hid errors and could expose other users' data.
const crypto = require('node:crypto');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

const PLACEHOLDERS = new Set(['', 'your_supabase_url_here', 'your_supabase_anon_key_here', 'your_anon_key_here']);

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  // The backend is a trusted server and enforces ownership itself, so it should use the
  // service-role key. SUPABASE_KEY (anon) is accepted for backwards compatibility.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key || PLACEHOLDERS.has(url) || PLACEHOLDERS.has(key)) return null;
  return { url, key };
}

// ---------------------------------------------------------------------------
// In-memory implementation (development only)
// ---------------------------------------------------------------------------
function createMemoryStore() {
  const users = new Map(); // id -> user
  const datasets = new Map(); // id -> dataset

  return {
    mode: 'memory',
    users: {
      async findByEmail(email) {
        for (const u of users.values()) if (u.email === email) return { ...u };
        return null;
      },
      async findById(id) {
        const u = users.get(id);
        return u ? { ...u } : null;
      },
      async create(data) {
        const user = {
          id: crypto.randomUUID(),
          avatar_url: null,
          provider: 'email',
          plan: 'free',
          created_at: new Date().toISOString(),
          last_login: null,
          ...data,
        };
        users.set(user.id, user);
        return { ...user };
      },
      async touchLogin(id) {
        const u = users.get(id);
        if (u) u.last_login = new Date().toISOString();
      },
    },
    datasets: {
      async list(userId) {
        return [...datasets.values()]
          .filter((d) => d.user_id === userId)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .map((d) => ({ ...d }));
      },
      async get(id, userId) {
        const d = datasets.get(id);
        return d && d.user_id === userId ? { ...d } : null;
      },
      async create(data) {
        const dataset = { created_at: new Date().toISOString(), ...data };
        datasets.set(dataset.id, dataset);
        return { ...dataset };
      },
      async remove(id, userId) {
        const d = datasets.get(id);
        if (!d || d.user_id !== userId) return null;
        datasets.delete(id);
        return { ...d };
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------
function createSupabaseStore({ url, key }) {
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const unwrap = ({ data, error }) => {
    if (error) {
      const err = new Error(error.message || 'Database error');
      err.code = error.code;
      throw err;
    }
    return data;
  };

  return {
    mode: 'supabase',
    users: {
      async findByEmail(email) {
        return unwrap(await client.from('users').select('*').eq('email', email).maybeSingle());
      },
      async findById(id) {
        if (!isUuid(id)) return null;
        return unwrap(await client.from('users').select('*').eq('id', id).maybeSingle());
      },
      async create(data) {
        return unwrap(await client.from('users').insert([data]).select().single());
      },
      async touchLogin(id) {
        unwrap(await client.from('users').update({ last_login: new Date().toISOString() }).eq('id', id));
      },
    },
    datasets: {
      async list(userId) {
        if (!isUuid(userId)) return [];
        return unwrap(
          await client.from('datasets').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        ) || [];
      },
      async get(id, userId) {
        if (!isUuid(id) || !isUuid(userId)) return null;
        return unwrap(await client.from('datasets').select('*').eq('id', id).eq('user_id', userId).maybeSingle());
      },
      async create(data) {
        return unwrap(await client.from('datasets').insert([data]).select().single());
      },
      async remove(id, userId) {
        if (!isUuid(id) || !isUuid(userId)) return null;
        const rows = unwrap(await client.from('datasets').delete().eq('id', id).eq('user_id', userId).select());
        return rows && rows.length ? rows[0] : null;
      },
    },
  };
}

// ---------------------------------------------------------------------------
let instance;

function getStore() {
  if (instance) return instance;
  const config = supabaseConfig();
  if (config) {
    instance = createSupabaseStore(config);
    console.log('✅ Using Supabase for users and dataset metadata');
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Refusing to start in production.');
  } else {
    instance = createMemoryStore();
    console.warn('⚠️  Supabase not configured: using the in-memory store (development only, data is lost on restart).');
  }
  return instance;
}

function resetStoreForTests() {
  instance = undefined;
}

module.exports = { getStore, resetStoreForTests, createMemoryStore, isUuid };
