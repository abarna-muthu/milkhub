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

async function runPhase2Verification() {
  console.log('=== MILKHUB CRM PHASE 2 VERIFICATION ===\n');

  // 1. Owner Login
  console.log('1. Authenticating Owner...');
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

  if (loginRes.statusCode !== 200 || !loginRes.data?.token) {
    throw new Error('Owner login failed. Check server status.');
  }

  const token = loginRes.data.token;
  console.log('Owner authenticated. JWT Token obtained.');

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 2. Collection Centers - List Centers
  console.log('\n2. Testing GET /api/centers...');
  const listCentersRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/centers',
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`Status: ${listCentersRes.statusCode}, Initial centers count: ${listCentersRes.data.length}`);
  if (listCentersRes.statusCode !== 200) throw new Error('Failed to list centers');

  // 3. Collection Centers - Add New Center
  console.log('\n3. Testing POST /api/centers (Add Center)...');
  const addCenterRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/centers',
      method: 'POST',
      headers: authHeaders,
    },
    {
      center_name: 'Srivilliputtur East Center',
      location: 'Alagarkoil Road, Srivilliputtur',
      code: 'SVPE',
      phone: '9842199991',
    }
  );
  console.log(`Status: ${addCenterRes.statusCode}, Created Center:`, addCenterRes.data);
  if (addCenterRes.statusCode !== 201 || !addCenterRes.data.id) {
    throw new Error('Failed to create collection center');
  }

  const createdCenterId = addCenterRes.data.id;

  // 4. Collection Centers - Edit Center
  console.log('\n4. Testing PATCH /api/centers/:id (Edit Center)...');
  const patchCenterRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/centers/${createdCenterId}`,
      method: 'PATCH',
      headers: authHeaders,
    },
    {
      location: 'Alagarkoil Main Road, Srivilliputtur Town',
    }
  );
  console.log(`Status: ${patchCenterRes.statusCode}, Updated Center Location: ${patchCenterRes.data.location}`);
  if (patchCenterRes.statusCode !== 200) throw new Error('Failed to update center');

  // 5. Collection Centers - Activate/Deactivate Center
  console.log('\n5. Testing PATCH /api/centers/:id (Deactivate Center)...');
  const deactCenterRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/centers/${createdCenterId}`,
      method: 'PATCH',
      headers: authHeaders,
    },
    { status: 'inactive' }
  );
  console.log(`Status: ${deactCenterRes.statusCode}, Center Status: ${deactCenterRes.data.status}`);
  if (deactCenterRes.data.status !== 'inactive') throw new Error('Failed to deactivate center');

  // Re-activate for supplier assignment
  await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/centers/${createdCenterId}`,
      method: 'PATCH',
      headers: authHeaders,
    },
    { status: 'active' }
  );
  console.log('Center re-activated.');

  // 6. Customers / Milk Suppliers - Add Supplier
  console.log('\n6. Testing POST /api/customers (Add Supplier assigned to Center)...');
  const addSupplierRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/customers',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_code: 'SUP999',
      name: 'Suresh Kumar',
      phone: '9876543299',
      address: '42 South Street',
      area: 'Srivilliputtur',
      center_id: createdCenterId,
      cow_count: 2,
      buffalo_count: 1,
      default_morning_qty: 1.25,
      default_evening_qty: 0.75,
      rate: 60.0,
      start_date: '2026-09-26',
      status: 'active',
    }
  );
  console.log(`Status: ${addSupplierRes.statusCode}, Created Supplier:`, {
    id: addSupplierRes.data.id,
    code: addSupplierRes.data.customer_code,
    name: addSupplierRes.data.name,
    center_id: addSupplierRes.data.center_id,
    default_morning: addSupplierRes.data.default_morning_qty,
    default_evening: addSupplierRes.data.default_evening_qty,
    rate: addSupplierRes.data.rate,
  });

  if (addSupplierRes.statusCode !== 201 || !addSupplierRes.data.id) {
    throw new Error('Failed to create customer/supplier');
  }

  const createdSupplierId = addSupplierRes.data.id;

  // 7. Customers - Edit Supplier
  console.log('\n7. Testing PATCH /api/customers/:id (Edit Supplier Rate and Phone)...');
  const patchCustRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/customers/${createdSupplierId}`,
      method: 'PATCH',
      headers: authHeaders,
    },
    {
      phone: '9876543288',
      rate: 62.0,
    }
  );
  console.log(`Status: ${patchCustRes.statusCode}, New Rate: ${patchCustRes.data.rate}, Phone: ${patchCustRes.data.phone}`);
  if (patchCustRes.statusCode !== 200 || patchCustRes.data.rate !== 62.0) {
    throw new Error('Failed to update supplier');
  }

  // 8. Search Supplier (by Name, Phone, Code, Area)
  console.log('\n8. Testing Search functionality (GET /api/customers?search=...)...');
  const searchNameRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers?search=Suresh',
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`Search 'Suresh': found ${searchNameRes.data.total} records`);
  if (searchNameRes.data.total === 0) throw new Error('Search by name failed');

  const searchCodeRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers?search=SUP999',
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`Search 'SUP999': found ${searchCodeRes.data.total} records`);
  if (searchCodeRes.data.total === 0) throw new Error('Search by code failed');

  const searchAreaRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers?search=Srivilliputtur',
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`Search Area 'Srivilliputtur': found ${searchAreaRes.data.total} records`);
  if (searchAreaRes.data.total === 0) throw new Error('Search by area failed');

  // 9. Filter by Center
  console.log('\n9. Testing Filter by Center (GET /api/customers?center_id=...)...');
  const filterCenterRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/customers?center_id=${createdCenterId}`,
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`Filter by new center: found ${filterCenterRes.data.total} records`);
  if (filterCenterRes.data.total !== 1) throw new Error('Filter by center failed');

  // 10. Deactivate Supplier (DELETE /api/customers/:id)
  console.log('\n10. Testing Deactivate Supplier (DELETE /api/customers/:id)...');
  const deleteCustRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/customers/${createdSupplierId}`,
    method: 'DELETE',
    headers: authHeaders,
  });
  console.log(`Status: ${deleteCustRes.statusCode}`, deleteCustRes.data);
  if (deleteCustRes.statusCode !== 200 || deleteCustRes.data.status !== 'inactive') {
    throw new Error('Deactivation failed');
  }

  // 11. Verify Filter by Status (Inactive)
  console.log('\n11. Testing Filter by Status=inactive...');
  const filterStatusRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/customers?status=inactive',
    method: 'GET',
    headers: authHeaders,
  });
  const foundInactive = filterStatusRes.data.customers.some((c: any) => c.id === createdSupplierId);
  console.log(`Status=inactive filter returned deactivated supplier: ${foundInactive ? 'YES' : 'NO'}`);
  if (!foundInactive) throw new Error('Inactive status filter failed');

  // 12. Verify single customer details persist
  console.log('\n12. Testing GET /api/customers/:id (Single Supplier Detail)...');
  const singleCustRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/customers/${createdSupplierId}`,
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`Status: ${singleCustRes.statusCode}, Retrieved Name: ${singleCustRes.data.customer.name}, Status: ${singleCustRes.data.customer.status}`);
  if (singleCustRes.statusCode !== 200) throw new Error('Single customer lookup failed');

  console.log('\n=========================================');
  console.log('ALL PHASE 2 ACCEPTANCE CRITERIA PASSED!');
  console.log('=========================================');
}

runPhase2Verification().catch((err) => {
  console.error('\nPhase 2 Verification failed:', err);
  process.exit(1);
});
