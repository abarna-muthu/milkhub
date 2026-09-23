import React, { useState, useEffect, useRef } from 'react';
import { Milk, Check, Search, Building2, User, UserCheck, Zap, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { Customer, MilkRate, SupplierType, PaymentStatus } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useCenter } from '../../context/CenterContext';
import { useToast } from '../../context/ToastContext';
import { customersApi, collectionsApi, ratesApi } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

interface FastCollectionFormProps {
  onCollectionSaved: () => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export const FastCollectionForm: React.FC<FastCollectionFormProps> = ({
  onCollectionSaved,
  selectedDate,
  onDateChange,
}) => {
  const { t } = useLanguage();
  const { centers, selectedCenterId, setSelectedCenterId } = useCenter();
  const { showToast } = useToast();

  // Active Rate Config
  const [activeRate, setActiveRate] = useState<MilkRate | null>(null);

  // 4-STEP WORKFLOW STATE
  // Step 1: Collection Center
  const [centerId, setCenterId] = useState<string>(() => {
    return selectedCenterId !== 'all' ? selectedCenterId : (centers[0]?.id || 'c1');
  });

  // Step 2: Session
  const [session, setSession] = useState<'morning' | 'evening'>(() => {
    return new Date().getHours() < 14 ? 'morning' : 'evening';
  });

  // Step 3: Supplier Type
  const [supplierType, setSupplierType] = useState<SupplierType>('REGISTERED');

  // Step 4: Registered Supplier State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  // Step 4: Direct / Walk-in Supplier Quick-Entry State
  const [walkInName, setWalkInName] = useState('');
  const [walkInMobile, setWalkInMobile] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PAID');

  // Milk Intake & Analysis
  const [animalType, setAnimalType] = useState<'cow' | 'buffalo'>('cow');
  const [quantity, setQuantity] = useState<string>('');
  const [fat, setFat] = useState<string>('4.2');
  const [snf, setSnf] = useState<string>('8.5');
  const [calculatedRate, setCalculatedRate] = useState<number>(42.0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Input refs for high-speed dock entry
  const searchInputRef = useRef<HTMLInputElement>(null);
  const walkInNameRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const fatInputRef = useRef<HTMLInputElement>(null);
  const snfInputRef = useRef<HTMLInputElement>(null);

  // Sync centerId when global center changes
  useEffect(() => {
    if (selectedCenterId && selectedCenterId !== 'all') {
      setCenterId(selectedCenterId);
    }
  }, [selectedCenterId]);

  // Load Active Rate Formula
  useEffect(() => {
    ratesApi.getActive().then((r) => setActiveRate(r)).catch(() => {
      setActiveRate({
        id: 'default',
        pricing_type: 'fat_snf',
        base_rate: 42.0,
        standard_fat: 4.2,
        standard_snf: 8.5,
        fat_rate: 3.5,
        snf_rate: 2.0,
        effective_date: '',
        updated_by: '',
        is_active: true,
      });
    });
  }, []);

  // Fetch Registered Customers for selected Center
  useEffect(() => {
    customersApi.getAll({ center_id: centerId, limit: 200 }).then((res) => {
      setCustomersList(res.customers || []);
    });
  }, [centerId]);

  // Dynamic Rate & Amount Calculation
  useEffect(() => {
    const q = parseFloat(quantity) || 0;
    const f = parseFloat(fat) || 4.2;
    const s = parseFloat(snf) || 8.5;

    let rate = 42.0;
    if (activeRate) {
      if (activeRate.pricing_type === 'fixed') {
        rate = animalType === 'buffalo' ? 50.0 : activeRate.base_rate;
      } else {
        const fatDiff = f - activeRate.standard_fat;
        const snfDiff = s - activeRate.standard_snf;
        rate = activeRate.base_rate + fatDiff * activeRate.fat_rate + snfDiff * activeRate.snf_rate;
        if (animalType === 'buffalo' && f >= 6.0) rate = Math.max(rate, 50.0);
        rate = Math.max(rate, 28.0);
      }
    }

    const roundedRate = Number(rate.toFixed(2));
    const roundedTotal = Number((q * roundedRate).toFixed(2));

    setCalculatedRate(roundedRate);
    setTotalAmount(roundedTotal);
  }, [quantity, fat, snf, animalType, activeRate]);

  // Registered Customer Autocomplete Filter
  const filteredCustomers = customersList.filter((c) => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.customer_code.toLowerCase().includes(q) ||
      c.mobile.includes(q)
    );
  });

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setSearchQuery(`${cust.name} (${cust.customer_code})`);
    setIsCustomerDropdownOpen(false);

