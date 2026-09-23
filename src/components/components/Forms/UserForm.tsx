import React, { useState, useEffect } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { createUser, fetchUsers } from '../../../store/slices/userSlice';
import { fetchRoles } from '../../../store/slices/roleSlice';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import type { User } from '../../../utils/types';

interface UserFormProps {
  userData?: User;
}

const UserForm: React.FC<UserFormProps> = ({ userData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { data: roles, loading: rolesLoading } = useAppSelector((state) => state.roles);

  const isEdit = !!userData;

  const [firstName, setFirstName] = useState(userData?.first_name || '');
  const [lastName, setLastName] = useState(userData?.last_name || '');
  const [email, setEmail] = useState(userData?.email || '');
  const [phone1, setPhone1] = useState(userData?.phone1 || userData?.phone || '');
  const [role, setRole] = useState<string>(() => {
    if (typeof userData?.role === 'object' && userData?.role?.id != null) {
      return String(userData.role.id);
    }
    if (typeof userData?.role === 'number' || typeof userData?.role === 'string') {
      return String(userData.role);
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch roles if not already in store
  useEffect(() => {
    if (!roles || roles.length === 0) {
      dispatch(fetchRoles());
    }
  }, [dispatch, roles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    if (!role) {
      toast.error('Please select a role');
      return;
    }

    if (!isEdit && !password) {
      toast.error('Password is required');
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, any> = {
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone1: phone1.trim(),
        role: role,
      };

      if (password) {
        payload.password = password;
      }

      await dispatch(createUser(payload)).unwrap();
      toast.success('User created successfully');
      dispatch(fetchUsers());
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. Rahul"
            required
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-minor rounded-xl text-sm text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all shadow-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="e.g. Kumar"
            required
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-minor rounded-xl text-sm text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. rahul@gccschool.in"
          required
          className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-minor rounded-xl text-sm text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all shadow-sm"
        />
      </div>

      {/* Phone & Role Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Phone Number
          </label>
          <input
            type="tel"
            value={phone1}
            onChange={(e) => setPhone1(e.target.value)}
            placeholder="e.g. 9876543210"
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-minor rounded-xl text-sm text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all shadow-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            disabled={rolesLoading}
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-minor rounded-xl text-sm text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all shadow-sm"
          >
            <option value="">{rolesLoading ? 'Loading roles...' : 'Select a role...'}</option>
            {(roles || []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Password */}
      {!isEdit && (
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter account password"
              required
              className="w-full px-3.5 py-2.5 pr-10 bg-major border border-crmBorder focus:border-minor rounded-xl text-sm text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all shadow-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-crmText-tertiary hover:text-crmText transition-colors p-0.5 bg-transparent border-none cursor-pointer"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-3">
        <button
          type="button"
          onClick={hideModal}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-minor hover:bg-minor-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none"
        >
          {loading ? 'Creating...' : 'Create User'}
        </button>
      </div>
    </form>
  );
};

export default UserForm;
