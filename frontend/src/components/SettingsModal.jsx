import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Settings as SettingsIcon, Server, Speaker } from 'lucide-react';
import { api } from '../services/api';

export function SettingsModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    vmix_host: '',
    vmix_tcp_port: 8099,
    vmix_http_port: 8088,
    yamaha_host: '',
    yamaha_port: 49280,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api
        .getSettings()
        .then((data) => {
          setFormData(data);
          setError(null);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
      setSuccess(false);
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
    setSuccess(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.updateSettings(formData);
      setSuccess(true);
      setError(null);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg px-3 py-2.5 text-sm transition-all focus:outline-none';
  const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#D8DCE6',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(7,10,15,0.75)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-sheet rounded-2xl w-full max-w-lg overflow-hidden"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex justify-between items-center px-6 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: '#D8DCE6' }}>
                <SettingsIcon size={20} style={{ color: '#20D9FF' }} />
                Configuration
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#5A6278' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#D8DCE6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#5A6278'; }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              {error && (
                <motion.div
                  className="p-3 rounded-lg text-sm"
                  style={{
                    background: 'rgba(255,92,122,0.1)',
                    border: '1px solid rgba(255,92,122,0.25)',
                    color: '#FF5C7A',
                  }}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.div>
              )}

              {success && (
                <motion.div
                  className="p-3 rounded-lg text-sm text-live"
                  style={{
                    background: 'rgba(57,229,140,0.1)',
                    border: '1px solid rgba(57,229,140,0.25)',
                  }}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  Settings saved successfully. Restart may be required.
                </motion.div>
              )}

              {/* vMix */}
              <div className="space-y-4">
                <h3
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] pb-2"
                  style={{ color: '#20D9FF', borderBottom: '1px solid rgba(32,217,255,0.12)' }}
                >
                  <Server size={14} />
                  vMix Engine
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#5A6278' }}>
                      Host IP
                    </label>
                    <input
                      type="text"
                      name="vmix_host"
                      value={formData.vmix_host}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = 'rgba(32,217,255,0.4)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                      placeholder="127.0.0.1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#5A6278' }}>
                      TCP Port (Events)
                    </label>
                    <input
                      type="number"
                      name="vmix_tcp_port"
                      value={formData.vmix_tcp_port}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = 'rgba(32,217,255,0.4)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#5A6278' }}>
                      HTTP Port (Web API)
                    </label>
                    <input
                      type="number"
                      name="vmix_http_port"
                      value={formData.vmix_http_port}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = 'rgba(32,217,255,0.4)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                    />
                  </div>
                </div>
              </div>

              {/* Yamaha */}
              <div className="space-y-4">
                <h3
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] pb-2"
                  style={{ color: '#39E58C', borderBottom: '1px solid rgba(57,229,140,0.12)' }}
                >
                  <Speaker size={14} />
                  Yamaha TF3
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#5A6278' }}>
                      Mixer IP
                    </label>
                    <input
                      type="text"
                      name="yamaha_host"
                      value={formData.yamaha_host}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = 'rgba(57,229,140,0.4)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                      placeholder="192.168.1.50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#5A6278' }}>
                      RCP Port
                    </label>
                    <input
                      type="number"
                      name="yamaha_port"
                      value={formData.yamaha_port}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = 'rgba(57,229,140,0.4)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                    />
                  </div>
                </div>
              </div>

              <div
                className="flex justify-end gap-3 pt-4"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ color: '#8B93A8' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#D8DCE6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#8B93A8'; }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all hover-lift disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, rgba(32,217,255,0.9), rgba(32,217,255,0.7))',
                    color: '#070A0F',
                    boxShadow: '0 4px 20px rgba(32,217,255,0.25)',
                  }}
                >
                  <Save size={16} />
                  {loading ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
