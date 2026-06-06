import React, { useState, useEffect } from 'react';
import { X, Save, Settings as SettingsIcon } from 'lucide-react';
import { api } from '../services/api';

export function SettingsModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    vmix_host: '',
    vmix_tcp_port: 8099,
    vmix_http_port: 8088,
    yamaha_host: '',
    yamaha_port: 49280
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.getSettings()
        .then(data => {
          setFormData(data);
          setError(null);
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
      setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
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
      // Automatically close after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-900 bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-800 rounded-xl border border-border-subtle w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-5 border-b border-border-subtle bg-surface-700 rounded-t-xl">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <SettingsIcon className="text-accent-cyan" /> 
            System Configuration
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          
          {error && (
            <div className="bg-accent-red bg-opacity-20 text-accent-red p-3 rounded text-sm border border-accent-red border-opacity-30">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-accent-green bg-opacity-20 text-accent-green p-3 rounded text-sm border border-accent-green border-opacity-30">
              Settings saved successfully! Restart may be required.
            </div>
          )}

          {/* vMix Section */}
          <div className="space-y-4">
            <h3 className="text-accent-cyan font-mono text-sm uppercase tracking-wider font-semibold border-b border-border-subtle pb-2">vMix Engine Targets</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-text-muted">Host IP</label>
                <input 
                  type="text" name="vmix_host" value={formData.vmix_host} onChange={handleChange} required
                  className="w-full bg-surface-900 border border-border-active rounded px-3 py-2 focus:border-accent-cyan focus:outline-none text-sm" 
                  placeholder="127.0.0.1"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text-muted">TCP Port (Events)</label>
                <input 
                  type="number" name="vmix_tcp_port" value={formData.vmix_tcp_port} onChange={handleChange} required
                  className="w-full bg-surface-900 border border-border-active rounded px-3 py-2 focus:border-accent-cyan focus:outline-none text-sm" 
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-text-muted">HTTP Port (Web API)</label>
                <input 
                  type="number" name="vmix_http_port" value={formData.vmix_http_port} onChange={handleChange} required
                  className="w-full bg-surface-900 border border-border-active rounded px-3 py-2 focus:border-accent-cyan focus:outline-none text-sm" 
                />
              </div>
            </div>
          </div>

          {/* Yamaha Section */}
          <div className="space-y-4 pt-2">
            <h3 className="text-accent-green font-mono text-sm uppercase tracking-wider font-semibold border-b border-border-subtle pb-2">Yamaha TF3 Targets</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-text-muted">Mixer IP</label>
                <input 
                  type="text" name="yamaha_host" value={formData.yamaha_host} onChange={handleChange} required
                  className="w-full bg-surface-900 border border-border-active rounded px-3 py-2 focus:border-accent-green focus:outline-none text-sm" 
                  placeholder="192.168.1.50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text-muted">RCP Port</label>
                <input 
                  type="number" name="yamaha_port" value={formData.yamaha_port} onChange={handleChange} required
                  className="w-full bg-surface-900 border border-border-active rounded px-3 py-2 focus:border-accent-green focus:outline-none text-sm" 
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 rounded text-text-secondary hover:text-text-primary hover:bg-surface-700 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="bg-accent-cyan text-surface-900 px-6 py-2 rounded font-semibold flex items-center gap-2 hover:bg-opacity-90 disabled:opacity-50 transition-colors"
            >
              <Save size={18} />
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
