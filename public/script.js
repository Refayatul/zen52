const TEMPLATES = {
    pomodoro: { name: "Pomodoro", focus: 25, break: 5 },
    zen52: { name: "Zen52", focus: 52, break: 17 },
    deep: { name: "Deep Work", focus: 90, break: 15 },
    writing: { name: "Writing", focus: 45, break: 10 },
    study: { name: "Study", focus: 50, break: 10 },
    custom: { name: "Custom", focus: 52, break: 17 }
};

const LONG_BREAK_DURATION = 25 * 60;
const SESSIONS_BEFORE_LONG_BREAK = 4;
const MS_DAY = 86400000;

const BREAK_ROUTINES = [
    { id: "stretch", name: "Stretch", text: "Stand up, open your shoulders, and stretch for two minutes." },
    { id: "eyes", name: "Eye rest", text: "Look at something far away for 20 seconds." },
    { id: "water", name: "Hydrate", text: "Drink a glass of water before the next block." },
    { id: "walk", name: "Walk", text: "Take a short walk around the room." },
    { id: "breathe", name: "Breathing", text: "Run a short breathing exercise." }
];

const BADGES = [
    { id: "novice", code: "01", name: "Novice", unlocked: s => s.focusSessions >= 1 },
    { id: "streak", code: "03", name: "Consistent", unlocked: s => s.streak >= 3 },
    { id: "master", code: "10h", name: "Master", unlocked: s => s.totalMinutes >= 600 },
    { id: "closer", code: "5T", name: "Closer", unlocked: s => s.completedTasks >= 5 },
    { id: "deep", code: "90", name: "Deep", unlocked: s => s.longestSession >= 90 },
    { id: "journal", code: "N", name: "Journal", unlocked: s => s.notes >= 3 }
];

const QUOTES = [
    "Do one thing at a time.",
    "Attention is a limited resource. Spend it deliberately.",
    "A clear desk starts with a clear next task.",
    "The goal is not more hours. The goal is better attention.",
    "Protect the first minute and the next fifty-one get easier.",
    "Less switching. More finishing.",
    "Depth beats urgency when the work matters."
];

const $ = id => document.getElementById(id);
const storage = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw == null ? fallback : JSON.parse(raw);
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

const defaults = {
    focus: 52 * 60,
    break: 17 * 60,
    dailyGoal: 4,
    goalType: "hours",
    autoStartBreak: false,
    autoStartFocus: false,
    syncEnabled: false,
    activeTemplate: "zen52",
    currentSession: 1,
    selectedTaskId: null,
    currentIntention: "",
    activeRoutine: "stretch",
    soundProfile: null,
    lastBackupAt: null
};

let settings = { ...defaults, ...storage.get("zen52_settings", {}) };
let sessions = storage.get("zen52_sessions", []);
let tasks = storage.get("zen52_tasks", []);
let notes = storage.get("zen52_session_notes", []);
let blockers = storage.get("zen52_blockers", []);
let interruptions = storage.get("zen52_interruptions", []);
let timeLeft = settings.focus;
let isFocusMode = true;
let isRunning = false;
let timerId = null;
let activeSession = null;
let lastCompletedSessionId = null;
let audioContext = null;
const ambience = new Map();

