// --- Constants & State ---
const DEFAULT_FOCUS_TIME = 52 * 60;
const DEFAULT_BREAK_TIME = 17 * 60;

// Load settings from local storage or default
let focusDuration = parseInt(localStorage.getItem('zen52_focus_time')) || DEFAULT_FOCUS_TIME;
let breakDuration = parseInt(localStorage.getItem('zen52_break_time')) || DEFAULT_BREAK_TIME;
let dailyGoalHours = parseFloat(localStorage.getItem('zen52_daily_goal')) || 4;

let timeLeft = focusDuration;
let timerId = null;
let isRunning = false;
let isFocusMode = true;

// DOM Elements
const timerDisplay = document.getElementById('timer-display');
const statusText = document.getElementById('status-text');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const historyList = document.getElementById('history-list');

// Zen & Features Elements
const zenToggle = document.getElementById('zen-toggle');
const themeToggle = document.getElementById('theme-toggle'); // New
const streakContainer = document.getElementById('streak-container'); // New
const streakCountDisplay = document.getElementById('streak-count'); // New
const soundBtns = document.querySelectorAll('.sound-btn');
const soundSliders = document.querySelectorAll('.volume-slider');
const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskListUl = document.getElementById('task-list');

// Goal & Quote Elements
const dailyGoalText = document.getElementById('daily-goal-text');
const dailyGoalProgress = document.getElementById('daily-goal-progress');
const goalInput = document.getElementById('daily-goal-input'); // In Settings
const quoteText = document.getElementById('quote-text');
const scratchpad = document.getElementById('scratchpad'); // New

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const saveSettingsBtn = document.getElementById('save-settings');
const shortcutsBtn = document.getElementById('shortcuts-btn'); // New
const shortcutsModal = document.getElementById('shortcuts-modal'); // New
const closeShortcutsBtn = document.getElementById('close-shortcuts'); // New
const focusInput = document.getElementById('focus-duration');
const breakInput = document.getElementById('break-duration');

// --- Local Storage History Logic ---
let localSessions = JSON.parse(localStorage.getItem('zen52_sessions')) || [];

// --- Helper Functions ---
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateDisplay() {
    timerDisplay.textContent = formatTime(timeLeft);
    const mode = isFocusMode ? 'Focus' : 'Break';
    document.title = `${formatTime(timeLeft)} - ${mode} | Zen52`;
}

function switchMode() {
    isFocusMode = !isFocusMode;
    timeLeft = isFocusMode ? focusDuration : breakDuration;

    if (isFocusMode) {
        statusText.textContent = "Focus Mode";
        timerDisplay.classList.remove('break-mode');
    } else {
        statusText.textContent = "Break Mode";
        timerDisplay.classList.add('break-mode');
    }

    updateDisplay();
}

