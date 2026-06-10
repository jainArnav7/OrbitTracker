// ===== AUTHENTICATION CHECK =====
function checkAuth() {
    const currentUser = localStorage.getItem('orbittracker_current_user');
    if (!currentUser) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function getCurrentUser() {
    const currentUser = localStorage.getItem('orbittracker_current_user');
    return currentUser ? JSON.parse(currentUser) : null;
}

// ===== DATA MANAGEMENT =====
class DataManager {
    constructor(userId, gradingSettings = {}) {
        this.userId = userId;
        this.classes = this.loadFromStorage('classes') || [];
        this.volunteer = this.loadFromStorage('volunteer') || [];
        this.hoursGoal = this.loadFromStorage('hoursGoal') || 100;
        this.theme = this.loadFromStorage('theme') || 'dark';
        this.state = gradingSettings.state || 'Unknown';
        this.gradeScaleName = gradingSettings.gradingScaleName || '4.0 Scale';
        this.customGradeScale = gradingSettings.customGradeScale || null;
        this.gradeScale = this.getGradeScaleObjectByName(this.gradeScaleName);
        this.maxScale = this.gradeScale.max;
    }

    storageKey(key) {
        return `orbittracker_${key}_${this.userId}`;
    }

    saveToStorage(key, data) {
        localStorage.setItem(this.storageKey(key), JSON.stringify(data));
    }

    loadFromStorage(key) {
        const data = localStorage.getItem(this.storageKey(key));
        return data ? JSON.parse(data) : null;
    }

    getGradeScaleObjectByName(name) {
        const scales = {
            '4.0 Scale': { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0, max: 4.0 },
            '4.3 Scale': { A: 4.3, B: 3.3, C: 2.3, D: 1.3, F: 0.0, max: 4.3 },
            '5.0 Scale': { A: 5.0, B: 4.0, C: 3.0, D: 2.0, F: 0.0, max: 5.0 }
        };
        return scales[name] || scales['4.0 Scale'];
    }

    getGradePoints(grade) {
        const scale = this.customGradeScale || this.gradeScale;
        return scale[grade] || 0;
    }

    addClass(name, grade, weighted) {
        const basePoints = this.getGradePoints(grade);
        const weightMultiplier = weighted ? 1.5 : 1;
        
        const newClass = {
            id: Date.now(),
            name,
            grade,
            weighted,
            basePoints,
            points: basePoints * weightMultiplier
        };
        
        this.classes.push(newClass);
        this.saveToStorage('classes', this.classes);
        return newClass;
    }

    removeClass(id) {
        this.classes = this.classes.filter(c => c.id !== id);
        this.saveToStorage('classes', this.classes);
    }

    addVolunteer(org, hours, category) {
        const newEntry = {
            id: Date.now(),
            org,
            hours: parseFloat(hours),
            category,
            date: new Date().toLocaleDateString()
        };
        
        this.volunteer.push(newEntry);
        this.saveToStorage('volunteer', this.volunteer);
        return newEntry;
    }

    removeVolunteer(id) {
        this.volunteer = this.volunteer.filter(v => v.id !== id);
        this.saveToStorage('volunteer', this.volunteer);
    }

    calculateGPA() {
        if (this.classes.length === 0) return 0;
        
        let totalWeightedPoints = 0;
        let totalClasses = this.classes.length;
        
        this.classes.forEach(cls => {
            totalWeightedPoints += cls.points;
        });
        
        return (totalWeightedPoints / totalClasses).toFixed(2);
    }

    calculateUnweightedGPA() {
        if (this.classes.length === 0) return 0;

        let totalBasePoints = 0;
        let totalClasses = this.classes.length;

        this.classes.forEach(cls => {
            totalBasePoints += cls.basePoints;
        });

        return (totalBasePoints / totalClasses).toFixed(2);
    }

    updateSettings(settings) {
        if (settings.state) {
            this.state = settings.state;
        }
        if (settings.gradingScaleName) {
            this.gradeScaleName = settings.gradingScaleName;
            this.gradeScale = this.getGradeScaleObjectByName(settings.gradingScaleName);
            this.maxScale = this.gradeScale.max;
        }
        if (settings.customScale) {
            this.customGradeScale = settings.customScale;
        } else if (settings.customScale === null) {
            this.customGradeScale = null;
        }
    }

    calculateTotalHours() {
        return this.volunteer.reduce((sum, entry) => sum + entry.hours, 0);
    }

    getCategoryBreakdown() {
        const breakdown = {};
        this.volunteer.forEach(entry => {
            if (!breakdown[entry.category]) {
                breakdown[entry.category] = 0;
            }
            breakdown[entry.category] += entry.hours;
        });
        return breakdown;
    }

    setHoursGoal(goal) {
        this.hoursGoal = goal;
        this.saveToStorage('hoursGoal', goal);
    }

    exportToJSON() {
        return JSON.stringify({
            classes: this.classes,
            volunteer: this.volunteer,
            hoursGoal: this.hoursGoal,
            exportDate: new Date().toISOString()
        }, null, 2);
    }

    importFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.classes = data.classes || [];
            this.volunteer = data.volunteer || [];
            this.hoursGoal = data.hoursGoal || 100;
            
            this.saveToStorage('classes', this.classes);
            this.saveToStorage('volunteer', this.volunteer);
            this.saveToStorage('hoursGoal', this.hoursGoal);
            
            return true;
        } catch (e) {
            console.error('Failed to import data:', e);
            return false;
        }
    }

    exportToCSV() {
        let csv = 'Type,Name/Organization,Details,Value,Date\n';
        
        this.classes.forEach(cls => {
            csv += `Class,"${cls.name}","Grade: ${cls.grade}, Weighted: ${cls.weighted ? 'Yes' : 'No'}",${cls.points},${new Date().toLocaleDateString()}\n`;
        });
        
        this.volunteer.forEach(entry => {
            csv += `Volunteer,"${entry.org}","Category: ${entry.category}",${entry.hours} hours,${entry.date}\n`;
        });
        
        return csv;
    }

    clearAll() {
        this.classes = [];
        this.volunteer = [];
        this.hoursGoal = 100;
        localStorage.removeItem(this.storageKey('classes'));
        localStorage.removeItem(this.storageKey('volunteer'));
        localStorage.removeItem(this.storageKey('hoursGoal'));
        localStorage.removeItem(this.storageKey('theme'));
    }
}

