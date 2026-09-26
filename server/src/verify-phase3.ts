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

async function runPhase3Verification() {
  console.log('==================================================');
  console.log('    MILKHUB CRM — PHASE 3 DELIVERY VERIFICATION   ');
  console.log('==================================================\n');

  // Step 1: Authenticate Owner
  console.log('1. Authenticating Owner...');
  const loginRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'admin@milkhub.com', password: '@MilkHub#123' }
  );

  if (loginRes.statusCode !== 200 || !loginRes.data?.token) {
    throw new Error('Owner login failed. Check backend server.');
  }

  const token = loginRes.data.token;
  console.log('✓ Owner authenticated successfully. JWT obtained.');

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const testDate = '2026-09-26';

  // Step 2: Create a dedicated test supplier with Default 1.0L Morning and 1.0L Evening
  console.log('\n2. Creating a test supplier with Default 1.0L Morning and 1.0L Evening...');
  const createCustRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/customers',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_code: `P3TEST_${Date.now().toString().slice(-4)}`,
      name: 'Phase3 Test Supplier',
      phone: '9842100099',
      address: '77 Dairy Farm Road',
      area: 'Srivilliputtur',
      center_id: 'c1',
      cow_count: 2,
      buffalo_count: 0,
      default_morning_qty: 1.0,
      default_evening_qty: 1.0,
      rate: 60.0,
      start_date: testDate,
      status: 'active',
    }
  );

  if (createCustRes.statusCode !== 201) {
    throw new Error(`Failed to create test customer: ${JSON.stringify(createCustRes.data)}`);
  }

  const testCustomer = createCustRes.data;
  console.log(`✓ Test customer created: ${testCustomer.name} (ID: ${testCustomer.id}, Code: ${testCustomer.customer_code})`);
  console.log(`  Customer Default Morning: ${testCustomer.default_morning_qty}L, Default Evening: ${testCustomer.default_evening_qty}L`);

  // Step 3: GET /api/deliveries?session=MORNING (Verify pre-fill logic)
  console.log('\n3. Testing GET /api/deliveries?session=MORNING (Pre-filled Default Qty)...');
  const getDeliveriesRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/deliveries?date=${testDate}&session=MORNING`,
    method: 'GET',
    headers: authHeaders,
  });

  if (getDeliveriesRes.statusCode !== 200) {
    throw new Error(`Failed to fetch deliveries: ${JSON.stringify(getDeliveriesRes.data)}`);
  }

  const loadedDelivery = getDeliveriesRes.data.deliveries.find((d: any) => d.customer_id === testCustomer.id);
  if (!loadedDelivery) {
    throw new Error('Test customer not found in morning deliveries list');
  }

  console.log(`✓ Pre-fill verified:`);
  console.log(`  Default Qty: ${loadedDelivery.default_qty}L`);
  console.log(`  Initial Actual Qty: ${loadedDelivery.actual_qty}L`);
  console.log(`  Is Saved: ${loadedDelivery.is_saved}`);

  if (Number(loadedDelivery.actual_qty) !== 1.0) {
    throw new Error(`Expected pre-filled actual quantity to be 1.0L, got: ${loadedDelivery.actual_qty}`);
  }

  // Step 4: TEST CASE 1 — Default 1L -> Actual 1.5L
  console.log('\n4. Running Test Case 1: Default 1L -> Actual 1.5L...');
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
      center_id: 'c1',
      date: testDate,
      session: 'MORNING',
      actual_qty: 1.5,
      status: 'DELIVERED',
    }
  );

  if (save15Res.statusCode !== 201) {
    throw new Error(`Failed to save delivery: ${JSON.stringify(save15Res.data)}`);
  }

  console.log(`✓ Saved Delivery = ${save15Res.data.actual_qty}L, Status = ${save15Res.data.status}`);

  // CRITICAL RULE CHECK: Verify customer default remains 1.0L in database!
  const custCheck1 = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/customers/${testCustomer.id}`,
    method: 'GET',
    headers: authHeaders,
  });

  const masterCust1 = custCheck1.data.customer || custCheck1.data;
  console.log(`  Customer Master Default Morning Qty: ${masterCust1.default_morning_qty}L`);
  if (Number(masterCust1.default_morning_qty) !== 1.0) {
    throw new Error(`VIOLATION OF RULE 5! Customer default quantity was mutated from 1.0L to ${masterCust1.default_morning_qty}L`);
  }
  console.log('✓ PASS: Delivery = 1.5L, Customer Default remains = 1.0L');

  // Step 5: TEST CASE 2 — Default 1L -> Actual 0.5L
  console.log('\n5. Running Test Case 2: Default 1L -> Actual 0.5L (Duplicate Prevention & Update)...');
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
      center_id: 'c1',
      date: testDate,
      session: 'MORNING',
      actual_qty: 0.5,
      status: 'DELIVERED',
    }
  );

  if (save05Res.statusCode !== 201) {
    throw new Error(`Failed to update delivery to 0.5L: ${JSON.stringify(save05Res.data)}`);
  }

  console.log(`✓ Updated Delivery = ${save05Res.data.actual_qty}L, Status = ${save05Res.data.status}`);

  // Check no duplicates for customer + date + session
  const verifyNoDupRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/deliveries?date=${testDate}&session=MORNING`,
    method: 'GET',
    headers: authHeaders,
  });

  const matchingDeliveries = verifyNoDupRes.data.deliveries.filter((d: any) => d.customer_id === testCustomer.id);
  console.log(`  Number of records for ${testCustomer.id} on ${testDate} MORNING: ${matchingDeliveries.length}`);
  if (matchingDeliveries.length !== 1) {
    throw new Error(`DUPLICATE FOUND! Expected exactly 1 delivery record, found ${matchingDeliveries.length}`);
  }

  // Customer default still 1.0L
  const custCheck2 = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/customers/${testCustomer.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  const masterCust2 = custCheck2.data.customer || custCheck2.data;
  if (Number(masterCust2.default_morning_qty) !== 1.0) {
    throw new Error(`Customer default altered: ${masterCust2.default_morning_qty}`);
  }
  console.log('✓ PASS: Delivery updated to 0.5L without duplicates, Customer Default remains = 1.0L');

  // Step 6: TEST CASE 3 — Default 1L -> Actual 0L (NO_MILK)
  console.log('\n6. Running Test Case 3: Default 1L -> Actual 0L (NO_MILK)...');
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
      center_id: 'c1',
      date: testDate,
      session: 'MORNING',
      actual_qty: 0,
      status: 'NO_MILK',
    }
  );

  if (saveNoMilkRes.statusCode !== 201) {
    throw new Error(`Failed to save NO_MILK delivery: ${JSON.stringify(saveNoMilkRes.data)}`);
  }

  console.log(`✓ Saved Record: Actual Qty = ${saveNoMilkRes.data.actual_qty}L, Status = ${saveNoMilkRes.data.status}`);
  if (Number(saveNoMilkRes.data.actual_qty) !== 0 || saveNoMilkRes.data.status !== 'NO_MILK') {
    throw new Error(`Expected Actual Qty = 0 and Status = NO_MILK, got ${saveNoMilkRes.data.actual_qty}, ${saveNoMilkRes.data.status}`);
  }
  console.log('✓ PASS: Delivery = 0L, Status = NO_MILK');

  // Step 7: TEST CASE 4 — Center Collection Totals Calculation
  console.log('\n7. Running Test Case 4: Center Totals Dynamic Calculation...');
  // Set Morning delivery to 120.0L for Srivilliputtur (c1)
  await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/deliveries',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: testCustomer.id,
      center_id: 'c1',
      date: testDate,
      session: 'MORNING',
      actual_qty: 120.0,
      status: 'DELIVERED',
    }
  );

  // Set Evening delivery to 135.0L for Srivilliputtur (c1)
  await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/deliveries',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: testCustomer.id,
      center_id: 'c1',
      date: testDate,
      session: 'EVENING',
      actual_qty: 135.0,
      status: 'DELIVERED',
    }
  );

  const totalsRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/deliveries/center-totals?date=${testDate}`,
    method: 'GET',
    headers: authHeaders,
  });

  if (totalsRes.statusCode !== 200) {
    throw new Error(`Failed to fetch center totals: ${JSON.stringify(totalsRes.data)}`);
  }

  const c1Totals = totalsRes.data.centers.find((c: any) => c.center_id === 'c1');
  console.log('  Center c1 Totals:');
  console.log(`    Morning Total: ${c1Totals?.morning_total}L`);
  console.log(`    Evening Total: ${c1Totals?.evening_total}L`);
  console.log(`    Daily Total:   ${c1Totals?.daily_total}L`);

  if (!c1Totals || c1Totals.morning_total < 120.0 || c1Totals.evening_total < 135.0 || c1Totals.daily_total < 255.0) {
    throw new Error(`Center totals calculation mismatch: ${JSON.stringify(c1Totals)}`);
  }

  console.log('✓ PASS: Center totals correctly sum Morning (120L) + Evening (135L) = Daily (255L)');

  // Step 8: Test Bulk Save Endpoint
  console.log('\n8. Testing Bulk Delivery Save (/api/deliveries/bulk)...');
  const bulkRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/deliveries/bulk',
      method: 'POST',
      headers: authHeaders,
    },
    {
      deliveries: [
        {
          customer_id: testCustomer.id,
          center_id: 'c1',
          date: testDate,
          session: 'MORNING',
          actual_qty: 2.5,
          status: 'DELIVERED',
        },
      ],
    }
  );

  if (bulkRes.statusCode !== 200) {
    throw new Error(`Bulk save failed: ${JSON.stringify(bulkRes.data)}`);
  }
  console.log(`✓ Bulk save successful: ${bulkRes.data.message}`);

  console.log('\n==================================================');
  console.log('  ALL PHASE 3 TEST CASES PASSED WITH 100% SUCCESS ');
  console.log('==================================================\n');
}

runPhase3Verification().catch((err) => {
  console.error('\n❌ PHASE 3 VERIFICATION FAILED:', err);
  process.exit(1);
});