const el = {
    timer: $("timer-display"),
    status: $("status-text"),
    start: $("start-btn"),
    reset: $("reset-btn"),
    zenToggle: $("zen-toggle"),
    zenExit: $("zen-exit-btn"),
    theme: $("theme-toggle"),
    commandBtn: $("command-btn"),
    settingsBtn: $("settings-btn"),
    settingsModal: $("settings-modal"),
    closeSettings: $("close-settings"),
    saveSettings: $("save-settings"),
    focusInput: $("focus-duration"),
    breakInput: $("break-duration"),
    goalInput: $("daily-goal-input"),
    goalTypeInput: $("goal-type-input"),
    autoStartBreakInput: $("autostart-break-input"),
    autoStartFocusInput: $("autostart-focus-input"),
    syncEnabledInput: $("sync-enabled-input"),
    syncStatus: $("sync-status"),
    intention: $("intention-input"),
    selectedTaskLabel: $("selected-task-label"),
    zenTaskLabel: $("zen-task-label"),
    templateLabel: $("active-template-label"),
    taskInput: $("task-input"),
    addTask: $("add-task-btn"),
    clearCompleted: $("clear-completed-btn"),
    taskList: $("task-list"),
    scratchpad: $("scratchpad"),
    clearScratchpad: $("clear-scratchpad-btn"),
    customBtn: $("custom-timer-btn"),
    customInput: $("custom-timer-input"),
    quickFocus: $("quick-focus"),
    quickBreak: $("quick-break"),
    applyCustom: $("apply-custom-btn"),
    chartToggle: $("chart-toggle-btn"),
    chartContainer: $("chart-container"),
    heatmapContainer: $("heatmap-container"),
    weeklyChart: $("weekly-chart"),
    heatmapGrid: $("heatmap-grid"),
    historyList: $("history-list"),
    badgesGrid: $("badges-grid"),
    routineList: $("routine-list"),
    blockerInput: $("blocker-input"),
    addBlocker: $("add-blocker-btn"),
    blockerList: $("blocker-list"),
    exportData: $("export-data-btn"),
    importData: $("import-data-btn"),
    importInput: $("import-file-input"),
    backupReminder: $("backup-reminder"),
    backupNow: $("backup-now-btn"),
    backupDismiss: $("backup-dismiss-btn"),
    shortcutsBtn: $("shortcuts-btn"),
    shortcutsModal: $("shortcuts-modal"),
    closeShortcuts: $("close-shortcuts"),
    commandModal: $("command-modal"),
    closeCommand: $("close-command"),
    commandSearch: $("command-search"),
    commandList: $("command-list"),
    notesModal: $("session-notes-modal"),
    sessionReviewCopy: $("session-review-copy"),
    sessionNoteInput: $("session-note-input"),
    markTaskDone: $("mark-task-done-btn"),
    saveNote: $("save-note-btn"),
    skipNote: $("skip-note-btn"),
    breakModal: $("break-modal"),
    breakSuggestion: $("break-suggestion"),
    breathing: $("breathing-exercise"),
    breathInstruction: $("breath-instruction"),
    startBreathing: $("start-breathing-btn"),
    closeBreak: $("close-break-btn"),
    journalModal: $("journal-modal"),
    openJournal: $("open-journal-btn"),
    closeJournal: $("close-journal"),
    journalSearch: $("journal-search"),
    journalList: $("journal-list"),
    quote: $("quote-text"),
    dailyGoalText: $("daily-goal-text"),
    dailyGoalProgress: $("daily-goal-progress"),
    goalLabel: $("goal-label"),
    streakContainer: $("streak-container"),
    streakCount: $("streak-count")
};

