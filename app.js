// Configuration
let config = {
    clientId: '',
    spreadsheetId: '',
    defaultRestTime: 90
};

// OAuth & State
let tokenClient;
let accessToken = null;

// State
let routines = [];
let workoutLog = [];
let currentRoutine = null;
let currentWorkout = {};
let timerInterval = null;
let timeRemaining = 0;

// Initialize
function init() {
    loadConfig();
    
    // Check if we're returning from OAuth redirect with access token
    const hash = window.location.hash;
    if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        const expiresIn = params.get('expires_in');
        
        if (token) {
            // Store the token
            accessToken = token;
            // Store token info for later
            const tokenInfo = {
                access_token: token,
                expires_at: Date.now() + (parseInt(expiresIn) * 1000)
            };
            localStorage.setItem('workoutTrackerToken', JSON.stringify(tokenInfo));
            initializeGoogleAPI();

            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } else if (config.clientId && config.spreadsheetId) {
        initializeGoogleAPI();
    }
}

// Initialize Google API
function initializeGoogleAPI() {
    // Load the Google API client library
    gapi.load('client', async () => {
        await gapi.client.init({
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        });
        
        // Check for stored token
        const storedToken = localStorage.getItem('workoutTrackerToken');
        let hasValidToken = false;
        
        if (storedToken) {
            const tokenInfo = JSON.parse(storedToken);
            if (tokenInfo.expires_at > Date.now()) {
                // Token is still valid
                gapi.client.setToken({ access_token: tokenInfo.access_token });
                accessToken = tokenInfo.access_token;
                hasValidToken = true;
            } else {
                // Token expired, clean it up
                localStorage.removeItem('workoutTrackerToken');
            }
        }
        
        if (hasValidToken) {
            // Already authenticated
            document.getElementById('setupScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            loadData();
        } else {
            // Need to authenticate
            document.getElementById('setupScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            
            // Show a "Sign In Required" message
            showStatus('Please sign in to access your workout data', 'error');
            
            // Optionally auto-trigger auth (comment out if you want manual)
            setTimeout(() => handleAuthClick(), 1000);
        }
    });
}

function handleAuthClick() {
    if (!config.clientId) {
        showStatus('OAuth client not initialized. Please check your Client ID.', 'error');
        return;
    }
    
    // Build OAuth URL for redirect flow (implicit grant)
    const redirectUri = window.location.origin + window.location.pathname;
    const scope = 'https://www.googleapis.com/auth/spreadsheets';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(config.clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(scope)}` +
        `&include_granted_scopes=true`;
    
    // Redirect to Google OAuth
    window.location.href = authUrl;
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken(null);
            accessToken = null;
            localStorage.removeItem('workoutTrackerToken');
            document.getElementById('mainApp').classList.add('hidden');
            document.getElementById('setupScreen').classList.remove('hidden');
        });
    }
}

// Configuration Management
function loadConfig() {
    const saved = localStorage.getItem('workoutTrackerConfig');
    if (saved) {
        config = JSON.parse(saved);
        document.getElementById('settingsClientId').value = config.clientId || '';
        document.getElementById('settingsSpreadsheetId').value = config.spreadsheetId || '';
        document.getElementById('defaultRestTime').value = config.defaultRestTime || 90;
    }
}

function saveConfig() {
    const clientId = document.getElementById('clientIdInput')?.value || document.getElementById('settingsClientId').value;
    const spreadsheetId = document.getElementById('spreadsheetIdInput')?.value || document.getElementById('settingsSpreadsheetId').value;
    const restTime = document.getElementById('defaultRestTime')?.value || 90;

    if (!clientId || !spreadsheetId) {
        showStatus('Please enter both Client ID and Spreadsheet ID', 'error');
        return;
    }

    config = { clientId, spreadsheetId, defaultRestTime: parseInt(restTime) };
    localStorage.setItem('workoutTrackerConfig', JSON.stringify(config));
    
    // Reload to re-initialize OAuth
    location.reload();
}

function clearConfig() {
    if (confirm('Are you sure you want to reset all configuration?')) {
        localStorage.removeItem('workoutTrackerConfig');
        location.reload();
    }
}

// Google Sheets API
async function loadData() {
    try {
        await Promise.all([loadRoutines(), loadWorkoutLog()]);
        renderRoutines();
    } catch (error) {
        console.error('Error loading data:', error);
        showStatus('Error loading data. Please check your configuration and sign in again.', 'error');
    }
}

async function loadRoutines() {
    const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'Routines',
    });
    
    const data = response.result;
    if (data.values) {
        const [headers, ...rows] = data.values;
        routines = rows.map(row => ({
            routineName: row[0],
            exerciseName: row[1],
            notes: row[2] || '',
            defaultSets: parseInt(row[3]) || 3
        }));
    }
}

async function loadWorkoutLog() {
    const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'WorkoutLog',
    });
    
    const data = response.result;
    if (data.values) {
        const [headers, ...rows] = data.values;
        workoutLog = rows.map(row => ({
            date: row[0],
            routine: row[1],
            exercise: row[2],
            setNumber: parseInt(row[3]),
            weight: parseFloat(row[4]),
            reps: parseInt(row[5]),
            notes: row[6] || ''
        }));
    }
}

async function saveWorkoutLog(entries) {
    const rows = entries.map(e => [
        e.date,
        e.routine,
        e.exercise,
        e.setNumber,
        e.weight,
        e.reps,
        e.notes
    ]);

    const response = await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: 'WorkoutLog',
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: rows
        }
    });

    return response.result;
}

// View Management
function switchView(view) {
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('workoutView').classList.add('hidden');
    document.getElementById('manageView').classList.add('hidden');
    document.getElementById('settingsView').classList.add('hidden');

    if (view === 'workout') {
        document.getElementById('workoutView').classList.remove('hidden');
    } else if (view === 'manage') {
        document.getElementById('manageView').classList.remove('hidden');
        renderManageRoutines();
    } else if (view === 'settings') {
        document.getElementById('settingsView').classList.remove('hidden');
    }
}

// Routine Rendering
function renderRoutines() {
    const uniqueRoutines = [...new Set(routines.map(r => r.routineName))];
    const grid = document.getElementById('routineGrid');
    
    grid.innerHTML = uniqueRoutines.map(name => {
        const exercises = routines.filter(r => r.routineName === name);
        return `
            <div class="routine-card" onclick="selectRoutine('${name}')">
                <div class="routine-name">${name}</div>
                <div class="routine-exercises">${exercises.length} exercises</div>
            </div>
        `;
    }).join('');
}

function selectRoutine(name) {
    currentRoutine = name;
    currentWorkout = {};
    
    document.querySelectorAll('.routine-card').forEach(card => {
        card.classList.remove('active');
    });
    event.target.closest('.routine-card').classList.add('active');
    
    renderExercises();
}

function renderExercises() {
    const exercises = routines.filter(r => r.routineName === currentRoutine);
    const list = document.getElementById('exerciseList');
    
    list.innerHTML = exercises.map((ex, idx) => {
        const previous = getPreviousPerformance(ex.exerciseName);
        const sets = currentWorkout[ex.exerciseName] || Array(ex.defaultSets).fill().map(() => ({
            weight: '',
            reps: '',
            completed: false
        }));
        
        currentWorkout[ex.exerciseName] = sets;
        
        return `
            <div class="exercise-item">
                <div class="exercise-header">
                    <div class="exercise-info">
                        <h3>${ex.exerciseName}</h3>
                        ${ex.notes ? `<div class="exercise-notes">${ex.notes}</div>` : ''}
                    </div>
                    ${previous ? `
                        <div class="previous-performance">
                            <div class="previous-label">Last Workout</div>
                            <div>${previous}</div>
                        </div>
                    ` : ''}
                </div>
                <div class="sets-container">
                    ${sets.map((set, setIdx) => `
                        <div class="set-row">
                            <div class="set-number">${setIdx + 1}</div>
                            <input type="number" class="set-input" placeholder="Weight" 
                                value="${set.weight}" 
                                onchange="updateSet('${ex.exerciseName}', ${setIdx}, 'weight', this.value)"
                                step="0.5">
                            <input type="number" class="set-input" placeholder="Reps" 
                                value="${set.reps}"
                                onchange="updateSet('${ex.exerciseName}', ${setIdx}, 'reps', this.value)">
                            <button class="set-complete-btn ${set.completed ? 'completed' : ''}"
                                onclick="toggleSetComplete('${ex.exerciseName}', ${setIdx})">
                                ✓
                            </button>
                        </div>
                    `).join('')}
                    <button class="add-set-btn" onclick="addSet('${ex.exerciseName}')">+ Add Set</button>
                </div>
                <textarea class="exercise-notes-input" placeholder="Notes (form, fatigue, etc...)"
                    onchange="updateExerciseNotes('${ex.exerciseName}', this.value)">${currentWorkout[ex.exerciseName + '_notes'] || ''}</textarea>
            </div>
        `;
    }).join('') + `
    <div>
        <button onclick="finishWorkout()">Finish</button>
    </div>`;
}

function getPreviousPerformance(exerciseName) {
    const previousSets = workoutLog
        .filter(log => log.exercise === exerciseName)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);
    
    if (previousSets.length === 0) return null;
    
    return previousSets.map(s => `${s.weight}kg × ${s.reps}`).join(', ');
}

function updateSet(exercise, setIdx, field, value) {
    currentWorkout[exercise][setIdx][field] = value;
}

function updateExerciseNotes(exercise, notes) {
    currentWorkout[exercise + '_notes'] = notes;
}

function toggleSetComplete(exercise, setIdx) {
    const set = currentWorkout[exercise][setIdx];
    set.completed = !set.completed;
    
    if (set.completed && set.weight && set.reps) {
        startTimer(config.defaultRestTime);
    }
    
    renderExercises();
}

function addSet(exercise) {
    currentWorkout[exercise].push({ weight: '', reps: '', completed: false });
    renderExercises();
}

// Timer
function startTimer(seconds) {
    timeRemaining = seconds;
    document.getElementById('restTimer').classList.remove('hidden');
    updateTimerDisplay();
    
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            stopTimer();
            // Optional: play sound or vibrate
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    document.getElementById('timerDisplay').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    document.getElementById('restTimer').classList.add('hidden');
}

function addTime(seconds) {
    timeRemaining += seconds;
    updateTimerDisplay();
}

// Save Workout
async function finishWorkout() {
    const today = new Date().toISOString().split('T')[0];
    const entries = [];
    
    for (const [exercise, sets] of Object.entries(currentWorkout)) {
        if (exercise.endsWith('_notes')) continue;
        
        sets.forEach((set, idx) => {
            if (set.completed && set.weight && set.reps) {
                entries.push({
                    date: today,
                    routine: currentRoutine,
                    exercise: exercise,
                    setNumber: idx + 1,
                    weight: parseFloat(set.weight),
                    reps: parseInt(set.reps),
                    notes: currentWorkout[exercise + '_notes'] || ''
                });
            }
        });
    }
    
    if (entries.length === 0) {
        showStatus('No completed sets to save', 'error');
        return;
    }
    
    try {
        await saveWorkoutLog(entries);
        showStatus('Workout saved successfully!', 'success');
        currentWorkout = {};
        await loadWorkoutLog();
        renderExercises();
    } catch (error) {
        console.error('Error saving workout:', error);
        showStatus('Error saving workout', 'error');
    }
}

// Manage Routines
function renderManageRoutines() {
    // Implementation for managing routines
    document.getElementById('routineManagement').innerHTML = `
        <div class="routine-editor">
            <h3>Manage Routines</h3>
            <p style="color: var(--text-secondary);">Edit your routines directly in Google Sheets for now. Full editing interface coming soon!</p>
            <button onclick="window.open('https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit', '_blank')">
                Open in Google Sheets
            </button>
        </div>
    `;
}

function addNewRoutine() {
    window.open(`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`, '_blank');
}

// Status Messages
function showStatus(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.innerHTML = `<div class="status-message ${type}">${message}</div>`;
    setTimeout(() => statusDiv.innerHTML = '', 5000);
}

// Initialize on load
window.onload = init;
