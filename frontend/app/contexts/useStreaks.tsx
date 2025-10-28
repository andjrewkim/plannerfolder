import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI } from '../../lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface StreakData {
  currentStreak: number;
  maxStreak: number;
  assignmentsCompletedToday: number;
  totalAssignmentsToday: number;
  weekActivity: boolean[];
  isLit: boolean;
  lastUpdateDate: string | null;
}

const getDefaultStreakData = (): StreakData => ({
  currentStreak: 0,
  maxStreak: 7,
  assignmentsCompletedToday: 0,
  totalAssignmentsToday: 0,
  weekActivity: [false, false, false, false, false, false, false],
  isLit: false,
  lastUpdateDate: null,
});

// Helper to get today's date in YYYY-MM-DD format (local timezone)
const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to get user's timezone
const getUserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

interface StreakContextType {
  streakData: StreakData;
  loading: boolean;
  canUpdateToday: boolean;
  hasUpdatedToday: boolean; 
  updateStreakForAction: () => Promise<boolean>;
  refreshStreakData: () => void;
}

const StreakContext = createContext<StreakContextType | undefined>(undefined);

export const StreakProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [streakData, setStreakData] = useState<StreakData>(getDefaultStreakData());
  const [loading, setLoading] = useState(true);
  const updateInProgress = useRef(false);
  const lastFetchTime = useRef<number>(0);
  const updatedTodayRef = useRef<string | null>(null);
  const CACHE_DURATION = 1000;

  const fetchStreakData = useCallback(async (force: boolean = false) => {
    const now = Date.now();
    
    if (!force && now - lastFetchTime.current < CACHE_DURATION) {
      console.log('⏭️ Skipping fetch - too soon since last fetch');
      return;
    }
    
    lastFetchTime.current = now;
    
    try {
      console.log('📡 Fetching streak data...');
      const response = await authAPI.authenticatedFetch(`${API_URL}/api/streaks/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Timezone': getUserTimezone(),
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        console.warn('⚠️ Streak fetch failed:', response.status);
        setStreakData(getDefaultStreakData());
        return;
      }

      const data = await response.json();
      console.log('📊 Fetched streak data:', {
        currentStreak: data.currentStreak,
        maxStreak: data.maxStreak,
        isLit: data.isLit,
        lastUpdateDate: data.lastUpdateDate,
        weekActivity: data.weekActivity,
      });
      
      const normalizedData: StreakData = {
        currentStreak: data.currentStreak || 0,
        maxStreak: data.maxStreak || 7,
        assignmentsCompletedToday: data.assignmentsCompletedToday || 0,
        totalAssignmentsToday: data.totalAssignmentsToday || 0,
        weekActivity: data.weekActivity || [false, false, false, false, false, false, false],
        isLit: data.isLit || false,
        lastUpdateDate: data.lastUpdateDate || null,
      };
      
      if (normalizedData.lastUpdateDate) {
        const lastUpdateDay = normalizedData.lastUpdateDate.split('T')[0];
        const today = getTodayDateString();
        if (lastUpdateDay === today) {
          console.log('✅ Detected today update from fetch, marking session');
          updatedTodayRef.current = today;
        }
      }
      
      setStreakData(normalizedData);
    } catch (err) {
      console.error('❌ Error fetching streak data:', err);
      setStreakData(getDefaultStreakData());
    } finally {
      setLoading(false);
    }
  }, []);

  const canUpdateToday = useCallback((): boolean => {
    const today = getTodayDateString();
    
    if (updatedTodayRef.current === today) {
      console.log('⏭️ Already updated in this session');
      return false;
    }
    
    if (!streakData.lastUpdateDate) {
      return true;
    }
    
    const lastUpdate = streakData.lastUpdateDate.split('T')[0];
    const canUpdate = lastUpdate !== today;
    
    console.log('🗓️ Can update check:', {
      today,
      lastUpdate,
      canUpdate,
      sessionUpdated: updatedTodayRef.current,
    });
    
    return canUpdate;
  }, [streakData.lastUpdateDate]);

  const updateStreakForAction = useCallback(async (): Promise<boolean> => {
    if (updateInProgress.current) {
      console.log('⏭️ [STREAK] Update already in progress');
      return false;
    }
    
    const todayString = getTodayDateString();
    if (updatedTodayRef.current === todayString) {
      console.log('⏭️ [STREAK] Already updated today (session check)');
      return false;
    }
    
    const lastUpdateString = streakData.lastUpdateDate?.split('T')[0];
    if (lastUpdateString === todayString) {
      console.log('⏭️ [STREAK] Already updated today (backend check)');
      updatedTodayRef.current = todayString;
      return false;
    }
    
    console.log('✅ [STREAK] Can update! Proceeding with API call...');
    updateInProgress.current = true;
    
    try {
      const response = await authAPI.authenticatedFetch(`${API_URL}/api/streaks/update/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Timezone': getUserTimezone(),
        },
        body: JSON.stringify({}),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('❌ [STREAK] API failed:', response.status, responseData);
        updateInProgress.current = false;
        return false;
      }
      
      console.log('✅ [STREAK] API success:', responseData);
      
      updatedTodayRef.current = todayString;
      
      const updatedData: StreakData = {
        currentStreak: responseData.currentStreak || 0,
        maxStreak: responseData.longestStreak || responseData.maxStreak || 7,
        assignmentsCompletedToday: responseData.assignmentsCompleted || 0,
        totalAssignmentsToday: responseData.totalAssignments || 0,
        weekActivity: responseData.weekActivity || streakData.weekActivity,
        isLit: true,
        lastUpdateDate: responseData.lastUpdateDate || new Date().toISOString(),
      };
      
      console.log('📊 Setting new streak data:', {
        oldStreak: streakData.currentStreak,
        newStreak: updatedData.currentStreak,
        lastUpdateDate: updatedData.lastUpdateDate,
        weekActivity: updatedData.weekActivity,
      });
      
      setStreakData(updatedData);
      updateInProgress.current = false;
      
      setTimeout(() => {
        console.log('🔄 Post-update refresh');
        fetchStreakData(true);
      }, 500);
      
      return true;
      
    } catch (error) {
      console.error('❌ [STREAK] API error:', error);
      updateInProgress.current = false;
      return false;
    }
  }, [streakData, fetchStreakData]);

  useEffect(() => {
    console.log('🚀 StreakProvider mounted - fetching initial data');
    fetchStreakData(true);
  }, []);

  useEffect(() => {
    const checkDayChange = () => {
      const today = getTodayDateString();
      const lastUpdate = streakData.lastUpdateDate?.split('T')[0];
      
      if (updatedTodayRef.current && updatedTodayRef.current !== today) {
        console.log('🌅 New day detected! Resetting session flag');
        updatedTodayRef.current = null;
      }
      
      if (lastUpdate && lastUpdate !== today) {
        console.log('🌅 Day changed! Refreshing streak data...');
        fetchStreakData(true);
      }
    };
    
    const interval = setInterval(checkDayChange, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [streakData.lastUpdateDate, fetchStreakData]);

  const refreshStreakData = useCallback(() => {
    console.log('🔄 Manual refresh requested');
    setLoading(true);
    fetchStreakData(true);
  }, [fetchStreakData]);

  const hasUpdatedToday = useCallback((): boolean => {
    const today = getTodayDateString();
    
    if (updatedTodayRef.current === today) {
      return true;
    }
    
    if (!streakData.lastUpdateDate) {
      return false;
    }
    
    const lastUpdate = streakData.lastUpdateDate.split('T')[0];
    return lastUpdate === today;
  }, [streakData.lastUpdateDate]);

  const contextValue = {
    streakData,
    loading,
    canUpdateToday: canUpdateToday(),
    hasUpdatedToday: hasUpdatedToday(),
    updateStreakForAction,
    refreshStreakData,
  };

  return (
    <StreakContext.Provider value={contextValue}>
      {children}
    </StreakContext.Provider>
  );
};

export const useStreaks = () => {
  const context = useContext(StreakContext);
  if (context === undefined) {
    throw new Error('useStreaks must be used within a StreakProvider');
  }
  return context;
};