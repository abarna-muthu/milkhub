import { Router, Response } from 'express';
import { tidb } from '../db/tidb.js';
import { store } from '../db/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const customerRouter = Router();

/**
 * GET /api/customers
 * List customers with multi-field search (Name, Phone, ID, Area) and filters (Center, Active/Inactive)
 */
customerRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      search,
      center_id,
      status,
      area,
      village,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));

    const result = await tidb.getCustomers({
      search: (search as string) || undefined,
      center_id: (center_id as string) || undefined,
      status: (status as string) || undefined,
      area: (area || village) as string || undefined,
      page: pageNum,
      limit: limitNum,
    });

    // Enrich with dynamic balance metrics from store for ledger/payment readiness
    const enriched = result.customers.map((cust) => {
      const collections = store.getCollections({ customer_id: cust.id });
      const payments = store.getPayments({ customer_id: cust.id });

      const totalMilk = Number(collections.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
      const totalAmount = Number(collections.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));
      const totalPaid = Number(payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
      const pendingAmount = Number((totalAmount - totalPaid).toFixed(2));

      return {
        ...cust,
        total_milk: totalMilk,
        total_amount: totalAmount,
        total_paid: totalPaid,
        pending_amount: pendingAmount,
      };
    });

    res.json({
      customers: enriched,
      total: result.total,
      page: pageNum,
      total_pages: Math.ceil(result.total / limitNum) || 1,
    });
  } catch (err: any) {
    console.error('[Customer Error] GET /api/customers:', err);
    res.status(500).json({ error: 'Failed to retrieve suppliers' });
  }
});

/**
 * GET /api/customers/:id
 * Retrieve customer profile details and summary
 */
customerRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cust = await tidb.getCustomerById(req.params.id);
    if (!cust) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const collections = store.getCollections({ customer_id: cust.id });
    const payments = store.getPayments({ customer_id: cust.id });
    const ledger = store.getLedgerByCustomerId(cust.id);

    const totalMilk = Number(collections.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
    const totalAmount = Number(collections.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));
    const totalPaid = Number(payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
    const pendingAmount = Number((totalAmount - totalPaid).toFixed(2));

    res.json({
      customer: cust,
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
  } catch (err: any) {
    console.error('[Customer Error] GET /api/customers/:id:', err);
    res.status(500).json({ error: 'Failed to retrieve customer details' });
  }
});

/**
 * GET /api/customers/:id/history
 * Comprehensive customer detail & history (Phase 6)
 * Returns Date, Morning, Evening, Total, Rate, Sale, Advance Used, Paid, Due
 * Monthly Summary: Total Milk, Total Sales, Total Paid, Total Due, Advance Balance
 */
customerRouter.get('/:id/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { month_year, from_date, to_date } = req.query;
    const historyData = await tidb.getCustomerHistory(req.params.id, {
      month_year: month_year as string,
      from_date: from_date as string,
      to_date: to_date as string,
    });

    if (!historyData.customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(historyData);
  } catch (err: any) {
    console.error('[Customer Error] GET /api/customers/:id/history:', err);
    res.status(500).json({ error: 'Failed to retrieve customer history' });
  }
});

/**
 * POST /api/customers
 * Add new Customer / Milk Supplier (with full validation)
 */
customerRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      customer_code,
      name,
      phone,
      mobile,
      address,
      area,
      village,
      center_id,
      collection_center_id,
      cow_count = 0,
      buffalo_count = 0,
      default_morning_qty = 1.0,
      default_evening_qty = 1.0,
      rate = 60.0,
      start_date,
      status = 'active',
      notes,
    } = req.body;

    // 1. Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Supplier Name is required' });
    }

    const cleanPhone = (phone || mobile || '').trim();
    if (!cleanPhone) {
      return res.status(400).json({ error: 'Phone Number is required' });
    }
    // Clean digits check
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit phone number' });
    }

    const cleanArea = (area || village || '').trim();
    if (!cleanArea) {
      return res.status(400).json({ error: 'Area / Village is required' });
    }

    const targetCenterId = center_id || collection_center_id;
    if (!targetCenterId) {
      return res.status(400).json({ error: 'Collection Center must be assigned' });
    }

    // Verify center exists
    const center = await tidb.getCenterById(targetCenterId);
    if (!center) {
      return res.status(400).json({ error: 'Assigned Collection Center does not exist' });
    }

    const numRate = Number(rate);
    if (isNaN(numRate) || numRate <= 0) {
      return res.status(400).json({ error: 'Rate per litre must be a positive number' });
    }

    const morningQty = Number(default_morning_qty);
    if (isNaN(morningQty) || morningQty < 0) {
      return res.status(400).json({ error: 'Default morning quantity cannot be negative' });
    }

    const eveningQty = Number(default_evening_qty);
    if (isNaN(eveningQty) || eveningQty < 0) {
      return res.status(400).json({ error: 'Default evening quantity cannot be negative' });
    }

    const numCow = Number(cow_count);
    const numBuffalo = Number(buffalo_count);
    if (numCow < 0 || numBuffalo < 0) {
      return res.status(400).json({ error: 'Animal counts cannot be negative' });
    }

    // 2. Persist to TiDB
    const saved = await tidb.createCustomer({
      customer_code: customer_code?.trim(),
      name: name.trim(),
      phone: cleanPhone,
      address: address?.trim() || '',
      area: cleanArea,
      center_id: targetCenterId,
      cow_count: numCow,
      buffalo_count: numBuffalo,
      default_morning_qty: morningQty,
      default_evening_qty: eveningQty,
      rate: numRate,
      start_date: start_date || new Date().toISOString().split('T')[0],
      status: status === 'inactive' ? 'inactive' : 'active',
      notes: notes?.trim() || '',
    });

    // 3. Mirror to store for full local sync
    store.addCustomer({
      id: saved.id,
      customer_code: saved.customer_code,
      name: saved.name,
      mobile: saved.phone,
      address: saved.address || '',
      village: saved.area,
      cow_count: saved.cow_count,
      buffalo_count: saved.buffalo_count,
      default_session: 'both',
      collection_center_id: saved.center_id,
      status: saved.status,
      notes: saved.notes || '',
      created_at: saved.created_at,
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('[Customer Error] POST /api/customers:', err);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

/**
 * PATCH /api/customers/:id
 * Edit supplier information
 */
customerRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await tidb.updateCustomer(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Mirror to store
    store.updateCustomer(req.params.id, {
      customer_code: updated.customer_code,
      name: updated.name,
      mobile: updated.phone,
      address: updated.address,
      village: updated.area,
      collection_center_id: updated.center_id,
      cow_count: updated.cow_count,
      buffalo_count: updated.buffalo_count,
      status: updated.status,
    });

    res.json(updated);
  } catch (err: any) {
    console.error('[Customer Error] PATCH /api/customers/:id:', err);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

/**
 * PUT /api/customers/:id (backward compatibility alias for PATCH)
 */
customerRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await tidb.updateCustomer(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    store.updateCustomer(req.params.id, {
      customer_code: updated.customer_code,
      name: updated.name,
      mobile: updated.phone,
      address: updated.address,
      village: updated.area,
      collection_center_id: updated.center_id,
      status: updated.status,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

/**
 * DELETE /api/customers/:id
 * Soft delete: deactivates supplier to protect historical delivery and payment records
 */
customerRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await tidb.deactivateCustomer(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    store.updateCustomer(req.params.id, { status: 'inactive' });

    res.json({
      message: 'Supplier deactivated successfully. Historical records preserved.',
      status: 'inactive',
    });
  } catch (err: any) {
    console.error('[Customer Error] DELETE /api/customers/:id:', err);
    res.status(500).json({ error: 'Failed to deactivate supplier' });
  }
});
