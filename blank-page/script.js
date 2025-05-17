(() => {
    // Constants
    const STORAGE_KEYS = {
        CONTENT: 'blank-page-content',
        COUNT_MODE: 'blank-page-count-mode',
        SPELLCHECK: 'blank-page-spellcheck',
        DISPLAY_MODE: 'blank-page-display-mode',
        SCREEN_MODE: 'blank-page-screen-mode',
        INSTALL_PROMPT_DISMISSED: 'blank-page-install-prompt-dismissed'
    };
    
    const DISPLAY_MODES = {
        LIGHT: 'light',
        DARK: 'dark',
        AUTO: 'auto'
    };
    
    const SCREEN_MODES = {
        CENTERED: 'centered',
        FULLSCREEN: 'fullscreen'
    };
    
    const COUNT_MODES = {
        CHARACTERS: 'characters',
        WORDS: 'words'
    };
    
    // DOM Elements
    const elements = {
        page: document.getElementById('page'),
        status: document.getElementById('status'),
        countDisplay: document.getElementById('countDisplay'),
        spellcheckToggle: document.getElementById('spellcheckToggle'),
        displayModeToggle: document.getElementById('displayModeToggle'),
        screenModeToggle: document.getElementById('screenModeToggle'),
        installPrompt: document.getElementById('installPrompt'),
        installButton: document.getElementById('installButton'),
        closePromptButton: document.getElementById('closePrompt'),
        icons: {
            spellcheckOn: document.getElementById('spellcheckOnIcon'),
            spellcheckOff: document.getElementById('spellcheckOffIcon'),
            lightMode: document.getElementById('lightModeIcon'),
            darkMode: document.getElementById('darkModeIcon'),
            autoMode: document.getElementById('autoModeIcon'),
            centered: document.getElementById('centeredIcon'),
            fullscreen: document.getElementById('fullscreenIcon')
        }
    };
    
    // App State
    const state = {
        saveTimeout: null,
        countMode: COUNT_MODES.CHARACTERS,
        displayMode: DISPLAY_MODES.AUTO,
        screenMode: SCREEN_MODES.CENTERED,
        deferredPrompt: null
    };
    
    // UI Handlers
    const ui = {
        showStatus: (message) => {
            elements.status.textContent = message;
            elements.status.classList.add('visible');
            
            setTimeout(() => {
                elements.status.classList.remove('visible');
            }, 2000);
        },
        
        updateIcon: (iconElement, isActive) => {
            iconElement.classList.toggle('active', isActive);
        },
        
        applyDisplayMode: () => {
            document.body.classList.remove('dark-mode');
            
            if (state.displayMode === DISPLAY_MODES.DARK) {
                document.body.classList.add('dark-mode');
            } else if (state.displayMode === DISPLAY_MODES.AUTO && 
                      window.matchMedia && 
                      window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.add('dark-mode');
            }
            
            ui.updateIcon(elements.icons.lightMode, state.displayMode === DISPLAY_MODES.LIGHT);
            ui.updateIcon(elements.icons.darkMode, state.displayMode === DISPLAY_MODES.DARK);
            ui.updateIcon(elements.icons.autoMode, state.displayMode === DISPLAY_MODES.AUTO);
        },
        
        applyScreenMode: () => {
            const isCentered = state.screenMode === SCREEN_MODES.CENTERED;
            document.body.classList.toggle('centered', isCentered);
            document.body.classList.toggle('fullscreen', !isCentered);
            
            ui.updateIcon(elements.icons.centered, isCentered);
            ui.updateIcon(elements.icons.fullscreen, !isCentered);
        },
        
        applySpellcheck: (isEnabled) => {
            elements.page.spellcheck = isEnabled;
            ui.updateIcon(elements.icons.spellcheckOn, isEnabled);
            ui.updateIcon(elements.icons.spellcheckOff, !isEnabled);
        },
        
        showInstallPrompt: () => {
            if (state.deferredPrompt && !localStorage.getItem(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED)) {
                elements.installPrompt.style.display = 'flex';
            }
        }
    };
    
    // Core Functionality
    const app = {
        saveContent: () => {
            localStorage.setItem(STORAGE_KEYS.CONTENT, elements.page.value);
            ui.showStatus('Saved');
        },
        
        loadContent: () => {
            const savedContent = localStorage.getItem(STORAGE_KEYS.CONTENT);
            if (savedContent) {
                elements.page.value = savedContent;
            }
            app.updateCount();
        },
        
        handleInput: () => {
            ui.showStatus('Saving...');
            app.updateCount();
            
            clearTimeout(state.saveTimeout);
            state.saveTimeout = setTimeout(app.saveContent, 1000);
        },
        
        updateCount: () => {
            const text = elements.page.value;
            const selection = elements.page.value.substring(
                elements.page.selectionStart, 
                elements.page.selectionEnd
            );
            const hasSelection = selection.length > 0;
            
            elements.countDisplay.classList.toggle('highlighted', hasSelection);
            const textToCount = hasSelection ? selection : text;
            
            if (state.countMode === COUNT_MODES.CHARACTERS) {
                elements.countDisplay.textContent = `${textToCount.length} characters`;
            } else {
                const wordCount = textToCount.trim() === '' ? 0 : textToCount.trim().split(/\s+/).length;
                elements.countDisplay.textContent = `${wordCount} words`;
            }
            
            elements.countDisplay.title = hasSelection 
                ? "Counting selected text" 
                : "Click to toggle between characters/words count";
            
            // Update aria-label for screen readers
            elements.countDisplay.setAttribute('aria-label', 
                `${hasSelection ? 'Selected text: ' : ''}${elements.countDisplay.textContent}`);
        },
        
        toggleCountMode: () => {
            state.countMode = state.countMode === COUNT_MODES.CHARACTERS 
                ? COUNT_MODES.WORDS 
                : COUNT_MODES.CHARACTERS;
            
            localStorage.setItem(STORAGE_KEYS.COUNT_MODE, state.countMode);
            app.updateCount();
        },
        
        toggleSpellcheck: () => {
            const isSpellcheckOn = !elements.page.spellcheck;
            ui.applySpellcheck(isSpellcheckOn);
            localStorage.setItem(STORAGE_KEYS.SPELLCHECK, isSpellcheckOn);
        },
        
        toggleDisplayMode: () => {
            // Cycle through modes: light -> dark -> auto -> light
            if (state.displayMode === DISPLAY_MODES.LIGHT) {
                state.displayMode = DISPLAY_MODES.DARK;
            } else if (state.displayMode === DISPLAY_MODES.DARK) {
                state.displayMode = DISPLAY_MODES.AUTO;
            } else {
                state.displayMode = DISPLAY_MODES.LIGHT;
            }
            
            ui.applyDisplayMode();
            localStorage.setItem(STORAGE_KEYS.DISPLAY_MODE, state.displayMode);
        },
        
        toggleScreenMode: () => {
            state.screenMode = state.screenMode === SCREEN_MODES.CENTERED 
                ? SCREEN_MODES.FULLSCREEN 
                : SCREEN_MODES.CENTERED;
            
            ui.applyScreenMode();
            localStorage.setItem(STORAGE_KEYS.SCREEN_MODE, state.screenMode);
        },
        
        installApp: () => {
            if (state.deferredPrompt) {
                state.deferredPrompt.prompt();
                
                state.deferredPrompt.userChoice.then(choiceResult => {
                    if (choiceResult.outcome === 'accepted') {
                        ui.showStatus('App installed!');
                    }
                    state.deferredPrompt = null;
                });
                
                elements.installPrompt.style.display = 'none';
            }
        },
        
        closeInstallPrompt: () => {
            elements.installPrompt.style.display = 'none';
            localStorage.setItem(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED, 'true');
        },
        
        registerServiceWorker: () => {
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('service-worker.js')
                        .then(registration => {
                            console.log('ServiceWorker registration successful with scope: ', registration.scope);
                        })
                        .catch(error => {
                            console.log('ServiceWorker registration failed: ', error);
                        });
                });
            }
        },
        
        loadSettings: () => {
            // Load count mode preference
            const savedCountMode = localStorage.getItem(STORAGE_KEYS.COUNT_MODE);
            if (savedCountMode && Object.values(COUNT_MODES).includes(savedCountMode)) {
                state.countMode = savedCountMode;
            }
            
            // Load spellcheck preference
            const savedSpellcheck = localStorage.getItem(STORAGE_KEYS.SPELLCHECK);
            if (savedSpellcheck !== null) {
                ui.applySpellcheck(savedSpellcheck === 'true');
            }
            
            // Load display mode preference
            const savedDisplayMode = localStorage.getItem(STORAGE_KEYS.DISPLAY_MODE);
            if (savedDisplayMode && Object.values(DISPLAY_MODES).includes(savedDisplayMode)) {
                state.displayMode = savedDisplayMode;
            }
            ui.applyDisplayMode();
            
            // Load screen mode preference
            const savedScreenMode = localStorage.getItem(STORAGE_KEYS.SCREEN_MODE);
            if (savedScreenMode === SCREEN_MODES.FULLSCREEN) {
                state.screenMode = SCREEN_MODES.FULLSCREEN;
            }
            ui.applyScreenMode();
        },
        
        setupPWA: () => {
            // Register service worker
            app.registerServiceWorker();
            
            // Listen for beforeinstallprompt event
            window.addEventListener('beforeinstallprompt', (e) => {
                // Prevent Chrome 67 and earlier from automatically showing the prompt
                e.preventDefault();
                
                // Stash the event so it can be triggered later
                state.deferredPrompt = e;
                
                // Show install prompt
                setTimeout(() => {
                    ui.showInstallPrompt();
                }, 3000);
            });
            
            // PWA install button
            elements.installButton.addEventListener('click', app.installApp);
            elements.closePromptButton.addEventListener('click', app.closeInstallPrompt);
        },
        
        setupEventListeners: () => {
            // Content changes
            elements.page.addEventListener('input', app.handleInput);
            
            // Selection changes
            elements.page.addEventListener('select', app.updateCount);
            elements.page.addEventListener('mouseup', app.updateCount);
            elements.page.addEventListener('touchend', app.updateCount);
            elements.page.addEventListener('keyup', (e) => {
                // Check for selection related keys
                if (['Shift', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 
                     'ArrowDown', 'Home', 'End'].includes(e.key)) {
                    app.updateCount();
                }
            });
            
            // UI Controls - keyboard and touch friendly
            elements.countDisplay.addEventListener('click', app.toggleCountMode);
            elements.countDisplay.addEventListener('touchend', (e) => {
                e.preventDefault();
                app.toggleCountMode();
            });
            elements.countDisplay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    app.toggleCountMode();
                }
            });
            
            elements.spellcheckToggle.addEventListener('click', app.toggleSpellcheck);
            elements.displayModeToggle.addEventListener('click', app.toggleDisplayMode);
            elements.screenModeToggle.addEventListener('click', app.toggleScreenMode);
            
            // Handle orientation changes
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    window.scrollTo(0, 0);
                }, 50);
            });
            
            // System events
            if (window.matchMedia) {
                const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                
                // Use addEventListener if supported (newer browsers)
                if (darkModeMediaQuery.addEventListener) {
                    darkModeMediaQuery.addEventListener('change', (e) => {
                        if (state.displayMode === DISPLAY_MODES.AUTO) {
                            document.body.classList.toggle('dark-mode', e.matches);
                        }
                    });
                } else {
                    // Fallback for older browsers
                    darkModeMediaQuery.addListener((e) => {
                        if (state.displayMode === DISPLAY_MODES.AUTO) {
                            document.body.classList.toggle('dark-mode', e.matches);
                        }
                    });
                }
            }
            
            // Save when window loses focus
            window.addEventListener('blur', () => {
                if (state.saveTimeout) {
                    clearTimeout(state.saveTimeout);
                    app.saveContent();
                }
            });
            
            // Handle virtual keyboard
            if ('visualViewport' in window) {
                window.visualViewport.addEventListener('resize', () => {
                    // Adjust for virtual keyboard
                    const isKeyboardVisible = window.visualViewport.height < window.innerHeight;
                    document.body.style.height = isKeyboardVisible ? 
                        `${window.visualViewport.height}px` : '';
                });
            }
        },
        
        init: () => {
            app.loadSettings();
            app.loadContent();
            app.setupEventListeners();
            app.setupPWA();
        }
    };
    
    // Initialize the application
    app.init();
})(); 