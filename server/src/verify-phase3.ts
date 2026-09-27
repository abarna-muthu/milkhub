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

async function runPhase3Verification() {
  console.log('====================================================');
  console.log('  MILK BUSINESS CRM - PHASE 3 VERIFICATION SUITE   ');
  console.log('  Morning & Evening Delivery Workflow              ');
  console.log('  Pre-fill, Actual Qty Edit & 0L No Milk Support   ');
  console.log('  Rule: Customer default quantity NEVER changes    ');
  console.log('====================================================\n');

  // 1. Health check - Phase 3
  console.log('1. Testing GET /api/health for Phase 3...');
  const healthRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/health',
    method: 'GET',
  });
  console.log(`Status: ${healthRes.statusCode}`, healthRes.data);
  if (healthRes.statusCode !== 200 || !healthRes.data?.phase?.includes('Phase 3')) {
    throw new Error('Health check failed for Phase 3');
  }

  // 2. Authenticate Owner
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

  // 3. Unauthorized check
  console.log('\n3. Testing GET /api/deliveries without token (Expected: 401)...');
  const unauthRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/deliveries',
    method: 'GET',
  });
  console.log(`Status: ${unauthRes.statusCode} (Expected: 401)`);
  if (unauthRes.statusCode !== 401) {
    throw new Error('Unauthenticated access was unexpectedly permitted');
  }

  // 4. Create a dedicated test customer with Default Morning = 1.0L and Default Evening = 2.0L
  console.log('\n4. Creating test customer for Phase 3 workflow...');
  const testCustomerPayload = {
    name: 'Ravi Chandran',
    phone: '9840889900',
    address: '22 South Street',
    area: 'Central Colony',
    default_morning_qty: 1.0,
    default_evening_qty: 2.0,
    rate: 60.0,
    start_date: '2026-09-27',
    status: 'active',
  };

  const createCustRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/customers',
      method: 'POST',
      headers: authHeaders,
    },
    testCustomerPayload
  );
  if (createCustRes.statusCode !== 201) {
    throw new Error('Failed to create test customer');
  }
  const testCustomer = createCustRes.data.customer || createCustRes.data;
  console.log(`Test Customer Created: ID=${testCustomer.id}, Morning Default=${testCustomer.default_morning_qty}L, Evening Default=${testCustomer.default_evening_qty}L`);

  const testDate = '2026-09-27';

  // 5. Test Pre-fill in Morning session
  console.log(`\n5. Testing Pre-fill for Morning Delivery on ${testDate}...`);
  const morningListRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/deliveries?date=${testDate}&session=morning`,
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`Status: ${morningListRes.statusCode}, Total customers in morning: ${morningListRes.data.total}`);
  if (morningListRes.statusCode !== 200 || !Array.isArray(morningListRes.data.deliveries)) {
    throw new Error('Failed to fetch morning deliveries');
  }

  const morningEntry = morningListRes.data.deliveries.find((d: any) => d.customer_id === testCustomer.id);
  if (!morningEntry) {
    throw new Error('Test customer not found in morning deliveries');
  }
  console.log(`Morning Pre-fill: default_qty=${morningEntry.default_qty}L, actual_qty=${morningEntry.actual_qty}L, is_saved=${morningEntry.is_saved}`);
  if (Number(morningEntry.default_qty) !== 1.0 || Number(morningEntry.actual_qty) !== 1.0) {
    throw new Error('Morning delivery was not pre-filled with customer default morning quantity (1.0L)');
  }

  // 6. Test Pre-fill in Evening session
  console.log(`\n6. Testing Pre-fill for Evening Delivery on ${testDate}...`);
  const eveningListRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/deliveries?date=${testDate}&session=evening`,
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`Status: ${eveningListRes.statusCode}, Total customers in evening: ${eveningListRes.data.total}`);
  const eveningEntry = eveningListRes.data.deliveries.find((d: any) => d.customer_id === testCustomer.id);
  if (!eveningEntry) {
    throw new Error('Test customer not found in evening deliveries');
  }
  console.log(`Evening Pre-fill: default_qty=${eveningEntry.default_qty}L, actual_qty=${eveningEntry.actual_qty}L, is_saved=${eveningEntry.is_saved}`);
  if (Number(eveningEntry.default_qty) !== 2.0 || Number(eveningEntry.actual_qty) !== 2.0) {
    throw new Error('Evening delivery was not pre-filled with customer default evening quantity (2.0L)');
  }

  // 7. CRITICAL TEST CASE 1: Default 1.0L -> Actual 1.5L
  console.log('\n7. CRITICAL TEST CASE 1: Edit Morning Delivery: Default 1.0L -> Today Actual 1.5L...');
  const save15Res = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/deliveries',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: testCustomer.id,
      date: testDate,
      session: 'morning',
      actual_qty: 1.5,
      status: 'delivered',
    }
  );
  console.log(`Status: ${save15Res.statusCode} (Expected: 201)`);
  if (save15Res.statusCode !== 201) {
    throw new Error('Failed to save delivery with 1.5L');
  }

  // VERIFY RULE: Customer default quantity must NEVER be changed!
  console.log('Checking customer record in database to verify default is UNCHANGED...');
  const custCheck1 = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/customers/${testCustomer.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  const currentCust1 = custCheck1.data.customer || custCheck1.data;
  console.log(`Customer Default Morning Qty after today's 1.5L delivery: ${currentCust1.default_morning_qty}L`);
  if (Number(currentCust1.default_morning_qty) !== 1.0) {
    throw new Error(`CRITICAL BUSINESS RULE VIOLATION: Customer default morning qty was changed from 1.0 to ${currentCust1.default_morning_qty}`);
  }
  console.log('✓ PASS: Today actual qty = 1.5L, Customer default remains 1.0L intact!');

  // 8. CRITICAL TEST CASE 2: Duplicate Prevention & Update
  console.log('\n8. CRITICAL TEST CASE 2: Update same delivery to 0.5L (Ensuring no duplicate records)...');
  const save05Res = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/deliveries',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: testCustomer.id,
      date: testDate,
      session: 'morning',
      actual_qty: 0.5,
      status: 'delivered',
    }
  );
  if (save05Res.statusCode !== 201) {
    throw new Error('Failed to update delivery');
  }

  // Verify list has exactly 1 entry for this customer with 0.5L
  const listCheck2 = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/deliveries?date=${testDate}&session=morning`,
    method: 'GET',
    headers: authHeaders,
  });
  const matchingEntries = listCheck2.data.deliveries.filter((d: any) => d.customer_id === testCustomer.id);
  console.log(`Matching records for customer ${testCustomer.id}: ${matchingEntries.length}`);
  if (matchingEntries.length !== 1 || Number(matchingEntries[0].actual_qty) !== 0.5) {
    throw new Error('Duplicate delivery record created or incorrect actual_qty');
  }
  console.log('✓ PASS: Exactly 1 record updated to 0.5L without duplicates!');

  // 9. CRITICAL TEST CASE 3: 0L and No Milk Support
  console.log('\n9. CRITICAL TEST CASE 3: Record 0L with No Milk status...');
  const saveNoMilkRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/deliveries',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: testCustomer.id,
      date: testDate,
      session: 'morning',
      actual_qty: 0,
      status: 'no_milk',
    }
  );
  if (saveNoMilkRes.statusCode !== 201) {
    throw new Error('Failed to save no_milk delivery');
  }
  const savedNoMilk = saveNoMilkRes.data.delivery || saveNoMilkRes.data;
  console.log(`Saved Delivery: actual_qty=${savedNoMilk.actual_qty}L, status=${savedNoMilk.status}`);
  if (Number(savedNoMilk.actual_qty) !== 0 || savedNoMilk.status !== 'no_milk') {
    throw new Error(`Expected actual_qty=0 and status=no_milk, got qty=${savedNoMilk.actual_qty}, status=${savedNoMilk.status}`);
  }
  console.log('✓ PASS: 0L supported and status set to no_milk!');

  // Verify customer default is STILL 1.0L
  const custCheck3 = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/customers/${testCustomer.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  const currentCust3 = custCheck3.data.customer || custCheck3.data;
  if (Number(currentCust3.default_morning_qty) !== 1.0) {
    throw new Error('Customer default quantity changed after 0L delivery');
  }

  // 10. Test Case 4: Bulk Save Deliveries
  console.log('\n10. Testing Bulk Deliveries Save (POST /api/deliveries/bulk)...');
  const bulkPayload = {
    deliveries: [
      {
        customer_id: testCustomer.id,
        date: testDate,
        session: 'morning',
        actual_qty: 2.25,
        status: 'delivered',
      },
      {
        customer_id: testCustomer.id,
        date: testDate,
        session: 'evening',
        actual_qty: 1.75,
        status: 'delivered',
      },
    ],
  };

  const bulkRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/deliveries/bulk',
      method: 'POST',
      headers: authHeaders,
    },
    bulkPayload
  );
  console.log(`Status: ${bulkRes.statusCode} (Expected: 200)`);
  if (bulkRes.statusCode !== 200 || bulkRes.data.count !== 2) {
    throw new Error('Bulk delivery save failed');
  }

  // Verify morning summary calculation
  console.log('\n11. Testing Delivery Session Summary totals...');
  const morningFinalRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/deliveries?date=${testDate}&session=morning`,
    method: 'GET',
    headers: authHeaders,
  });
  console.log('Morning Summary:', morningFinalRes.data.summary);
  if (!morningFinalRes.data.summary || morningFinalRes.data.summary.total_qty <= 0) {
    throw new Error('Summary calculation failed');
  }

  console.log('\n======================================================');
  console.log('  SUCCESS: ALL PHASE 3 VERIFICATION CHECKS PASSED!    ');
  console.log('  - Deliveries table created                          ');
  console.log('  - Pre-fill with customer default quantities         ');
  console.log('  - Morning & Evening sessions independent            ');
  console.log('  - Today actual qty editable without altering defaults');
  console.log('  - 0L supported with No Milk status                  ');
  console.log('  - Single and Bulk delivery save supported           ');
  console.log('  - Duplicate prevention verified                     ');
  console.log('======================================================\n');
}

runPhase3Verification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
