-- Ensure daily metrics and callbacks are kept in sync via triggers
-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_update_daily_metrics ON public.call_activities;
DROP TRIGGER IF EXISTS trg_update_callbacks_due ON public.callbacks;

-- Create a single trigger to handle INSERT/UPDATE/DELETE for call_activities
CREATE TRIGGER trg_update_daily_metrics
AFTER INSERT OR UPDATE OR DELETE ON public.call_activities
FOR EACH ROW EXECUTE FUNCTION public.update_daily_metrics();

-- Create a single trigger to handle INSERT/UPDATE/DELETE for callbacks
CREATE TRIGGER trg_update_callbacks_due
AFTER INSERT OR UPDATE OR DELETE ON public.callbacks
FOR EACH ROW EXECUTE FUNCTION public.update_callbacks_due();