// ===== GLOBAL DATA MANAGER =====
let dataManager;

// ===== DOM ELEMENTS =====
const classForm = document.getElementById('class-form');
const classNameInput = document.getElementById('class-name');
const classGradeSelect = document.getElementById('class-grade');
const classWeightedCheckbox = document.getElementById('class-weighted');
const classList = document.getElementById('class-list');
const weightedGpaSpan = document.getElementById('weighted-gpa');
const totalClassesSpan = document.getElementById('total-classes');

const volunteerForm = document.getElementById('volunteer-form');
const volOrgInput = document.getElementById('vol-org');
const volHoursInput = document.getElementById('vol-hours');
const volCategorySelect = document.getElementById('vol-category');
const volList = document.getElementById('vol-list');
const totalHoursSpan = document.getElementById('total-hours');

const hoursGoalInput = document.getElementById('hours-goal');
const setGoalBtn = document.getElementById('set-goal-btn');
const hoursProgressBar = document.getElementById('hours-progress-bar');
const hoursPercent = document.getElementById('hours-percent');
const hoursLogged = document.getElementById('hours-logged');
const hoursTarget = document.getElementById('hours-target');

const categoryStatsDiv = document.getElementById('category-stats');

const calcTargetBtn = document.getElementById('calc-target-btn');
const targetResult = document.getElementById('target-result');

