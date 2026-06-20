import { useState, useEffect, useCallback } from 'react';
import { SIDEBAR_LINKS } from '../../config/sidebarLinks';
import Sidebar from '../../components/layout/Sidebar';
import RealTimeBadge from '../../components/shared/RealTimeBadge';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../../utils/helpers';

const STATUSES = ['all', 'pending', 'confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled'];

export default function SellerOrders() {
  const [filter,   setFilter]   = useState('all');
  const [updating, setUpdating] = useState(null);
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/api/seller/orders');
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    // Optional polling for real-time feel
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const handleStatusUpdate = async (orderId, newStatus) => {
    setUpdating(orderId);
    try {
      await api.put(`/api/seller/orders/${orderId}`, { status: newStatus });
      toast.success(`Order marked as ${getStatusLabel(newStatus)}! ✅`);
      fetchOrders(); // refresh
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update order');
    } finally {
      setUpdating(null);
    }
  };

  const getNextAction = (status) => {
    if (status === 'pending')   return { label: '✅ Confirm Order',    next: 'confirmed' };
    if (status === 'confirmed') return { label: '📦 Mark as Packed',   next: 'packed' };
    if (status === 'packed')    return { label: '🚚 Mark Dispatched',  next: 'dispatched' };
    return null;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={SIDEBAR_LINKS.seller} role="seller" />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="page-header mb-0">Orders</h1>
            <RealTimeBadge />
          </div>

          {/* Status Filters */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  filter === s ? 'bg-primary-600 text-white shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
                }`}
              >
                {getStatusLabel(s)}{' '}
                {s !== 'all' && <span className="ml-1 text-xs opacity-70">({orders.filter(o => o.status === s).length})</span>}
              </button>
            ))}
          </div>

          {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
            <div className="card text-center py-16">
              <span className="text-5xl">📋</span>
              <p className="text-gray-400 mt-4">No orders with status "{getStatusLabel(filter)}"</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(order => {
                const action = getNextAction(order.status);
                return (
                  <div key={order.id} className="card hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="font-mono text-xs text-gray-400">#{order.id.slice(0, 8)}</span>
                          <span className={`badge ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</span>
                          <span className={`badge ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            💰 {order.paymentStatus === 'paid' ? 'Paid' : 'COD Pending'}
                          </span>
                        </div>

                        <div className="flex items-start gap-4">
                          {/* Items */}
                          <div className="flex-1">
                            <div className="flex flex-wrap gap-2 mb-3">
                              {order.items?.map((item, i) => (
                                <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                                  {item.imageUrl && <img src={item.imageUrl} className="w-5 h-5 rounded object-cover" alt="" />}
                                  <span className="text-sm text-gray-700">{item.productName} × {item.quantity}</span>
                                </div>
                              ))}
                            </div>
                            <div className="grid sm:grid-cols-3 gap-2 text-sm text-gray-500">
                              <div><span className="font-medium text-gray-700">Buyer:</span> {order.buyerName}</div>
                              <div><span className="font-medium text-gray-700">Phone:</span> {order.buyerPhone || 'N/A'}</div>
                              <div><span className="font-medium text-gray-700">Date:</span> {formatDate(order.createdAt)}</div>
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              <span className="font-medium text-gray-700">Delivery:</span>{' '}
                              {[order.deliveryAddress?.street, order.deliveryAddress?.city,
                                order.deliveryAddress?.pincode].filter(Boolean).join(', ')}
                            </div>
                          </div>

                          {/* Amount */}
                          <div className="text-right flex-shrink-0">
                            <p className="text-2xl font-black text-gray-900">{formatCurrency(order.totalAmount)}</p>
                            <p className="text-xs text-gray-400">{order.paymentMethod?.toUpperCase() || 'COD'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      {action && (
                        <button
                          onClick={() => handleStatusUpdate(order.id, action.next)}
                          disabled={updating === order.id}
                          className="btn-primary whitespace-nowrap text-sm py-2"
                        >
                          {updating === order.id ? 'Updating...' : action.label}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
