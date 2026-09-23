import React, { useState, useEffect } from 'react';
import { UserCog, Plus, Shield, UserCheck, Trash2, Edit2, Key, Check } from 'lucide-react';
import { User, UserRole } from '../types';
import { RoleGuard } from '../components/layout/RoleGuard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useLanguage } from '../context/LanguageContext';
import { useCenter } from '../context/CenterContext';
import { useToast } from '../context/ToastContext';
import { staffApi } from '../services/api';
import { formatDateTime } from '../utils/formatters';

interface StaffPageProps {
  onNavigate: (path: string) => void;
}

export const StaffPage: React.FC<StaffPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { centers } = useCenter();
  const { showToast } = useToast();

  const [staffList, setStaffList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('staff123');
  const [role, setRole] = useState<UserRole>('staff');
  const [centerId, setCenterId] = useState('c1');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const data = await staffApi.getAll();
      setStaffList(data);
    } catch (err) {
      console.warn(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const openAddModal = () => {
    setEditingStaff(null);
    setName('');
    setMobile('');
    setEmail('');
    setPassword('staff123');
    setRole('staff');
    setCenterId('c1');
    setStatus('active');
    setIsModalOpen(true);
  };

  const openEditModal = (staff: User) => {
    setEditingStaff(staff);
    setName(staff.name);
    setMobile(staff.mobile);
    setEmail(staff.email);
    setPassword('');
    setRole(staff.role);
    setCenterId(staff.collection_center_id);
    setStatus(staff.status);
    setIsModalOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim() || !email.trim()) {
      showToast('Name, Mobile, and Email are required', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingStaff) {
        await staffApi.update(editingStaff.id, {
          name,
          mobile,
          email,
          role,
          collection_center_id: centerId,
          status,
          ...(password ? { password } : {}),
        });
        showToast('Staff profile updated successfully', 'success');
      } else {
        await staffApi.create({
          name,
          mobile,
          email,
          password: password || 'staff123',
          role,
          collection_center_id: centerId,
          status,
        });
        showToast('New staff member added', 'success');
      }

      setIsModalOpen(false);
      loadStaff();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save staff member', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = async (id: string, staffName: string) => {
    if (!window.confirm(`Are you sure you want to remove staff member: ${staffName}?`)) return;
    try {
      await staffApi.delete(id);
      showToast('Staff member removed', 'info');
      loadStaff();
    } catch (err: any) {
      showToast('Failed to delete staff member', 'error');
    }
  };

  return (
    <RoleGuard onNavigate={onNavigate}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {t('staff_management')}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('staff_subtitle')}
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={openAddModal}
            icon={<Plus className="w-4 h-4" />}
          >
            {t('add_staff')}
          </Button>
        </div>

        {/* Staff Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">{t('name')}</th>
                  <th className="px-3 py-2.5">{t('mobile')}</th>
                  <th className="px-4 py-2.5">{t('email')}</th>
                  <th className="px-3 py-2.5">{t('role')}</th>
                  <th className="px-4 py-2.5">{t('center')}</th>
                  <th className="px-3 py-2.5 text-center">{t('status')}</th>
                  <th className="px-4 py-2.5">{t('last_login')}</th>
                  <th className="px-3 py-2.5 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      ...
                    </td>
                  </tr>
                ) : staffList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      ...
                    </td>
                  </tr>
                ) : (
                  staffList.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{s.name}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">{s.mobile}</td>
                      <td className="px-4 py-2.5 text-slate-600">{s.email}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            s.role === 'admin'
                              ? 'bg-brand-100 text-brand-900 border border-brand-300'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {s.role === 'admin' ? <Shield className="w-3 h-3 text-brand-800" /> : <UserCheck className="w-3 h-3" />}
                          {s.role === 'admin' ? t('role_admin') : t('role_staff')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {s.collection_center_name || t('all_centers')}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant={s.status === 'active' ? 'success' : 'default'} size="sm">
                          {s.status === 'active' ? t('active') : t('inactive')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-[11px]">
                        {s.last_login ? formatDateTime(s.last_login) : '---'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(s)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                            title="Edit Staff"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {s.id !== 'u1' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteStaff(s.id, s.name)}
                              className="p-1 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50"
                              title="Delete Staff"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Staff Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingStaff ? 'Edit Staff Account' : t('add_staff')}
          subtitle="Assign roles and collection dock station permissions"
          maxWidth="md"
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                onClick={handleSaveStaff}
              >
                Save Staff
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveStaff} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Murugan S"
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="9842100002"
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@milkhub.com"
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  System Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full h-9 px-2 bg-white border border-slate-300 rounded font-medium focus:ring-1 focus:ring-brand-800"
                >
                  <option value="staff">Collection Staff (Intake only)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Collection Center
                </label>
                <select
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  className="w-full h-9 px-2 bg-white border border-slate-300 rounded font-medium focus:ring-1 focus:ring-brand-800"
                >
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Password {editingStaff && '(Leave blank to keep unchanged)'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
              />
            </div>
          </form>
        </Modal>
      </div>
    </RoleGuard>
  );
};
