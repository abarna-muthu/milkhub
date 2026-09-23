import { Router, Response } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { Expense } from '../types/index.js';

export const expenseRouter = Router();

// List expenses
expenseRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const { center_id, category, from_date, to_date } = req.query;

  const expenses = store.getExpenses({
    center_id: center_id as string,
    category: category as string,
    from_date: from_date as string,
    to_date: to_date as string,
  });

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);

  const todayExpenses = expenses.filter((e) => e.date === today);
  const thisMonthExpenses = expenses.filter((e) => e.date.startsWith(currentMonth));

  const todayTotal = Number(todayExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2));
  const thisMonthTotal = Number(thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2));
  const grandTotal = Number(expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2));

  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  const enriched = expenses.map((exp) => {
    const center = store.getCenterById(exp.collection_center_id);
    return {
      ...exp,
      center_name: center?.name || 'Main Center',
    };
  });

  res.json({
    expenses: enriched,
    summary: {
      today_expenses: todayTotal,
      this_month_expenses: thisMonthTotal,
      total_expenses: grandTotal,
      category_totals: categoryTotals,
    },
  });
});

// Add Expense
expenseRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  const {
    collection_center_id,
    date,
    category,
    description,
    amount,
    payment_method = 'cash',
    notes,
  } = req.body;

  if (!category || !description || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Category, Description, and valid Amount are required' });
  }

  const newExpense: Expense = {
    id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    collection_center_id: collection_center_id || 'c1',
    date: date || new Date().toISOString().split('T')[0],
    category,
    description: description.trim(),
    amount: Number(Number(amount).toFixed(2)),
    payment_method,
    notes: notes?.trim() || '',
    added_by: req.user?.name || 'Staff',
    created_at: new Date().toISOString(),
  };

  const saved = store.addExpense(newExpense);
  res.status(201).json(saved);
});

// Delete Expense (Admin only)
expenseRouter.delete('/:id', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const success = store.deleteExpense(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  res.json({ message: 'Expense deleted successfully' });
});
