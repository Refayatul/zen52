const DEFAULT_FOCUS_TIME = 52 * 60;
const DEFAULT_BREAK_TIME = 17 * 60;
const SESSIONS_BEFORE_LONG_BREAK = 4;
const LONG_BREAK_DURATION = 25 * 60;

const storage = {
    getNumber(key, fallback) {
        const value = Number(localStorage.getItem(key));
        return Number.isFinite(value) && value > 0 ? value : fallback;
    },
    getJSON(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "");
            return value ?? fallback;
        } catch {
            return fallback;
        }
    },
    setJSON(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

let focusDuration = storage.getNumber("zen52_focus_time", DEFAULT_FOCUS_TIME);
let breakDuration = storage.getNumber("zen52_break_time", DEFAULT_BREAK_TIME);
let dailyGoalHours = storage.getNumber("zen52_daily_goal", 4);
let currentSession = storage.getNumber("zen52_current_session", 1);
let timeLeft = focusDuration;
let timerId = null;
let isRunning = false;
let isFocusMode = true;
let localSessions = storage.getJSON("zen52_sessions", []);
let tasks = storage.getJSON("zen52_tasks", []);

const timerDisplay = document.getElementById("timer-display");
const statusText = document.getElementById("status-text");
const startBtn = document.getElementById("start-btn");
const resetBtn = document.getElementById("reset-btn");
const historyList = document.getElementById("history-list");
const zenToggle = document.getElementById("zen-toggle");
const themeToggle = document.getElementById("theme-toggle");
const streakContainer = document.getElementById("streak-container");
const streakCountDisplay = document.getElementById("streak-count");
const dailyGoalText = document.getElementById("daily-goal-text");
const dailyGoalProgress = document.getElementById("daily-goal-progress");
const quoteText = document.getElementById("quote-text");
const scratchpad = document.getElementById("scratchpad");
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const closeSettingsBtn = document.getElementById("close-settings");
const saveSettingsBtn = document.getElementById("save-settings");
const focusInput = document.getElementById("focus-duration");
const breakInput = document.getElementById("break-duration");
const goalInput = document.getElementById("daily-goal-input");
const shortcutsBtn = document.getElementById("shortcuts-btn");
const shortcutsModal = document.getElementById("shortcuts-modal");
const closeShortcutsBtn = document.getElementById("close-shortcuts");
const taskInput = document.getElementById("task-input");
const addTaskBtn = document.getElementById("add-task-btn");
const taskList = document.getElementById("task-list");
const customTimerBtn = document.getElementById("custom-timer-btn");
const customTimerInput = document.getElementById("custom-timer-input");
const quickFocusInput = document.getElementById("quick-focus");
const quickBreakInput = document.getElementById("quick-break");
const applyCustomBtn = document.getElementById("apply-custom-btn");
const chartToggleBtn = document.getElementById("chart-toggle-btn");
const chartContainer = document.getElementById("chart-container");
const heatmapContainer = document.getElementById("heatmap-container");
const weeklyChart = document.getElementById("weekly-chart");
const heatmapGrid = document.getElementById("heatmap-grid");
const exportBtn = document.getElementById("export-data-btn");
const importBtn = document.getElementById("import-data-btn");
const importInput = document.getElementById("import-file-input");
const clearScratchpadBtn = document.getElementById("clear-scratchpad-btn");
const sessionNotesModal = document.getElementById("session-notes-modal");
const sessionNoteInput = document.getElementById("session-note-input");
const saveNoteBtn = document.getElementById("save-note-btn");
const skipNoteBtn = document.getElementById("skip-note-btn");
const breakModal = document.getElementById("break-modal");
const breakSuggestion = document.getElementById("break-suggestion");
const closeBreakBtn = document.getElementById("close-break-btn");
const startBreathingBtn = document.getElementById("start-breathing-btn");
const breathingExercise = document.getElementById("breathing-exercise");
const breathInstruction = document.getElementById("breath-instruction");
const soundBtns = document.querySelectorAll(".sound-btn");
const soundSliders = document.querySelectorAll(".volume-slider");

const QUOTES = [
    "Do one thing at a time.",
    "Attention is a limited resource. Spend it deliberately.",
    "A clear desk starts with a clear next task.",
    "The goal is not more hours. The goal is better attention.",
    "Protect the first minute and the next fifty-one get easier.",
    "Less switching. More finishing.",
    "Depth beats urgency when the work matters."
];

const BREAK_SUGGESTIONS = [
    "Stand up and stretch for two minutes.",
    "Drink a glass of water.",
    "Look at something far away for 20 seconds.",
    "Take a short walk around the room.",
    "Take five slow breaths.",
    "Roll your shoulders and relax your neck.",
    "Stretch your wrists and fingers.",
    "Step away from the screen before the next block."
];

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function updateDisplay() {
    timerDisplay.textContent = formatTime(timeLeft);
    document.title = `${formatTime(timeLeft)} - ${isFocusMode ? "Focus" : "Break"} | Zen52`;
}

function setStartButton(label, paused = false) {
    startBtn.textContent = label;
    startBtn.classList.toggle("is-paused", paused);
}

function requestNotifications() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

function notify(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
    }
}

