// --- Constants & State ---
const DEFAULT_FOCUS_TIME = 52 * 60;
const DEFAULT_BREAK_TIME = 17 * 60;

// Load settings from local storage or default
let focusDuration = parseInt(localStorage.getItem('zen52_focus_time')) || DEFAULT_FOCUS_TIME;
let breakDuration = parseInt(localStorage.getItem('zen52_break_time')) || DEFAULT_BREAK_TIME;

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
const soundBtns = document.querySelectorAll('.sound-btn');
const soundSliders = document.querySelectorAll('.volume-slider');
const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskListUl = document.getElementById('task-list');

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const saveSettingsBtn = document.getElementById('save-settings');
const focusInput = document.getElementById('focus-duration');
const breakInput = document.getElementById('break-duration');

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

async function saveSession(duration, type) {
    try {
        const response = await fetch('/api/save-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration, type }),
        });

        if (response.ok) {
            fetchHistory();
        }
    } catch (error) {
        console.error('Error saving session:', error);
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

// --- Settings Logic ---
settingsBtn.addEventListener('click', () => {
    // Pre-populate values
    focusInput.value = Math.floor(focusDuration / 60);
    breakInput.value = Math.floor(breakDuration / 60);
    settingsModal.showModal();
});

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.close();
});

saveSettingsBtn.addEventListener('click', () => {
    const newFocus = parseInt(focusInput.value);
    const newBreak = parseInt(breakInput.value);

    if (newFocus > 0 && newBreak > 0) {
        focusDuration = newFocus * 60;
        breakDuration = newBreak * 60;

        // Save to local storage
        localStorage.setItem('zen52_focus_time', focusDuration);
        localStorage.setItem('zen52_break_time', breakDuration);

        // If timer is not running, update current display immediately if in relevant mode
        if (!isRunning) {
            if (isFocusMode) timeLeft = focusDuration;
            else timeLeft = breakDuration;
            updateDisplay();
        }

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
    // Ignore shortcuts if typing in input
    if (document.activeElement.tagName === 'INPUT') return;

    if (e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling
        if (isRunning) pauseTimer();
        else startTimer();
    }

    if (e.key.toLowerCase() === 'r') {
        resetTimer();
    }
});

// History Logic
async function fetchHistory() {
    try {
        const response = await fetch('/api/history');
        if (!response.ok) throw new Error('Failed to fetch history');
        const sessions = await response.json();
        renderHistory(sessions);
        renderChart(sessions);
    } catch (error) {
        // Silent fail
    }
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

// Initial Init
updateDisplay();
fetchHistory();
renderTasks();