// --- Gamification Logic ---
function calculateStreak(sessions) {
    // Basic streak: Consecutive days with at least 1 focus session
    const uniqueDays = [...new Set(sessions
        .filter(s => s.type === 'focus')
        .map(s => new Date(s.created_at).toLocaleDateString())
    )]; // List of unique date strings

    // Convert keys to dates and sort descending
    const sortedDates = uniqueDays.map(d => new Date(d)).sort((a, b) => b - a);

    let streak = 0;
    if (sortedDates.length === 0) return 0;

    // For simplicity MVP: just count unique days in sorted list that effectively form a chain
    // But we need to ensure the chain starts from *now*.

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastSessionDate = sortedDates[0];
    lastSessionDate.setHours(0, 0, 0, 0);

    // If last session was before yesterday, streak is broken (0)
    // 86400000 ms = 1 day
    const diff = (today - lastSessionDate) / 86400000;

    if (diff > 1) return 0; // Broke streak

    streak = 1;
    for (let i = 0; i < sortedDates.length - 1; i++) {
        const curr = sortedDates[i].getTime();
        const prev = sortedDates[i + 1].getTime(); // Older date

        const dayDiff = Math.abs((curr - prev) / 86400000); // Should use abs or ensure sort order

        if (Math.round(dayDiff) === 1) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

function checkBadges(sessions) {
    const focusSessions = sessions.filter(s => s.type === 'focus');
    const totalMinutes = focusSessions.reduce((acc, curr) => acc + parseInt(curr.duration), 0);
    const currentStreak = calculateStreak(sessions);

    // Badges definitions
    const badges = {
        'novice': focusSessions.length >= 1,
        'streak': currentStreak >= 3,
        'master': (totalMinutes / 60) >= 10
    };

    // Update UI
    for (const [key, unlocked] of Object.entries(badges)) {
        const badgeEl = document.getElementById(`badge-${key}`);
        if (badgeEl) {
            if (unlocked) {
                if (badgeEl.classList.contains('locked')) {
                    // Just unlocked! Could toast here.
                    triggerNotification("Badge Unlocked!", `You earned the ${key} badge!`);
                }
                badgeEl.classList.remove('locked');
            } else {
                badgeEl.classList.add('locked');
            }
        }
    }

    return currentStreak;
}

function updateDailyGoal(sessions) {
    const todayStr = new Date().toLocaleDateString();

    // Filter sessions for today
    const todaySessions = sessions.filter(s =>
        s.type === 'focus' &&
        new Date(s.created_at).toLocaleDateString() === todayStr
    );

    const totalMinutes = todaySessions.reduce((acc, curr) => acc + parseInt(curr.duration), 0);
    const totalHours = totalMinutes / 60;

    // Render
    const percent = Math.min((totalHours / dailyGoalHours) * 100, 100);
    dailyGoalProgress.style.width = `${percent}%`;
    dailyGoalText.textContent = `${totalHours.toFixed(1)} / ${dailyGoalHours} hrs`;
}

const QUOTES = [
    "Focus is the key to productivity.",
    "Do one thing at a time.",
    "Simplicity is the ultimate sophistication.",
    "The journey of a thousand miles begins with one step.",
    "Productivity is being able to do things that you were never able to do before.",
    "Your future is created by what you do today, not tomorrow.",
    "It’s not always that we need to do more but rather that we need to focus on less.",
    "Starve your distractions, feed your focus.",
    "Don't busy, be productive.",
    "Flow with the moment."
];

function showRandomQuote() {
    const randomIndex = Math.floor(Math.random() * QUOTES.length);
    quoteText.textContent = `"${QUOTES[randomIndex]}"`;
}
async function saveSession(duration, type) {
    const session = {
        id: Date.now(),
        created_at: new Date().toISOString(),
        duration: duration,
        type: type
    };

    // 1. Save Locally
    localSessions.unshift(session);
    localStorage.setItem('zen52_sessions', JSON.stringify(localSessions));

    // Update UI immediately (Local First!)
    fetchHistory();

    // 2. Try Backend (Silent Sync)
    try {
        await fetch('/api/save-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration, type }),
        });
    } catch (error) {
        console.log('Backend sync failed, but saved locally.');
    }
}

function triggerNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
    }
}

function startTimer() {
    if (isRunning) return;

    // Request Notification permission on first start
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }

    isRunning = true;
    startBtn.textContent = 'Pause';
    startBtn.style.backgroundColor = '#6e7681';

    timerId = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            updateDisplay();
        } else {
            clearInterval(timerId);
            isRunning = false;
            startBtn.textContent = 'Start Focus';
            startBtn.style.backgroundColor = '';

            if (isFocusMode) {
                saveSession(Math.floor(focusDuration / 60), 'focus');
                // Play notification sound
                new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3').play().catch(() => console.log('Audio blocked'));
                triggerNotification("Focus Complete", "Great job! Time for a break.");
            } else {
                new Audio('https://assets.mixkit.co/sfx/preview/mixkit-simple-notification-26.mp3').play().catch(() => console.log('Audio blocked'));
                triggerNotification("Break Over", "Time to focus again.");
            }

            switchMode();
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerId);
    isRunning = false;
    startBtn.textContent = 'Resume';
    startBtn.style.backgroundColor = '';
}

function resetTimer() {
    pauseTimer();
    isFocusMode = true;
    timeLeft = focusDuration;
    statusText.textContent = "Focus Mode";
    timerDisplay.classList.remove('break-mode');
    startBtn.textContent = 'Start Focus';
    updateDisplay();
}

// --- Event Listeners ---

startBtn.addEventListener('click', () => {
    if (isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
});

resetBtn.addEventListener('click', resetTimer);

// --- Zen Mode ---
zenToggle.addEventListener('click', () => {
    document.body.classList.toggle('zen-mode');
    const icon = zenToggle.querySelector('i');
    if (document.body.classList.contains('zen-mode')) {
        icon.classList.replace('fa-expand', 'fa-compress');
    } else {
        icon.classList.replace('fa-compress', 'fa-expand');
    }
});

// --- Theme Toggle ---
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const icon = themeToggle.querySelector('i');
    const isLight = document.body.classList.contains('light-mode');

    // Switch Icon
    if (isLight) icon.classList.replace('fa-sun', 'fa-moon');
    else icon.classList.replace('fa-moon', 'fa-sun');

    // Save pref
    localStorage.setItem('zen52_theme', isLight ? 'light' : 'dark');
});

