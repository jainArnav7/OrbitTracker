// ===== AUTHENTICATION MANAGER =====
class AuthManager {
    constructor() {
        this.users = this.loadUsersFromStorage() || [];
        this.currentUser = this.loadCurrentUserFromStorage();
    }

    loadUsersFromStorage() {
        const data = localStorage.getItem('orbittracker_users');
        return data ? JSON.parse(data) : [];
    }

    saveUsersToStorage() {
        localStorage.setItem('orbittracker_users', JSON.stringify(this.users));
    }

    loadCurrentUserFromStorage() {
        const data = localStorage.getItem('orbittracker_current_user');
        return data ? JSON.parse(data) : null;
    }

    saveCurrentUserToStorage() {
        localStorage.setItem('orbittracker_current_user', JSON.stringify(this.currentUser));
    }

    // Register new user
    signup(name, email, password, state) {
        // Validate email format
        if (!this.isValidEmail(email)) {
            return { success: false, message: 'Please enter a valid email address' };
        }

        // Check if user already exists
        if (this.users.find(u => u.email === email)) {
            return { success: false, message: 'Email already registered' };
        }

        // Validate password strength
        if (password.length < 6) {
            return { success: false, message: 'Password must be at least 6 characters' };
        }

        const gradingScaleName = this.getGradeScaleNameForState(state);

        // Create new user
        const newUser = {
            id: Date.now(),
            name,
            email,
            state,
            settings: {
                gradingScaleName,
                customScale: null
            },
            password: this.hashPassword(password),
            createdAt: new Date().toISOString()
        };

        this.users.push(newUser);
        this.saveUsersToStorage();

        // Auto-login
        this.currentUser = {
            id: newUser.id,
            name,
            email,
            state,
            createdAt: newUser.createdAt,
            settings: newUser.settings
        };
        this.saveCurrentUserToStorage();

        return { success: true, message: 'Account created successfully!' };
    }

    // Login user
    login(email, password) {
        const user = this.users.find(u => u.email === email);

        if (!user) {
            return { success: false, message: 'User not found' };
        }

        if (!this.verifyPassword(password, user.password)) {
            return { success: false, message: 'Incorrect password' };
        }

        // Set current user
        this.currentUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            state: user.state || 'Unknown',
            createdAt: user.createdAt || new Date().toISOString(),
            settings: user.settings || {
                gradingScaleName: this.getGradeScaleNameForState(user.state || 'Unknown'),
                customScale: null
            }
        };
        this.saveCurrentUserToStorage();

        return { success: true, message: 'Login successful!' };
    }

    // Demo login
    demoLogin() {
        const demoUser = {
            id: 9999,
            name: 'Demo User',
            email: 'demo@orbittracker.com',
            state: 'Demo',
            createdAt: new Date().toISOString(),
            settings: {
                gradingScaleName: '4.0 Scale',
                customScale: null
            }
        };

        // Create or use existing demo account
        if (!this.users.find(u => u.email === 'demo@orbittracker.com')) {
            this.users.push({
                id: 9999,
                name: 'Demo User',
                email: 'demo@orbittracker.com',
                state: 'Demo',
                settings: demoUser.settings,
                password: this.hashPassword('demo123'),
                createdAt: demoUser.createdAt
            });
            this.saveUsersToStorage();
        }

        this.currentUser = demoUser;
        this.saveCurrentUserToStorage();

        return { success: true, message: 'Demo login successful!' };
    }

    // Logout user
    logout() {
        this.currentUser = null;
        localStorage.removeItem('orbittracker_current_user');
    }

    // Check if user is logged in
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Simple hash (for demo purposes - use proper hashing in production)
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    // Verify password
    verifyPassword(password, hash) {
        return this.hashPassword(password) === hash;
    }

    // Get grading scale name based on state
    getGradeScaleNameForState(state) {
        const scale43States = ['Colorado', 'New York', 'Massachusetts', 'Vermont', 'Washington'];
        const scale50States = ['Texas', 'Louisiana'];

        if (scale43States.includes(state)) {
            return '4.3 Scale';
        }

        if (scale50States.includes(state)) {
            return '5.0 Scale';
        }

        return '4.0 Scale';
    }

    getGradeScaleObjectByName(name) {
        const scales = {
            '4.0 Scale': { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0, max: 4.0 },
            '4.3 Scale': { A: 4.3, B: 3.3, C: 2.3, D: 1.3, F: 0.0, max: 4.3 },
            '5.0 Scale': { A: 5.0, B: 4.0, C: 3.0, D: 2.0, F: 0.0, max: 5.0 }
        };

        return scales[name] || scales['4.0 Scale'];
    }

    updateUserSettings(userId, settings) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return false;

        user.settings = {
            ...user.settings,
            ...settings
        };

        this.saveUsersToStorage();

        if (this.currentUser && this.currentUser.id === userId) {
            this.currentUser.settings = {
                ...this.currentUser.settings,
                ...settings
            };
            if (settings.state) {
                this.currentUser.state = settings.state;
            }
            this.saveCurrentUserToStorage();
        }

        return true;
    }

    // Validate email
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}

// Initialize auth manager
const authManager = new AuthManager();

// ===== LOGIN PAGE LOGIC =====
if (document.getElementById('login-form')) {
    const loginForm = document.getElementById('login-form');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const demoLoginBtn = document.getElementById('demo-login-btn');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value;

        const result = authManager.login(email, password);

        if (result.success) {
            showMessage('Login successful! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            showMessage(result.message, 'error');
        }
    });

    demoLoginBtn.addEventListener('click', () => {
        const result = authManager.demoLogin();
        if (result.success) {
            showMessage('Demo login successful! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }
    });
}

// ===== SIGNUP PAGE LOGIC =====
if (document.getElementById('signup-form')) {
    const signupForm = document.getElementById('signup-form');
    const signupNameInput = document.getElementById('signup-name');
    const signupEmailInput = document.getElementById('signup-email');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupConfirmInput = document.getElementById('signup-confirm');
    const signupStateSelect = document.getElementById('signup-state');
    const signupAgreeInput = document.getElementById('signup-agree');

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = signupNameInput.value.trim();
        const email = signupEmailInput.value.trim();
        const password = signupPasswordInput.value;
        const confirm = signupConfirmInput.value;
        const state = signupStateSelect.value;

        // Validate fields
        if (!name) {
            showMessage('Please enter your full name', 'error');
            return;
        }

        if (!state) {
            showMessage('Please select your state', 'error');
            return;
        }

        if (password !== confirm) {
            showMessage('Passwords do not match', 'error');
            return;
        }

        if (!signupAgreeInput.checked) {
            showMessage('Please agree to the Terms of Service', 'error');
            return;
        }

        const result = authManager.signup(name, email, password, state);

        if (result.success) {
            showMessage('Account created successfully! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            showMessage(result.message, 'error');
        }
    });
}

// ===== MESSAGE DISPLAY =====
function showMessage(message, type) {
    // Remove existing messages
    const existingMessage = document.querySelector('.error-message, .success-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
    messageDiv.textContent = message;

    const form = document.querySelector('form');
    form.insertBefore(messageDiv, form.firstChild);

    if (type === 'error') {
        setTimeout(() => messageDiv.remove(), 5000);
    }
}