const themeToggle = document.getElementById('theme-toggle');
const greeting = document.getElementById('greeting');
const logoutBtn = document.getElementById('logout-btn');
const accountBtn = document.getElementById('account-btn');
const dashboardBtn = document.getElementById('dashboard-btn');

const exportCSVBtn = document.getElementById('export-csv-btn');
const backupDataBtn = document.getElementById('backup-data-btn');
const restoreDataBtn = document.getElementById('restore-data-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const backupText = document.getElementById('backup-text');
const restoreFile = document.getElementById('restore-file');

const accountNameSpan = document.getElementById('account-name');
const accountEmailSpan = document.getElementById('account-email');
const accountStateSpan = document.getElementById('account-state');
const accountScaleSpan = document.getElementById('account-scale');
const settingsForm = document.getElementById('settings-form');
const settingsStateSelect = document.getElementById('settings-state');
const gradingScaleSelect = document.getElementById('grading-scale');
const customAInput = document.getElementById('custom-a');
const customBInput = document.getElementById('custom-b');
const customCInput = document.getElementById('custom-c');
const customDInput = document.getElementById('custom-d');
const settingsNote = document.getElementById('settings-note');
const unweightedGpaSpan = document.getElementById('unweighted-gpa');

// ===== INITIALIZATION =====
function init() {
    if (!checkAuth()) return;

    const currentUser = getCurrentUser();
    dataManager = new DataManager(currentUser.id, currentUser.settings || {});

    setTheme();
    updateGreeting();
    if (classForm) renderClasses();
    if (volunteerForm) renderVolunteer();
    updateStats();
    setTargetInputBounds();
    populateSettingsForm();
    renderAccountInfo();

    if (classForm) classForm.addEventListener('submit', handleAddClass);
    if (volunteerForm) volunteerForm.addEventListener('submit', handleAddVolunteer);
    if (setGoalBtn) setGoalBtn.addEventListener('click', handleSetGoal);
    if (calcTargetBtn) calcTargetBtn.addEventListener('click', handleCalculateTarget);
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (accountBtn) accountBtn.addEventListener('click', () => window.location.href = 'myaccount.html');
    if (dashboardBtn) dashboardBtn.addEventListener('click', () => window.location.href = 'index.html');
    if (settingsForm) settingsForm.addEventListener('submit', handleSaveSettings);
    if (exportCSVBtn) exportCSVBtn.addEventListener('click', handleExportCSV);
    if (backupDataBtn) backupDataBtn.addEventListener('click', handleBackupData);
    if (restoreDataBtn) restoreDataBtn.addEventListener('click', () => restoreFile.click());
    if (restoreFile) restoreFile.addEventListener('change', handleRestoreData);
    if (clearAllBtn) clearAllBtn.addEventListener('click', handleClearAll);
}

// ===== CLASS MANAGEMENT =====
function handleAddClass(e) {
    e.preventDefault();
    const name = classNameInput.value.trim();
    const grade = classGradeSelect.value;
    const weighted = classWeightedCheckbox.checked;
    
    if (!name || !grade) return;
    
    dataManager.addClass(name, grade, weighted);
    renderClasses();
    updateStats();
    
    classForm.reset();
    classNameInput.focus();
    showNotification('Class added successfully!');
}

function deleteClass(id) {
    if (confirm('Delete this class?')) {
        dataManager.removeClass(id);
        renderClasses();
        updateStats();
        showNotification('Class deleted');
    }
}

function renderClasses() {
    classList.innerHTML = '';
    
    dataManager.classes.forEach(cls => {
        const li = document.createElement('li');
        li.className = 'fade-in';
        li.innerHTML = `
            <div class="item-info">
                <div class="item-name">${cls.name}</div>
                <div class="item-meta">Grade: <strong>${cls.grade}</strong> ${cls.weighted ? '| Weighted' : ''}</div>
            </div>
            <div class="item-value">${cls.points.toFixed(2)}</div>
            <div class="item-actions">
                <button class="btn-delete" onclick="deleteClass(${cls.id})">❌</button>
            </div>
        `;
        classList.appendChild(li);
    });
}

// ===== VOLUNTEER MANAGEMENT =====
function handleAddVolunteer(e) {
    e.preventDefault();
    const org = volOrgInput.value.trim();
    const hours = volHoursInput.value;
    const category = volCategorySelect.value;
    
    if (!org || !hours) return;
    
    dataManager.addVolunteer(org, hours, category);
    renderVolunteer();
    updateStats();
    
    volunteerForm.reset();
    volOrgInput.focus();
    showNotification('Volunteer hours logged!');
}

function deleteVolunteer(id) {
    if (confirm('Delete this entry?')) {
        dataManager.removeVolunteer(id);
        renderVolunteer();
        updateStats();
        showNotification('Entry deleted');
    }
}

function renderVolunteer() {
    volList.innerHTML = '';
    
    dataManager.volunteer.forEach(entry => {
        const li = document.createElement('li');
        li.className = 'fade-in';
        li.innerHTML = `
            <div class="item-info">
                <div class="item-name">${entry.org}</div>
                <div class="item-meta">${entry.category} • ${entry.date}</div>
            </div>
            <div class="item-value">${entry.hours} hrs</div>
            <div class="item-actions">
                <button class="btn-delete" onclick="deleteVolunteer(${entry.id})">❌</button>
            </div>
        `;
        volList.appendChild(li);
    });
}

// ===== PROGRESS BAR & GOALS =====
function handleSetGoal() {
    const goal = parseInt(hoursGoalInput.value);
    
    if (isNaN(goal) || goal <= 0) {
        alert('Please enter a valid goal');
        return;
    }
    
    dataManager.setHoursGoal(goal);
    updateProgressBar();
    showNotification(`Goal updated to ${goal} hours!`);
}

function updateProgressBar() {
    const total = dataManager.calculateTotalHours();
    const goal = dataManager.hoursGoal;
    const percent = Math.min((total / goal) * 100, 100);
    
    hoursGoalInput.value = goal;
    hoursLogged.textContent = total.toFixed(1);
    hoursTarget.textContent = goal;
    hoursPercent.textContent = Math.round(percent);
    
    const progressFill = hoursProgressBar.querySelector('.progress-fill');
    progressFill.style.width = percent + '%';
    progressFill.textContent = Math.round(percent) + '%';
}

// ===== CATEGORY BREAKDOWN =====
function updateCategoryStats() {
    const breakdown = dataManager.getCategoryBreakdown();
    categoryStatsDiv.innerHTML = '';
    
    if (Object.keys(breakdown).length === 0) {
        categoryStatsDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No volunteer hours logged yet</p>';
        return;
    }
    
    Object.entries(breakdown).forEach(([category, hours]) => {
        const div = document.createElement('div');
        div.className = 'category-stat fade-in';
        div.innerHTML = `
            <h4>${category}</h4>
            <div class="hours">${hours.toFixed(1)}</div>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">hours</p>
        `;
        categoryStatsDiv.appendChild(div);
    });
}

// ===== TARGET GPA CALCULATOR =====
function handleCalculateTarget() {
    const currentGPA = parseFloat(document.getElementById('current-gpa').value);
    const currentCredits = parseInt(document.getElementById('current-credits').value);
    const targetGPA = parseFloat(document.getElementById('target-gpa').value);
    const targetCredits = parseInt(document.getElementById('target-credits').value);
    
    if (isNaN(currentGPA) || isNaN(currentCredits) || isNaN(targetGPA) || isNaN(targetCredits)) {
        alert('Please fill in all fields');
        return;
    }
    
    const currentGradePoints = currentGPA * currentCredits;
    const targetGradePoints = targetGPA * targetCredits;
    const remainingGradePoints = targetGradePoints - currentGradePoints;
    const remainingCredits = targetCredits - currentCredits;
    
    if (remainingCredits <= 0) {
        targetResult.textContent = '❌ Target already met or invalid credit input';
        targetResult.classList.add('show');
        return;
    }
    
    const requiredGPA = (remainingGradePoints / remainingCredits).toFixed(2);
    
    let message = '';
    if (requiredGPA < 0) {
        message = `✅ Your target GPA is already exceeded!`;
    } else if (requiredGPA > dataManager.maxScale) {
        message = `❌ Impossible! You need a ${requiredGPA} GPA in remaining ${remainingCredits} credits (max is ${dataManager.maxScale})`;
    } else {
        message = `You need a <strong>${requiredGPA}</strong> GPA in your remaining <strong>${remainingCredits}</strong> credits to reach <strong>${targetGPA}</strong> by graduation.`;
    }
    
    targetResult.innerHTML = message;
    targetResult.classList.add('show');
}

// ===== STATISTICS UPDATE =====
function updateStats() {
    const gpa = dataManager.calculateGPA();
    const unweightedGPA = dataManager.calculateUnweightedGPA();
    const totalHours = dataManager.calculateTotalHours();
    
    if (weightedGpaSpan) {
        weightedGpaSpan.textContent = parseFloat(gpa).toFixed(2);
    }
    if (unweightedGpaSpan) {
        unweightedGpaSpan.textContent = parseFloat(unweightedGPA).toFixed(2);
    }
    if (totalClassesSpan) {
        totalClassesSpan.textContent = dataManager.classes.length;
    }
    if (totalHoursSpan) {
        totalHoursSpan.textContent = totalHours.toFixed(1);
    }
    
    if (hoursProgressBar) updateProgressBar();
    if (categoryStatsDiv) updateCategoryStats();
}

function setTargetInputBounds() {
    const maxScale = dataManager ? dataManager.maxScale : 5;
    const currentGpaInput = document.getElementById('current-gpa');
    const targetGpaInput = document.getElementById('target-gpa');

    if (currentGpaInput) {
        currentGpaInput.max = maxScale;
        currentGpaInput.placeholder = `Current GPA (max ${maxScale})`;
    }
    if (targetGpaInput) {
        targetGpaInput.max = maxScale;
        targetGpaInput.placeholder = `Target GPA (max ${maxScale})`;
    }
}

function handleSaveSettings(e) {
    e.preventDefault();
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const state = settingsStateSelect ? settingsStateSelect.value : currentUser.state;
    const gradingScaleName = gradingScaleSelect ? gradingScaleSelect.value : currentUser.settings?.gradingScaleName;
    const customScale = {};
    const aValue = parseFloat(customAInput?.value);
    const bValue = parseFloat(customBInput?.value);
    const cValue = parseFloat(customCInput?.value);
    const dValue = parseFloat(customDInput?.value);

    if (customAInput?.value) customScale.A = isNaN(aValue) ? null : aValue;
    if (customBInput?.value) customScale.B = isNaN(bValue) ? null : bValue;
    if (customCInput?.value) customScale.C = isNaN(cValue) ? null : cValue;
    if (customDInput?.value) customScale.D = isNaN(dValue) ? null : dValue;

    const finalCustomScale = Object.keys(customScale).length >= 1 ? {
        ...dataManager.getGradeScaleObjectByName(gradingScaleName),
        ...customScale
    } : null;

    const newSettings = {
        state,
        gradingScaleName,
        customScale: finalCustomScale
    };

    if (window.authManager && authManager.updateUserSettings(currentUser.id, newSettings)) {
        localStorage.setItem('orbittracker_current_user', JSON.stringify({
            ...currentUser,
            state,
            settings: newSettings
        }));
        dataManager.updateSettings(newSettings);
        setTargetInputBounds();
        renderAccountInfo();
        updateStats();
        showNotification('Settings saved successfully!');
    } else {
        showNotification('Unable to save settings.', 'error');
    }
}

function populateSettingsForm() {
    const currentUser = getCurrentUser();
    if (!currentUser || !settingsForm) return;

    accountNameSpan && (accountNameSpan.textContent = currentUser.name);
    accountEmailSpan && (accountEmailSpan.textContent = currentUser.email);
    accountStateSpan && (accountStateSpan.textContent = currentUser.state || 'Not set');
    accountScaleSpan && (accountScaleSpan.textContent = (currentUser.settings && currentUser.settings.gradingScaleName) || '4.0 Scale');

    if (settingsStateSelect) {
        settingsStateSelect.value = currentUser.state || '';
    }
    if (gradingScaleSelect) {
        gradingScaleSelect.value = currentUser.settings?.gradingScaleName || '4.0 Scale';
    }
    if (customAInput) customAInput.value = '';
    if (customBInput) customBInput.value = '';
    if (customCInput) customCInput.value = '';
    if (customDInput) customDInput.value = '';
}

function renderAccountInfo() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    accountNameSpan && (accountNameSpan.textContent = currentUser.name);
    accountEmailSpan && (accountEmailSpan.textContent = currentUser.email);
    accountStateSpan && (accountStateSpan.textContent = currentUser.state || 'Not set');
    accountScaleSpan && (accountScaleSpan.textContent = currentUser.settings?.gradingScaleName || '4.0 Scale');
}

