// ==========================================
// 1. SUPABASE INITIALIZATION (Auth & Database)
// ==========================================
const SUPABASE_URL = "https://mharhvgwjtyzpdarmjrf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oYXJodmd3anR5enBkYXJtanJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTU2NzQsImV4cCI6MjA5MDM5MTY3NH0.qHBKD-EVtOxlTwCvOHP-6jBsrVTCp1eszPuSfk_X8jI";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. MAIN APP LOGIC
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
        activeMessage: null,
        currentMessageFolder: null,
        currentMessageId: null,
        currentDraftId: null,
        autoSaveTimer: null,
        activeTab: 'inbox',
        isSending: false
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
        this.setupClickOutside();
        this.setupScrollObserver();

        this.checkOAuthRedirect();
        this.runCinematicIntro();
    },

    // ==========================================
    // UNIFIED DASHBOARD NAVIGATION (CRITICAL FIX)
    // ==========================================
    showView(viewId) {
        if (viewId === 'view-compose') {
            this.openCompose();
            return;
        }

        // 1. Hide ALL dashboard views safely
        document.querySelectorAll('.dashboard-view').forEach(v => {
            v.classList.add('hidden');
        });

        // 2. Locate and show target view
        const target = document.getElementById(viewId);
        if (target) {
            target.classList.remove('hidden');
        } else {
            console.error(`CRITICAL: View ${viewId} does not exist in HTML.`);
            return; // Stop execution to prevent black screen
        }

        // 3. Keep internal tab state synced
        const tabName = viewId.replace('view-', '');
        this.state.activeTab = tabName;

        // 4. Update Header Title Dynamically
        const titleMap = { 
            inbox: 'Inbox', starred: 'Starred', sent: 'Sent', drafts: 'Drafts', archive: 'Archive', 
            trash: 'Trash', settings: 'Account Settings', support: 'Contact Support', '2fa-request': 'Security Request',
            '2fa-success': 'Request Submitted'
        };
        const viewTitle = this.el('view-title');
        if (viewTitle && titleMap[tabName]) {
            viewTitle.innerText = titleMap[tabName];
        }

        // 5. Trigger view-specific data rendering
        if (['inbox', 'sent', 'trash', 'drafts', 'archive', 'starred'].includes(tabName)) {
            this.renderMailbox(tabName);
        } else if (tabName === 'settings') {
            this.renderSettings(); 
        } else if (tabName === '2fa-request') {
            const emailEl = this.el('req-email');
            const dateEl = this.el('req-date');
            if (emailEl && this.state.currentUser) emailEl.value = this.state.currentUser.email;
            if (dateEl) dateEl.value = new Date().toLocaleDateString();
        }

        // 6. Update Sidebar Active State
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(viewId)) {
                btn.classList.add('active');
            }
        });
    },

    // ==========================================
    // PAGE NAVIGATION (Landing, Auth, Footer)
    // ==========================================
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
        if (!target) {
            console.error(`Page ${pageId} does not exist.`);
            return;
        }

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

    // ==========================================
    // GOOGLE OAUTH LOGIC
    // ==========================================
    async handleGoogleAuth(intent) {
        if (!supabaseClient) {
            this.showToast("Database connection offline.");
            return;
        }

        localStorage.setItem("auth_mode", intent);
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });

        if (error) {
            this.showToast(error.message);
            localStorage.removeItem("auth_mode");
        }
    },

    async checkOAuthRedirect() {
        if (!supabaseClient) return;

        const failsafeTimer = setTimeout(() => {
            this.hideLoader();
        }, 3000);

        try {
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

            if (sessionError || !session) {
                clearTimeout(failsafeTimer);
                this.hideLoader();
                return;
            }

            if (window.location.hash || window.location.search) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            const user = session.user;
            const mode = localStorage.getItem("auth_mode");

            this.showLoader("Verifying secure connection...");
            
            const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();

            if (!mode) {
                clearTimeout(failsafeTimer);
                if (profile) this.finalizeLogin(user);
                this.hideLoader();
                return;
            }

            if (mode === "login") {
                if (!profile) {
                    this.showToast("This account is not registered.");
                    await supabaseClient.auth.signOut();
                    localStorage.removeItem("auth_mode");
                    clearTimeout(failsafeTimer);
                    this.hideLoader();
                    this.navToAuth('signin');
                    return;
                }
                
                localStorage.removeItem("auth_mode");
                clearTimeout(failsafeTimer);
                this.finalizeLogin(user);
                
            } else if (mode === "signup") {
                if (profile) {
                    this.showToast("This account is already registered.");
                    await supabaseClient.auth.signOut();
                    localStorage.removeItem("auth_mode");
                    clearTimeout(failsafeTimer);
                    this.hideLoader();
                    this.navToAuth('signup');
                    return;
                }

                await supabaseClient.from('profiles').insert([{ id: user.id, email: user.email, provider: 'google' }]);
                localStorage.removeItem("auth_mode");
                this.state.currentUser = { id: user.id, email: user.email, inbox: [], sent: [], drafts: [], trash: [], archive: [], starred: [] };
                clearTimeout(failsafeTimer);
                this.hideLoader();
                this.hideAllViews();
                this.nav('google-welcome-screen');
                
            } else if (mode === "connect") {
                if (!profile) {
                    await supabaseClient.from('profiles').insert([{ id: user.id, email: user.email, provider: 'google' }]);
                } else {
                    await supabaseClient.from('profiles').update({ provider: 'google' }).eq('id', user.id);
                }
                localStorage.removeItem("auth_mode");
                clearTimeout(failsafeTimer);
                this.finalizeLogin(user);
                this.showView('view-settings');
                this.showToast("Google account connected.");
            }
        } catch (err) {
            console.error("Error during redirect check:", err);
            clearTimeout(failsafeTimer);
            this.hideLoader();
        }
    },

    finalizeGoogleSignup() {
        if (this.state.currentUser) {
            if (!this.state.savedAccounts.includes(this.state.currentUser.email)) {
                if (this.state.savedAccounts.length >= 2) {
                    this.showToast("Maximum of 2 accounts allowed per device.");
                    this.state.currentUser = null;
                    this.nav('landing-screen');
                    return;
                }
                this.state.savedAccounts.push(this.state.currentUser.email);
                this.saveData();
            }
            this.initDashboard();
        } else {
            this.nav('landing-screen');
        }
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

    navToAuth(mode) {
        if (mode === 'signin') {
            this.state.isLoginMode = true;
        } else {
            this.state.isLoginMode = false;
        }
        this.updateAuthUI();
        const form = this.el('auth-form');
        if (form) form.reset();
        ['auth-error', 'auth-pass-checklist'].forEach(id => {
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
        ['auth-error', 'auth-pass-checklist'].forEach(id => {
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
            if(passInput) passInput.oninput = (e) => app.validatePasswordStrength(e.target.value, 'auth');
            if(googleLoginBtn) googleLoginBtn.classList.add('hidden');
            if(googleSignupBtn) googleSignupBtn.classList.remove('hidden');
        }
    },

    // ==========================================
    // AUTHENTICATION FIX (SECURITY PATCH)
    // ==========================================
    async handleAuth(e) {
        e.preventDefault();
        const emailEl = this.el('auth-email');
        const passEl = this.el('auth-password');
        const errEl = this.el('auth-error');
        
        if (!emailEl || !passEl) return;

        const email = emailEl.value.trim().toLowerCase();
        const password = passEl.value;
        
        if (errEl) errEl.classList.add('hidden');
        if (!supabaseClient) {
            if (errEl) { errEl.innerText = "Database connection offline."; errEl.classList.remove('hidden'); }
            return;
        }

        this.showLoader(this.state.isLoginMode ? "Authenticating..." : "Creating Account...");

        // CRITICAL: Check if profile exists before deciding logic
        const { data: existingProfile, error: profileErr } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (!this.state.isLoginMode) {
            // --- SIGNUP FLOW ---
            if (existingProfile) {
                this.hideLoader();
                if (errEl) { errEl.innerText = "An account with this email already exists. Please sign in."; errEl.classList.remove('hidden'); }
                return;
            }

            if (!email.endsWith('@zentro.mail')) {
                this.hideLoader();
                if (errEl) { errEl.innerText = "Email must end with @zentro.mail"; errEl.classList.remove('hidden'); }
                return;
            }
            if (!this.validatePasswordStrength(password, 'auth')) {
                this.hideLoader();
                if (errEl) { errEl.innerText = "Password must meet all security requirements."; errEl.classList.remove('hidden'); }
                return;
            }

            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password
            });

            if (error) {
                this.hideLoader();
                console.error(error);
                if (errEl) { errEl.innerText = error.message; errEl.classList.remove('hidden'); }
                return;
            }

            if (data && data.user) {
                await supabaseClient.from('profiles').insert([{
                    id: data.user.id,
                    email: email,
                    provider: 'email'
                }]);
            }
            this.finalizeLogin(data.user);

        } else {
            // --- LOGIN FLOW ---
            if (!existingProfile) {
                this.hideLoader();
                if (errEl) { errEl.innerText = "Account not found. Please create an account first."; errEl.classList.remove('hidden'); }
                return;
            }

            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) {
                this.hideLoader();
                console.error(error);
                if (errEl) { errEl.innerText = error.message; errEl.classList.remove('hidden'); }
                return;
            }
            this.finalizeLogin(data.user);
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
            otherGroup.classList.remove('hidden');
            otherGroup.classList.add('active');
            otherInput.setAttribute('required', 'true');
            setTimeout(() => otherInput.focus(), 350); 
        } else {
            otherGroup.classList.add('hidden');
            otherGroup.classList.remove('active');
            otherInput.removeAttribute('required');
            otherInput.value = ''; 
        }
    },

    // ==========================================
    // SUPPORT FORM FIX (DATABASE MAPPING)
    // ==========================================
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

        const selectedType = typeEl.value === 'other' && otherEl ? `Other: ${otherEl.value.trim()}` : typeEl.value;
        const message = descEl.value.trim();
        const subject = `Public Ticket: ${selectedType}`;

        this.showLoader("Encrypting & Sending...");
        
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from("support_tickets").insert([
                    {
                        subject: subject,
                        body: message,
                        type: selectedType
                    }
                ]);

                if (error) {
                    console.error(error);
                    throw error;
                }

                this.hideLoader();
                localStorage.setItem("supportSubmitted", "true");
                
                const formBox = document.getElementById("public-form-box");
                const successBox = document.getElementById("public-success-box");
                if (formBox) formBox.classList.add('hidden');
                if (successBox) successBox.classList.remove('hidden');

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
        if (!msgEl.value.trim()) {
            this.showToast("Please provide a description.");
            return;
        }

        const selectedType = typeEl.value === 'other' && otherEl ? `Other: ${otherEl.value.trim()}` : typeEl.value;
        const message = msgEl.value.trim();
        const subject = `Support Ticket: ${selectedType}`;

        this.showLoader("Encrypting & Sending...");
        
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from("support_tickets").insert([
                    {
                        subject: subject,
                        body: message,
                        type: selectedType
                    }
                ]);

                if (error) {
                    console.error(error);
                    throw error;
                }

                this.hideLoader();
                localStorage.setItem("internalSupportSubmitted", "true");
                
                const formBox = document.getElementById("internal-form-box");
                const successBox = document.getElementById("internal-success-box");
                if (formBox) formBox.classList.add("hidden");
                if (successBox) successBox.classList.remove("hidden");

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

    setupClickOutside() {
        window.addEventListener('click', (e) => {
            const drop = document.getElementById('profile-dropdown');
            if (drop && !e.target.closest('.user-profile-wrapper') && !drop.classList.contains('hidden')) {
                drop.classList.add('hidden');
            }
        });
    },

    toggleProfile(e) {
        if (e) e.stopPropagation();
        const drop = this.el('profile-dropdown');
        if(drop) drop.classList.toggle('hidden');
    },

    // ==========================================
    // FULL MAILBOX LOGIC & REALTIME
    // ==========================================
    async initDashboard() {
        if (!this.state.currentUser) return;
        const pEmail = this.el('sidebar-email');
        const sAvatar = this.el('sidebar-avatar');
        if (pEmail) pEmail.innerText = this.state.currentUser.email;
        if (sAvatar) sAvatar.innerText = this.state.currentUser.email.charAt(0).toUpperCase();

        this.nav('dashboard-screen');
        this.showView('view-inbox');
        
        await this.fetchMessages();
        this.setupRealtime();
    },

    setupRealtime() {
        if (!supabaseClient) return;
        supabaseClient.channel('public:messages')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
                this.fetchMessages().then(() => {
                    if (['inbox', 'sent', 'trash', 'drafts', 'archive', 'starred'].includes(this.state.activeTab)) {
                        this.renderMailbox(this.state.activeTab);
                    }
                });
            }).subscribe();
    },

    async fetchMessages() {
        if (!supabaseClient || !this.state.currentUser) return;
        const email = this.state.currentUser.email;

        try {
            const { data, error } = await supabaseClient
                .from('messages')
                .select('*')
                .or(`sender.eq.${email},receiver.eq.${email}`)
                .order('created_at', { ascending: false });
            if (error) throw error;

            this.state.currentUser.inbox = [];
            this.state.currentUser.sent = [];
            this.state.currentUser.drafts = [];
            this.state.currentUser.archive = [];
            this.state.currentUser.trash = [];
            this.state.currentUser.starred = [];
            
            data.forEach(msg => {
                const isSender = msg.sender === email;
                const isReceiver = msg.receiver === email;

                if (isSender) {
                    if (msg.folder_sender === 'drafts') this.state.currentUser.drafts.push(msg);
                    if (msg.folder_sender === 'sent') this.state.currentUser.sent.push(msg);
                    if (msg.folder_sender === 'archive') this.state.currentUser.archive.push(msg);
                    if (msg.folder_sender === 'trash') this.state.currentUser.trash.push(msg);
                    if (msg.starred_sender && msg.folder_sender !== 'trash') this.state.currentUser.starred.push(msg);
                }
                
                if (isReceiver) {
                    if (msg.folder_receiver === 'inbox') this.state.currentUser.inbox.push(msg);
                    if (msg.folder_receiver === 'archive') this.state.currentUser.archive.push(msg);
                    if (msg.folder_receiver === 'trash') this.state.currentUser.trash.push(msg);
                    if (msg.starred_receiver && msg.folder_receiver !== 'trash') this.state.currentUser.starred.push(msg);
                }
            });
            if (['inbox', 'sent', 'drafts', 'archive', 'trash', 'starred'].includes(this.state.activeTab)) {
                this.renderMailbox(this.state.activeTab);
            }
        } catch (err) {
            console.error("Error fetching messages:", err);
        }
    },

    renderMailbox(type) {
        const container = this.el(`${type}-list`);
        const emptyState = this.el('view-empty');
        if (!container || !this.state.currentUser) return;
        
        container.innerHTML = '';
        const messages = this.state.currentUser[type] || [];
        if (messages.length === 0) {
            container.parentElement.classList.add('hidden');
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');
        container.parentElement.classList.remove('hidden');
        
        messages.forEach(msg => {
            const isSender = msg.sender === this.state.currentUser.email;
            const isUnread = !isSender && !msg.is_read && type !== 'sent' && type !== 'drafts';
            const displayEmail = isSender ? (msg.receiver || '(No recipient)') : msg.sender;
            const timeStr = new Date(msg.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            
            const div = document.createElement('div');
            div.className = `mail-item flex-between ${isUnread ? 'unread' : ''}`;
            div.onclick = () => this.openReadView(msg);
            
            div.innerHTML = `
                <div class="flex-center-row gap-4" style="flex:1; overflow:hidden;">
                    <div class="avatar" style="width:36px; height:36px;">${displayEmail.charAt(0).toUpperCase()}</div>
                    <div style="flex:1; overflow:hidden; display:flex; align-items:center; gap: 12px;">
                        <span class="mail-sender text-sm" style="min-width: 150px;">${displayEmail}</span>
                        ${type === 'drafts' ? '<span class="draft-badge">Draft</span>' : ''}
                        <span class="mail-subject text-sm">${msg.subject || '(No subject)'}</span>
                        <span class="mail-preview text-sm">- ${msg.body || ''}</span>
                    </div>
                </div>
                <div class="mail-time">${timeStr}</div>
            `;
            container.appendChild(div);
        });
    },

    async openReadView(msg) {
        if (msg.folder_sender === 'drafts' && msg.sender === this.state.currentUser.email) {
            this.openCompose(msg);
            return;
        }

        this.state.activeMessage = msg;
        this.showView('view-read');

        this.el('read-subject').innerText = msg.subject || '(No subject)';
        this.el('read-sender').innerText = `From: ${msg.sender} | To: ${msg.receiver || 'Unknown'}`;
        this.el('read-date').innerText = new Date(msg.created_at).toLocaleString();
        this.el('read-content').innerText = msg.body;
        
        const isSender = msg.sender === this.state.currentUser.email;
        const isStarred = isSender ? msg.starred_sender : msg.starred_receiver;
        const starBtn = this.el('read-star-btn');
        if (starBtn) {
            isStarred ? starBtn.classList.add('active') : starBtn.classList.remove('active');
        }

        const btnArchive = this.el('btn-read-archive');
        const btnUnarchive = this.el('btn-read-unarchive');
        if (btnArchive && btnUnarchive) {
            if (this.state.activeTab === 'archive') {
                btnArchive.classList.add('hidden');
                btnUnarchive.classList.remove('hidden');
            } else {
                btnArchive.classList.remove('hidden');
                btnUnarchive.classList.add('hidden');
            }
        }

        if (!isSender && !msg.is_read) {
            await supabaseClient.from('messages').update({ is_read: true }).eq('id', msg.id);
            msg.is_read = true;
        }
    },

    closeReadView() {
        this.state.activeMessage = null;
        this.showView('view-' + this.state.activeTab);
    },

    async toggleReadStar() {
        if (!this.state.activeMessage || !supabaseClient) return;
        const msg = this.state.activeMessage;
        const isSender = msg.sender === this.state.currentUser.email;
        const currentStar = isSender ? msg.starred_sender : msg.starred_receiver;
        const updatePayload = isSender ? { starred_sender: !currentStar } : { starred_receiver: !currentStar };
        const starBtn = this.el('read-star-btn');
        
        if (starBtn) starBtn.classList.toggle('active');

        await supabaseClient.from('messages').update(updatePayload).eq('id', msg.id);
    },

    async archiveCurrent() {
        if (!this.state.activeMessage) return;
        await this.moveMessage(this.state.activeMessage, 'archive');
        this.showToast("Message archived.");
        this.closeReadView();
    },

    async unarchiveCurrent() {
        if (!this.state.activeMessage) return;
        await this.moveMessage(this.state.activeMessage, 'inbox');
        this.showToast("Message unarchived.");
        this.closeReadView();
    },

    async trashCurrent() {
        if (!this.state.activeMessage) return;
        await this.moveMessage(this.state.activeMessage, 'trash');
        this.showToast("Message moved to trash.");
        this.closeReadView();
    },

    async moveMessage(msg, targetFolder) {
        if (!supabaseClient) return;
        const isSender = msg.sender === this.state.currentUser.email;
        const updatePayload = isSender 
            ? { folder_sender: targetFolder } 
            : { folder_receiver: targetFolder };
        await supabaseClient.from('messages').update(updatePayload).eq('id', msg.id);
    },

    replyToCurrent() {
        if (!this.state.activeMessage) return;
        const replyTo = this.state.activeMessage.sender === this.state.currentUser.email 
            ? this.state.activeMessage.receiver 
            : this.state.activeMessage.sender;
        const subject = this.state.activeMessage.subject.startsWith('Re:') 
            ? this.state.activeMessage.subject 
            : `Re: ${this.state.activeMessage.subject}`;
        this.openCompose({ receiver: replyTo, subject: subject, body: `\n\n--- Original Message ---\n${this.state.activeMessage.body}` });
    },

    openCompose(existingMsg = null) {
        const modal = this.el('compose-modal');
        if (!modal) return;
        
        const toEl = this.el('compose-to');
        const subEl = this.el('compose-subject');
        const bodyEl = this.el('compose-body');
        
        if (existingMsg && existingMsg.id) {
            this.state.currentDraftId = existingMsg.id;
            toEl.value = existingMsg.receiver || '';
            subEl.value = existingMsg.subject || '';
            bodyEl.value = existingMsg.body || '';
        } else if (existingMsg) {
            this.state.currentDraftId = null;
            toEl.value = existingMsg.receiver || '';
            subEl.value = existingMsg.subject || '';
            bodyEl.value = existingMsg.body || '';
        } else {
            this.state.currentDraftId = null;
            toEl.value = ''; subEl.value = ''; bodyEl.value = '';
        }
        
        this.el('draft-status').innerText = '';
        modal.classList.remove('hidden');
    },
    
    closeCompose() {
        this.el('compose-modal').classList.add('hidden');
        if (this.state.autoSaveTimer) clearTimeout(this.state.autoSaveTimer);
    },

    autoSaveDraft() {
        if (this.state.autoSaveTimer) clearTimeout(this.state.autoSaveTimer);
        this.el('draft-status').innerText = 'Saving...';
        
        this.state.autoSaveTimer = setTimeout(async () => {
            if (!supabaseClient || !this.state.currentUser) return;
            
            const to = this.el('compose-to').value.trim();
            const subject = this.el('compose-subject').value.trim();
            const body = this.el('compose-body').value.trim();
            
            if (!to && !subject && !body) {
                this.el('draft-status').innerText = '';
                return;
            }

            const payload = {
                sender: this.state.currentUser.email,
                receiver: to,
                subject: subject,
                body: body,
                folder_sender: 'drafts',
                folder_receiver: 'trash'
            };

            if (this.state.currentDraftId) {
                await supabaseClient.from('messages').update(payload).eq('id', this.state.currentDraftId);
            } else {
                const { data } = await supabaseClient.from('messages').insert([payload]).select().single();
                if (data) this.state.currentDraftId = data.id;
            }
            
            this.el('draft-status').innerText = 'Draft saved';
            setTimeout(() => { if(this.el('draft-status').innerText === 'Draft saved') this.el('draft-status').innerText = ''; }, 3000);
        }, 1000);
    },

    async sendMessage() {
        if (!supabaseClient || !this.state.currentUser) return;
        const to = this.el('compose-to').value.trim().toLowerCase();
        const subject = this.el('compose-subject').value.trim();
        const body = this.el('compose-body').value.trim();
        const errEl = this.el('compose-error');
        
        if (!to) {
            errEl.innerText = "Please specify a recipient.";
            errEl.classList.remove('hidden');
            return;
        }

        this.showLoader("Verifying recipient...");
        const { data: userExists, error: userError } = await supabaseClient
            .from('profiles')
            .select('email')
            .eq('email', to)
            .single();
            
        if (!userExists || userError) {
            this.hideLoader();
            errEl.innerText = "User does not exist in the Zentro network.";
            errEl.classList.remove('hidden');
            return;
        }

        errEl.classList.add('hidden');
        this.showLoader("Encrypting & Sending...");
        
        if (this.state.autoSaveTimer) clearTimeout(this.state.autoSaveTimer);
        const payload = {
            sender: this.state.currentUser.email,
            receiver: to,
            subject: subject,
            body: body,
            folder_sender: 'sent',
            folder_receiver: 'inbox',
            is_read: false
        };

        try {
            if (this.state.currentDraftId) {
                await supabaseClient.from('messages').update(payload).eq('id', this.state.currentDraftId);
            } else {
                await supabaseClient.from('messages').insert([payload]);
            }
            
            this.hideLoader();
            this.closeCompose();
            this.showToast("Message sent securely.");
            this.fetchMessages(); 
            
        } catch (err) {
            console.error(err);
            this.hideLoader();
            errEl.innerText = "Failed to send message. Please try again.";
            errEl.classList.remove('hidden');
        }
    },
    
    async onToInput(val) {
        const suggestionBox = this.el('email-suggestions');
        
        if (!val || val.length < 2) {
            if (suggestionBox) suggestionBox.classList.add('hidden');
            return;
        }
        
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('email')
                .ilike('email', `%${val}%`)
                .limit(5);

            if (error || !data || data.length === 0) {
                suggestionBox.classList.add('hidden');
                return;
            }

            suggestionBox.innerHTML = '';
            
            data.forEach(user => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerText = user.email;
                
                div.onclick = () => {
                    this.el('compose-to').value = user.email;
                    suggestionBox.classList.add('hidden');
                    this.autoSaveDraft();
                };
                
                suggestionBox.appendChild(div);
            });
            
            suggestionBox.classList.remove('hidden');
            
        } catch (err) {
            console.error("Autocomplete error:", err);
        }
    },

    async renderSettings() {
        if (!this.state.currentUser) return;
        const u = this.state.currentUser;

        const { data: latestProfile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', u.id)
            .single();

        const emailDisp = this.el('set-email');
        const phoneDisp = this.el('set-phone');
        const recoveryDisp = this.el('set-recovery');
        const providerDisp = this.el('set-provider');
        const providerAction = this.el('set-provider-action');
        
        if(emailDisp) emailDisp.innerText = u.email;
        if(phoneDisp && latestProfile) phoneDisp.innerText = latestProfile.phone ? this.maskPhone(latestProfile.phone) : 'Not provided';
        if(recoveryDisp && latestProfile) recoveryDisp.innerText = latestProfile.recovery_email ? latestProfile.recovery_email : 'Not provided';
        
        if(providerDisp && supabaseClient) {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const isGoogle = session?.user?.app_metadata?.provider === 'google' || session?.user?.app_metadata?.providers?.includes('google');
            
            if (isGoogle) {
                providerDisp.innerHTML = 'Google: Connected';
                if(providerAction) providerAction.innerHTML = '<span class="text-success">✅</span>';
            } else {
                providerDisp.innerHTML = 'Google: Not Connected';
                if(providerAction) providerAction.innerHTML = '<button class="btn btn-secondary btn-sm pill" onclick="app.handleGoogleAuth(\'connect\')">Connect Google</button>';
            }
        }
    },

    async openAddPhoneModal() {
        const newPhone = window.prompt("Enter new phone number (e.g., +971501234567):");
        if (!newPhone) return;

        this.showLoader("Updating phone...");
        const { error } = await supabaseClient
            .from('profiles')
            .update({ phone: newPhone })
            .eq('id', this.state.currentUser.id);
            
        this.hideLoader();
        
        if (error) {
            this.showToast("Failed to update phone.");
        } else {
            this.showToast("Phone updated securely.");
            this.state.currentUser.phone = newPhone;
            this.renderSettings(); 
        }
    },

    async initiateRecoveryEmailChange(action) {
        if (action === 'remove') {
            this.showLoader("Removing recovery email...");
            const { error } = await supabaseClient
                .from('profiles')
                .update({ recovery_email: null })
                .eq('id', this.state.currentUser.id);
                
            this.hideLoader();
            if (error) {
                this.showToast("Failed to remove recovery email.");
            } else {
                this.showToast("Recovery email removed.");
                this.renderSettings();
            }
        } else {
            const newEmail = window.prompt("Enter new recovery email:");
            if (!newEmail || !newEmail.includes('@')) return;
            
            this.showLoader("Updating recovery email...");
            const { error } = await supabaseClient
                .from('profiles')
                .update({ recovery_email: newEmail })
                .eq('id', this.state.currentUser.id);
                
            this.hideLoader();
            if (error) {
                this.showToast("Failed to update recovery email.");
            } else {
                this.showToast("Recovery email updated securely.");
                this.renderSettings();
            }
        }
    },

    async openChangePasswordModal() {
        const newPass = window.prompt("Enter new encryption key (password). Minimum 8 characters:");
        if (!newPass || newPass.length < 8) {
            this.showToast("Password must be at least 8 characters.");
            return;
        }
        
        this.showLoader("Updating encryption key...");
        const { error } = await supabaseClient.auth.updateUser({ 
            password: newPass 
        });
        
        this.hideLoader();
        if (error) {
            this.showToast("Failed to update: " + error.message);
        } else {
            this.showToast("Password updated successfully.");
        }
    },

    async submit2FARequest(e) {
        if (e) e.preventDefault();

        const email = document.getElementById("req-email").value;

        if (!email) {
            this.showToast("Please enter your email.");
            return;
        }

        this.showLoader("Sending request...");

        try {
            const { error } = await supabaseClient
                .from("2fa_requests")
                .insert([
                    {
                        user_email: email,
                        request_date: new Date().toISOString(),
                        status: "Pending"
                    }
                ]);

            if (error) throw error;

            this.hideLoader();
            this.showView('view-2fa-success');

        } catch (err) {
            console.error(err);
            this.hideLoader();
            this.showToast("Failed to send request.");
        }
    },

    openManageAccounts() {
        this.hideAllViews(); // Hides dropdowns safely
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
                            ${this.state.currentUser && this.state.currentUser.email === email ? 
                            '<p class="text-xs text-success">Current</p>' : ''}
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

    switchAccountTo(email) {
        if (this.state.currentUser && this.state.currentUser.email === email) {
            this.closeManageAccounts();
            return;
        }
        this.showLoader("Switching account...");
        setTimeout(() => {
            this.hideLoader();
            this.showToast(`Note: Sign in required to switch to ${email}`);
            this.processLogout();
        }, 1000);
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
    }
};

window.app = app;
document.addEventListener("DOMContentLoaded", () => {
    app.init();
});
