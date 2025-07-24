import React, { createContext, useState, useContext, useEffect } from 'react';

import { authAPI } from '../../lib/auth';

// Define the theme type with HSL values
type Theme = {
  id: string;
  name: string;
  colors: string[]; // For the preview
  variables: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    chart1: string;
    chart2: string;
    chart3: string;
    chart4: string;
    chart5: string;
    // Add other variables as needed
  };
  darkVariables?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    chart1?: string;
    chart2?: string;
    chart3?: string;
    chart4?: string;
    chart5?: string;
  };
};

// Define themes with HSL values
export const themes: Theme[] = [
  {
    id: 'classic',
    name: 'Classic',
    colors: ['#f8fafc', '#64748b'],
    variables: {
      primary: '222.2 47.4% 11.2%',
      secondary: '210 40% 96.1%',
      accent: '210 40% 96.1%',
      background: '0 0% 100%',
      chart1: '12 76% 61%',
      chart2: '173 58% 39%',
      chart3: '197 37% 24%',
      chart4: '43 74% 66%',
      chart5: '27 87% 67%',
    },
    darkVariables: {
      primary: '210 40% 98%',
      secondary: '217.2 32.6% 17.5%',
      accent: '217.2 32.6% 17.5%',
      chart1: '220 70% 50%',
      chart2: '160 60% 45%',
      chart3: '30 80% 55%',
      chart4: '280 65% 60%',
      chart5: '340 75% 55%',
    }
  },
  {
    id: 'emerald',
    name: 'Emerald',
    colors: ['#059669', '#065f46'],
    variables: {
      primary: '142 72% 29%',
      secondary: '142 72% 90%',
      accent: '142 50% 50%',
      background: '0 0% 100%',
      chart1: '142 70% 45%',
      chart2: '162 80% 40%',
      chart3: '122 50% 35%',
      chart4: '182 65% 45%',
      chart5: '102 65% 50%',
    },
    darkVariables: {
      primary: '142 72% 80%',
      secondary: '142 40% 20%',
      accent: '142 50% 40%',
      chart1: '142 70% 55%',
      chart2: '162 80% 50%',
      chart3: '122 50% 45%',
      chart4: '182 65% 55%',
      chart5: '102 65% 60%',
    }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: ['#0ea5e9', '#0369a1'],
    variables: {
      primary: '199 89% 48%',
      secondary: '199 89% 90%',
      accent: '199 89% 70%',
      background: '0 0% 100%',
      chart1: '199 80% 50%',
      chart2: '219 70% 55%',
      chart3: '179 70% 45%',
      chart4: '239 65% 60%',
      chart5: '159 65% 40%',
    },
    darkVariables: {
      primary: '199 89% 80%',
      secondary: '199 60% 20%',
      accent: '199 70% 40%',
      chart1: '199 80% 60%',
      chart2: '219 70% 65%',
      chart3: '179 70% 55%',
      chart4: '239 65% 70%',
      chart5: '159 65% 50%',
    }
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: ['#f97316', '#c2410c'],
    variables: {
      primary: '24 95% 53%',
      secondary: '24 95% 90%',
      accent: '24 95% 70%',
      background: '0 0% 100%',
      chart1: '24 90% 60%',
      chart2: '44 80% 55%',
      chart3: '4 80% 50%',
      chart4: '64 75% 65%',
      chart5: '354 75% 55%',
    },
    darkVariables: {
      primary: '24 95% 70%',
      secondary: '24 60% 20%',
      accent: '24 80% 40%',
      chart1: '24 90% 70%',
      chart2: '44 80% 65%',
      chart3: '4 80% 60%',
      chart4: '64 75% 75%',
      chart5: '354 75% 65%',
    }
  },
  {
    id: 'royal',
    name: 'Royal',
    colors: ['#7c3aed', '#5b21b6'],
    variables: {
      primary: '265 93% 58%',
      secondary: '265 93% 90%',
      accent: '265 93% 75%',
      background: '0 0% 100%',
      chart1: '265 85% 60%',
      chart2: '285 75% 55%',
      chart3: '245 75% 50%',
      chart4: '305 70% 60%',
      chart5: '225 70% 55%',
    },
    darkVariables: {
      primary: '265 93% 70%',
      secondary: '265 60% 20%',
      accent: '265 75% 40%',
      chart1: '265 85% 70%',
      chart2: '285 75% 65%',
      chart3: '245 75% 60%',
      chart4: '305 70% 70%',
      chart5: '225 70% 65%',
    }
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    colors: ['#171717', '#404040'],
    variables: {
      primary: '0 0% 9%',
      secondary: '0 0% 90%',
      accent: '0 0% 70%',
      background: '0 0% 100%',
      chart1: '0 0% 20%',
      chart2: '0 0% 35%',
      chart3: '0 0% 50%',
      chart4: '0 0% 65%',
      chart5: '0 0% 80%',
    },
    darkVariables: {
      primary: '0 0% 90%',
      secondary: '0 0% 20%',
      accent: '0 0% 40%',
      chart1: '0 0% 75%',
      chart2: '0 0% 60%',
      chart3: '0 0% 45%',
      chart4: '0 0% 30%',
      chart5: '0 0% 15%',
    }
  },
];