function playTone(frequency = 660) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = frequency;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
    } catch {
        // Audio is optional.
    }
}

function switchMode() {
    isFocusMode = !isFocusMode;
    if (isFocusMode) {
        timeLeft = focusDuration;
        statusText.textContent = "Focus Mode";
        timerDisplay.classList.remove("break-mode");
        setStartButton("Start Focus");
    } else {
        const isLongBreak = currentSession > SESSIONS_BEFORE_LONG_BREAK;
        timeLeft = isLongBreak ? LONG_BREAK_DURATION : breakDuration;
        statusText.textContent = isLongBreak ? "Long Break" : "Break Mode";
        timerDisplay.classList.add("break-mode");
        setStartButton("Start Break");
        showBreakModal();
    }
    updateDisplay();
}

function completeInterval() {
    clearInterval(timerId);
    timerId = null;
    isRunning = false;

    if (isFocusMode) {
        saveSession(Math.floor(focusDuration / 60), "focus");
        currentSession += 1;
        if (currentSession > SESSIONS_BEFORE_LONG_BREAK + 1) currentSession = 1;
        localStorage.setItem("zen52_current_session", currentSession);
        updateCycleIndicator();
        playTone(720);
        notify("Focus complete", "Time for a deliberate break.");
        sessionNotesModal?.showModal();
    } else {
        if (currentSession > SESSIONS_BEFORE_LONG_BREAK) {
            currentSession = 1;
            localStorage.setItem("zen52_current_session", currentSession);
            updateCycleIndicator();
        }
        playTone(520);
        notify("Break over", "Start the next focus block when ready.");
    }

    switchMode();
}

function startTimer() {
    if (isRunning) return;
    requestNotifications();
    isRunning = true;
    setStartButton("Pause", true);
    timerId = setInterval(() => {
        if (timeLeft <= 0) {
            completeInterval();
            return;
        }
        timeLeft -= 1;
        updateDisplay();
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerId);
    timerId = null;
    isRunning = false;
    setStartButton("Resume");
}

function resetTimer() {
    pauseTimer();
    isFocusMode = true;
    timeLeft = focusDuration;
    statusText.textContent = "Focus Mode";
    timerDisplay.classList.remove("break-mode");
    setStartButton("Start Focus");
    updateDisplay();
}

function saveSession(duration, type) {
    const session = {
        id: Date.now(),
        created_at: new Date().toISOString(),
        duration,
        type
    };
    localSessions.unshift(session);
    storage.setJSON("zen52_sessions", localSessions);
    renderData();

    fetch("/api/save-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration, type })
    }).catch(() => {});
}

function calculateStreak(sessions) {
    const focusDays = [...new Set(
        sessions
            .filter(session => session.type === "focus")
            .map(session => {
                const date = new Date(session.created_at);
                date.setHours(0, 0, 0, 0);
                return date.getTime();
            })
    )].sort((a, b) => b - a);

    if (!focusDays.length) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const latestDiff = Math.round((today.getTime() - focusDays[0]) / 86400000);
    if (latestDiff > 1) return 0;

    let streak = 1;
    for (let i = 0; i < focusDays.length - 1; i += 1) {
        const dayDiff = Math.round((focusDays[i] - focusDays[i + 1]) / 86400000);
        if (dayDiff === 1) streak += 1;
        else break;
    }
    return streak;
}

