import { Router, Response } from 'express';
import { tidb } from '../db/tidb.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { CreateCustomerDTO, UpdateCustomerDTO, CustomerStatus } from '../types/index.js';

const router = Router();

// Protect all customer routes with Owner auth middleware
router.use(authMiddleware);

/**
 * Robust date normalizer: converts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, etc. to standard YYYY-MM-DD
 */
export function normalizeDate(dateVal: any): string | null {
  if (!dateVal) return null;
  const s = String(dateVal).replace(/\s+/g, '').trim().split('T')[0];
  if (!s) return null;

  // Pattern: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Pattern: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Fallback to Date.parse
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Validation helper for customer data
 */
function validateCustomerPayload(
  body: any,
  isUpdate = false
): { valid: boolean; error?: string; field?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a valid JSON object' };
  }

  // Name validation
  if (!isUpdate || body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
      return { valid: false, error: 'Customer name is required and must be at least 2 characters', field: 'name' };
    }
  }

  // Phone validation (accepts phone or mobile)
  const phoneVal = body.phone !== undefined ? body.phone : body.mobile;
  if (!isUpdate || phoneVal !== undefined) {
    if (!phoneVal || typeof phoneVal !== 'string' || phoneVal.trim().replace(/\D/g, '').length < 7) {
      return { valid: false, error: 'Valid phone number is required (min 7 digits)', field: 'phone' };
    }
  }

  // Address validation
  if (!isUpdate || body.address !== undefined) {
    if (!body.address || typeof body.address !== 'string' || body.address.trim().length < 2) {
      return { valid: false, error: 'Customer address is required', field: 'address' };
    }
  }

  // Area validation (accepts area or village)
  const areaVal = body.area !== undefined ? body.area : body.village;
  if (!isUpdate || areaVal !== undefined) {
    if (!areaVal || typeof areaVal !== 'string' || areaVal.trim().length < 2) {
      return { valid: false, error: 'Area is required', field: 'area' };
    }
  }

  // Default Morning Qty validation
  if (!isUpdate || body.default_morning_qty !== undefined) {
    const qty = Number(body.default_morning_qty);
    if (isNaN(qty) || qty < 0) {
      return { valid: false, error: 'Default morning quantity must be a non-negative number', field: 'default_morning_qty' };
    }
  }

  // Default Evening Qty validation
  if (!isUpdate || body.default_evening_qty !== undefined) {
    const qty = Number(body.default_evening_qty);
    if (isNaN(qty) || qty < 0) {
      return { valid: false, error: 'Default evening quantity must be a non-negative number', field: 'default_evening_qty' };
    }
  }

  // Milk Rate/Litre validation
  if (!isUpdate || body.rate !== undefined) {
    const rate = Number(body.rate);
    if (isNaN(rate) || rate <= 0) {
      return { valid: false, error: 'Milk rate per litre must be a positive number greater than 0', field: 'rate' };
    }
  }

  // Start Date validation
  if (!isUpdate || body.start_date !== undefined) {
    const normalized = normalizeDate(body.start_date);
    if (!normalized) {
      return { valid: false, error: 'Valid start date (YYYY-MM-DD or DD-MM-YYYY) is required', field: 'start_date' };
    }
    body.start_date = normalized;
  }

  // Status validation
  if (body.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'inactive') {
      return { valid: false, error: "Status must be either 'active' or 'inactive'", field: 'status' };
    }
  }

  return { valid: true };
}

