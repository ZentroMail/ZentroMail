// ==========================================
// 1. FIREBASE INITIALIZATION (SMS Verification)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-yPDfT_whewUeEKiTYMf5uXZWlnQguQg",
  authDomain: "zentro-mail-33f54.firebaseapp.com",
  projectId: "zentro-mail-33f54",
  storageBucket: "zentro-mail-33f54.firebasestorage.app",
  messagingSenderId: "356554200947",
  appId: "1:356554200947:web:2da6a4cb52bb2b6cbf9706",
  measurementId: "G-ZN5JGBBNFE"
};
const firebaseApp = initializeApp(firebaseConfig);
const analytics = getAnalytics(firebaseApp);
const firebaseAuth = getAuth(firebaseApp);

// ==========================================
// 2. SUPABASE INITIALIZATION (Auth & Database)
// ==========================================
const SUPABASE_URL = "https://mharhvgwjtyzpdarmjrf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oYXJodmd3anR5enBkYXJtanJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTU2NzQsImV4cCI6MjA5MDM5MTY3NH0.qHBKD-EVtOxlTwCvOHP-6jBsrVTCp1eszPuSfk_X8jI";
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ==========================================
// 3. MAIN APP LOGIC
// ==========================================
window.onerror = function(message, source, lineno) {
    console.error("ERROR:", message, "at line", lineno);
};

