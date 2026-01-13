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

// Zen & Features Elements
const zenToggle = document.getElementById('zen-toggle');
const soundBtns = document.querySelectorAll('.sound-btn');
const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskListUl = document.getElementById('task-list');

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
    timeLeft = isFocusMode ? FOCUS_TIME : BREAK_TIME;

    if (isFocusMode) {
        statusText.textContent = "Focus Mode";
        timerDisplay.classList.remove('break-mode');
    } else {
        statusText.textContent = "Break Mode";
        timerDisplay.classList.add('break-mode');
        // Auto-play break sound? (Optional)
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

function startTimer() {
    if (isRunning) return;

    isRunning = true;
    startBtn.textContent = 'Pause';
    startBtn.style.backgroundColor = '#6e7681'; // Dimmer color when pausing

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
                saveSession(52, 'focus');
                 // Play notification sound
                 new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3').play().catch(()=>console.log('Audio blocked'));
            } else {
                // Break ended
                new Audio('https://assets.mixkit.co/sfx/preview/mixkit-simple-notification-26.mp3').play().catch(()=>console.log('Audio blocked'));
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
    timeLeft = FOCUS_TIME;
    statusText.textContent = "Focus Mode";
    timerDisplay.classList.remove('break-mode');
    startBtn.textContent = 'Start Focus';
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

// --- Sound Logic ---
let currentSound = null;

soundBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const soundType = btn.dataset.sound;
        const audio = document.getElementById(`audio-${soundType}`);

        // If clicking active button, stop it
        if (btn.classList.contains('active')) {
            audio.pause();
            audio.currentTime = 0;
            btn.classList.remove('active');
            currentSound = null;
            return;
        }

        // Stop current if any
        if (currentSound) {
            // Find the button associated with currentSound
            const activeBtn = document.querySelector('.sound-btn.active');
            if (activeBtn) activeBtn.classList.remove('active');
            currentSound.pause();
            currentSound.currentTime = 0;
        }

        // Play new
        audio.play().then(() => {
            btn.classList.add('active');
            currentSound = audio;
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

        // Event Listeners
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

// History Logic
async function fetchHistory() {
    try {
        const response = await fetch('/api/history');
        if (!response.ok) throw new Error('Failed to fetch history');
        const sessions = await response.json();
        renderHistory(sessions);
    } catch (error) {
        // console.error('Error fetching history:', error); 
        // Silent fail or loading text
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

// Initial Init
updateDisplay();
fetchHistory();
renderTasks();