function updateBadges(sessions) {
    const focusSessions = sessions.filter(session => session.type === "focus");
    const totalMinutes = focusSessions.reduce((total, session) => total + Number(session.duration || 0), 0);
    const streak = calculateStreak(sessions);
    const badges = {
        novice: focusSessions.length >= 1,
        streak: streak >= 3,
        master: totalMinutes >= 600
    };

    Object.entries(badges).forEach(([key, unlocked]) => {
        const badge = document.getElementById(`badge-${key}`);
        badge?.classList.toggle("locked", !unlocked);
    });

    streakCountDisplay.textContent = streak;
    streakContainer.classList.toggle("hidden", streak === 0);
}

function updateDailyGoal(sessions) {
    const today = new Date().toLocaleDateString();
    const totalMinutes = sessions
        .filter(session => session.type === "focus" && new Date(session.created_at).toLocaleDateString() === today)
        .reduce((total, session) => total + Number(session.duration || 0), 0);
    const totalHours = totalMinutes / 60;
    const percent = Math.min((totalHours / dailyGoalHours) * 100, 100);
    dailyGoalProgress.style.width = `${percent}%`;
    dailyGoalText.textContent = `${totalHours.toFixed(1)} / ${dailyGoalHours} hrs`;
}

function renderHistory(sessions) {
    historyList.replaceChildren();
    const recent = sessions.slice(0, 6);
    if (!recent.length) {
        const empty = document.createElement("li");
        empty.className = "loading-text";
        empty.textContent = "No sessions yet.";
        historyList.appendChild(empty);
        return;
    }

    recent.forEach(session => {
        const item = document.createElement("li");
        item.className = "history-item";
        const type = document.createElement("span");
        type.className = "type";
        type.textContent = session.type === "focus" ? "Focus session" : "Break";
        const time = document.createElement("span");
        time.className = "time";
        time.textContent = `${session.duration}m · ${new Date(session.created_at).toLocaleDateString()}`;
        item.append(type, time);
        historyList.appendChild(item);
    });
}

function getDailyTotals(sessions) {
    return sessions.reduce((days, session) => {
        if (session.type !== "focus") return days;
        const date = new Date(session.created_at).toLocaleDateString();
        days[date] = (days[date] || 0) + Number(session.duration || 0);
        return days;
    }, {});
}

function renderWeeklyChart(sessions) {
    weeklyChart.replaceChildren();
    const totals = getDailyTotals(sessions);
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const values = [];

    for (let i = 6; i >= 0; i -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        values.push({
            label: i === 0 ? "Today" : labels[date.getDay()],
            value: totals[date.toLocaleDateString()] || 0
        });
    }

    const max = Math.max(...values.map(day => day.value), 60);
    values.forEach(day => {
        const wrap = document.createElement("div");
        wrap.className = "bar-wrap";
        const bar = document.createElement("div");
        bar.className = "bar";
        bar.style.height = `${Math.max(4, (day.value / max) * 160)}px`;
        bar.title = `${day.label}: ${day.value} minutes`;
        const label = document.createElement("span");
        label.textContent = day.label;
        wrap.append(bar, label);
        weeklyChart.appendChild(wrap);
    });
}

function heatLevel(minutes) {
    if (minutes >= 120) return 4;
    if (minutes >= 60) return 3;
    if (minutes >= 30) return 2;
    if (minutes > 0) return 1;
    return 0;
}

function renderHeatmap(sessions) {
    heatmapGrid.replaceChildren();
    const totals = getDailyTotals(sessions);
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    for (let i = 0; i < 53 * 7; i += 1) {
        const current = new Date(startDate);
        current.setDate(startDate.getDate() + i);
        if (current > today) break;
        const dateKey = current.toLocaleDateString();
        const minutes = totals[dateKey] || 0;
        const cell = document.createElement("div");
        cell.className = "heatmap-cell";
        cell.dataset.level = heatLevel(minutes);
        cell.title = `${dateKey}: ${minutes} minutes`;
        heatmapGrid.appendChild(cell);
    }
}

function renderData() {
    renderHistory(localSessions);
    renderWeeklyChart(localSessions);
    renderHeatmap(localSessions);
    updateBadges(localSessions);
    updateDailyGoal(localSessions);
}

function updateCycleIndicator() {
    document.querySelectorAll(".cycle-dot").forEach((dot, index) => {
        dot.classList.toggle("completed", index < currentSession - 1);
        dot.classList.toggle("active", index === Math.min(currentSession, 4) - 1);
    });
    const label = document.getElementById("cycle-label");
    if (label) label.textContent = `Session ${Math.min(currentSession, 4)}/4`;
}