// ===== THEME MANAGEMENT =====
function setTheme() {
    if (dataManager.theme === 'light') {
        document.body.classList.add('light-theme');
        themeToggle.textContent = '🌙';
    } else {
        document.body.classList.remove('light-theme');
        themeToggle.textContent = '☀️';
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    dataManager.theme = isLight ? 'light' : 'dark';
    dataManager.saveToStorage('theme', dataManager.theme);
    themeToggle.textContent = isLight ? '🌙' : '☀️';
}

// ===== GREETING =====
function updateGreeting() {
    const hour = new Date().getHours();
    let greetingText = '';
    
    // Get current user
    const currentUserData = localStorage.getItem('orbittracker_current_user');
    const currentUser = currentUserData ? JSON.parse(currentUserData) : null;
    const userName = currentUser ? currentUser.name : 'User';
    
    if (hour < 12) {
        greetingText = `🌅 Good morning, ${userName}! Keep pushing forward.`;
    } else if (hour < 18) {
        greetingText = `☀️ Good afternoon, ${userName}! Stay focused and productive.`;
    } else {
        greetingText = `🌙 Good evening, ${userName}! Finish strong today.`;
    }
    
    greeting.textContent = greetingText;
}

// ===== DATA EXPORT/IMPORT =====
function handleExportCSV() {
    const csv = dataManager.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `ApexTrack_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Data exported to CSV!');
}

function handleBackupData() {
    const jsonData = dataManager.exportToJSON();
    backupText.value = jsonData;
    backupText.select();
    document.execCommand('copy');
    showNotification('Backup copied to clipboard!');
}

function handleRestoreData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const jsonString = event.target.result;
        if (dataManager.importFromJSON(jsonString)) {
            renderClasses();
            renderVolunteer();
            updateStats();
            showNotification('Data restored successfully!');
        } else {
            alert('Failed to restore data. Invalid file format.');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
}

function handleClearAll() {
    if (confirm('⚠️ This will DELETE ALL your data. Are you sure?')) {
        if (confirm('This action cannot be undone. Really delete everything?')) {
            dataManager.clearAll();
            renderClasses();
            renderVolunteer();
            updateStats();
            showNotification('All data cleared');
        }
    }
}

// ===== NOTIFICATIONS =====
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'var(--success-color)'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== LOGOUT =====
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('orbittracker_current_user');
        showNotification('Logged out successfully!');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 800);
    }
}

// ===== START APPLICATION =====
document.addEventListener('DOMContentLoaded', init);