function saveAll() {
    storage.set("zen52_settings", settings);
    storage.set("zen52_sessions", sessions);
    storage.set("zen52_tasks", tasks);
    storage.set("zen52_session_notes", notes);
    storage.set("zen52_blockers", blockers);
    storage.set("zen52_interruptions", interruptions);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function minutesLabel(minutes) {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = minutes / 60;
    return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
}

function todayKey(date = new Date()) {
    return date.toLocaleDateString();
}

function selectedTask() {
    return tasks.find(task => task.id === settings.selectedTaskId) || null;
}

function updateDisplay() {
    el.timer.textContent = formatTime(timeLeft);
    document.title = `${formatTime(timeLeft)} - ${isFocusMode ? "Focus" : "Break"} | Zen52`;
    const task = selectedTask();
    const label = task ? `Task: ${task.text}` : "No task linked";
    el.selectedTaskLabel.textContent = label;
    el.zenTaskLabel.textContent = label;
    el.templateLabel.textContent = `Template: ${TEMPLATES[settings.activeTemplate]?.name || "Custom"}`;
}

function setStartButton(text) {
    el.start.textContent = text;
}

function applyTemplate(id) {
    const template = TEMPLATES[id];
    if (!template) return;
    settings.activeTemplate = id;
    settings.focus = template.focus * 60;
    settings.break = template.break * 60;
    if (!isRunning) timeLeft = isFocusMode ? settings.focus : settings.break;
    document.querySelectorAll(".preset-chip").forEach(chip => chip.classList.toggle("active", chip.dataset.template === id || (id === "custom" && chip.id === "custom-timer-btn")));
    saveAll();
    updateDisplay();
}

function applyCustomDurations(focusMinutes, breakMinutes) {
    if (!Number.isFinite(focusMinutes) || !Number.isFinite(breakMinutes) || focusMinutes <= 0 || breakMinutes <= 0) {
        alert("Please enter valid positive numbers.");
        return false;
    }
    settings.activeTemplate = "custom";
    settings.focus = focusMinutes * 60;
    settings.break = breakMinutes * 60;
    TEMPLATES.custom.focus = focusMinutes;
    TEMPLATES.custom.break = breakMinutes;
    if (!isRunning) timeLeft = isFocusMode ? settings.focus : settings.break;
    saveAll();
    updatePresetLabels();
    updateDisplay();
    return true;
}

function updatePresetLabels() {
    document.querySelectorAll(".preset-chip").forEach(chip => {
        chip.classList.toggle("active", chip.dataset.template === settings.activeTemplate || (settings.activeTemplate === "custom" && chip.id === "custom-timer-btn"));
    });
}

function startTimer() {
    if (isRunning) return;
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    isRunning = true;
    setStartButton("Pause");
    if (isFocusMode && !activeSession) {
        activeSession = {
            id: Date.now(),
            started_at: new Date().toISOString(),
            intention: el.intention.value.trim(),
            taskId: settings.selectedTaskId,
            taskText: selectedTask()?.text || "",
            template: settings.activeTemplate,
            plannedDuration: Math.floor(settings.focus / 60),
            pauseCount: 0
        };
    }
    timerId = setInterval(() => {
        if (timeLeft <= 0) {
            completeInterval();
            return;
        }
        timeLeft -= 1;
        updateDisplay();
    }, 1000);
}

function pauseTimer(record = true) {
    if (!isRunning && !timerId) return;
    clearInterval(timerId);
    timerId = null;
    isRunning = false;
    setStartButton("Resume");
    if (record && activeSession && isFocusMode) {
        activeSession.pauseCount += 1;
        interruptions.unshift({ id: Date.now(), at: new Date().toISOString(), reason: "pause", sessionId: activeSession.id });
        saveAll();
        renderData();
    }
}

function resetTimer() {
    if (activeSession && isFocusMode) {
        interruptions.unshift({ id: Date.now(), at: new Date().toISOString(), reason: "reset", sessionId: activeSession.id });
    }
    clearInterval(timerId);
    timerId = null;
    isRunning = false;
    activeSession = null;
    isFocusMode = true;
    timeLeft = settings.focus;
    el.status.textContent = "Focus Mode";
    el.timer.classList.remove("break-mode");
    setStartButton("Start Focus");
    saveAll();
    updateDisplay();
    renderData();
}

function completeInterval() {
    clearInterval(timerId);
    timerId = null;
    isRunning = false;

    if (isFocusMode) {
        const session = {
            id: activeSession?.id || Date.now(),
            created_at: new Date().toISOString(),
            duration: Math.floor(settings.focus / 60),
            type: "focus",
            intention: activeSession?.intention || el.intention.value.trim(),
            taskId: activeSession?.taskId || settings.selectedTaskId,
            taskText: activeSession?.taskText || selectedTask()?.text || "",
            template: activeSession?.template || settings.activeTemplate,
            pauseCount: activeSession?.pauseCount || 0,
            note: ""
        };
        sessions.unshift(session);
        lastCompletedSessionId = session.id;
        activeSession = null;
        settings.currentSession += 1;
        if (settings.currentSession > SESSIONS_BEFORE_LONG_BREAK + 1) settings.currentSession = 1;
        saveAll();
        syncSession(session);
        renderData();
        updateCycleIndicator();
        playTone(720);
        notify("Focus complete", "Time for a deliberate break.");
        el.sessionReviewCopy.textContent = session.intention ? `Intention: ${session.intention}` : "What did you accomplish?";
        el.notesModal.showModal();
        switchMode();
        if (settings.autoStartBreak) startTimer();
    } else {
        if (settings.currentSession > SESSIONS_BEFORE_LONG_BREAK) settings.currentSession = 1;
        saveAll();
        renderData();
        updateCycleIndicator();
        playTone(520);
        notify("Break over", "Start the next focus block when ready.");
        switchMode();
        if (settings.autoStartFocus) startTimer();
    }
}

function switchMode() {
    isFocusMode = !isFocusMode;
    if (isFocusMode) {
        timeLeft = settings.focus;
        el.status.textContent = "Focus Mode";
        el.timer.classList.remove("break-mode");
        setStartButton("Start Focus");
    } else {
        const isLongBreak = settings.currentSession > SESSIONS_BEFORE_LONG_BREAK;
        timeLeft = isLongBreak ? LONG_BREAK_DURATION : settings.break;
        el.status.textContent = isLongBreak ? "Long Break" : "Break Mode";
        el.timer.classList.add("break-mode");
        setStartButton("Start Break");
        showBreakModal();
    }
    updateDisplay();
}

function notify(title, body) {
    if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
}

function playTone(frequency) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
    } catch {}
}

function syncSession(session) {
    if (!settings.syncEnabled) {
        el.syncStatus.textContent = "Sync status: local only";
        return;
    }
    fetch("/api/save-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: session.duration, type: session.type, intention: session.intention, task: session.taskText })
    })
        .then(response => {
            el.syncStatus.textContent = response.ok ? "Sync status: last session synced" : "Sync status: backend unavailable";
        })
        .catch(() => {
            el.syncStatus.textContent = "Sync status: backend unavailable";
        });
}

function calculateStats() {
    const focus = sessions.filter(s => s.type === "focus");
    const today = todayKey();
    const todaySessions = focus.filter(s => new Date(s.created_at).toLocaleDateString() === today);
    const todayMinutes = todaySessions.reduce((sum, s) => sum + Number(s.duration || 0), 0);
    const completedTasksToday = tasks.filter(t => t.completed && t.completedAt && new Date(t.completedAt).toLocaleDateString() === today).length;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 6 * MS_DAY);
    const monthAgo = new Date(now.getTime() - 29 * MS_DAY);
    const weekTotal = focus.filter(s => new Date(s.created_at) >= weekAgo).reduce((sum, s) => sum + Number(s.duration || 0), 0);
    const monthTotal = focus.filter(s => new Date(s.created_at) >= monthAgo).reduce((sum, s) => sum + Number(s.duration || 0), 0);
    const dailyTotals = getDailyTotals(sessions);
    const bestDay = Math.max(0, ...Object.values(dailyTotals));
    const totalMinutes = focus.reduce((sum, s) => sum + Number(s.duration || 0), 0);
    return {
        focusSessions: focus.length,
        todayMinutes,
        todaySessions: todaySessions.length,
        completedTasks: tasks.filter(t => t.completed).length,
        completedTasksToday,
        interruptions: interruptions.length,
        weekTotal,
        monthTotal,
        bestDay,
        avgSession: focus.length ? totalMinutes / focus.length : 0,
        totalMinutes,
        longestSession: Math.max(0, ...focus.map(s => Number(s.duration || 0))),
        notes: notes.length,
        streak: calculateStreak(focus)
    };
}

