import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { authAPI } from '../../lib/auth';

interface UserSettings {
  default_calendar_view: string;
  week_starts_on: string;
  dark_mode: boolean;
  theme: string;
  // Add other settings as needed
}

interface UseUserSettingsReturn {
  settings: UserSettings | null;
  originalSettings: UserSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  updateSettings: (updates: Partial<UserSettings>) => void;
  saveSettings: () => Promise<void>;
  resetToOriginal: () => void;
  refreshSettings: () => Promise<void>;
}

// Default settings fallback
const DEFAULT_SETTINGS: UserSettings = {
  default_calendar_view: 'month',
  week_starts_on: 'sunday',
  dark_mode: true,
  theme: 'classic'
};

// Singleton pattern to ensure only one instance manages settings
let settingsInstance: {
  settings: UserSettings | null;
  originalSettings: UserSettings | null;
  isLoaded: boolean;
  isLoading: boolean;
  listeners: Set<(settings: UserSettings | null, originalSettings: UserSettings | null) => void>;
} = {
  settings: null,
  originalSettings: null,
  isLoaded: false,
  isLoading: false,
  listeners: new Set()
};

export const useUserSettings = (): UseUserSettingsReturn => {
  const [settings, setSettings] = useState<UserSettings | null>(settingsInstance.settings);
  const [originalSettings, setOriginalSettings] = useState<UserSettings | null>(settingsInstance.originalSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Track if this hook instance has been mounted
  const isMountedRef = useRef(true);
  
  // Subscribe to settings changes from the singleton
  useEffect(() => {
    const listener = (newSettings: UserSettings | null, newOriginalSettings: UserSettings | null) => {
      if (isMountedRef.current) {
        setSettings(newSettings);
        setOriginalSettings(newOriginalSettings);
      }
    };
    
    settingsInstance.listeners.add(listener);
    
    return () => {
      settingsInstance.listeners.delete(listener);
      isMountedRef.current = false;
    };
  }, []);

  // Notify all listeners of settings changes
  const notifyListeners = useCallback(() => {
    settingsInstance.listeners.forEach(listener => 
      listener(settingsInstance.settings, settingsInstance.originalSettings)
    );
  }, []);

  // Load settings from API (only called once globally)
  const loadSettings = useCallback(async () => {
    if (settingsInstance.isLoaded || settingsInstance.isLoading) {
      return;
    }

    settingsInstance.isLoading = true;
    setIsLoading(true);

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/user-settings/`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (response.ok) {
        const data = await response.json();
        const settingsWithDefaults = { ...DEFAULT_SETTINGS, ...data };
        
        settingsInstance.settings = settingsWithDefaults;
        settingsInstance.originalSettings = { ...settingsWithDefaults };
        settingsInstance.isLoaded = true;
        
        notifyListeners();
      } else {
        console.error('Failed to load settings:', response.statusText);
        // Use default settings if API fails
        settingsInstance.settings = DEFAULT_SETTINGS;
        settingsInstance.originalSettings = { ...DEFAULT_SETTINGS };
        settingsInstance.isLoaded = true;
        notifyListeners();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Use default settings if API fails
      settingsInstance.settings = DEFAULT_SETTINGS;
      settingsInstance.originalSettings = { ...DEFAULT_SETTINGS };
      settingsInstance.isLoaded = true;
      notifyListeners();
    } finally {
      settingsInstance.isLoading = false;
      setIsLoading(false);
    }
  }, [notifyListeners]);

  // Initialize settings on first use
  useEffect(() => {
    if (!settingsInstance.isLoaded && !settingsInstance.isLoading) {
      loadSettings();
    } else if (settingsInstance.isLoaded) {
      // Set initial state if already loaded
      setSettings(settingsInstance.settings);
      setOriginalSettings(settingsInstance.originalSettings);
    }
  }, [loadSettings]);

  // Update settings locally (optimistic updates)
  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    if (!settingsInstance.settings) return;

    const updatedSettings = { ...settingsInstance.settings, ...updates };
    settingsInstance.settings = updatedSettings;
    notifyListeners();

    // Clear any previous save states
    setSaveError(null);
    setSaveSuccess(false);
  }, [notifyListeners]);

  // Save settings to API with debouncing
  const saveSettingsRef = useRef<NodeJS.Timeout | null>(null);
  const saveSettings = useCallback(async () => {
    if (!settingsInstance.settings || isSaving) return;

    // Clear any existing timeout
    if (saveSettingsRef.current) {
      clearTimeout(saveSettingsRef.current);
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/user-settings/`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsInstance.settings),
        }
      );

      if (response.ok) {
        const updatedSettings = await response.json();
        const settingsWithDefaults = { ...DEFAULT_SETTINGS, ...updatedSettings };
        
        settingsInstance.settings = settingsWithDefaults;
        settingsInstance.originalSettings = { ...settingsWithDefaults };
        
        notifyListeners();
        setSaveSuccess(true);

        // Dispatch global event for other components
        window.dispatchEvent(new CustomEvent('settingsUpdated', { 
          detail: settingsWithDefaults 
        }));
      } else {
        const errorData = await response.json().catch(() => ({}));
        setSaveError(errorData.message || 'Failed to save settings. Please try again.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveError('Network error. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, notifyListeners]);

  // Auto-save with debouncing for specific settings
  const debouncedSave = useCallback((updates: Partial<UserSettings>) => {
    updateSettings(updates);
    
    // Auto-save theme and dark mode changes
    const autoSaveKeys = ['theme', 'dark_mode'];
    const shouldAutoSave = Object.keys(updates).some(key => autoSaveKeys.includes(key));
    
    if (shouldAutoSave) {
      if (saveSettingsRef.current) {
        clearTimeout(saveSettingsRef.current);
      }
      
      saveSettingsRef.current = setTimeout(() => {
        saveSettings();
      }, 500); // 500ms debounce
    }
  }, [updateSettings, saveSettings]);

  // Reset to original settings
  const resetToOriginal = useCallback(() => {
    if (settingsInstance.originalSettings) {
      settingsInstance.settings = { ...settingsInstance.originalSettings };
      notifyListeners();
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [notifyListeners]);

  // Refresh settings from API
  const refreshSettings = useCallback(async () => {
    settingsInstance.isLoaded = false;
    await loadSettings();
  }, [loadSettings]);

  // Calculate unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!settings || !originalSettings) return false;
    
    return Object.keys(settings).some(key => 
      settings[key as keyof UserSettings] !== originalSettings[key as keyof UserSettings]
    );
  }, [settings, originalSettings]);

  // Auto-clear success/error messages
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  useEffect(() => {
    if (saveError) {
      const timer = setTimeout(() => setSaveError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveError]);

  return {
    settings,
    originalSettings,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    saveSuccess,
    saveError,
    updateSettings: updateSettings,
    saveSettings,
    resetToOriginal,
    refreshSettings
  };
};

// Export a function to get current settings synchronously (useful for theme context)
export const getCurrentSettings = (): UserSettings | null => {
  return settingsInstance.settings;
};

// Export a function to check if settings are loaded
export const areSettingsLoaded = (): boolean => {
  return settingsInstance.isLoaded;
};