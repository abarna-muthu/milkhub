import { Router, Response } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { MilkCollection } from '../types/index.js';
import { calculateMilkRate } from '../utils/rateCalculator.js';

export const collectionRouter = Router();

// List collections with rich filters
collectionRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const { date, session, customer_id, center_id, supplier_type, payment_status, from_date, to_date } = req.query;

  const collections = store.getCollections({
    date: date as string,
    session: session as string,
    customer_id: customer_id as string,
    center_id: center_id as string,
    supplier_type: supplier_type as string,
    payment_status: payment_status as string,
    from_date: from_date as string,
    to_date: to_date as string,
  });

  // Enrich with customer/walk-in and center details
  const enriched = collections.map((col) => {
    const isDirect = col.supplier_type === 'DIRECT';
    const cust = col.customer_id ? store.getCustomerById(col.customer_id) : undefined;
    const center = store.getCenterById(col.collection_center_id);

    return {
      ...col,
      supplier_type: col.supplier_type || (cust ? 'REGISTERED' : 'DIRECT'),
      customer_name: isDirect ? (col.walk_in_name || 'Direct Supplier') : (cust?.name || 'Unknown Supplier'),
      customer_code: isDirect ? 'DIRECT' : (cust?.customer_code || '---'),
      customer_mobile: isDirect ? (col.walk_in_mobile || '') : (cust?.mobile || ''),
      village: isDirect ? 'Direct / Walk-in' : (cust?.village || ''),
      center_name: center?.name || 'Main Center',
      payment_status: col.payment_status || (isDirect ? 'PAID' : 'PENDING'),
    };
  });

  res.json(enriched);
});

// Today's summary stats
collectionRouter.get('/today-summary', (req: AuthenticatedRequest, res: Response) => {
  const centerId = req.query.center_id as string;
  const today = (req.query.date as string) || new Date().toISOString().split('T')[0];

  const todayCollections = store.getCollections({
    date: today,
    center_id: centerId,
  });

  const morningCollections = todayCollections.filter((c) => c.session === 'morning');
  const eveningCollections = todayCollections.filter((c) => c.session === 'evening');

  const morningMilk = Number(morningCollections.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
  const eveningMilk = Number(eveningCollections.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
  const totalMilk = Number((morningMilk + eveningMilk).toFixed(1));

  const morningAmount = Number(morningCollections.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));
  const eveningAmount = Number(eveningCollections.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));
  const totalAmount = Number((morningAmount + eveningAmount).toFixed(2));

  // Registered vs Direct supplier counts
  const registeredCollections = todayCollections.filter((c) => c.supplier_type !== 'DIRECT' && c.customer_id);
  const directCollections = todayCollections.filter((c) => c.supplier_type === 'DIRECT');

  const registeredSupplierCount = new Set(registeredCollections.map((c) => c.customer_id)).size;
  const directSupplierCount = directCollections.length;

  res.json({
    date: today,
    total_milk: totalMilk,
    total_amount: totalAmount,
    morning_milk: morningMilk,
    morning_amount: morningAmount,
    morning_count: morningCollections.length,
    evening_milk: eveningMilk,
    evening_amount: eveningAmount,
    evening_count: eveningCollections.length,
    registered_supplier_count: registeredSupplierCount,
    direct_supplier_count: directSupplierCount,
    total_suppliers_collected: registeredSupplierCount + directSupplierCount,
  });
});

// Rapid Milk Collection Entry (Save Collection)
collectionRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  const {
    supplier_type = 'REGISTERED',
    customer_id,
    walk_in_name,
    walk_in_mobile,
    payment_status = 'PENDING',
    collection_center_id,
    date,
    session,
    animal_type = 'cow',
    quantity,
    fat_percentage,
    snf_percentage,
    calculated_rate,
    total_amount,
    notes,
  } = req.body;

  if (!quantity || !fat_percentage || !snf_percentage) {
    return res.status(400).json({ error: 'Quantity, Fat %, and SNF % are required' });
  }

  const isDirect = supplier_type === 'DIRECT';
  let targetCustomer: any = null;
  let targetCenterId = collection_center_id;

  if (isDirect) {
    if (!targetCenterId || targetCenterId === 'all') {
      return res.status(400).json({ error: 'A specific Collection Center must be selected' });
    }
  } else {
    // Registered supplier
    if (!customer_id) {
      return res.status(400).json({ error: 'Registered customer is required' });
    }
    targetCustomer = store.getCustomerById(customer_id);
    if (!targetCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    targetCenterId = targetCenterId && targetCenterId !== 'all' ? targetCenterId : (targetCustomer.collection_center_id || 'c1');
  }

  const collectionDate = date || new Date().toISOString().split('T')[0];

  // Derive or verify rate
  let finalRate = calculated_rate;
  let finalTotal = total_amount;

  if (!finalRate || !finalTotal) {
    const activeRate = store.getActiveRate();
    const calc = calculateMilkRate(
      Number(quantity),
      Number(fat_percentage),
      Number(snf_percentage),
      activeRate,
      animal_type
    );
    finalRate = calc.ratePerLitre;
    finalTotal = calc.totalAmount;
  }

  const newCollection: MilkCollection = {
    id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    customer_id: isDirect ? null : targetCustomer.id,
    supplier_id: isDirect ? null : targetCustomer.id,
    supplier_type: isDirect ? 'DIRECT' : 'REGISTERED',
    walk_in_name: isDirect ? (walk_in_name?.trim() || 'Direct Supplier') : null,
    walk_in_mobile: isDirect ? (walk_in_mobile?.trim() || null) : null,
    payment_status: isDirect ? (payment_status || 'PAID') : (payment_status || 'PENDING'),
    collection_center_id: targetCenterId,
    date: collectionDate,
    session: session || (new Date().getHours() < 14 ? 'morning' : 'evening'),
    animal_type,
    quantity: Number(Number(quantity).toFixed(2)),
    fat_percentage: Number(Number(fat_percentage).toFixed(2)),
    snf_percentage: Number(Number(snf_percentage).toFixed(2)),
    calculated_rate: Number(Number(finalRate).toFixed(2)),
    total_amount: Number(Number(finalTotal).toFixed(2)),
    status: 'collected',
    collected_by: req.user?.name || 'Collection Staff',
    notes: notes?.trim() || '',
    created_at: new Date().toISOString(),
  };

  const saved = store.addCollection(newCollection);

  const center = store.getCenterById(targetCenterId);
  res.status(201).json({
    ...saved,
    customer_name: isDirect ? newCollection.walk_in_name : targetCustomer?.name,
    customer_code: isDirect ? 'DIRECT' : targetCustomer?.customer_code,
    center_name: center?.name || 'Main Center',
  });
});

// Update Collection
collectionRouter.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  const updated = store.updateCollection(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Collection record not found' });
  }
  res.json(updated);
});

// Delete Collection
collectionRouter.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const success = store.deleteCollection(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Collection record not found' });
  }
  res.json({ message: 'Collection deleted successfully' });
});