function calculateStreak(focusSessions) {
    const days = [...new Set(focusSessions.map(s => {
        const d = new Date(s.created_at);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }))].sort((a, b) => b - a);
    if (!days.length) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Math.round((today.getTime() - days[0]) / MS_DAY) > 1) return 0;
    let streak = 1;
    for (let i = 0; i < days.length - 1; i += 1) {
        if (Math.round((days[i] - days[i + 1]) / MS_DAY) === 1) streak += 1;
        else break;
    }
    return streak;
}

function getDailyTotals(items) {
    return items.reduce((days, session) => {
        if (session.type !== "focus") return days;
        const key = new Date(session.created_at).toLocaleDateString();
        days[key] = (days[key] || 0) + Number(session.duration || 0);
        return days;
    }, {});
}

function renderData() {
    const stats = calculateStats();
    $("stat-today-minutes").textContent = minutesLabel(stats.todayMinutes);
    $("stat-today-sessions").textContent = stats.todaySessions;
    $("stat-today-tasks").textContent = stats.completedTasksToday;
    $("stat-interruptions").textContent = stats.interruptions;
    $("data-week-total").textContent = minutesLabel(stats.weekTotal);
    $("data-month-total").textContent = minutesLabel(stats.monthTotal);
    $("data-best-day").textContent = minutesLabel(stats.bestDay);
    $("data-average-session").textContent = minutesLabel(stats.avgSession);
    el.streakCount.textContent = stats.streak;
    el.streakContainer.classList.toggle("hidden", stats.streak === 0);
    renderGoal(stats);
    renderHistory();
    renderWeeklyChart();
    renderHeatmap();
    renderBadges(stats);
}

function renderGoal(stats) {
    let current = stats.todayMinutes / 60;
    let target = settings.dailyGoal;
    let label = "Daily goal";
    let suffix = "hrs";
    if (settings.goalType === "sessions") {
        current = stats.todaySessions;
        label = "Session goal";
        suffix = "sessions";
    }
    if (settings.goalType === "tasks") {
        current = stats.completedTasksToday;
        label = "Task goal";
        suffix = "tasks";
    }
    el.goalLabel.textContent = label;
    el.dailyGoalText.textContent = `${Number(current).toFixed(settings.goalType === "hours" ? 1 : 0)} / ${target} ${suffix}`;
    el.dailyGoalProgress.style.width = `${Math.min((current / target) * 100, 100)}%`;
}

function renderHistory() {
    el.historyList.replaceChildren();
    if (!sessions.length) {
        el.historyList.append(emptyItem("No sessions yet."));
        return;
    }
    sessions.slice(0, 6).forEach(session => {
        const item = document.createElement("li");
        item.className = "history-item";
        const main = document.createElement("div");
        main.className = "history-main";
        const title = document.createElement("span");
        title.className = "type";
        title.textContent = session.intention || session.taskText || "Focus session";
        const meta = document.createElement("span");
        meta.className = "history-meta";
        meta.textContent = [session.taskText, session.note].filter(Boolean).join(" · ") || TEMPLATES[session.template]?.name || "Focus";
        const time = document.createElement("span");
        time.className = "time";
        time.textContent = `${session.duration}m · ${new Date(session.created_at).toLocaleDateString()}`;
        main.append(title, meta);
        item.append(main, time);
        el.historyList.append(item);
    });
}

function renderWeeklyChart() {
    el.weeklyChart.replaceChildren();
    const totals = getDailyTotals(sessions);
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const values = [];
    for (let i = 6; i >= 0; i -= 1) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        values.push({ label: i === 0 ? "Today" : labels[d.getDay()], value: totals[d.toLocaleDateString()] || 0 });
    }
    const max = Math.max(...values.map(d => d.value), 60);
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
        el.weeklyChart.append(wrap);
    });
}