// Load Theme
if (localStorage.getItem('zen52_theme') === 'light') {
    document.body.classList.add('light-mode');
    themeToggle.querySelector('i').classList.replace('fa-sun', 'fa-moon');
}

// --- Settings Logic ---
settingsBtn.addEventListener('click', () => {
    // Pre-populate values
    focusInput.value = Math.floor(focusDuration / 60);
    breakInput.value = Math.floor(breakDuration / 60);
    if (goalInput) goalInput.value = dailyGoalHours;
    settingsModal.showModal();
});

// Presets (both in settings and main screen)
document.querySelectorAll('.preset-chip, .preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const newFocus = parseInt(btn.dataset.focus);
        const newBreak = parseInt(btn.dataset.break);

        if (newFocus && newBreak) {
            focusDuration = newFocus * 60;
            breakDuration = newBreak * 60;

            // Save to localStorage
            localStorage.setItem('zen52_focus_time', focusDuration);
            localStorage.setItem('zen52_break_time', breakDuration);

            // Update timer if not running
            if (!isRunning) {
                if (isFocusMode) timeLeft = focusDuration;
                else timeLeft = breakDuration;
                updateDisplay();
            }

            // Update active state for chips
            document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
            if (btn.classList.contains('preset-chip')) {
                btn.classList.add('active');
            }

            // Update settings inputs if modal is open
            if (focusInput) focusInput.value = newFocus;
            if (breakInput) breakInput.value = newBreak;
        }
    });
});

// Custom Timer Logic
const customTimerBtn = document.getElementById('custom-timer-btn');
const customTimerInput = document.getElementById('custom-timer-input');
const quickFocusInput = document.getElementById('quick-focus');
const quickBreakInput = document.getElementById('quick-break');
const applyCustomBtn = document.getElementById('apply-custom-btn');

if (customTimerBtn) {
    customTimerBtn.addEventListener('click', () => {
        customTimerInput.classList.toggle('hidden');
        // Pre-fill with current values
        quickFocusInput.value = Math.floor(focusDuration / 60);
        quickBreakInput.value = Math.floor(breakDuration / 60);
    });
}

if (applyCustomBtn) {
    applyCustomBtn.addEventListener('click', () => {
        const newFocus = parseInt(quickFocusInput.value);
        const newBreak = parseInt(quickBreakInput.value);

        if (newFocus > 0 && newBreak > 0) {
            focusDuration = newFocus * 60;
            breakDuration = newBreak * 60;

            localStorage.setItem('zen52_focus_time', focusDuration);
            localStorage.setItem('zen52_break_time', breakDuration);

            if (!isRunning) {
                if (isFocusMode) timeLeft = focusDuration;
                else timeLeft = breakDuration;
                updateDisplay();
            }

            // Hide input and mark custom as active
            customTimerInput.classList.add('hidden');
            document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
            customTimerBtn.classList.add('active');
        }
    });
}

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.close();
});

saveSettingsBtn.addEventListener('click', () => {
    const newFocus = parseInt(focusInput.value);
    const newBreak = parseInt(breakInput.value);
    const newGoal = parseFloat(goalInput.value);

    if (newFocus > 0 && newBreak > 0 && newGoal > 0) {
        focusDuration = newFocus * 60;
        breakDuration = newBreak * 60;
        dailyGoalHours = newGoal;

        // Save to local storage
        localStorage.setItem('zen52_focus_time', focusDuration);
        localStorage.setItem('zen52_break_time', breakDuration);
        localStorage.setItem('zen52_daily_goal', dailyGoalHours);

        // If timer is not running, update current display immediately if in relevant mode
        if (!isRunning) {
            if (isFocusMode) timeLeft = focusDuration;
            else timeLeft = breakDuration;
            updateDisplay();
        }

        fetchHistory(); // Update goal UI if changed
        settingsModal.close();
    } else {
        alert("Please enter valid positive numbers.");
    }
});

// --- Sound Logic & Volume ---
let currentSound = null;

