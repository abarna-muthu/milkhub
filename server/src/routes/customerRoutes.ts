import { Router, Response } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { Customer } from '../types/index.js';

export const customerRouter = Router();

// List customers with filters and pagination
customerRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const { search, center_id, status, session, village, page = '1', limit = '50' } = req.query;

  const filtered = store.getCustomers({
    search: search as string,
    center_id: center_id as string,
    status: status as string,
    session: session as string,
    village: village as string,
  });

  const pageNum = parseInt(page as string, 10) || 1;
  const limitNum = parseInt(limit as string, 10) || 50;
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;

  // Enrich customer records with center name and quick metrics
  const paginated = filtered.slice(startIndex, endIndex).map((cust) => {
    const center = store.getCenterById(cust.collection_center_id);
    const collections = store.getCollections({ customer_id: cust.id });
    const payments = store.getPayments({ customer_id: cust.id });

    const totalMilk = Number(collections.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
    const totalAmount = Number(collections.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));
    const totalPaid = Number(payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
    const pendingAmount = Number((totalAmount - totalPaid).toFixed(2));

    return {
      ...cust,
      center_name: center?.name || 'Main Center',
      total_milk: totalMilk,
      total_amount: totalAmount,
      total_paid: totalPaid,
      pending_amount: pendingAmount,
    };
  });

  res.json({
    customers: paginated,
    total: filtered.length,
    page: pageNum,
    total_pages: Math.ceil(filtered.length / limitNum),
  });
});

// Single customer detail with full summary
customerRouter.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const cust = store.getCustomerById(req.params.id);
  if (!cust) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const center = store.getCenterById(cust.collection_center_id);
  const collections = store.getCollections({ customer_id: cust.id });
  const payments = store.getPayments({ customer_id: cust.id });
  const ledger = store.getLedgerByCustomerId(cust.id);

  const totalMilk = Number(collections.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
  const totalAmount = Number(collections.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));
  const totalPaid = Number(payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
  const pendingAmount = Number((totalAmount - totalPaid).toFixed(2));

  res.json({
    customer: {
      ...cust,
      center_name: center?.name || 'Main Center',
    },
    summary: {
      total_milk: totalMilk,
      total_amount: totalAmount,
      total_paid: totalPaid,
      pending_amount: pendingAmount,
      collection_count: collections.length,
      payment_count: payments.length,
    },
    recent_collections: collections.slice(0, 10),
    recent_payments: payments.slice(0, 10),
    ledger_entries: ledger,
  });
});

// Create Customer
customerRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  const {
    name,
    customer_code,
    mobile,
    address,
    village,
    cow_count = 0,
    buffalo_count = 0,
    default_session = 'both',
    collection_center_id,
    status = 'active',
    notes,
    opening_balance = 0,
    initial_milk,
  } = req.body;

  if (!name || !mobile || !village) {
    return res.status(400).json({ error: 'Name, Mobile, and Village are required' });
  }

  // Generate code if not provided
  let code = customer_code?.trim().toUpperCase();
  if (!code) {
    const existingCount = store.getCustomers().length + 1;
    code = `MILK${String(existingCount).padStart(3, '0')}`;
  }

  const newCust: Customer = {
    id: `cust_${Date.now()}`,
    customer_code: code,
    name: name.trim(),
    mobile: mobile.trim(),
    address: address?.trim() || '',
    village: village.trim(),
    cow_count: Number(cow_count) || 0,
    buffalo_count: Number(buffalo_count) || 0,
    default_session: default_session || 'both',
    collection_center_id: collection_center_id || 'c1',
    status: status || 'active',
    notes: notes?.trim() || '',
    created_at: new Date().toISOString(),
  };

  const saved = store.addCustomer(newCust);

  // If opening pending balance provided (> 0), record opening debit
  const openBal = Number(opening_balance) || 0;
  if (openBal > 0) {
    store.addLedgerEntry({
      id: `led_open_${saved.id}`,
      customer_id: saved.id,
      date: new Date().toISOString().split('T')[0],
      description: 'Opening Balance (Previous Pending Due)',
      debit: openBal,
      credit: 0,
      running_balance: openBal,
      reference_type: 'opening',
      created_at: new Date().toISOString(),
    });
  }

  // If initial milk intake is provided (> 0 litres)
  if (initial_milk && Number(initial_milk.quantity) > 0) {
    const colDate = initial_milk.date || new Date().toISOString().split('T')[0];
    const colSession = initial_milk.session || (new Date().getHours() < 14 ? 'morning' : 'evening');
    const qty = Number(initial_milk.quantity);
    const fat = Number(initial_milk.fat_percentage) || 4.2;
    const snf = Number(initial_milk.snf_percentage) || 8.5;
    const rate = Number(initial_milk.calculated_rate) || 42.0;
    const totalAmt = Number(initial_milk.total_amount) || Number((qty * rate).toFixed(2));
    const payStatus = initial_milk.payment_status || 'PENDING';

    store.addCollection({
      id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      customer_id: saved.id,
      supplier_type: 'REGISTERED',
      collection_center_id: saved.collection_center_id,
      date: colDate,
      session: colSession,
      animal_type: initial_milk.animal_type || (saved.buffalo_count > 0 && saved.cow_count === 0 ? 'buffalo' : 'cow'),
      quantity: qty,
      fat_percentage: fat,
      snf_percentage: snf,
      calculated_rate: rate,
      total_amount: totalAmt,
      payment_status: payStatus,
      status: 'collected',
      collected_by: req.user?.name || 'Murugan S',
      notes: initial_milk.notes || 'First milk intake on onboarding',
      created_at: new Date().toISOString(),
    });

    // If marked Paid (spot payout at counter), create payment record
    if (payStatus === 'PAID') {
      store.addPayment({
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        customer_id: saved.id,
        collection_center_id: saved.collection_center_id,
        date: colDate,
        amount: totalAmt,
        payment_method: 'cash',
        reference_no: 'SPOT-CASH',
        status: 'completed',
        notes: 'Instant spot payment on initial milk delivery',
        created_by: req.user?.name || 'Admin',
        created_at: new Date().toISOString(),
      });
    }
  }

  res.status(201).json(saved);
});

// Update Customer
customerRouter.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  const updated = store.updateCustomer(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  res.json(updated);
});

// Delete Customer (Admin only)
customerRouter.delete('/:id', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const success = store.deleteCustomer(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  res.json({ message: 'Customer deleted successfully' });
});