type ThemeContextType = {
  currentTheme: Theme;
  setTheme: (themeId: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState('classic');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const currentTheme = themes.find(t => t.id === currentThemeId) || themes[0];

  // Fetch user settings from backend
  const fetchUserSettings = async () => {
    try {
      setIsLoading(true);
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/user-settings/`
      );
      
      if (response.ok) {
        const settings = await response.json();
        
        // Update theme settings from backend
        if (settings.theme) {
          setCurrentThemeId(settings.theme);
        }
        
        if (typeof settings.darkMode === 'boolean') {
          setIsDarkMode(settings.darkMode);
          
          // Apply dark mode class immediately
          if (settings.darkMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } else {
        // Fallback to default values if API call fails
        console.warn('Failed to fetch user settings, using defaults');
        setCurrentThemeId('classic');
        setIsDarkMode(false);
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      // Fallback to default values
      setCurrentThemeId('classic');
      setIsDarkMode(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Save settings to backend
  const saveUserSettings = async (themeId?: string, darkMode?: boolean) => {
    try {
      const settingsToUpdate: any = {};
      
      if (themeId !== undefined) {
        settingsToUpdate.theme = themeId;
      }
      
      if (darkMode !== undefined) {
        settingsToUpdate.darkMode = darkMode;
      }

      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/user-settings/`,
        {
          method: 'PATCH', // or PUT depending on your API
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settingsToUpdate),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save user settings');
      }
    } catch (error) {
      console.error('Error saving user settings:', error);
      // You might want to show a toast notification here
      throw error; // Re-throw to handle in the calling function
    }
  };

  const setTheme = async (themeId: string) => {
    try {
      // Optimistically update the UI
      setCurrentThemeId(themeId);
      
      // Save to backend
      await saveUserSettings(themeId, undefined);
    } catch (error) {
      // Revert on failure
      console.error('Failed to save theme:', error);
      // You might want to show an error message to the user
    }
  };

  const toggleDarkMode = async () => {
    const newMode = !isDarkMode;
    
    try {
      // Optimistically update the UI
      setIsDarkMode(newMode);
      
      // Toggle the dark class on the document
      if (newMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      // Save to backend
      await saveUserSettings(undefined, newMode);
    } catch (error) {
      // Revert on failure
      setIsDarkMode(!newMode);
      if (!newMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      console.error('Failed to save dark mode setting:', error);
      // You might want to show an error message to the user
    }
  };

  // Load settings on mount
  useEffect(() => {
    fetchUserSettings();
  }, []);

  // Apply theme colors to CSS variables
  useEffect(() => {
    if (isLoading) return; // Don't apply themes while loading
    
    const root = document.documentElement;
    
    // Set theme variables based on current mode
    if (isDarkMode && currentTheme.darkVariables) {
      // Apply dark mode variables from the theme
      root.style.setProperty('--primary', currentTheme.darkVariables.primary || currentTheme.variables.primary);
      root.style.setProperty('--secondary', currentTheme.darkVariables.secondary || currentTheme.variables.secondary);
      root.style.setProperty('--accent', currentTheme.darkVariables.accent || currentTheme.variables.accent);
      root.style.setProperty('--chart-1', currentTheme.darkVariables.chart1 || currentTheme.variables.chart1);
      root.style.setProperty('--chart-2', currentTheme.darkVariables.chart2 || currentTheme.variables.chart2);
      root.style.setProperty('--chart-3', currentTheme.darkVariables.chart3 || currentTheme.variables.chart3);
      root.style.setProperty('--chart-4', currentTheme.darkVariables.chart4 || currentTheme.variables.chart4);
      root.style.setProperty('--chart-5', currentTheme.darkVariables.chart5 || currentTheme.variables.chart5);
    } else {
      // Apply light mode variables
      root.style.setProperty('--primary', currentTheme.variables.primary);
      root.style.setProperty('--secondary', currentTheme.variables.secondary);
      root.style.setProperty('--accent', currentTheme.variables.accent);
      root.style.setProperty('--chart-1', currentTheme.variables.chart1);
      root.style.setProperty('--chart-2', currentTheme.variables.chart2);
      root.style.setProperty('--chart-3', currentTheme.variables.chart3);
      root.style.setProperty('--chart-4', currentTheme.variables.chart4);
      root.style.setProperty('--chart-5', currentTheme.variables.chart5);
    }
  }, [currentTheme, isDarkMode, isLoading]);

  return (
    <ThemeContext.Provider value={{ 
      currentTheme, 
      setTheme, 
      isDarkMode, 
      toggleDarkMode, 
      isLoading 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};