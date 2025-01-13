// components/EventModal.tsx

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/Dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import Checkbox from "@/app/components/ui/checkbox"

interface EventDetails {
  eventId: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  virtual: boolean;
  urgency: 'low' | 'medium' | 'high';
  notes: string;
  event_type: string;
  category: string;
  subcategories: string;
  recurrence_pattern: string;
  color: string;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: EventDetails | null;
  onSubmit: (e: React.FormEvent) => void;
  onDelete?: (eventId: string) => void;
  onChange: (field: keyof EventDetails, value: any) => void;
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  selectedEvent,
  onSubmit,
  onDelete,
  onChange,
}) => {
  if (!selectedEvent) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {selectedEvent.eventId ? "Edit Event" : "Add New Event"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="event_name">Event Name</Label>
              <Input
                id="event_name"
                value={selectedEvent.event_name}
                onChange={(e) => onChange('event_name', e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedEvent.date}
                onChange={(e) => onChange('date', e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={selectedEvent.start_time}
                  onChange={(e) => onChange('start_time', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={selectedEvent.end_time}
                  onChange={(e) => onChange('end_time', e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={selectedEvent.location}
                onChange={(e) => onChange('location', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="event_type">Event Type</Label>
              <Input
                id="event_type"
                value={selectedEvent.event_type}
                onChange={(e) => onChange('event_type', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={selectedEvent.notes}
                onChange={(e) => onChange('notes', e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="virtual"
                checked={selectedEvent.virtual}
                onCheckedChange={(checked) => onChange('virtual', checked)}
              />
              <Label htmlFor="virtual">Virtual Event</Label>
            </div>

            <div>
              <Label htmlFor="urgency">Urgency</Label>
              <select
                id="urgency"
                value={selectedEvent.urgency}
                onChange={(e) => onChange('urgency', e.target.value as 'low' | 'medium' | 'high')}
                className="w-full p-2 border rounded"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            {selectedEvent.eventId && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => onDelete(selectedEvent.eventId)}
              >
                Delete
              </Button>
            )}
            <Button type="submit">
              {selectedEvent.eventId ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventModal;