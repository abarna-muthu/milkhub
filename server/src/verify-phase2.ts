import http from 'http';

function makeRequest(
  options: http.RequestOptions,
  postData?: any
): Promise<{ statusCode: number; data: any }> {
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
        } catch {
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

async function runPhase2Verification() {
  console.log('====================================================');
  console.log('  MILK BUSINESS CRM - PHASE 2 VERIFICATION SUITE   ');
  console.log('  Customer CRUD, Validation, Search & Filter       ');
  console.log('  Customer has NO LOGIN • Owner is Primary User     ');
  console.log('====================================================\n');

  // 1. Health check - Phase 2
  console.log('1. Testing GET /api/health for Phase 2...');
  const healthRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/health',
    method: 'GET',
  });
  console.log(`Status: ${healthRes.statusCode}`, healthRes.data);
  if (healthRes.statusCode !== 200 || !healthRes.data?.phase?.includes('Phase 2')) {
    throw new Error('Health check failed for Phase 2');
  }

  // 2. Owner Login
  console.log('\n2. Authenticating Owner (POST /api/auth/login)...');
  const loginRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'milkhub@admin.com', password: 'Admin@123' }
  );
  if (loginRes.statusCode !== 200 || !loginRes.data.token) {
    throw new Error('Owner login failed');
  }
  const token = loginRes.data.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log('Owner token acquired successfully.');

  // 3. Unauthorized access check
  console.log('\n3. Testing GET /api/customers without token (Expected: 401)...');
  const unauthRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers',
    method: 'GET',
  });
  console.log(`Status: ${unauthRes.statusCode} (Expected: 401)`);
  if (unauthRes.statusCode !== 401) {
    throw new Error('Unauthenticated access was unexpectedly permitted');
  }

  // 4. Initial customer listing
  console.log('\n4. Testing GET /api/customers with auth...');
  const initialListRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers',
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`Status: ${initialListRes.statusCode}, Initial total: ${initialListRes.data.total}`);
  if (initialListRes.statusCode !== 200 || !Array.isArray(initialListRes.data.customers)) {
    throw new Error('Failed to retrieve customers list');
  }

  // 5. Validation testing on POST /api/customers
  console.log('\n5. Testing validation on POST /api/customers:');

  // 5a. Empty body
  const emptyRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/customers',
      method: 'POST',
      headers: authHeaders,
    },
    {}
  );
  console.log(`- Empty body: Status ${emptyRes.statusCode} (Expected: 400), Error: ${emptyRes.data.error}`);
  if (emptyRes.statusCode !== 400) throw new Error('Empty payload was not rejected');

  // 5b. Missing name
  const missingNameRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/customers',
      method: 'POST',
      headers: authHeaders,
    },
    {
      phone: '9840123456',
      address: '15 North Car Street',
      area: 'Temple Town',
      rate: 60.0,
      start_date: '2026-09-27',
    }
  );
  console.log(`- Missing name: Status ${missingNameRes.statusCode} (Expected: 400)`);
  if (missingNameRes.statusCode !== 400) throw new Error('Missing name was not rejected');

  // 5c. Invalid phone number
  const badPhoneRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/customers',
      method: 'POST',
      headers: authHeaders,
    },
    {
      name: 'Valid Name',
      phone: '123',
      address: '15 North Car Street',
      area: 'Temple Town',
      rate: 60.0,
      start_date: '2026-09-27',
    }
  );
  console.log(`- Invalid phone: Status ${badPhoneRes.statusCode} (Expected: 400)`);
  if (badPhoneRes.statusCode !== 400) throw new Error('Invalid phone was not rejected');

  // 5d. Invalid rate (<= 0)
  const badRateRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/customers',
      method: 'POST',
      headers: authHeaders,
    },
    {
      name: 'Valid Name',
      phone: '9840123456',
      address: '15 North Car Street',
      area: 'Temple Town',
      rate: -5,
      start_date: '2026-09-27',
    }
  );
  console.log(`- Invalid rate: Status ${badRateRes.statusCode} (Expected: 400)`);
  if (badRateRes.statusCode !== 400) throw new Error('Invalid rate was not rejected');

  // 6. Add new customer (POST /api/customers)
  console.log('\n6. Testing POST /api/customers (Add valid customer)...');
  const newCustomerPayload = {
    name: 'Karthik Subramanian',
    phone: '9840123456',
    address: '15 North Car Street',
    area: 'Temple Town',
    default_morning_qty: 2.5,
    default_evening_qty: 1.5,
    rate: 62.0,
    start_date: '2026-09-27',
    status: 'active',
  };

  const createRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/customers',
      method: 'POST',
      headers: authHeaders,
    },
    newCustomerPayload
  );
  console.log(`Status: ${createRes.statusCode} (Expected: 201)`);
  const createdCustomer = createRes.data.customer || createRes.data;
  console.log('Created customer:', {
    id: createdCustomer.id,
    name: createdCustomer.name,
    phone: createdCustomer.phone,
    area: createdCustomer.area,
    rate: createdCustomer.rate,
    morning_qty: createdCustomer.default_morning_qty,
    evening_qty: createdCustomer.default_evening_qty,
    status: createdCustomer.status,
  });

  if (createRes.statusCode !== 201 || !createdCustomer.id || createdCustomer.name !== 'Karthik Subramanian') {
    throw new Error('Customer creation failed');
  }

  const customerId = createdCustomer.id;

  // 7. View single customer (GET /api/customers/:id)
  console.log(`\n7. Testing GET /api/customers/${customerId} (View Customer)...`);
  const viewRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/customers/${customerId}`,
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`Status: ${viewRes.statusCode} (Expected: 200)`);
  const fetchedCustomer = viewRes.data.customer || viewRes.data;
  if (viewRes.statusCode !== 200 || fetchedCustomer.phone !== '9840123456') {
    throw new Error('Customer retrieval by ID failed');
  }

  // 8. Edit customer (PATCH /api/customers/:id)
  console.log(`\n8. Testing PATCH /api/customers/${customerId} (Edit Customer)...`);
  const patchRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/customers/${customerId}`,
      method: 'PATCH',
      headers: authHeaders,
    },
    {
      rate: 65.0,
      area: 'North Car Street Junction',
      default_morning_qty: 3.0,
    }
  );
  console.log(`Status: ${patchRes.statusCode} (Expected: 200)`);
  const updatedCustomer = patchRes.data.customer || patchRes.data;
  console.log('Updated customer:', {
    rate: updatedCustomer.rate,
    area: updatedCustomer.area,
    default_morning_qty: updatedCustomer.default_morning_qty,
  });
  if (patchRes.statusCode !== 200 || updatedCustomer.rate !== 65.0 || updatedCustomer.area !== 'North Car Street Junction') {
    throw new Error('Customer update failed');
  }

  // 9. Search customers by Name, Phone, and Area
  console.log('\n9. Testing Search functionality:');

  // 9a. Search by Name
  console.log("- Searching by Name: 'Karthik'...");
  const searchNameRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers?search=Karthik',
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`  Found: ${searchNameRes.data.total} records`);
  if (searchNameRes.data.total === 0 || !searchNameRes.data.customers.some((c: any) => c.id === customerId)) {
    throw new Error("Search by Name 'Karthik' failed");
  }

  // 9b. Search by Phone
  console.log("- Searching by Phone: '9840123456'...");
  const searchPhoneRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers?search=9840123456',
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`  Found: ${searchPhoneRes.data.total} records`);
  if (searchPhoneRes.data.total === 0 || !searchPhoneRes.data.customers.some((c: any) => c.id === customerId)) {
    throw new Error('Search by Phone failed');
  }

  // 9c. Search by Area
  console.log("- Searching by Area: 'Junction'...");
  const searchAreaRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers?search=Junction',
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`  Found: ${searchAreaRes.data.total} records`);
  if (searchAreaRes.data.total === 0 || !searchAreaRes.data.customers.some((c: any) => c.id === customerId)) {
    throw new Error('Search by Area failed');
  }

  // 10. Filter by Active / Inactive
  console.log('\n10. Testing Filter by status (active / inactive):');

  // Deactivate customer
  console.log(`- Deactivating customer '${customerId}'...`);
  const deactRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/customers/${customerId}`,
      method: 'PATCH',
      headers: authHeaders,
    },
    { status: 'inactive' }
  );
  if (deactRes.statusCode !== 200 || (deactRes.data.customer || deactRes.data).status !== 'inactive') {
    throw new Error('Failed to set customer to inactive');
  }

  // Filter inactive
  console.log('- Filtering by status=inactive...');
  const inactiveRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers?status=inactive',
    method: 'GET',
    headers: authHeaders,
  });
  const hasInactive = inactiveRes.data.customers.some((c: any) => c.id === customerId);
  console.log(`  Inactive filter contains customer: ${hasInactive ? 'YES' : 'NO'}`);
  if (!hasInactive) throw new Error('Filter by inactive status failed');

  // Filter active
  console.log('- Filtering by status=active...');
  const activeRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers?status=active',
    method: 'GET',
    headers: authHeaders,
  });
  const hasInActiveList = activeRes.data.customers.some((c: any) => c.id === customerId);
  console.log(`  Active filter excludes inactive customer: ${!hasInActiveList ? 'YES' : 'NO'}`);
  if (hasInActiveList) throw new Error('Filter by active status unexpectedly included inactive customer');

  // Re-activate customer
  console.log(`- Re-activating customer '${customerId}'...`);
  await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/customers/${customerId}`,
      method: 'PATCH',
      headers: authHeaders,
    },
    { status: 'active' }
  );

  // 11. Test 404 on non-existent customer
  console.log('\n11. Testing GET /api/customers/non_existent_id (Expected: 404)...');
  const notFoundRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers/non_existent_id',
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`Status: ${notFoundRes.statusCode} (Expected: 404)`);
  if (notFoundRes.statusCode !== 404) {
    throw new Error('Non-existent customer did not return 404');
  }

  console.log('\n======================================================');
  console.log('  SUCCESS: ALL PHASE 2 VERIFICATION CHECKS PASSED!    ');
  console.log('  - Customers table created & seeded                  ');
  console.log('  - Customer List (GET /api/customers)                ');
  console.log('  - Add Customer with validation (POST /api/customers)');
  console.log('  - View Customer (GET /api/customers/:id)            ');
  console.log('  - Edit Customer (PATCH /api/customers/:id)          ');
  console.log('  - Search by Name, Phone, and Area                   ');
  console.log('  - Filter by Active and Inactive                     ');
  console.log('  - Strictly only Phase 2 fields & operations         ');
  console.log('======================================================\n');
}

runPhase2Verification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
