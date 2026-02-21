// Shared utility functions for the workout tracker app

// Configuration (shared across modules)
let config = {
    clientId: '',
    spreadsheetId: '',
    defaultRestTime: 90,
    tessMode: false,
};

// OAuth State 
let tokenClient;
let accessToken = null;

// Load configuration from localStorage
function loadConfig() {
    const saved = localStorage.getItem('workoutTrackerConfig');
    if (saved) {
        config = JSON.parse(saved);
    }
    return config;
}

// Save configuration to localStorage
function saveConfigToStorage(newConfig) {
    config = { ...config, ...newConfig };
    localStorage.setItem('workoutTrackerConfig', JSON.stringify(config));
}

// Status message display
function showStatus(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) {
        console.log(`[${type}] ${message}`);
        return;
    }
    statusDiv.innerHTML = `<div class="status-message ${type}">${message}</div>`;
    setTimeout(() => statusDiv.innerHTML = '', 5000);
}

// Check if token is expired
function isTokenExpired() {
    const storedToken = localStorage.getItem('workoutTrackerToken');
    if (!storedToken) return true;
    
    const tokenInfo = JSON.parse(storedToken);
    return tokenInfo.expires_at <= Date.now();
}

// Handle OAuth authentication
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

// Handle OAuth token from redirect
function handleOAuthRedirect() {
    const hash = window.location.hash;
    if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        const expiresIn = params.get('expires_in');
        
        if (token) {
            // Store the token
            accessToken = token;
            gapi.client.setToken({ access_token: token });
            
            // Store token info for later
            const tokenInfo = {
                access_token: token,
                expires_at: Date.now() + (parseInt(expiresIn) * 1000) - 60000 // Subtract 1 minute buffer
            };
            localStorage.setItem('workoutTrackerToken', JSON.stringify(tokenInfo));
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return true;
        }
    }
    return false;
}

// Initialize stored token
function initializeStoredToken() {
    const storedToken = localStorage.getItem('workoutTrackerToken');
    if (storedToken) {
        const tokenInfo = JSON.parse(storedToken);
        if (tokenInfo.expires_at > Date.now()) {
            gapi.client.setToken({ access_token: tokenInfo.access_token });
            accessToken = tokenInfo.access_token;
            return true;
        } else {
            localStorage.removeItem('workoutTrackerToken');
        }
    }
    return false;
}

// Generic Google Sheets API call with error handling
async function callSheetsAPI(apiCall) {
    try {
        return await apiCall();
    } catch (error) {
        if (error.status === 401 || error.status === 403) {
            throw new Error('AUTH_EXPIRED');
        }
        throw error;
    }
}

// Read data from a sheet range
async function readSheetData(range) {
    return await callSheetsAPI(async () => {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: config.spreadsheetId,
            range: range,
        });
        return response.result.values || [];
    });
}

// Append data to a sheet
async function appendSheetData(range, values) {
    return await callSheetsAPI(async () => {
        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: config.spreadsheetId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: values
            }
        });
        return response.result;
    });
}

// Format date as YYYY-MM-DD
function formatDate(date) {
    let dateString = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
    console.log(date + " -> " + dateString);
    return dateString;
    //return date.toISOString().split('T')[0];
}

// Format time as HH:MM
function formatTime(date) {
    return date.toTimeString().slice(0, 5);
}

// Format timestamp as ISO string
function formatTimestamp(date) {
    return date.toISOString();
}

// Parse date string to Date object
function parseDate(dateString) {
    return new Date(dateString);
}

// Get start of day (midnight)
function getStartOfDay(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
}

// Get end of day (23:59:59.999)
function getEndOfDay(date = new Date()) {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
}

// Get date N days ago
function getDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        config,
        loadConfig,
        saveConfigToStorage,
        showStatus,
        isTokenExpired,
        handleAuthClick,
        handleOAuthRedirect,
        initializeStoredToken,
        callSheetsAPI,
        readSheetData,
        appendSheetData,
        formatDate,
        formatTime,
        formatTimestamp,
        parseDate,
        getStartOfDay,
        getEndOfDay,
        getDaysAgo
    };
}