function renderHeatmap() {
    el.heatmapGrid.replaceChildren();
    const totals = getDailyTotals(sessions);
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 364);
    start.setDate(start.getDate() - start.getDay());
    for (let i = 0; i < 53 * 7; i += 1) {
        const current = new Date(start);
        current.setDate(start.getDate() + i);
        if (current > today) break;
        const minutes = totals[current.toLocaleDateString()] || 0;
        const cell = document.createElement("div");
        cell.className = "heatmap-cell";
        cell.dataset.level = minutes >= 120 ? 4 : minutes >= 60 ? 3 : minutes >= 30 ? 2 : minutes > 0 ? 1 : 0;
        cell.title = `${current.toLocaleDateString()}: ${minutes} minutes`;
        el.heatmapGrid.append(cell);
    }
}

function renderBadges(stats) {
    el.badgesGrid.replaceChildren();
    BADGES.forEach(badge => {
        const item = document.createElement("div");
        item.className = `badge-item ${badge.unlocked(stats) ? "" : "locked"}`;
        item.title = badge.name;
        const icon = document.createElement("div");
        icon.className = "badge-icon";
        icon.textContent = badge.code;
        const text = document.createElement("span");
        text.textContent = badge.name;
        item.append(icon, text);
        el.badgesGrid.append(item);
    });
}

function emptyItem(text) {
    const item = document.createElement("li");
    item.className = "loading-text";
    item.textContent = text;
    return item;
}

function renderTasks() {
    el.taskList.replaceChildren();
    if (!tasks.length) {
        el.taskList.append(emptyItem("No active tasks."));
        return;
    }
    tasks.forEach(task => {
        const item = document.createElement("li");
        item.className = "task-item";
        const checkbox = document.createElement("input");
        checkbox.className = "task-checkbox";
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(task.completed);
        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;
            task.completedAt = checkbox.checked ? new Date().toISOString() : null;
            saveAll();
            renderTasks();
            renderData();
        });
        const text = document.createElement("span");
        text.className = "task-text";
        text.textContent = task.text;
        const link = document.createElement("button");
        link.className = `task-link ${settings.selectedTaskId === task.id ? "active" : ""}`;
        link.type = "button";
        link.textContent = settings.selectedTaskId === task.id ? "linked" : "link";
        link.addEventListener("click", () => {
            settings.selectedTaskId = settings.selectedTaskId === task.id ? null : task.id;
            saveAll();
            renderTasks();
            updateDisplay();
        });
        const del = document.createElement("button");
        del.className = "task-delete";
        del.type = "button";
        del.textContent = "×";
        del.addEventListener("click", () => {
            tasks = tasks.filter(t => t.id !== task.id);
            if (settings.selectedTaskId === task.id) settings.selectedTaskId = null;
            saveAll();
            renderTasks();
            renderData();
            updateDisplay();
        });
        item.append(checkbox, text, link, del);
        el.taskList.append(item);
    });
}

function addTask() {
    const text = el.taskInput.value.trim();
    if (!text) return;
    const task = { id: Date.now(), text, completed: false, createdAt: new Date().toISOString(), completedAt: null };
    tasks.push(task);
    settings.selectedTaskId = task.id;
    el.taskInput.value = "";
    saveAll();
    renderTasks();
    updateDisplay();
}

function renderBlockers() {
    el.blockerList.replaceChildren();
    blockers.forEach(blocker => {
        const item = document.createElement("li");
        item.textContent = blocker;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "×";
        button.addEventListener("click", () => {
            blockers = blockers.filter(b => b !== blocker);
            saveAll();
            renderBlockers();
        });
        item.append(button);
        el.blockerList.append(item);
    });
}

function renderRoutines() {
    el.routineList.replaceChildren();
    BREAK_ROUTINES.forEach(routine => {
        const item = document.createElement("button");
        item.className = `routine-item ${settings.activeRoutine === routine.id ? "active" : ""}`;
        item.type = "button";
        item.innerHTML = `<span>${routine.name}</span><small>${routine.text}</small>`;
        item.addEventListener("click", () => {
            settings.activeRoutine = routine.id;
            saveAll();
            renderRoutines();
        });
        el.routineList.append(item);
    });
}

function showBreakModal() {
    const routine = BREAK_ROUTINES.find(item => item.id === settings.activeRoutine) || BREAK_ROUTINES[0];
    el.breakSuggestion.textContent = routine.text;
    el.breathing.classList.add("hidden");
    el.startBreathing.classList.toggle("hidden", routine.id !== "breathe");
    el.breakModal.showModal();
}

function renderJournal(query = "") {
    const q = query.toLowerCase();
    el.journalList.replaceChildren();
    const rows = sessions.filter(session => {
        const haystack = [session.intention, session.taskText, session.note, TEMPLATES[session.template]?.name].join(" ").toLowerCase();
        return haystack.includes(q);
    });
    if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "journal-item";
        empty.textContent = "No journal entries found.";
        el.journalList.append(empty);
        return;
    }
    rows.forEach(session => {
        const item = document.createElement("div");
        item.className = "journal-item";
        const title = document.createElement("strong");
        title.textContent = session.intention || session.taskText || "Focus session";
        const meta = document.createElement("small");
        meta.textContent = `${session.duration}m · ${new Date(session.created_at).toLocaleString()} · ${TEMPLATES[session.template]?.name || "Custom"}`;
        const note = document.createElement("span");
        note.textContent = session.note || "No note saved.";
        item.append(title, meta, note);
        el.journalList.append(item);
    });
}

