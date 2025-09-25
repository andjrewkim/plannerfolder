import { useState, useEffect, useCallback } from 'react';

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  showOnboarding: boolean;
  isFirstTimeUser: boolean;
}

interface OnboardingActions {
  startOnboarding: () => void;
  completeOnboarding: () => void;
  skipOnboarding: () => void;
  resetOnboarding: () => void;
  checkOnboardingStatus: () => boolean;
}

export const useOnboarding = (): OnboardingState & OnboardingActions => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);

  // Check onboarding status on mount
  useEffect(() => {
    const checkOnboardingStatus = () => {
      if (typeof window === 'undefined') return false;
      
      const completed = localStorage.getItem('onboardingCompleted') === 'true';
      const hasUsedApp = localStorage.getItem('hasUsedApp') === 'true';
      
      setHasCompletedOnboarding(completed);
      setIsFirstTimeUser(!hasUsedApp);
      
      // Mark that the user has now used the app
      if (!hasUsedApp) {
        localStorage.setItem('hasUsedApp', 'true');
      }
      
      return completed;
    };

    checkOnboardingStatus();
  }, []);

  const startOnboarding = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  const completeOnboarding = useCallback(() => {
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboardingCompleted', 'true');
    }
  }, []);

  const skipOnboarding = useCallback(() => {
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboardingCompleted', 'true');
    }
  }, []);

  const resetOnboarding = useCallback(() => {
    setHasCompletedOnboarding(false);
    setShowOnboarding(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('onboardingCompleted');
    }
  }, []);

  const checkOnboardingStatus = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('onboardingCompleted') === 'true';
  }, []);

  return {
    hasCompletedOnboarding,
    showOnboarding,
    isFirstTimeUser,
    startOnboarding,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding,
    checkOnboardingStatus
  };
};