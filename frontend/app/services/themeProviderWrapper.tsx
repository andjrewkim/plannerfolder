'use client';
import React, { createContext, useContext } from 'react';
import { ThemeProvider as ThemeContextProvider } from '../services/themeContext';

// Create a context to track if a ThemeProvider is already present
const ThemeProviderContext = createContext(false);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // Check if we're already inside a ThemeProvider
  const hasThemeProvider = useContext(ThemeProviderContext);
  
  if (hasThemeProvider) {
    // If we already have a ThemeProvider up the tree, just render children
    return <>{children}</>;
  } else {
    // If not, create a new ThemeProvider and mark that we have one
    return (
      <ThemeProviderContext.Provider value={true}>
        <ThemeContextProvider>{children}</ThemeContextProvider>
      </ThemeProviderContext.Provider>
    );
  }
};