function saveTasks() {
    storage.setJSON("zen52_tasks", tasks);
    renderTasks();
}

function renderTasks() {
    taskList.replaceChildren();
    if (!tasks.length) {
        const empty = document.createElement("li");
        empty.className = "loading-text";
        empty.textContent = "No active tasks.";
        taskList.appendChild(empty);
        return;
    }

    tasks.forEach((task, index) => {
        const item = document.createElement("li");
        item.className = "task-item";

        const checkbox = document.createElement("input");
        checkbox.className = "task-checkbox";
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(task.completed);
        checkbox.addEventListener("change", () => {
            tasks[index].completed = checkbox.checked;
            saveTasks();
        });

        const text = document.createElement("span");
        text.className = "task-text";
        text.textContent = task.text;

        const del = document.createElement("button");
        del.className = "task-delete";
        del.type = "button";
        del.setAttribute("aria-label", `Delete ${task.text}`);
        del.textContent = "×";
        del.addEventListener("click", () => {
            tasks.splice(index, 1);
            saveTasks();
        });

        item.append(checkbox, text, del);
        taskList.appendChild(item);
    });
}

function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;
    tasks.push({ text, completed: false });
    taskInput.value = "";
    saveTasks();
}

function applyDurations(focusMinutes, breakMinutes) {
    if (!Number.isFinite(focusMinutes) || !Number.isFinite(breakMinutes) || focusMinutes <= 0 || breakMinutes <= 0) {
        alert("Please enter valid positive numbers.");
        return false;
    }

    focusDuration = focusMinutes * 60;
    breakDuration = breakMinutes * 60;
    localStorage.setItem("zen52_focus_time", focusDuration);
    localStorage.setItem("zen52_break_time", breakDuration);

    if (!isRunning) {
        timeLeft = isFocusMode ? focusDuration : breakDuration;
        updateDisplay();
    }
    return true;
}

function updatePresetActive(focusMinutes, breakMinutes, target) {
    document.querySelectorAll(".preset-chip").forEach(chip => {
        const matches = Number(chip.dataset.focus) === focusMinutes && Number(chip.dataset.break) === breakMinutes;
        chip.classList.toggle("active", target ? chip === target : matches);
    });
}

function showBreakModal() {
    if (!breakModal || !breakSuggestion) return;
    const text = BREAK_SUGGESTIONS[Math.floor(Math.random() * BREAK_SUGGESTIONS.length)];
    breakSuggestion.textContent = text;
    breathingExercise?.classList.add("hidden");
    startBreathingBtn?.classList.remove("hidden");
    breakModal.showModal();
}

let audioContext = null;
const ambience = new Map();

function getAudioContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
}

function makeNoiseBuffer(ctx) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
}

function startAmbience(type, volume) {
    const ctx = getAudioContext();
    const gain = ctx.createGain();
    gain.gain.value = volume;

    const source = ctx.createBufferSource();
    source.buffer = makeNoiseBuffer(ctx);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = type === "rain" ? "highpass" : "lowpass";
    filter.frequency.value = type === "rain" ? 900 : type === "forest" ? 520 : 360;

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();

    let lfo;
    if (type !== "rain") {
        lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = type === "waves" ? 0.12 : 0.35;
        lfoGain.gain.value = type === "waves" ? 0.18 : 0.08;
        lfo.connect(lfoGain).connect(gain.gain);
        lfo.start();
    }

    ambience.set(type, { source, gain, lfo });
}

function stopAmbience(type) {
    const item = ambience.get(type);
    if (!item) return;
    item.source.stop();
    item.lfo?.stop();
    ambience.delete(type);
}

function setAmbienceVolume(type, volume) {
    const item = ambience.get(type);
    if (item) item.gain.gain.value = volume;
}

function toggleMute() {
    if (!ambience.size) return;
    const shouldMute = [...ambience.values()].some(item => item.gain.gain.value > 0);
    ambience.forEach((item, type) => {
        const slider = document.querySelector(`.volume-slider[data-sound="${type}"]`);
        item.gain.gain.value = shouldMute ? 0 : Number(slider?.value || 0.4);
    });
}

startBtn.addEventListener("click", () => {
    if (isRunning) pauseTimer();
    else startTimer();
});

