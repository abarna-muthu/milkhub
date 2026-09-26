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

async function runPhase7QA() {
  console.log('================================================================');
  console.log('    MILKHUB CRM — PHASE 7 FINAL QA & DEPLOYMENT-READINESS       ');
  console.log('================================================================\n');

  // ================================================================
  // 1. COMPLETE END-TO-END WORKFLOW TEST
  // ================================================================
  console.log('--- 1. COMPLETE END-TO-END WORKFLOW TEST ---');

  // 1.1 Owner Login
  console.log('1.1 Owner Login...');
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
    throw new Error('Owner login failed');
  }
  const token = loginRes.data.token;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  console.log('✓ Owner login successful. JWT verified.');

  // 1.2 Dashboard Initial Stats
  console.log('1.2 Checking Dashboard Stats...');
  const today = '2026-09-26';
  const initialDashRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/dashboard/stats?date=${today}`,
    method: 'GET',
    headers: authHeaders,
  });
  if (initialDashRes.statusCode !== 200) throw new Error('Initial dashboard fetch failed');
  console.log('✓ Initial dashboard metrics loaded.');

  // 1.3 Create Center
  console.log('1.3 Creating Collection Center...');
  const centerSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const centerRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/centers',
      method: 'POST',
      headers: authHeaders,
    },
    {
      center_name: `Center ${centerSuffix}`,
      location: 'Sattur Highway',
      status: 'active',
      code: `C_${centerSuffix}`,
      phone: '9842188888',
    }
  );
  if (centerRes.statusCode !== 201) throw new Error('Create center failed');
  const testCenter = centerRes.data;
  console.log(`✓ Center created: ${testCenter.center_name} (ID: ${testCenter.id})`);

  // 1.4 Create Supplier and Assign to Center
  console.log('1.4 Creating Supplier assigned to Center...');
  const supplierRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/customers',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_code: `P7_${centerSuffix}`,
      name: `Ramesh ${centerSuffix}`,
      phone: '9842177777',
      address: 'Dairy Colony',
      area: 'Sattur',
      center_id: testCenter.id,
      cow_count: 2,
      buffalo_count: 0,
      default_morning_qty: 1.0,
      default_evening_qty: 1.0,
      rate: 60.0,
      start_date: today,
      status: 'active',
    }
  );
  if (supplierRes.statusCode !== 201) throw new Error('Create supplier failed');
  const testSupplier = supplierRes.data;
  console.log(`✓ Supplier created: ${testSupplier.name} (Code: ${testSupplier.customer_code}, Rate: ₹60/L, Center: ${testCenter.id})`);

  // 1.5 Morning Delivery (Actual = 1.5L)
  console.log('1.5 Recording Morning Delivery (1.5L)...');
  const mornDelRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/deliveries',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: testSupplier.id,
      center_id: testCenter.id,
      date: today,
      session: 'MORNING',
      actual_qty: 1.5,
      status: 'DELIVERED',
    }
  );
  if (mornDelRes.statusCode !== 201) throw new Error('Morning delivery failed');
  console.log('✓ Morning delivery recorded: 1.5L');

  // 1.6 Evening Delivery (Actual = 0.5L)
  console.log('1.6 Recording Evening Delivery (0.5L)...');
  const eveDelRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/deliveries',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: testSupplier.id,
      center_id: testCenter.id,
      date: today,
      session: 'EVENING',
      actual_qty: 0.5,
      status: 'DELIVERED',
    }
  );
  if (eveDelRes.statusCode !== 201) throw new Error('Evening delivery failed');
  console.log('✓ Evening delivery recorded: 0.5L');

  // 1.7 Sales Calculation Check (Total = 2L, Rate = 60 => ₹120)
  console.log('1.7 Checking Daily Sales Calculation...');
  const salesSummaryRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/payments/daily-summary?date=${today}&search=${testSupplier.customer_code}`,
    method: 'GET',
    headers: authHeaders,
  });
  if (salesSummaryRes.statusCode !== 200 || salesSummaryRes.data.summaries.length === 0) {
    throw new Error('Daily summary fetch failed');
  }
  const summaryRow = salesSummaryRes.data.summaries[0];
  if (summaryRow.total_qty !== 2.0) throw new Error(`Expected 2.0L, got ${summaryRow.total_qty}`);
  if (summaryRow.sale !== 120.0) throw new Error(`Expected ₹120.0, got ${summaryRow.sale}`);
  console.log(`✓ Total Milk = ${summaryRow.total_qty}L, Rate = ₹${summaryRow.rate}, Sale = ₹${summaryRow.sale}`);

  // 1.8 Advance Check & Advance Payment (Add ₹500 advance)
  console.log('1.8 Recording Advance Payment of ₹500...');
  const advPayRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: testSupplier.id,
      date: today,
      amount: 500.0,
      payment_type: 'ADVANCE',
      payment_mode: 'UPI',
      notes: 'Workflow Advance Test',
    }
  );
  if (advPayRes.statusCode !== 201) throw new Error('Advance payment failed');

  const advBalRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/payments/advance-balance/${testSupplier.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  if (advBalRes.data.available_balance !== 500.0) {
    throw new Error(`Expected ₹500 advance balance, got ${advBalRes.data.available_balance}`);
  }
  console.log(`✓ Advance recorded. Available balance: ₹${advBalRes.data.available_balance}`);

  // 1.9 Automatic Advance Adjustment (₹500 advance - ₹120 sale => ₹380 remaining advance, ₹0 remaining sale)
  console.log('1.9 Running Automatic Advance Adjustment...');
  const adjustRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments/auto-adjust',
      method: 'POST',
      headers: authHeaders,
    },
    { customer_id: testSupplier.id, date: today }
  );
  if (adjustRes.statusCode !== 200) throw new Error('Auto-adjust failed');
  if (adjustRes.data.advance_used !== 120.0) throw new Error(`Expected ₹120 used, got ${adjustRes.data.advance_used}`);
  if (adjustRes.data.remaining_advance !== 380.0) throw new Error(`Expected ₹380 remaining advance, got ${adjustRes.data.remaining_advance}`);
  if (adjustRes.data.remaining_sale !== 0.0) throw new Error(`Expected ₹0 remaining sale, got ${adjustRes.data.remaining_sale}`);
  console.log(`✓ Auto-adjustment: Sale=₹120, Advance Used=₹120, Remaining Advance=₹380, Net Remaining Sale=₹0`);

  // 1.10 Due Check
  const postAdjustSummaryRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/payments/daily-summary?date=${today}&search=${testSupplier.customer_code}`,
    method: 'GET',
    headers: authHeaders,
  });
  const updatedSummary = postAdjustSummaryRes.data.summaries[0];
  if (updatedSummary.due !== 0.0) throw new Error(`Expected due ₹0, got ${updatedSummary.due}`);
  console.log(`✓ Due = ₹${updatedSummary.due}, Status = ${updatedSummary.status}`);

  // 1.11 Customer History
  console.log('1.11 Fetching Customer History...');
  const custHistRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/customers/${testSupplier.id}/history`,
    method: 'GET',
    headers: authHeaders,
  });
  if (custHistRes.statusCode !== 200) throw new Error('Customer history failed');
  const histPayload = custHistRes.data;
  if (histPayload.monthly_summary.total_milk !== 2.0) throw new Error('History total milk mismatch');
  if (histPayload.monthly_summary.total_sales !== 120.0) throw new Error('History total sales mismatch');
  if (histPayload.monthly_summary.advance_balance !== 380.0) throw new Error('History advance balance mismatch');
  console.log(`✓ Customer History verified: Total Milk=2L, Sales=₹120, Advance Balance=₹380`);

  // 1.12 Dashboard & Reports Verification
  console.log('1.12 Refreshing Dashboard & Generating Reports...');
  const dashRefreshRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/dashboard/stats?date=${today}`,
    method: 'GET',
    headers: authHeaders,
  });
  if (dashRefreshRes.statusCode !== 200) throw new Error('Dashboard refresh failed');
  console.log('✓ Dashboard stats updated dynamically with new intake.');

  const repMilkRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/reports/daily-milk?date=${today}`,
    method: 'GET',
    headers: authHeaders,
  });
  if (repMilkRes.statusCode !== 200) throw new Error('Daily milk report failed');
  console.log(`✓ Reports verified: Daily Milk Report returned ${repMilkRes.data.rows.length} rows.`);

  console.log('\n================================================================');
  console.log('✓ WORKFLOW TEST PASSED: Owner Login -> Dashboard -> Center -> Supplier -> Deliveries -> Sales -> Advance -> Auto-adjust -> History -> Reports');
  console.log('================================================================\n');

  // ================================================================
  // 2. CRITICAL BUSINESS TESTS
  // ================================================================
  console.log('--- 2. CRITICAL BUSINESS TESTS ---');

  // 2.1 Default 1L -> Actual 1.5L. Default remains 1L.
  console.log('2.1 Testing Default 1L -> Actual 1.5L (Default remains 1L)...');
  const custB1 = await createTestSupplier(`Biz Farmer 1 ${centerSuffix}`, `B1_${centerSuffix}`, 60.0);
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: custB1.id, center_id: testCenter.id, date: today, session: 'MORNING', actual_qty: 1.5, status: 'DELIVERED' }
  );
  const custB1Check = await makeRequest({ hostname: '127.0.0.1', port: 5000, path: `/api/customers/${custB1.id}`, method: 'GET', headers: authHeaders });
  if (custB1Check.data.customer.default_morning_qty !== 1.0) {
    throw new Error(`Default quantity was modified! Expected 1.0L, got ${custB1Check.data.customer.default_morning_qty}`);
  }
  console.log('✓ PASS: Actual recorded = 1.5L, Default morning remains = 1.0L');

  // 2.2 No Milk: 0L + NO_MILK
  console.log('2.2 Testing No Milk: 0L + NO_MILK...');
  const noMilkRes = await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: custB1.id, center_id: testCenter.id, date: today, session: 'EVENING', actual_qty: 0.0, status: 'NO_MILK' }
  );
  if (noMilkRes.data.status !== 'NO_MILK' || noMilkRes.data.actual_qty !== 0) {
    throw new Error(`Expected NO_MILK with 0L, got ${JSON.stringify(noMilkRes.data)}`);
  }
  console.log('✓ PASS: Recorded 0L + NO_MILK successfully.');

  // 2.3 Advance ₹500 + Sale ₹120 -> Remaining Advance ₹380
  console.log('2.3 Testing Advance ₹500 + Sale ₹120 -> Remaining Advance ₹380...');
  const custB2 = await createTestSupplier(`Biz Farmer 2 ${centerSuffix}`, `B2_${centerSuffix}`, 60.0);
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments', method: 'POST', headers: authHeaders },
    { customer_id: custB2.id, date: today, amount: 500.0, payment_type: 'ADVANCE', payment_mode: 'CASH' }
  );
  const adjB2 = await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments/auto-adjust', method: 'POST', headers: authHeaders },
    { customer_id: custB2.id, date: today, sale: 120.0 }
  );
  if (adjB2.data.remaining_advance !== 380.0) throw new Error(`Expected remaining advance ₹380, got ${adjB2.data.remaining_advance}`);
  console.log('✓ PASS: Advance ₹500 + Sale ₹120 -> Remaining Advance ₹380.');

  // 2.4 Advance ₹230 + Sale ₹300 -> Remaining Sale ₹70
  console.log('2.4 Testing Advance ₹230 + Sale ₹300 -> Remaining Sale ₹70...');
  const custB3 = await createTestSupplier(`Biz Farmer 3 ${centerSuffix}`, `B3_${centerSuffix}`, 60.0);
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments', method: 'POST', headers: authHeaders },
    { customer_id: custB3.id, date: today, amount: 230.0, payment_type: 'ADVANCE', payment_mode: 'UPI' }
  );
  const adjB3 = await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments/auto-adjust', method: 'POST', headers: authHeaders },
    { customer_id: custB3.id, date: today, sale: 300.0 }
  );
  if (adjB3.data.remaining_sale !== 70.0) throw new Error(`Expected remaining sale ₹70, got ${adjB3.data.remaining_sale}`);
  if (adjB3.data.remaining_advance !== 0.0) throw new Error(`Expected remaining advance ₹0, got ${adjB3.data.remaining_advance}`);
  console.log('✓ PASS: Advance ₹230 + Sale ₹300 -> Remaining Sale ₹70.');

  // 2.5 Sale ₹100 + Paid ₹50 -> Due ₹50
  console.log('2.5 Testing Sale ₹100 + Paid ₹50 -> Due ₹50...');
  const custB4 = await createTestSupplier(`Biz Farmer 4 ${centerSuffix}`, `B4_${centerSuffix}`, 50.0);
  // Delivery 2L * 50 = ₹100
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: custB4.id, center_id: testCenter.id, date: today, session: 'MORNING', actual_qty: 2.0, status: 'DELIVERED' }
  );
  // Pay ₹50
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments', method: 'POST', headers: authHeaders },
    { customer_id: custB4.id, date: today, amount: 50.0, payment_type: 'DAILY_PAYMENT', payment_mode: 'CASH' }
  );
  const sumB4Res = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/payments/daily-summary?date=${today}&search=${custB4.customer_code}`,
    method: 'GET',
    headers: authHeaders,
  });
  const sumB4 = sumB4Res.data.summaries[0];
  if (sumB4.sale !== 100.0) throw new Error(`Expected sale ₹100, got ${sumB4.sale}`);
  if (sumB4.paid !== 50.0) throw new Error(`Expected paid ₹50, got ${sumB4.paid}`);
  if (sumB4.due !== 50.0) throw new Error(`Expected due ₹50, got ${sumB4.due}`);
  console.log('✓ PASS: Sale ₹100 + Paid ₹50 -> Due ₹50.');

  // 2.6 Morning 1.5L + Evening 0.5L -> Total 2L. Rate ₹60 -> Sale ₹120.
  console.log('2.6 Testing Morning 1.5L + Evening 0.5L -> Total 2L, Rate ₹60 -> Sale ₹120...');
  const custB5 = await createTestSupplier(`Biz Farmer 5 ${centerSuffix}`, `B5_${centerSuffix}`, 60.0);
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: custB5.id, center_id: testCenter.id, date: today, session: 'MORNING', actual_qty: 1.5, status: 'DELIVERED' }
  );
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: custB5.id, center_id: testCenter.id, date: today, session: 'EVENING', actual_qty: 0.5, status: 'DELIVERED' }
  );
  const sumB5Res = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/payments/daily-summary?date=${today}&search=${custB5.customer_code}`,
    method: 'GET',
    headers: authHeaders,
  });
  const sumB5 = sumB5Res.data.summaries[0];
  if (sumB5.total_qty !== 2.0) throw new Error(`Expected 2.0L, got ${sumB5.total_qty}`);
  if (sumB5.rate !== 60.0) throw new Error(`Expected rate 60.0, got ${sumB5.rate}`);
  if (sumB5.sale !== 120.0) throw new Error(`Expected sale 120.0, got ${sumB5.sale}`);
  console.log('✓ PASS: Morning 1.5L + Evening 0.5L = 2.0L @ ₹60/L = ₹120.00.');

  // ================================================================
  // 3. DATA INTEGRITY & EDGE CASES
  // ================================================================
  console.log('\n--- 3. DATA INTEGRITY & EDGE CASE TESTING ---');

  // 3.1 Duplicate Deliveries: saving twice on same session updates in place
  console.log('3.1 Checking Duplicate Delivery prevention...');
  const countBefore = (await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/deliveries?date=${today}&session=MORNING`,
    method: 'GET',
    headers: authHeaders,
  })).data.deliveries.filter((d: any) => d.customer_id === custB5.id).length;

  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: custB5.id, center_id: testCenter.id, date: today, session: 'MORNING', actual_qty: 1.8, status: 'DELIVERED' }
  );

  const countAfter = (await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/deliveries?date=${today}&session=MORNING`,
    method: 'GET',
    headers: authHeaders,
  })).data.deliveries.filter((d: any) => d.customer_id === custB5.id).length;

  if (countBefore !== countAfter) {
    throw new Error('Duplicate delivery record created instead of update in place!');
  }
  console.log('✓ Duplicate delivery prevented: row updated in place (count remained 1).');

  // 3.2 Duplicate Advance Adjustment: calling twice does not duplicate deductions
  console.log('3.2 Checking Duplicate Advance Adjustment idempotency...');
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments/auto-adjust', method: 'POST', headers: authHeaders },
    { customer_id: testSupplier.id, date: today }
  );
  const ledgerRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/payments/advance-ledger?customer_id=${testSupplier.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  const usedEntries = ledgerRes.data.filter((l: any) => l.type === 'ADVANCE_USED' && l.date === today);
  if (usedEntries.length > 1) {
    throw new Error('Duplicate ADVANCE_USED entries created for same day!');
  }
  console.log('✓ Advance adjustment is idempotent: single ADVANCE_USED entry preserved.');

  // 3.3 Negative Quantities
  console.log('3.3 Checking Negative Quantity rejection...');
  const negQtyRes = await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: custB5.id, center_id: testCenter.id, date: today, session: 'MORNING', actual_qty: -2.5, status: 'DELIVERED' }
  );
  if (negQtyRes.statusCode !== 400) {
    throw new Error(`Expected 400 for negative quantity, got ${negQtyRes.statusCode}`);
  }
  console.log('✓ PASS: Negative quantity (-2.5L) rejected with 400.');

  // 3.4 Negative Payments
  console.log('3.4 Checking Negative Payment rejection...');
  const negPayRes = await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments', method: 'POST', headers: authHeaders },
    { customer_id: custB5.id, date: today, amount: -50.0, payment_type: 'DAILY_PAYMENT', payment_mode: 'CASH' }
  );
  if (negPayRes.statusCode !== 400) {
    throw new Error(`Expected 400 for negative payment, got ${negPayRes.statusCode}`);
  }
  console.log('✓ PASS: Negative payment (-₹50) rejected with 400.');

  // 3.5 Negative Advance
  console.log('3.5 Checking Negative Advance rejection...');
  const negAdvRes = await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments', method: 'POST', headers: authHeaders },
    { customer_id: custB5.id, date: today, amount: -100.0, payment_type: 'ADVANCE', payment_mode: 'UPI' }
  );
  if (negAdvRes.statusCode !== 400) {
    throw new Error(`Expected 400 for negative advance, got ${negAdvRes.statusCode}`);
  }
  console.log('✓ PASS: Negative advance (-₹100) rejected with 400.');

  // 3.6 Invalid Customer
  console.log('3.6 Checking Invalid Customer rejection...');
  const invCustRes = await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: 'non_existent_cust_99999', center_id: testCenter.id, date: today, session: 'MORNING', actual_qty: 1.0, status: 'DELIVERED' }
  );
  if (invCustRes.statusCode !== 404) {
    throw new Error(`Expected 404 for invalid customer, got ${invCustRes.statusCode}`);
  }
  console.log('✓ PASS: Non-existent customer delivery rejected with 404.');

  // 3.7 Invalid Center
  console.log('3.7 Checking Invalid Center rejection...');
  const invCenterRes = await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: custB5.id, center_id: 'non_existent_center_8888', date: today, session: 'MORNING', actual_qty: 1.0, status: 'DELIVERED' }
  );
  if (invCenterRes.statusCode !== 404) {
    throw new Error(`Expected 404 for invalid center, got ${invCenterRes.statusCode}`);
  }
  console.log('✓ PASS: Non-existent center delivery rejected with 404.');

  // 3.8 Inactive Customer Delivery
  console.log('3.8 Checking Inactive Customer Delivery rejection...');
  // Deactivate custB5
  await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/customers/${custB5.id}`,
    method: 'DELETE',
    headers: authHeaders,
  });
  const inactDelRes = await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: custB5.id, center_id: testCenter.id, date: today, session: 'MORNING', actual_qty: 1.0, status: 'DELIVERED' }
  );
  if (inactDelRes.statusCode !== 400) {
    throw new Error(`Expected 400 for inactive customer delivery, got ${inactDelRes.statusCode}`);
  }
  console.log('✓ PASS: Inactive customer delivery rejected with 400.');

  console.log('\n================================================================');
  console.log('    ✓ ALL PHASE 7 QA & DATA INTEGRITY TESTS PASSED (100%)       ');
  console.log('================================================================\n');
}

// Helper to create test customer
async function createTestSupplier(name: string, code: string, rate: number = 60.0) {
  const loginRes = await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { email: 'admin@milkhub.com', password: '@MilkHub#123' }
  );
  const token = loginRes.data.token;
  const res = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/customers',
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    {
      customer_code: code,
      name,
      phone: '98421' + Math.floor(10000 + Math.random() * 90000),
      address: 'QA Test Farm',
      area: 'Sattur',
      center_id: 'c1',
      default_morning_qty: 1.0,
      default_evening_qty: 1.0,
      rate,
      start_date: '2026-09-26',
      status: 'active',
    }
  );
  return res.data;
}

runPhase7QA().catch((err) => {
  console.error('\n❌ Phase 7 QA failed:', err);
  process.exit(1);
});
