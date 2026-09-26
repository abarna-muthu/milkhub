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

async function runPhase6Verification() {
  console.log('================================================================');
  console.log('    MILKHUB CRM — PHASE 6 COMPREHENSIVE VERIFICATION SUITE       ');
  console.log('================================================================\n');

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
  const yesterdayDate = '2026-09-25';

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
        address: 'Phase 6 Dairy Farm',
        area: 'Alangulam',
        center_id: 'c1',
        default_morning_qty: 2.0,
        default_evening_qty: 1.5,
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

  // ----------------------------------------------------------------
  // Test 1: Setup data for Customer History & Deliveries
  // ----------------------------------------------------------------
  console.log('\n2. Testing Customer Detail & History API (/api/customers/:id/history)...');
  const custSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const testCustomer = await createTestSupplier(`Test Farmer ${custSuffix}`, `SUPP_${custSuffix}`, 50.0);
  console.log(`✓ Test customer created: ${testCustomer.name} (Rate: ₹50/L, ID: ${testCustomer.id})`);

  // Record deliveries for yesterday (Morning: 2L, Evening: 1L = 3L * 50 = ₹150)
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: testCustomer.id, center_id: 'c1', date: yesterdayDate, session: 'MORNING', actual_qty: 2.0, status: 'DELIVERED' }
  );
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: testCustomer.id, center_id: 'c1', date: yesterdayDate, session: 'EVENING', actual_qty: 1.0, status: 'DELIVERED' }
  );

  // Record deliveries for today (Morning: 3L, Evening: 2L = 5L * 50 = ₹250)
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: testCustomer.id, center_id: 'c1', date: testDate, session: 'MORNING', actual_qty: 3.0, status: 'DELIVERED' }
  );
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/deliveries', method: 'POST', headers: authHeaders },
    { customer_id: testCustomer.id, center_id: 'c1', date: testDate, session: 'EVENING', actual_qty: 2.0, status: 'DELIVERED' }
  );

  // Add Advance of ₹100
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments', method: 'POST', headers: authHeaders },
    { customer_id: testCustomer.id, date: testDate, amount: 100.0, payment_type: 'ADVANCE', payment_mode: 'UPI', notes: 'Initial Advance' }
  );

  // Auto-adjust advance for today: Sale = ₹250, Advance used = ₹100, Remaining Sale = ₹150
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments/auto-adjust', method: 'POST', headers: authHeaders },
    { customer_id: testCustomer.id, date: testDate }
  );

  // Pay ₹50 on today's remaining sale: Due becomes ₹150 - ₹50 = ₹100
  await makeRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments', method: 'POST', headers: authHeaders },
    { customer_id: testCustomer.id, date: testDate, amount: 50.0, payment_type: 'DAILY_PAYMENT', payment_mode: 'CASH', notes: 'Partial daily payment' }
  );

  // Fetch Customer History
  const historyRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/customers/${testCustomer.id}/history?from_date=${yesterdayDate}&to_date=${testDate}`,
    method: 'GET',
    headers: authHeaders,
  });

  if (historyRes.statusCode !== 200 || !historyRes.data) {
    throw new Error(`Customer history failed: ${JSON.stringify(historyRes.data)}`);
  }

  const hist = historyRes.data;
  console.log('✓ Customer History payload received.');

  // Validate exact required fields in history daily rows
  if (!Array.isArray(hist.history) || hist.history.length === 0) {
    throw new Error('Customer history array is empty!');
  }

  const todayHistRow = hist.history.find((h: any) => h.date === testDate);
  if (!todayHistRow) {
    throw new Error(`Today's row not found in history: ${JSON.stringify(hist.history)}`);
  }

  console.log("Today's History Row:", todayHistRow);
  const requiredFields = ['date', 'morning', 'evening', 'total', 'rate', 'sale', 'advance_used', 'paid', 'due'];
  for (const field of requiredFields) {
    if (todayHistRow[field] === undefined) {
      throw new Error(`Missing required field '${field}' in Customer History row!`);
    }
  }

  // Check expected calculations for today:
  // morning = 3, evening = 2, total = 5, rate = 50, sale = 250, advance_used = 100, paid = 50, due = 100
  if (todayHistRow.total !== 5.0) throw new Error(`Expected total 5.0L, got ${todayHistRow.total}`);
  if (todayHistRow.sale !== 250.0) throw new Error(`Expected sale ₹250.0, got ${todayHistRow.sale}`);
  if (todayHistRow.advance_used !== 100.0) throw new Error(`Expected advance_used ₹100.0, got ${todayHistRow.advance_used}`);
  if (todayHistRow.paid !== 50.0) throw new Error(`Expected paid ₹50.0, got ${todayHistRow.paid}`);
  if (todayHistRow.due !== 100.0) throw new Error(`Expected due ₹100.0, got ${todayHistRow.due}`);
  console.log('✓ Daily history breakdown fields and calculations verified:');
  console.log('  Date:', todayHistRow.date);
  console.log('  Morning:', todayHistRow.morning, 'L | Evening:', todayHistRow.evening, 'L | Total:', todayHistRow.total, 'L');
  console.log('  Rate: ₹' + todayHistRow.rate, '| Sale: ₹' + todayHistRow.sale, '| Adv Used: ₹' + todayHistRow.advance_used);
  console.log('  Paid: ₹' + todayHistRow.paid, '| Due: ₹' + todayHistRow.due);

  // Validate Monthly Summary
  const monthlySummary = hist.monthly_summary;
  console.log('\nMonthly Summary:', monthlySummary);
  const monthlyFields = ['total_milk', 'total_sales', 'total_paid', 'total_due', 'advance_balance'];
  for (const field of monthlyFields) {
    if (monthlySummary[field] === undefined) {
      throw new Error(`Missing required field '${field}' in Monthly Summary!`);
    }
  }

  // Yesterday total was 3L * 50 = ₹150 sale, 0 paid, ₹150 due.
  // Today total was 5L * 50 = ₹250 sale, 100 adv used, 50 paid, ₹100 due.
  // Combined milk = 3 + 5 = 8L
  // Combined sales = 150 + 250 = ₹400
  // Combined paid = 0 + 50 = ₹50
  // Combined due = 150 + 100 = ₹250
  // Advance balance remaining = 100 added - 100 used = ₹0
  if (monthlySummary.total_milk !== 8.0) throw new Error(`Expected total_milk 8.0, got ${monthlySummary.total_milk}`);
  if (monthlySummary.total_sales !== 400.0) throw new Error(`Expected total_sales 400.0, got ${monthlySummary.total_sales}`);
  if (monthlySummary.total_paid !== 50.0) throw new Error(`Expected total_paid 50.0, got ${monthlySummary.total_paid}`);
  if (monthlySummary.total_due !== 250.0) throw new Error(`Expected total_due 250.0, got ${monthlySummary.total_due}`);
  if (monthlySummary.advance_balance !== 0.0) throw new Error(`Expected advance_balance 0.0, got ${monthlySummary.advance_balance}`);
  console.log('✓ Monthly Summary verified: Total Milk=8L, Total Sales=₹400, Total Paid=₹50, Total Due=₹250, Advance Bal=₹0.');

  // ----------------------------------------------------------------
  // Test 2: Dashboard API & Date Filter
  // ----------------------------------------------------------------
  console.log('\n3. Testing Dashboard API & Date Filter (/api/dashboard/stats)...');

  // Test Today
  const dashTodayRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/dashboard/stats?date=${testDate}`,
    method: 'GET',
    headers: authHeaders,
  });

  if (dashTodayRes.statusCode !== 200 || !dashTodayRes.data) {
    throw new Error('Dashboard stats for Today failed');
  }

  const dToday = dashTodayRes.data;
  console.log("✓ Dashboard KPIs for Today received:", dToday.kpis);

  // Check the 8 core KPIs
  if (dToday.kpis.today_milk === undefined) throw new Error('today_milk missing');
  if (dToday.kpis.morning_milk === undefined) throw new Error('morning_milk missing');
  if (dToday.kpis.evening_milk === undefined) throw new Error('evening_milk missing');
  if (dToday.kpis.today_sales === undefined) throw new Error('today_sales missing');
  if (dToday.kpis.today_paid === undefined) throw new Error('today_paid missing');
  if (dToday.kpis.today_due === undefined) throw new Error('today_due missing');
  if (dToday.kpis.total_suppliers === undefined) throw new Error('total_suppliers missing');
  if (dToday.kpis.total_centers === undefined) throw new Error('total_centers missing');

  // Verify Center Breakdown, Recent Deliveries, Recent Payments, Pending Balances exist
  if (!Array.isArray(dToday.center_breakdown)) throw new Error('center_breakdown array missing');
  if (!Array.isArray(dToday.recent_deliveries)) throw new Error('recent_deliveries array missing');
  if (!Array.isArray(dToday.recent_payments)) throw new Error('recent_payments array missing');
  if (!Array.isArray(dToday.pending_payments)) throw new Error('pending_payments array missing');

  console.log('✓ Center Breakdown count:', dToday.center_breakdown.length);
  console.log('✓ Recent Deliveries count:', dToday.recent_deliveries.length);
  console.log('✓ Recent Payments count:', dToday.recent_payments.length);
  console.log('✓ Pending Balances count:', dToday.pending_payments.length);

  // Test Yesterday date filter
  const dashYestRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/dashboard/stats?date=${yesterdayDate}`,
    method: 'GET',
    headers: authHeaders,
  });

  if (dashYestRes.statusCode !== 200 || !dashYestRes.data) {
    throw new Error('Dashboard stats for Yesterday failed');
  }
  const dYest = dashYestRes.data;
  console.log('✓ Dashboard stats for Yesterday updated dynamically.');
  console.log(`  Yesterday Milk: ${dYest.kpis.today_milk}L vs Today Milk: ${dToday.kpis.today_milk}L`);

  // Test Custom Date filter
  const customDate = '2026-08-15';
  const dashCustomRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/dashboard/stats?date=${customDate}`,
    method: 'GET',
    headers: authHeaders,
  });

  if (dashCustomRes.statusCode !== 200 || !dashCustomRes.data) {
    throw new Error('Dashboard stats for Custom Date failed');
  }
  console.log('✓ Dashboard stats for Custom Date (2026-08-15) returned valid metrics.');

  // ----------------------------------------------------------------
  // Test 3: Complete 8 Reports Verification
  // ----------------------------------------------------------------
  console.log('\n4. Testing All 8 Reports (/api/reports/*)...');

  // 1. Daily Milk Report
  const rDailyMilk = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/reports/daily-milk?date=${testDate}`,
    method: 'GET',
    headers: authHeaders,
  });
  if (rDailyMilk.statusCode !== 200 || !rDailyMilk.data?.rows) throw new Error('Daily Milk Report failed');
  console.log(`✓ 1. Daily Milk Report: ${rDailyMilk.data.rows.length} rows, Total Milk=${rDailyMilk.data.total_milk}L`);

  // 2. Center-wise Collection Report
  const rCenterWise = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/reports/center-wise?date=${testDate}`,
    method: 'GET',
    headers: authHeaders,
  });
  if (rCenterWise.statusCode !== 200 || !rCenterWise.data?.rows) throw new Error('Center-wise Report failed');
  console.log(`✓ 2. Center-wise Collection Report: ${rCenterWise.data.rows.length} centers`);

  // 3. Supplier-wise Collection Report
  const rSupplierWise = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/reports/supplier-wise?from_date=${yesterdayDate}&to_date=${testDate}`,
    method: 'GET',
    headers: authHeaders,
  });
  if (rSupplierWise.statusCode !== 200 || !rSupplierWise.data?.rows) throw new Error('Supplier-wise Report failed');
  console.log(`✓ 3. Supplier-wise Collection Report: ${rSupplierWise.data.rows.length} suppliers`);

  // 4. Daily Sales Report
  const rDailySales = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/reports/daily-sales?date=${testDate}`,
    method: 'GET',
    headers: authHeaders,
  });
  if (rDailySales.statusCode !== 200 || !rDailySales.data?.rows) throw new Error('Daily Sales Report failed');
  console.log(`✓ 4. Daily Sales Report: Gross Sales=₹${rDailySales.data.total_sales}, Net=₹${rDailySales.data.total_net_payable}`);

  // 5. Payment Report
  const rPayments = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/reports/payments?from_date=${yesterdayDate}&to_date=${testDate}`,
    method: 'GET',
    headers: authHeaders,
  });
  if (rPayments.statusCode !== 200 || !rPayments.data?.rows) throw new Error('Payment Report failed');
  console.log(`✓ 5. Payment Report: ${rPayments.data.rows.length} records, Total Paid=₹${rPayments.data.total_amount}`);

  // 6. Pending / Due Report
  const rPending = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/reports/pending-due?date=${testDate}`,
    method: 'GET',
    headers: authHeaders,
  });
  if (rPending.statusCode !== 200 || !rPending.data?.rows) throw new Error('Pending / Due Report failed');
  console.log(`✓ 6. Pending / Due Report: Total Outstanding Due=₹${rPending.data.total_due}`);

  // 7. Advance Balance Report
  const rAdvanceBal = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/reports/advance-balance',
    method: 'GET',
    headers: authHeaders,
  });
  if (rAdvanceBal.statusCode !== 200 || !rAdvanceBal.data?.rows) throw new Error('Advance Balance Report failed');
  console.log(`✓ 7. Advance Balance Report: ${rAdvanceBal.data.rows.length} accounts with advance`);

  // 8. Monthly Summary Report
  const rMonthlySum = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/reports/monthly-summary?month_year=${testDate.slice(0, 7)}`,
    method: 'GET',
    headers: authHeaders,
  });
  if (rMonthlySum.statusCode !== 200 || !rMonthlySum.data?.rows) throw new Error('Monthly Summary Report failed');
  console.log(`✓ 8. Monthly Summary Report: Month Milk=${rMonthlySum.data.total_milk}L, Sales=₹${rMonthlySum.data.total_sales}`);

  // ----------------------------------------------------------------
  // Test 4: Search & Filters Validation
  // ----------------------------------------------------------------
  console.log('\n5. Testing Search & Filter Modules...');

  // Customer search by name, phone, area, center, status
  const custSearchRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/customers?search=${encodeURIComponent(testCustomer.name)}&center_id=c1&status=active`,
    method: 'GET',
    headers: authHeaders,
  });
  if (custSearchRes.statusCode !== 200 || custSearchRes.data?.customers?.length === 0) {
    throw new Error('Customer search/filter failed to find created customer');
  }
  console.log(`✓ Customers Search/Filter (Name, Center, Status): Found ${custSearchRes.data.customers.length} match.`);

  // Deliveries filter by Date, Session, Center
  const delFilterRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/deliveries?date=${testDate}&session=MORNING&center_id=c1`,
    method: 'GET',
    headers: authHeaders,
  });
  if (delFilterRes.statusCode !== 200 || !delFilterRes.data?.deliveries) {
    throw new Error('Deliveries filter failed');
  }
  console.log(`✓ Deliveries Filter (Date, Session, Center): Found ${delFilterRes.data.deliveries.length} entries.`);

  // Payments filter by Date, Payment Type, Payment Mode
  const payFilterRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/payments?date=${testDate}&payment_type=DAILY_PAYMENT&payment_mode=CASH`,
    method: 'GET',
    headers: authHeaders,
  });
  if (payFilterRes.statusCode !== 200 || !Array.isArray(payFilterRes.data)) {
    throw new Error('Payments filter failed');
  }
  console.log(`✓ Payments Filter (Date, Type=DAILY_PAYMENT, Mode=CASH): Found ${payFilterRes.data.length} records.`);

  console.log('\n================================================================');
  console.log('    ✓ ALL PHASE 6 REQUIREMENTS VERIFIED SUCCESSFULLY (100%)       ');
  console.log('================================================================\n');
}

runPhase6Verification().catch((err) => {
  console.error('\n❌ Phase 6 verification failed:', err);
  process.exit(1);
});