function commands() {
    return [
        { name: isRunning ? "Pause timer" : "Start timer", hint: "Space", action: () => (isRunning ? pauseTimer() : startTimer()) },
        { name: "Reset timer", hint: "R", action: resetTimer },
        { name: "Toggle Zen mode", hint: "Fullscreen focus", action: toggleZen },
        { name: "Switch theme", hint: "Dark / light", action: toggleTheme },
        { name: "Open journal", hint: "Search sessions", action: () => openJournal() },
        { name: "Export data", hint: "Local backup", action: exportData },
        { name: "Pomodoro preset", hint: "25/5", action: () => applyTemplate("pomodoro") },
        { name: "Zen52 preset", hint: "52/17", action: () => applyTemplate("zen52") },
        { name: "Deep Work preset", hint: "90/15", action: () => applyTemplate("deep") }
    ];
}

function renderCommands(query = "") {
    const q = query.toLowerCase();
    el.commandList.replaceChildren();
    commands().filter(cmd => cmd.name.toLowerCase().includes(q) || cmd.hint.toLowerCase().includes(q)).forEach(cmd => {
        const item = document.createElement("button");
        item.className = "command-item";
        item.type = "button";
        item.innerHTML = `<strong>${cmd.name}</strong><small>${cmd.hint}</small>`;
        item.addEventListener("click", () => {
            el.commandModal.close();
            cmd.action();
        });
        el.commandList.append(item);
    });
}

function openCommand() {
    renderCommands();
    el.commandModal.showModal();
    setTimeout(() => el.commandSearch.focus(), 50);
}

function openJournal() {
    renderJournal();
    el.journalModal.showModal();
    setTimeout(() => el.journalSearch.focus(), 50);
}

function toggleTheme() {
    const isLight = document.body.classList.toggle("light-mode");
    el.theme.querySelector("span").textContent = isLight ? "☾" : "☼";
    localStorage.setItem("zen52_theme", isLight ? "light" : "dark");
}

function toggleZen(force) {
    const enabled = typeof force === "boolean" ? force : !document.body.classList.contains("zen-mode");
    document.body.classList.toggle("zen-mode", enabled);
    el.zenExit.classList.toggle("hidden", !enabled);
}

function updateCycleIndicator() {
    document.querySelectorAll(".cycle-dot").forEach((dot, index) => {
        dot.classList.toggle("completed", index < settings.currentSession - 1);
        dot.classList.toggle("active", index === Math.min(settings.currentSession, 4) - 1);
    });
    $("cycle-label").textContent = `Session ${Math.min(settings.currentSession, 4)}/4`;
}

function exportData() {
    const data = { sessions, tasks, notes, blockers, interruptions, settings, scratchpad: localStorage.getItem("zen52_scratchpad") || "" };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zen52_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    settings.lastBackupAt = new Date().toISOString();
    saveAll();
    checkBackupReminder();
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            sessions = Array.isArray(data.sessions) ? data.sessions : sessions;
            tasks = Array.isArray(data.tasks) ? data.tasks : tasks;
            notes = Array.isArray(data.notes) ? data.notes : notes;
            blockers = Array.isArray(data.blockers) ? data.blockers : blockers;
            interruptions = Array.isArray(data.interruptions) ? data.interruptions : interruptions;
            settings = { ...settings, ...(data.settings || {}) };
            if (typeof data.scratchpad === "string") localStorage.setItem("zen52_scratchpad", data.scratchpad);
            saveAll();
            location.reload();
        } catch {
            alert("Invalid backup file.");
        }
    };
    reader.readAsText(file);
}

function checkBackupReminder() {
    const last = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
    const shouldShow = sessions.length >= 5 && (!last || Date.now() - last.getTime() > 21 * MS_DAY);
    el.backupReminder.classList.toggle("hidden", !shouldShow);
}

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
    ambience.set(type, { source, gain });
}

function stopAmbience(type) {
    const item = ambience.get(type);
    if (!item) return;
    item.source.stop();
    ambience.delete(type);
}

function toggleMute() {
    if (!ambience.size) return;
    const shouldMute = [...ambience.values()].some(item => item.gain.gain.value > 0);
    ambience.forEach((item, type) => {
        const slider = document.querySelector(`.volume-slider[data-sound="${type}"]`);
        item.gain.gain.value = shouldMute ? 0 : Number(slider?.value || 0.4);
    });
}

function saveSoundProfile() {
    settings.soundProfile = {
        active: [...ambience.keys()],
        volumes: Object.fromEntries([...document.querySelectorAll(".volume-slider")].map(slider => [slider.dataset.sound, Number(slider.value)]))
    };
    saveAll();
}

