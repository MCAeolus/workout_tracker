// Calorie tracking functionality

// State
let calorieLog = [];
let currentChartPeriod = 'week';
let calorieChart = null;

// Initialize calorie tracking
async function initCalories() {
    try {
        await loadCalorieLog();
        renderCalorieView();
        updateCalorieChart(null, 'week');
    } catch (error) {
        console.error('Error initializing calories:', error);
        if (error.message === 'AUTH_EXPIRED') {
            showStatus('Session expired. Please sign in again.', 'error');
            setTimeout(() => handleAuthClick(), 2000);
        } else {
            showStatus('Error loading calorie data.', 'error');
        }
    }
}

// Load calorie log from Google Sheets
async function loadCalorieLog() {
    const data = await readSheetData('CalorieLog');
    
    if (data.length > 0) {
        const [headers, ...rows] = data;
        calorieLog = rows.map((row, index) => ({
            id: row[0] || `entry-${index}`,
            timestamp: row[1],
            description: row[2],
            calories: parseInt(row[3]) || 0,
            rowIndex: index + 2, // 1-indexed, pass over header row
        }));
    } else {
        calorieLog = [];
    }
}

// Add new calorie entry
async function addCalorieEntry(event) {
    event.preventDefault();
    const description = document.getElementById('mealDescription').value.trim();
    const calories = parseInt(document.getElementById('mealCalories').value);
    
    if (!description) {
        showStatus('Please enter a meal description', 'error');
        return;
    }
    
    if (!calories || calories <= 0) {
        showStatus('Please enter valid calories', 'error');
        return;
    }
    
    const entryId = `entry-${Date.now()}`;
    const timestamp = formatTimestamp(new Date());
    
    try {
        const response = await appendSheetData('CalorieLog', [[entryId, timestamp, description, calories]]);
        const updates = response.updates;
        const range = updates.updatedRange;

        const latestIndex = parseInt(range.split(":")[0].split("!")[1].substring(1)); // yikes

        // Add to local state
        calorieLog.push({
            id: entryId,
            timestamp: timestamp,
            description: description,
            calories: calories,
            rowIndex: latestIndex,
        });
        
        // Clear inputs
        document.getElementById('mealDescription').value = '';
        document.getElementById('mealCalories').value = '';
        
        // Update UI
        renderCalorieView();
        updateCalorieChart(event, currentChartPeriod);
        
        showStatus('Meal added successfully!', 'success');
    } catch (error) {
        console.error('Error adding calorie entry:', error);
        if (error.message === 'AUTH_EXPIRED') {
            showStatus('Session expired. Saving entry and redirecting...', 'error');
            localStorage.setItem('pendingCalorieEntry', JSON.stringify({ timestamp, description, calories }));
            setTimeout(() => handleAuthClick(), 2000);
        } else {
            showStatus('Error adding meal', 'error');
        }
    }
}

// Add delete function
async function deleteCalorieEntry(event, entryId) {
    event.preventDefault();
    if (!confirm('Delete this meal entry?')) {
        return;
    }
    
    try {
        // Find the entry
        const entryIndex = calorieLog.findIndex(e => e.id === entryId);
        if (entryIndex === -1) {
            showStatus('Entry not found', 'error');
            return;
        }
        
        const entry = calorieLog[entryIndex];
        
        // Delete from Google Sheets by clearing the row
        // Note: Google Sheets API doesn't have a direct "delete row" method
        // So we'll clear the values instead
        await callSheetsAPI(async () => {
            const response = await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: config.spreadsheetId,
                range: `CalorieLog!A${entry.rowIndex}:D${entry.rowIndex}`
            });
            return response.result;
        });
        
        // Remove from local state
        calorieLog.splice(entryIndex, 1);
        
        // Update UI
        renderCalorieView();
        updateCalorieChart(currentChartPeriod);
        
        showStatus('Meal deleted', 'success');
    } catch (error) {
        console.error('Error deleting entry:', error);
        if (error.message === 'AUTH_EXPIRED') {
            showStatus('Session expired. Please sign in again.', 'error');
            setTimeout(() => handleAuthClick(), 2000);
        } else {
            showStatus('Error deleting meal', 'error');
        }
    }
}

// Get today's total calories
function getTodayTotal() {
    const startOfToday = getStartOfDay();
    const endOfToday = getEndOfDay();
    
    return calorieLog
        .filter(entry => {
            const entryDate = parseDate(entry.timestamp);
            return entryDate >= startOfToday && entryDate <= endOfToday;
        })
        .reduce((sum, entry) => sum + entry.calories, 0);
}

// Get today's meals
function getTodayMeals() {
    const startOfToday = getStartOfDay();
    const endOfToday = getEndOfDay();
    
    return calorieLog
        .filter(entry => {
            const entryDate = parseDate(entry.timestamp);
            return entryDate >= startOfToday && entryDate <= endOfToday;
        })
        .sort((a, b) => parseDate(b.timestamp) - parseDate(a.timestamp));
}

// Get daily totals for a period
function getDailyTotals(days) {
    const dailyTotals = {};
    const startDate = getDaysAgo(days);
    
    // Initialize all days with 0
    for (let i = 0; i < days; i++) {
        const date = getDaysAgo(days - i - 1);
        const dateKey = formatDate(date);
        dailyTotals[dateKey] = 0;
    }
    
    // Sum up calories for each day
    calorieLog.forEach(entry => {
        const entryDate = parseDate(entry.timestamp);
        if (entryDate >= startDate) {
            const dateKey = formatDate(entryDate);
            if (dailyTotals[dateKey] !== undefined) {
                dailyTotals[dateKey] += entry.calories;
            }
        }
    });
    
    return dailyTotals;
}