// Volume Sliders
soundSliders.forEach(slider => {
    slider.addEventListener('input', (e) => {
        const soundType = e.target.dataset.sound;
        const audio = document.getElementById(`audio-${soundType}`);
        audio.volume = e.target.value;
    });
    // Set initial volume
    const soundType = slider.dataset.sound;
    const audio = document.getElementById(`audio-${soundType}`);
    if (audio) audio.volume = slider.value;
});

// Play Buttons
soundBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const soundType = btn.dataset.sound;
        const audio = document.getElementById(`audio-${soundType}`);

        // Match volume to slider
        const slider = document.querySelector(`.volume-slider[data-sound="${soundType}"]`);
        if (slider) audio.volume = slider.value;

        // Toggle Logic
        if (btn.classList.contains('active')) {
            audio.pause();
            audio.currentTime = 0;
            btn.classList.remove('active');

            // If this was the only sound playing, clear currentSound (simple logic)
            if (currentSound === audio) currentSound = null;
            return;
        }

        // Allow multiple sounds? Why not (It's a "Mixer" feature). 
        // Previously we stopped others. Now let's allow mixing since we added volume controls!
        // but if user wants single focus, they can just click one.

        // Play
        audio.play().then(() => {
            btn.classList.add('active');
            currentSound = audio; // Track last played
        }).catch(e => {
            console.log("Audio file missing or blocked", e);
            alert(`Tip: Place a file named '${soundType}.mp3' in public/sounds/ to hear this!`);
        });
    });
});

// --- Task List Logic ---
let tasks = JSON.parse(localStorage.getItem('zen52_tasks')) || [];

function saveTasks() {
    localStorage.setItem('zen52_tasks', JSON.stringify(tasks));
    renderTasks();
}

