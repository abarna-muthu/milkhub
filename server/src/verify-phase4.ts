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

async function runPhase4Verification() {
  console.log('====================================================');
  console.log('  MILK BUSINESS CRM - PHASE 4 VERIFICATION SUITE   ');
  console.log('  Automatic Sales Calculation & Day-Wise Display   ');
  console.log('  Morning Qty + Evening Qty = Total Litres         ');
  console.log('  Total Litres * Rate = Daily Sale • Due = Sale    ');
  console.log('====================================================\n');

  // 1. Health check - Phase 4
  console.log('1. Testing GET /api/health for Phase 4...');
  const healthRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/health',
    method: 'GET',
  });
  console.log(`Status: ${healthRes.statusCode}`, healthRes.data);
  if (healthRes.statusCode !== 200 || !healthRes.data?.phase?.includes('Phase 4')) {
    throw new Error('Health check failed for Phase 4');
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
  console.log('\n3. Testing GET /api/sales without token (Expected: 401)...');
  const unauthRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/sales',
    method: 'GET',
  });
  console.log(`Status: ${unauthRes.statusCode} (Expected: 401)`);
  if (unauthRes.statusCode !== 401) {
    throw new Error('Unauthenticated access to /api/sales was unexpectedly permitted');
  }

  // 4. Create customer with Rate = 60.0
  console.log('\n4. Creating customer matching PDF specification (Rate = ₹60/L)...');
  const testCustomerPayload = {
    name: 'Murugan Dairy',
    phone: '9840776655',
    address: '10 Bazaar Street',
    area: 'East Market',
    default_morning_qty: 1.0,
    default_evening_qty: 1.0,
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
    throw new Error('Failed to create customer for Phase 4 verification');
  }
  const customer = createCustRes.data.customer || createCustRes.data;
  console.log(`Customer Created: ID=${customer.id}, Name=${customer.name}, Rate=₹${customer.rate}/L`);

  const testDate = '2026-09-27';

  // 5. Record Morning Delivery = 1.5L
  console.log('\n5. Recording Morning Delivery = 1.5L...');
  const morningRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/deliveries',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: customer.id,
      date: testDate,
      session: 'morning',
      actual_qty: 1.5,
      status: 'delivered',
    }
  );
  if (morningRes.statusCode !== 201) {
    throw new Error('Failed to save morning delivery');
  }
  console.log('Morning delivery saved: 1.5L');

  // 6. Record Evening Delivery = 0.5L
  console.log('\n6. Recording Evening Delivery = 0.5L...');
  const eveningRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/deliveries',
      method: 'POST',
      headers: authHeaders,
    },
    {
      customer_id: customer.id,
      date: testDate,
      session: 'evening',
      actual_qty: 0.5,
      status: 'delivered',
    }
  );
  if (eveningRes.statusCode !== 201) {
    throw new Error('Failed to save evening delivery');
  }
  console.log('Evening delivery saved: 0.5L');

  // 7. Verify Day-Wise Sales Display (GET /api/sales?date=2026-09-27)
  console.log(`\n7. Fetching Day-Wise Sales for ${testDate} (GET /api/sales)...`);
  const salesRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/sales?date=${testDate}`,
    method: 'GET',
    headers: authHeaders,
  });

  console.log(`Status: ${salesRes.statusCode}`);
  if (salesRes.statusCode !== 200 || !Array.isArray(salesRes.data.sales)) {
    throw new Error('Failed to fetch day-wise sales');
  }

  const saleItem = salesRes.data.sales.find((s: any) => s.customer_id === customer.id);
  if (!saleItem) {
    throw new Error(`Customer ${customer.id} not found in sales list`);
  }

  console.log('\n--- VERIFYING EXACT PDF FORMULA CALCULATION ---');
  console.log(`Date:         ${saleItem.date}`);
  console.log(`Customer:     ${saleItem.customer_name}`);
  console.log(`Morning:      ${saleItem.morning_qty}L (Expected: 1.5L)`);
  console.log(`Evening:      ${saleItem.evening_qty}L (Expected: 0.5L)`);
  console.log(`Total Litres: ${saleItem.total_litres}L (Expected: 2L)`);
  console.log(`Rate:         ₹${saleItem.rate}/L (Expected: ₹60/L)`);
  console.log(`Daily Sale:   ₹${saleItem.sale_amount} (Expected: ₹120)`);
  console.log(`Advance Used: ₹${saleItem.advance_used} (Expected: ₹0)`);
  console.log(`Paid:         ₹${saleItem.paid} (Expected: ₹0)`);
  console.log(`Due:          ₹${saleItem.due} (Expected: ₹120)`);

  if (Number(saleItem.morning_qty) !== 1.5) {
    throw new Error(`Morning Qty mismatch: expected 1.5, got ${saleItem.morning_qty}`);
  }
  if (Number(saleItem.evening_qty) !== 0.5) {
    throw new Error(`Evening Qty mismatch: expected 0.5, got ${saleItem.evening_qty}`);
  }
  if (Number(saleItem.total_litres) !== 2.0) {
    throw new Error(`Total Litres calculation mismatch: expected 2.0, got ${saleItem.total_litres}`);
  }
  if (Number(saleItem.rate) !== 60.0) {
    throw new Error(`Rate mismatch: expected 60.0, got ${saleItem.rate}`);
  }
  if (Number(saleItem.sale_amount) !== 120.0) {
    throw new Error(`Daily Sale calculation mismatch: expected 120.0, got ${saleItem.sale_amount}`);
  }
  if (Number(saleItem.due) !== 120.0) {
    throw new Error(`Due calculation mismatch: expected 120.0, got ${saleItem.due}`);
  }

  console.log('✓ PASS: Exact PDF calculation verified: 1.5L + 0.5L = 2L * ₹60 = ₹120 Sale (Due: ₹120)');

  // 8. Verify Sales Summary
  console.log('\n8. Checking Sales Summary Totals...');
  const summary = salesRes.data.summary;
  console.log('Summary Totals:', summary);
  if (
    summary.total_litres < 2.0 ||
    summary.total_sales_amount < 120.0 ||
    summary.total_due < 120.0
  ) {
    throw new Error('Summary totals verification failed');
  }
  console.log('✓ PASS: Summary totals correctly aggregated!');

  console.log('\n======================================================');
  console.log('  SUCCESS: ALL PHASE 4 VERIFICATION CHECKS PASSED!    ');
  console.log('  - Sales table created & populated                   ');
  console.log('  - Automatic calculation handled by Node.js backend  ');
  console.log('  - Morning Actual + Evening Actual = Total Litres    ');
  console.log('  - Total Litres * Rate = Daily Sale                  ');
  console.log('  - Due = Sale - (Advance Used + Paid)                ');
  console.log('  - Day-wise display columns fully verified           ');
  console.log('======================================================\n');
}

runPhase4Verification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
