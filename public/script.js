const FOCUS_TIME = 52 * 60;
const BREAK_TIME = 17 * 60;

let timeLeft = FOCUS_TIME;
let timerId = null;
let isRunning = false;
let isFocusMode = true;

const timerDisplay = document.getElementById('timer-display');
const statusText = document.getElementById('status-text');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const historyList = document.getElementById('history-list');

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateDisplay() {
    timerDisplay.textContent = formatTime(timeLeft);
    document.title = `${formatTime(timeLeft)} - Base52`;
}

function switchMode() {
    isFocusMode = !isFocusMode;
    timeLeft = isFocusMode ? FOCUS_TIME : BREAK_TIME;

    // UI Updates for mode switch
    if (isFocusMode) {
        statusText.textContent = "Focus Mode";
        timerDisplay.classList.remove('break-mode');
        // Reset button color if we customized it
    } else {
        statusText.textContent = "Break Mode";
        timerDisplay.classList.add('break-mode');
    }

    updateDisplay();
}

async function saveSession(duration, type) {
    try {
        const response = await fetch('/api/save-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                duration: duration,
                type: type
            }),
        });

        if (response.ok) {
            console.log('Session saved successfully');
            fetchHistory(); // Refresh history
        } else {
            console.error('Failed to save session');
        }
    } catch (error) {
        console.error('Error saving session:', error);
    }
}

function startTimer() {
    if (isRunning) return;

    isRunning = true;
    startBtn.textContent = 'Pause';

    timerId = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            updateDisplay();
        } else {
            // Timer finished
            clearInterval(timerId);
            isRunning = false;
            startBtn.textContent = 'Start';

            // Audio/Visual alert usually goes here

            // Save session if it was a focus session
            if (isFocusMode) {
                saveSession(52, 'focus');
            }

            switchMode();

            // Auto-start break? Or wait for user?
            // Requirement says: "switch timer to 17:00 (Break mode)" - implying it waits.
            // But usually flow apps might auto-switch. sticking to requirements: switch details.
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerId);
    isRunning = false;
    startBtn.textContent = 'Start';
}

function resetTimer() {
    pauseTimer();
    isFocusMode = true; // Always reset to focus
    timeLeft = FOCUS_TIME;
    statusText.textContent = "Focus Mode";
    timerDisplay.classList.remove('break-mode');
    updateDisplay();
}

startBtn.addEventListener('click', () => {
    if (isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
});

resetBtn.addEventListener('click', resetTimer);

async function fetchHistory() {
    try {
        const response = await fetch('/api/history');
        if (!response.ok) throw new Error('Failed to fetch history');

        const sessions = await response.json();
        renderHistory(sessions);
    } catch (error) {
        console.error('Error fetching history:', error);
        historyList.innerHTML = '<li class="loading-text">Count not load history.</li>';
    }
}

function renderHistory(sessions) {
    historyList.innerHTML = '';

    if (sessions.length === 0) {
        historyList.innerHTML = '<li class="loading-text">No recent sessions found.</li>';
        return;
    }

    sessions.forEach(session => {
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

// Initial load
updateDisplay();
fetchHistory();