function renderTasks() {
    taskListUl.innerHTML = '';
    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <span class="task-text">${task.text}</span>
            <button class="task-delete"><i class="fa-solid fa-trash"></i></button>
        `;

        const checkbox = li.querySelector('.task-checkbox');
        checkbox.addEventListener('change', () => {
            tasks[index].completed = checkbox.checked;
            saveTasks();
        });

        const deleteBtn = li.querySelector('.task-delete');
        deleteBtn.addEventListener('click', () => {
            tasks.splice(index, 1);
            saveTasks();
        });

        taskListUl.appendChild(li);
    });
}

function addTask() {
    const text = taskInput.value.trim();
    if (text) {
        tasks.push({ text, completed: false });
        taskInput.value = '';
        saveTasks();
    }
}

addTaskBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
});

// --- Keyboard Shortcuts ---
document.addEventListener('keydown', (e) => {
    // Ignore shortcuts if typing in input or textarea
    const activeElement = document.activeElement;
    const isTyping = activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA';

    if (isTyping) return;

    if (e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling
        if (isRunning) pauseTimer();
        else startTimer();
    }

    if (e.key.toLowerCase() === 'r') {
        resetTimer();
    }

    if (e.key.toLowerCase() === 'm') {
        toggleMute();
    }
});

// History Logic
function fetchHistory() {
    // 1. Load from Local Variable (which is synced with localStorage)
    const sessions = localSessions;

    // 2. Render
    renderHistory(sessions);
    renderChart(sessions);

    // 3. Logic
    const streak = checkBadges(sessions);
    if (streak > 0) {
        streakCountDisplay.textContent = streak;
        streakContainer.classList.remove('hidden');
    } else {
        streakContainer.classList.add('hidden');
    }

    updateDailyGoal(sessions);
}

// --- Data Backup & Restore ---
const exportBtn = document.getElementById('export-data-btn');
const importBtn = document.getElementById('import-data-btn');
const importInput = document.getElementById('import-file-input');

if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const data = {
            sessions: JSON.parse(localStorage.getItem('zen52_sessions') || '[]'),
            tasks: JSON.parse(localStorage.getItem('zen52_tasks') || '[]'),
            settings: {
                focus: localStorage.getItem('zen52_focus_time'),
                break: localStorage.getItem('zen52_break_time'),
                theme: localStorage.getItem('zen52_theme')
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zen52_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

if (importBtn) {
    importBtn.addEventListener('click', () => importInput.click());

    importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);

                // Restore
                if (data.sessions) localStorage.setItem('zen52_sessions', JSON.stringify(data.sessions));
                if (data.tasks) localStorage.setItem('zen52_tasks', JSON.stringify(data.tasks));
                if (data.settings) {
                    if (data.settings.focus) localStorage.setItem('zen52_focus_time', data.settings.focus);
                    if (data.settings.break) localStorage.setItem('zen52_break_time', data.settings.break);
                    if (data.settings.theme) localStorage.setItem('zen52_theme', data.settings.theme);
                }

                alert('Data imported successfully! Reloading...');
                location.reload();
            } catch (err) {
                alert('Invalid backup file.');
            }
        };
        reader.readAsText(file);
    });
}

function renderHistory(sessions) {
    historyList.innerHTML = '';
    // Show top 5 recent in list
    const recentSessions = sessions.slice(0, 5);

    if (recentSessions.length === 0) {
        historyList.innerHTML = '<li class="loading-text">No recent sessions found.</li>';
        return;
    }
    recentSessions.forEach(session => {
        const date = new Date(session.created_at).toLocaleDateString();
        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerHTML = `
            <span class="type">${session.type === 'focus' ? 'Focus Session' : 'Break'}</span>
            <span class="time">${session.duration}m &middot; ${date}</span>
        `;
        historyList.appendChild(li);
    });
}

// --- Chart Logic ---
let focusChart = null;

function renderChart(sessions) {
    if (typeof renderHeatmap === 'function') renderHeatmap(sessions);
    const ctx = document.getElementById('weekly-chart');
    if (!ctx) return;

    // Group by Date for the last 7 days
    const dailyTotals = {};
    sessions.forEach(session => {
        if (session.type === 'focus') {
            // Normalize date to string (local locale)
            const dateStr = new Date(session.created_at).toLocaleDateString();
            dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + parseInt(session.duration);
        }
    });

    const labels = [];
    const data = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString();
        const dayName = i === 0 ? 'Today' : days[d.getDay()];

        labels.push(dayName);
        data.push(dailyTotals[dateStr] || 0);
    }

    if (focusChart) {
        focusChart.destroy();
    }

    // Chart.js requires script tag in html, assumed present
    if (typeof Chart !== 'undefined') {
        focusChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Focus Minutes',
                    data: data,
                    backgroundColor: '#238636',
                    borderRadius: 4,
                    hoverBackgroundColor: '#2ea043'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#30363d' },
                        ticks: { color: '#8b949e' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#8b949e' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

// --- Heatmap Logic ---
function renderHeatmap(sessions) {
    const grid = document.getElementById('heatmap-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Calculate daily totals for last 365 days
    const dailyTotals = {};
    sessions.forEach(session => {
        if (session.type === 'focus') {
            const dateStr = new Date(session.created_at).toLocaleDateString();
            dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + parseInt(session.duration);
        }
    });

    // Generate last ~52 weeks (approx 364 days to keep grid clean 7x52)
    const today = new Date();
    // Start date: 52 weeks ago (aligned to Sunday if we want standard calendar, but simplify for now)
    // Actually, let's just do 52 columns * 7 rows = 364 squares
    // We render backwards or forwards? Usually columns are weeks.

    // We need 52 colums. Each column 7 rows (Sun-Sat).
    // Let's iterate weeks, then days.

    // Determine start date: Today minus 364 days?
    // Let's just create 365 divs? CSS grid-auto-flow: column handles the wrapping if we fix rows to 7.
    // We need to order them correctly. grid-auto-flow: column fills col 1 (row1...7), then col 2.
    // So we just need to push days in chronological order.

    const startDate = new Date();
    startDate.setDate(today.getDate() - 364);
    // Adjustment to align start date to a Sunday?
    // If we indiscriminately push days, and the first day is Wednesday, it will appear as Sunday (row 1).
    // To align correctly: calculate offset to previous Sunday.
    const dayOfWeek = startDate.getDay(); // 0 (Sun) to 6 (Sat)
    startDate.setDate(startDate.getDate() - dayOfWeek); // Go back to Sunday

    // Now loop for 53 weeks * 7 days to cover full width or until Today
    const oneYearFromStart = new Date(today); // cap it?

    // Let's render 53 weeks
    for (let i = 0; i < 53 * 7; i++) {
        const current = new Date(startDate);
        current.setDate(startDate.getDate() + i);

        if (current > today) break; // Don't show future? Or fill with empty.

        const dateStr = current.toLocaleDateString();
        const minutes = dailyTotals[dateStr] || 0;

        let level = 0;
        if (minutes > 0) level = 1;
        if (minutes >= 30) level = 2;
        if (minutes >= 60) level = 3;
        if (minutes >= 120) level = 4;

        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.dataset.level = level;
        cell.title = `${dateStr}: ${minutes} mins`;
        grid.appendChild(cell);
    }
}

// Chart Toggling
const chartToggleBtn = document.getElementById('chart-toggle-btn');
const chartContainer = document.getElementById('chart-container');
const heatmapContainer = document.getElementById('heatmap-container');

if (chartToggleBtn) {
    // Load pref - DEFAULT TO HEATMAP
    const pref = localStorage.getItem('zen52_chart_pref') || 'heatmap';
    if (pref === 'heatmap') {
        chartContainer.classList.add('hidden');
        heatmapContainer.classList.remove('hidden');
        chartToggleBtn.querySelector('i').classList.replace('fa-chart-simple', 'fa-border-all');
    }

    chartToggleBtn.addEventListener('click', () => {
        const isBar = !chartContainer.classList.contains('hidden');
        if (isBar) {
            // Switch to Heatmap
            chartContainer.classList.add('hidden');
            heatmapContainer.classList.remove('hidden');
            chartToggleBtn.querySelector('i').classList.replace('fa-chart-simple', 'fa-border-all');
            localStorage.setItem('zen52_chart_pref', 'heatmap');
        } else {
            // Switch to Bar
            heatmapContainer.classList.add('hidden');
            chartContainer.classList.remove('hidden');
            chartToggleBtn.querySelector('i').classList.replace('fa-border-all', 'fa-chart-simple');
            localStorage.setItem('zen52_chart_pref', 'bar');
        }
    });
}

// Hook into fetchHistory to render heatmap
const originalFetchHistory = fetchHistory; // Wait, I can just append to the function body via replace... 
// But I am rewriting the end of the file or specific logic? 
// The tool I'm using replaces a block.
// I replaced renderChart logic above. I should ensure renderHeatmap is CALLED.
// Let's modify the fetchHistory function or helper.
// Actually, I can just call renderHeatmap(sessions) inside renderChart? No, different responsibility.
// Let's update renderChart to also call renderHeatmap or update fetchHistory.
// Since I am replacing the renderChart function definition above, I can't easily hook there.
// I will just add renderHeatmap(sessions) to the end of renderChart? 
// No, better to update fetchHistory. But I am replacing the end of the file.

// Let's just update renderChart to ALWAYS update the heatmap data too, since they share the same sessions data.
// That way fetchHistory calls renderChart -> renderChart updates both visuals.
// Efficient enough for now.

// Wait, looking at the ReplacementContent above... I am defining renderHeatmap but NOT calling it.
// I will rewrite renderChart above to call renderHeatmap(sessions) at start or end.

// RE-WRITING RenderChart start to include heatmap call:
/*
function renderChart(sessions) {
    renderHeatmap(sessions); // <--- Added
    const ctx = document.getElementById('weekly-chart');
...
*/

// --- Scratchpad Logic ---
if (scratchpad) {
    // Load
    scratchpad.value = localStorage.getItem('zen52_scratchpad') || '';

    // Save
    scratchpad.addEventListener('input', () => {
        localStorage.setItem('zen52_scratchpad', scratchpad.value);
    });
}

// --- Shortcuts Modal Logic ---
if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', () => shortcutsModal.showModal());
    closeShortcutsBtn.addEventListener('click', () => shortcutsModal.close());
    // Close on backdrop click
    shortcutsModal.addEventListener('click', (e) => {
        if (e.target === shortcutsModal) shortcutsModal.close();
    });
}

// --- Mute Logic Helper ---
function toggleMute() {
    let anyMuted = false;
    // Check if any active sound is muted (simplified: just toggle all based on first)
    // Actually, let's just mute/unmute all Audio elements
    const audios = document.querySelectorAll('audio'); // We created them dynamically? No, we need to grab them.
    // Wait, we don't have audio tags, we create new Audio() objects in startTimer? 
    // Ah, ambient sounds uses <audio> tags? No, the code says:  const audio = document.getElementById(`audio-${soundType}`);
    // So there ARE audio tags in HTML.

    const allAudios = document.querySelectorAll('audio');
    let allMuted = true;
    allAudios.forEach(a => {
        if (!a.muted) allMuted = false;
    });

    const newState = !allMuted;
    allAudios.forEach(a => {
        a.muted = newState;
    });

    triggerNotification(newState ? "Muted" : "Unmuted", "All sounds audio toggled.");
}

// Initial Init
updateDisplay();
fetchHistory();
renderTasks();
showRandomQuote();

