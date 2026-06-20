import { useState, useRef } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { SIDEBAR_LINKS } from '../../config/sidebarLinks';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Upload, Camera, Leaf, AlertTriangle, CheckCircle,
  Volume2, VolumeX, Languages, MessageSquare, Send, X
} from 'lucide-react';

const LANGUAGE_OPTIONS = [
  { value: 'English', label: '🇬🇧 English' },
  { value: 'Tamil',   label: '🌸 Tamil' },
  { value: 'Hindi',   label: '🇮🇳 Hindi' },
];

export default function CropDisease() {
  const { userProfile } = useAuth();
  const role  = userProfile?.role || 'buyer';
  const links = SIDEBAR_LINKS[role] || SIDEBAR_LINKS.buyer;

  const [image,       setImage]       = useState(null);
  const [preview,     setPreview]     = useState(null);
  const [resultText,  setResultText]  = useState('');    // raw text from /predict
  const [loading,     setLoading]     = useState(false);
  const [translating, setTranslating] = useState(false);
  const [language,    setLanguage]    = useState('English');
  const [speaking,    setSpeaking]    = useState(false);
  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatMsg,     setChatMsg]     = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [isBrief,     setIsBrief]     = useState(false);
  const [useCamera,   setUseCamera]   = useState(false);

  const fileRef    = useRef(null);
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const canvasRef  = useRef(null);

  const isHealthy = resultText?.toLowerCase().includes('healthy') &&
                    !resultText?.toLowerCase().includes('disease detected');

  const handleFile = (file) => {
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResultText('');
    setChatHistory([]);
  };

  const handleDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); };

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setUseCamera(true);
    } catch {
      toast.error('Camera access denied or not available');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setUseCamera(false);
  };

  const capturePhoto = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      const file = new File([blob], 'camera_capture.jpg', { type: 'image/jpeg' });
      handleFile(file);
      stopCamera();
    }, 'image/jpeg', 0.9);
  };

  // ── Predict ───────────────────────────────────────────────────────────────
  const handlePredict = async () => {
    if (!image) { toast.error('Please upload a crop leaf image first'); return; }
    setLoading(true);
    setResultText('');
    setChatHistory([]);
    try {
      const fd = new FormData();
      fd.append('leaf', image);           // ← correct field name (Flask expects 'leaf')
      fd.append('source', 'upload');
      fd.append('brief', isBrief ? 'true' : 'false');
      const res = await api.post('/predict', fd);
      setResultText(res.data.prediction_text || res.data.text || JSON.stringify(res.data));
      setLanguage('English');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Prediction failed. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // ── Translate ─────────────────────────────────────────────────────────────
  const handleTranslate = async (lang) => {
    if (!resultText || lang === 'English') return;
    setTranslating(true);
    try {
      const res = await api.post('/translate-report', { text: resultText, language: lang });
      setResultText(res.data.translated_text);
    } catch { toast.error('Translation failed'); }
    finally { setTranslating(false); }
  };

  const onLangChange = (lang) => {
    setLanguage(lang);
    handleTranslate(lang);
  };

  // ── Text-to-Speech ────────────────────────────────────────────────────────
  const handleSpeak = () => {
    if (!resultText) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const utter = new SpeechSynthesisUtterance(resultText.slice(0, 2000));
    utter.lang  = language === 'Tamil' ? 'ta-IN' : language === 'Hindi' ? 'hi-IN' : 'en-IN';
    utter.rate  = 0.9;
    utter.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  // ── Follow-up Chat ────────────────────────────────────────────────────────
  const handleChat = async () => {
    if (!chatMsg.trim() || !resultText) return;
    const userMsg = chatMsg.trim();
    setChatHistory(h => [...h, { role: 'user', text: userMsg }]);
    setChatMsg('');
    setChatLoading(true);
    try {
      const res = await api.post('/ask-leaf-followup', { question: userMsg, report: resultText });
      setChatHistory(h => [...h, { role: 'ai', text: res.data.answer }]);
    } catch { setChatHistory(h => [...h, { role: 'ai', text: 'Sorry, could not get an answer right now.' }]); }
    finally { setChatLoading(false); }
  };

  // ── Format plain text result into readable sections ───────────────────────
  const formatResult = (text) => {
    if (!text) return null;
    const lines = text.split('\n').filter(l => l.trim());
    return lines.map((line, i) => {
      const isHeader = /^[A-Z][A-Z &]+$/.test(line.trim()) ||
                       /^(CROP|LEAF|DISEASE|PRIORITY|WHY|KEY|TREATMENT|DO NOT|RECOVERY|FINAL)/.test(line.trim());
      if (isHeader) return (
        <h3 key={i} className="font-bold text-gray-800 mt-4 mb-1 text-sm uppercase tracking-wide border-b border-gray-100 pb-1">{line}</h3>
      );
      const isStatus = line.includes('🟢') || line.includes('🟡') || line.includes('🔴');
      return (
        <p key={i} className={`text-sm leading-relaxed mb-0.5 ${
          isStatus ? 'font-semibold text-base' :
          line.startsWith('-') || line.startsWith('•') ? 'text-gray-600 ml-2' : 'text-gray-700'
        }`}>{line}</p>
      );
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={links} role={role} />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="page-header mb-1 flex items-center gap-3">
                <span className="text-4xl">🔬</span> Crop Disease Detection
              </h1>
              <p className="text-gray-400 text-sm">Upload a leaf image — AI identifies diseases and suggests remedies</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-500">Brief Mode</span>
              <div
                onClick={() => setIsBrief(b => !b)}
                className={`w-10 h-5 rounded-full relative transition-colors ${isBrief ? 'bg-primary-600' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isBrief ? 'translate-x-5' : ''}`} />
              </div>
            </label>
          </div>

          {/* Camera / Upload Card */}
          <div className="card mb-6">
            {useCamera ? (
              <div className="relative">
                <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-3 mt-3">
                  <button onClick={capturePhoto} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    <Camera size={18} /> Capture Photo
                  </button>
                  <button onClick={stopCamera} className="btn-secondary flex-1">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  className="border-2 border-dashed border-primary-200 hover:border-primary-400 rounded-2xl p-10 text-center cursor-pointer transition-all hover:bg-primary-50 group"
                >
                  {preview ? (
                    <div className="flex flex-col items-center gap-4">
                      <img src={preview} alt="Uploaded" className="max-h-64 rounded-xl shadow-lg object-contain" />
                      <p className="text-primary-600 font-medium text-sm">Click to change image</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-gray-400 group-hover:text-primary-500 transition-colors">
                      <Upload size={48} strokeWidth={1.5} />
                      <div>
                        <p className="font-semibold text-gray-600">Drop an image here or click to upload</p>
                        <p className="text-sm mt-1">JPG, PNG, WEBP • Max 10 MB</p>
                      </div>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
                </div>

                <div className="flex gap-3 mt-3">
                  <button onClick={handlePredict} disabled={!image || loading} className="btn-primary flex-1 flex items-center justify-center gap-2 py-3.5 disabled:opacity-50">
                    {loading ? (
                      <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Analyzing with AI...</>
                    ) : (
                      <><Leaf size={18} /> Detect Disease</>
                    )}
                  </button>
                  <button onClick={startCamera} className="btn-secondary flex items-center gap-2 px-4">
                    <Camera size={18} /> Camera
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Result */}
          {resultText && (
            <div className={`card animate-fade-in ${isHealthy ? 'border-2 border-green-200' : 'border-2 border-red-200'}`}>
              {/* Result header + controls */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  {isHealthy
                    ? <CheckCircle size={24} className="text-green-600 flex-shrink-0" />
                    : <AlertTriangle size={24} className="text-red-600 flex-shrink-0" />
                  }
                  <h2 className={`font-extrabold text-lg ${isHealthy ? 'text-green-800' : 'text-red-800'}`}>
                    {isHealthy ? '✅ Plant Appears Healthy' : '⚠️ Issue Detected'}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {/* Language selector */}
                  <select
                    value={language}
                    onChange={e => onLangChange(e.target.value)}
                    disabled={translating}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
                  >
                    {LANGUAGE_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                  {/* TTS Button */}
                  <button
                    onClick={handleSpeak}
                    className={`p-2 rounded-xl transition-colors ${speaking ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    title={speaking ? 'Stop' : 'Read aloud'}
                  >
                    {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  {/* Chat Button */}
                  <button
                    onClick={() => setChatOpen(o => !o)}
                    className="p-2 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                    title="Ask follow-up questions"
                  >
                    <MessageSquare size={16} />
                  </button>
                </div>
              </div>

              {translating && (
                <div className="flex items-center gap-2 text-primary-600 text-sm mb-3">
                  <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                  Translating...
                </div>
              )}

              {/* Formatted result text */}
              <div className="bg-gray-50 rounded-2xl p-5 max-h-[500px] overflow-y-auto">
                {formatResult(resultText)}
              </div>

              {/* Follow-up Chat Panel */}
              {chatOpen && (
                <div className="mt-4 border border-blue-100 rounded-2xl overflow-hidden animate-slide-up">
                  <div className="bg-blue-50 px-4 py-3 flex items-center justify-between">
                    <p className="text-blue-800 font-semibold text-sm flex items-center gap-2">
                      <MessageSquare size={15} /> Ask a Follow-up Question
                    </p>
                    <button onClick={() => setChatOpen(false)}><X size={15} className="text-blue-500" /></button>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-3 space-y-2 bg-white">
                    {chatHistory.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                          m.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 px-3 py-2 rounded-2xl text-sm text-gray-500 animate-pulse">Thinking...</div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 p-3 border-t border-gray-100 bg-white">
                    <input
                      value={chatMsg}
                      onChange={e => setChatMsg(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleChat()}
                      placeholder="Ask about treatment, prevention..."
                      className="input text-sm py-2 flex-1"
                    />
                    <button onClick={handleChat} disabled={!chatMsg.trim() || chatLoading} className="btn-primary p-2.5">
                      <Send size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tips */}
          {!resultText && (
            <div className="card bg-amber-50 border border-amber-100">
              <h3 className="font-semibold text-amber-800 mb-2">📸 Tips for better results</h3>
              <ul className="text-amber-700 text-sm space-y-1">
                <li>• Use clear, well-lit photos of the affected leaf</li>
                <li>• Try to fill the frame with the leaf</li>
                <li>• Supported crops: Tomato, Potato, Corn, Rice, Wheat, and many more</li>
                <li>• Avoid blurry or dark images — use the camera button for live capture</li>
                <li>• Enable <strong>Brief Mode</strong> for a quick summary only</li>
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
