import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  SchoolSettings,
  DEFAULT_TEACHER_MENUS,
  normalizeTeacherMenus,
} from '../types/cbt';
import { api } from '../lib/api';

const DEFAULT_SETTINGS: SchoolSettings = {
  schoolName: 'Portal CBT Sekolah',
  schoolLogoUrl: '',
  loginBackgroundUrl: '',
  appSubtitle: 'Portal Ujian Berbasis Komputer',
  academicYearText: '2024/2025 Genap',
  teacherMenus: { ...DEFAULT_TEACHER_MENUS },
  showDeleteExamAction: true,
};

interface SettingsContextType {
  settings: SchoolSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<SchoolSettings>) => Promise<void>;
  reloadSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function mergeWithDefaultSettings(raw?: Partial<SchoolSettings> | null): SchoolSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(raw || {}),
    teacherMenus: normalizeTeacherMenus(raw?.teacherMenus),
    showDeleteExamAction:
      raw?.showDeleteExamAction !== undefined
        ? Boolean(raw.showDeleteExamAction)
        : DEFAULT_SETTINGS.showDeleteExamAction,
  };
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await api.getSettings();
      if (res && res.settings) {
        setSettings(mergeWithDefaultSettings(res.settings));
      }
    } catch (err) {
      console.warn('[SettingsContext] Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();

    const unsub = onSnapshot(
      doc(db, 'settings', 'school_info'),
      (snap) => {
        if (snap.exists()) {
          setSettings(mergeWithDefaultSettings(snap.data() as Partial<SchoolSettings>));
        }
      },
      (err) => {
        console.warn('[SettingsContext] Realtime settings listener warning:', err);
      }
    );

    return () => unsub();
  }, []);

  const updateSettings = async (newSettings: Partial<SchoolSettings>) => {
    try {
      const res = await api.updateSettings(newSettings);
      if (res && res.settings) {
        setSettings(mergeWithDefaultSettings(res.settings));
      } else {
        setSettings((prev) =>
          mergeWithDefaultSettings({
            ...prev,
            ...newSettings,
            teacherMenus: newSettings.teacherMenus ?? prev.teacherMenus,
          })
        );
      }
    } catch (err) {
      console.error('Gagal memperbarui pengaturan:', err);
      setSettings((prev) =>
        mergeWithDefaultSettings({
          ...prev,
          ...newSettings,
          teacherMenus: newSettings.teacherMenus ?? prev.teacherMenus,
        })
      );
      throw err;
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
