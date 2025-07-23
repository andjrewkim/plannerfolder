"use client"
import React from 'react';
import { Bell, Mail, MessageSquare } from 'lucide-react';
import { Switch } from '@/radix/switch';

export default function NotificationSettings() {
  return (
    <div className="settings-section">
      {/* Development placeholder overlay */}
      <div className="relative">
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
          <div className="bg-white/90 backdrop-blur px-6 py-4 rounded-lg shadow-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">In Development</h3>
            <p className="text-gray-600 text-sm">
              Notification settings functionality is currently being developed and will be available soon.
            </p>
          </div>
        </div>
        
        {/* Original content (blocked/disabled) */}
        <div className="pointer-events-none opacity-30">
          <div className="form-group">
            <div className="flex items-center justify-between">
              <div>
                <label className="form-label flex items-center gap-2">
                  <Bell size={16} />
                  Enable Notifications
                </label>
                <p className="form-helper">Receive notifications for calendar events</p>
              </div>
              <Switch disabled />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Default Reminder Time</label>
            <select className="form-input" disabled>
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
                <Switch disabled />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} />
                  Push Notifications
                </div>
                <Switch disabled />
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
                <input type="checkbox" className="form-checkbox" defaultChecked disabled />
                <span>All-day events</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="form-checkbox" defaultChecked disabled />
                <span>Regular events</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="form-checkbox" defaultChecked disabled />
                <span>Event updates</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="form-checkbox" defaultChecked disabled />
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
                <p className="form-helper">Don&apos;t send notifications during these hours</p>
              </div>
              <Switch disabled />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}