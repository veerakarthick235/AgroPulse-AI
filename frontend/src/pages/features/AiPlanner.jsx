import { useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { SIDEBAR_LINKS } from '../../config/sidebarLinks';
import { Sprout, Calculator, ChevronRight, ChevronDown } from 'lucide-react';

const SEASONS = ['Kharif (June–October)', 'Rabi (October–March)', 'Summer (March–June)', 'All Year'];
const LAND_UNITS = ['Acres', 'Hectares', 'Cents', 'Bigha'];

export default function AiPlanner() {
  const { userProfile } = useAuth();
  const [form, setForm] = useState({ land: '', unit: 'Acres', season: 'Kharif (June–October)', soil: '', location: '', budget: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const role = userProfile?.role || 'buyer';
  const links = SIDEBAR_LINKS[role] || SIDEBAR_LINKS.buyer;

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handlePlan = async () => {
    if (!form.land) { toast.error('Enter land area'); return; }
    setLoading(true);
    try {
      const res = await axios.post('/planner', form);
      setResult(res.data);
      setExpanded(0);
    } catch (e) {
      toast.error(e.response?.data?.error || 'AI Planner is unavailable. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Parse crops — backend returns various formats
  const crops = result?.crops || result?.recommendations || result?.plan?.crops || [];
  const summary = result?.summary || result?.overview || result?.plan?.summary;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={links} role={role} />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="page-header mb-1 flex items-center gap-3">
              <span className="text-4xl">🌱</span> AI Crop Planner
            </h1>
            <p className="text-gray-400 text-sm">Get personalized crop recommendations based on your land, season, and budget</p>
          </div>

          {/* Input Form */}
          <div className="card mb-6">
            <h2 className="font-bold text-gray-900 mb-4">🌾 Tell us about your farm</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Land Area *</label>
                  <input name="land" value={form.land} onChange={handleChange} type="number" min="0.1" step="0.1" placeholder="e.g. 2.5" className="input" />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select name="unit" value={form.unit} onChange={handleChange} className="input">
                    {LAND_UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Season</label>
                <select name="season" value={form.season} onChange={handleChange} className="input">
                  {SEASONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Location / District</label>
                <input name="location" value={form.location} onChange={handleChange} placeholder="e.g. Coimbatore" className="input" />
              </div>
              <div>
                <label className="label">Soil Type (optional)</label>
                <input name="soil" value={form.soil} onChange={handleChange} placeholder="e.g. Red soil, Clay, Sandy" className="input" />
              </div>
              <div>
                <label className="label">Budget (₹, optional)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                  <input name="budget" value={form.budget} onChange={handleChange} type="number" placeholder="e.g. 50000" className="input pl-7" />
                </div>
              </div>
            </div>

            <button onClick={handlePlan} disabled={loading} className="btn-primary mt-5 w-full flex items-center justify-center gap-2 py-3.5">
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating AI Plan...</>
              ) : (
                <><Sprout size={18} /> Generate Crop Plan</>
              )}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div className="animate-fade-in space-y-4">
              {/* Summary */}
              {summary && (
                <div className="card bg-primary-50 border border-primary-100">
                  <h2 className="font-bold text-primary-900 mb-2">📋 Planner Summary</h2>
                  <p className="text-primary-700 text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
                </div>
              )}

              {/* Crop Cards */}
              {crops.length > 0 ? (
                <div>
                  <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Calculator size={18} /> Recommended Crops ({crops.length})
                  </h2>
                  <div className="space-y-3">
                    {crops.map((crop, i) => {
                      const name = crop.name || crop.crop || crop.crop_name || crop;
                      const isOpen = expanded === i;
                      return (
                        <div key={i} className="card border border-gray-100 hover:border-primary-200 transition-all">
                          <button
                            onClick={() => setExpanded(isOpen ? null : i)}
                            className="w-full flex items-center gap-4 text-left"
                          >
                            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-xl flex-shrink-0">
                              🌾
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900">{name}</p>
                              {crop.season && <p className="text-xs text-gray-400 mt-0.5">Season: {crop.season}</p>}
                              {crop.estimated_yield && <p className="text-xs text-green-600 font-medium">Est. Yield: {crop.estimated_yield}</p>}
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                              {crop.estimated_cost && (
                                <div className="text-right">
                                  <p className="text-xs text-gray-400">Est. Cost</p>
                                  <p className="font-bold text-gray-900 text-sm">₹{crop.estimated_cost}</p>
                                </div>
                              )}
                              {crop.expected_profit && (
                                <div className="text-right">
                                  <p className="text-xs text-gray-400">Profit</p>
                                  <p className="font-bold text-primary-600 text-sm">₹{crop.expected_profit}</p>
                                </div>
                              )}
                              {isOpen ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                              {crop.description && <p className="text-gray-600 text-sm leading-relaxed">{crop.description}</p>}
                              {crop.tips && (
                                <div>
                                  <p className="font-semibold text-gray-800 text-sm mb-1">🌿 Farming Tips</p>
                                  <p className="text-gray-600 text-sm leading-relaxed">{crop.tips}</p>
                                </div>
                              )}
                              {crop.water_requirement && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-blue-500">💧</span>
                                  <span className="text-gray-600"><span className="font-medium">Water:</span> {crop.water_requirement}</span>
                                </div>
                              )}
                              {crop.fertilizer && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span>🌱</span>
                                  <span className="text-gray-600"><span className="font-medium">Fertilizer:</span> {crop.fertilizer}</span>
                                </div>
                              )}
                              {crop.duration && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span>⏱️</span>
                                  <span className="text-gray-600"><span className="font-medium">Duration:</span> {crop.duration}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Fallback: show raw text response
                <div className="card">
                  <h2 className="font-bold text-gray-900 mb-3">🤖 AI Plan</h2>
                  <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-4">
                    {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                  </div>
                </div>
              )}
            </div>
          )}

          {!result && !loading && (
            <div className="card bg-green-50 border border-green-100">
              <h3 className="font-semibold text-green-800 mb-2">🌾 How the AI Planner works</h3>
              <ul className="text-green-700 text-sm space-y-1">
                <li>• Enter your land area and select the growing season</li>
                <li>• Optionally add soil type, location, and budget for better results</li>
                <li>• AI analyzes climate data, market prices, and soil conditions</li>
                <li>• Get estimated costs, yields, and profit for each recommended crop</li>
                <li>• Includes detailed farming tips and best practices</li>
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
