import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI } from '../../lib/auth';
import { useUserSettings } from '../hooks/useUserSettings';


// Theme definition with separate light and dark variants
type Theme = {
  id: string;
  name: string;
  colors: string[]; // For preview
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
      primary: '222.2 47.4% 30.2%',
      secondary: '210 40% 96.1%',
      accent: '210 40% 96.1%',
      background: '0 0% 90%',
      mainBackground: '0 0% 90%',
      calendarBackground: '0 0% 100%',
      foreground: '222.2 47.4% 11.2%',
      muted: '210 40% 98.1%',
      mutedForeground: '215.4 16.3% 46.9%',
      darkerBorder: '214.3 15.8% 40.4%',
      border: '214.3 15.8% 50.4%',
      input: '214.3 31.8% 91.4%',
      ring: '222.2 47.4% 11.2%',
      chart1: '12 76% 61%',
      chart2: '173 58% 39%',
      chart3: '197 37% 24%',
      chart4: '43 74% 66%',
      chart5: '27 87% 67%',
      // Custom colors for light mode
      sidebar: '210 5% 95%',
      sidebarItemColor: '210 40% 100%',
      header: '0 0% 100%',
      card: '0 0% 100%',
      button: '222.2 47.4% 11.2%',
      link: '221.2 83.2% 53.3%',
    },
    dark: {
      primary: '220 15% 85%',           // Light grayish text for contrast
      secondary: '220 10% 30%',         // Darker but subtle section bg
      accent: '217 100% 68%',           // Calmer blue for accents
      background: '222 10% %',         // Near-black with a hint of blue
      calendarBackground: '0 0% 0%',   // ACTUALLY SIDEBAR BACKGEROUND
      foreground: '220 10% 85%',        // Matches primary text
      muted: '220 8% 18%',              // Soft background elements
      mutedForeground: '220 10% 55%',   // Muted text (descriptions, placeholders)
      darkerBorder: '220 8% 20%',             // Subtle borders
      border: '220 10% 40%',             // Slightly lighter than background
      
      input: '220 10% 15%',             // Input field bg
      ring: '217 100% 68%',             // Accent color for focus rings

      chart1: '12 70% 55%',             // Warm orange-red
      chart2: '160 50% 45%',            // Teal-green
      chart3: '200 40% 50%',            // Steel blue
      chart4: '45 90% 60%',             // Golden yellow
      chart5: '30 80% 60%',             // Soft orange

      mainBackground: '222 12% 9%',
      sidebarItemColor: '222 10% 18%',

      sidebar: '220 10% 10%',           // Slightly lighter than bg
      header: '222 50% 5%',             // Very dark header
      card: '220 12% 14%',              // Lighter than background
      button: '217 100% 68%',           // Matches accent
      link: '217 100% 75%',             // Brighter link color
    }
  },
  {
    id: 'emerald',
    name: 'Emerald',
    colors: ['#10b981', '#047857'],
    light: {
      primary: '142 72% 29%',
      secondary: '142 40% 96.1%',
      accent: '142 40% 96.1%',
      background: '0 0% 90%',
      mainBackground: '0 0% 90%',
      calendarBackground: '0 0% 100%',
      foreground: '142 72% 11.2%',
      muted: '142 40% 98.1%',
      mutedForeground: '145 16.3% 46.9%',
      darkerBorder: '144 15.8% 40.4%',
      border: '144 15.8% 50.4%',
      input: '144 31.8% 91.4%',
      ring: '142 72% 11.2%',
      chart1: '12 76% 61%',
      chart2: '173 58% 39%',
      chart3: '197 37% 24%',
      chart4: '43 74% 66%',
      chart5: '27 87% 67%',
      // Custom colors for light mode
      sidebar: '142 5% 95%',
      sidebarItemColor: '142 40% 100%',
      header: '0 0% 100%',
      card: '0 0% 100%',
      button: '142 72% 11.2%',
      link: '142 83.2% 53.3%',
    },
    dark: {
      primary: '150 15% 85%',           // Light grayish text for contrast
      secondary: '150 10% 30%',         // Darker but subtle section bg
      accent: '147 100% 68%',           // Calmer emerald for accents
      background: '152 10% %',         // Near-black with a hint of emerald
      calendarBackground: '0 0% 0%',   // ACTUALLY SIDEBAR BACKGEROUND
      foreground: '150 10% 85%',        // Matches primary text
      muted: '150 8% 18%',              // Soft background elements
      mutedForeground: '150 10% 55%',   // Muted text (descriptions, placeholders)
      darkerBorder: '150 8% 20%',             // Subtle borders
      border: '150 10% 40%',             // Slightly lighter than background
      
      input: '150 10% 15%',             // Input field bg
      ring: '147 100% 68%',             // Accent color for focus rings

      chart1: '12 70% 55%',             // Warm orange-red
      chart2: '160 50% 45%',            // Teal-green
      chart3: '200 40% 50%',            // Steel blue
      chart4: '45 90% 60%',             // Golden yellow
      chart5: '30 80% 60%',             // Soft orange

      mainBackground: '152 20% 7%',
      sidebarItemColor: '152 10% 18%',

      sidebar: '150 10% 10%',           // Slightly lighter than bg
      header: '152 50% 5%',             // Very dark header
      card: '150 12% 14%',              // Lighter than background
      button: '147 100% 68%',           // Matches accent
      link: '147 100% 75%',             // Brighter link color
    }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: ['#0ea5e9', '#0369a1'],
    light: {
      primary: '199 89% 30.2%',
      secondary: '199 40% 96.1%',
      accent: '199 40% 96.1%',
      background: '0 0% 90%',
      mainBackground: '0 0% 90%',
      calendarBackground: '0 0% 100%',
      foreground: '199 89% 11.2%',
      muted: '199 40% 98.1%',
      mutedForeground: '199 16.3% 46.9%',
      darkerBorder: '199 15.8% 40.4%',
      border: '199 15.8% 50.4%',
      input: '199 31.8% 91.4%',
      ring: '199 89% 11.2%',
      chart1: '12 76% 61%',
      chart2: '173 58% 39%',
      chart3: '197 37% 24%',
      chart4: '43 74% 66%',
      chart5: '27 87% 67%',
      // Custom colors for light mode
      sidebar: '199 5% 95%',
      sidebarItemColor: '199 0% 100%',
      header: '0 0% 100%',
      card: '0 0% 100%',
      button: '199 89% 11.2%',
      link: '199 83.2% 53.3%',
    },
    dark: {
      primary: '200 15% 85%',           // Light grayish text for contrast
      secondary: '200 10% 30%',         // Darker but subtle section bg
      accent: '199 100% 68%',           // Calmer ocean for accents
      background: '200 10% %',         // Near-black with a hint of ocean
      calendarBackground: '0 0% 0%',   // ACTUALLY SIDEBAR BACKGEROUND
      foreground: '200 10% 85%',        // Matches primary text
      muted: '200 8% 18%',              // Soft background elements
      mutedForeground: '200 10% 55%',   // Muted text (descriptions, placeholders)
      darkerBorder: '200 8% 20%',             // Subtle borders
      border: '200 10% 40%',             // Slightly lighter than background
      
      input: '200 10% 15%',             // Input field bg
      ring: '199 100% 68%',             // Accent color for focus rings

      chart1: '12 70% 55%',             // Warm orange-red
      chart2: '160 50% 45%',            // Teal-green
      chart3: '200 40% 50%',            // Steel blue
      chart4: '45 90% 60%',             // Golden yellow
      chart5: '30 80% 60%',             // Soft orange

      mainBackground: '200 20% 7%',
      sidebarItemColor: '200 10% 18%',

      sidebar: '200 10% 10%',           // Slightly lighter than bg
      header: '200 50% 5%',             // Very dark header
      card: '200 12% 14%',              // Lighter than background
      button: '199 100% 68%',           // Matches accent
      link: '199 100% 75%',             // Brighter link color
    }
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: ['#f97316', '#c2410c'],
    light: {
      primary: '24 95% 30.2%',
      secondary: '24 40% 96.1%',
      accent: '24 40% 96.1%',
      background: '0 0% 90%',
      mainBackground: '0 0% 90%',
      calendarBackground: '0 0% 100%',
      foreground: '24 95% 11.2%',
      muted: '24 40% 98.1%',
      mutedForeground: '24 16.3% 46.9%',
      darkerBorder: '24 15.8% 40.4%',
      border: '24 15.8% 50.4%',
      input: '24 31.8% 91.4%',
      ring: '24 95% 11.2%',
      chart1: '12 76% 61%',
      chart2: '173 58% 39%',
      chart3: '197 37% 24%',
      chart4: '43 74% 66%',
      chart5: '27 87% 67%',
      // Custom colors for light mode
      sidebar: '24 5% 95%',
      sidebarItemColor: '24 40% 100%',
      header: '0 0% 100%',
      card: '0 0% 100%',
      button: '24 95% 11.2%',
      link: '24 83.2% 53.3%',
    },
    dark: {
      primary: '25 15% 85%',           // Light grayish text for contrast
      secondary: '25 10% 30%',         // Darker but subtle section bg
      accent: '24 100% 68%',           // Calmer sunset for accents
      background: '25 10% %',         // Near-black with a hint of sunset
      calendarBackground: '0 0% 0%',   // ACTUALLY SIDEBAR BACKGEROUND
      foreground: '25 10% 85%',        // Matches primary text
      muted: '25 8% 18%',              // Soft background elements
      mutedForeground: '25 10% 55%',   // Muted text (descriptions, placeholders)
      darkerBorder: '25 8% 20%',             // Subtle borders
      border: '25 10% 40%',             // Slightly lighter than background
      
      input: '25 10% 15%',             // Input field bg
      ring: '24 100% 68%',             // Accent color for focus rings

      chart1: '12 70% 55%',             // Warm orange-red
      chart2: '160 50% 45%',            // Teal-green
      chart3: '200 40% 50%',            // Steel blue
      chart4: '45 90% 60%',             // Golden yellow
      chart5: '30 80% 60%',             // Soft orange

      mainBackground: '25 20% 7%',
      sidebarItemColor: '25 10% 18%',

      sidebar: '25 10% 10%',           // Slightly lighter than bg
      header: '25 50% 5%',             // Very dark header
      card: '25 12% 14%',              // Lighter than background
      button: '24 100% 68%',           // Matches accent
      link: '24 100% 75%',             // Brighter link color
    }
  },
  {
    id: 'royal',
    name: 'Royal',
    colors: ['#7c3aed', '#5b21b6'],
    light: {
      primary: '265 93% 30.2%',
      secondary: '265 40% 96.1%',
      accent: '265 40% 96.1%',
      background: '0 0% 90%',
      mainBackground: '0 0% 90%',
      calendarBackground: '0 0% 100%',
      foreground: '265 93% 11.2%',
      muted: '265 40% 98.1%',
      mutedForeground: '265 16.3% 46.9%',
      darkerBorder: '265 15.8% 40.4%',
      border: '265 15.8% 50.4%',
      input: '265 31.8% 91.4%',
      ring: '265 93% 11.2%',
      chart1: '12 76% 61%',
      chart2: '173 58% 39%',
      chart3: '197 37% 24%',
      chart4: '43 74% 66%',
      chart5: '27 87% 67%',
      // Custom colors for light mode
      sidebar: '265 5% 95%',
      sidebarItemColor: '265 40% 100%',
      header: '0 0% 100%',
      card: '0 0% 100%',
      button: '265 93% 11.2%',
      link: '265 83.2% 53.3%',
    },
    dark: {
      primary: '265 15% 85%',           // Light grayish text for contrast
      secondary: '265 10% 30%',         // Darker but subtle section bg
      accent: '265 100% 68%',           // Calmer royal for accents
      background: '265 10% %',         // Near-black with a hint of royal
      calendarBackground: '0 0% 0%',   // ACTUALLY SIDEBAR BACKGEROUND
      foreground: '265 10% 85%',        // Matches primary text
      muted: '265 8% 18%',              // Soft background elements
      mutedForeground: '265 10% 55%',   // Muted text (descriptions, placeholders)
      darkerBorder: '265 8% 20%',             // Subtle borders
      border: '265 10% 60%',             // Slightly lighter than background
      
      input: '265 10% 15%',             // Input field bg
      ring: '265 100% 68%',             // Accent color for focus rings

      chart1: '12 70% 55%',             // Warm orange-red
      chart2: '160 50% 45%',            // Teal-green
      chart3: '200 40% 50%',            // Steel blue
      chart4: '45 90% 60%',             // Golden yellow
      chart5: '30 80% 60%',             // Soft orange

      mainBackground: '265 20% 7%',
      sidebarItemColor: '265 10% 18%',

      sidebar: '265 10% 10%',           // Slightly lighter than bg
      header: '265 50% 5%',             // Very dark header
      card: '265 12% 14%',              // Lighter than background
      button: '265 100% 68%',           // Matches accent
      link: '265 100% 75%',             // Brighter link color
    }
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    colors: ['#6b7280', '#374151'],
    light: {
      primary: '0 0% 30.2%',
      secondary: '0 40% 96.1%',
      accent: '0 40% 96.1%',
      background: '0 0% 90%',
      mainBackground: '0 0% 90%',
      calendarBackground: '0 0% 100%',
      foreground: '0 0% 11.2%',
      muted: '0 40% 98.1%',
      mutedForeground: '0 16.3% 46.9%',
      darkerBorder: '0 15.8% 40.4%',
      border: '0 15.8% 50.4%',
      input: '0 31.8% 91.4%',
      ring: '0 0% 11.2%',
      chart1: '12 76% 61%',
      chart2: '173 58% 39%',
      chart3: '197 37% 24%',
      chart4: '43 74% 66%',
      chart5: '27 87% 67%',
      // Custom colors for light mode
      sidebar: '0 5% 95%',
      sidebarItemColor: '0 40% 100%',
      header: '0 0% 100%',
      card: '0 0% 100%',
      button: '0 0% 11.2%',
      link: '0 83.2% 53.3%',
    },
    dark: {
      primary: '0 15% 85%',           // Light grayish text for contrast
      secondary: '0 10% 30%',         // Darker but subtle section bg
      accent: '0 100% 68%',           // Calmer monochrome for accents
      background: '0 10% %',         // Near-black with a hint of monochrome
      calendarBackground: '0 0% 0%',   // ACTUALLY SIDEBAR BACKGEROUND
      foreground: '0 10% 85%',        // Matches primary text
      muted: '0 8% 18%',              // Soft background elements
      mutedForeground: '0 10% 55%',   // Muted text (descriptions, placeholders)
      darkerBorder: '0 8% 20%',             // Subtle borders
      border: '0 10% 60%',             // Slightly lighter than background
      
      input: '0 10% 15%',             // Input field bg
      ring: '0 100% 68%',             // Accent color for focus rings

      chart1: '12 70% 55%',             // Warm orange-red
      chart2: '160 50% 45%',            // Teal-green
      chart3: '200 40% 50%',            // Steel blue
      chart4: '45 90% 60%',             // Golden yellow
      chart5: '30 80% 60%',             // Soft orange

      mainBackground: '0 20% 7%',
      sidebarItemColor: '0 10% 18%',

      sidebar: '0 10% 10%',           // Slightly lighter than bg
      header: '0 50% 5%',             // Very dark header
      card: '0 12% 14%',              // Lighter than background
      button: '0 100% 68%',           // Matches accent
      link: '0 100% 75%',             // Brighter link color
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
  
  // Get current theme and dark mode from settings
  const currentTheme = themes.find(t => t.id === settings?.theme) || themes[0];
  const isDarkMode = settings?.dark_mode ?? true;

  // Theme setter that updates settings
  const setTheme = useCallback((themeId: string) => {
    updateSettings({ theme: themeId });
  }, [updateSettings]);

  // Dark mode toggle that updates settings
  const toggleDarkMode = useCallback(() => {
    updateSettings({ dark_mode: !isDarkMode });
  }, [updateSettings, isDarkMode]);

  // Apply theme to CSS variables
  useEffect(() => {
    if (!settings) return;
    
    const root = document.documentElement;
    
    // Toggle dark class
    root.classList.toggle('dark', isDarkMode);
    
    // Get the appropriate theme variant
    const variables = isDarkMode ? currentTheme.dark : currentTheme.light;

    // Apply CSS variables
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
    };
    
    Object.entries(cssVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Apply background color to body
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