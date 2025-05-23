(() => {
    // Constants
    const STORAGE_KEYS = {
        TABS: 'blank-page-tabs',
        ACTIVE_TAB: 'blank-page-active-tab',
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
        tabsContainer: document.getElementById('tabsContainer'),
        addTabButton: document.getElementById('addTabButton'),
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
        deferredPrompt: null,
        statusVisibilityTimeout: null,
        tabs: [],
        activeTabId: null,
        nextTabId: 1
    };
    
    // Tab Management
    const tabManager = {
        createTab: (title = 'Untitled', content = '', setActive = true) => {
            // Save current tab content before creating new tab
            if (state.activeTabId) {
                tabManager.saveCurrentTabContent();
            }
            
            const tab = {
                id: state.nextTabId++,
                title: title,
                content: content,
                lastModified: Date.now(),
                isAutoTitle: title === 'Untitled', // Track if title is auto-generated
                spellcheck: true // Default spellcheck enabled for new tabs
            };
            
            state.tabs.push(tab);
            
            if (setActive) {
                state.activeTabId = tab.id;
                elements.page.value = tab.content; // Set textarea to new tab content immediately
                ui.applySpellcheck(tab.spellcheck); // Apply spellcheck setting for this tab
            }
            
            tabManager.renderTabs();
            tabManager.saveTabs();
            
            if (setActive) {
                app.updateCount();
                // Focus the textarea
                elements.page.focus();
            }
            
            return tab;
        },
        
        removeTab: (tabId) => {
            if (state.tabs.length <= 1) {
                ui.showStatus('Cannot close the last tab');
                return;
            }
            
            const tabIndex = state.tabs.findIndex(tab => tab.id === tabId);
            if (tabIndex === -1) return;
            
            // Save current content before removing
            if (state.activeTabId === tabId) {
                tabManager.saveCurrentTabContent();
            }
            
            state.tabs.splice(tabIndex, 1);
            
            // Switch to another tab if the active tab was closed
            if (state.activeTabId === tabId) {
                const newActiveTab = state.tabs[Math.max(0, tabIndex - 1)];
                state.activeTabId = newActiveTab.id;
                tabManager.switchToTab(newActiveTab.id);
            }
            
            tabManager.renderTabs();
            tabManager.saveTabs();
        },
        
        switchToTab: (tabId) => {
            // Save current tab content before switching
            if (state.activeTabId && state.activeTabId !== tabId) {
                tabManager.saveCurrentTabContent();
            }
            
            const tab = state.tabs.find(t => t.id === tabId);
            if (!tab) return;
            
            state.activeTabId = tabId;
            elements.page.value = tab.content;
            
            // Apply tab-specific spellcheck setting
            ui.applySpellcheck(tab.spellcheck);
            
            tabManager.renderTabs();
            app.updateCount();
            
            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tabId);
            } catch (error) {
                console.error('Error saving active tab:', error);
            }
            
            // Focus the textarea
            elements.page.focus();
        },
        
        saveCurrentTabContent: () => {
            if (!state.activeTabId) return;
            
            const tab = state.tabs.find(t => t.id === state.activeTabId);
            if (tab) {
                tab.content = elements.page.value;
                tab.lastModified = Date.now();
            }
        },
        
        renameTab: (tabId, newTitle) => {
            const tab = state.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.title = newTitle.trim() || 'Untitled';
                tab.isAutoTitle = false; // Mark as manually renamed
                tab.lastModified = Date.now();
                tabManager.renderTabs();
                tabManager.saveTabs();
            }
        },
        
        renderTabs: () => {
            elements.tabsContainer.innerHTML = '';
            
            state.tabs.forEach(tab => {
                const tabElement = document.createElement('div');
                tabElement.className = `tab ${tab.id === state.activeTabId ? 'active' : ''}`;
                tabElement.dataset.tabId = tab.id;
                
                const titleElement = document.createElement('span');
                titleElement.className = 'tab-title';
                titleElement.textContent = tab.title;
                titleElement.title = tab.title;
                
                const closeButton = document.createElement('button');
                closeButton.className = 'tab-close';
                const closeIcon = document.createElement('i');
                closeIcon.className = 'fa-solid fa-xmark';
                closeIcon.setAttribute('aria-hidden', 'true');
                closeButton.appendChild(closeIcon);
                closeButton.title = 'Close tab';
                closeButton.setAttribute('aria-label', `Close ${tab.title}`);
                
                // Only show close button for active tab
                if (tab.id !== state.activeTabId) {
                    closeButton.style.display = 'none';
                }
                
                // Tab click event - always switches to the tab
                tabElement.addEventListener('click', (e) => {
                    if (e.target === closeButton || e.target.parentElement === closeButton || e.target === closeIcon) {
                        return; // Let close button handle this
                    }
                    
                    // If clicking on title of active tab and it's a double-click, handle renaming
                    if (e.target === titleElement && e.detail === 2 && tab.id === state.activeTabId) {
                        e.preventDefault();
                        e.stopPropagation();
                        tabManager.startRenaming(tab.id, titleElement);
                        return;
                    }
                    
                    // Switch to this tab
                    tabManager.switchToTab(tab.id);
                });
                
                // Close button event (only works for active tab)
                closeButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (tab.id === state.activeTabId) {
                        tabManager.removeTab(tab.id);
                    }
                });
                
                tabElement.appendChild(titleElement);
                tabElement.appendChild(closeButton);
                elements.tabsContainer.appendChild(tabElement);
            });
        },
        
        startRenaming: (tabId, titleElement) => {
            const tab = state.tabs.find(t => t.id === tabId);
            if (!tab) return;
            
            const input = document.createElement('input');
            input.className = 'tab-title editing';
            input.type = 'text';
            input.value = tab.title;
            input.maxLength = 50;
            
            const finishRenaming = () => {
                const newTitle = input.value.trim();
                tabManager.renameTab(tabId, newTitle);
            };
            
            input.addEventListener('blur', finishRenaming);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    tabManager.renderTabs(); // Cancel editing
                }
            });
            
            titleElement.parentElement.replaceChild(input, titleElement);
            input.focus();
            input.select();
        },
        
        saveTabs: () => {
            try {
                const tabsData = {
                    tabs: state.tabs,
                    nextTabId: state.nextTabId
                };
                const dataString = JSON.stringify(tabsData);
                
                // Check if data is too large (basic check)
                if (dataString.length > 5000000) { // ~5MB limit
                    ui.showStatus('Content too large to save');
                    return;
                }
                
                localStorage.setItem(STORAGE_KEYS.TABS, dataString);
            } catch (error) {
                if (error.name === 'QuotaExceededError') {
                    ui.showStatus('Storage quota exceeded');
                    // Try to clean up old data or reduce current data
                    try {
                        // Remove some less critical data
                        const reducedTabs = state.tabs.map(tab => ({
                            ...tab,
                            content: tab.content.substring(0, 10000) // Truncate content if too long
                        }));
                        const reducedData = {
                            tabs: reducedTabs,
                            nextTabId: state.nextTabId
                        };
                        localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(reducedData));
                        ui.showStatus('Saved with truncated content');
                    } catch (secondError) {
                        console.error('Failed to save even truncated data:', secondError);
                        ui.showStatus('Failed to save');
                    }
                } else {
                    console.error('Error saving tabs:', error);
                    ui.showStatus('Error saving');
                }
            }
        },
        
        loadTabs: () => {
            try {
                // First check for legacy content (migration)
                const legacyContent = localStorage.getItem('blank-page-content');
                const legacySpellcheck = localStorage.getItem(STORAGE_KEYS.SPELLCHECK);
                
                const tabsJson = localStorage.getItem(STORAGE_KEYS.TABS);
                
                if (tabsJson) {
                    const tabsData = JSON.parse(tabsJson);
                    state.tabs = tabsData.tabs || [];
                    state.nextTabId = tabsData.nextTabId || 1;
                    
                    // Ensure all tabs have required properties (for backward compatibility)
                    state.tabs.forEach(tab => {
                        if (tab.isAutoTitle === undefined) {
                            tab.isAutoTitle = tab.title === 'Untitled' || tab.title.startsWith('Document ');
                        }
                        if (tab.spellcheck === undefined) {
                            // Use legacy global setting or default to true
                            tab.spellcheck = legacySpellcheck !== null ? legacySpellcheck === 'true' : true;
                        }
                    });
                    
                    // Migrate legacy content if tabs exist but first tab is empty
                    if (legacyContent && state.tabs.length > 0 && !state.tabs[0].content) {
                        state.tabs[0].content = legacyContent;
                        localStorage.removeItem('blank-page-content'); // Clean up
                    }
                } else if (legacyContent) {
                    // Migrate from legacy single-content format
                    const spellcheckEnabled = legacySpellcheck !== null ? legacySpellcheck === 'true' : true;
                    tabManager.createTab('Untitled', legacyContent, false);
                    state.tabs[0].spellcheck = spellcheckEnabled;
                    localStorage.removeItem('blank-page-content'); // Clean up
                }
                
                // Clean up legacy spellcheck setting
                if (legacySpellcheck !== null) {
                    localStorage.removeItem(STORAGE_KEYS.SPELLCHECK);
                }
                
                // Create default tab if none exist
                if (state.tabs.length === 0) {
                    tabManager.createTab('Untitled', '', false);
                }
                
                // Load active tab
                const savedActiveTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
                if (savedActiveTab) {
                    const activeTab = state.tabs.find(t => t.id === parseInt(savedActiveTab, 10));
                    if (activeTab) {
                        state.activeTabId = activeTab.id;
                    }
                }
                
                // Fallback to first tab
                if (!state.activeTabId && state.tabs.length > 0) {
                    state.activeTabId = state.tabs[0].id;
                }
                
                tabManager.renderTabs();
                if (state.activeTabId) {
                    tabManager.switchToTab(state.activeTabId);
                }
                
            } catch (error) {
                console.error('Error loading tabs:', error);
                // Create default tab on error
                if (state.tabs.length === 0) {
                    tabManager.createTab('Untitled', '', false);
                    state.activeTabId = state.tabs[0].id;
                    tabManager.renderTabs();
                    tabManager.switchToTab(state.activeTabId);
                }
            }
        },
        
        updateTabTitle: (tabId = null) => {
            const targetTabId = tabId || state.activeTabId;
            if (!targetTabId) return;
            
            const tab = state.tabs.find(t => t.id === targetTabId);
            if (!tab || !tab.isAutoTitle) return; // Don't update manually set titles
            
            const content = targetTabId === state.activeTabId ? elements.page.value : tab.content;
            const firstLine = content.split('\n')[0].trim();
            
            let newTitle;
            if (firstLine.length > 0) {
                // Truncate long titles and add ellipsis
                const maxLength = 20;
                newTitle = firstLine.length > maxLength 
                    ? firstLine.substring(0, maxLength) + '...' 
                    : firstLine;
            } else {
                newTitle = 'Untitled';
            }
            
            // Only update if title actually changed
            if (tab.title !== newTitle) {
                tab.title = newTitle;
                tab.lastModified = Date.now();
                tabManager.renderTabs();
            }
        }
    };
    
    // UI Handlers
    const ui = {
        showStatus: (message) => {
            elements.status.textContent = message;
            elements.status.classList.add('visible');
            
            // Clear any existing timeout
            if (state.statusVisibilityTimeout) {
                clearTimeout(state.statusVisibilityTimeout);
            }
            
            state.statusVisibilityTimeout = setTimeout(() => {
                elements.status.classList.remove('visible');
                state.statusVisibilityTimeout = null;
            }, 2000);
        },
        
        updateIcon: (iconElement, isActive) => {
            if (!iconElement) return;
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
            try {
                // Save current tab content first
                tabManager.saveCurrentTabContent();
                tabManager.saveTabs();
                ui.showStatus('Saved');
            } catch (error) {
                console.error('Error saving content:', error);
                ui.showStatus('Error saving');
            }
        },
        
        handleInput: () => {
            ui.showStatus('Saving...');
            app.updateCount();
            
            // Update tab title based on first line if it's auto-titled
            tabManager.updateTabTitle();
            
            if (state.saveTimeout) {
                clearTimeout(state.saveTimeout);
            }
            
            // Save after 1 second of inactivity
            state.saveTimeout = setTimeout(app.saveContent, 1000);
        },
        
        updateCount: () => {
            const text = elements.page.value || '';
            const selection = elements.page.value.substring(
                elements.page.selectionStart, 
                elements.page.selectionEnd
            );
            const hasSelection = selection.length > 0;
            
            elements.countDisplay.classList.toggle('highlighted', hasSelection);
            const textToCount = hasSelection ? selection : text;
            
            let countText;
            if (state.countMode === COUNT_MODES.CHARACTERS) {
                countText = `${textToCount.length} characters`;
            } else {
                const wordCount = textToCount.trim() === '' ? 0 : textToCount.trim().split(/\s+/).length;
                countText = `${wordCount} words`;
            }
            
            // Only update DOM if the text has changed
            if (elements.countDisplay.textContent !== countText) {
                elements.countDisplay.textContent = countText;
            }
            
            elements.countDisplay.title = hasSelection 
                ? "Counting selected text" 
                : "Click to toggle between characters/words count";
            
            // Update aria-label for screen readers
            elements.countDisplay.setAttribute('aria-label', 
                `${hasSelection ? 'Selected text: ' : ''}${countText}`);
        },
        
        toggleCountMode: () => {
            state.countMode = state.countMode === COUNT_MODES.CHARACTERS 
                ? COUNT_MODES.WORDS 
                : COUNT_MODES.CHARACTERS;
            
            try {
                localStorage.setItem(STORAGE_KEYS.COUNT_MODE, state.countMode);
                app.updateCount();
            } catch (error) {
                console.error('Error saving count mode:', error);
            }
        },
        
        toggleSpellcheck: () => {
            if (!state.activeTabId) return;
            
            const tab = state.tabs.find(t => t.id === state.activeTabId);
            if (!tab) return;
            
            const isSpellcheckOn = !tab.spellcheck;
            tab.spellcheck = isSpellcheckOn;
            tab.lastModified = Date.now();
            
            ui.applySpellcheck(isSpellcheckOn);
            
            try {
                tabManager.saveTabs(); // Save tabs with updated spellcheck setting
            } catch (error) {
                console.error('Error saving spellcheck setting:', error);
            }
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
            
            try {
                localStorage.setItem(STORAGE_KEYS.DISPLAY_MODE, state.displayMode);
            } catch (error) {
                console.error('Error saving display mode:', error);
            }
        },
        
        toggleScreenMode: () => {
            state.screenMode = state.screenMode === SCREEN_MODES.CENTERED 
                ? SCREEN_MODES.FULLSCREEN 
                : SCREEN_MODES.CENTERED;
            
            ui.applyScreenMode();
            
            try {
                localStorage.setItem(STORAGE_KEYS.SCREEN_MODE, state.screenMode);
            } catch (error) {
                console.error('Error saving screen mode:', error);
            }
        },
        
        installApp: () => {
            if (state.deferredPrompt) {
                state.deferredPrompt.prompt();
                
                state.deferredPrompt.userChoice.then(choiceResult => {
                    if (choiceResult.outcome === 'accepted') {
                        ui.showStatus('App installed!');
                    }
                    state.deferredPrompt = null;
                }).catch(error => {
                    console.error('Installation error:', error);
                });
                
                elements.installPrompt.style.display = 'none';
            }
        },
        
        closeInstallPrompt: () => {
            elements.installPrompt.style.display = 'none';
            try {
                localStorage.setItem(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED, 'true');
            } catch (error) {
                console.error('Error saving prompt dismissed state:', error);
            }
        },
        
        registerServiceWorker: () => {
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('service-worker.js')
                        .then(registration => {
                            // Only log in development
                            if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                            }
                        })
                        .catch(error => {
                            console.error('ServiceWorker registration failed: ', error);
                        });
                });
            }
        },
        
        loadSettings: () => {
            try {
                // Load count mode preference
                const savedCountMode = localStorage.getItem(STORAGE_KEYS.COUNT_MODE);
                if (savedCountMode && Object.values(COUNT_MODES).includes(savedCountMode)) {
                    state.countMode = savedCountMode;
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
            } catch (error) {
                console.error('Error loading settings:', error);
            }
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
                
                // Show install prompt after a short delay
                setTimeout(() => {
                    ui.showInstallPrompt();
                }, 3000);
            });
            
            // PWA install button
            elements.installButton.addEventListener('click', app.installApp);
            elements.closePromptButton.addEventListener('click', app.closeInstallPrompt);
        },
        
        handleSelectionChange: () => {
            requestAnimationFrame(app.updateCount);
        },
        
        handleArrowKeys: (e) => {
            // Check for selection related keys
            if (['Shift', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 
                 'ArrowDown', 'Home', 'End'].includes(e.key)) {
                app.handleSelectionChange();
            }
        },
        
        handleKeyboardShortcuts: (e) => {
            // Ctrl/Cmd + T: New tab
            if ((e.ctrlKey || e.metaKey) && e.key === 't') {
                e.preventDefault();
                const newTabNumber = state.tabs.length + 1;
                tabManager.createTab(`Document ${newTabNumber}`);
            }
            
            // Ctrl/Cmd + W: Close tab
            if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
                e.preventDefault();
                if (state.activeTabId) {
                    tabManager.removeTab(state.activeTabId);
                }
            }
            
            // Ctrl/Cmd + Tab: Next tab (simplified)
            if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
                e.preventDefault();
                const currentIndex = state.tabs.findIndex(tab => tab.id === state.activeTabId);
                const nextIndex = (currentIndex + 1) % state.tabs.length;
                tabManager.switchToTab(state.tabs[nextIndex].id);
            }
        },
        
        setupEventListeners: () => {
            // Content changes
            elements.page.addEventListener('input', app.handleInput);
            
            // Selection changes (debounced via requestAnimationFrame)
            elements.page.addEventListener('select', app.handleSelectionChange);
            elements.page.addEventListener('mouseup', app.handleSelectionChange);
            elements.page.addEventListener('touchend', app.handleSelectionChange);
            elements.page.addEventListener('keyup', app.handleArrowKeys);
            
            // Keyboard shortcuts
            document.addEventListener('keydown', app.handleKeyboardShortcuts);
            
            // UI Controls - keyboard and touch friendly
            elements.countDisplay.addEventListener('click', app.toggleCountMode);
            elements.countDisplay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    app.toggleCountMode();
                }
            });
            
            elements.spellcheckToggle.addEventListener('click', app.toggleSpellcheck);
            elements.displayModeToggle.addEventListener('click', app.toggleDisplayMode);
            elements.screenModeToggle.addEventListener('click', app.toggleScreenMode);
            
            // Tab management
            elements.addTabButton.addEventListener('click', () => {
                tabManager.createTab('Untitled');
            });
            
            // Handle orientation changes
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    window.scrollTo(0, 0);
                }, 50);
            });
            
            // System events
            if (window.matchMedia) {
                const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                
                // Use addEventListener for all browsers (backwards compatibility handled internally)
                try {
                    darkModeMediaQuery.addEventListener('change', (e) => {
                        if (state.displayMode === DISPLAY_MODES.AUTO) {
                            document.body.classList.toggle('dark-mode', e.matches);
                        }
                    });
                } catch (error) {
                    // Fallback for older browsers
                    console.warn('MediaQueryList.addEventListener not supported');
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
            
            // Ensure content is saved before page unloads
            window.addEventListener('beforeunload', () => {
                if (state.saveTimeout) {
                    clearTimeout(state.saveTimeout);
                    app.saveContent();
                }
            });
        },
        
        init: () => {
            try {
                app.loadSettings();
                tabManager.loadTabs();
                app.setupEventListeners();
                app.setupPWA();
            } catch (error) {
                console.error('Error initializing app:', error);
                // Fallback initialization
                try {
                    // Ensure at least one tab exists
                    if (state.tabs.length === 0) {
                        tabManager.createTab('Untitled', '', true);
                    }
                    // Ensure basic event listeners are set up
                    if (elements.page) {
                        elements.page.addEventListener('input', app.handleInput);
                    }
                } catch (fallbackError) {
                    console.error('Critical error in app initialization:', fallbackError);
                }
            }
        }
    };
    
    // Initialize the application
    app.init();
})(); 