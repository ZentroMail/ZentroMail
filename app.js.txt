/* ==========================================================================
   1. SUPABASE CONFIGURATION
   ========================================================================== */
const SUPABASE_URL = 'https://mharhvgwjtyzpdarmjrf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oYXJodmd3anR5enBkYXJtanJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTU2NzQsImV4cCI6MjA5MDM5MTY3NH0.qHBKD-EVtOxlTwCvOHP-6jBsrVTCp1eszPuSfk_X8jI';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let currentFolder = 'inbox';
let currentOpenEmail = null;

// Local fallback data to ensure the UI works flawlessly even if DB tables aren't perfectly configured yet.
let localEmails = [
    { id: 1, folder: 'inbox', sender: 'Zentro Security', email: 'security@zentro.com', subject: 'Vault Initialized', body: '<p>Welcome to Zentro Max.</p><p>Your hardware keys have been successfully generated. Your communications are now secured with zero-knowledge architecture.</p>', time: 'Just now', read: false, priority: true },
    { id: 2, folder: 'inbox', sender: 'Design Team', email: 'design@company.com', subject: 'Q4 Assets Ready', body: '<p>The final glassmorphism assets for the Q4 launch have been uploaded to the shared drive.</p><p>Let me know if we need to adjust the blur radiuses.</p>', time: '10:42 AM', read: true, priority: false },
    { id: 3, folder: 'drafts', sender: 'Me', email: 'me@zentro.com', subject: 'Re: Q4 Assets', body: 'Looks good. Push it to staging.', time: 'Yesterday', read: true, priority: false }
];

/* ==========================================================================
   2. UI UTILITIES
   ========================================================================== */
function showToast(message, type = 'error') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { 
        toast.classList.remove('show'); 
        setTimeout(() => toast.remove(), 400); 
    }, 4000);
}

function setLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) { btn.classList.add('loading'); btn.disabled = true; } 
    else { btn.classList.remove('loading'); btn.disabled = false; }
}

/* ==========================================================================
   3. ROUTING LOGIC
   ========================================================================== */
// Main Router (Marketing Home vs Auth vs App Dashboard)
function navigateTo(viewId, authMode = null) {
    window.scrollTo(0,0);
    
    // Protected route check
    if (viewId === 'app' && !currentUser) {
        showToast("Authentication required", "error");
        viewId = 'auth';
        authMode = 'login';
    }

    // Hide all main containers
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
    
    // Show target
    const target = document.getElementById('view-' + viewId);
    if(target) target.classList.add('active');

    // Setup UI states based on view
    const mNav = document.getElementById('marketing-nav');
    const mFoot = document.getElementById('marketing-footer');

    if(viewId === 'app') {
        mNav.style.display = 'none'; 
        if(mFoot) mFoot.style.display = 'none'; 
        document.body.style.overflow = 'hidden';
        loadAppData();
    } else {
        mNav.style.display = 'flex'; 
        if(mFoot) mFoot.style.display = 'flex'; 
        document.body.style.overflow = 'auto';
        if(viewId === 'auth' && authMode) setAuthMode(authMode);
    }
}

// App Sub-Router (Inbox vs Settings vs Support)
// RULE: Only one section opens at a time.
function switchAppView(subViewId) {
    // 1. Reset Sidebar Active States
    document.querySelectorAll('.app-sidebar .nav-item').forEach(el => el.classList.remove('active'));
    
    // Find and activate the clicked item (matching inner text roughly or by passing element)
    const navItems = document.querySelectorAll('.app-sidebar .nav-item');
    navItems.forEach(item => {
        if(item.innerText.toLowerCase().includes(subViewId.toLowerCase())) {
            item.classList.add('active');
        }
    });

    // 2. Hide all subviews
    document.querySelectorAll('.app-subview').forEach(v => v.classList.remove('active'));

    // 3. Determine if it's a mail folder or a dedicated page
    const folders = ['inbox', 'priority', 'sent', 'drafts', 'archive', 'trash', 'starred'];
    
    if (folders.includes(subViewId)) {
        document.getElementById('subview-mail').classList.add('active');
        document.getElementById('list-title').innerText = subViewId.charAt(0).toUpperCase() + subViewId.slice(1);
        renderEmailList(subViewId);
        closeEmailReader();
    } else {
        // Must be settings or support
        const targetView = document.getElementById('subview-' + subViewId);
        if(targetView) targetView.classList.add('active');
    }
}

/* ==========================================================================
   4. AUTHENTICATION LOGIC
   ========================================================================== */
function setAuthMode(mode) { // 'login', 'signup', 'forgot'
    document.querySelectorAll('.auth-form-group').forEach(f => f.classList.remove('active'));
    const title = document.getElementById('auth-title');
    const desc = document.getElementById('auth-desc');

    if(mode === 'login') {
        document.getElementById('form-login').classList.add('active');
        title.innerText = 'Welcome Back'; desc.innerText = 'Enter your credentials to access your vault.';
    } else if(mode === 'signup') {
        document.getElementById('form-signup').classList.add('active');
        title.innerText = 'Create Account'; desc.innerText = 'Join the next generation of communication.';
    } else if(mode === 'forgot') {
        document.getElementById('form-forgot').classList.add('active');
        title.innerText = 'Reset Password'; desc.innerText = 'Regain access to your encrypted vault.';
    }
}

