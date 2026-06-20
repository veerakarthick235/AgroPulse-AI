import { useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import Navbar from '../../components/layout/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { SIDEBAR_LINKS } from '../../config/sidebarLinks';
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const VEGETABLES = [
  'Tomato', 'Onion', 'Potato', 'Brinjal', 'Carrot', 'Cabbage', 'Cauliflower',
  'Beans', 'Ladies Finger', 'Bitter Gourd', 'Drumstick', 'Pumpkin',
  'Radish', 'Spinach', 'Coriander', 'Garlic', 'Ginger', 'Chilli',
  'Banana', 'Mango', 'Coconut', 'Papaya', 'Guava', 'Grapes',
  'Rice', 'Wheat', 'Maize', 'Groundnut', 'Soybean', 'Sugarcane',
];

const LOCATIONS = ['Coimbatore', 'Salem', 'Chennai', 'Madurai', 'Trichy', 'Erode', 'Tirunelveli', 'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Pune'];

export default function MarketPrices() {
  const { userProfile } = useAuth();
  const [veg, setVeg] = useState('Tomato');
  const [location, setLocation] = useState('Coimbatore');
  const [customVeg, setCustomVeg] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const role = userProfile?.role || 'buyer';
  const links = SIDEBAR_LINKS[role] || SIDEBAR_LINKS.buyer;

  const fetchPrices = async () => {
    const vegName = customVeg.trim() || veg;
    setLoading(true);
    try {
      const res = await axios.get(`/prices?vegetable=${encodeURIComponent(vegName)}&location=${encodeURIComponent(location)}`);
      
      let responseData = res.data;
      // Handle the array response from the backend
      if (!responseData.current_price && responseData.prices && responseData.prices.length > 0) {
        const primary = responseData.prices[0];
        responseData = {
          ...responseData,
          vegetable: primary.name,
          location: primary.location,
          current_price: primary.price,
          trend: 'stable' // Default since the backend doesn't provide this yet
        };
      }
      
      setData(responseData);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to fetch prices');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend) => {
    if (!trend) return <Minus size={16} className="text-gray-400" />;
    const t = trend.toLowerCase();
    if (t.includes('up') || t.includes('rise') || t.includes('increas')) return <TrendingUp size={16} className="text-red-500" />;
    if (t.includes('down') || t.includes('fall') || t.includes('decreas')) return <TrendingDown size={16} className="text-green-500" />;
    return <Minus size={16} className="text-gray-400" />;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={links} role={role} />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="page-header mb-1 flex items-center gap-3">
              <span className="text-4xl">📈</span> Market Prices
            </h1>
            <p className="text-gray-400 text-sm">Real-time vegetable & crop prices from local mandis</p>
          </div>

          {/* Controls */}
          <div className="card mb-6">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Vegetable / Crop</label>
                <select value={veg} onChange={e => { setVeg(e.target.value); setCustomVeg(''); }} className="input">
                  {VEGETABLES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Or type custom name</label>
                <input
                  value={customVeg}
                  onChange={e => setCustomVeg(e.target.value)}
                  placeholder="e.g. Sweet Potato"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Location / Market</label>
                <select value={location} onChange={e => setLocation(e.target.value)} className="input">
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <button onClick={fetchPrices} disabled={loading} className="btn-primary mt-4 flex items-center gap-2">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Fetching...</>
              ) : (
                <><Search size={16} /> Get Current Prices</>
              )}
            </button>
          </div>

          {/* Results */}
          {data && (
            <div className="animate-fade-in space-y-5">
              {/* Current Price Card */}
              {data.current_price && (
                <div className="card bg-gradient-to-r from-primary-600 to-primary-800 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-primary-200 text-sm font-medium">{data.vegetable || (customVeg || veg)} • {data.location || location}</p>
                      <p className="text-5xl font-black mt-2">{data.current_price}</p>
                      <p className="text-primary-200 mt-1 text-sm">per kg / quintal</p>
                    </div>
                    <div className="bg-white/20 rounded-2xl p-4 text-center">
                      <p className="text-primary-200 text-xs">Market Trend</p>
                      <div className="flex items-center justify-center mt-1 text-2xl">
                        {getTrendIcon(data.trend)}
                      </div>
                      <p className="text-white font-bold text-sm mt-1 capitalize">{data.trend || 'Stable'}</p>
                    </div>
                  </div>

                  {data.updated_at && (
                    <p className="text-primary-300 text-xs mt-4">🕐 Updated: {data.updated_at}</p>
                  )}
                </div>
              )}

              {/* Price Range */}
              {(data.min_price || data.max_price) && (
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Min Price', value: data.min_price, color: 'bg-green-50 border-green-100', text: 'text-green-700' },
                    { label: 'Avg Price', value: data.avg_price || data.current_price, color: 'bg-blue-50 border-blue-100', text: 'text-blue-700' },
                    { label: 'Max Price', value: data.max_price, color: 'bg-red-50 border-red-100', text: 'text-red-700' },
                  ].map((p, i) => (
                    <div key={i} className={`card border ${p.color} text-center`}>
                      <p className="text-gray-500 text-xs font-medium">{p.label}</p>
                      <p className={`text-2xl font-black mt-1 ${p.text}`}>{p.value || '—'}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Market Info */}
              {(data.source || data.description || data.notes) && (
                <div className="card">
                  <h3 className="font-bold text-gray-900 mb-3">📊 Market Analysis</h3>
                  {data.description && <p className="text-gray-600 text-sm leading-relaxed mb-3">{data.description}</p>}
                  {data.notes && <p className="text-gray-500 text-sm">{data.notes}</p>}
                  {data.source && (
                    <p className="text-gray-400 text-xs mt-3">Source: {data.source}</p>
                  )}
                </div>
              )}

              {/* AI Insight */}
              {data.ai_insight && (
                <div className="card bg-amber-50 border border-amber-100">
                  <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                    🤖 AI Market Insight
                  </h3>
                  <p className="text-amber-700 text-sm leading-relaxed whitespace-pre-wrap">{data.ai_insight}</p>
                </div>
              )}

              {/* Raw response if structured differently */}
              {!data.current_price && data.prices && (
                <div className="card">
                  <h3 className="font-bold text-gray-900 mb-3">Price Data</h3>
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-xl p-4 overflow-x-auto">
                    {typeof data.prices === 'string' ? data.prices : JSON.stringify(data.prices, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Initial state */}
          {!data && !loading && (
            <div className="text-center py-16 text-gray-400">
              <span className="text-6xl">📊</span>
              <p className="mt-4 font-semibold">Select a crop and location, then click "Get Current Prices"</p>
              <p className="text-sm mt-2">Data sourced from local mandi prices and AI analysis</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
