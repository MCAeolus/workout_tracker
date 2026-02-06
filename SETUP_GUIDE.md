# Workout Tracker Setup Guide

## Overview
This workout tracker is a free, self-hosted web application that uses Google Sheets as its database. You'll track workouts on your phone/laptop while all data syncs to your own Google Sheet.

## Prerequisites
- Google account
- GitHub account (for hosting)
- Basic familiarity with Google Sheets

---

## Part 1: Create Your Google Sheet

### Step 1: Create the Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Name it "Workout Tracker Data"

### Step 2: Set Up Sheet 1 - "Routines"

1. Rename the first sheet to: **Routines**
2. Add these column headers in row 1:
   - A1: `RoutineName`
   - B1: `ExerciseName`
   - C1: `Notes`
   - D1: `DefaultSets`

3. Add your workout routines (example):

| RoutineName | ExerciseName | Notes | DefaultSets |
|-------------|--------------|-------|-------------|
| Push Day | Bench Press | Focus on form | 4 |
| Push Day | Overhead Press | Keep core tight | 3 |
| Push Day | Tricep Dips | Full ROM | 3 |
| Pull Day | Pull-ups | Slow negatives | 4 |
| Pull Day | Barbell Rows | Squeeze at top | 4 |
| Pull Day | Face Pulls | High reps for rear delts | 3 |
| Leg Day | Squats | Depth is key | 4 |
| Leg Day | Romanian Deadlifts | Feel the hamstrings | 3 |
| Leg Day | Leg Press | Controlled tempo | 3 |

### Step 3: Set Up Sheet 2 - "WorkoutLog"

1. Create a new sheet (+ button at bottom)
2. Rename it to: **WorkoutLog**
3. Add these column headers in row 1:
   - A1: `Date`
   - B1: `Routine`
   - C1: `Exercise`
   - D1: `SetNumber`
   - E1: `Weight`
   - F1: `Reps`
   - G1: `Notes`

4. Leave the rest blank (this will fill automatically as you log workouts)

### Step 4: Make the Sheet Public for Reading

1. Click the "Share" button (top right)
2. Click "Change to anyone with the link"
3. Set to "Viewer" access
4. Click "Done"

**Important:** This makes the sheet viewable by anyone with the link. Since it's just workout data, this is fine. The API key will allow writing to it.

### Step 5: Get Your Spreadsheet ID

From your sheet URL:
```
https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0j/edit
```

Copy the ID part (between `/d/` and `/edit`): `1a2b3c4d5e6f7g8h9i0j`

---

## Part 2: Set Up Google Sheets API with OAuth 2.0

### Step 1: Go to Google Cloud Console

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account

### Step 2: Create a New Project

1. Click the project dropdown at the top
2. Click "New Project"
3. Name it "Workout Tracker"
4. Click "Create"
5. Wait for it to create, then select the project

### Step 3: Enable Google Sheets API

1. In the left menu, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click on it
4. Click "Enable"

### Step 4: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type
3. Click "Create"
4. Fill in the required fields:
   - App name: "Workout Tracker"
   - User support email: Your email
   - Developer contact: Your email
5. Click "Save and Continue"
6. Scopes: Skip this section (click "Save and Continue")
7. Test users: Add your email address
8. Click "Save and Continue"
9. Review and click "Back to Dashboard"

### Step 5: Create OAuth 2.0 Client ID

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: "Web application"
4. Name: "Workout Tracker Web Client"
5. **Authorized JavaScript origins:**
   - Add: `https://[your-github-username].github.io`
   - Example: `https://johnsmith.github.io`
6. **Authorized redirect URIs:** Leave empty (not needed for our app)
7. Click "Create"
8. **Copy your Client ID** (looks like: `123456789-abcdefg.apps.googleusercontent.com`)

**Important:** Replace `[your-github-username]` with your actual GitHub username where you'll deploy the app.

---

## Part 3: Deploy to GitHub Pages

### Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the "+" icon → "New repository"
3. Name it: `workout-tracker`
4. Make it **Public** (required for GitHub Pages)
5. Click "Create repository"

### Step 2: Upload the HTML File

1. Click "uploading an existing file"
2. Drag and drop the `workout-tracker.html` file
3. Rename it to `index.html` (important!)
4. Click "Commit changes"

### Step 3: Enable GitHub Pages

1. Go to repository "Settings"
2. Scroll to "Pages" section (left sidebar)
3. Under "Source", select "Deploy from a branch"
4. Under "Branch", select "main" and "/root"
5. Click "Save"
6. Wait 1-2 minutes for deployment

Your site will be live at:
```
https://[your-username].github.io/workout-tracker/
```

---

## Part 4: Configure the App

### First Time Setup

1. Open your deployed site in a browser
2. You'll see the setup screen
3. Enter your **OAuth Client ID** (from Part 2, Step 5)
4. Enter your **Spreadsheet ID** (from Part 1, Step 5)
5. Click "Save Configuration"
6. The app will prompt you to sign in with Google
7. Click "Sign In" and authorize the app to access your spreadsheet

The app will store your Client ID in your browser's local storage (it never leaves your device). Your Google account authentication is handled securely by Google.

### Test It Out

1. After signing in, click on one of your routines (e.g., "Push Day")
2. You should see your exercises appear
3. Fill in weight and reps for a set
4. Click the checkmark to complete it
5. A rest timer should appear
6. Complete all your sets
7. Check your Google Sheet - you should see new entries in the WorkoutLog sheet!

---

## Using the App

### At the Gym (Mobile)

1. Open the site on your phone
2. Select your routine
3. Log each set:
   - Enter weight and reps
   - Hit the checkmark
   - Rest timer starts automatically
4. Add notes about form, fatigue, etc.
5. Data saves automatically to your sheet

### On Computer (Planning/Review)

1. Use the "Manage Routines" tab to edit exercises
2. Use "Settings" to adjust rest timer defaults
3. View your progress directly in Google Sheets with charts/analysis

---

## Tips & Tricks

### Bookmarking on Mobile
1. Open the site in your mobile browser
2. Add to home screen for app-like experience
   - **iPhone:** Share → Add to Home Screen
   - **Android:** Menu → Add to Home Screen

### Progressive Overload Tracking
The app shows your previous performance for each exercise, making it easy to progressively increase weight or reps.

### Editing Routines
For now, edit routines directly in Google Sheets. Just add rows to the "Routines" sheet following the same format.

### Privacy
- Your OAuth Client ID stays in your browser
- Authentication is handled securely by Google OAuth
- You authenticate with your Google account - more secure than API keys
- Only you can access your workout data
- The app only requests permission to read/write your specific spreadsheet
- You can revoke access anytime from your Google Account settings

---

## Troubleshooting

### "Error loading data"
- Check your Client ID is correct
- Verify spreadsheet ID is correct
- Make sure you've signed in with Google
- Ensure you authorized the app to access your spreadsheet
- Check that Google Sheets API is enabled in your Cloud Console

### "Sign in failed" or OAuth errors
- Verify you added your GitHub Pages URL to "Authorized JavaScript origins"
- Make sure the URL matches exactly (with https://)
- Check that you added yourself as a test user in OAuth consent screen
- Try signing out and signing in again

### Can't save workouts
- Make sure you're signed in (check Settings → Sign Out button is visible)
- Verify your internet connection
- Check browser console (F12) for error messages
- Try signing out and signing in again

### Rest timer not starting
- Make sure you've entered both weight AND reps
- Click the checkmark to complete the set

### Want to reset everything?
Go to Settings → Reset Configuration, then sign in again

---

## Next Steps

Once you're comfortable:
1. Customize the routines in your Google Sheet
2. Add more exercises and routines
3. Create charts in Google Sheets to visualize progress
4. Adjust the default rest timer in Settings

Enjoy tracking your gains! 💪
