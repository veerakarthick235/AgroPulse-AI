import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/layout/Navbar';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Store, MapPin, Leaf, ChevronRight, Clock } from 'lucide-react';

const PRODUCE_TYPES = ['Vegetables', 'Fruits', 'Grains', 'Dairy', 'Herbs', 'Mixed'];

export default function BecomeSeller() {
  const { userProfile, refreshProfile } = useAuth();
  const navigate              = useNavigate();
  const [step, setStep]       = useState('form'); // 'form' | 'pending' | 'approved'
  const [saving, setSaving]   = useState(false);

  const [form, setForm] = useState({
    businessName: userProfile?.displayName || '',
    location:     userProfile?.farmLocation || '',
    produceType:  'Vegetables',
    phone:        userProfile?.phone || '',
    description:  '',
  });

  // ── Redirects ──
  useEffect(() => {
    // Already a seller
    if (userProfile?.role === 'seller' && userProfile?.isApproved) {
      navigate('/seller', { replace: true });
      return;
    }

    // Pending seller
    if (userProfile?.role === 'seller' && !userProfile?.isApproved) {
      setStep('pending');
    }
  }, [userProfile?.role, userProfile?.isApproved, navigate]);

  // If admin approves them while on this page (and they click refresh status or something)
  useEffect(() => {
    if (userProfile?.role === 'seller' && userProfile?.isApproved && step === 'pending') {
      toast.success('🎉 You\'ve been approved as a seller!');
      navigate('/seller', { replace: true });
    }
  }, [userProfile?.isApproved, step, navigate]);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.businessName.trim() || !form.location.trim()) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      await api.put('/api/auth/profile', {
        role:        'seller',
        isApproved:  false,
        isActive:    true,
        displayName: form.businessName.trim(),
        phone:       form.phone.trim(),
        farmLocation:  form.location.trim(),
        produceType:   form.produceType,
        sellerProfile: {
          businessName: form.businessName.trim(),
          location:     form.location.trim(),
          produceType:  form.produceType,
          phone:        form.phone.trim(),
          description:  form.description.trim(),
          appliedAt:    new Date().toISOString(),
        },
      });
      toast.success('Application submitted! Admin will review shortly.');
      await refreshProfile(); // refresh user profile
      setStep('pending');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to submit application');
    } finally {
      setSaving(false);
    }
  };

  // ── Already pending ──────────────────────────────────────────────────────
  if (step === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-emerald-50">
        <Navbar />
        <div className="max-w-lg mx-auto pt-28 px-4 text-center">
          <div className="bg-white rounded-3xl shadow-xl p-10">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <Clock size={36} className="text-yellow-500" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Application Under Review</h1>
            <p className="text-gray-500 mb-6">
              Your seller application has been submitted! Our admin team will review it within 1-2 hours.
              You can refresh your page later to check your status.
            </p>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-left mb-6">
              <p className="text-amber-700 text-sm font-medium mb-2">⏳ What happens next?</p>
              <ul className="text-amber-600 text-sm space-y-1">
                <li>• Admin reviews your business details</li>
                <li>• Once approved, your seller dashboard unlocks</li>
                <li>• You can start listing products immediately</li>
                <li>• Buyers can discover your farm's produce</li>
              </ul>
            </div>
            <button onClick={() => checkAuth()} className="btn-primary w-full mb-3">
              Refresh Status
            </button>
            <button onClick={() => navigate('/dashboard')} className="btn-secondary w-full">
              Continue Shopping as Buyer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Application Form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-emerald-50">
      <Navbar />
      <div className="max-w-xl mx-auto pt-24 pb-12 px-4">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Store size={30} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Become a Seller</h1>
          <p className="text-gray-500">Join thousands of farmers selling directly to buyers — no middlemen, better prices.</p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: '💰', title: 'Fair Prices', desc: 'No middlemen — you set the price' },
            { icon: '🚀', title: 'Easy Setup', desc: 'List products in minutes' },
            { icon: '🌍', title: 'Wider Reach', desc: 'Buyers across the region' },
          ].map(b => (
            <div key={b.title} className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
              <div className="text-2xl mb-1">{b.icon}</div>
              <p className="font-semibold text-gray-900 text-xs">{b.title}</p>
              <p className="text-gray-400 text-xs mt-0.5">{b.desc}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="font-bold text-gray-900 text-lg">Your Business Details</h2>

          <div>
            <label className="label">Business / Farm Name *</label>
            <input name="businessName" value={form.businessName} onChange={handleChange} placeholder="e.g. Rajan's Organic Farm" className="input" required />
          </div>

          <div>
            <label className="label">Farm Location *</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input name="location" value={form.location} onChange={handleChange} placeholder="e.g. Pollachi, Coimbatore" className="input pl-10" required />
            </div>
          </div>

          <div>
            <label className="label">Primary Produce Type *</label>
            <select name="produceType" value={form.produceType} onChange={handleChange} className="input">
              {PRODUCE_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Contact Phone</label>
            <input name="phone" value={form.phone} onChange={handleChange} placeholder="10-digit mobile number" className="input" type="tel" />
          </div>

          <div>
            <label className="label">Tell us about your farm</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={3}
              placeholder="Organic methods, certifications, years of farming, what makes you unique..."
              className="input resize-none" />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-blue-700 text-sm">
              ℹ️ Your application will be reviewed within 1-2 hours. Once approved, you'll get full access to the Seller Dashboard.
            </p>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2 py-3.5">
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting...</>
            ) : (
              <><Leaf size={18} /> Submit Application <ChevronRight size={16} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