resetBtn.addEventListener("click", resetTimer);

zenToggle.addEventListener("click", () => {
    document.body.classList.toggle("zen-mode");
});

themeToggle.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-mode");
    themeToggle.querySelector("span").textContent = isLight ? "☾" : "☼";
    localStorage.setItem("zen52_theme", isLight ? "light" : "dark");
});

settingsBtn.addEventListener("click", () => {
    focusInput.value = Math.floor(focusDuration / 60);
    breakInput.value = Math.floor(breakDuration / 60);
    goalInput.value = dailyGoalHours;
    settingsModal.showModal();
});

closeSettingsBtn.addEventListener("click", () => settingsModal.close());

saveSettingsBtn.addEventListener("click", () => {
    const focusMinutes = Number(focusInput.value);
    const breakMinutes = Number(breakInput.value);
    const goal = Number(goalInput.value);
    if (!applyDurations(focusMinutes, breakMinutes) || !Number.isFinite(goal) || goal <= 0) {
        alert("Please enter valid positive numbers.");
        return;
    }
    dailyGoalHours = goal;
    localStorage.setItem("zen52_daily_goal", dailyGoalHours);
    updatePresetActive(focusMinutes, breakMinutes);
    renderData();
    settingsModal.close();
});

document.querySelectorAll(".preset-chip, .preset-btn").forEach(button => {
    button.addEventListener("click", () => {
        const focusMinutes = Number(button.dataset.focus);
        const breakMinutes = Number(button.dataset.break);
        if (!focusMinutes || !breakMinutes) return;
        applyDurations(focusMinutes, breakMinutes);
        updatePresetActive(focusMinutes, breakMinutes, button.classList.contains("preset-chip") ? button : null);
        focusInput.value = focusMinutes;
        breakInput.value = breakMinutes;
    });
});

customTimerBtn.addEventListener("click", () => {
    customTimerInput.classList.toggle("hidden");
    quickFocusInput.value = Math.floor(focusDuration / 60);
    quickBreakInput.value = Math.floor(breakDuration / 60);
});

applyCustomBtn.addEventListener("click", () => {
    const focusMinutes = Number(quickFocusInput.value);
    const breakMinutes = Number(quickBreakInput.value);
    if (!applyDurations(focusMinutes, breakMinutes)) return;
    customTimerInput.classList.add("hidden");
    updatePresetActive(focusMinutes, breakMinutes, customTimerBtn);
});

addTaskBtn.addEventListener("click", addTask);
taskInput.addEventListener("keydown", event => {
    if (event.key === "Enter") addTask();
});

chartToggleBtn.addEventListener("click", () => {
    const showBars = chartContainer.classList.contains("hidden");
    chartContainer.classList.toggle("hidden", !showBars);
    heatmapContainer.classList.toggle("hidden", showBars);
    chartToggleBtn.textContent = showBars ? "▥" : "▦";
    localStorage.setItem("zen52_chart_pref", showBars ? "bar" : "heatmap");
});

soundBtns.forEach(button => {
    button.addEventListener("click", async () => {
        const type = button.dataset.sound;
        const slider = document.querySelector(`.volume-slider[data-sound="${type}"]`);
        if (ambience.has(type)) {
            stopAmbience(type);
            button.classList.remove("active");
            return;
        }
        startAmbience(type, Number(slider?.value || 0.4));
        button.classList.add("active");
    });
});

soundSliders.forEach(slider => {
    slider.addEventListener("input", () => setAmbienceVolume(slider.dataset.sound, Number(slider.value)));
});

if (scratchpad) {
    scratchpad.value = localStorage.getItem("zen52_scratchpad") || "";
    scratchpad.addEventListener("input", () => localStorage.setItem("zen52_scratchpad", scratchpad.value));
}

clearScratchpadBtn.addEventListener("click", () => {
    if (!scratchpad.value || confirm("Clear all brain dump notes?")) {
        scratchpad.value = "";
        localStorage.setItem("zen52_scratchpad", "");
    }
});

shortcutsBtn.addEventListener("click", () => shortcutsModal.showModal());
closeShortcutsBtn.addEventListener("click", () => shortcutsModal.close());

[settingsModal, shortcutsModal, sessionNotesModal, breakModal].forEach(modal => {
    modal?.addEventListener("click", event => {
        if (event.target === modal) modal.close();
    });
});

