# Testing Report Generation Changes

This guide will help you test the new report features including:
- **Calls Per Hour** calculation
- **Detailed Call Log** with agent names, phone numbers, and remarks
- **Conversion Rate (Conversation Rate)** labeling
- **Enhanced KPI metrics**

## Prerequisites

1. Ensure you have the development environment set up
2. Make sure you have call data in your database (or use mock data)
3. Have a user account with appropriate permissions (Agent, Manager, or Admin)

## Step 1: Start the Development Server

### Option A: Web Browser (Recommended for quick testing)

```bash
cd bet-wise-dialer
npm run dev
```

The app will open at `http://localhost:8083` (or the port shown in terminal)

### Option B: Desktop App (Tauri)

```bash
npm run tauri:dev
# or
npm run desktop
```

## Step 2: Navigate to Reports Page

### For Agents:
1. Log in as an agent
2. Navigate to **Reports** page from the sidebar
3. Click **"Generate Performance Report"** button

### For Managers/Admins:
1. Log in as a manager or admin
2. Navigate to **Performance Analytics** page
3. Click **"Generate & Download Word Document"** button

## Step 3: Generate a Report

1. **Select Date Range:**
   - Choose from: Today, Last 7 days, Last 30 days, etc.
   - This affects the "Calls Per Hour" calculation

2. **Select Agent (if Manager/Admin):**
   - Choose "All Agents (Team Report)" for team-wide report
   - Or select a specific agent for agent-specific report

3. **Click "Generate & Download Word Document"**

4. **Wait for generation:**
   - The report will be generated using AI
   - A Word document (.docx) will download automatically

## Step 4: Verify the Report Content

Open the downloaded Word document and check for:

### ✅ 1. KPI Section (Agent-Specific Reports)

Look for these metrics in the "Key Performance Indicators (KPIs)" section:

- **Total Calls Made** - Should show the number of calls
- **Calls Per Hour** - NEW! Should show calculated value (e.g., "7.5 calls/hour")
  - Calculation: `Total Calls / (8 hours/day × Number of days)`
- **Connects** - Number of successful connections
- **Connect Rate** - Percentage of calls that connected
- **Conversions** - Number of converted calls
- **Conversion Rate (Conversation Rate)** - NEW LABEL! Should show percentage
- **Total Revenue** - Revenue in UGX
- **Average Handle Time** - Formatted as MM:SS

### ✅ 2. Performance Summary

Check the "Performance Summary" section for:
- ✓ or ⚠ indicators for each metric
- Assessment of calls per hour performance
- Assessment of conversion rate performance
- Assessment of average handle time

### ✅ 3. Detailed Call Log (NEW!)

Look for the "Detailed Call Log" section which should include:

**For each call:**
- **Call number** (e.g., "Call 1:")
- **Time and Agent** (e.g., "2:30 PM - John Doe called +256756990141 (Jane Smith)")
- **Status and Duration** (e.g., "Status: Connected | Duration: 4:32")
- **Remarks** (e.g., "Remarks: Promised to deposit tomorrow")

**Organization:**
- Calls grouped by date
- Most recent calls first
- Limited to 100 most recent calls

### ✅ 4. AI Analysis & Insights

Verify the AI-generated analysis section includes:
- Insights about performance
- Recommendations
- Analysis of call patterns

## Step 5: Test Different Scenarios

### Scenario 1: Agent-Specific Report
1. Select a specific agent from dropdown
2. Generate report
3. Verify:
   - Report title includes agent name
   - All KPIs are agent-specific
   - Call log shows only that agent's calls

### Scenario 2: Team Report
1. Select "All Agents (Team Report)"
2. Generate report
3. Verify:
   - Report title is "Call Center Performance Report"
   - KPIs are team-wide
   - Call log shows calls from all agents

### Scenario 3: Different Date Ranges
1. Test with "Last 7 days"
2. Test with "Last 30 days"
3. Verify:
   - "Calls Per Hour" changes based on date range
   - Call log shows calls within selected date range

## Step 6: Verify Database Data

### Check that call data includes:
1. **Agent Name** - Should be linked via `user_id` to `profiles` table
2. **Phone Number** - Should be in `phone_number` field
3. **Remarks/Notes** - Should be in `notes` field (required after each call)

### To verify in Supabase:
1. Go to Supabase Dashboard
2. Navigate to `call_activities` table
3. Check that records have:
   - `user_id` (not null)
   - `phone_number` (not null)
   - `notes` (should have values if agents completed post-call notes)

## Step 7: Test with Mock Data (Optional)

If you don't have real call data:

1. Navigate to **Performance Analytics** page
2. Click the **TestTube icon** to enable mock data
3. Generate a report
4. Verify the report uses mock data and displays correctly

## Troubleshooting

### Issue: "Calls Per Hour" shows 0.0
- **Cause:** No calls in selected date range
- **Solution:** Select a date range with call data, or use mock data

### Issue: Call log is empty
- **Cause:** No calls found or calls don't have required fields
- **Solution:** Check that calls have `user_id`, `phone_number`, and `notes`

### Issue: Agent names show as "Unknown Agent"
- **Cause:** `user_id` doesn't match any profile
- **Solution:** Verify `profiles` table has matching records

### Issue: Remarks show as "No remarks"
- **Cause:** Agent didn't complete post-call notes
- **Solution:** Ensure agents complete the PostCallNotesDialog after each call

## Expected Results

### Successful Test:
✅ Word document downloads successfully
✅ All KPI metrics are present and accurate
✅ "Calls Per Hour" is calculated correctly
✅ "Detailed Call Log" section appears with agent names, phone numbers, and remarks
✅ Calls are grouped by date
✅ Report is saved to `generated_reports` table (if table exists)

### Sample Report Structure:
```
Agent Performance Report - John Doe
Period: Last 30 days
Agent: John Doe (john.doe@example.com)
Generated: 1/20/2025

Key Performance Indicators (KPIs)
- Total Calls Made: 150 (Target: 60 calls/day)
- Calls Per Hour: 7.5 (Target: 7.5 calls/hour target)
- Connects: 105 (Target: 40 connects/day)
- Connect Rate: 70% (Target: 70% target)
- Conversions: 28 (Target: 12 conversions/day)
- Conversion Rate (Conversation Rate): 26.7% (Target: 25% target)
- Total Revenue: UGX 1,400,000 (Revenue generated)
- Average Handle Time: 4:32 (Optimal: 3-5 min)

Performance Summary
✓ Exceeded daily call target
✓ Excellent calls per hour rate
✓ Excellent connect rate
✓ Strong conversion (conversation) rate performance
✓ Optimal average handle time

Detailed Call Log
Jan 20, 2025
Call 1: 2:30 PM - John Doe called +256756990141 (Jane Smith)
Status: Connected | Duration: 4:32 | Remarks: Promised to deposit tomorrow

Call 2: 1:15 PM - John Doe called +256755123456 (Bob Johnson)
Status: Converted | Duration: 6:45 | Remarks: Successfully converted, deposit of UGX 50,000

AI Analysis & Insights
[AI-generated content...]
```

## Next Steps

After testing:
1. Verify all metrics match your Excel template
2. Check that the format matches your requirements
3. Test with real production data
4. Share feedback if any adjustments are needed