/**
 * GET /api/customers
 * List customers with search (name, phone, area) and filter (active, inactive)
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const status = req.query.status as 'active' | 'inactive' | undefined;

    const customers = await tidb.getCustomers({ search, status });

    // Enrich customer objects with mobile & village aliases
    const enriched = customers.map((c) => ({
      ...c,
      mobile: c.phone,
      village: c.area,
    }));

    // Respond with both array and envelope with total
    res.json({
      customers: enriched,
      total: enriched.length,
      search: search || null,
      status: status || null,
    });
  } catch (err: any) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ error: 'Failed to retrieve customers' });
  }
});

/**
 * POST /api/customers
 * Add new customer with validation
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = validateCustomerPayload(req.body, false);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        field: validation.field,
      });
    }

    const phone = (req.body.phone || req.body.mobile)?.trim();
    const area = (req.body.area || req.body.village)?.trim();

    const payload: CreateCustomerDTO = {
      name: req.body.name?.trim(),
      phone,
      address: req.body.address?.trim(),
      area,
      default_morning_qty: Number(req.body.default_morning_qty) || 0,
      default_evening_qty: Number(req.body.default_evening_qty) || 0,
      rate: Number(req.body.rate),
      start_date: normalizeDate(req.body.start_date) || String(req.body.start_date).split('T')[0],
      status: (req.body.status as CustomerStatus) || 'active',
    };

    const customer = await tidb.createCustomer(payload);

    res.status(201).json({
      message: 'Customer created successfully',
      customer: {
        ...customer,
        mobile: customer.phone,
        village: customer.area,
      },
      ...customer,
      mobile: customer.phone,
      village: customer.area,
    });
  } catch (err: any) {
    console.error('Error creating customer:', err);
    res.status(500).json({ error: err.message || 'Failed to create customer' });
  }
});

/**
 * GET /api/customers/:id
 * View single customer details
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const customer = await tidb.getCustomerById(id);

    if (!customer) {
      return res.status(404).json({ error: `Customer with ID '${id}' not found` });
    }

    res.json({
      customer: {
        ...customer,
        mobile: customer.phone,
        village: customer.area,
      },
      ...customer,
      mobile: customer.phone,
      village: customer.area,
    });
  } catch (err: any) {
    console.error('Error fetching customer by id:', err);
    res.status(500).json({ error: 'Failed to retrieve customer' });
  }
});

/**
 * Helper to update customer
 */
async function handleCustomerUpdate(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const validation = validateCustomerPayload(req.body, true);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        field: validation.field,
      });
    }

    const existing = await tidb.getCustomerById(id);
    if (!existing) {
      return res.status(404).json({ error: `Customer with ID '${id}' not found` });
    }

    const updateData: UpdateCustomerDTO = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    const phone = req.body.phone !== undefined ? req.body.phone : req.body.mobile;
    if (phone !== undefined) updateData.phone = phone;
    if (req.body.address !== undefined) updateData.address = req.body.address;
    const area = req.body.area !== undefined ? req.body.area : req.body.village;
    if (area !== undefined) updateData.area = area;
    if (req.body.default_morning_qty !== undefined)
      updateData.default_morning_qty = Number(req.body.default_morning_qty);
    if (req.body.default_evening_qty !== undefined)
      updateData.default_evening_qty = Number(req.body.default_evening_qty);
    if (req.body.rate !== undefined) updateData.rate = Number(req.body.rate);
    if (req.body.start_date !== undefined)
      updateData.start_date = normalizeDate(req.body.start_date) || String(req.body.start_date).split('T')[0];
    if (req.body.status !== undefined) updateData.status = req.body.status;

    const updated = await tidb.updateCustomer(id, updateData);
    if (!updated) {
      return res.status(404).json({ error: `Failed to update customer with ID '${id}'` });
    }

    res.json({
      message: 'Customer updated successfully',
      customer: {
        ...updated,
        mobile: updated.phone,
        village: updated.area,
      },
      ...updated,
      mobile: updated.phone,
      village: updated.area,
    });
  } catch (err: any) {
    console.error('Error updating customer:', err);
    res.status(500).json({ error: err.message || 'Failed to update customer' });
  }
}

/**
 * PATCH & PUT /api/customers/:id
 * Edit customer with validation
 */
router.patch('/:id', handleCustomerUpdate);
router.put('/:id', handleCustomerUpdate);

/**
 * Phase 5: GET /api/customers/:id/advance
 * Fetch customer advance balance and traceable advance ledger
 */
router.get('/:id/advance', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const advanceInfo = await tidb.getCustomerAdvance(id);
    res.json(advanceInfo);
  } catch (err: any) {
    if (err.message && err.message.includes('not exist')) {
      return res.status(404).json({ error: err.message });
    }
    console.error('Error fetching customer advance ledger:', err);
    res.status(500).json({ error: 'Failed to retrieve customer advance details' });
  }
});

/**
 * Phase 6: GET /api/customers/:id/history
 * Fetch customer historical delivery/sales ledger & monthly summary
 * Query params: ?month=YYYY-MM (optional)
 * History: Date, Morning, Evening, Total, Sale, Advance Used, Paid, Due
 * Monthly Summary: Total Milk, Total Sales, Total Paid, Total Due, Advance Balance
 */
router.get('/:id/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const month = req.query.month as string | undefined;

    const history = await tidb.getCustomerHistory(id, month);
    res.json(history);
  } catch (err: any) {
    if (err.message && err.message.includes('not exist')) {
      return res.status(404).json({ error: err.message });
    }
    console.error('Error fetching customer history:', err);
    res.status(500).json({ error: 'Failed to retrieve customer history' });
  }
});

export const customerRouter = router;