function loadSoundProfile() {
    if (!settings.soundProfile) return;
    document.querySelectorAll(".sound-btn").forEach(btn => {
        if (ambience.has(btn.dataset.sound)) stopAmbience(btn.dataset.sound);
        btn.classList.remove("active");
    });
    Object.entries(settings.soundProfile.volumes || {}).forEach(([type, value]) => {
        const slider = document.querySelector(`.volume-slider[data-sound="${type}"]`);
        if (slider) slider.value = value;
    });
    (settings.soundProfile.active || []).forEach(type => {
        const slider = document.querySelector(`.volume-slider[data-sound="${type}"]`);
        const btn = document.querySelector(`.sound-btn[data-sound="${type}"]`);
        startAmbience(type, Number(slider?.value || 0.4));
        btn?.classList.add("active");
    });
}

function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js").catch(() => {});
    }
}

function bindEvents() {
    el.start.addEventListener("click", () => isRunning ? pauseTimer() : startTimer());
    el.reset.addEventListener("click", resetTimer);
    el.zenToggle.addEventListener("click", () => toggleZen());
    el.zenExit.addEventListener("click", () => toggleZen(false));
    el.theme.addEventListener("click", toggleTheme);
    el.commandBtn.addEventListener("click", openCommand);
    el.commandSearch.addEventListener("input", () => renderCommands(el.commandSearch.value));
    el.closeCommand.addEventListener("click", () => el.commandModal.close());
    el.settingsBtn.addEventListener("click", () => {
        el.focusInput.value = Math.floor(settings.focus / 60);
        el.breakInput.value = Math.floor(settings.break / 60);
        el.goalInput.value = settings.dailyGoal;
        el.goalTypeInput.value = settings.goalType;
        el.autoStartBreakInput.checked = settings.autoStartBreak;
        el.autoStartFocusInput.checked = settings.autoStartFocus;
        el.syncEnabledInput.checked = settings.syncEnabled;
        el.settingsModal.showModal();
    });
    el.closeSettings.addEventListener("click", () => el.settingsModal.close());
    el.saveSettings.addEventListener("click", () => {
        if (!applyCustomDurations(Number(el.focusInput.value), Number(el.breakInput.value))) return;
        settings.dailyGoal = Number(el.goalInput.value) || 4;
        settings.goalType = el.goalTypeInput.value;
        settings.autoStartBreak = el.autoStartBreakInput.checked;
        settings.autoStartFocus = el.autoStartFocusInput.checked;
        settings.syncEnabled = el.syncEnabledInput.checked;
        saveAll();
        renderData();
        el.settingsModal.close();
    });
    document.querySelectorAll(".preset-chip[data-template]").forEach(btn => btn.addEventListener("click", () => applyTemplate(btn.dataset.template)));
    el.customBtn.addEventListener("click", () => {
        el.customInput.classList.toggle("hidden");
        el.quickFocus.value = Math.floor(settings.focus / 60);
        el.quickBreak.value = Math.floor(settings.break / 60);
    });
    el.applyCustom.addEventListener("click", () => {
        if (applyCustomDurations(Number(el.quickFocus.value), Number(el.quickBreak.value))) el.customInput.classList.add("hidden");
    });
    el.addTask.addEventListener("click", addTask);
    el.taskInput.addEventListener("keydown", e => { if (e.key === "Enter") addTask(); });
    el.clearCompleted.addEventListener("click", () => {
        tasks = tasks.filter(task => !task.completed);
        saveAll();
        renderTasks();
        renderData();
    });
    el.intention.addEventListener("input", () => {
        settings.currentIntention = el.intention.value;
        saveAll();
    });
    el.chartToggle.addEventListener("click", () => {
        const showBars = el.chartContainer.classList.contains("hidden");
        el.chartContainer.classList.toggle("hidden", !showBars);
        el.heatmapContainer.classList.toggle("hidden", showBars);
        localStorage.setItem("zen52_chart_pref", showBars ? "bar" : "heatmap");
    });
    document.querySelectorAll(".sound-btn").forEach(btn => btn.addEventListener("click", () => {
        const type = btn.dataset.sound;
        const slider = document.querySelector(`.volume-slider[data-sound="${type}"]`);
        if (ambience.has(type)) {
            stopAmbience(type);
            btn.classList.remove("active");
        } else {
            startAmbience(type, Number(slider?.value || 0.4));
            btn.classList.add("active");
        }
    }));
    document.querySelectorAll(".volume-slider").forEach(slider => slider.addEventListener("input", () => {
        const item = ambience.get(slider.dataset.sound);
        if (item) item.gain.gain.value = Number(slider.value);
    }));
    $("save-sound-profile-btn").addEventListener("click", saveSoundProfile);
    $("load-sound-profile-btn").addEventListener("click", loadSoundProfile);
    el.scratchpad.value = localStorage.getItem("zen52_scratchpad") || "";
    el.scratchpad.addEventListener("input", () => localStorage.setItem("zen52_scratchpad", el.scratchpad.value));
    el.clearScratchpad.addEventListener("click", () => {
        if (!el.scratchpad.value || confirm("Clear all brain dump notes?")) {
            el.scratchpad.value = "";
            localStorage.setItem("zen52_scratchpad", "");
        }
    });
    el.addBlocker.addEventListener("click", () => {
        const text = el.blockerInput.value.trim();
        if (!text) return;
        blockers.push(text);
        el.blockerInput.value = "";
        saveAll();
        renderBlockers();
    });
    el.blockerInput.addEventListener("keydown", e => { if (e.key === "Enter") el.addBlocker.click(); });
    el.exportData.addEventListener("click", exportData);
    el.importData.addEventListener("click", () => el.importInput.click());
    el.importInput.addEventListener("change", e => e.target.files[0] && importData(e.target.files[0]));
    el.backupNow.addEventListener("click", exportData);
    el.backupDismiss.addEventListener("click", () => {
        settings.lastBackupAt = new Date().toISOString();
        saveAll();
        checkBackupReminder();
    });
    el.shortcutsBtn.addEventListener("click", () => el.shortcutsModal.showModal());
    el.closeShortcuts.addEventListener("click", () => el.shortcutsModal.close());
    el.openJournal.addEventListener("click", openJournal);
    el.closeJournal.addEventListener("click", () => el.journalModal.close());
    el.journalSearch.addEventListener("input", () => renderJournal(el.journalSearch.value));
    el.saveNote.addEventListener("click", saveCurrentNote);
    el.skipNote.addEventListener("click", () => el.notesModal.close());
    el.markTaskDone.addEventListener("click", markLinkedTaskDone);
    el.closeBreak.addEventListener("click", () => el.breakModal.close());
    el.startBreathing.addEventListener("click", runBreathing);
    [el.settingsModal, el.shortcutsModal, el.commandModal, el.notesModal, el.breakModal, el.journalModal].forEach(modal => {
        modal.addEventListener("click", event => { if (event.target === modal) modal.close(); });
    });
    document.addEventListener("keydown", event => {
        const active = document.activeElement;
        const isTyping = active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            openCommand();
            return;
        }
        if (isTyping) return;
        if (event.code === "Space") { event.preventDefault(); isRunning ? pauseTimer() : startTimer(); }
        if (event.key.toLowerCase() === "r") resetTimer();
        if (event.key.toLowerCase() === "m") toggleMute();
        if (event.key === "Escape" && document.body.classList.contains("zen-mode")) toggleZen(false);
    });
}

