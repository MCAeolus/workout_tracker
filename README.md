# Workout Tracker

A free, self-hosted workout tracking web app that uses Google Sheets as a database. Perfect for tracking your lifts at the gym on your phone, with full access on desktop for planning and reviewing progress.

## Features

✅ **Fixed Routine Support** - Create workout splits (Push/Pull/Legs, etc.)  
✅ **Quick Logging** - Minimal taps to log weight, reps, and notes  
✅ **Rest Timer** - Automatic rest timer after completing sets  
✅ **Previous Performance** - See your last workout's numbers for progressive overload  
✅ **Exercise Notes** - Track form cues, fatigue levels, and other observations  
✅ **Mobile-First Design** - Optimized for gym use on your phone  
✅ **100% Free** - Hosted on GitHub Pages, data in your own Google Sheet  
✅ **Your Data** - Everything stays in your Google account  

## Demo

[Live Demo](https://your-username.github.io/workout-tracker/) *(coming soon - use your own deployment)*

## Quick Start

### 1. Set Up Google Sheet
Create a Google Sheet with two sheets:
- **Routines**: `RoutineName`, `ExerciseName`, `Notes`, `DefaultSets`
- **WorkoutLog**: `Date`, `Routine`, `Exercise`, `SetNumber`, `Weight`, `Reps`, `Notes`

### 2. Enable Google Sheets API & Create OAuth Credentials
- Create a project in [Google Cloud Console](https://console.cloud.google.com/)
- Enable Google Sheets API
- Configure OAuth consent screen (add yourself as test user)
- Create OAuth 2.0 Client ID (Web application type)
- Add your GitHub Pages URL to Authorized JavaScript origins

### 3. Deploy to GitHub Pages
- Fork this repo (or create new repo with the files)
- Enable GitHub Pages in Settings
- Access at `https://[username].github.io/workout-tracker/`

### 4. Configure & Sign In
- Open the deployed site
- Enter your OAuth Client ID and Spreadsheet ID
- Sign in with your Google account
- Authorize the app to access your spreadsheet
- Start tracking!

📖 **Full setup guide:** See [SETUP_GUIDE.md](SETUP_GUIDE.md)

## How It Works

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │────────▶│ Google OAuth │────────▶│  Your Data  │
│             │  Auth   │   + Sheets   │  Read/  │             │
│ (Workout    │  Flow   │     API      │  Write  │ (Google     │
│  Tracker)   │◀────────│              │◀────────│  Sheet)     │
└─────────────┘         └──────────────┘         └─────────────┘
```

- Static HTML/CSS/JavaScript (no server needed)
- OAuth 2.0 for secure authentication
- Data stored in your own Google Sheet
- API calls made directly from browser using Google's JavaScript client
- Credentials stored in browser's local storage

## Usage

### At the Gym
1. Open the app on your phone
2. Select your routine (e.g., "Push Day")
3. Log each set: weight → reps → ✓
4. Rest timer starts automatically
5. Add notes about form, fatigue, etc.

### On Desktop
1. Plan routines by editing your Google Sheet
2. Review workout history and progress
3. Create charts and analyze trends

## Customization

### Add More Routines
Edit the "Routines" sheet in Google Sheets:
```
Push Day  | Bench Press    | Focus on form | 4
Push Day  | Overhead Press | Keep tight    | 3
Pull Day  | Pull-ups       | Slow negative | 4
```

### Change Rest Timer
Settings → Default Rest Time → Set your preference

### Styling
The app uses CSS variables - edit the `:root` section in `index.html` to customize colors.

## Privacy & Security

- ✅ OAuth 2.0 authentication - more secure than API keys
- ✅ You authenticate with your Google account
- ✅ App only requests access to your spreadsheet
- ✅ No data sent to external servers (except Google's APIs)
- ✅ Source code is public, credentials stay private
- ✅ You can revoke access anytime from Google Account settings

**Note:** The app uses OAuth 2.0 which is the recommended secure way to access Google APIs. You'll sign in with your Google account and authorize the app to access only your workout spreadsheet.

## Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Safari (iOS/macOS)
- ✅ Firefox
- ✅ Mobile browsers

## Roadmap

- [ ] Offline support with service workers
- [ ] Export workout data to CSV
- [ ] Exercise library with instructions
- [ ] Progress charts built into the app
- [ ] Plate calculator
- [ ] Volume tracking and analytics

## Contributing

Contributions welcome! This is a simple, single-file app so it's easy to modify:
1. Fork the repo
2. Make your changes to `index.html`
3. Test locally
4. Submit a PR

## License

MIT License - feel free to use, modify, and distribute.

## Credits

Built for lifters who want a simple, free, no-BS workout tracker that works on mobile and respects their data ownership.

---

**Questions?** Open an issue or check the [setup guide](SETUP_GUIDE.md).

**Like this project?** Star it ⭐ and share with your gym buddies!
