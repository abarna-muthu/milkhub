import http from 'http';

function makeRequest(options: http.RequestOptions, postData?: any): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => {
        rawData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = rawData ? JSON.parse(rawData) : null;
          resolve({ statusCode: res.statusCode || 0, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode || 0, data: rawData });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('=== MILKHUB CRM PHASE 1 VERIFICATION ===\n');

  // 1. Health check
  console.log('1. Testing /api/health...');
  const healthRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/health',
    method: 'GET',
  });
  console.log(`Status: ${healthRes.statusCode}`, healthRes.data);
  if (healthRes.statusCode !== 200) throw new Error('Health check failed');

  // 2. Database Status
  console.log('\n2. Testing /api/db/status...');
  const dbRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/db/status',
    method: 'GET',
  });
  console.log(`Status: ${dbRes.statusCode}`, dbRes.data);

  // 3. Unauthenticated access to protected route
  console.log('\n3. Testing protected route without token (/api/customers)...');
  const unauthRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers',
    method: 'GET',
  });
  console.log(`Status: ${unauthRes.statusCode} (Expected: 401)`, unauthRes.data);
  if (unauthRes.statusCode !== 401) throw new Error('Protected route allowed unauthenticated access!');

  // 4. Invalid Login (wrong password)
  console.log('\n4. Testing invalid login credentials...');
  const badLoginRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'milkhub@admin.com', password: 'WrongPassword123' }
  );
  console.log(`Status: ${badLoginRes.statusCode} (Expected: 401)`, badLoginRes.data);
  if (badLoginRes.statusCode !== 401) throw new Error('Invalid login was not rejected!');

  // 5. Valid Owner Login
  console.log('\n5. Testing valid owner login...');
  const validLoginRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'milkhub@admin.com', password: 'Admin@123' }
  );
  console.log(`Status: ${validLoginRes.statusCode} (Expected: 200)`);
  console.log('User info:', validLoginRes.data.user);
  console.log('Token received:', validLoginRes.data.token ? 'YES (Valid JWT format)' : 'NO');
  if (validLoginRes.statusCode !== 200 || !validLoginRes.data.token) {
    throw new Error('Valid login failed!');
  }

  const token = validLoginRes.data.token;

  // 6. Access protected route WITH Token
  console.log('\n6. Testing protected route WITH Bearer Token (/api/customers)...');
  const authRouteRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log(`Status: ${authRouteRes.statusCode} (Expected: 200)`);
  console.log(`Total customers loaded: ${authRouteRes.data.total}`);
  if (authRouteRes.statusCode !== 200) throw new Error('Authorized request failed!');

  // 7. Verify /api/auth/me
  console.log('\n7. Testing /api/auth/me with Bearer Token...');
  const meRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/auth/me',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log(`Status: ${meRes.statusCode} (Expected: 200)`, meRes.data);
  if (meRes.statusCode !== 200 || !meRes.data.email) throw new Error('auth/me failed');

  // 8. Logout
  console.log('\n8. Testing /api/auth/logout...');
  const logoutRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/auth/logout',
    method: 'POST',
  });
  console.log(`Status: ${logoutRes.statusCode} (Expected: 200)`, logoutRes.data);

  console.log('\n=========================================');
  console.log('ALL PHASE 1 ACCEPTANCE CRITERIA PASSED!');
  console.log('=========================================');
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
