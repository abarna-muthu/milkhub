import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  MapPin,
  Building2,
  Milk,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Sparkles,
  CreditCard,
  Plus,
  Minus,
} from 'lucide-react';
import { Drawer } from '../common/Drawer';
import { Button } from '../common/Button';
import { Customer, MilkRate, PaymentStatus } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useCenter } from '../../context/CenterContext';
import { useToast } from '../../context/ToastContext';
import { customersApi, ratesApi } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

interface AddCustomerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialCustomer?: Customer | null;
}

export const AddCustomerDrawer: React.FC<AddCustomerDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialCustomer,
}) => {
  const { t, language } = useLanguage();
  const { selectedCenterId, centers } = useCenter();
  const { showToast } = useToast();

  // Basic Supplier Profile
  const [customerCode, setCustomerCode] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [village, setVillage] = useState('Srivilliputtur');
  const [cowCount, setCowCount] = useState<number>(2);
  const [buffaloCount, setBuffaloCount] = useState<number>(0);
  const [session, setSession] = useState<'morning' | 'evening' | 'both'>('both');
  const [centerId, setCenterId] = useState('c1');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Collapsible section for additional info
  const [showAdditional, setShowAdditional] = useState(false);

  // Initial Milk Intake State (Active by default for fast onboarding)
  const [includeInitialMilk, setIncludeInitialMilk] = useState(true);
  const [milkQty, setMilkQty] = useState('5.0');
  const [animalType, setAnimalType] = useState<'cow' | 'buffalo'>('cow');
  const [milkSession, setMilkSession] = useState<'morning' | 'evening'>(() =>
    new Date().getHours() < 14 ? 'morning' : 'evening'
  );
  const [fat, setFat] = useState('4.2');
  const [snf, setSnf] = useState('8.5');
  const [calculatedRate, setCalculatedRate] = useState<number>(42.0);
  const [totalAmount, setTotalAmount] = useState<number>(420.0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PENDING');
  const [openingBalance, setOpeningBalance] = useState('0');

  // Rate formula config
  const [activeRate, setActiveRate] = useState<MilkRate | null>(null);

  // Load Active Pricing Formula
  useEffect(() => {
    ratesApi
      .getActive()
      .then((r) => setActiveRate(r))
      .catch(() => {
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

  // Form Reset & Pre-population
  useEffect(() => {
    if (initialCustomer) {
      setCustomerCode(initialCustomer.customer_code);
      setName(initialCustomer.name);
      setMobile(initialCustomer.mobile);
      setAddress(initialCustomer.address || '');
      setVillage(initialCustomer.village);
      setCowCount(initialCustomer.cow_count);
      setBuffaloCount(initialCustomer.buffalo_count);
      setSession(initialCustomer.default_session);
      setCenterId(initialCustomer.collection_center_id);
      setStatus(initialCustomer.status);
      setNotes(initialCustomer.notes || '');
      setIncludeInitialMilk(false);
      setShowAdditional(!!(initialCustomer.address || initialCustomer.notes));
    } else {
      setCustomerCode('');
      setName('');
      setMobile('');
      setAddress('');
      setVillage(language === 'ta' ? 'ஸ்ரீவில்லிபுத்தூர்' : 'Srivilliputtur');
      setCowCount(2);
      setBuffaloCount(0);
      setSession('both');
      setCenterId(selectedCenterId !== 'all' ? selectedCenterId : 'c1');
      setStatus('active');
      setNotes('');
      setIncludeInitialMilk(true);
      setMilkQty('5.0');
      setAnimalType('cow');
      setFat('4.2');
      setSnf('8.5');
      setPaymentStatus('PENDING');
      setOpeningBalance('0');
      setShowAdditional(false);
    }
  }, [initialCustomer, isOpen, selectedCenterId, language]);

  // Auto-switch animal type to buffalo if farmer only has buffaloes
  useEffect(() => {
    if (buffaloCount > 0 && cowCount === 0) {
      setAnimalType('buffalo');
      if (fat === '4.2') setFat('6.5');
    }
  }, [buffaloCount, cowCount]);

  // Dynamic Rate & Total Amount Calculation
  useEffect(() => {
    const q = parseFloat(milkQty) || 0;
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
  }, [milkQty, fat, snf, animalType, activeRate]);

  // Net Pending Amount
  const parsedOpeningBal = parseFloat(openingBalance) || 0;
  const initialMilkPending = includeInitialMilk && paymentStatus === 'PENDING' ? totalAmount : 0;
  const netPendingAmount = Number((parsedOpeningBal + initialMilkPending).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast(
        language === 'ta' ? 'விவசாயி பெயர் தேவை' : 'Supplier Name is required',
        'warning'
      );
      return;
    }
    if (!mobile.trim() || mobile.replace(/\D/g, '').length < 10) {
      showToast(
        language === 'ta'
          ? 'சரியான 10 இலக்க கைபேசி எண் தேவை'
          : 'Valid 10-digit Mobile number is required',
        'warning'
      );
      return;
    }
    if (!village.trim()) {
      showToast(
        language === 'ta' ? 'ஊர் / பகுதி தேவை' : 'Area / Village is required',
        'warning'
      );
      return;
    }

    if (includeInitialMilk && milkQty.trim() !== '' && parseFloat(milkQty) < 0) {
      showToast(
        language === 'ta'
          ? 'சரியான பால் அளவை உள்ளிடவும்'
          : 'Please enter a valid initial milk quantity in litres',
        'warning'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (initialCustomer) {
        await customersApi.update(initialCustomer.id, {
          customer_code: customerCode,
          name,
          mobile,
          address,
          village,
          cow_count: cowCount,
          buffalo_count: buffaloCount,
          default_session: session,
          collection_center_id: centerId,
          status,
          notes,
        });
        showToast(
          language === 'ta'
            ? 'வழங்குநர் விவரம் புதுப்பிக்கப்பட்டது'
            : 'Supplier profile updated successfully',
          'success'
        );
      } else {
        const payload: any = {
          customer_code: customerCode,
          name,
          mobile,
          address,
          village,
          cow_count: cowCount,
          buffalo_count: buffaloCount,
          default_session: session,
          collection_center_id: centerId,
          status,
          notes,
          opening_balance: parsedOpeningBal,
        };

        if (includeInitialMilk && parseFloat(milkQty) > 0) {
          payload.initial_milk = {
            quantity: parseFloat(milkQty),
            animal_type: animalType,
            session: milkSession,
            fat_percentage: parseFloat(fat) || 4.2,
            snf_percentage: parseFloat(snf) || 8.5,
            calculated_rate: calculatedRate,
            total_amount: totalAmount,
            payment_status: paymentStatus,
          };
        }

        await customersApi.create(payload);

        showToast(
          language === 'ta'
            ? `✓ ${name} வெற்றிகரமாகச் சேர்க்கப்பட்டார்`
            : `✓ Supplier ${name} registered successfully`,
          'success'
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save customer', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={initialCustomer ? t('edit_supplier_drawer_title') : t('add_supplier_drawer_title')}
      subtitle={t('add_supplier_subtitle')}
      width="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            onClick={handleSubmit}
          >
            {initialCustomer ? t('update_supplier_btn') : t('save_supplier_and_intake')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* ========================================================================= */}
        {/* 1. SUPPLIER PRIMARY INFORMATION (Clean, structured card)                  */}
        {/* ========================================================================= */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-brand-50 text-brand-900 flex items-center justify-center font-bold">
                <User className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-bold text-slate-800 text-xs">
                {t('section1_supplier_profile')}
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              * {t('required_field')}
            </span>
          </div>

          {/* Supplier Name */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              {t('supplier_name_label')} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('supplier_name_placeholder')}
                className="w-full h-9 pl-9 pr-3 bg-slate-50/60 border border-slate-200 rounded-lg focus:bg-white focus:border-brand-700 focus:ring-1 focus:ring-brand-700 text-slate-900 font-semibold transition-all text-xs"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Mobile & Village */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                {t('mobile_label')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="9876543210"
                  className="w-full h-9 pl-9 pr-3 bg-slate-50/60 border border-slate-200 rounded-lg focus:bg-white focus:border-brand-700 focus:ring-1 focus:ring-brand-700 text-slate-900 font-medium tabular-nums transition-all text-xs"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                {t('village_label')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  placeholder={t('village_placeholder')}
                  className="w-full h-9 pl-9 pr-3 bg-slate-50/60 border border-slate-200 rounded-lg focus:bg-white focus:border-brand-700 focus:ring-1 focus:ring-brand-700 text-slate-900 font-medium transition-all text-xs"
                />
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Customer Code & Collection Center */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                {t('customer_id')}
              </label>
              <input
                type="text"
                value={customerCode}
                onChange={(e) => setCustomerCode(e.target.value.toUpperCase())}
                placeholder={t('auto_generated_hint')}
                className="w-full h-9 px-3 bg-slate-50/60 border border-slate-200 rounded-lg font-mono font-bold text-brand-900 focus:bg-white focus:border-brand-700 focus:ring-1 focus:ring-brand-700 transition-all text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                {t('collection_center_label')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50/60 border border-slate-200 rounded-lg focus:bg-white focus:border-brand-700 focus:ring-1 focus:ring-brand-700 font-medium text-slate-900 transition-all text-xs"
              >
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cattle Count */}
          <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/60">
            <span className="block text-[11px] font-semibold text-slate-600 mb-2">
              {t('cattle_label')}
            </span>
            <div className="grid grid-cols-2 gap-3">
              {/* Cows */}
              <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  🐄 {t('cows_count_label')}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCowCount(Math.max(0, cowCount - 1))}
                    className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center font-bold text-slate-900 tabular-nums">
                    {cowCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCowCount(cowCount + 1)}
                    className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Buffaloes */}
              <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  🐃 {t('buffaloes_count_label')}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBuffaloCount(Math.max(0, buffaloCount - 1))}
                    className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center font-bold text-slate-900 tabular-nums">
                    {buffaloCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBuffaloCount(buffaloCount + 1)}
                    className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. INITIAL MILK INTAKE (Optional Clean Toggle Card)                       */}
        {/* ========================================================================= */}
        {!initialCustomer && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
            {/* Toggle Header */}
            <div
              onClick={() => setIncludeInitialMilk(!includeInitialMilk)}
              className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    includeInitialMilk
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Milk className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">
                    {t('section2_initial_milk')}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {t('section2_initial_milk_desc')}
                  </p>
                </div>
              </div>

              <label
                className="relative inline-flex items-center cursor-pointer pointer-events-none"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={includeInitialMilk}
                  onChange={() => {}}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Expanded Milk Section */}
            {includeInitialMilk && (
              <div className="p-4 pt-2 border-t border-slate-100 bg-emerald-50/20 space-y-3.5">
                {/* Litres, Animal Type & Session in 3 clean columns */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Milk Quantity */}
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {t('milk_quantity_litres')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={milkQty}
                        onChange={(e) => setMilkQty(e.target.value)}
                        placeholder="5.0"
                        className="w-full h-9 pl-3 pr-8 bg-white border border-emerald-300 rounded-lg font-bold text-slate-900 focus:ring-1 focus:ring-emerald-600 tabular-nums text-sm"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                        {t('litres')}
                      </span>
                    </div>
                    {/* Quick tap litre buttons */}
                    <div className="flex items-center gap-1 mt-1.5">
                      {['2.0', '5.0', '10.0', '15.0', '20.0'].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setMilkQty(qty)}
                          className={`flex-1 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                            milkQty === qty
                              ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {qty}L
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Animal Type */}
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {t('animal_type')}
                    </label>
                    <div className="grid grid-cols-2 gap-1 h-9 bg-slate-100 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setAnimalType('cow');
                          if (parseFloat(fat) > 5.5) setFat('4.2');
                        }}
                        className={`text-xs font-semibold rounded-md transition-all ${
                          animalType === 'cow'
                            ? 'bg-white text-brand-900 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        🐄 {t('cow_label')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAnimalType('buffalo');
                          if (parseFloat(fat) < 5.0) setFat('6.5');
                        }}
                        className={`text-xs font-semibold rounded-md transition-all ${
                          animalType === 'buffalo'
                            ? 'bg-white text-amber-800 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        🐃 {t('buffalo_label')}
                      </button>
                    </div>
                  </div>

                  {/* Session */}
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {t('session')}
                    </label>
                    <div className="grid grid-cols-2 gap-1 h-9 bg-slate-100 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setMilkSession('morning')}
                        className={`text-xs font-semibold rounded-md transition-all ${
                          milkSession === 'morning'
                            ? 'bg-white text-amber-700 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ☀ {t('morning')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMilkSession('evening')}
                        className={`text-xs font-semibold rounded-md transition-all ${
                          milkSession === 'evening'
                            ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        🌙 {t('evening')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quality & Rates (Fat & SNF clean chips) */}
                <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">
                      {t('fat_snf_settings')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {t('standard_benchmark')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Fat */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-slate-600">
                          {t('fat_level')}
                        </span>
                        <span className="font-bold text-brand-900 tabular-nums">
                          {fat}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          min="3.0"
                          max="12.0"
                          value={fat}
                          onChange={(e) => setFat(e.target.value)}
                          className="w-16 h-8 text-center bg-slate-50 border border-slate-200 rounded-md font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-brand-700"
                        />
                        <div className="flex items-center gap-1 flex-1">
                          {['3.8', '4.0', '4.2', '4.5', '6.5'].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setFat(p)}
                              className={`flex-1 py-1 rounded text-[10px] font-semibold border transition-all ${
                                fat === p
                                  ? 'bg-brand-900 text-white border-brand-900'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* SNF */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-slate-600">
                          {t('snf_level')}
                        </span>
                        <span className="font-bold text-brand-900 tabular-nums">
                          {snf}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          min="7.0"
                          max="11.0"
                          value={snf}
                          onChange={(e) => setSnf(e.target.value)}
                          className="w-16 h-8 text-center bg-slate-50 border border-slate-200 rounded-md font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-brand-700"
                        />
                        <div className="flex items-center gap-1 flex-1">
                          {['8.2', '8.4', '8.5', '8.6', '8.8'].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setSnf(p)}
                              className={`flex-1 py-1 rounded text-[10px] font-semibold border transition-all ${
                                snf === p
                                  ? 'bg-brand-900 text-white border-brand-900'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Auto-Rate Display Card */}
                <div className="bg-gradient-to-r from-slate-900 to-brand-950 text-white rounded-xl p-3.5 flex items-center justify-between shadow-subtle border border-slate-800">
                  <div>
                    <span className="text-slate-400 text-[10px] block font-semibold uppercase tracking-wider">
                      {t('calculated_rate_title')}
                    </span>
                    <span className="text-base font-black text-white tabular-nums">
                      ₹{calculatedRate.toFixed(2)}{' '}
                      <span className="text-xs font-normal text-slate-400">/{t('litres')}</span>
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block font-semibold uppercase tracking-wider">
                      {t('milk_delivery_amount')}
                    </span>
                    <span className="text-xl font-black text-amber-400 tabular-nums">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Automatic Payment Status & Ledger Notice */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        {t('payment_status')}
                      </label>
                      <div className="grid grid-cols-2 gap-1 h-8 bg-slate-100 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setPaymentStatus('PENDING')}
                          className={`text-[11px] font-semibold rounded-md transition-all ${
                            paymentStatus === 'PENDING'
                              ? 'bg-amber-600 text-white shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {t('payment_status_pending')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentStatus('PAID')}
                          className={`text-[11px] font-semibold rounded-md transition-all ${
                            paymentStatus === 'PAID'
                              ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {t('payment_status_paid')}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        {t('previous_pending_due')}
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                          ₹
                        </span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={openingBalance}
                          onChange={(e) => setOpeningBalance(e.target.value)}
                          placeholder="0"
                          className="w-full h-8 pl-6 pr-3 bg-white border border-slate-200 rounded-lg font-medium text-slate-900 focus:ring-1 focus:ring-brand-700 tabular-nums text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Auto Status Badge Indicator */}
                  {parseFloat(milkQty) > 0 && (
                    <div
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                        paymentStatus === 'PENDING'
                          ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                          : 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            paymentStatus === 'PENDING'
                              ? 'bg-amber-500 ring-2 ring-amber-200'
                              : 'bg-emerald-500 ring-2 ring-emerald-200'
                          }`}
                        />
                        <span className="font-semibold text-[11px]">
                          {paymentStatus === 'PENDING'
                            ? t('auto_pending_credit_hint')
                            : t('auto_paid_instant_hint')}
                        </span>
                      </div>
                      <span className="font-bold tabular-nums">
                        {paymentStatus === 'PENDING'
                          ? formatCurrency(totalAmount)
                          : formatCurrency(0)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Net Due Summary */}
                {netPendingAmount > 0 && (
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between text-xs">
                    <span className="text-amber-900 font-medium">
                      {t('auto_updated_pending_balance')}:
                    </span>
                    <span className="font-extrabold text-amber-950 tabular-nums">
                      {formatCurrency(netPendingAmount)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. ADDITIONAL DETAILS (Clean collapsible section)                         */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdditional(!showAdditional)}
            className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-50/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-slate-800 text-xs">
                {t('section3_additional_details')}
              </span>
            </div>
            {showAdditional ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showAdditional && (
            <div className="p-4 pt-1 border-t border-slate-100 space-y-3">
              {/* Street Address */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {t('street_address')}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={
                    language === 'ta'
                      ? 'கதவு எண், தெரு பெயர், அடையாளம்'
                      : 'Door no, street name, landmark'
                  }
                  className="w-full h-9 px-3 bg-slate-50/60 border border-slate-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-brand-700 font-medium text-slate-900 transition-all text-xs"
                />
              </div>

              {/* Preferred Session & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {t('preferred_session')}
                  </label>
                  <select
                    value={session}
                    onChange={(e) => setSession(e.target.value as any)}
                    className="w-full h-9 px-3 bg-slate-50/60 border border-slate-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-brand-700 font-medium text-slate-900 transition-all text-xs"
                  >
                    <option value="both">{t('session_both')}</option>
                    <option value="morning">{t('session_morning')}</option>
                    <option value="evening">{t('session_evening')}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {t('supplier_status')}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full h-9 px-3 bg-slate-50/60 border border-slate-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-brand-700 font-medium text-slate-900 transition-all text-xs"
                  >
                    <option value="active">{t('status_active')}</option>
                    <option value="inactive">{t('status_inactive')}</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {t('notes_label')}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('notes_placeholder')}
                  className="w-full px-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-brand-700 font-medium text-slate-900 text-xs transition-all"
                />
              </div>
            </div>
          )}
        </div>
      </form>
    </Drawer>
  );
};
