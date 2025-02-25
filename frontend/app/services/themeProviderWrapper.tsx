'use client';
import React from 'react';
import { ThemeProvider as ThemeContextProvider, useTheme } from '../services/themeContext';

// Create a wrapper component that checks if we already have a ThemeProvider
export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // Try to use the existing theme context
  try {
    useTheme();
    // If it succeeds, we're already inside a ThemeProvider
    return <>{children}</>;
  } catch (e) {
    // If it fails, we need to create a new ThemeProvider
    return <ThemeContextProvider>{children}</ThemeContextProvider>;
  }
};