    // Auto-select animal if they only own buffaloes
    if (cust.buffalo_count > 0 && cust.cow_count === 0) {
      setAnimalType('buffalo');
      setFat('6.5');
      setSnf('9.0');
    }

    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const handleCenterChange = (newCenterId: string) => {
    setCenterId(newCenterId);
    setSelectedCustomer(null);
    setSearchQuery('');
    // Optionally update global context so rest of CRM aligns
    setSelectedCenterId(newCenterId);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (supplierType === 'REGISTERED') {
      if (!selectedCustomer) {
        showToast('Please select a registered supplier first', 'warning');
        searchInputRef.current?.focus();
        return;
      }
    }

    const q = parseFloat(quantity);
    if (!q || q <= 0) {
      showToast('Please enter a valid milk quantity in litres', 'warning');
      qtyInputRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      const isDirect = supplierType === 'DIRECT';

      await collectionsApi.create({
        supplier_type: supplierType,
        customer_id: isDirect ? null : selectedCustomer?.id,
        walk_in_name: isDirect ? (walkInName.trim() || 'Direct Supplier') : null,
        walk_in_mobile: isDirect ? (walkInMobile.trim() || null) : null,
        payment_status: isDirect ? paymentStatus : 'PENDING',
        collection_center_id: centerId,
        date: selectedDate,
        session,
        animal_type: animalType,
        quantity: q,
        fat_percentage: parseFloat(fat) || 4.2,
        snf_percentage: parseFloat(snf) || 8.5,
        calculated_rate: calculatedRate,
        total_amount: totalAmount,
        notes,
      });

      const centerObj = centers.find((c) => c.id === centerId);
      const supplierDisplayName = isDirect
        ? (walkInName.trim() || 'Direct / Walk-in Supplier')
        : selectedCustomer?.name;

      showToast(
        `✓ ${supplierDisplayName}: ${q}L @ ₹${calculatedRate}/L = ₹${totalAmount} (${session.toUpperCase()}) saved for ${centerObj?.name || 'Center'}`,
        'success',
        'Milk Collection Recorded'
      );

      // Reset form for next entry
      setQuantity('');
      if (isDirect) {
        setWalkInName('');
        setWalkInMobile('');
        setPaymentStatus('PAID');
        walkInNameRef.current?.focus();
      } else {
        setSelectedCustomer(null);
        setSearchQuery('');
        searchInputRef.current?.focus();
      }
      setNotes('');
      onCollectionSaved();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save collection', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCenterObj = centers.find((c) => c.id === centerId);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
      {/* Top Banner: Date Selector & Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-brand-900 text-white flex items-center justify-center font-bold">
            <Milk className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">{t('daily_collection')}</h2>
            <p className="text-[11px] text-slate-500">
              Center-Wise Intake Workflow • Single Source of Truth
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-600">{t('date_selector')}:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-300 rounded text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-800"
            />
          </div>
        </div>
      </div>

      {/* 4-Step Intake Workflow Panel */}
      <form onSubmit={handleSave} className="p-5 space-y-5">
        {/* Step 1 & 2: Center & Session Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs">
          {/* Step 1: Select Collection Center */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-900 text-white text-[10px] inline-flex items-center justify-center font-bold">
                1
              </span>
              {t('step1_center')} <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <select
                value={centerId}
                onChange={(e) => handleCenterChange(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded font-semibold text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-800"
              >
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 2: Select Session */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-900 text-white text-[10px] inline-flex items-center justify-center font-bold">
                2
              </span>
              {t('step2_session')} <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 h-9 bg-white border border-slate-300 rounded p-0.5">
              <button
                type="button"
                onClick={() => setSession('morning')}
                className={`text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors ${
                  session === 'morning'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                ☀ {t('morning')}
              </button>
              <button
                type="button"
                onClick={() => setSession('evening')}
                className={`text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors ${
                  session === 'evening'
                    ? 'bg-indigo-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                🌙 {t('evening')}
              </button>
            </div>
          </div>
        </div>

        {/* Step 3: TWO DISTINCT INTAKE BOXES */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-brand-900 text-white text-[10px] inline-flex items-center justify-center font-bold">
              3
            </span>
            {t('step3_supplier_type')} <span className="text-rose-600">*</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* BOX 1 BUTTON: CENTER REGISTERED */}
            <button
              type="button"
              onClick={() => {
                setSupplierType('REGISTERED');
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className={`p-3.5 rounded-lg border-2 text-left transition-all flex items-start gap-3 ${
                supplierType === 'REGISTERED'
                  ? 'border-emerald-600 bg-emerald-50/80 shadow-sm ring-1 ring-emerald-600'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className={`w-9 h-9 rounded flex items-center justify-center font-bold text-sm shrink-0 ${
                supplierType === 'REGISTERED' ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                🏢
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-slate-900">
                    {t('step3_box1_title')}
                  </h4>
                  {supplierType === 'REGISTERED' ? (
                    <span className="text-[10px] font-bold bg-brand-900 text-white px-2 py-0.5 rounded">
                      ✓ {t('active_box')}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {t('select')}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                  {t('step3_box1_desc')}
                </p>
              </div>
            </button>

            {/* BOX 2 BUTTON: DIRECT / WALK-IN */}
            <button
              type="button"
              onClick={() => {
                setSupplierType('DIRECT');
                setTimeout(() => walkInNameRef.current?.focus(), 50);
              }}
              className={`p-3.5 rounded-lg border-2 text-left transition-all flex items-start gap-3 ${
                supplierType === 'DIRECT'
                  ? 'border-amber-500 bg-amber-50/80 shadow-sm ring-1 ring-amber-500'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className={`w-9 h-9 rounded flex items-center justify-center font-bold text-sm shrink-0 ${
                supplierType === 'DIRECT' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                ⚡
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-slate-900">
                    {t('step3_box2_title')}
                  </h4>
                  {supplierType === 'DIRECT' ? (
                    <span className="text-[10px] font-bold bg-amber-600 text-white px-2 py-0.5 rounded">
                      ✓ {t('active_box')}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {t('select')}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                  {t('step3_box2_desc')}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Step 4: Active Box Intake Area */}
        <div className={`border-2 rounded-lg p-4 transition-colors ${
          supplierType === 'REGISTERED'
            ? 'border-emerald-600/70 bg-emerald-50/20'
            : 'border-amber-500/70 bg-amber-50/20'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200/80">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full text-white text-[10px] inline-flex items-center justify-center font-bold ${
                supplierType === 'REGISTERED' ? 'bg-brand-900' : 'bg-amber-600'
              }`}>
                4
              </span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {supplierType === 'REGISTERED'
                  ? `${t('step4_box1_title')} (${selectedCenterObj?.name || t('center')})`
                  : `${t('step4_box2_title')} (${selectedCenterObj?.name || t('center')})`}
              </h3>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              supplierType === 'REGISTERED'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-amber-100 text-amber-900 border-amber-300'
            }`}>
              {supplierType === 'REGISTERED' ? t('box1_badge') : t('box2_badge')}
            </span>
          </div>

          {supplierType === 'REGISTERED' ? (
            /* Registered Supplier Search */
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsCustomerDropdownOpen(true);
                    if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                      setSelectedCustomer(null);
                    }
                  }}
                  onFocus={() => setIsCustomerDropdownOpen(true)}
                  placeholder="Search by Farmer Name, Supplier ID (e.g. MILK001), or Mobile Number..."
                  className={`w-full h-10 pl-9 pr-3 text-xs bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand-800 ${
                    selectedCustomer ? 'border-brand-700 bg-emerald-50/20 font-semibold text-slate-900' : 'border-slate-300'
                  }`}
                />
                {selectedCustomer && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-brand-100 text-brand-900 px-2 py-0.5 rounded">
                    {selectedCustomer.customer_code}
                  </span>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {isCustomerDropdownOpen && filteredCustomers.length > 0 && (
                <div className="border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white z-20">
                  {filteredCustomers.slice(0, 8).map((c) => (
                    <div
                      key={c.id}
                      onMouseDown={() => handleSelectCustomer(c)}
                      className="px-3.5 py-2 hover:bg-emerald-50 cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{c.name}</span>
                        <span className="text-[11px] text-slate-500 ml-2">
                          {c.village} • {c.mobile}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">
                          🐄 {c.cow_count} | 🐃 {c.buffalo_count}
                        </span>
                        <span className="font-mono text-brand-900 bg-brand-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          {c.customer_code}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Supplier Details Card */}
              {selectedCustomer && (
                <div className="p-3 bg-emerald-50/40 rounded-md border border-emerald-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Supplier:</span>{' '}
                    <strong className="text-slate-900">{selectedCustomer.name}</strong>{' '}
                    <span className="font-mono text-brand-900 font-bold ml-1">
                      [{selectedCustomer.customer_code}]
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Mobile:</span>{' '}
                    <strong className="text-slate-800">{selectedCustomer.mobile}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Area/Village:</span>{' '}
                    <strong className="text-slate-800">{selectedCustomer.village}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Cattle:</span>{' '}
                    <strong className="text-slate-800">
                      {selectedCustomer.cow_count} Cows, {selectedCustomer.buffalo_count} Buff
                    </strong>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Direct / Walk-in Quick Entry Form */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  {t('farmer_name_optional')}
                </label>
                <input
                  ref={walkInNameRef}
                  type="text"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="e.g. Ramesh"
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-800 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  {t('mobile_optional')}
                </label>
                <input
                  type="text"
                  value={walkInMobile}
                  onChange={(e) => setWalkInMobile(e.target.value)}
                  placeholder="9842155667"
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-800 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  {t('payment_status')} <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 h-9 bg-slate-50 border border-slate-300 rounded p-0.5">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('PAID')}
                    className={`text-xs font-bold rounded flex items-center justify-center transition-colors ${
                      paymentStatus === 'PAID'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    ✓ {t('paid_spot')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('PENDING')}
                    className={`text-xs font-bold rounded flex items-center justify-center transition-colors ${
                      paymentStatus === 'PENDING'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    ⌛ {t('pending')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Milk Quality & Numeric Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          {/* Animal Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('animal_type')}
            </label>
            <div className="grid grid-cols-2 gap-1 h-10 border border-slate-300 rounded p-0.5 bg-slate-50 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAnimalType('cow');
                  setFat('4.2');
                  setSnf('8.5');
                }}
                className={`font-bold rounded transition-colors ${
                  animalType === 'cow'
                    ? 'bg-white shadow-xs text-brand-900 border border-slate-200'
                    : 'text-slate-600'
                }`}
              >
                🐄 {t('cow')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAnimalType('buffalo');
                  setFat('6.5');
                  setSnf('9.0');
                }}
                className={`font-bold rounded transition-colors ${
                  animalType === 'buffalo'
                    ? 'bg-white shadow-xs text-slate-900 border border-slate-200'
                    : 'text-slate-600'
                }`}
              >
                🐃 {t('buffalo')}
              </button>
            </div>
          </div>

          {/* Milk Quantity */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('milk_quantity')} <span className="text-rose-600">*</span>
            </label>
            <input
              ref={qtyInputRef}
              type="number"
              step="0.1"
              min="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  fatInputRef.current?.focus();
                }
              }}
              placeholder="10.0"
              className="w-full h-10 px-3 text-sm font-bold bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-800 text-slate-900 tabular-nums"
            />
          </div>

          {/* Fat % */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('fat_perc')}
            </label>
            <input
              ref={fatInputRef}
              type="number"
              step="0.1"
              min="1.0"
              max="15.0"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  snfInputRef.current?.focus();
                }
              }}
              className="w-full h-10 px-3 text-sm font-bold bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-800 text-slate-900 tabular-nums"
            />
          </div>

          {/* SNF % */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('snf_perc')}
            </label>
            <input
              ref={snfInputRef}
              type="number"
              step="0.1"
              min="5.0"
              max="15.0"
              value={snf}
              onChange={(e) => setSnf(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
              className="w-full h-10 px-3 text-sm font-bold bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-800 text-slate-900 tabular-nums"
            />
          </div>
        </div>

        {/* Live Calculation Bar & Submit Action */}
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-emerald-50/50 p-4 rounded-lg border border-emerald-200">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 block">
                {t('automatic_rate')}
              </span>
              <span className="text-xl font-bold text-slate-900 tabular-nums">
                ₹{calculatedRate.toFixed(2)}/{t('litres')}
              </span>
            </div>

            <div className="text-slate-400 font-light text-2xl hidden sm:block">×</div>

            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 block">
                {t('milk_quantity')}
              </span>
              <span className="text-xl font-bold text-slate-900 tabular-nums">
                {parseFloat(quantity) || 0} {t('litres')}
              </span>
            </div>

            <div className="text-slate-400 font-light text-2xl hidden sm:block">=</div>

            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-brand-900 block">
                {t('total_amount_calc')}
              </span>
              <span className="text-2xl font-black text-brand-900 tabular-nums">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            <div className="hidden lg:block border-l border-emerald-300 pl-4 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">{t('collection_target')}:</span>
              <div className="text-[11px] text-slate-500">
                {t('center')}: <strong>{selectedCenterObj?.name || t('center')}</strong> • {t('session')}: <strong>{session === 'morning' ? t('morning') : t('evening')}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSaving}
              icon={<Check className="w-5 h-5" />}
              className="px-7 shadow-md text-sm font-bold"
            >
              {t('save_collection_btn')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
