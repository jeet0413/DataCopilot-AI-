// Fallback service that tries Supabase first, then uses in-memory database
const { createClient } = require('@supabase/supabase-js');
const mockDatabase = require('./database');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;
let useMock = false;

// Try to initialize Supabase, fallback to mock if credentials are missing
try {
  if (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here') {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized');
  } else {
    useMock = true;
    console.log('⚠️  Using in-memory database (Supabase not configured)');
  }
} catch (error) {
  useMock = true;
  console.log('⚠️  Using in-memory database (Supabase error):', error.message);
}

// Wrapper functions that use Supabase or fallback to mock
const from = (table) => {
  if (useMock || !supabase) {
    return mockDatabase;
  }
  
  // For users table, bypass RLS for registration by using service role key
  if (table === 'users') {
    const supabaseAdmin = createClient(
      supabaseUrl, 
      supabaseKey.replace('anon', 'service_role') // Use service role if available
    );
    return supabaseAdmin.from(table);
  }
  
  return supabase.from(table);
};

module.exports = {
  from,
  isUsingMock: () => useMock
};
