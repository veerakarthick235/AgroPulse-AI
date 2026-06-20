import { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { SIDEBAR_LINKS } from '../../config/sidebarLinks';
import Sidebar from '../../components/layout/Sidebar';
import toast from 'react-hot-toast';
import { Upload, Save } from 'lucide-react';
import api from '../../utils/api';
import axios from 'axios';

export default function SellerProfile() {
  const { userProfile, checkAuth } = useAuth();
  const fileRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    displayName: userProfile?.displayName || '',
    phone: userProfile?.phone || '',
    farmName: userProfile?.farmName || '',
    farmLocation: userProfile?.farmLocation || '',
    produceType: userProfile?.produceType || '',
    city: userProfile?.address?.city || '',
    state: userProfile?.address?.state || '',
    pincode: userProfile?.address?.pincode || '',
    street: userProfile?.address?.street || '',
  });

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('profile_image', file);
      const res = await api.post('/upload-profile-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      
      await api.put('/api/auth/profile', { profileImageUrl: res.data.secure_url });
      toast.success('Profile photo updated!');
      await checkAuth(); // refresh profile
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/auth/profile', {
        displayName: form.displayName,
        phone: form.phone,
        farmName: form.farmName,
        farmLocation: form.farmLocation,
        produceType: form.produceType,
        address: { city: form.city, state: form.state, pincode: form.pincode, street: form.street },
      });
      toast.success('Profile saved!');
      await checkAuth();
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={SIDEBAR_LINKS.seller} role="seller" />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="page-header">My Profile</h1>
          <div className="card">
            {/* Profile Image */}
            <div className="flex items-center gap-5 mb-8 pb-8 border-b border-gray-100">
              <div className="relative">
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-2xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity bg-primary-100 flex items-center justify-center text-3xl"
                >
                  {userProfile?.profileImageUrl ? (
                    <img src={userProfile.profileImageUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    userProfile?.displayName?.[0]?.toUpperCase() || '🌾'
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">{userProfile?.displayName}</p>
                <p className="text-gray-400 text-sm">{userProfile?.email}</p>
                <button onClick={() => fileRef.current?.click()} className="text-primary-600 text-sm font-medium mt-1 hover:underline flex items-center gap-1">
                  <Upload size={13} /> {uploading ? 'Uploading...' : 'Change Photo'}
                </button>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name</label>
                  <input name="displayName" value={form.displayName} onChange={handleChange} className="input" />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} className="input" />
                </div>
              </div>

              <div className="bg-primary-50 rounded-2xl p-5 space-y-4">
                <p className="font-semibold text-primary-700">🌾 Farm Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Farm / Business Name</label>
                    <input name="farmName" value={form.farmName} onChange={handleChange} className="input" />
                  </div>
                  <div>
                    <label className="label">Farm Location</label>
                    <input name="farmLocation" value={form.farmLocation} onChange={handleChange} className="input" />
                  </div>
                </div>
                <div>
                  <label className="label">Type of Produce</label>
                  <input name="produceType" value={form.produceType} onChange={handleChange} placeholder="e.g. Organic Vegetables, Fruits" className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">City</label>
                  <input name="city" value={form.city} onChange={handleChange} className="input" />
                </div>
                <div>
                  <label className="label">State</label>
                  <input name="state" value={form.state} onChange={handleChange} className="input" />
                </div>
              </div>

              <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
