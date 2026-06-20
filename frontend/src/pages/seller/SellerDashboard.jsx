import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import RealTimeBadge from '../../components/shared/RealTimeBadge';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Area, AreaChart,
} from 'recharts';
import {
  Package, ShoppingBag, Star, DollarSign,
  AlertTriangle, Plus, TrendingUp, ArrowRight,
} from 'lucide-react';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../../utils/helpers';
import { SIDEBAR_LINKS } from '../../config/sidebarLinks';

// ── Feature shortcuts ──────────────────────────────────────────────────────────
const FEATURE_SHORTCUTS = [
  { to: '/features/crop-disease', icon: '🔬', label: 'Crop Disease AI',  desc: 'Detect plant diseases instantly', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  { to: '/features/market-prices',icon: '📈', label: 'Market Prices',    desc: 'Live APMC mandi prices',         color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { to: '/features/planner',      icon: '🌱', label: 'AI Crop Planner',  desc: 'Plan your next season',          color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  { to: '/features/news',         icon: '📰', label: 'Agri News',        desc: 'Latest farm news',               color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  { to: '/features/loan',         icon: '🏦', label: 'Agri Loan',        desc: 'Apply for loan schemes',         color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
  { to: '/features/chatbot',      icon: '🤖', label: 'AI Chat',          desc: 'Ask anything about farming',     color: '#06b6d4', bg: 'rgba(6,182,212,0.1)'  },
];

// ── Custom glassmorphism tooltip ────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, chartMode }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(22,163,74,0.2)',
      borderRadius: '14px',
      padding: '12px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      fontSize: '13px',
    }}>
      <p style={{ color: '#64748b', marginBottom: 4, fontWeight: 500 }}>{label}</p>
      <p style={{ color: '#16a34a', fontWeight: 800, fontSize: '16px' }}>
        {chartMode === 'revenue' ? formatCurrency(val) : `${val} orders`}
      </p>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, gradient, trend, trendUp = true }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '20px',
      padding: '24px',
      border: '1px solid rgba(0,0,0,0.06)',
      boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
      transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      cursor: 'default',
      position: 'relative',
      overflow: 'hidden',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.1)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,0,0,0.04)';
    }}
    >
      {/* Gradient accent top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: gradient,
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </p>
        <div style={{
          width: 40, height: 40, borderRadius: '12px',
          background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem',
        }}>
          {icon}
        </div>
      </div>
      <p style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: '1.85rem', fontWeight: 900, color: '#0f172a', lineHeight: 1, marginBottom: '10px',
      }}>
        {value}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <TrendingUp size={12} color={trendUp ? '#16a34a' : '#f59e0b'} />
        <span style={{ color: trendUp ? '#16a34a' : '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>
          {trend}
        </span>
      </div>
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  pending:   { bg: 'rgba(245,158,11,0.12)',  color: '#d97706', label: 'Pending'   },
  confirmed: { bg: 'rgba(59,130,246,0.12)',  color: '#2563eb', label: 'Confirmed' },
  delivered: { bg: 'rgba(34,197,94,0.12)',   color: '#16a34a', label: 'Delivered' },
  cancelled: { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626', label: 'Cancelled' },
};
function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { bg: 'rgba(148,163,184,0.12)', color: '#64748b', label: status };
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px',
      borderRadius: '100px', textTransform: 'capitalize', letterSpacing: '0.3px',
    }}>
      {s.label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SellerDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [chartMode, setChartMode] = useState('revenue'); // 'revenue' | 'orders'

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pLoading, setPLoading] = useState(true);
  const [oLoading, setOLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [resProducts, resOrders] = await Promise.all([
        api.get('/api/seller/products'),
        api.get('/api/seller/orders')
      ]);
      setProducts(resProducts.data.products || []);
      setOrders(resOrders.data.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setPLoading(false);
      setOLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Computed stats ──────────────────────────────────────────────────────────
  const totalRevenue    = orders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + (o.totalAmount || 0), 0);
  const pendingOrders   = orders.filter(o => o.status === 'pending').length;
  const lowStockProducts= products.filter(p => p.stock <= 5 && p.isAvailable);
  const avgRating       = products.length
    ? (products.reduce((s, p) => s + (p.rating || 0), 0) / products.length).toFixed(1)
    : '0.0';

  // ── Chart data — last 7 days ────────────────────────────────────────────────
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toLocaleDateString('en-IN', { weekday: 'short' });
    const dayOrders = orders.filter(o => {
      if (!o.createdAt) return false;
      const od = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return od.toDateString() === d.toDateString();
    });
    return {
      day: dateStr,
      revenue: dayOrders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + (o.totalAmount || 0), 0),
      orders: dayOrders.length,
    };
  });

  const isApproved = userProfile?.isApproved;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800;900&display=swap');
        .seller-dash-root { display:flex; min-height:100vh; background:#f8fafc; }
        .seller-dash-main { flex:1; margin-left:256px; padding:32px; }
        @media (max-width:768px) {
          .seller-dash-main { margin-left:0; padding:80px 16px 24px; }
        }

        /* Low stock alert */
        @keyframes alertPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.15); }
          50% { box-shadow: 0 0 0 6px rgba(239,68,68,0.0); }
        }
        .stock-alert { animation: alertPulse 2s ease-in-out infinite; }

        /* Feature card hover */
        .feat-shortcut {
          display:flex; align-items:center; gap:14px;
          background:#fff; border:1px solid rgba(0,0,0,0.06);
          border-radius:16px; padding:18px;
          cursor:pointer; text-decoration:none;
          transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
          position:relative; overflow:hidden;
        }
        .feat-shortcut:hover {
          transform: translateY(-3px) scale(1.01);
          box-shadow: 0 12px 40px rgba(0,0,0,0.1);
        }
        .feat-shortcut-icon-wrap {
          width:48px; height:48px; border-radius:14px;
          display:flex; align-items:center; justify-content:center;
          font-size:1.4rem; flex-shrink:0;
          transition: transform 0.3s;
        }
        .feat-shortcut:hover .feat-shortcut-icon-wrap { transform: scale(1.15) rotate(5deg); }

        /* Table row */
        .order-row { transition: background 0.15s; }
        .order-row:hover { background: #f8fafc; }

        /* Chart toggle btn */
        .chart-toggle {
          padding: 6px 16px; border-radius: 10px;
          border: none; cursor: pointer;
          font-size: 0.8rem; font-weight: 600;
          transition: all 0.2s;
        }
        .chart-toggle.active {
          background: linear-gradient(135deg,#16a34a,#22c55e);
          color: #fff; box-shadow: 0 3px 10px rgba(22,163,74,0.3);
        }
        .chart-toggle:not(.active) {
          background: #f1f5f9; color: #64748b;
        }
        .chart-toggle:not(.active):hover { background: #e2e8f0; }
      `}</style>

      <div className="seller-dash-root">
        <Sidebar links={SIDEBAR_LINKS.seller} role="seller" />

        <main className="seller-dash-main">
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 'clamp(1.4rem,3vw,1.9rem)',
                  fontWeight: 900, color: '#0f172a', margin: 0,
                }}>
                  Good day, {userProfile?.displayName?.split(' ')[0]} 👋
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '4px 0 0' }}>
                  Here's your farm business overview
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <RealTimeBadge />
                <Link
                  to="/seller/products/add"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    background: 'linear-gradient(135deg,#16a34a,#22c55e)',
                    color: '#fff', textDecoration: 'none',
                    fontWeight: 700, fontSize: '0.88rem',
                    padding: '10px 20px', borderRadius: '12px',
                    boxShadow: '0 4px 15px rgba(22,163,74,0.35)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(22,163,74,0.45)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(22,163,74,0.35)'; }}
                >
                  <Plus size={15} /> Add Product
                </Link>
              </div>
            </div>

            {/* ── APPROVAL BANNER ── */}
            {!isApproved && (
              <div style={{
                background: 'linear-gradient(135deg,#fffbeb,#fef3c7)',
                border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b',
                borderRadius: '16px', padding: '16px 20px',
                display: 'flex', alignItems: 'flex-start', gap: '14px',
                marginBottom: '24px',
              }}>
                <span style={{ fontSize: '1.8rem' }}>⏳</span>
                <div>
                  <p style={{ fontWeight: 700, color: '#92400e', margin: 0 }}>Account Pending Approval</p>
                  <p style={{ color: '#a16207', fontSize: '0.85rem', margin: '4px 0 0', lineHeight: 1.5 }}>
                    Your seller account is under review. You'll be notified once admin approves it. You can still browse and set up your profile.
                  </p>
                </div>
              </div>
            )}

            {/* ── LOW STOCK ALERT ── */}
            {lowStockProducts.length > 0 && (
              <div className="stock-alert" style={{
                background: 'linear-gradient(135deg,#fff1f2,#ffe4e6)',
                border: '1px solid #fecdd3', borderLeft: '4px solid #ef4444',
                borderRadius: '16px', padding: '16px 20px',
                display: 'flex', alignItems: 'flex-start', gap: '14px',
                marginBottom: '24px',
              }}>
                <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontWeight: 700, color: '#991b1b', margin: 0 }}>
                    ⚠️ Low Stock Alert — {lowStockProducts.length} product{lowStockProducts.length > 1 ? 's' : ''} need restocking
                  </p>
                  <p style={{ color: '#b91c1c', fontSize: '0.82rem', margin: '4px 0 0' }}>
                    {lowStockProducts.slice(0, 4).map(p => p.name).join(', ')}
                    {lowStockProducts.length > 4 && ` + ${lowStockProducts.length - 4} more`}
                  </p>
                </div>
              </div>
            )}

            {/* ── STAT CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '20px', marginBottom: '28px' }}>
              <StatCard
                label="Total Revenue" value={formatCurrency(totalRevenue)}
                icon="💰"
                gradient="linear-gradient(135deg,#16a34a,#22c55e)"
                trend="+12% this month"
              />
              <StatCard
                label="Total Products" value={products.length}
                icon="📦"
                gradient="linear-gradient(135deg,#8b5cf6,#a78bfa)"
                trend={`${products.filter(p => p.isApproved).length} approved`}
              />
              <StatCard
                label="Pending Orders" value={pendingOrders}
                icon="🛒"
                gradient="linear-gradient(135deg,#3b82f6,#60a5fa)"
                trend={pendingOrders > 0 ? 'Needs attention' : 'All clear ✅'}
                trendUp={pendingOrders === 0}
              />
              <StatCard
                label="Avg. Rating" value={`${avgRating} ⭐`}
                icon="⭐"
                gradient="linear-gradient(135deg,#f59e0b,#fbbf24)"
                trend={`${products.reduce((s, p) => s + (p.reviewCount || 0), 0)} total reviews`}
              />
            </div>

            {/* ── CHARTS + LOW STOCK ROW ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', marginBottom: '28px' }}>
              {/* Revenue/Orders Chart */}
              <div style={{
                background: '#fff', borderRadius: '20px', padding: '24px',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div>
                    <h2 style={{ fontFamily: 'Poppins,sans-serif', fontWeight: 800, color: '#0f172a', fontSize: '1rem', margin: 0 }}>
                      Performance — Last 7 Days
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '3px 0 0' }}>Track your daily progress</p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className={`chart-toggle ${chartMode === 'revenue' ? 'active' : ''}`} onClick={() => setChartMode('revenue')}>Revenue</button>
                    <button className={`chart-toggle ${chartMode === 'orders' ? 'active' : ''}`} onClick={() => setChartMode('orders')}>Orders</button>
                  </div>
                </div>
                {oLoading ? <LoadingSpinner size="sm" /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    {chartMode === 'revenue' ? (
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                        <Tooltip content={<CustomTooltip chartMode="revenue" />} />
                        <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: '#16a34a', r: 4 }} activeDot={{ r: 6 }} />
                      </AreaChart>
                    ) : (
                      <BarChart data={chartData}>
                        <defs>
                          <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#60a5fa" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip chartMode="orders" />} />
                        <Bar dataKey="orders" fill="url(#ordGrad)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>

              {/* Low Stock Panel */}
              <div style={{
                background: '#fff', borderRadius: '20px', padding: '24px',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <AlertTriangle size={17} color="#f59e0b" />
                  <h2 style={{ fontFamily: 'Poppins,sans-serif', fontWeight: 800, color: '#0f172a', fontSize: '1rem', margin: 0 }}>
                    Low Stock Alert
                  </h2>
                </div>
                {pLoading ? <LoadingSpinner size="sm" /> : lowStockProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>All products well stocked</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {lowStockProducts.slice(0, 6).map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          {p.imageUrl
                            ? <img src={p.imageUrl} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} />
                            : <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📦</div>
                          }
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </span>
                        </div>
                        <span style={{
                          background: p.stock === 0 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                          color: p.stock === 0 ? '#dc2626' : '#d97706',
                          fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px',
                          borderRadius: '100px', flexShrink: 0,
                        }}>
                          {p.stock === 0 ? 'Out' : `${p.stock} left`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── RECENT ORDERS TABLE ── */}
            <div style={{
              background: '#fff', borderRadius: '20px', padding: '24px',
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
              marginBottom: '28px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontFamily: 'Poppins,sans-serif', fontWeight: 800, color: '#0f172a', fontSize: '1rem', margin: 0 }}>
                    Recent Orders
                  </h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '3px 0 0' }}>Latest transactions from your store</p>
                </div>
                <Link
                  to="/seller/orders"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    color: '#16a34a', fontSize: '0.82rem', fontWeight: 700,
                    textDecoration: 'none', padding: '7px 14px',
                    border: '1px solid rgba(22,163,74,0.25)',
                    borderRadius: '10px', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  View All <ArrowRight size={13} />
                </Link>
              </div>

              {oLoading ? <LoadingSpinner size="sm" /> : orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <ShoppingBag size={48} style={{ color: '#e2e8f0', margin: '0 auto 12px' }} />
                  <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No orders yet. Share your store link to get started!</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'separate', borderSpacing: '0' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                        {['Order ID', 'Buyer', 'Amount', 'Status', 'Date'].map(h => (
                          <th key={h} style={{
                            paddingBottom: '12px', textAlign: 'left',
                            color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem',
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 8).map(order => (
                        <tr key={order.id} className="order-row" style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '14px 0', fontFamily: 'monospace', fontSize: '0.78rem', color: '#94a3b8' }}>
                            #{order.id.slice(0, 8)}
                          </td>
                          <td style={{ padding: '14px 0', fontWeight: 600, color: '#334155' }}>
                            {order.buyerName || 'Customer'}
                          </td>
                          <td style={{ padding: '14px 0', fontWeight: 800, color: '#0f172a', fontFamily: 'Poppins,sans-serif' }}>
                            {formatCurrency(order.totalAmount)}
                          </td>
                          <td style={{ padding: '14px 0' }}>
                            <StatusBadge status={order.status} />
                          </td>
                          <td style={{ padding: '14px 0', color: '#94a3b8', fontSize: '0.78rem' }}>
                            {formatDate(order.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── FEATURE SHORTCUTS ── */}
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontFamily: 'Poppins,sans-serif', fontWeight: 800, color: '#0f172a', fontSize: '1rem', margin: 0 }}>
                  🛠️ Farm Tools & AI Features
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>Quick access to AI-powered farming tools</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '16px' }}>
                {FEATURE_SHORTCUTS.map((f, i) => (
                  <Link key={i} to={f.to} className="feat-shortcut">
                    <div className="feat-shortcut-icon-wrap" style={{ background: f.bg }}>
                      <span>{f.icon}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem', margin: 0 }}>{f.label}</p>
                      <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '2px 0 0' }}>{f.desc}</p>
                    </div>
                    <ArrowRight size={14} color="#cbd5e1" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </>
  );
}
