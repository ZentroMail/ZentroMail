    async checkOAuthRedirect() {
        console.log('OAuth redirect detected');
        
        if (!supabaseClient) {
            this.hideLoader();
            return false;
        }

        return new Promise((resolve) => {
            let resolved = false;
            let subscription = null;
            let timeoutId = null;

            const cleanup = () => {
                if (subscription) subscription.unsubscribe();
                if (timeoutId) clearTimeout(timeoutId);
            }; 

            const finalize = (value) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve(value);
            };

            // Set up auth state listener FIRST - catches SIGNED_IN after redirect
            subscription = supabaseClient.auth.onAuthStateChange(
                async (event, session) => {
                    console.log('Auth state changed:', event, session?.user?.email);

                    if (event === 'SIGNED_IN' && session?.user) {
                        console.log('SIGNED_IN triggered');
                        
                        try {
                            // Clear redirect hash/query
                            if (window.location.hash || window.location.search) {
                                window.history.replaceState({}, document.title, window.location.pathname);
                            }

                            const user = session.user;
                            const mode = localStorage.getItem("auth_mode");

                            this.showLoader("Verifying secure connection...");

                            // Fetch user profile
                            const { data: profile } = await supabaseClient
                                .from('profiles')
                                .select('*')
                                .eq('id', user.id)
                                .single();

                            // Handle LOGIN mode
                            if (mode === "login") {
                                if (!profile) {
                                    this.showToast("This account is not registered.");
                                    await supabaseClient.auth.signOut();
                                    localStorage.removeItem("auth_mode");
                                    this.hideLoader();
                                    this.navToAuth('signin');
                                    finalize(true);
                                    return;
                                }
                                
                                localStorage.removeItem("auth_mode");
                                console.log('finalizeLogin executed');
                                this.finalizeLogin(user);
                                finalize(true);
                            } 
                            // Handle SIGNUP mode
                            else if (mode === "signup") {
                                if (profile) {
                                    this.showToast("This account is already registered.");
                                    await supabaseClient.auth.signOut();
                                    localStorage.removeItem("auth_mode");
                                    this.hideLoader();
                                    this.navToAuth('signup');
                                    finalize(true);
                                    return;
                                }

                                await supabaseClient.from('profiles').insert([
                                    {
                                        id: user.id,
                                        email: user.email,
                                        provider: 'google'
                                    }
                                ]);

                                localStorage.removeItem("auth_mode");
                                this.state.currentUser = { 
                                    id: user.id, 
                                    email: user.email, 
                                    inbox: [], sent: [], drafts: [], trash: [], archive: [], starred: [] 
                                };
                                
                                this.hideLoader();
                                this.hideAllViews();
                                this.nav('google-welcome-screen');
                                finalize(true);
                            } 
                            // Handle CONNECT mode
                            else if (mode === "connect") {
                                if (!profile) {
                                    await supabaseClient.from('profiles').insert([{ 
                                        id: user.id, 
                                        email: user.email, 
                                        provider: 'google' 
                                    }]);
                                } else {
                                    await supabaseClient.from('profiles').update({ provider: 'google' }).eq('id', user.id);
                                }
                                localStorage.removeItem("auth_mode");
                                console.log('finalizeLogin executed');
                                this.finalizeLogin(user);
                                this.setTab('settings');
                                this.showToast("Google account connected.");
                                finalize(true);
                            }
                            // No mode = just refreshing dashboard
                            else if (!mode) {
                                if (profile) {
                                    console.log('finalizeLogin executed');
                                    this.finalizeLogin(user);
                                    finalize(true);
                                    return;
                                }
                                this.hideLoader();
                                finalize(false);
                            }

                        } catch (err) {
                            console.error("Error processing SIGNED_IN event:", err);
                            this.hideLoader();
                            finalize(false);
                        }
                    }
                }
            );

            // Check if session already exists (without redirect hash)
            setTimeout(async () => {
                if (resolved) return;

                try {
                    const { data: { session } } = await supabaseClient.auth.getSession();
                     
                    if (session?.user) {
                        // Session exists, let SIGNED_IN listener handle it
                        return;
                    }
                } catch (err) {
                    console.error("Session check error:", err);
                }
            }, 100);

            // Timeout: Prevent infinite loading
            timeoutId = setTimeout(() => {
                if (resolved) return;
                console.log('Timeout: No auth event received within 10 seconds');
                this.hideLoader();
                finalize(false);
            }, 10000);
        });
    }