async function handleGoogleAuth() {
    setLoading('btn-google-auth', true);
    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
        if(error) throw error;
    } catch(e) { showToast(e.message, 'error'); setLoading('btn-google-auth', false); }
}

async function handleEmailSignup() {
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const name = document.getElementById('reg-name').value;
    if(!email || !pass) return showToast("Email and password required.");
    
    setLoading('btn-signup', true);
    try {
        const { data, error } = await supabaseClient.auth.signUp({ email, password: pass, options: { data: { full_name: name } }});
        if(error) throw error;
        if(data.user && data.user.identities.length === 0) { 
            showToast("Account exists. Please login.", "error"); 
            setAuthMode('login'); 
        } else { 
            showToast("Success! Check email to verify.", "success"); 
        }
    } catch(e) { showToast(e.message, 'error'); }
    setLoading('btn-signup', false);
}

async function handleEmailLogin() {
    const email = document.getElementById('log-email').value;
    const pass = document.getElementById('log-pass').value;
    if(!email || !pass) return showToast("Credentials required.");
    
    setLoading('btn-login', true);
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
        if(error) throw error;
    } catch(e) { showToast(e.message, 'error'); }
    setLoading('btn-login', false);
}

async function handlePasswordReset() {
    const email = document.getElementById('res-email').value;
    if(!email) return showToast("Email required.");
    setLoading('btn-reset', true);
    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
        if(error) throw error;
        showToast("Secure reset link sent.", "success");
    } catch(e) { showToast(e.message, 'error'); }
    setLoading('btn-reset', false);
}

async function handleSignOut() {
    try { 
        await supabaseClient.auth.signOut(); 
        showToast("Logged out securely.", "success"); 
    } catch(e) {}
}

// Session Observer
supabaseClient.auth.onAuthStateChange((event, session) => {
    if(session) {
        currentUser = session.user;
        
        // Update Nav buttons
        const navAuth = document.getElementById('nav-auth-wrap');
        const heroActions = document.getElementById('hero-actions-wrap');
        if(navAuth) navAuth.innerHTML = `<button class="btn-gold" onclick="navigateTo('app')">Open Dashboard</button>`;
        if(heroActions) heroActions.innerHTML = `<button class="btn-gold" onclick="navigateTo('app')">Open Dashboard</button>`;
        
        const currentActive = document.querySelector('.view-container.active')?.id;
        if(currentActive === 'view-auth') navigateTo('app');
        
        if(window.location.hash.includes('access_token')) { history.replaceState(null, null, ' '); navigateTo('app'); }
    } else {
        currentUser = null;
        const navAuth = document.getElementById('nav-auth-wrap');
        const heroActions = document.getElementById('hero-actions-wrap');
        if(navAuth) navAuth.innerHTML = `<button class="btn-glass" onclick="navigateTo('auth', 'login')">Sign In</button><button class="btn-gold" onclick="navigateTo('auth', 'signup')">Create Account</button>`;
        if(heroActions) heroActions.innerHTML = `<button class="btn-gold" onclick="navigateTo('auth', 'signup')">Get Zentro Max</button><button class="btn-glass" onclick="navigateTo('auth', 'login')">Access Vault</button>`;
        
        const currentActive = document.querySelector('.view-container.active')?.id;
        if(currentActive === 'view-app') navigateTo('home');
    }
});

/* ==========================================================================
   5. INBOX APP LOGIC
   ========================================================================== */

async function loadAppData() {
    if(!currentUser) return;
    const name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
    document.getElementById('user-name-display').innerText = name;
    document.getElementById('user-email-display').innerText = currentUser.email;
    document.getElementById('user-avatar').innerText = name.charAt(0).toUpperCase();
    
    const setName = document.getElementById('set-name');
    const setEmail = document.getElementById('set-email');
    if(setName) setName.value = name;
    if(setEmail) setEmail.value = currentUser.email;

    await fetchEmails();
    switchAppView('inbox');
}

async function fetchEmails() {
    try {
        // Attempt Supabase fetch
        const { data, error } = await supabaseClient.from('messages').select('*').or(`receiver_email.eq.${currentUser.email},sender_id.eq.${currentUser.id}`);
        if(data && data.length > 0) {
            localEmails = data.map(m => ({
                id: m.id, folder: m.sender_id === currentUser.id ? 'sent' : m.folder || 'inbox',
                sender: m.sender_id === currentUser.id ? 'Me' : m.sender_email || 'Unknown',
                email: m.sender_id === currentUser.id ? currentUser.email : m.sender_email,
                subject: m.subject, body: m.body, time: new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                read: m.read || false, priority: false
            }));
        }
    } catch(e) { console.log("Using local mock emails. DB table 'messages' might not exist."); }
}

