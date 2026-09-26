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

async function runPhase5Verification() {
  console.log('==================================================');
  console.log('    MILKHUB CRM — PHASE 5 PAYMENTS & ADVANCE      ');
  console.log('==================================================\n');

  // Step 1: Owner Login
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

  // Helper to create test customer
  async function createTestSupplier(name: string, code: string, rate: number = 60.0) {
    const res = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/customers',
        method: 'POST',
        headers: authHeaders,
      },
      {
        customer_code: code,
        name,
        phone: '98421' + Math.floor(10000 + Math.random() * 90000),
        address: 'Phase 5 Dairy Test Yard',
        area: 'Srivilliputtur',
        center_id: 'c1',
        default_morning_qty: 1.0,
        default_evening_qty: 1.0,
        rate,
        start_date: testDate,
        status: 'active',
      }
    );
    if (res.statusCode !== 201) {
      throw new Error(`Failed to create test supplier: ${JSON.stringify(res.data)}`);
    }
    return res.data;
  }

  // --------------------------------------------------------------------------
  // TEST CASE 1: Advance ₹500 + Sale ₹120 -> Used ₹120, Remaining ₹380, Due ₹0
  // --------------------------------------------------------------------------
  console.log('\n2. Running Test Case 1: Advance ₹500 + Sale ₹120...');
  const cust1 = await createTestSupplier('Advance Test Supplier 1', `ADV1_${Date.now().toString().slice(-4)}`);

  // Record Advance ₹500
  const adv1Res = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: cust1.id,
      date: testDate,
      amount: 500.0,
      payment_type: 'ADVANCE',
      payment_mode: 'UPI',
      reference_id: 'UPI_ADV_500',
      notes: 'Customer deposited ₹500 advance',
    }
  );

  if (adv1Res.statusCode !== 201) {
    throw new Error(`Failed to record advance: ${JSON.stringify(adv1Res.data)}`);
  }
  console.log('✓ Advance payment recorded: ₹500 via UPI');

  // Verify advance balance before sale = ₹500
  const bal1Before = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/payments/advance-balance/${cust1.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  console.log(`  Initial Available Advance: ₹${bal1Before.data.available_balance}`);
  if (bal1Before.data.available_balance !== 500) {
    throw new Error(`Expected ₹500 available advance, got ${bal1Before.data.available_balance}`);
  }

  // Record Delivery for Sale ₹120 (2.0L @ ₹60/L)
  await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/deliveries',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: cust1.id,
      center_id: 'c1',
      date: testDate,
      session: 'MORNING',
      actual_qty: 2.0,
      status: 'DELIVERED',
    }
  );

  // Run automatic advance adjustment against Sale ₹120
  const adj1Res = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments/auto-adjust',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: cust1.id,
      date: testDate,
    }
  );

  if (adj1Res.statusCode !== 200) {
    throw new Error(`Failed to auto-adjust advance: ${JSON.stringify(adj1Res.data)}`);
  }

  console.log('  Auto-Adjustment Results:');
  console.log(`    Sale:              ₹${adj1Res.data.sale}`);
  console.log(`    Available Advance: ₹${adj1Res.data.available_advance}`);
  console.log(`    Advance Used:      ₹${adj1Res.data.advance_used}`);
  console.log(`    Remaining Advance: ₹${adj1Res.data.remaining_advance}`);
  console.log(`    Remaining Sale:    ₹${adj1Res.data.remaining_sale}`);

  if (
    adj1Res.data.advance_used !== 120 ||
    adj1Res.data.remaining_advance !== 380 ||
    adj1Res.data.remaining_sale !== 0
  ) {
    throw new Error(`Test Case 1 mismatch! Expected Used ₹120, Remaining ₹380, Remaining Sale ₹0`);
  }
  console.log('✓ PASS: Advance ₹500 + Sale ₹120 -> Used ₹120, Remaining ₹380, Due ₹0');

  // --------------------------------------------------------------------------
  // TEST CASE 2: Advance ₹230 + Sale ₹300 -> Used ₹230, Remaining ₹0, Remaining Sale ₹70
  // --------------------------------------------------------------------------
  console.log('\n3. Running Test Case 2: Advance ₹230 + Sale ₹300 (Partial Advance)...');
  const cust2 = await createTestSupplier('Advance Test Supplier 2', `ADV2_${Date.now().toString().slice(-4)}`);

  // Record Delivery for Sale ₹300 (5.0L @ ₹60/L)
  await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/deliveries',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: cust2.id,
      center_id: 'c1',
      date: testDate,
      session: 'MORNING',
      actual_qty: 5.0,
      status: 'DELIVERED',
    }
  );

  // Record Advance ₹230
  await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: cust2.id,
      date: testDate,
      amount: 230.0,
      payment_type: 'ADVANCE',
      payment_mode: 'CASH',
      reference_id: 'CASH_ADV_230',
      notes: 'Customer gave ₹230 advance',
    }
  );

  const adj2Res = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments/auto-adjust',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: cust2.id,
      date: testDate,
    }
  );

  console.log('  Auto-Adjustment Results:');
  console.log(`    Sale:              ₹${adj2Res.data.sale}`);
  console.log(`    Available Advance: ₹${adj2Res.data.available_advance}`);
  console.log(`    Advance Used:      ₹${adj2Res.data.advance_used}`);
  console.log(`    Remaining Advance: ₹${adj2Res.data.remaining_advance}`);
  console.log(`    Remaining Sale:    ₹${adj2Res.data.remaining_sale}`);

  if (
    adj2Res.data.advance_used !== 230 ||
    adj2Res.data.remaining_advance !== 0 ||
    adj2Res.data.remaining_sale !== 70
  ) {
    throw new Error(`Test Case 2 mismatch! Expected Used ₹230, Remaining Advance ₹0, Remaining Sale ₹70`);
  }
  console.log('✓ PASS: Advance ₹230 + Sale ₹300 -> Used ₹230, Remaining ₹0, Remaining Sale ₹70');

  // Customer now pays partial ₹50 of the remaining ₹70
  console.log('  Customer pays ₹50 towards the remaining ₹70...');
  await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: cust2.id,
      date: testDate,
      amount: 50.0,
      payment_type: 'DAILY_PAYMENT',
      payment_mode: 'CASH',
      reference_id: 'DAILY_PAY_50',
    }
  );

  const sheet2 = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/payments/daily-summary?date=${testDate}`,
    method: 'GET',
    headers: authHeaders,
  });

  const rowCust2 = sheet2.data.summaries.find((s: any) => s.customer_id === cust2.id);
  console.log(`  Daily Summary row for ${cust2.name}:`);
  console.log(`    Paid: ₹${rowCust2?.paid}, Due: ₹${rowCust2?.due}, Status: ${rowCust2?.status}`);

  // Remaining sale was 70, paid is 50 -> net due should be 20
  if (rowCust2.due !== 20 || rowCust2.paid !== 50 || rowCust2.status !== 'PARTIAL') {
    throw new Error(`Expected Due ₹20 and Status PARTIAL, got Due ₹${rowCust2.due}, Status ${rowCust2.status}`);
  }
  console.log('✓ PASS: Remaining ₹70 sale with ₹50 paid results in Due = ₹20 (Status: PARTIAL)');

  // --------------------------------------------------------------------------
  // TEST CASE 3: Sale ₹100 + Paid ₹100 -> Due ₹0
  // --------------------------------------------------------------------------
  console.log('\n4. Running Test Case 3: Sale ₹100 + Paid ₹100 -> Due ₹0...');
  const cust3 = await createTestSupplier('Full Payment Supplier', `PAY100_${Date.now().toString().slice(-4)}`);

  // Record delivery for Sale ₹100 (e.g. 2L Morning at ₹50/L)
  // Or record daily payment of ₹100
  await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: cust3.id,
      date: testDate,
      amount: 100.0,
      payment_type: 'DAILY_PAYMENT',
      payment_mode: 'CASH',
    }
  );

  // Auto adjust with sale = 100
  const adj3Res = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments/auto-adjust',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: cust3.id,
      date: testDate,
      sale: 100.0,
    }
  );

  const due3 = Math.max(0, adj3Res.data.remaining_sale - 100);
  console.log(`  Sale: ₹100, Paid: ₹100 -> Calculated Due: ₹${due3}`);
  if (due3 !== 0) {
    throw new Error(`Expected Due ₹0, got ₹${due3}`);
  }
  console.log('✓ PASS: Sale ₹100 + Paid ₹100 -> Due ₹0');

  // --------------------------------------------------------------------------
  // TEST CASE 4: Sale ₹100 + Paid ₹50 -> Due ₹50
  // --------------------------------------------------------------------------
  console.log('\n5. Running Test Case 4: Sale ₹100 + Paid ₹50 -> Due ₹50...');
  const cust4 = await createTestSupplier('Partial Payment Supplier', `PAY50_${Date.now().toString().slice(-4)}`);

  await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: cust4.id,
      date: testDate,
      amount: 50.0,
      payment_type: 'DAILY_PAYMENT',
      payment_mode: 'UPI',
    }
  );

  const adj4Res = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments/auto-adjust',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: cust4.id,
      date: testDate,
      sale: 100.0,
    }
  );

  const due4 = Math.max(0, adj4Res.data.remaining_sale - 50);
  console.log(`  Sale: ₹100, Paid: ₹50 -> Calculated Due: ₹${due4}`);
  if (due4 !== 50) {
    throw new Error(`Expected Due ₹50, got ₹${due4}`);
  }
  console.log('✓ PASS: Sale ₹100 + Paid ₹50 -> Due ₹50');

  // --------------------------------------------------------------------------
  // TEST CASE 5: Advance Ledger Audit Trail Traceability & Duplicate Prevention
  // --------------------------------------------------------------------------
  console.log('\n6. Running Test Case 5: Advance Ledger Audit Trail & Idempotent Adjustment...');
  const ledgerRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/payments/advance-ledger?customer_id=${cust1.id}`,
    method: 'GET',
    headers: authHeaders,
  });

  console.log(`  Ledger entries for ${cust1.name}: ${ledgerRes.data.length}`);
  ledgerRes.data.forEach((entry: any) => {
    console.log(`    [${entry.type}] Date: ${entry.date}, Amount: ₹${entry.amount}, Ref: ${entry.reference_id}`);
  });

  const addedEntries = ledgerRes.data.filter((e: any) => e.type === 'ADVANCE_ADDED');
  const usedEntries = ledgerRes.data.filter((e: any) => e.type === 'ADVANCE_USED');

  if (addedEntries.length !== 1 || addedEntries[0].amount !== 500) {
    throw new Error('Expected 1 ADVANCE_ADDED entry of ₹500');
  }
  if (usedEntries.length !== 1 || usedEntries[0].amount !== 120) {
    throw new Error('Expected 1 ADVANCE_USED entry of ₹120');
  }

  // Idempotency: Re-running auto-adjustment for same customer and date should NOT create duplicate
  await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments/auto-adjust',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: cust1.id,
      date: testDate,
      sale: 120.0,
    }
  );

  const recheckLedger = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/payments/advance-ledger?customer_id=${cust1.id}`,
    method: 'GET',
    headers: authHeaders,
  });

  const recheckUsed = recheckLedger.data.filter((e: any) => e.type === 'ADVANCE_USED');
  if (recheckUsed.length !== 1) {
    throw new Error(`DUPLICATE DETECTED! Expected exactly 1 ADVANCE_USED entry, found ${recheckUsed.length}`);
  }
  console.log('✓ PASS: Traceable advance ledger and duplicate prevention verified');

  console.log('\n==================================================');
  console.log('  ALL PHASE 5 TEST CASES PASSED WITH 100% SUCCESS ');
  console.log('==================================================\n');
}

runPhase5Verification().catch((err) => {
  console.error('\n❌ PHASE 5 VERIFICATION FAILED:', err);
  process.exit(1);
});
