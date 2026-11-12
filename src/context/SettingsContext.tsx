import React, { createContext, useContext, useState, useEffect } from 'react';
import { SchoolSettings } from '../types/cbt';
import { api } from '../lib/api';

const DEFAULT_SETTINGS: SchoolSettings = {
  schoolName: 'SMAN 1 PRESTASI BANGSA',
  schoolLogoUrl: '',
  loginBackgroundUrl: '',
  appSubtitle: 'CBT Portal · TP 2024/2025 Genap',
  academicYearText: '2024/2025 Genap',
};

interface SettingsContextType {
  settings: SchoolSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<SchoolSettings>) => Promise<void>;
  reloadSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await api.getSettings();
      if (res && res.settings) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...res.settings,
        });
      }
    } catch (err) {
      console.warn('[SettingsContext] Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<SchoolSettings>) => {
    try {
      const res = await api.updateSettings(newSettings);
      if (res && res.settings) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...res.settings,
        });
      } else {
        setSettings((prev) => ({ ...prev, ...newSettings }));
      }
    } catch (err) {
      console.error('Gagal memperbarui pengaturan:', err);
      setSettings((prev) => ({ ...prev, ...newSettings }));
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        reloadSettings: fetchSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    return {
      settings: DEFAULT_SETTINGS,
      loading: false,
      updateSettings: async () => {},
      reloadSettings: async () => {},
    };
  }
  return context;
};
