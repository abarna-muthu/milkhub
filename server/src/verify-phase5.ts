/**
 * MILK BUSINESS CRM - PHASE 5 VERIFICATION SUITE
 * Strictly tests:
 * 1. Daily Payment with partial payment & due calculation (Example: Sale = ₹120, Paid = ₹50 -> Due = ₹70)
 * 2. Advance balance stored separately from daily cash
 * 3. Automatic advance adjustment (Example 1: Advance = ₹500, Sale = ₹120 -> Advance Used = ₹120, Remaining = ₹380, Due = ₹0)
 * 4. Partial advance adjustment (Example 2: Advance = ₹230, Sale = ₹300 -> Advance Used = ₹230, Remaining = ₹70)
 * 5. Traceable advance ledger (type='credit' & type='adjustment' with reference_id)
 * 6. API POST /api/payments & GET /api/customers/:id/advance
 */

const BASE_URL = 'http://localhost:5000/api';

async function runPhase5Verification() {
  console.log('\n====================================================');
  console.log('  MILK BUSINESS CRM - PHASE 5 VERIFICATION SUITE   ');
  console.log('  Daily Payments, Advance Ledger & Auto-Adjustment ');
  console.log('  Customer has NO LOGIN • Owner is Primary User     ');
  console.log('====================================================\n');

  let ownerToken = '';
  const testDate = new Date().toISOString().split('T')[0];

  // 1. Health check
  console.log('1. Testing GET /api/health for Phase 5...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  console.log(`Status: ${healthRes.status}`, healthData);
  if (!healthData.phase.includes('Phase 5')) {
    throw new Error('Phase 5 is not active in /api/health');
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

  // 3. Test 1: Daily Payment & Partial Payment
  // Example from PDF:
  // Sale = ₹120, Paid = ₹50, Due = ₹70
  console.log('\n3. CRITICAL TEST CASE 1: Daily Payment & Partial Payment...');
  const cust1Res = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Ravi Cash Daily',
      phone: '9840112233',
      address: 'Daily Cash Yard 1',
      area: 'Central Town',
      default_morning_qty: 1.5,
      default_evening_qty: 0.5,
      rate: 60,
      start_date: testDate,
      status: 'active',
    }),
  });
  const cust1 = (await cust1Res.json()).customer;
  console.log(`Created Customer: ID=${cust1.id}, Name=${cust1.name}, Rate=₹${cust1.rate}/L`);

  // Record 1.5L morning + 0.5L evening delivery -> Total 2L * ₹60 = ₹120 Sale
  await fetch(`${BASE_URL}/deliveries`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust1.id,
      date: testDate,
      session: 'morning',
      actual_qty: 1.5,
      status: 'delivered',
    }),
  });
  await fetch(`${BASE_URL}/deliveries`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust1.id,
      date: testDate,
      session: 'evening',
      actual_qty: 0.5,
      status: 'delivered',
    }),
  });

  // Verify Sale is ₹120 and initial Due is ₹120 before payment
  const salesBeforePayRes = await fetch(`${BASE_URL}/sales?date=${testDate}&customer_id=${cust1.id}`, {
    headers: authHeaders,
  });
  const saleItemBefore = (await salesBeforePayRes.json()).sales[0];
  console.log(`Before payment: Sale = ₹${saleItemBefore.sale_amount}, Paid = ₹${saleItemBefore.paid}, Due = ₹${saleItemBefore.due}`);

  // Record Partial Daily Payment of ₹50
  console.log('Recording partial daily payment of ₹50...');
  const pay1Res = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust1.id,
      date: testDate,
      amount: 50,
      payment_type: 'daily',
      payment_mode: 'cash',
    }),
  });
  console.log(`POST /api/payments Status: ${pay1Res.status}`);
  const pay1Data = await pay1Res.json();
  console.log('Payment recorded:', pay1Data.payment);

  // Check sales display
  const salesAfterPayRes = await fetch(`${BASE_URL}/sales?date=${testDate}&customer_id=${cust1.id}`, {
    headers: authHeaders,
  });
  const saleItemAfter = (await salesAfterPayRes.json()).sales[0];
  console.log('--- VERIFYING EXACT PROMPT EXAMPLE 1 ---');
  console.log(`Sale:  ₹${saleItemAfter.sale_amount} (Expected: ₹120)`);
  console.log(`Paid:  ₹${saleItemAfter.paid} (Expected: ₹50)`);
  console.log(`Due:   ₹${saleItemAfter.due} (Expected: ₹70)`);

  if (saleItemAfter.sale_amount !== 120 || saleItemAfter.paid !== 50 || saleItemAfter.due !== 70) {
    throw new Error(`Example 1 calculation failed! Expected Sale=120, Paid=50, Due=70. Got Sale=${saleItemAfter.sale_amount}, Paid=${saleItemAfter.paid}, Due=${saleItemAfter.due}`);
  }
  console.log('✓ PASS: Daily payment & partial due verified (120 - 50 = 70)!');

  // 4. Test 2: Advance & Automatic Advance Adjustment
  // Example from PDF:
  // Advance = ₹500, Future Sale = ₹120
  // System automatically:
  // Advance Used = ₹120, Remaining Advance = ₹380, Due = ₹0
  console.log('\n4. CRITICAL TEST CASE 2: Advance Deposit & Automatic Full Adjustment...');
  const cust2Res = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Venkatesh Advance 500',
      phone: '9840223344',
      address: 'Advance Yard 2',
      area: 'Temple East',
      default_morning_qty: 2,
      default_evening_qty: 0,
      rate: 60,
      start_date: testDate,
      status: 'active',
    }),
  });
  const cust2 = (await cust2Res.json()).customer;
  console.log(`Created Customer: ID=${cust2.id}, Name=${cust2.name}, Rate=₹${cust2.rate}/L`);

  // Deposit ₹500 advance
  console.log('Depositing advance payment of ₹500 (payment_type="advance")...');
  const advPayRes = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust2.id,
      date: testDate,
      amount: 500,
      payment_type: 'advance',
      payment_mode: 'upi',
    }),
  });
  console.log(`POST /api/payments Status: ${advPayRes.status}`);

  // Verify advance balance before sale is ₹500
  const advBeforeSaleRes = await fetch(`${BASE_URL}/customers/${cust2.id}/advance`, {
    headers: authHeaders,
  });
  const advBeforeSale = await advBeforeSaleRes.json();
  console.log(`Customer Advance Balance before sale: ₹${advBeforeSale.advance_balance} (Credited: ₹${advBeforeSale.total_advance_credited})`);
  if (advBeforeSale.advance_balance !== 500) {
    throw new Error(`Expected advance balance 500, got ${advBeforeSale.advance_balance}`);
  }

  // Record delivery: 2L at ₹60/L = ₹120 Sale
  console.log('Recording delivery: 2L morning @ ₹60/L = ₹120 Sale...');
  await fetch(`${BASE_URL}/deliveries`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust2.id,
      date: testDate,
      session: 'morning',
      actual_qty: 2,
      status: 'delivered',
    }),
  });

  // Verify sales display
  const salesAdvRes = await fetch(`${BASE_URL}/sales?date=${testDate}&customer_id=${cust2.id}`, {
    headers: authHeaders,
  });
  const saleItemAdv = (await salesAdvRes.json()).sales[0];

  // Verify customer advance ledger
  const advAfterSaleRes = await fetch(`${BASE_URL}/customers/${cust2.id}/advance`, {
    headers: authHeaders,
  });
  const advAfterSale = await advAfterSaleRes.json();

  console.log('--- VERIFYING EXACT PROMPT EXAMPLE 2 ---');
  console.log(`Advance Deposited: ₹500`);
  console.log(`Sale Amount:       ₹${saleItemAdv.sale_amount} (Expected: ₹120)`);
  console.log(`Advance Used:      ₹${saleItemAdv.advance_used} (Expected: ₹120)`);
  console.log(`Remaining Advance: ₹${advAfterSale.advance_balance} (Expected: ₹380)`);
  console.log(`Due:               ₹${saleItemAdv.due} (Expected: ₹0)`);

  if (
    saleItemAdv.advance_used !== 120 ||
    advAfterSale.advance_balance !== 380 ||
    saleItemAdv.due !== 0
  ) {
    throw new Error('Example 2 calculation failed!');
  }
  console.log('✓ PASS: Automatic advance adjustment verified (Advance Used: 120, Remaining: 380, Due: 0)!');

  // 5. Test 3: Partial Advance Adjustment
  // Example from PDF:
  // Advance = ₹230, Sale = ₹300
  // System automatically:
  // Advance Used = ₹230, Remaining amount = ₹70
  console.log('\n5. CRITICAL TEST CASE 3: Partial Advance Adjustment (Sale > Advance)...');
  const cust3Res = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Muthu Advance 230',
      phone: '9840334455',
      address: 'Advance Yard 3',
      area: 'West Gate',
      default_morning_qty: 3,
      default_evening_qty: 2,
      rate: 60,
      start_date: testDate,
      status: 'active',
    }),
  });
  const cust3 = (await cust3Res.json()).customer;
  console.log(`Created Customer: ID=${cust3.id}, Name=${cust3.name}, Rate=₹${cust3.rate}/L`);

  // Deposit ₹230 advance
  console.log('Depositing advance payment of ₹230...');
  await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust3.id,
      date: testDate,
      amount: 230,
      payment_type: 'advance',
      payment_mode: 'cash',
    }),
  });

  // Record 5L delivery (3L morning + 2L evening) @ ₹60/L = ₹300 Sale
  console.log('Recording delivery: 5L total @ ₹60/L = ₹300 Sale...');
  await fetch(`${BASE_URL}/deliveries`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust3.id,
      date: testDate,
      session: 'morning',
      actual_qty: 3,
      status: 'delivered',
    }),
  });
  await fetch(`${BASE_URL}/deliveries`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust3.id,
      date: testDate,
      session: 'evening',
      actual_qty: 2,
      status: 'delivered',
    }),
  });

  // Check sales display & advance ledger
  const salesPartRes = await fetch(`${BASE_URL}/sales?date=${testDate}&customer_id=${cust3.id}`, {
    headers: authHeaders,
  });
  const saleItemPart = (await salesPartRes.json()).sales[0];

  const advPartRes = await fetch(`${BASE_URL}/customers/${cust3.id}/advance`, {
    headers: authHeaders,
  });
  const advPart = await advPartRes.json();

  console.log('--- VERIFYING EXACT PROMPT EXAMPLE 3 ---');
  console.log(`Advance Deposited: ₹230`);
  console.log(`Sale:              ₹${saleItemPart.sale_amount} (Expected: ₹300)`);
  console.log(`Advance Used:      ₹${saleItemPart.advance_used} (Expected: ₹230)`);
  console.log(`Remaining Advance: ₹${advPart.advance_balance} (Expected: ₹0)`);
  console.log(`Due Amount:        ₹${saleItemPart.due} (Expected: ₹70)`);

  if (
    saleItemPart.advance_used !== 230 ||
    advPart.advance_balance !== 0 ||
    saleItemPart.due !== 70
  ) {
    throw new Error('Example 3 calculation failed!');
  }
  console.log('✓ PASS: Partial advance adjustment verified (Advance Used: 230, Remaining amount/Due: 70)!');

  // 6. Test 4: Advance Ledger Traceability
  console.log('\n6. Testing Advance Ledger Traceability (GET /api/customers/:id/advance)...');
  console.log('Ledger entries for customer 3:', advPart.ledger);
  if (!Array.isArray(advPart.ledger) || advPart.ledger.length < 2) {
    throw new Error('Expected at least 2 ledger entries (1 credit, 1 adjustment)');
  }
  const creditEntry = advPart.ledger.find((l: any) => l.type === 'credit');
  const adjEntry = advPart.ledger.find((l: any) => l.type === 'adjustment');
  if (!creditEntry || !creditEntry.reference_id) {
    throw new Error('Credit entry missing or reference_id not linked');
  }
  if (!adjEntry || !adjEntry.reference_id) {
    throw new Error('Adjustment entry missing or reference_id not linked to sale');
  }
  console.log('Credit Entry:    ', creditEntry);
  console.log('Adjustment Entry:', adjEntry);
  console.log('✓ PASS: Every advance addition and adjustment is fully traceable!');

  // 7. Test 5: Validation on POST /api/payments
  console.log('\n7. Testing validation on POST /api/payments...');
  const invRes1 = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({}),
  });
  console.log(`Empty body status: ${invRes1.status} (Expected: 400)`);
  if (invRes1.status !== 400) throw new Error('Expected 400 for empty payment');

  const invRes2 = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: cust1.id,
      date: testDate,
      amount: -10,
      payment_type: 'daily',
    }),
  });
  console.log(`Negative amount status: ${invRes2.status} (Expected: 400)`);
  if (invRes2.status !== 400) throw new Error('Expected 400 for negative amount');

  console.log('\n======================================================');
  console.log('  SUCCESS: ALL PHASE 5 VERIFICATION CHECKS PASSED!    ');
  console.log('  - Payments & advance_ledger tables operational       ');
  console.log('  - Daily Payment & Partial Payment verified           ');
  console.log('  - Customer Advance stored separately from cash       ');
  console.log('  - Automatic Advance Adjustment executed by backend   ');
  console.log('  - Advance Used, Remaining Advance & Due verified     ');
  console.log('  - Advance ledger traceability verified               ');
  console.log('  - POST /api/payments & GET /api/customers/:id/advance');
  console.log('======================================================\n');
}

runPhase5Verification().catch((err) => {
  console.error('\n❌ PHASE 5 VERIFICATION FAILED:', err);
  process.exit(1);
});
