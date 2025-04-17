export interface EventData {
    id?: string;
    eventId?: string;
    event_name: string;
    date: string;
    start_time: string | null;
    end_time: string | null;
    location: string;
    virtual: boolean;
    urgency: 'low' | 'medium' | 'high';
    notes: string;
    event_type: string;
    category: string;
    subcategories: string;
    recurrence_pattern: string;
    color: string;
    day_marking_title?: string;
  }