// app/settings/page.tsx
'use client';

import React, { useState } from 'react'; 
import '../styles/settings.css'; // Import the global CSS file


const SettingsPage = () => {
  const [isChecked, setIsChecked] = useState(false);

  const handleToggleChange = () => {
    setIsChecked(!isChecked);
  };

  return (
    <div className="settings-container">
      <h1>Settings</h1>

      <div className="settings-section">
        <h2>Account Settings</h2>
        <p>Manage your account settings, change your username, email, or password.</p>
        <a href="/account-settings" className="btn">Edit Account</a>
      </div>

      <div className="settings-section">
        <h2>Appearance</h2>
        <p>Customize your theme and preferences.</p>

        <div className="general-toggle">
          <h3>Enable Feature</h3>
          <label htmlFor="toggle-feature">
            <input 
              type="checkbox" 
              id="toggle-feature" 
              name="toggle_feature" 
              checked={isChecked} 
              onChange={handleToggleChange} 
            />
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h2>Premium Features</h2>
        <p>Upgrade to premium for additional features and customization options.</p>
        <a href="/premium" className="btn premium">Upgrade to Premium</a>
      </div>
    </div>
  );
};

export default SettingsPage;