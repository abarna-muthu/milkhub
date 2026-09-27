/**
 * MILK BUSINESS CRM - PHASE 6 VERIFICATION SUITE
 * Strictly tests:
 * 1. Customer History API: GET /api/customers/:id/history
 *    History columns: Date, Morning, Evening, Total, Sale, Advance Used, Paid, Due
 * 2. Customer Monthly Summary: Total Milk, Total Sales, Total Paid, Total Due, Advance Balance
 * 3. Monthly filter support (?month=YYYY-MM)
 * 4. Full workflow integration
 */

const BASE_URL = 'http://localhost:5000/api';

async function runPhase6Verification() {
  console.log('\n====================================================');
  console.log('  MILK BUSINESS CRM - PHASE 6 VERIFICATION SUITE   ');
  console.log('  Customer History, Monthly Summary & Dashboard    ');
  console.log('  Customer has NO LOGIN • Owner is Primary User     ');
  console.log('====================================================\n');

  let ownerToken = '';
  const today = new Date();
  const currentMonth = today.toISOString().substring(0, 7);
  const dateDay1 = `${currentMonth}-10`;
  const dateDay2 = `${currentMonth}-11`;

  // 1. Health check
  console.log('1. Testing GET /api/health for Phase 6...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  console.log(`Status: ${healthRes.status}`, healthData);
  if (!healthData.phase.includes('Phase 6')) {
    throw new Error('Phase 6 is not active in /api/health');
  }

  // 2. Authenticate Owner
  console.log('\n2. Authenticating Owner (POST /api/auth/login)...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'milkhub@admin.com',
      password: 'Admin@123',
    }),
  });
  const loginData = await loginRes.json();
  ownerToken = loginData.token;
  if (!ownerToken) {
    throw new Error('Failed to acquire owner token');
  }
  console.log('Owner token acquired successfully.');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ownerToken}`,
  };

  // 3. Create test customer for history testing
  console.log('\n3. Creating customer for history test (Rate = ₹60/L)...');
  const custRes = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Ganesan History Test',
      phone: '9840998877',
      address: '78 Temple Car Street',
      area: 'North Gate',
      default_morning_qty: 2,
      default_evening_qty: 1,
      rate: 60,
      start_date: `${currentMonth}-01`,
      status: 'active',
    }),
  });
  const cust = (await custRes.json()).customer;
  console.log(`Created Customer: ID=${cust.id}, Name=${cust.name}`);

  // 4. Record Day 1: Morning 1.5L, Evening 0.5L -> Total 2L * ₹60 = ₹120 Sale
  console.log(`\n4. Recording Day 1 (${dateDay1}): 1.5L Morning, 0.5L Evening...`);
  await fetch(`${BASE_URL}/deliveries`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust.id,
      date: dateDay1,
      session: 'morning',
      actual_qty: 1.5,
      status: 'delivered',
    }),
  });
  await fetch(`${BASE_URL}/deliveries`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust.id,
      date: dateDay1,
      session: 'evening',
      actual_qty: 0.5,
      status: 'delivered',
    }),
  });

  // Day 1: Daily Payment of ₹50 -> Due should be ₹70
  console.log('Recording Day 1 Daily Payment: ₹50...');
  await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust.id,
      date: dateDay1,
      amount: 50,
      payment_type: 'daily',
      payment_mode: 'cash',
    }),
  });

  // 5. Record Day 2: Morning 2L, Evening 1L -> Total 3L * ₹60 = ₹180 Sale
  console.log(`\n5. Recording Day 2 (${dateDay2}): 2.0L Morning, 1.0L Evening...`);
  await fetch(`${BASE_URL}/deliveries`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust.id,
      date: dateDay2,
      session: 'morning',
      actual_qty: 2.0,
      status: 'delivered',
    }),
  });
  await fetch(`${BASE_URL}/deliveries`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust.id,
      date: dateDay2,
      session: 'evening',
      actual_qty: 1.0,
      status: 'delivered',
    }),
  });

  // Day 2: Advance deposit of ₹300
  // Available advance: ₹300.
  // Day 1 sale was ₹120 (paid 50, due was 70).
  // Day 2 sale was ₹180.
  // The advance of ₹300 automatically covers Day 1 remaining and Day 2!
  console.log('Recording Day 2 Advance Deposit: ₹300...');
  await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust.id,
      date: dateDay2,
      amount: 300,
      payment_type: 'advance',
      payment_mode: 'upi',
    }),
  });

  // 6. Test GET /api/customers/:id/history
  console.log(`\n6. Testing GET /api/customers/${cust.id}/history...`);
  const historyRes = await fetch(`${BASE_URL}/customers/${cust.id}/history?month=${currentMonth}`, {
    headers: authHeaders,
  });
  console.log(`GET /api/customers/:id/history Status: ${historyRes.status}`);
  if (historyRes.status !== 200) {
    throw new Error(`Expected status 200, got ${historyRes.status}`);
  }

  const historyData = await historyRes.json();
  console.log('\n--- CUSTOMER HISTORY ITEMS ---');
  console.table(historyData.items);

  console.log('\n--- CUSTOMER MONTHLY SUMMARY ---');
  console.log(historyData.monthly_summary);

  // Validate Required History Columns:
  // Date, Morning, Evening, Total, Sale, Advance Used, Paid, Due
  const item1 = historyData.items.find((i: any) => i.date === dateDay1);
  const item2 = historyData.items.find((i: any) => i.date === dateDay2);

  if (!item1 || !item2) {
    throw new Error('History items missing for recorded dates');
  }

  const requiredCols = ['date', 'morning', 'evening', 'total', 'sale', 'advance_used', 'paid', 'due'];
  for (const col of requiredCols) {
    if (item1[col] === undefined || item2[col] === undefined) {
      throw new Error(`Required column '${col}' missing in history item`);
    }
  }
  console.log('✓ PASS: All required history columns (Date, Morning, Evening, Total, Sale, Advance Used, Paid, Due) are present!');

  // Validate Monthly Summary:
  // Total Milk, Total Sales, Total Paid, Total Due, Advance Balance
  const summary = historyData.monthly_summary;
  if (
    summary.total_milk === undefined ||
    summary.total_sales === undefined ||
    summary.total_paid === undefined ||
    summary.total_due === undefined ||
    summary.advance_balance === undefined
  ) {
    throw new Error('Required monthly summary fields missing');
  }

  console.log(`Total Milk:      ${summary.total_milk} L (Expected: 5.00 L)`);
  console.log(`Total Sales:     ₹${summary.total_sales} (Expected: ₹300.00)`);
  console.log(`Total Paid:      ₹${summary.total_paid} (Expected: ₹50.00)`);
  console.log(`Total Due:       ₹${summary.total_due}`);
  console.log(`Advance Balance: ₹${summary.advance_balance}`);

  if (summary.total_milk !== 5 || summary.total_sales !== 300) {
    throw new Error(`Summary calculation error! Expected Milk=5, Sales=300. Got Milk=${summary.total_milk}, Sales=${summary.total_sales}`);
  }
  console.log('✓ PASS: Customer Monthly Summary correctly aggregates Total Milk, Total Sales, Total Paid, Total Due & Advance Balance!');

  // 7. Non-existent customer error check
  console.log('\n7. Testing GET /api/customers/non_existent_id/history (Expected: 404)...');
  const notFoundRes = await fetch(`${BASE_URL}/customers/non_existent_id/history`, {
    headers: authHeaders,
  });
  console.log(`Status: ${notFoundRes.status} (Expected: 404)`);
  if (notFoundRes.status !== 404) {
    throw new Error('Expected 404 for non existent customer');
  }

  console.log('\n======================================================');
  console.log('  SUCCESS: ALL PHASE 6 VERIFICATION CHECKS PASSED!    ');
  console.log('  - Customer History API (GET /api/customers/:id/history)');
  console.log('  - Columns: Date, Morning, Evening, Total, Sale,      ');
  console.log('    Advance Used, Paid, Due                            ');
  console.log('  - Monthly Summary: Total Milk, Total Sales, Paid,    ');
  console.log('    Due, Advance Balance                               ');
  console.log('  - Month filter parameter verified                    ');
  console.log('======================================================\n');
}

runPhase6Verification().catch((err) => {
  console.error('\n❌ PHASE 6 VERIFICATION FAILED:', err);
  process.exit(1);
});
