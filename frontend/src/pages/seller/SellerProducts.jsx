import { useState, useEffect, useCallback } from 'react';
import { SIDEBAR_LINKS } from '../../config/sidebarLinks';
import Sidebar from '../../components/layout/Sidebar';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Edit2, Trash2, Plus, Package, CheckCircle, Clock, XCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

const getCategoryIcon = (c) => ({ vegetables: '🥦', fruits: '🍎', grains: '🌾', dairy: '🥛', herbs: '🌿' }[c] || '🛒');

export default function SellerProducts() {
  const [editingStock, setEditingStock] = useState({});
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/api/seller/products');
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

  const handleStockUpdate = async (productId, newStock) => {
    if (isNaN(newStock) || newStock < 0) return;
    try {
      await api.put(`/api/seller/products/${productId}`, { stock: parseInt(newStock) });
      toast.success('Stock updated!');
      setEditingStock(s => ({ ...s, [productId]: undefined }));
      fetchProducts();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update stock');
    }
  };

  const handleToggleAvailable = async (product) => {
    try {
      await api.put(`/api/seller/products/${product.id}`, { isAvailable: !product.isAvailable });
      toast.success(`Product ${product.isAvailable ? 'hidden' : 'shown'}`);
      fetchProducts();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update product');
    }
  };

  // Normalize status for backward compat
  const normalized = products.map(p => ({
    ...p,
    status: p.status || (p.isApproved === true ? 'approved' : 'pending'),
  }));
  const approved = normalized.filter(p => p.status === 'approved');
  const pending  = normalized.filter(p => p.status === 'pending');
  const rejected = normalized.filter(p => p.status === 'rejected');

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={SIDEBAR_LINKS.seller} role="seller" />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="page-header mb-0">My Products</h1>
            <Link to="/seller/products/add" className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Add Product
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Listed',  value: normalized.length, icon: <Package size={16} />,     color: 'text-gray-600 bg-gray-100' },
              { label: 'Live',          value: approved.length,   icon: <CheckCircle size={16} />, color: 'text-green-600 bg-green-100' },
              { label: 'Pending',       value: pending.length,    icon: <Clock size={16} />,       color: 'text-yellow-600 bg-yellow-100' },
              { label: 'Rejected',      value: rejected.length,   icon: <XCircle size={16} />,     color: 'text-red-600 bg-red-100' },
            ].map((s, i) => (
              <div key={i} className="card flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
                <div>
                  <p className="text-gray-400 text-xs">{s.label}</p>
                  <p className="text-xl font-black text-gray-900">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {loading ? <LoadingSpinner /> : normalized.length === 0 ? (
            <div className="card text-center py-16">
              <span className="text-6xl">🌾</span>
              <h3 className="text-xl font-bold text-gray-900 mt-4">No products yet</h3>
              <p className="text-gray-400 mt-2 mb-6">Start by adding your first product to the marketplace</p>
              <Link to="/seller/products/add" className="btn-primary inline-flex items-center gap-2">
                <Plus size={16} /> Add Your First Product
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {normalized.map(product => (
                <div key={product.id} className="card-hover relative">
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
                    {product.status === 'approved' && <span className="badge bg-green-100 text-green-700">✅ Live</span>}
                    {product.status === 'pending'  && <span className="badge bg-yellow-100 text-yellow-700">⏳ Pending</span>}
                    {product.status === 'rejected' && <span className="badge bg-red-100 text-red-700">❌ Rejected</span>}
                    {!product.isAvailable && product.status === 'approved' && (
                      <span className="badge bg-gray-100 text-gray-600">Hidden</span>
                    )}
                  </div>
                  {/* Rejection reason */}
                  {product.status === 'rejected' && product.rejectionReason && (
                    <div className="mt-2 mb-1 bg-red-50 border border-red-100 rounded-xl p-2.5 text-xs text-red-600">
                      <strong>Reason:</strong> {product.rejectionReason}
                    </div>
                  )}

                  {/* Image */}
                  <div className="w-full h-40 bg-gray-100 rounded-xl overflow-hidden mb-4">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} className="w-full h-full object-cover" alt={product.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">
                        {getCategoryIcon(product.category)}
                      </div>
                    )}
                  </div>

                  <h3 className="font-bold text-gray-900 mb-1 truncate">{product.name}</h3>
                  <p className="text-sm text-gray-400 mb-3 capitalize">{product.category} • {product.unit}</p>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black text-primary-600">{formatCurrency(product.price)}</span>
                    <span className={`text-sm font-medium ${product.stock <= 5 ? 'text-red-600' : 'text-gray-600'}`}>
                      {product.stock} in stock
                    </span>
                  </div>

                  {/* Inline stock edit */}
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="number"
                      placeholder="Update stock"
                      value={editingStock[product.id] ?? ''}
                      onChange={e => setEditingStock(s => ({ ...s, [product.id]: e.target.value }))}
                      className="input text-sm py-1.5 flex-1"
                      min="0"
                    />
                    <button
                      onClick={() => handleStockUpdate(product.id, editingStock[product.id])}
                      disabled={!editingStock[product.id]}
                      className="btn-primary text-xs py-1.5 px-3 disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      to={`/seller/products/edit/${product.id}`}
                      className="flex-1 btn-secondary text-sm py-2 text-center flex items-center justify-center gap-1"
                    >
                      <Edit2 size={13} /> Edit
                    </Link>
                    <button
                      onClick={() => handleToggleAvailable(product)}
                      className={`flex-1 text-sm py-2 rounded-xl font-semibold transition-colors ${
                        product.isAvailable
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                          : 'bg-green-100 hover:bg-green-200 text-green-700'
                      }`}
                    >
                      {product.isAvailable ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
