import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useUserSettings } from '../hooks/useUserSettings';

type Theme = {
  id: string;
  name: string;
  colors: string[];
  light: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    calendarBackground: string;
    mainBackground: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    darkerBorder: string;
    border: string;
    input: string;
    ring: string;
    chart1: string;
    chart2: string;
    chart3: string;
    chart4: string;
    chart5: string;
    sidebarItemColor: string;
    realsidebar: string;
    sidebar: string;
    header: string;
    card: string;
    button: string;
    link: string;
  };
  dark: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    calendarBackground: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    darkerBorder: string;
    border: string;
    input: string;
    ring: string;
    chart1: string;
    chart2: string;
    chart3: string;
    chart4: string;
    chart5: string;
    mainBackground: string;
    sidebarItemColor: string;
    realsidebar: string;
    sidebar: string;
    header: string;
    card: string;
    button: string;
    link: string;
  };
};

export const themes: Theme[] = [
  {
    id: 'classic',
    name: 'Classic',
    colors: ['#3b82f6', '#1e40af'],
    light: {
      primary: '220 15% 15%',
      secondary: '220 10% 70%',
      accent: '217 50% 32%',
      background: '220 8% 84%',
      calendarBackground: '0 0% 95%',
      mainBackground: '222 8% 90%',
      foreground: '220 10% 15%',
      muted: '220 8% 82%',
      mutedForeground: '220 10% 45%',
      darkerBorder: '220 8% 84%',
      border: '220 10% 45%',
      input: '220 10% 85%',
      ring: '217 100% 32%',
      chart1: '12 70% 55%',
      chart2: '160 50% 45%',
      chart3: '200 40% 50%',
      chart4: '45 90% 60%',
      chart5: '30 80% 60%',
      sidebarItemColor: '222 10% 82%',
      realsidebar: '220 10% 93%',
      sidebar: '220 10% 93%',
      header: '222 50% 95%',
      card: '220 12% 86%',
      button: '217 100% 32%',
      link: '217 100% 25%',
    },
    dark: {
      primary: '220 15% 85%',
      secondary: '220 10% 30%',
      accent: '217 50% 68%',
      background: '222 10% 8%',
      calendarBackground: '0 0% 5%',
      foreground: '220 10% 85%',
      muted: '220 8% 18%',
      mutedForeground: '220 10% 55%',
      darkerBorder: '220 8% 19%',
      border: '220 10% 50%',
      input: '220 10% 15%',
      ring: '217 100% 68%',
      chart1: '12 70% 55%',
      chart2: '160 50% 45%',
      chart3: '200 40% 50%',
      chart4: '45 90% 60%',
      chart5: '30 80% 60%',
      mainBackground: '222 8% 10%',
      sidebarItemColor: '222 10% 18%',
      realsidebar: '220 10% 8%',
      sidebar: '220 10% 7%',
      header: '222 50% 5%',
      card: '220 12% 14%',
      button: '217 100% 68%',
      link: '217 100% 75%',
    }
  },
  {
    id: 'emerald',
    name: 'Emerald',
    colors: ['#10b981', '#047857'],
    light: {
      primary: '220 15% 15%',
      secondary: '220 10% 70%',
      accent: '147 50% 45%',
      background: '220 8% 84%',
      calendarBackground: '0 0% 95%',
      mainBackground: '222 8% 90%',
      foreground: '220 10% 15%',
      muted: '220 8% 82%',
      mutedForeground: '220 10% 45%',
      darkerBorder: '220 8% 84%',
      border: '220 10% 45%',
      input: '220 10% 85%',
      ring: '147 50% 45%',
      chart1: '12 70% 55%',
      chart2: '160 50% 45%',
      chart3: '200 40% 50%',
      chart4: '45 90% 60%',
      chart5: '30 80% 60%',
      sidebarItemColor: '222 10% 82%',
      realsidebar: '220 10% 93%',
      sidebar: '220 10% 93%',
      header: '222 50% 95%',
      card: '220 12% 86%',
      button: '147 50% 45%',
      link: '147 70% 35%',
    },
    dark: {
      primary: '150 15% 85%',
      secondary: '150 10% 30%',
      accent: '147 100% 68%',
      background: '152 10% 8%',
      calendarBackground: '0 0% 5%',
      foreground: '150 10% 85%',
      muted: '150 8% 18%',
      mutedForeground: '150 10% 55%',
      darkerBorder: '150 8% 16%',
      border: '150 10% 40%',
      input: '150 10% 15%',
      ring: '147 100% 68%',
      chart1: '12 70% 55%',
      chart2: '160 50% 45%',
      chart3: '200 40% 50%',
      chart4: '45 90% 60%',
      chart5: '30 80% 60%',
      mainBackground: '152 8% 10%',
      sidebarItemColor: '152 10% 18%',
      realsidebar: '150 10% 8%',
      sidebar: '150 10% 7%',
      header: '152 50% 5%',
      card: '150 12% 14%',
      button: '147 100% 68%',
      link: '147 100% 75%',
    }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: ['#0ea5e9', '#0369a1'],
    light: {
      primary: '220 15% 15%',
      secondary: '220 10% 70%',
      accent: '199 50% 45%',
      background: '220 8% 84%',
      calendarBackground: '0 0% 95%',
      mainBackground: '222 8% 90%',
      foreground: '220 10% 15%',
      muted: '220 8% 82%',
      mutedForeground: '220 10% 45%',
      darkerBorder: '220 8% 84%',
      border: '220 10% 45%',
      input: '220 10% 85%',
      ring: '199 50% 45%',
      chart1: '12 70% 55%',
      chart2: '160 50% 45%',
      chart3: '200 40% 50%',
      chart4: '45 90% 60%',
      chart5: '30 80% 60%',
      sidebarItemColor: '222 10% 82%',
      realsidebar: '220 10% 93%',
      sidebar: '220 10% 93%',
      header: '222 50% 95%',
      card: '220 12% 86%',
      button: '199 50% 45%',
      link: '199 70% 35%',
    },
    dark: {
      primary: '200 15% 85%',
      secondary: '200 10% 30%',
      accent: '199 100% 68%',
      background: '200 10% 8%',
      calendarBackground: '0 0% 5%',
      foreground: '200 10% 85%',
      muted: '200 8% 18%',
      mutedForeground: '200 10% 55%',
      darkerBorder: '200 8% 16%',
      border: '200 10% 40%',
      input: '200 10% 15%',
      ring: '199 100% 68%',
      chart1: '12 70% 55%',
      chart2: '160 50% 45%',
      chart3: '200 40% 50%',
      chart4: '45 90% 60%',
      chart5: '30 80% 60%',
      mainBackground: '200 8% 10%',
      sidebarItemColor: '200 10% 18%',
      realsidebar: '200 10% 8%',
      sidebar: '200 10% 7%',
      header: '200 50% 5%',
      card: '200 12% 14%',
      button: '199 100% 68%',
      link: '199 100% 75%',
    }
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: ['#f97316', '#c2410c'],
    light: {
      primary: '220 15% 15%',
      secondary: '220 10% 70%',
      accent: '24 50% 45%',
      background: '220 8% 84%',
      calendarBackground: '0 0% 95%',
      mainBackground: '222 8% 90%',
      foreground: '220 10% 15%',
      muted: '220 8% 82%',
      mutedForeground: '220 10% 45%',
      darkerBorder: '220 8% 84%',
      border: '220 10% 45%',
      input: '220 10% 85%',
      ring: '24 50% 45%',
      chart1: '12 70% 55%',
      chart2: '160 50% 45%',
      chart3: '200 40% 50%',
      chart4: '45 90% 60%',
      chart5: '30 80% 60%',
      sidebarItemColor: '222 10% 82%',
      realsidebar: '220 10% 93%',
      sidebar: '220 10% 93%',
      header: '222 50% 95%',
      card: '220 12% 86%',
      button: '24 50% 45%',
      link: '24 70% 35%',
    },
    dark: {
      primary: '25 15% 85%',
      secondary: '25 10% 30%',
      accent: '24 100% 68%',
      background: '25 10% 8%',
      calendarBackground: '0 0% 5%',
      foreground: '25 10% 85%',
      muted: '25 8% 18%',
      mutedForeground: '25 10% 55%',
      darkerBorder: '25 8% 16%',
      border: '25 10% 40%',
      input: '25 10% 15%',
      ring: '24 100% 68%',
      chart1: '12 70% 55%',
      chart2: '160 50% 45%',
      chart3: '200 40% 50%',
      chart4: '45 90% 60%',
      chart5: '30 80% 60%',
      mainBackground: '25 8% 10%',
      sidebarItemColor: '25 10% 18%',
      realsidebar: '25 10% 8%',
      sidebar: '25 10% 7%',
      header: '25 50% 5%',
      card: '25 12% 14%',
      button: '24 100% 68%',
      link: '24 100% 75%',
    }
  },
  {
    id: 'royal',
    name: 'Royal',
    colors: ['#7c3aed', '#5b21b6'],
    light: {
      primary: '220 15% 15%',
      secondary: '220 10% 70%',
      accent: '265 50% 45%',
      background: '220 8% 84%',
      calendarBackground: '0 0% 95%',
      mainBackground: '222 8% 90%',
      foreground: '220 10% 15%',
      muted: '220 8% 82%',
      mutedForeground: '220 10% 45%',
      darkerBorder: '220 8% 84%',
      border: '220 10% 45%',
      input: '220 10% 85%',
      ring: '265 50% 45%',
      chart1: '12 70% 55%',
      chart2: '160 50% 45%',
      chart3: '200 40% 50%',
      chart4: '45 90% 60%',
      chart5: '30 80% 60%',
      sidebarItemColor: '222 10% 82%',
      realsidebar: '220 10% 93%',
      sidebar: '220 10% 93%',
      header: '222 50% 95%',
      card: '220 12% 86%',
      button: '265 50% 45%',
      link: '265 70% 35%',
    },
    dark: {
      primary: '265 15% 85%',
      secondary: '265 10% 30%',
      accent: '265 100% 68%',
      background: '265 10% 8%',
      calendarBackground: '0 0% 5%',
      foreground: '265 10% 85%',
      muted: '265 8% 18%',
      mutedForeground: '265 10% 55%',
      darkerBorder: '265 8% 16%',
      border: '265 10% 40%',
      input: '265 10% 15%',
      ring: '265 100% 68%',
      chart1: '12 70% 55%',
      chart2: '160 50% 45%',
      chart3: '200 40% 50%',
      chart4: '45 90% 60%',
      chart5: '30 80% 60%',
      mainBackground: '265 8% 10%',
      sidebarItemColor: '265 10% 18%',
      realsidebar: '265 10% 8%',
      sidebar: '265 10% 7%',
      header: '265 50% 5%',
      card: '265 12% 14%',
      button: '265 100% 68%',
      link: '265 100% 75%',
    }
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    colors: ['#6b7280', '#374151'],
    light: {
      primary: '220 15% 15%',
      secondary: '220 10% 70%',
      accent: '0 50% 45%',
      background: '220 8% 84%',
      calendarBackground: '0 0% 95%',
      mainBackground: '222 8% 90%',
      foreground: '220 10% 15%',
      muted: '220 8% 82%',
      mutedForeground: '220 10% 45%',
      darkerBorder: '220 8% 84%',
      border: '220 10% 45%',
      input: '220 10% 85%',
      ring: '0 50% 45%',
      chart1: '12 70% 55%',
      chart2: '160 50% 45%',
      chart3: '200 40% 50%',
      chart4: '45 90% 60%',
      chart5: '30 80% 60%',
      sidebarItemColor: '222 10% 82%',
      realsidebar: '220 10% 93%',
      sidebar: '220 10% 93%',
      header: '222 50% 95%',
      card: '220 12% 86%',
      button: '0 50% 45%',
      link: '0 70% 35%',
    },
    dark: {
      primary: '0 15% 85%',
      secondary: '0 10% 30%',
      accent: '0 100% 68%',
      background: '0 10% 8%',
      calendarBackground: '0 0% 5%',
      foreground: '0 10% 85%',
      muted: '0 8% 18%',
      mutedForeground: '0 10% 55%',
      darkerBorder: '0 8% 16%',
      border: '0 10% 40%',
      input: '0 10% 15%',
      ring: '0 100% 68%',
      chart1: '12 70% 55%',
      chart2: '160 50% 45%',
      chart3: '200 40% 50%',
      chart4: '45 90% 60%',
      chart5: '30 80% 60%',
      mainBackground: '0 8% 10%',
      sidebarItemColor: '0 10% 18%',
      realsidebar: '0 10% 8%',
      sidebar: '0 10% 7%',
      header: '0 50% 5%',
      card: '0 12% 14%',
      button: '0 100% 68%',
      link: '0 100% 75%',
    }
  },
];

