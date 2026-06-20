import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Check, X, Search } from 'lucide-react';
import { formatDate } from '../../utils/helpers';
import { SIDEBAR_LINKS } from '../../config/sidebarLinks';

const ROLE_COLORS = {
  admin:    'bg-red-100 text-red-700',
  seller:   'bg-blue-100 text-blue-700',
  delivery: 'bg-orange-100 text-orange-700',
  buyer:    'bg-green-100 text-green-700',
};

const ROLES = ['buyer', 'seller', 'delivery', 'admin'];

export default function AdminSellers() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState(null);

  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSellers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/users?role=seller');
      setSellers(res.data.users || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch sellers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  const handleApprove = async (sellerId) => {
    setActing(sellerId + '_approve');
    try {
      await api.put(`/api/admin/sellers/${sellerId}/approve`);
      toast.success('Seller approved! 🎉');
      fetchSellers();
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (sellerId) => {
    setActing(sellerId + '_reject');
    try {
      await api.put(`/api/admin/sellers/${sellerId}/reject`, { reason: 'Application rejected by admin.' });
      toast.success('Seller rejected');
      fetchSellers();
    } catch (err) {
      console.error(err);
      toast.error('Failed to reject');
    } finally {
      setActing(null);
    }
  };

  const handleToggleActive = async (seller) => {
    try {
      await api.put(`/api/admin/users/${seller.id}/toggle-active`, { isActive: !seller.isActive });
      toast.success(seller.isActive ? 'Seller deactivated' : 'Seller reactivated');
      fetchSellers();
    } catch (err) {
      console.error(err);
      toast.error('Failed to toggle status');
    }
  };

  const handleRoleChange = async (sellerId, newRole) => {
    try {
      await api.put(`/api/admin/users/${sellerId}/role`, { role: newRole });
      toast.success(`Role changed to ${newRole}`);
      fetchSellers();
    } catch (err) {
      console.error(err);
      toast.error('Failed to change role');
    }
  };

  const filtered = sellers
    .filter(s => {
      if (filter === 'pending')  return !s.isApproved && s.isActive !== false;
      if (filter === 'approved') return s.isApproved;
      if (filter === 'inactive') return s.isActive === false;
      return true;
    })
    .filter(s =>
      s.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.farmLocation?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={SIDEBAR_LINKS.admin} role="admin" />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="page-header">Seller Management</h1>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sellers..." className="input pl-10 text-sm w-64" />
            </div>
            {['all', 'pending', 'approved', 'inactive'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${filter === f ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}>
                {f}
                {f === 'pending' && <span className="ml-1.5 bg-yellow-500 text-white text-xs rounded-full px-1.5">{sellers.filter(s => !s.isApproved && s.isActive !== false).length}</span>}
              </button>
            ))}
          </div>

          {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
            <div className="card text-center py-16 text-gray-400">No sellers found</div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left text-gray-500">
                    <th className="px-5 py-3.5 font-medium">Seller</th>
                    <th className="px-5 py-3.5 font-medium">Farm Location</th>
                    <th className="px-5 py-3.5 font-medium">Produce</th>
                    <th className="px-5 py-3.5 font-medium">Role</th>
                    <th className="px-5 py-3.5 font-medium">Status</th>
                    <th className="px-5 py-3.5 font-medium">Joined</th>
                    <th className="px-5 py-3.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(seller => (
                    <tr key={seller.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {seller.profileImageUrl ? (
                            <img src={seller.profileImageUrl} className="w-9 h-9 rounded-xl object-cover" alt="" />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                              {seller.displayName?.[0]?.toUpperCase() || 'S'}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900">{seller.displayName || 'Unknown'}</p>
                            <p className="text-gray-400 text-xs">{seller.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{seller.farmLocation || seller.sellerProfile?.location || '—'}</td>
                      <td className="px-5 py-4 text-gray-600">{seller.produceType || seller.sellerProfile?.produceType || '—'}</td>
                      <td className="px-5 py-4">
                        <select
                          value={seller.role}
                          onChange={e => handleRoleChange(seller.id, e.target.value)}
                          className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer ${ROLE_COLORS[seller.role] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        {seller.isActive === false ? (
                          <span className="badge bg-red-100 text-red-700">Inactive</span>
                        ) : seller.isApproved ? (
                          <span className="badge bg-green-100 text-green-700">✅ Approved</span>
                        ) : (
                          <span className="badge bg-yellow-100 text-yellow-700">⏳ Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-xs">{formatDate(seller.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {!seller.isApproved && seller.isActive !== false && (
                            <button
                              onClick={() => handleApprove(seller.id)}
                              disabled={acting === seller.id + '_approve'}
                              className="flex items-center gap-1 bg-green-100 hover:bg-green-200 text-green-700 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Check size={12} /> {acting === seller.id + '_approve' ? '...' : 'Approve'}
                            </button>
                          )}
                          {!seller.isApproved && (
                            <button
                              onClick={() => handleReject(seller.id)}
                              disabled={acting === seller.id + '_reject'}
                              className="flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <X size={12} /> Reject
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleActive(seller)}
                            className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            {seller.isActive === false ? 'Activate' : 'Deactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