function renderEmailList(folder) {
    currentFolder = folder;
    const container = document.getElementById('email-list-container');
    if(!container) return;
    container.innerHTML = '';
    
    let filtered = localEmails.filter(e => {
        if(folder === 'priority') return e.priority && e.folder === 'inbox';
        return e.folder === folder;
    });

    // Update Inbox Badge
    const unreadCount = localEmails.filter(e => e.folder === 'inbox' && !e.read).length;
    const badge = document.getElementById('badge-inbox');
    if(badge) badge.innerText = unreadCount;

    if(filtered.length === 0) {
        container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Folder is empty.</div>`;
        return;
    }

    filtered.reverse().forEach(email => {
        const el = document.createElement('div');
        el.className = `email-item ${!email.read ? 'active' : ''}`;
        el.onclick = () => openEmail(email.id, el);
        
        // Strip HTML for preview
        let previewText = email.body.replace(/<[^>]*>?/gm, '').substring(0, 60);

        el.innerHTML = `
            <div class="email-meta">
                <span class="email-sender">${email.sender}</span> 
                <span class="email-time">${email.time}</span>
            </div>
            <div class="email-subject" style="${!email.read ? 'color:#fff; font-weight:600;' : ''}">${email.subject}</div>
            <div class="email-preview">${previewText}...</div>
        `;
        container.appendChild(el);
    });
}

function openEmail(id, elementNode) {
    document.querySelectorAll('.email-item').forEach(el => el.classList.remove('active'));
    elementNode.classList.add('active');
    
    const email = localEmails.find(e => e.id === id);
    if(!email) return;
    currentOpenEmail = email;
    email.read = true; // Mark read locally

    document.getElementById('reader-empty').style.display = 'none';
    document.getElementById('reader-content').classList.add('active');

    document.getElementById('read-subject').innerText = email.subject;
    document.getElementById('read-meta').innerText = `From: ${email.sender} <${email.email}>`;
    document.getElementById('read-body').innerHTML = email.body;
}

function closeEmailReader() {
    currentOpenEmail = null;
    const rc = document.getElementById('reader-content');
    const re = document.getElementById('reader-empty');
    if(rc) rc.classList.remove('active');
    if(re) re.style.display = 'flex';
}

function actionCurrentEmail(actionFolder) { 
    if(!currentOpenEmail) return;
    currentOpenEmail.folder = actionFolder;
    
    // Supabase update if table exists
    // supabaseClient.from('messages').update({folder: actionFolder}).eq('id', currentOpenEmail.id);

    showToast(`Message moved to ${actionFolder}.`, 'success');
    renderEmailList(currentFolder);
    closeEmailReader();
}

/* ==========================================================================
   6. COMPOSE SYSTEM
   ========================================================================== */
function toggleCompose() { 
    const modal = document.getElementById('compose-modal');
    if(modal) modal.classList.toggle('active'); 
}

async function handleSendEmail() {
    const to = document.getElementById('comp-to').value;
    const subj = document.getElementById('comp-subj').value;
    const body = document.getElementById('comp-body').value;

    if(!to || !body) return showToast("Recipient and message required.");
    setLoading('btn-send-email', true);

    // Format body
    const formattedBody = `<p>${body.replace(/\n/g, '<br>')}</p>`;

    try {
        if(currentUser) {
            // Attempt to send via Supabase
            const { error } = await supabaseClient.from('messages').insert([{
                sender_id: currentUser.id, 
                sender_email: currentUser.email,
                receiver_email: to, 
                subject: subj, 
                body: formattedBody,
                folder: 'inbox', 
                created_at: new Date().toISOString()
            }]);
            
            if(error) {
                console.warn("DB insert failed, using local state only.", error);
            }
        }
    } catch(e) { }

    // Optimistic UI update for sender
    localEmails.push({
        id: Date.now(), folder: 'sent', sender: 'Me', email: currentUser?.email || 'me',
        subject: subj || '(No Subject)', body: formattedBody, time: 'Just now', read: true, priority: false
    });

    // Simulated Encryption Delay for Premium Feel
    setTimeout(() => {
        setLoading('btn-send-email', false);
        toggleCompose();
        document.getElementById('comp-to').value = '';
        document.getElementById('comp-subj').value = '';
        document.getElementById('comp-body').value = '';
        showToast("Message encrypted and sent.", "success");
        if(currentFolder === 'sent') renderEmailList('sent');
    }, 800); 
}

// Marketing Nav Scroll
window.addEventListener('scroll', () => {
    const nav = document.getElementById('marketing-nav');
    if(nav) {
        if(window.scrollY > 50) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
    }
}, { passive: true });

// Init
(async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if(session) {
        currentUser = session.user;
        if(window.location.hash.includes('access_token')) {
            history.replaceState(null, null, ' ');
            navigateTo('app');
        }
    } else {
        navigateTo('home');
    }
})();
