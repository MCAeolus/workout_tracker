// Configuration
let config = {
    clientId: '',
    spreadsheetId: '',
    defaultRestTime: 90,
    tessMode: false,
};

// Constants
let flavorText = [
    {main: "\"Victorious warriors win first and then go to war\"", secondary: "The Art of War"},
    {main: "\"In the midst of chaos, there is also opportunity\"", secondary: "The Art of War"},
    {main: "\"Discipline is the soul of an army\"", secondary: "The Art of War"},
    {main: "\"If you know yourself, you need not fear the result of a hundred battles\"", secondary: "The Art of War"},
    {main: "\"The slowest march is better than standing still\"", secondary: "The Art of War"},
    {main: "\"Supreme excellence consists of breaking the enemy's resistance without fighting\"", secondary: "The Art of War"},
    {main: "¯\\_(ツ)_/¯", secondary: "Ran Out of Quotes"},
]
const TOKEN_WORKOUT_TRACKER = 'workoutTrackerToken';

// OAuth State 
let tokenClient;
let accessToken = null;

// State
let routines = [];
let workoutLog = [];
let currentRoutine = null;
let currentWorkout = {};
let timerInterval = null;
let timeRemaining = 0;
let timerWorker = new Worker('timer.js'); 
let activeTabs = {};

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
            localStorage.setItem(TOKEN_WORKOUT_TRACKER, JSON.stringify(tokenInfo));

            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    if (config.clientId && config.spreadsheetId) {
        initializeGoogleAPI();
    }

    // choose random flavor text
    flavor = flavorText[Math.floor(Math.random()*flavorText.length)];
    document.getElementById("subtitleFlavorText").innerHTML = flavor.main;
    document.getElementById("subtitleFlavorTextSecondary").innerHTML = flavor.secondary;
}

// Initialize Google API
function initializeGoogleAPI() {
    // Load the Google API client library
    gapi.load('client', async () => {
        await gapi.client.init({
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        });
        
        // Check for stored token
        const storedToken = localStorage.getItem(TOKEN_WORKOUT_TRACKER);
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
                localStorage.removeItem(TOKEN_WORKOUT_TRACKER);
            }
        }
        
        if (hasValidToken) {
            // Already authenticated
            document.getElementById('setupScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            loadData();

            // if we saved state last time
            const pendingData = localStorage.getItem('workoutTrackerPendingRoutine');
            if (pendingData) {
                const entries = JSON.parse(localStorage.getItem('workoutTrackerPendingWorkout'));
                if (entries.length == 0) {
                    localStorage.removeItem('workoutTrackerPendingWorkout');
                    localStorage.removeItem('workoutTrackerPendingRoutine');
                    return;
                }
                showStatus('Saving previous workout...', 'success');

                try {
                    await saveWorkoutLog(entries);
                    localStorage.removeItem('workoutTrackerPendingWorkout');
                    localStorage.removeItem('workoutTrackerPendingRoutine');

                    showStatus('Successfully saved previous workout.', 'success');
                } catch (error) {
                    showStatus('Failed to save previous workout. Local storage still saved, please try again later.', 'error')
                }
            }



        } else {
            // Need to authenticate
            document.getElementById('setupScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            
            // Show a "Sign In Required" message
            showStatus('Please sign in to access your workout data (redirecting)', 'error');
            
            // Optionally auto-trigger auth (comment out if you want manual)
            handleAuthClick();
        }
    });
}

function isTokenExpired() {
    const stored = localStorage.getItem(TOKEN_WORKOUT_TRACKER);
    if (!stored) return true;

    const tokenInfo = JSON.parse(stored);
    return tokenInfo.expires_at <= Date.now();
}

async function ensureValidToken() {
    if (!isTokenExpired()) return true;

    showStatus('Session expired. Please sign in again...', 'error');
    handleAuthClick();
    return false;
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
            localStorage.removeItem(TOKEN_WORKOUT_TRACKER);
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
        document.getElementById('tessMode').checked = config.tessMode;
    }
    if (config.tessMode) {
        document.documentElement.classList.toggle('tess-mode');
    }
}