saveNoteBtn.addEventListener("click", () => {
    const note = sessionNoteInput.value.trim();
    if (note) {
        const notes = storage.getJSON("zen52_session_notes", []);
        notes.unshift({
            note,
            timestamp: new Date().toISOString(),
            duration: Math.floor(focusDuration / 60)
        });
        storage.setJSON("zen52_session_notes", notes.slice(0, 50));
    }
    sessionNoteInput.value = "";
    sessionNotesModal.close();
});

skipNoteBtn.addEventListener("click", () => {
    sessionNoteInput.value = "";
    sessionNotesModal.close();
});

closeBreakBtn.addEventListener("click", () => {
    breakModal.close();
    breathingExercise.classList.add("hidden");
});

startBreathingBtn.addEventListener("click", () => {
    breathingExercise.classList.remove("hidden");
    startBreathingBtn.classList.add("hidden");
    const phases = [
        { text: "Breathe in...", duration: 4000 },
        { text: "Hold...", duration: 7000 },
        { text: "Breathe out...", duration: 8000 }
    ];
    let phaseIndex = 0;
    let cycles = 0;

    function runPhase() {
        if (!breakModal.open || cycles >= 3) {
            breathInstruction.textContent = "Done.";
            startBreathingBtn.classList.remove("hidden");
            return;
        }
        breathInstruction.textContent = phases[phaseIndex].text;
        setTimeout(() => {
            phaseIndex += 1;
            if (phaseIndex >= phases.length) {
                phaseIndex = 0;
                cycles += 1;
            }
            runPhase();
        }, phases[phaseIndex].duration);
    }

    runPhase();
});

exportBtn.addEventListener("click", () => {
    const data = {
        sessions: localSessions,
        tasks,
        notes: storage.getJSON("zen52_session_notes", []),
        scratchpad: localStorage.getItem("zen52_scratchpad") || "",
        settings: {
            focus: focusDuration,
            break: breakDuration,
            dailyGoal: dailyGoalHours,
            theme: localStorage.getItem("zen52_theme") || "dark"
        }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zen52_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => importInput.click());
importInput.addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (Array.isArray(data.sessions)) localStorage.setItem("zen52_sessions", JSON.stringify(data.sessions));
            if (Array.isArray(data.tasks)) localStorage.setItem("zen52_tasks", JSON.stringify(data.tasks));
            if (Array.isArray(data.notes)) localStorage.setItem("zen52_session_notes", JSON.stringify(data.notes));
            if (typeof data.scratchpad === "string") localStorage.setItem("zen52_scratchpad", data.scratchpad);
            if (data.settings) {
                if (data.settings.focus) localStorage.setItem("zen52_focus_time", data.settings.focus);
                if (data.settings.break) localStorage.setItem("zen52_break_time", data.settings.break);
                if (data.settings.dailyGoal) localStorage.setItem("zen52_daily_goal", data.settings.dailyGoal);
                if (data.settings.theme) localStorage.setItem("zen52_theme", data.settings.theme);
            }
            location.reload();
        } catch {
            alert("Invalid backup file.");
        }
    };
    reader.readAsText(file);
});

document.addEventListener("keydown", event => {
    const active = document.activeElement;
    const isTyping = active && ["INPUT", "TEXTAREA"].includes(active.tagName);
    if (isTyping) return;

    if (event.code === "Space") {
        event.preventDefault();
        if (isRunning) pauseTimer();
        else startTimer();
    }
    if (event.key.toLowerCase() === "r") resetTimer();
    if (event.key.toLowerCase() === "m") toggleMute();
});

function init() {
    if (localStorage.getItem("zen52_theme") === "light") {
        document.body.classList.add("light-mode");
        themeToggle.querySelector("span").textContent = "☾";
    }

    const chartPref = localStorage.getItem("zen52_chart_pref") || "heatmap";
    chartContainer.classList.toggle("hidden", chartPref !== "bar");
    heatmapContainer.classList.toggle("hidden", chartPref === "bar");
    chartToggleBtn.textContent = chartPref === "bar" ? "▥" : "▦";

    updatePresetActive(Math.floor(focusDuration / 60), Math.floor(breakDuration / 60));
    updateCycleIndicator();
    updateDisplay();
    renderTasks();
    renderData();
    quoteText.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

init();
