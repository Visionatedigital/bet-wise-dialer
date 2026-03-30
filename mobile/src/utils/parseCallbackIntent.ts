export interface CallbackIntent {
  shouldCreateCallback: boolean;
  callbackDate: Date | null;
  priority: "low" | "medium" | "high" | "urgent";
}

export function parseCallbackIntent(notes: string): CallbackIntent {
  if (!notes) {
    return { shouldCreateCallback: false, callbackDate: null, priority: "medium" };
  }

  const lower = notes.toLowerCase();

  const hasCallback =
    lower.includes("call back") ||
    lower.includes("callback") ||
    lower.includes("follow up") ||
    lower.includes("followup") ||
    lower.includes("reach out") ||
    lower.includes("contact later") ||
    lower.includes("try again");

  if (!hasCallback) {
    return { shouldCreateCallback: false, callbackDate: null, priority: "medium" };
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let callbackDate = new Date(startOfDay.getTime() + 86400000); // tomorrow
  let priority: CallbackIntent["priority"] = "medium";

  if (lower.includes("urgent") || lower.includes("asap")) {
    callbackDate = startOfDay;
    priority = "urgent";
  } else if (lower.includes("today")) {
    callbackDate = startOfDay;
    priority = "high";
  } else if (lower.includes("tomorrow")) {
    callbackDate = new Date(startOfDay.getTime() + 86400000);
    priority = "high";
  } else if (lower.includes("next week")) {
    callbackDate = new Date(startOfDay.getTime() + 7 * 86400000);
    priority = "medium";
  } else if (lower.includes("few days") || lower.includes("this week")) {
    callbackDate = new Date(startOfDay.getTime() + 3 * 86400000);
    priority = "medium";
  }

  return { shouldCreateCallback: true, callbackDate, priority };
}
