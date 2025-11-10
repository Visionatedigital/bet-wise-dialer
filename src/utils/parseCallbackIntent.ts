import { addDays, addWeeks, startOfDay, startOfTomorrow } from "date-fns";

export interface CallbackIntent {
  shouldCreateCallback: boolean;
  callbackDate: Date | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export function parseCallbackIntent(notes: string): CallbackIntent {
  if (!notes) {
    return { shouldCreateCallback: false, callbackDate: null, priority: 'medium' };
  }

  const lowerNotes = notes.toLowerCase();
  
  // Check for explicit callback mentions
  const hasCallbackMention = 
    lowerNotes.includes('call back') ||
    lowerNotes.includes('callback') ||
    lowerNotes.includes('follow up') ||
    lowerNotes.includes('followup') ||
    lowerNotes.includes('reach out') ||
    lowerNotes.includes('contact later') ||
    lowerNotes.includes('try again');

  if (!hasCallbackMention) {
    return { shouldCreateCallback: false, callbackDate: null, priority: 'medium' };
  }

  let callbackDate: Date = addDays(startOfDay(new Date()), 1); // Default to tomorrow
  let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';

  // Parse time references
  if (lowerNotes.includes('urgent') || lowerNotes.includes('asap') || lowerNotes.includes('immediately')) {
    callbackDate = startOfDay(new Date());
    priority = 'urgent';
  } else if (lowerNotes.includes('today') || lowerNotes.includes('later today')) {
    callbackDate = startOfDay(new Date());
    priority = 'high';
  } else if (lowerNotes.includes('tomorrow')) {
    callbackDate = startOfTomorrow();
    priority = 'high';
  } else if (lowerNotes.includes('next week')) {
    callbackDate = addWeeks(startOfDay(new Date()), 1);
    priority = 'medium';
  } else if (lowerNotes.includes('this week')) {
    callbackDate = addDays(startOfDay(new Date()), 3);
    priority = 'medium';
  } else if (lowerNotes.includes('few days')) {
    callbackDate = addDays(startOfDay(new Date()), 3);
    priority = 'medium';
  } else if (lowerNotes.includes('week')) {
    callbackDate = addWeeks(startOfDay(new Date()), 1);
    priority = 'low';
  } else if (lowerNotes.includes('month')) {
    callbackDate = addWeeks(startOfDay(new Date()), 4);
    priority = 'low';
  }

  // Check for high priority indicators
  if (lowerNotes.includes('important') || lowerNotes.includes('must call')) {
    priority = priority === 'urgent' ? 'urgent' : 'high';
  }

  return {
    shouldCreateCallback: true,
    callbackDate,
    priority,
  };
}
