// Check API status and database mode
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/health',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Health Check Response:');
    console.log('Status:', res.statusCode);
    console.log('Body:', data);
    
    try {
      const parsed = JSON.parse(data);
      const healthData = parsed.data;
      
      console.log('\n🔍 API Analysis:');
      console.log('Backend Status:', parsed.success ? '✅ Running' : '❌ Down');
      console.log('Database:', healthData.database || 'Not specified');
      console.log('Supabase:', healthData.supabase ? '✅ Connected' : '❌ Not Connected');
      console.log('Mode:', healthData.mode || 'Not specified');
      console.log('Supabase URL:', healthData.supabaseUrl || 'Not configured');
      
      if (healthData.supabase && healthData.database === 'supabase') {
        console.log('\n🎯 CONCLUSION: Using REAL Supabase API ✅');
        console.log('✅ Real database operations');
        console.log('✅ Data persistence across restarts');
        console.log('✅ Production-ready configuration');
      } else {
        console.log('\n⚠️  CONCLUSION: Using Mock Database');
        console.log('⚠️  Data stored in memory only');
        console.log('⚠️  Data lost on server restart');
        console.log('⚠️  Development mode only');
      }
    } catch (e) {
      console.log('Failed to parse response:', e);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ API Check Failed:', e.message);
  console.log('Backend is not running or not accessible');
});

req.end();
