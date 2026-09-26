import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  MapPin,
  Building2,
  Calendar,
  DollarSign,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { Drawer } from '../common/Drawer';
import { Button } from '../common/Button';
import { Customer } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useCenter } from '../../context/CenterContext';
import { useToast } from '../../context/ToastContext';
import { customersApi } from '../../services/api';

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
  const { t } = useLanguage();
  const { selectedCenterId, centers } = useCenter();
  const { showToast } = useToast();

  // Phase 2 Required Fields
  const [customerCode, setCustomerCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [centerId, setCenterId] = useState('');
  const [cowCount, setCowCount] = useState<number>(2);
  const [buffaloCount, setBuffaloCount] = useState<number>(0);
  const [defaultMorningQty, setDefaultMorningQty] = useState<string>('1.0');
  const [defaultEveningQty, setDefaultEveningQty] = useState<string>('1.0');
  const [rate, setRate] = useState<string>('60.00');
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Reset & Pre-population
  useEffect(() => {
    if (initialCustomer) {
      setCustomerCode(initialCustomer.customer_code || '');
      setName(initialCustomer.name || '');
      setPhone(initialCustomer.phone || initialCustomer.mobile || '');
      setAddress(initialCustomer.address || '');
      setArea(initialCustomer.area || initialCustomer.village || '');
      setCenterId(initialCustomer.center_id || initialCustomer.collection_center_id || (centers[0]?.id || 'c1'));
      setCowCount(initialCustomer.cow_count !== undefined ? initialCustomer.cow_count : 2);
      setBuffaloCount(initialCustomer.buffalo_count !== undefined ? initialCustomer.buffalo_count : 0);
      setDefaultMorningQty(String(initialCustomer.default_morning_qty !== undefined ? initialCustomer.default_morning_qty : '1.0'));
      setDefaultEveningQty(String(initialCustomer.default_evening_qty !== undefined ? initialCustomer.default_evening_qty : '1.0'));
      setRate(String(initialCustomer.rate !== undefined ? initialCustomer.rate : '60.00'));
      setStartDate(initialCustomer.start_date || new Date().toISOString().split('T')[0]);
      setStatus(initialCustomer.status || 'active');
      setErrorMsg(null);
    } else {
      setCustomerCode('');
      setName('');
      setPhone('');
      setAddress('');
      setArea('Srivilliputtur');
      setCenterId(selectedCenterId && selectedCenterId !== 'all' ? selectedCenterId : (centers[0]?.id || 'c1'));
      setCowCount(2);
      setBuffaloCount(0);
      setDefaultMorningQty('1.0');
      setDefaultEveningQty('1.0');
      setRate('60.00');
      setStartDate(new Date().toISOString().split('T')[0]);
      setStatus('active');
      setErrorMsg(null);
    }
  }, [initialCustomer, isOpen, selectedCenterId, centers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Validation
    if (!name.trim()) {
      setErrorMsg('Supplier / Customer Name is required');
      return;
    }

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMsg('Phone number is required');
      return;
    }
    const digits = cleanPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      setErrorMsg('Please enter a valid 10-digit phone number');
      return;
    }

    if (!area.trim()) {
      setErrorMsg('Area / Location is required');
      return;
    }

    if (!centerId) {
      setErrorMsg('Please select a Collection Center');
      return;
    }

    const numRate = Number(rate);
    if (isNaN(numRate) || numRate <= 0) {
      setErrorMsg('Rate per Litre must be greater than 0');
      return;
    }

    const morningQty = Number(defaultMorningQty);
    if (isNaN(morningQty) || morningQty < 0) {
      setErrorMsg('Default morning quantity cannot be negative');
      return;
    }

    const eveningQty = Number(defaultEveningQty);
    if (isNaN(eveningQty) || eveningQty < 0) {
      setErrorMsg('Default evening quantity cannot be negative');
      return;
    }

    const payload: Partial<Customer> = {
      customer_code: customerCode.trim() || undefined,
      name: name.trim(),
      phone: cleanPhone,
      mobile: cleanPhone,
      address: address.trim(),
      area: area.trim(),
      village: area.trim(),
      center_id: centerId,
      collection_center_id: centerId,
      cow_count: Math.max(0, cowCount),
      buffalo_count: Math.max(0, buffaloCount),
      default_morning_qty: morningQty,
      default_evening_qty: eveningQty,
      rate: numRate,
      start_date: startDate,
      status,
    };

    setIsSubmitting(true);
    try {
      if (initialCustomer) {
        await customersApi.update(initialCustomer.id, payload);
        showToast('Supplier details updated successfully', 'success');
      } else {
        await customersApi.create(payload);
        showToast('New milk supplier successfully registered', 'success');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to save supplier';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={initialCustomer ? 'Edit Supplier' : 'Register New Milk Supplier'}
      width="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2.5 text-xs text-rose-800 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Section 1: Basic Information */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
            Supplier Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier ID / Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Hash className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={customerCode}
                  onChange={(e) => setCustomerCode(e.target.value)}
                  placeholder="e.g. SUP001 (Auto if blank)"
                  className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh"
                  className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Area / Town <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Srivilliputtur"
                  className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Address (Optional)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address or landmark"
              className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Section 2: Collection Center & Start Date */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
            Center Assignment & Registration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Collection Center <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
                >
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.center_name || c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Animal Count */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
            Cattle Holdings
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cow Count
              </label>
              <input
                type="number"
                min="0"
                value={cowCount}
                onChange={(e) => setCowCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Buffalo Count
              </label>
              <input
                type="number"
                min="0"
                value={buffaloCount}
                onChange={(e) => setBuffaloCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Default Quantities & Rate */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Default Quantities & Rate
            </h3>
            <span className="text-[11px] text-slate-500 font-normal">
              Pre-filled defaults only (not actual daily delivery)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Morning (L)
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                required
                value={defaultMorningQty}
                onChange={(e) => setDefaultMorningQty(e.target.value)}
                placeholder="1.0"
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Evening (L)
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                required
                value={defaultEveningQty}
                onChange={(e) => setDefaultEveningQty(e.target.value)}
                placeholder="1.0"
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rate / Litre (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  required
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="60.00"
                  className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono font-bold text-slate-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" size="md" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
          >
            {initialCustomer ? 'Save Changes' : 'Register Supplier'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
};
