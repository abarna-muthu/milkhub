import { Router, Response } from 'express';
import { tidb } from '../db/tidb.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { CreateCustomerDTO, UpdateCustomerDTO, CustomerStatus } from '../types/index.js';

const router = Router();

// Protect all customer routes with Owner auth middleware
router.use(authMiddleware);

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

  // Phone validation
  if (!isUpdate || body.phone !== undefined) {
    if (!body.phone || typeof body.phone !== 'string' || body.phone.trim().replace(/\D/g, '').length < 7) {
      return { valid: false, error: 'Valid phone number is required (min 7 digits)', field: 'phone' };
    }
  }

  // Address validation
  if (!isUpdate || body.address !== undefined) {
    if (!body.address || typeof body.address !== 'string' || body.address.trim().length < 2) {
      return { valid: false, error: 'Customer address is required', field: 'address' };
    }
  }

  // Area validation
  if (!isUpdate || body.area !== undefined) {
    if (!body.area || typeof body.area !== 'string' || body.area.trim().length < 2) {
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
    if (!body.start_date || isNaN(Date.parse(body.start_date))) {
      return { valid: false, error: 'Valid start date (YYYY-MM-DD) is required', field: 'start_date' };
    }
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

    // Respond with both array and envelope with total
    res.json({
      customers,
      total: customers.length,
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

    const payload: CreateCustomerDTO = {
      name: req.body.name,
      phone: req.body.phone,
      address: req.body.address,
      area: req.body.area,
      default_morning_qty: Number(req.body.default_morning_qty) || 0,
      default_evening_qty: Number(req.body.default_evening_qty) || 0,
      rate: Number(req.body.rate),
      start_date: String(req.body.start_date).split('T')[0],
      status: (req.body.status as CustomerStatus) || 'active',
    };

    const customer = await tidb.createCustomer(payload);

    res.status(201).json({
      message: 'Customer created successfully',
      customer,
      ...customer,
    });
  } catch (err: any) {
    console.error('Error creating customer:', err);
    res.status(500).json({ error: 'Failed to create customer' });
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
      customer,
      ...customer,
    });
  } catch (err: any) {
    console.error('Error fetching customer by id:', err);
    res.status(500).json({ error: 'Failed to retrieve customer' });
  }
});

/**
 * PATCH /api/customers/:id
 * Edit customer with validation
 */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
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
    if (req.body.phone !== undefined) updateData.phone = req.body.phone;
    if (req.body.address !== undefined) updateData.address = req.body.address;
    if (req.body.area !== undefined) updateData.area = req.body.area;
    if (req.body.default_morning_qty !== undefined)
      updateData.default_morning_qty = Number(req.body.default_morning_qty);
    if (req.body.default_evening_qty !== undefined)
      updateData.default_evening_qty = Number(req.body.default_evening_qty);
    if (req.body.rate !== undefined) updateData.rate = Number(req.body.rate);
    if (req.body.start_date !== undefined)
      updateData.start_date = String(req.body.start_date).split('T')[0];
    if (req.body.status !== undefined) updateData.status = req.body.status;

    const updated = await tidb.updateCustomer(id, updateData);

    res.json({
      message: 'Customer updated successfully',
      customer: updated,
      ...updated,
    });
  } catch (err: any) {
    console.error('Error updating customer:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

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