// Render calorie view
function renderCalorieView() {
    // Update today's total
    const todayTotal = getTodayTotal();
    document.getElementById('todayTotal').textContent = todayTotal.toLocaleString();
    
    // Render today's meals
    const todayMeals = getTodayMeals();
    const mealsList = document.getElementById('todayMealsList');
    
    if (todayMeals.length === 0) {
        mealsList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No meals logged today</p>';
    } else {
        mealsList.innerHTML = todayMeals.map(meal => {
            const mealDate = parseDate(meal.timestamp);
            const timeStr = formatTime(mealDate);
            
            return `
                <div class="meal-entry">
                    <div class="meal-info">
                        <div class="meal-description">${meal.description}</div>
                        <div class="meal-time">${timeStr}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="meal-calories">${meal.calories} cal</div>
                        <button class="delete-meal-btn" onclick="deleteCalorieEntry(event, '${meal.id}')" title="Delete">×</button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Update calorie chart
function updateCalorieChart(event, period) {
    currentChartPeriod = period;
    
    // Update button states (only if called from event)
    if (typeof event !== 'undefined' && event && event.target) {
        document.querySelectorAll('.chart-btn').forEach(btn => btn.classList.remove('active'));
        //event.target.classList.add('active');
        // Also update the matching button in the other location
        const buttonText = event.target.textContent;
        document.querySelectorAll('.chart-btn').forEach(btn => {
            if (btn.textContent === buttonText) {
                btn.classList.add('active');
            }
        });
    } else {
        // Called programmatically, update based on period
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.classList.remove('active');
            if ((period === 'week' && btn.textContent === 'Week') ||
                (period === 'month' && btn.textContent === 'Month') ||
                (period === '3months' && btn.textContent === '3 Months')) {
                btn.classList.add('active');
            }
        });
    }

    let days;
    let label;
    
    switch (period) {
        case 'week':
            days = 7;
            label = 'Past 7 Days';
            break;
        case 'month':
            days = 30;
            label = 'Past 30 Days';
            break;
        case '3months':
            days = 90;
            label = 'Past 90 Days';
            break;
        default:
            days = 7;
            label = 'Past 7 Days';
    }
    
    const dailyTotals = getDailyTotals(days);
    const labels = Object.keys(dailyTotals).map(dateStr => {
        const date = parseDate(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const data = Object.values(dailyTotals);

    const daysWithData = data.filter(val => val > 0).length;
    const total = data.reduce((sum, val) => sum + val, 0);
    const average = daysWithData > 0 ? total / daysWithData : 0;
    
    // Calculate and display average
    document.getElementById('averageCalories').textContent = Math.round(average).toLocaleString();
    document.getElementById('averageLabel').textContent = `Daily Average (${label})`;
    
    
    renderChart(labels, data, label);
}

// Render the chart using Chart.js
function renderChart(labels, data, title) {
    const ctx = document.getElementById('calorieChart');

    // Get current theme colors from CSS variables
    const styles = getComputedStyle(document.documentElement);
    const accentColor = styles.getPropertyValue('--accent-primary').trim();
    const bgColor = styles.getPropertyValue('--bg-primary').trim();
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js not loaded yet');
        // Retry after a short delay
        setTimeout(() => renderChart(labels, data, title), 100);
        return;
    }

    // Destroy existing chart if it exists
    if (calorieChart) {
        //calorieChart.destroy();
        calorieChart.data.labels = labels;
        calorieChart.data.datasets[0].data = data;
        calorieChart.options.plugins.title.text = title;
        // Update colors too
        calorieChart.data.datasets[0].borderColor = accentColor;
        calorieChart.data.datasets[0].backgroundColor = accentColor + '1a'; // Add alpha
        calorieChart.data.datasets[0].pointBackgroundColor = accentColor;
        calorieChart.data.datasets[0].pointBorderColor = bgColor;

        calorieChart.update();
        return;
    }
    
    calorieChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Calories',
                data: data,
                borderColor: accentColor,
                backgroundColor: accentColor + '1a',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: accentColor,
                pointBorderColor: bgColor,
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: title,
                    color: '#ffffff',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    titleColor: '#ffffff',
                    bodyColor: '#a0a0a0',
                    borderColor: '#00ff88',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toLocaleString() + ' calories';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#282828',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#a0a0a0',
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                },
                x: {
                    grid: {
                        color: '#282828',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#a0a0a0',
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Handle pending calorie entry after re-auth
async function handlePendingCalorieEntry() {
    const pending = localStorage.getItem('pendingCalorieEntry');
    if (pending) {
        const entry = JSON.parse(pending);
        try {
            await appendSheetData('CalorieLog', [[entry.timestamp, entry.description, entry.calories]]);
            calorieLog.push(entry);
            localStorage.removeItem('pendingCalorieEntry');
            showStatus('Pending meal entry saved!', 'success');
            renderCalorieView();
            updateCalorieChart(null, currentChartPeriod);
        } catch (error) {
            console.error('Error saving pending entry:', error);
            showStatus('Failed to save pending meal entry', 'error');
        }
    }
}

// Initialize on page load if on calorie view
window.addEventListener('load', () => {
    // Check if we need to handle pending entry after re-auth
    if (localStorage.getItem('pendingCalorieEntry')) {
        handlePendingCalorieEntry();
    }
});