type ThemeContextType = {
  currentTheme: Theme;
  setTheme: (themeId: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isLoading: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { settings, updateSettings, isLoading } = useUserSettings();
  
  const currentTheme = themes.find(t => t.id === settings?.theme) || themes[0];
  const isDarkMode = settings?.dark_mode ?? true;

  const setTheme = useCallback((themeId: string) => {
    updateSettings({ theme: themeId });
  }, [updateSettings]);

  const toggleDarkMode = useCallback(() => {
    updateSettings({ dark_mode: !isDarkMode });
  }, [updateSettings, isDarkMode]);

  useEffect(() => {
    if (!settings) return;
    
    const root = document.documentElement;
    
    root.classList.toggle('dark', isDarkMode);
    
    const variables = isDarkMode ? currentTheme.dark : currentTheme.light;

    const cssVariables = {
      '--primary': variables.primary,
      '--primary-foreground': isDarkMode ? variables.background : '210 40% 98%',
      '--secondary': variables.secondary,
      '--secondary-foreground': variables.foreground,
      '--accent': variables.accent,
      '--accent-foreground': variables.foreground,
      '--background': variables.background,
      '--calendar-background': variables.calendarBackground,
      '--foreground': variables.foreground,
      '--muted': variables.muted,
      '--muted-foreground': variables.mutedForeground,
      '--border': variables.border,
      '--darker-border': variables.darkerBorder,
      '--input': variables.input,
      '--ring': variables.ring,
      '--card': variables.background,
      '--card-foreground': variables.foreground,
      '--popover': variables.background,
      '--popover-foreground': variables.foreground,
      '--destructive': isDarkMode ? '0 62.8% 50.6%' : '0 62.8% 30.6%',
      '--destructive-foreground': isDarkMode ? '0 85.7% 97.3%' : '210 40% 98%',
      '--chart-1': variables.chart1,
      '--chart-2': variables.chart2,
      '--chart-3': variables.chart3,
      '--chart-4': variables.chart4,
      '--chart-5': variables.chart5,
      '--sidebar': variables.sidebar,
      '--header': variables.header,
      '--card-custom': variables.card,
      '--button-custom': variables.button,
      '--link-custom': variables.link,
      '--sidebar-item-color': variables.sidebarItemColor,
      '--real-sidebar': variables.realsidebar
    };
    
    Object.entries(cssVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    document.body.style.backgroundColor = `hsl(${variables.mainBackground})`;
    document.body.style.color = `hsl(${variables.foreground})`;
    
  }, [currentTheme, isDarkMode, settings]);

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