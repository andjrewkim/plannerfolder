// components/SignOutButton.tsx
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { authAPI } from '../../lib/auth'; // ✅ path is fine if it's correct in your structure

const SignOutButton: React.FC = () => {
  
  console.log('=== SIGN OUT CLICKED ===');
  
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);

    try {
      await authAPI.logout(); // ✅ FIXED HERE
      router.push('/userlogin');
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={isLoading}
      className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
    >
      {isLoading ? 'Signing out...' : (
        <div className="flex items-center">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </div>
      )}
    </button>
  );
};

export default SignOutButton;