function saveCurrentNote() {
    const note = el.sessionNoteInput.value.trim();
    const session = sessions.find(s => s.id === lastCompletedSessionId);
    if (session && note) session.note = note;
    if (note) notes.unshift({ id: Date.now(), sessionId: lastCompletedSessionId, note, timestamp: new Date().toISOString() });
    el.sessionNoteInput.value = "";
    saveAll();
    renderData();
    el.notesModal.close();
}

function markLinkedTaskDone() {
    const session = sessions.find(s => s.id === lastCompletedSessionId);
    const task = tasks.find(t => t.id === (session?.taskId || settings.selectedTaskId));
    if (task) {
        task.completed = true;
        task.completedAt = new Date().toISOString();
        saveAll();
        renderTasks();
        renderData();
    }
}

function runBreathing() {
    el.breathing.classList.remove("hidden");
    el.startBreathing.classList.add("hidden");
    const phases = [
        { text: "Breathe in...", duration: 4000 },
        { text: "Hold...", duration: 7000 },
        { text: "Breathe out...", duration: 8000 }
    ];
    let phase = 0;
    let cycles = 0;
    function next() {
        if (!el.breakModal.open || cycles >= 3) {
            el.breathInstruction.textContent = "Done.";
            el.startBreathing.classList.remove("hidden");
            return;
        }
        el.breathInstruction.textContent = phases[phase].text;
        setTimeout(() => {
            phase += 1;
            if (phase >= phases.length) {
                phase = 0;
                cycles += 1;
            }
            next();
        }, phases[phase].duration);
    }
    next();
}

function init() {
    if (localStorage.getItem("zen52_theme") === "light") {
        document.body.classList.add("light-mode");
        el.theme.querySelector("span").textContent = "☾";
    }
    const chartPref = localStorage.getItem("zen52_chart_pref") || "heatmap";
    el.chartContainer.classList.toggle("hidden", chartPref !== "bar");
    el.heatmapContainer.classList.toggle("hidden", chartPref === "bar");
    el.intention.value = settings.currentIntention || "";
    timeLeft = settings.focus || TEMPLATES.zen52.focus * 60;
    el.quote.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    el.syncStatus.textContent = settings.syncEnabled ? "Sync status: ready" : "Sync status: local only";
    bindEvents();
    updatePresetLabels();
    updateCycleIndicator();
    updateDisplay();
    renderTasks();
    renderBlockers();
    renderRoutines();
    renderData();
    checkBackupReminder();
    registerServiceWorker();
}

init();