const app = {
    state: {
        currentUser: null,
        savedAccounts: [], 
        navigationHistory: [],
        isLoginMode: false,
        tempEmail: '',
        tempPhone: '',
        tempPass: '',
        confirmationResult: null, 
        activeMessage: null,
        currentMessageFolder: null, 
        currentMessageId: null, 
        currentDraftId: null,
        autoSaveTimer: null,
        activeTab: 'inbox',
        isSending: false, 
        
        countries: {
            'AE': { code: '+971', flag: '🇦🇪', length: 9, prefixes: ['50','52','54','55','56','58'], name: 'UAE' },
            'US': { code: '+1', flag: '🇺🇸', length: 10, name: 'US' }, 
            'UK': { code: '+44', flag: '🇬🇧', length: 10, prefixes: ['7'], name: 'UK' },
            'IN': { code: '+91', flag: '🇮🇳', length: 10, prefixes: ['6','7','8','9'], name: 'India' }
        },
        activeCountry: { auth: 'AE', update: 'AE' }
    },

    saveData() {
        localStorage.setItem('zentro_saved_accounts', JSON.stringify(this.state.savedAccounts));
    },

    loadData() {
        const storedAccounts = localStorage.getItem('zentro_saved_accounts');
        if (storedAccounts) {
            this.state.savedAccounts = JSON.parse(storedAccounts);
        }
    },

    async init() {
        this.loadData();
        this.setupOTPInputs();
        this.setupPhoneFormatting('auth');
        this.setupPhoneFormatting('update');
        this.setupClickOutside();
        this.setupScrollObserver(); 
        
        this.checkOAuthRedirect();
        
        this.runCinematicIntro();
    },

    // ==========================================
    // GOOGLE OAUTH LOGIC
    // ==========================================
    async handleGoogleAuth(intent) {
        if (!supabaseClient) {
            this.showToast("Database connection offline.");
            return;
        }

        // Save intent for strictly separating login/signup paths upon redirect
        localStorage.setItem('zentro_oauth_intent', intent);
        
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) {
            this.showToast(error.message);
            localStorage.removeItem('zentro_oauth_intent');
        }
    },

    async checkOAuthRedirect() {
        const intent = localStorage.getItem('zentro_oauth_intent');
        if (!intent || !supabaseClient) return;

        this.showLoader("Verifying secure connection...");
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (session) {
            const user = session.user;
            
            // Query profiles table
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('id, provider')
                .eq('id', user.id)
                .single();

            if (intent === 'login') {
                if (!profile) {
                    await supabaseClient.auth.signOut();
                    this.showToast("This account is not registered.");
                    localStorage.removeItem('zentro_oauth_intent');
                    this.hideLoader();
                    this.navToAuth('signin');
                    return;
                }
                this.finalizeLogin(user);

            } else if (intent === 'signup') {
                if (profile) {
                    await supabaseClient.auth.signOut();
                    this.showToast("This account is already registered.");
                    localStorage.removeItem('zentro_oauth_intent');
                    this.hideLoader();
                    this.navToAuth('signup');
                    return;
                }
                
                await supabaseClient.from('profiles').insert([{
                    id: user.id,
                    email: user.email,
                    provider: 'google'
                }]);
                
                this.state.currentUser = { id: user.id, email: user.email, inbox: [], sent: [], drafts: [], trash: [], archive: [], starred: [] };
                this.hideAllViews();
                this.nav('google-welcome-screen');

            } else if (intent === 'connect') {
                if (!profile) {
                    await supabaseClient.from('profiles').insert([{ id: user.id, email: user.email, provider: 'google' }]);
                } else {
                    await supabaseClient.from('profiles').update({ provider: 'google' }).eq('id', user.id);
                }
                this.finalizeLogin(user);
                this.setTab('settings');
                this.showToast("Google account connected.");
            }
        }
        
        localStorage.removeItem('zentro_oauth_intent');
        this.hideLoader();
    },

    setupScrollObserver() {
        const observerOptions = { root: null, rootMargin: '0px', threshold: 0.15 };
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target); 
                }
            });
        }, observerOptions);
        document.querySelectorAll('.legal-section').forEach(section => {
            observer.observe(section);
        });
    },

    runCinematicIntro() {
        const intro = this.el('intro-screen');
        const particleContainer = this.el('intro-particles');
        
        if (particleContainer) {
            for (let i = 0; i < 25; i++) {
                const p = document.createElement("div");
                p.className = "particle";
                p.style.left = Math.random() * 100 + "vw";
                p.style.top = Math.random() * 100 + "vh";
                p.style.animationDuration = (5 + Math.random() * 10) + "s";
                particleContainer.appendChild(p);
            }
        }

        setTimeout(() => {
            if(intro) {
                intro.classList.add('fade-out-slow');
                setTimeout(() => {
                    this.nav('landing-screen');
                    intro.classList.remove('active', 'fade-out-slow'); 
                    intro.classList.add('hidden');
                }, 800); 
            } else {
                this.nav('landing-screen');
            }
        }, 4500);
    },

    el: (id) => document.getElementById(id),
    delay: (ms) => new Promise(res => setTimeout(res, ms)),
    genId: () => Date.now().toString() + Math.floor(Math.random()*1000),

    showLoader(msg = "Processing...") {
        const textEl = this.el('loader-msg');
        if (textEl) textEl.innerText = msg;
        const loader = this.el('global-loader');
        if (loader) loader.classList.remove('hidden', 'fade-out');
    },
    
    hideLoader() {
        const loader = this.el('global-loader');
        if (loader) { loader.classList.add('fade-out'); setTimeout(() => loader.classList.add('hidden'), 400); }
    },

    showToast(msg) {
        const t = this.el('toast');
        if (!t) return;
        t.innerText = msg;
        t.classList.remove('hidden', 'show');
        void t.offsetWidth; 
        t.classList.add('show');
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.classList.add('hidden'), 300); }, 4000);
    },

    hideAllViews() {
        document.querySelectorAll('.dashboard-view, .modal, .modal-overlay, [id$="modal"]').forEach(el => {
            el.classList.add('hidden');
        });
        const compose = document.getElementById('compose-modal');
        if (compose) compose.classList.add('hidden');
        const profileDrop = document.getElementById('profile-dropdown');
        if (profileDrop) profileDrop.classList.add('hidden');
    },

    nav(pageId, isBack = false) {
        const currentActive = document.querySelector('.page.active');
        if (currentActive && !isBack) {
            this.state.navigationHistory.push(currentActive.id);
        }

        const pages = document.querySelectorAll('.page');
        pages.forEach(p => {
            p.classList.remove('active');
            p.classList.add('hidden');
        });
        const target = document.getElementById(pageId);
        if (!target) return;

        target.classList.remove('hidden');
        setTimeout(() => { target.classList.add('active'); }, 50);
    },

    goBack() {
        const currentActive = document.querySelector('.page.active');
        if (currentActive) currentActive.classList.add('fade-out-fast');
        setTimeout(() => {
            if (this.state.navigationHistory.length > 0) {
                const previousPage = this.state.navigationHistory.pop();
                this.nav(previousPage, true); 
            } else {
                this.nav('landing-screen', true);
            }
            if (currentActive) currentActive.classList.remove('fade-out-fast');
        }, 200);
    },

    validatePasswordStrength(pw, prefix) {
        if (prefix === 'auth' && this.state.isLoginMode) return true;
        const rules = {
            length: pw.length >= 8,
            upper: /[A-Z]/.test(pw),
            lower: /[a-z]/.test(pw),
            number: /[0-9]/.test(pw),
            special: /[!@#$%^&*]/.test(pw)
        };
        let passedCount = 0;
        for (const [id, met] of Object.entries(rules)) {
            const el = this.el(`${prefix}-rule-${id}`);
            if (el) {
                if (met) { 
                    el.classList.add('valid');
                    el.classList.remove('invalid'); 
                } else { 
                    el.classList.remove('valid');
                    el.classList.add('invalid'); 
                }
                if (met) passedCount++;
            }
        }

        const bar = this.el(`${prefix}-strength-bar`);
        const checklist = this.el(`${prefix}-pass-checklist`);
        
        if (pw.length > 0) {
            if (checklist) checklist.classList.remove('hidden');
        } else {
            if (checklist) checklist.classList.add('hidden');
        }

        if (bar) {
            bar.style.width = (passedCount / 5 * 100) + '%';
            bar.style.backgroundColor = passedCount < 3 ? 'var(--danger)' : passedCount < 5 ? '#ff9f0a' : 'var(--success)';
        }
        return passedCount === 5;
    },

    toggleCountryDropdown(e, listId) {
        if(e) e.stopPropagation();
        document.querySelectorAll('.country-dropdown').forEach(d => { if(d.id !== listId) d.classList.add('hidden'); });
        const drop = this.el(listId);
        if(drop) drop.classList.toggle('hidden');
    },

    selectCountry(countryKey, prefix) {
        this.state.activeCountry[prefix] = countryKey;
        const conf = this.state.countries[countryKey];
        const flag = this.el(`${prefix}-flag`);
        const code = this.el(`${prefix}-code`);
        const drop = this.el(`${prefix}-country-list`);
        const input = this.el(`${prefix}-phone`);
        const errEl = this.el(`${prefix}-phone-error`);

        if(flag) flag.innerText = conf.flag;
        if(code) code.innerText = conf.code;
        if(drop) drop.classList.add('hidden');
        if(errEl) errEl.classList.add('hidden');
        if(input) {
            const raw = input.value.replace(/\D/g, '');
            input.value = this.formatPhone(raw, conf.length);
        }
    },

    validatePhone(raw, countryKey, isSubmit = false) {
        const conf = this.state.countries[countryKey];
        if (!raw && isSubmit) return { isValid: false, errorMsg: "Phone number is required." };
        if (!raw && !isSubmit) return { isValid: true, errorMsg: "" };

        let hasPrefixError = false;
        if (isSubmit) {
            if (countryKey === 'AE') {
                if (raw.length < 2 || !conf.prefixes.includes(raw.substring(0, 2))) hasPrefixError = true;
            } else if (countryKey === 'US') {
                if (raw.length >= 1 && (raw[0] === '0' || raw[0] === '1')) hasPrefixError = true;
            } else if (countryKey === 'UK') {
                if (raw.length >= 1 && raw[0] !== '7') hasPrefixError = true;
            } else if (countryKey === 'IN') {
                if (raw.length >= 1 && !conf.prefixes.includes(raw[0])) hasPrefixError = true;
            }
            if (raw.length !== conf.length) {
                return { isValid: false, errorMsg: `Invalid ${conf.name} mobile number length.` };
            }
        }
        if (hasPrefixError) return { isValid: false, errorMsg: `Invalid ${conf.name} mobile number prefix.` };
        return { isValid: true, errorMsg: "" };
    },

    setupPhoneFormatting(prefix) {
        const input = this.el(`${prefix}-phone`);
        if(!input) return;
        let errEl = this.el(`${prefix}-phone-error`);

        input.addEventListener('input', (e) => {
            const currentCtry = this.state.activeCountry[prefix];
            const conf = this.state.countries[currentCtry];
            let raw = e.target.value.replace(/\D/g, '');
            if(raw.length > conf.length) raw = raw.slice(0, conf.length);
            e.target.value = this.formatPhone(raw, conf.length);

            if (raw.length > 0) {
                const validation = this.validatePhone(raw, currentCtry, false);
                if (!validation.isValid && validation.errorMsg) {
                    if (errEl) { errEl.innerText = validation.errorMsg; errEl.classList.remove('hidden'); }
                } else {
                    if (errEl) errEl.classList.add('hidden');
                }
            } else {
                if (errEl) errEl.classList.add('hidden');
            }
        });
    },

    formatPhone(raw, expectedLength) {
        let val = raw;
        if (expectedLength === 9) { 
            if (val.length > 2) val = val.substring(0,2) + ' ' + val.substring(2);
            if (val.length > 6) val = val.substring(0,6) + ' ' + val.substring(6);
        } else if (expectedLength === 10) { 
            if (val.length > 3) val = val.substring(0,3) + ' ' + val.substring(3);
            if (val.length > 7) val = val.substring(0,7) + ' ' + val.substring(7);
        }
        return val.trim();
    },

    maskPhone(phone) {
        if (!phone || phone.length < 8) return phone;
        const first4 = phone.substring(0, 4);
        const last4 = phone.substring(phone.length - 4);
        const mid = phone.substring(4, phone.length - 4);
        return first4 + mid.replace(/\d/g, '*') + last4;
    },

    setupOTPInputs() {
        document.querySelectorAll('.otp-container').forEach(group => {
            const inputs = group.querySelectorAll('.otp-input');
            inputs.forEach((input, i) => {
                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, ''); 
                    if (e.target.value && i < inputs.length - 1) {
                        inputs[i+1].focus();
                    }
                    const code = Array.from(inputs).map(inp => inp.value).join('');
                    if (code.length === inputs.length) {
                        if (group.id === 'auth-otp') app.submitVerification();
                    }
                });
                
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.value && i > 0) inputs[i-1].focus();
                });
            });
        });
    },

    clearOTP(groupId) {
        const group = this.el(groupId);
        if (group) {
            group.querySelectorAll('.otp-input').forEach(b => b.value = '');
            group.querySelector('.otp-input').focus();
        }
    },

    getOTP(groupId) {
        let code = '';
        const group = this.el(groupId);
        if (group) group.querySelectorAll('.otp-input').forEach(b => code += b.value);
        return code;
    },

    navToAuth(mode) {
        if (mode === 'signin') {
            this.state.isLoginMode = true;
        } else {
            this.state.isLoginMode = false;
        }

        this.updateAuthUI();

        const form = this.el('auth-form');
        if (form) form.reset();
        ['auth-error', 'auth-phone-error', 'auth-pass-checklist'].forEach(id => {
            const el = this.el(id);
            if(el) el.classList.add('hidden');
        });
        this.nav('auth-screen');
    },

    toggleAuthMode() {
        this.state.isLoginMode = !this.state.isLoginMode;
        this.updateAuthUI();
        const form = this.el('auth-form');
        if (form) form.reset();
        
        ['auth-error', 'auth-phone-error', 'auth-pass-checklist'].forEach(id => {
            const el = this.el(id);
            if(el) el.classList.add('hidden');
        });
    },

    updateAuthUI() {
        const titleEl = this.el('auth-title');
        const subEl = this.el('auth-sub');
        const submitEl = this.el('auth-submit');
        const toggleBtn = this.el('toggle-auth-btn');
        const forgotBtn = this.el('forgot-btn');
        const phoneGroup = this.el('auth-phone-group');
        const phoneInput = this.el('auth-phone');
        const passInput = this.el('auth-password');
        const passChecklist = this.el('auth-pass-checklist');
        
        const googleLoginBtn = this.el('btn-google-login');
        const googleSignupBtn = this.el('btn-google-signup');

        if (this.state.isLoginMode === true) {
            if(titleEl) titleEl.innerText = 'Welcome Back';
            if(subEl) subEl.innerText = 'Access your encrypted workspace.';
            if(submitEl) submitEl.innerText = 'Sign In';
            if(toggleBtn) toggleBtn.innerText = 'Create Account instead';
            if(forgotBtn) forgotBtn.classList.remove('hidden');
            if(phoneGroup) phoneGroup.classList.add('hidden');
            if(phoneInput) phoneInput.required = false;
            if(passInput) passInput.oninput = null; 
            if(passChecklist) passChecklist.classList.add('hidden');
            
            if(googleLoginBtn) googleLoginBtn.classList.remove('hidden');
            if(googleSignupBtn) googleSignupBtn.classList.add('hidden');
        } else {
            if(titleEl) titleEl.innerText = 'Create Account';
            if(subEl) subEl.innerText = 'Join the secure network.';
            if(submitEl) submitEl.innerText = 'Continue';
            if(toggleBtn) toggleBtn.innerText = 'Sign In instead';
            if(forgotBtn) forgotBtn.classList.add('hidden');
            if(phoneGroup) phoneGroup.classList.remove('hidden');
            if(phoneInput) phoneInput.required = true;
            if(passInput) passInput.oninput = (e) => app.validatePasswordStrength(e.target.value, 'auth');
            
            if(googleLoginBtn) googleLoginBtn.classList.add('hidden');
            if(googleSignupBtn) googleSignupBtn.classList.remove('hidden');
        }
    },

    async handleAuth(e) {
        e.preventDefault();
        const emailEl = this.el('auth-email');
        const passEl = this.el('auth-password');
        const phoneEl = this.el('auth-phone');
        const errEl = this.el('auth-error');
        const phoneErrEl = this.el('auth-phone-error');
        const submitBtn = this.el('auth-submit');
        
        if (!emailEl || !passEl || !submitBtn) return;

        const email = emailEl.value.trim().toLowerCase();
        const pass = passEl.value;
        const phone = phoneEl ? phoneEl.value.trim() : '';
        if (errEl) errEl.classList.add('hidden');
        if (!supabaseClient) {
            if (errEl) { errEl.innerText = "Database connection offline."; errEl.classList.remove('hidden'); }
            return;
        }

        if (!this.state.isLoginMode) {
            if (!email.endsWith('@zentro.mail')) {
                if (errEl) { errEl.innerText = "Email must end with @zentro.mail"; errEl.classList.remove('hidden'); }
                return;
            }
            if (!this.validatePasswordStrength(pass, 'auth')) {
                if (errEl) { errEl.innerText = "Password must meet all security requirements."; errEl.classList.remove('hidden'); }
                return;
            }

            const rawPhone = phoneEl ? phoneEl.value.replace(/\D/g, '') : '';
            const validation = this.validatePhone(rawPhone, this.state.activeCountry.auth, true);
            if (!validation.isValid) {
                if (phoneErrEl) { phoneErrEl.innerText = validation.errorMsg; phoneErrEl.classList.remove('hidden'); }
                return;
            } else {
                if (phoneErrEl) phoneErrEl.classList.add('hidden');
            }
            
            const conf = this.state.countries[this.state.activeCountry.auth];
            const fullPhoneString = `${conf.code}${rawPhone}`;
            this.showLoader("Transmitting secure SMS...");
            
            try {
                if (window.recaptchaVerifier) {
                    window.recaptchaVerifier.clear();
                    window.recaptchaVerifier = null;
                }
                document.querySelectorAll('.grecaptcha-badge').forEach(el => el.remove());
                window.recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, 'auth-submit', { 'size': 'invisible' });
                const appVerifier = window.recaptchaVerifier;
                const confirmationResult = await signInWithPhoneNumber(firebaseAuth, fullPhoneString, appVerifier);
                
                this.state.confirmationResult = confirmationResult;
                this.state.tempEmail = email;
                this.state.tempPass = pass;
                this.state.tempPhone = fullPhoneString;
                
                this.hideLoader();
                this.clearOTP('auth-otp');
                
                const verifyErr = this.el('verify-error');
                if (verifyErr) verifyErr.classList.add('hidden');
                
                this.el('verify-title').innerText = "Verify Phone Number";
                this.el('verify-desc').innerText = `Enter the 6-digit code sent to ${this.maskPhone(fullPhoneString)}.`;
                this.nav('verify-screen');
            } catch (error) {
                this.hideLoader();
                console.error("SMS Error:", error);
                if (window.recaptchaVerifier) {
                    window.recaptchaVerifier.clear();
                    window.recaptchaVerifier = null;
                }
                document.querySelectorAll('.grecaptcha-badge').forEach(el => el.remove());
                let errorMsg = "Failed to send SMS. Please try again.";
                if (error.code === 'auth/invalid-phone-number') errorMsg = "The phone number format is invalid.";
                if (error.code === 'auth/too-many-requests') errorMsg = "Too many requests. Please try again later.";
                if (errEl) { errEl.innerText = errorMsg; errEl.classList.remove('hidden'); }
            }

        } else {
            this.showLoader("Authenticating via Supabase...");
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: pass });
            this.hideLoader();

            if (error) {
                if (errEl) { errEl.innerText = error.message; errEl.classList.remove('hidden'); }
                return;
            }
            this.finalizeLogin(data.user);
        }
    },

    async submitVerification() {
        const code = this.getOTP('auth-otp');
        if(code.length < 6) return;

        const errEl = this.el('verify-error');
        const isSignup = !this.state.isLoginMode;
        if (isSignup) {
            if (!this.state.confirmationResult) {
                if (errEl) { errEl.innerText = "Session expired. Please restart the sign-up process."; errEl.classList.remove('hidden'); }
                return;
            }

            this.showLoader("Verifying code...");
            try {
                await this.state.confirmationResult.confirm(code);
                this.showLoader("Provisioning secure inbox...");

                const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                    email: this.state.tempEmail,
                    password: this.state.tempPass
                });
                if (authError) throw authError;

                if (authData && authData.user) {
                    await supabaseClient.from('profiles').insert([{
                        id: authData.user.id,
                        email: this.state.tempEmail,
                        phone: this.state.tempPhone,
                        provider: 'email'
                    }]);
                }

                if (errEl) errEl.classList.add('hidden');
                this.finalizeLogin(authData.user);
            } catch (error) {
                this.hideLoader();
                console.error("Verification Error:", error);
                let errorMsg = "Invalid code. Please try again.";
                if (error.code === 'auth/code-expired') errorMsg = "Verification code has expired.";
                if (errEl) { errEl.innerText = errorMsg; errEl.classList.remove('hidden'); }
                this.clearOTP('auth-otp');
            } finally {
                if (window.recaptchaVerifier) {
                    window.recaptchaVerifier.clear();
                    window.recaptchaVerifier = null;
                }
                document.querySelectorAll('.grecaptcha-badge').forEach(el => el.remove());
            }
        }
    },

    finalizeLogin(user) {
        this.hideLoader();
        this.state.currentUser = {
            id: user.id,
            email: user.email,
            inbox: [], sent: [], drafts: [], trash: [], archive: [], starred: []
        };
        if (!this.state.savedAccounts.includes(user.email)) {
            if (this.state.savedAccounts.length >= 2) {
                this.showToast("Maximum of 2 accounts allowed per device.");
                this.state.currentUser = null;
                this.nav('landing-screen');
                return;
            }
            this.state.savedAccounts.push(user.email);
            this.saveData();
        }
        this.initDashboard();
    },

    handleIssueChange(selectEl, mode) {
        const groupPrefix = mode === 'public' ? 'public-other' : 'internal-other';
        const otherGroup = document.getElementById(`${groupPrefix}-group`);
        const otherInput = document.getElementById(`${groupPrefix}-text`);

        if (!otherGroup || !otherInput) return;
        if (selectEl.value === 'other') {
            otherGroup.classList.add('active');
            otherInput.setAttribute('required', 'true');
            setTimeout(() => otherInput.focus(), 350); 
        } else {
            otherGroup.classList.remove('active');
            otherInput.removeAttribute('required');
            otherInput.value = ''; 
        }
    },

    async submitPublicSupport(e) {
        e.preventDefault();
        if (localStorage.getItem("supportSubmitted") === "true") {
            this.showToast("You already submitted a request. Please wait for our team to respond.");
            return;
        }

        const typeEl = document.getElementById("public-issue-type");
        const otherEl = document.getElementById("public-other-text");
        const descEl = document.getElementById("public-issue-desc");
        
        if (!typeEl || !descEl || !typeEl.value) {
            this.showToast("Please select an issue type.");
            return;
        }
        if (typeEl.value === "other" && (!otherEl || !otherEl.value.trim())) {
            this.showToast("Please specify your issue topic.");
            if (otherEl) otherEl.focus();
            return;
        }

        this.showLoader("Encrypting & Sending...");
        const finalType = typeEl.value === 'other' ? `Other: ${otherEl.value.trim()}` : typeEl.value;
        const ticketID = "TKT-" + this.genId();
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from("tickets").insert([{
                        id: ticketID, type: finalType, description: descEl.value.trim(), status: "Pending"
                    }]);
                if (error) throw error;
                this.hideLoader();
                localStorage.setItem("supportSubmitted", "true");
                document.getElementById("public-form-box").style.display = "none";
                document.getElementById("public-success-box").style.display = "block";
                
                const trackBtn = document.getElementById("public-view-ticket-btn");
                if(trackBtn) trackBtn.onclick = () => { this.viewTicket(ticketID); };
            } catch (error) {
                console.error("Supabase Error:", error);
                this.hideLoader();
                this.showToast("Secure transmission failed. Please check your connection.");
            }
        } else {
            this.hideLoader();
            this.showToast("Database connection offline.");
        }
    },

    async submitSupport() {
        if (localStorage.getItem("internalSupportSubmitted") === "true") {
            this.showToast("You already submitted a request. Please wait for our team to respond.");
            return;
        }
        const typeEl = document.getElementById('internal-issue-type');
        const otherEl = document.getElementById('internal-other-text');
        const msgEl = document.getElementById('support-msg');

        if (!typeEl || !msgEl || !typeEl.value) {
            this.showToast("Please select an issue type.");
            return;
        }
        if (typeEl.value === "other" && (!otherEl || !otherEl.value.trim())) {
            this.showToast("Please specify your issue topic.");
            if (otherEl) otherEl.focus();
            return;
        }
        if (!msgEl.value.trim()) {
            this.showToast("Please provide a description.");
            return;
        }

        this.showLoader("Encrypting & Sending...");
        const finalType = typeEl.value === 'other' ? `Other: ${otherEl.value.trim()}` : typeEl.value;
        const ticketID = "TKT-" + this.genId();
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from("tickets").insert([{
                        id: ticketID, type: finalType, description: msgEl.value.trim(), status: "Pending"
                    }]);
                if (error) throw error;
                this.hideLoader();
                localStorage.setItem("internalSupportSubmitted", "true");
                document.getElementById("internal-form-box").style.display = "none";
                document.getElementById("internal-success-box").style.display = "block";
                
                const trackBtn = document.getElementById("internal-view-ticket-btn");
                if(trackBtn) trackBtn.onclick = () => { this.viewTicket(ticketID); };
            } catch (error) {
                console.error("Supabase Error:", error);
                this.hideLoader();
                this.showToast("Secure transmission failed.");
            }
        } else {
            this.hideLoader();
            this.showToast("Database connection offline.");
        }
    },

    async viewTicket(ticketId) {
        this.nav('ticket-screen');
        document.getElementById('ticket-loading').classList.remove('hidden');
        document.getElementById('ticket-content').classList.add('hidden');
        document.getElementById('ticket-error').classList.add('hidden');

        if (supabaseClient) {
            const { data, error } = await supabaseClient.from("tickets").select("*").eq("id", ticketId).single();
            document.getElementById('ticket-loading').classList.add('hidden');

            if (error || !data) {
                console.error("Fetch Error:", error);
                document.getElementById('ticket-error').classList.remove('hidden');
                return;
            }

            document.getElementById('tkt-id-display').innerText = data.id;
            document.getElementById('tkt-type-display').innerText = data.type.replace('-', ' ');
            const dateObj = new Date(data.created_at || Date.now());
            document.getElementById('tkt-date-display').innerText = dateObj.toLocaleString();
            document.getElementById('tkt-desc-display').innerText = data.description;
            
            const badgeContainer = document.getElementById('tkt-badge-display');
            const status = data.status.toLowerCase();
            
            if (status === 'resolved') {
                badgeContainer.innerHTML = `<span class="tkt-badge badge-resolved">Resolved</span>`;
            } else if (status === 'in review') {
                badgeContainer.innerHTML = `<span class="tkt-badge badge-review">In Review</span>`;
            } else {
                badgeContainer.innerHTML = `<span class="tkt-badge badge-pending">Pending</span>`;
            }
            document.getElementById('ticket-content').classList.remove('hidden');
        } else {
             document.getElementById('ticket-loading').classList.add('hidden');
             document.getElementById('ticket-error').classList.remove('hidden');
        }
    },

    copyTicketId() {
        const id = document.getElementById('tkt-id-display').innerText;
        navigator.clipboard.writeText(id).then(() => {
            this.showToast("Ticket ID copied to clipboard.");
        });
    },

    setupClickOutside() {
        window.addEventListener('click', (e) => {
            const drop = document.getElementById('profile-dropdown');
            const countryDropAuth = document.getElementById('auth-country-list');
            const countryDropUpdate = document.getElementById('update-country-list');
            
            if (drop && !e.target.closest('.user-profile-wrapper') && !drop.classList.contains('hidden')) {
                drop.classList.add('hidden');
            }
            if (countryDropAuth && !e.target.closest('.phone-input-wrapper') && !countryDropAuth.classList.contains('hidden')) {
                countryDropAuth.classList.add('hidden');
            }
            if (countryDropUpdate && !e.target.closest('.phone-input-wrapper') && !countryDropUpdate.classList.contains('hidden')) {
                countryDropUpdate.classList.add('hidden');
            }
        });
    },

    toggleProfile(e) {
        if (e) e.stopPropagation();
        const drop = this.el('profile-dropdown');
        if(drop) drop.classList.toggle('hidden');
    },

    initDashboard() {
        if (!this.state.currentUser) return;
        const pEmail = this.el('sidebar-email');
        const sAvatar = this.el('sidebar-avatar');
        if (pEmail) pEmail.innerText = this.state.currentUser.email;
        if (sAvatar) sAvatar.innerText = this.state.currentUser.email.charAt(0).toUpperCase();

        this.nav('dashboard-screen');
        this.setTab('inbox');
    },

    setTab(tabName) {
        this.state.activeTab = tabName;
        this.hideAllViews();
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active');
            if (btn.innerText.toLowerCase().includes(tabName.toLowerCase()) || 
               (tabName === 'settings' && btn.innerText.toLowerCase().includes('settings'))) {
                btn.classList.add('active');
            }
        });
        const titleMap = { 
            inbox: 'Inbox', starred: 'Starred', sent: 'Sent', drafts: 'Drafts', archive: 'Archive', 
            trash: 'Trash', settings: 'Account Settings', support: 'Contact Support', '2fa-request': 'Security Request' 
        };
        const viewTitle = this.el('view-title');
        if (viewTitle) viewTitle.innerText = titleMap[tabName] || 'Mailbox';
        if (['inbox', 'sent', 'trash', 'drafts', 'archive', 'starred'].includes(tabName)) {
            const vView = this.el('view-' + tabName);
            if (vView) vView.classList.remove('hidden');
            this.renderMailbox(tabName);
        } else {
            const target = document.getElementById('view-' + tabName);
            if (target) target.classList.remove('hidden');
            if (tabName === 'settings') this.renderSettings(); 
        }
    },

    async renderSettings() {
        if (!this.state.currentUser) return;
        const u = this.state.currentUser;

        const emailDisp = this.el('set-email');
        const phoneDisp = this.el('set-phone');
        const providerDisp = this.el('set-provider');
        const providerAction = this.el('set-provider-action');
        
        if(emailDisp) emailDisp.innerText = u.email;
        if(phoneDisp) phoneDisp.innerText = u.phone ? this.maskPhone(u.phone) : 'Not provided';

        if(providerDisp && supabaseClient) {
            const { data: profile } = await supabaseClient.from('profiles').select('provider').eq('id', u.id).single();
            if (profile && profile.provider === 'google') {
                providerDisp.innerHTML = 'Google: Connected';
                if(providerAction) providerAction.innerHTML = '<span class="text-success">✅</span>';
            } else {
                providerDisp.innerHTML = 'Google: Not Connected';
                if(providerAction) providerAction.innerHTML = '<button class="btn btn-secondary btn-sm pill" onclick="app.handleGoogleAuth(\'connect\')">Connect Google</button>';
            }
        }
    },

    openManageAccounts() {
        this.hideAllViews();
        const list = this.el('account-list');
        if (list) {
            list.innerHTML = '';
            this.state.savedAccounts.forEach(email => {
                const div = document.createElement('div');
                div.className = `choice-card mb-2 flex-between`;
                div.innerHTML = `
                    <div class="flex-center-row gap-3 cursor-pointer" onclick="app.switchAccountTo('${email}')" style="flex:1">
                        <div class="avatar" style="width:32px; height:32px; font-size:0.8rem;">${email.charAt(0).toUpperCase()}</div>
                        <div>
                            <h4 class="font-medium text-sm">${email}</h4>
                            ${this.state.currentUser && this.state.currentUser.email === email ? '<p class="text-xs text-success">Current</p>' : ''}
                        </div>
                    </div>
                `;
                list.appendChild(div);
            });
        }
        this.el('switch-account-modal').classList.remove('hidden');
    },

    closeManageAccounts() { 
        this.el('switch-account-modal').classList.add('hidden');
    },

    async logoutCurrent() {
        this.el('logout-confirm-modal').classList.remove('hidden');
    },
    
    closeLogoutConfirm() {
        this.el('logout-confirm-modal').classList.add('hidden');
    },

    async processLogout() {
        this.closeLogoutConfirm();
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
        this.state.currentUser = null;
        this.state.savedAccounts = [];
        this.saveData();
        this.nav('landing-screen');
    },

    renderMailbox(type) {
        const container = this.el(`${type}-list`);
        const emptyState = this.el('view-empty');
        if (!container) return;
        
        container.innerHTML = '';
        container.parentElement.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
    },

    openCompose() {
        this.el('compose-modal').classList.remove('hidden');
    },
    closeCompose() {
        this.el('compose-modal').classList.add('hidden');
    }
};

window.app = app;

document.addEventListener("DOMContentLoaded", () => {
    app.init();
});
