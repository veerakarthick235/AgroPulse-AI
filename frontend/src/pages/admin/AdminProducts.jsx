import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Check, X, Search, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import { SIDEBAR_LINKS } from '../../config/sidebarLinks';

const CATEGORY_ICONS = { vegetables: '🥦', fruits: '🍎', grains: '🌾', dairy: '🥛', herbs: '🌿' };

export default function AdminProducts() {
  const [tab,    setTab]    = useState('pending');
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // { productId, productName }
  const [rejectReason, setRejectReason] = useState('');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/products');
      setProducts(res.data.products || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Normalize status — handle both old isApproved bool and new status string
  const normalize = (p) => ({
    ...p,
    status: p.status || (p.isApproved === true ? 'approved' : p.isApproved === false ? 'pending' : 'pending'),
  });

  const allNormalized = products.map(normalize);
  const pending  = allNormalized.filter(p => p.status === 'pending');
  const approved = allNormalized.filter(p => p.status === 'approved');
  const rejected = allNormalized.filter(p => p.status === 'rejected');

  const tabData = { pending, approved, rejected };
  const displayed = (tabData[tab] || [])
    .filter(p =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sellerName?.toLowerCase().includes(search.toLowerCase())
    );

  const handleApprove = async (productId) => {
    setActing(productId + '_a');
    try {
      await api.put(`/api/admin/products/${productId}/approve`);
      toast.success('Product approved — now live in marketplace! ✅');
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve');
    } finally {
      setActing(null);
    }
  };

  const openRejectModal = (p) => { setRejectModal({ productId: p.id, productName: p.name }); setRejectReason(''); };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActing(rejectModal.productId + '_r');
    try {
      await api.put(`/api/admin/products/${rejectModal.productId}/reject`, {
        reason: rejectReason.trim() || 'Does not meet quality standards.'
      });
      toast.success('Product rejected — seller notified.');
      setRejectModal(null);
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to reject');
    } finally {
      setActing(null);
    }
  };

  const handleRevoke = async (productId) => {
    setActing(productId + '_rv');
    try {
      // Revert product to pending by passing status directly
      await api.put(`/api/admin/products/${productId}`, {
        status: 'pending',
        isApproved: false,
        isAvailable: false,
        rejectionReason: null,
      });
      toast.success('Product moved back to pending');
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error('Failed');
    } finally {
      setActing(null);
    }
  };

  const tabs = [
    { id: 'pending',  label: '⏳ Pending',  count: pending.length,  color: tab === 'pending'  ? 'bg-yellow-500 text-white' : 'bg-white text-gray-500 border border-gray-100' },
    { id: 'approved', label: '✅ Approved', count: approved.length, color: tab === 'approved' ? 'bg-green-600 text-white'  : 'bg-white text-gray-500 border border-gray-100' },
    { id: 'rejected', label: '❌ Rejected', count: rejected.length, color: tab === 'rejected' ? 'bg-red-600 text-white'    : 'bg-white text-gray-500 border border-gray-100' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={SIDEBAR_LINKS.admin} role="admin" />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="page-header">Product Moderation</h1>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="input pl-10 text-sm w-64" />
            </div>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${t.color}`}>
                {t.label} <span className="bg-black/10 px-1.5 rounded-full">{t.count}</span>
              </button>
            ))}
          </div>

          {loading ? <LoadingSpinner /> : displayed.length === 0 ? (
            <div className="card text-center py-16 text-gray-400">
              {tab === 'pending' ? '🎉 No products awaiting approval!' : `No ${tab} products`}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayed.map(product => (
                <div key={product.id} className="card-hover">
                  <div className="relative w-full h-40 bg-gray-100 rounded-xl overflow-hidden mb-4">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">
                        {CATEGORY_ICONS[product.category] || '🛒'}
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <span className="badge bg-white/90 text-gray-700 capitalize">{product.category}</span>
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-900 mb-0.5 truncate">{product.name}</h3>
                  <p className="text-gray-400 text-xs mb-1">by {product.sellerName} • {product.sellerLocation || product.location}</p>
                  <p className="text-primary-600 font-bold text-lg mb-1">{formatCurrency(product.price)}/{product.unit}</p>
                  <p className="text-gray-400 text-xs mb-2">{product.stock} units in stock</p>

                  {product.description && (
                    <p className="text-gray-500 text-sm mb-3 line-clamp-2">{product.description}</p>
                  )}

                  {/* Rejection reason banner */}
                  {product.rejectionReason && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-3">
                      <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-red-700 text-xs">{product.rejectionReason}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {tab === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(product.id)}
                        disabled={acting === product.id + '_a'}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-green-100 hover:bg-green-200 text-green-700 font-semibold text-sm py-2 rounded-xl transition-colors"
                      >
                        <Check size={14} /> {acting === product.id + '_a' ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => openRejectModal(product)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-sm py-2 rounded-xl transition-colors"
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  )}
                  {tab === 'approved' && (
                    <button
                      onClick={() => handleRevoke(product.id)}
                      className="w-full btn-secondary text-sm py-2 text-red-600 hover:bg-red-50 border-red-100"
                    >
                      Remove from Marketplace
                    </button>
                  )}
                  {tab === 'rejected' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(product.id)} className="flex-1 flex items-center justify-center gap-1 bg-green-100 hover:bg-green-200 text-green-700 text-sm py-2 rounded-xl font-semibold">
                        <Check size={14} /> Approve Now
                      </button>
                      <button onClick={() => handleRevoke(product.id)} className="flex-1 flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm py-2 rounded-xl font-semibold">
                        Reset to Pending
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Rejection Reason Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md animate-slide-up">
            <h3 className="font-bold text-gray-900 mb-1">Reject Product</h3>
            <p className="text-gray-500 text-sm mb-4">Provide a reason for rejecting <strong>{rejectModal.productName}</strong>. The seller will see this.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Poor image quality, missing description, prohibited item..."
              className="input resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleReject} disabled={acting} className="btn-danger flex-1">
                {acting ? '...' : 'Reject Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
