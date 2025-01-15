// NotificationSettings.tsx
"use client"
import React from 'react';
import { Bell, Mail, MessageSquare } from 'lucide-react';
import { Switch } from '@/radix/switch';

export default function NotificationSettings() {
  return (
    <div className="settings-section">
      <div className="form-group">
        <div className="flex items-center justify-between">
          <div>
            <label className="form-label flex items-center gap-2">
              <Bell size={16} />
              Enable Notifications
            </label>
            <p className="form-helper">Receive notifications for calendar events</p>
          </div>
          <Switch />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Default Reminder Time</label>
        <select className="form-input">
          <option>15 minutes before</option>
          <option>30 minutes before</option>
          <option>1 hour before</option>
          <option>1 day before</option>
        </select>
        <p className="form-helper">
          When should we remind you about events by default?
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Notification Methods</label>
        <div className="space-y-4 mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail size={16} />
              Email Notifications
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} />
              Push Notifications
            </div>
            <Switch />
          </div>
        </div>
        <p className="form-helper">
          Choose how you want to receive notifications
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Event Types to Notify</label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input type="checkbox" className="form-checkbox" defaultChecked />
            <span>All-day events</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" className="form-checkbox" defaultChecked />
            <span>Regular events</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" className="form-checkbox" defaultChecked />
            <span>Event updates</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" className="form-checkbox" defaultChecked />
            <span>Event cancellations</span>
          </div>
        </div>
        <p className="form-helper">
          Select which types of events should trigger notifications
        </p>
      </div>

      <div className="form-group">
        <div className="flex items-center justify-between">
          <div>
            <label className="form-label">Quiet Hours</label>
            <p className="form-helper">Don't send notifications during these hours</p>
          </div>
          <Switch />
        </div>
      </div>
    </div>
  );
}