function saveConfig() {
    const clientId = document.getElementById('clientIdInput')?.value || document.getElementById('settingsClientId').value;
    const spreadsheetId = document.getElementById('spreadsheetIdInput')?.value || document.getElementById('settingsSpreadsheetId').value;
    const restTime = document.getElementById('defaultRestTime')?.value || 90;
    const tessMode = document.getElementById('tessMode')?.checked || false;

    if (!clientId || !spreadsheetId) {
        showStatus('Please enter both Client ID and Spreadsheet ID', 'error');
        return;
    }

    config = { clientId, spreadsheetId, defaultRestTime: parseInt(restTime), tessMode, };
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
            secondaryName: row[2],
            notes: row[3] || '',
            defaultSets: parseInt(row[4]) || 3
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
            secondaryExercise: row[3],
            setNumber: parseInt(row[4]),
            weight: parseFloat(row[5]),
            reps: parseInt(row[6]),
            notes: row[7] || ''
        }));
    }
}

async function saveWorkoutLog(entries) {
    const rows = entries.map(e => {
        const [name1, name2] = e.exercise.split(";")
        return [
            e.date,
            e.routine,
            name1,
            name2,
            e.setNumber,
            e.weight,
            e.reps,
            e.notes
        ];
    });

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
            <div class="routine-card" onclick="selectRoutine(event, '${name}')">
                <div class="routine-name">${name}</div>
                <div class="routine-exercises">${exercises.length} exercises</div>
            </div>
        `;
    }).join('');
}

function selectRoutine(event, name) {
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
    
    // Clear existing content
    list.innerHTML = '';
    
    // Group exercises
    const groupedExercises = {};
    exercises.forEach(ex => {
        if (!groupedExercises[ex.exerciseName]) {
            groupedExercises[ex.exerciseName] = [];
        }
        groupedExercises[ex.exerciseName].push(ex);
    });
    
    // Create exercise groups
    for (const [exerciseName, groupExercises] of Object.entries(groupedExercises)) {
        const groupElement = createExerciseGroup(exerciseName, groupExercises, activeTabs);
        list.appendChild(groupElement);
    }
    
    // Add finish button
    const finishBtn = document.createElement('button');
    finishBtn.textContent = 'Finish Workout';
    finishBtn.style.marginTop = '24px';
    finishBtn.onclick = finishWorkout;
    list.appendChild(finishBtn);
}

function createExerciseGroup(exerciseName, groupExercises, activeTabs) {
    const template = document.getElementById('exercise-group-template');
    const clone = template.content.cloneNode(true);
    
    // IMPORTANT: Get the container element before modifying
    const container = clone.querySelector('.exercise-item');
    
    // Set exercise name
    container.querySelector('.exercise-name').textContent = exerciseName;
    
    // Determine active variation
    const activeSecondary = activeTabs[exerciseName] ?? (groupExercises[0].secondaryName || '');
    const activeExercise = groupExercises.find(ex => (ex.secondaryName || '') === activeSecondary);
    
    // Set previous performance
    const previous = getPreviousPerformance(activeExercise.exerciseName, activeExercise.secondaryName);
    const prevElement = container.querySelector('.previous-performance');
    if (previous) {
        prevElement.classList.remove('hidden');
        prevElement.querySelector('.previous-value').textContent = previous;
    }

    // Add notes if present
    if (activeExercise.notes) {
        const notesElement = container.querySelector('.exercise-notes');
        notesElement.textContent = activeExercise.notes;
        notesElement.classList.remove('hidden');
    }
    
    // Create tabs if multiple variations
    const tabsContainer = container.querySelector('.exercise-tabs');
    if (groupExercises.length > 1) {
        tabsContainer.classList.remove('hidden');
        groupExercises.forEach(ex => {
            const tab = createExerciseTab(ex, exerciseName, activeSecondary);
            tabsContainer.appendChild(tab);
        });
    }
    
    // Create content for each variation
    const contentWrapper = container.querySelector('.exercise-content-wrapper');
    groupExercises.forEach((ex, idx) => {
        const content = createExerciseContent(ex, exerciseName, activeSecondary, container);
        contentWrapper.appendChild(content);
    });
    
    return clone;
}

function createExerciseTab(exercise, exerciseName, activeSecondary) {
    const template = document.getElementById('exercise-tab-template');
    const tab = template.content.cloneNode(true).querySelector('.exercise-tab');
    
    const displayName = exercise.secondaryName || exerciseName;
    tab.textContent = displayName;
    
    if ((exercise.secondaryName || '') === activeSecondary) {
        tab.classList.add('active');
    }
    
    tab.onclick = (e) => switchExerciseTab(exercise, e);
    
    return tab;
}

function createExerciseContent(exercise, exerciseName, activeSecondary, container) {
    const template = document.getElementById('exercise-content-template');
    const content = template.content.cloneNode(true).querySelector('.exercise-content');
    
    const exerciseKey = `${exercise.exerciseName}${exercise.secondaryName ? ';' + exercise.secondaryName : ''}`;
    
    // Set data attributes
    content.dataset.exercise = exerciseName;
    content.dataset.secondary = exercise.secondaryName || '';
    
    // Set active state
    if ((exercise.secondaryName || '') === activeSecondary) {
        content.classList.add('active');
    }
    
    // Create sets
    const sets = currentWorkout[exerciseKey] || Array(exercise.defaultSets).fill().map(() => ({
        weight: '',
        reps: '',
        completed: false
    }));
    currentWorkout[exerciseKey] = sets;
    
    const setsContainer = content.querySelector('.sets-container');
    sets.forEach((set, idx) => {
        const setRow = createSetRow(set, idx, exerciseKey);
        setsContainer.appendChild(setRow);
    });
    
    // Add "Add Set" button
    const addSetBtn = document.createElement('button');
    addSetBtn.className = 'add-set-btn';
    addSetBtn.textContent = '+ Add Set';
    addSetBtn.onclick = () => addSet(exerciseKey);
    setsContainer.appendChild(addSetBtn);
    
    // Setup notes textarea
    const notesInput = content.querySelector('.exercise-notes-input');
    notesInput.value = currentWorkout[exerciseKey + '_notes'] || '';
    notesInput.onchange = (e) => updateExerciseNotes(exerciseKey, e.target.value);
    
    return content;
}

function createSetRow(set, setIdx, exerciseKey) {
    const template = document.getElementById('set-row-template');
    const row = template.content.cloneNode(true).querySelector('.set-row');
    
    // Set number
    row.querySelector('.set-number').textContent = setIdx + 1;
    
    // Weight input
    const weightInput = row.querySelectorAll('.set-input')[0];
    weightInput.value = set.weight;
    weightInput.onchange = (e) => updateSet(exerciseKey, setIdx, 'weight', e.target.value);
    
    // Reps input
    const repsInput = row.querySelectorAll('.set-input')[1];
    repsInput.value = set.reps;
    repsInput.onchange = (e) => updateSet(exerciseKey, setIdx, 'reps', e.target.value);
    
    // Complete button
    const completeBtn = row.querySelector('.set-complete-btn');
    if (set.completed) {
        completeBtn.classList.add('completed');
    }
    completeBtn.onclick = () => toggleSetComplete(exerciseKey, setIdx);
    
    return row;
}



/*
function renderExercises() {
    const exercises = routines.filter(r => r.routineName === currentRoutine);
    const list = document.getElementById('exerciseList');
    
    // Store currently active tabs before re-rendering
    const activeTabs = {};
    document.querySelectorAll('.exercise-content.active').forEach(content => {
        const exerciseName = content.dataset.exercise;
        const secondaryName = content.dataset.secondary;
        activeTabs[exerciseName] = secondaryName;
    });
    
    // Group exercises by primary exercise name
    const groupedExercises = {};
    exercises.forEach(ex => {
        if (ex.exerciseName in groupedExercises) {
            groupedExercises[ex.exerciseName].push(ex);
        } else {
            groupedExercises[ex.exerciseName] = [ex];
        }
    });
    
    let finalHTML = "";
    
    // Iterate through each exercise group
    for (const [exerciseName, groupExercises] of Object.entries(groupedExercises)) {
        // Determine which tab should be active (preserve previous selection or default to first)
        const activeSecondary = activeTabs[exerciseName] !== undefined ? activeTabs[exerciseName] : (groupExercises[0].secondaryName || '');
        
        // Create tabs for each variation in the group
        const tabsHTML = groupExercises.map((ex, idx) => {
            const tabId = `${exerciseName}-${ex.secondaryName || 'default'}`.replace(/\s/g, '-');
            const isActive = (ex.secondaryName || '') === activeSecondary ? 'active' : '';
            const displayName = ex.secondaryName || exerciseName;
            return `
                <button class="exercise-tab ${isActive}" 
                    onclick="switchExerciseTab('${exerciseName}', '${ex.secondaryName || ''}', event)">
                    ${displayName}
                </button>
            `;
        }).join('');
        
        // Create content for each variation
        const contentHTML = groupExercises.map((ex, idx) => {
            const isActive = (ex.secondaryName || '') === activeSecondary ? 'active' : '';
            const exerciseKey = `${ex.exerciseName}${ex.secondaryName ? '-' + ex.secondaryName : ''}`;
            const previous = getPreviousPerformance(ex.exerciseName, ex.secondaryName);
            const sets = currentWorkout[exerciseKey] || Array(ex.defaultSets).fill().map(() => ({
                weight: '',
                reps: '',
                completed: false
            }));
            
            currentWorkout[exerciseKey] = sets;
            
            return `
                <div class="exercise-content ${isActive}" data-exercise="${exerciseName}" data-secondary="${ex.secondaryName || ''}">
                    ${previous ? `
                        <div class="previous-performance">
                            <div class="previous-label">Last Workout</div>
                            <div>${previous}</div>
                        </div>
                    ` : ''}
                    ${ex.notes ? `<div class="exercise-notes" style="margin-bottom: 12px;">${ex.notes}</div>` : ''}
                    <div class="sets-container">
                        ${sets.map((set, setIdx) => `
                            <div class="set-row">
                                <div class="set-number">${setIdx + 1}</div>
                                <input type="number" class="set-input" placeholder="Weight" 
                                    value="${set.weight}" 
                                    onchange="updateSet('${exerciseKey}', ${setIdx}, 'weight', this.value)"
                                    step="0.5">
                                <input type="number" class="set-input" placeholder="Reps" 
                                    value="${set.reps}"
                                    onchange="updateSet('${exerciseKey}', ${setIdx}, 'reps', this.value)">
                                <button class="set-complete-btn ${set.completed ? 'completed' : ''}"
                                    onclick="toggleSetComplete('${exerciseKey}', ${setIdx})">
                                    ✓
                                </button>
                            </div>
                        `).join('')}
                        <button class="add-set-btn" onclick="addSet('${exerciseKey}')">+ Add Set</button>
                    </div>
                    <textarea class="exercise-notes-input" placeholder="Notes (form, fatigue, etc...)"
                        onchange="updateExerciseNotes('${exerciseKey}', this.value)">${currentWorkout[exerciseKey + '_notes'] || ''}</textarea>
                </div>
            `;
        }).join('');
        
        // Combine into exercise group card
        finalHTML += `
            <div class="exercise-item">
                <div class="exercise-header">
                    <h3>${exerciseName}</h3>
                </div>
                ${groupExercises.length > 1 ? `
                    <div class="exercise-tabs">
                        ${tabsHTML}
                    </div>
                ` : ''}
                <div class="exercise-content-wrapper">
                    ${contentHTML}
                </div>
            </div>
        `;
    }
    
    finalHTML += `
        <div style="margin-top: 24px;">
            <button onclick="finishWorkout()">Finish Workout</button>
        </div>
    `;
    
    list.innerHTML = finalHTML;
}
*/
// Helper function to switch between exercise variations
function switchExerciseTab(exercise, event) {
    // update state
    activeTabs[exercise.exerciseName] = exercise.secondaryName;

    // Update active tab
    exerciseName = exercise.exerciseName
    secondaryName = exercise.secondaryName
    const tabButtons = event.target.parentElement.querySelectorAll('.exercise-tab');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    

    const exerciseItem = event.target.closest('.exercise-item');
    // Update active content
    const contentWrapper = exerciseItem.querySelector('.exercise-content-wrapper');
    const contents = contentWrapper.querySelectorAll('.exercise-content');
    contents.forEach(content => {
        if (content.dataset.exercise === exerciseName && content.dataset.secondary === secondaryName) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // Update notes
    const notesWrapper = exerciseItem.querySelector('.exercise-notes')
    if (exercise.notes) {
        notesWrapper.classList.remove('hidden');
        notesWrapper.textContent = exercise.notes;
    } else {
        notesWrapper.classList.add('hidden');
    }

    // Update previous performance in header
    prev = getPreviousPerformance(exerciseName, secondaryName);
    const prevContainer = exerciseItem.querySelector('.previous-performance');
    if (prev) {
        prevContainer.querySelector('.previous-value').textContent = prev;
        prevContainer.classList.remove('hidden');
    } else {
        prevContainer.classList.add('hidden');
    }
}

function getPreviousPerformance(exerciseName, secondaryExercise) {
    const previousSets = workoutLog
        .filter(log => log.exercise === exerciseName && log.secondaryExercise === secondaryExercise)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);
    
    if (previousSets.length === 0) return null;
    
    return previousSets.map(s => `${s.weight}lb × ${s.reps}`).join(', ');
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
timerWorker.onmessage = function(e) {
    if (e.data.type === 'tick') {
        timeRemaining = e.data.timeRemaining;
        updateTimerDisplay();
    } else if (e.data.type === 'complete') {
        stopTimer();
        try {
            navigator.vibrate([200, 100, 200]);
        } catch (error) {
            console.log("tried to vibrate but device doesn't support it");
        }
    }
};

function startTimer(seconds) {
    timeRemaining = seconds;
    document.getElementById('restTimer').classList.remove('hidden');
    updateTimerDisplay();
    
    // Single worker handles "only one timer" requirement
    timerWorker.postMessage({ action: 'start', seconds });
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    document.getElementById('timerDisplay').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function stopTimer() {
    timerWorker.postMessage({ action: 'stop' });
    document.getElementById('restTimer').classList.add('hidden');
}

function addTime(seconds) {
    timerWorker.postMessage({ action: 'add', seconds });
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

    // store existing workout state for refresh
    localStorage.setItem('workoutTrackerPendingWorkout', JSON.stringify(entries));
    localStorage.setItem('workoutTrackerPendingRoutine', currentRoutine);
    
    try {
        await saveWorkoutLog(entries);
        showStatus('Workout saved successfully!', 'success');

        // remove local storage in case of auth
        localStorage.removeItem('workoutTrackerPendingWorkout');
        localStorage.removeItem('workoutTrackerPendingRoutine');
    
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
    window.scrollTo(0,0)
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.innerHTML = `<div class="status-message ${type}">${message}</div>`;
    setTimeout(() => statusDiv.innerHTML = '', 5000);
}

// Initialize on load
window.onload = init;
