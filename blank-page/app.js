(() => {
    // Add logging utility to conditionally show logs only in development
    const log = {
        isDev: () => location.hostname === 'localhost' || location.hostname === '127.0.0.1',
        error: (message, error) => {
            if (log.isDev() || message.includes('Critical')) {
                console.error(message, error);
            }
        },
        warn: (message) => {
            if (log.isDev()) {
                console.warn(message);
            }
        },
        info: (message, data) => {
            if (log.isDev()) {
                console.log(message, data);
            }
        }
    };

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
        moreButton: document.getElementById('moreButton'),
        moreDropdown: document.getElementById('moreDropdown'),
        clearAllButton: document.getElementById('clearAllButton'),
        importButton: document.getElementById('importButton'),
        exportButton: document.getElementById('exportButton'),
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
        nextTabId: 1,
        contentModified: false, // Track whether content has been modified since last save
        isProcessingTabOperation: false, // Flag to prevent input processing during tab operations
        backupInterval: null, // For periodic backups
        lastTextLength: 0, // Cache for optimizing updateCount performance
        lastDisplayedCountText: '' // Cache to track when count display needs updating
    };
    
    // Tab Management
    const tabManager = {
        createTab: (title = 'Untitled', content = '', setActive = true) => {
            // Set flag to prevent input processing during tab operation
            state.isProcessingTabOperation = true;
            
            // Save current tab content before creating new tab
            if (state.activeTabId) {
                log.info(`Creating new tab, saving current tab ${state.activeTabId} content first`);
                tabManager.saveCurrentTabContent();
            }
            
            // Clean up any existing animations before creating new tab
            document.querySelectorAll('.tab').forEach(tabEl => {
                tabEl.classList.remove('opening', 'closing', 'activating', 'deactivating', 'switching-in');
            });
            elements.page.classList.remove('switching-out', 'switching-in');
            
            const tab = {
                id: state.nextTabId++,
                title: title,
                content: content,
                lastModified: Date.now(),
                isAutoTitle: title === 'Untitled', // Track if title is auto-generated
                spellcheck: true, // Default spellcheck enabled for new tabs
                countMode: COUNT_MODES.CHARACTERS, // Default count mode for new tabs
                isOpening: true // Mark this tab as needing opening animation
            };
            
            // Always add new tabs to the end to ensure natural slide-in animation
            state.tabs.push(tab);
            log.info(`Created new tab ${tab.id} with title "${tab.title}" and content length: ${tab.content.length}`);
            
            if (setActive) {
                // Temporarily disable input event handling to prevent race conditions
                const previousActiveTabId = state.activeTabId;
                log.info(`Switching from tab ${previousActiveTabId} to new tab ${tab.id}`);
                
                // Set the new tab as active and update textarea atomically
                state.activeTabId = tab.id;
                elements.page.value = tab.content; // Set textarea to new tab content immediately
                ui.applySpellcheck(tab.spellcheck); // Apply spellcheck setting for this tab
                state.countMode = tab.countMode; // Apply count mode setting for this tab
                
                // Ensure any pending input events are cleared
                state.contentModified = false;
                log.info(`Set textarea to new tab content: "${tab.content}"`);
            }
            
            tabManager.renderTabs();
            
            // Remove the animation flag after animation completes
            setTimeout(() => {
                tab.isOpening = false;
                const tabElement = document.querySelector(`[data-tab-id="${tab.id}"]`);
                if (tabElement) {
                    tabElement.classList.remove('opening');
                }
                
                // Clear the processing flag after all operations are complete
                state.isProcessingTabOperation = false;
            }, 300);
            
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
            
            // Set flag to prevent input processing during tab operation
            state.isProcessingTabOperation = true;
            
            const tabIndex = state.tabs.findIndex(tab => tab.id === tabId);
            if (tabIndex === -1) {
                state.isProcessingTabOperation = false;
                return;
            }
            
            const tab = state.tabs[tabIndex];
            log.info(`Removing tab ${tabId} (${tab.title}) with content length: ${tab.content.length}`);
            log.info(`Current active tab: ${state.activeTabId}, current textarea content length: ${elements.page.value.length}`);
            
            // Add confirmation dialog for non-empty tabs
            if (tab.content.trim() !== '') {
                const confirmClose = confirm(`Are you sure you want to close "${tab.title}"? This cannot be undone.`);
                if (!confirmClose) {
                    state.isProcessingTabOperation = false;
                    return;
                }
            }
            
            // Only save current content if we're closing the active tab
            // If we're closing a non-active tab, we don't want to save the current content to it
            if (state.activeTabId === tabId) {
                log.info(`Saving current content before removing active tab ${tabId}`);
                tabManager.saveCurrentTabContent();
            } else {
                log.info(`Not saving content because removing non-active tab ${tabId} (active: ${state.activeTabId})`);
            }
            
            // Add closing animation
            const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
            if (tabElement) {
                tabElement.classList.add('closing');
                
                // Wait for animation to complete before removing
                setTimeout(() => {
                    // Remove from state
                    state.tabs.splice(tabIndex, 1);
                    log.info(`Removed tab ${tabId} from state, remaining tabs: ${state.tabs.map(t => `${t.id}(${t.title})`).join(', ')}`);
                    
                    // Switch to another tab if the active tab was closed
                    if (state.activeTabId === tabId) {
                        const newActiveTab = state.tabs[Math.max(0, tabIndex - 1)];
                        log.info(`Switching to tab ${newActiveTab.id} (${newActiveTab.title}) with content length: ${newActiveTab.content.length}`);
                        state.activeTabId = newActiveTab.id;
                        
                        // Don't call switchToTab here, just update the UI directly
                        // to avoid any potential content confusion
                        elements.page.value = newActiveTab.content || '';
                        ui.applySpellcheck(newActiveTab.spellcheck || true);
                        state.countMode = newActiveTab.countMode || COUNT_MODES.CHARACTERS;
                        state.contentModified = false;
                        log.info(`Set textarea to content: "${newActiveTab.content}"`);
                        
                        try {
                            localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, newActiveTab.id);
                        } catch (error) {
                            console.error('Error saving active tab:', error);
                        }
                        
                        app.updateCount();
                    }
                    
                    tabManager.renderTabs();
                    tabManager.saveTabs();
                    
                    // Clear the processing flag after all operations are complete
                    state.isProcessingTabOperation = false;
                }, 250);
            } else {
                // Fallback if element not found
                state.tabs.splice(tabIndex, 1);
                log.info(`Removed tab ${tabId} from state (fallback), remaining tabs: ${state.tabs.map(t => `${t.id}(${t.title})`).join(', ')}`);
                
                if (state.activeTabId === tabId) {
                    const newActiveTab = state.tabs[Math.max(0, tabIndex - 1)];
                    log.info(`Switching to tab ${newActiveTab.id} (${newActiveTab.title}) with content length: ${newActiveTab.content.length} (fallback)`);
                    state.activeTabId = newActiveTab.id;
                    
                    // Direct update without calling switchToTab
                    elements.page.value = newActiveTab.content || '';
                    ui.applySpellcheck(newActiveTab.spellcheck || true);
                    state.countMode = newActiveTab.countMode || COUNT_MODES.CHARACTERS;
                    state.contentModified = false;
                    log.info(`Set textarea to content: "${newActiveTab.content}" (fallback)`);
                    
                    try {
                        localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, newActiveTab.id);
                    } catch (error) {
                        console.error('Error saving active tab:', error);
                    }
                    
                    app.updateCount();
                }
                
                tabManager.renderTabs();
                tabManager.saveTabs();
                
                // Clear the processing flag after all operations are complete
                state.isProcessingTabOperation = false;
            }
        },
        
        switchToTab: (tabId) => {
            // Set flag to prevent input processing during tab operation
            state.isProcessingTabOperation = true;
            
            // Save current tab content before switching
            if (state.activeTabId && state.activeTabId !== tabId) {
                tabManager.saveCurrentTabContent();
                // Reset modification flag after saving when switching tabs
                state.contentModified = false;
            }
            
            const tab = state.tabs.find(t => t.id === tabId);
            if (!tab) {
                state.isProcessingTabOperation = false;
                return;
            }
            
            const isTabChange = state.activeTabId !== tabId;
            if (!isTabChange) {
                state.isProcessingTabOperation = false;
                return; // No need to switch if it's the same tab
            }
            
            const previousActiveTabId = state.activeTabId;
            
            // Clean up all existing animation classes first
            document.querySelectorAll('.tab').forEach(tabEl => {
                tabEl.classList.remove('opening', 'closing', 'activating', 'deactivating', 'switching-in');
            });
            elements.page.classList.remove('switching-out', 'switching-in');
            
            // Start content fade out animation
            elements.page.classList.add('switching-out');
            
            // After content fades out, switch content and start fade in
            setTimeout(() => {
                // Atomically switch the active tab and content
                state.activeTabId = tabId;
                
                // Ensure we have the content (defensive programming)
                if (tab.content === undefined) {
                    tab.content = '';
                }
                
                elements.page.value = tab.content;
                
                // Reset content modification flag to prevent accidental saves to wrong tab
                state.contentModified = false;
                
                // Apply tab-specific spellcheck setting
                ui.applySpellcheck(tab.spellcheck);
                
                // Apply tab-specific count mode setting
                state.countMode = tab.countMode || COUNT_MODES.CHARACTERS;
                
                // Update tab classes without animations first
                tabManager.renderTabs();
                
                // Start content fade in
                elements.page.classList.remove('switching-out');
                elements.page.classList.add('switching-in');
                
                // Clean up content animation class
                setTimeout(() => {
                    elements.page.classList.remove('switching-in');
                    
                    // Clear the processing flag after all operations are complete
                    state.isProcessingTabOperation = false;
                }, 200);
                
            }, 150); // Wait for content fade out to complete
            
            app.updateCount();
            
            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tabId);
            } catch (error) {
                console.error('Error saving active tab:', error);
            }
            
            // Focus the textarea after all animations
            setTimeout(() => {
                elements.page.focus();
            }, 200);
        },
        
        saveCurrentTabContent: () => {
            if (!state.activeTabId) return;
            
            const tab = state.tabs.find(t => t.id === state.activeTabId);
            if (tab) {
                // Only update if the tab actually exists and content has changed
                const currentContent = elements.page.value;
                
                // Double-check we're saving to the correct tab
                if (tab.id !== state.activeTabId) {
                    log.error(`Critical: Tab ID mismatch! Attempting to save to tab ${tab.id} but activeTabId is ${state.activeTabId}`);
                    return;
                }
                
                // Only log in development mode
                log.info(`Saving content for tab ${tab.id} (${tab.title})`, 
                    currentContent.length > 100 ? 
                    currentContent.substring(0, 100) + '...' : 
                    currentContent);
                
                tab.content = currentContent;
                tab.lastModified = Date.now();
                
                // Immediately save to localStorage after updating tab content
                try {
                    tabManager.saveTabs();
                } catch (error) {
                    log.error('Error saving tab content:', error);
                }
            } else {
                log.warn(`Attempted to save content for non-existent tab ID: ${state.activeTabId}`);
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
            // Get existing tab elements
            const existingTabElements = Array.from(elements.tabsContainer.querySelectorAll('.tab'));
            const existingTabIds = existingTabElements.map(el => parseInt(el.dataset.tabId, 10));
            
            // Remove tabs that no longer exist and clean up their event listeners
            existingTabElements.forEach(tabElement => {
                const tabId = parseInt(tabElement.dataset.tabId, 10);
                if (!isNaN(tabId) && !state.tabs.find(tab => tab.id === tabId)) {
                    // Clean up event listeners to prevent memory leaks
                    const clickHandlers = tabElement.cloneNode(true);
                    tabElement.parentNode.replaceChild(clickHandlers, tabElement);
                    clickHandlers.remove();
                } else if (isNaN(tabId)) {
                    // Remove invalid tab elements
                    tabElement.remove();
                }
            });
            
            // Add or update tabs
            state.tabs.forEach((tab, index) => {
                let tabElement = elements.tabsContainer.querySelector(`[data-tab-id="${tab.id}"]`);
                
                if (!tabElement) {
                    // Create new tab element
                    tabElement = document.createElement('div');
                    tabElement.className = 'tab';
                    tabElement.dataset.tabId = tab.id;
                    
                    // Set initial state for opening animation before adding to DOM
                    if (tab.isOpening) {
                        tabElement.style.opacity = '0';
                        tabElement.style.maxWidth = '0';
                        tabElement.style.paddingLeft = '0';
                        tabElement.style.paddingRight = '0';
                        tabElement.style.overflow = 'hidden';
                    }
                    
                    const titleElement = document.createElement('span');
                    titleElement.className = 'tab-title';
                    
                    const closeButton = document.createElement('button');
                    closeButton.className = 'tab-close';
                    const closeIcon = document.createElement('i');
                    closeIcon.className = 'fa-solid fa-xmark';
                    closeIcon.setAttribute('aria-hidden', 'true');
                    closeButton.appendChild(closeIcon);
                    closeButton.title = 'Close tab';
                    
                    // Tab click event - always switches to the tab
                    const tabClickHandler = (e) => {
                        if (e.target === closeButton || e.target.parentElement === closeButton || e.target === closeIcon) {
                            return; // Let close button handle this
                        }
                        
                        const titleElement = tabElement.querySelector('.tab-title');
                        // If clicking on title of active tab and it's a double-click, handle renaming
                        if (e.target === titleElement && e.detail === 2 && tab.id === state.activeTabId) {
                            e.preventDefault();
                            e.stopPropagation();
                            tabManager.startRenaming(tab.id, titleElement);
                            return;
                        }
                        
                        // Switch to this tab
                        tabManager.switchToTab(tab.id);
                    };
                    
                    // Close button event (only works for active tab)
                    const closeClickHandler = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        tabManager.removeTab(tab.id);
                    };
                    
                    // Store references to handlers for potential cleanup
                    tabElement._clickHandler = tabClickHandler;
                    closeButton._clickHandler = closeClickHandler;
                    
                    tabElement.addEventListener('click', tabClickHandler);
                    closeButton.addEventListener('click', closeClickHandler);
                    
                    tabElement.appendChild(titleElement);
                    tabElement.appendChild(closeButton);
                    
                    // Insert at correct position
                    const nextTabElement = elements.tabsContainer.children[index];
                    if (nextTabElement) {
                        elements.tabsContainer.insertBefore(tabElement, nextTabElement);
                    } else {
                        elements.tabsContainer.appendChild(tabElement);
                    }
                    
                    // Apply opening animation for new tabs after a small delay to ensure DOM is ready
                    if (tab.isOpening) {
                        // Use requestAnimationFrame to ensure the element is painted with initial styles
                        requestAnimationFrame(() => {
                            // Clear inline styles and let CSS animation take over
                            tabElement.style.opacity = '';
                            tabElement.style.maxWidth = '';
                            tabElement.style.paddingLeft = '';
                            tabElement.style.paddingRight = '';
                            tabElement.style.overflow = '';
                            tabElement.classList.add('opening');
                        });
                    }
                }
                
                // Update tab content and state
                const titleElement = tabElement.querySelector('.tab-title');
                const closeButton = tabElement.querySelector('.tab-close');
                
                if (titleElement && !titleElement.classList.contains('editing')) {
                    titleElement.textContent = tab.title;
                    titleElement.title = tab.title;
                }
                
                if (closeButton) {
                    closeButton.setAttribute('aria-label', `Close ${tab.title}`);
                    // Only show close button for active tab
                    closeButton.style.display = tab.id === state.activeTabId ? '' : 'none';
                }
                
                // Update active state without triggering animations
                const isActive = tab.id === state.activeTabId;
                if (isActive !== tabElement.classList.contains('active')) {
                    tabElement.classList.toggle('active', isActive);
                }
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
                // Validate state before saving
                if (!Array.isArray(state.tabs)) {
                    throw new Error('state.tabs is not an array');
                }
                
                // Validate each tab before saving
                const validTabs = state.tabs.filter(tab => {
                    if (!tab || typeof tab !== 'object') {
                        console.warn('Skipping invalid tab object:', tab);
                        return false;
                    }
                    if (typeof tab.id !== 'number') {
                        console.warn('Skipping tab with invalid ID:', tab);
                        return false;
                    }
                    if (typeof tab.title !== 'string') {
                        console.warn('Skipping tab with invalid title:', tab);
                        return false;
                    }
                    if (typeof tab.content !== 'string') {
                        console.warn('Skipping tab with invalid content:', tab);
                        return false;
                    }
                    return true;
                });
                
                // Warn if we're losing tabs due to validation
                if (validTabs.length !== state.tabs.length) {
                    const lostCount = state.tabs.length - validTabs.length;
                    console.warn(`Warning: ${lostCount} invalid tabs were not saved`);
                    ui.showStatus(`Warning: ${lostCount} invalid tabs not saved`);
                }
                
                const tabsData = {
                    tabs: validTabs,
                    nextTabId: state.nextTabId || 1
                };
                const dataString = JSON.stringify(tabsData);
                
                // Check if data is too large (basic check)
                if (dataString.length > 5000000) { // ~5MB limit
                    ui.showStatus('Content too large to save');
                    return;
                }
                
                // Verify JSON can be parsed back (corruption check)
                try {
                    JSON.parse(dataString);
                } catch (jsonError) {
                    throw new Error('Generated JSON is invalid: ' + jsonError.message);
                }
                
                localStorage.setItem(STORAGE_KEYS.TABS, dataString);
                
                // Verify the save actually worked
                const verification = localStorage.getItem(STORAGE_KEYS.TABS);
                if (!verification || verification !== dataString) {
                    throw new Error('Save verification failed - data not persisted correctly');
                }
                
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
                        log.error('Failed to save even truncated data:', secondError);
                        ui.showStatus('Failed to save');
                    }
                } else {
                    log.error('Error saving tabs:', error);
                    ui.showStatus('Error saving: ' + (error.message || 'Unknown error'));
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
                    try {
                        const tabsData = JSON.parse(tabsJson);
                        
                        // Validate the loaded data structure
                        if (!tabsData || typeof tabsData !== 'object') {
                            throw new Error('Invalid tabs data structure');
                        }
                        
                        // Ensure tabs is an array
                        if (!Array.isArray(tabsData.tabs)) {
                            throw new Error('Tabs data is not an array');
                        }
                        
                        // Validate each tab
                        const validTabs = tabsData.tabs.filter(tab => {
                            if (!tab || typeof tab !== 'object') return false;
                            if (typeof tab.id !== 'number') return false;
                            if (typeof tab.title !== 'string') return false;
                            if (typeof tab.content !== 'string') return false;
                            return true;
                        });
                        
                        // If we lost tabs due to corruption, warn the user
                        if (validTabs.length !== tabsData.tabs.length) {
                            const lostCount = tabsData.tabs.length - validTabs.length;
                            console.warn(`Recovered from data corruption: ${lostCount} tabs could not be loaded`);
                            ui.showStatus(`Warning: ${lostCount} corrupted tabs were skipped`);
                        }
                        
                        state.tabs = validTabs;
                        state.nextTabId = typeof tabsData.nextTabId === 'number' ? tabsData.nextTabId : 1;
                        
                        // Use log utility for development-only logging
                        log.info('Loaded tabs data:', { 
                            tabCount: state.tabs.length,
                            nextTabId: state.nextTabId
                        });
                        
                        if (log.isDev()) {
                            state.tabs.forEach((tab, i) => {
                                log.info(`Tab ${i+1}:`, {
                                    id: tab.id,
                                    title: tab.title,
                                    contentLength: tab.content ? tab.content.length : 0,
                                    isAutoTitle: tab.isAutoTitle
                                });
                            });
                        }
                        
                        // Ensure all tabs have required properties (for backward compatibility)
                        state.tabs.forEach(tab => {
                            if (tab.isAutoTitle === undefined) {
                                tab.isAutoTitle = tab.title === 'Untitled' || tab.title.startsWith('Document ');
                            }
                            if (tab.spellcheck === undefined) {
                                // Use legacy global setting or default to true
                                tab.spellcheck = legacySpellcheck !== null ? legacySpellcheck === 'true' : true;
                            }
                            if (tab.countMode === undefined) {
                                // Use legacy global setting or default to characters
                                const legacyCountMode = localStorage.getItem(STORAGE_KEYS.COUNT_MODE);
                                tab.countMode = legacyCountMode || COUNT_MODES.CHARACTERS;
                            }
                            // Clear any animation flags that might be persisted
                            tab.isOpening = false;
                            
                            // Ensure tab has content (defensive programming)
                            if (tab.content === undefined) {
                                tab.content = '';
                            }
                            
                            // Ensure lastModified exists
                            if (!tab.lastModified) {
                                tab.lastModified = Date.now();
                            }
                        });
                        
                        // Migrate legacy content if tabs exist but first tab is empty
                        if (legacyContent && state.tabs.length > 0 && (!state.tabs[0].content || state.tabs[0].content === '')) {
                            state.tabs[0].content = legacyContent;
                            localStorage.removeItem('blank-page-content'); // Clean up
                        }
                    } catch (parseError) {
                        log.error('Error parsing tabs JSON:', parseError);
                        
                        // Try to recover by creating a backup of corrupted data
                        try {
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                            localStorage.setItem(`blank-page-tabs-corrupted-${timestamp}`, tabsJson);
                            console.warn('Corrupted data backed up as: blank-page-tabs-corrupted-' + timestamp);
                        } catch (backupError) {
                            console.error('Could not backup corrupted data:', backupError);
                        }
                        
                        // Fallback to legacy content or create a new tab
                        state.tabs = [];
                        ui.showStatus('Data corruption detected - started fresh');
                    }
                } else if (legacyContent) {
                    // Migrate from legacy single-content format
                    const spellcheckEnabled = legacySpellcheck !== null ? legacySpellcheck === 'true' : true;
                    const legacyCountMode = localStorage.getItem(STORAGE_KEYS.COUNT_MODE) || COUNT_MODES.CHARACTERS;
                    tabManager.createTab('Untitled', legacyContent, false);
                    state.tabs[0].spellcheck = spellcheckEnabled;
                    state.tabs[0].countMode = legacyCountMode;
                    // Clear opening animation for migrated tab
                    state.tabs[0].isOpening = false;
                    localStorage.removeItem('blank-page-content'); // Clean up
                }
                
                // Clean up legacy spellcheck setting
                if (legacySpellcheck !== null) {
                    localStorage.removeItem(STORAGE_KEYS.SPELLCHECK);
                }
                
                // Clean up legacy count mode setting (now stored per-tab)
                if (localStorage.getItem(STORAGE_KEYS.COUNT_MODE) !== null) {
                    localStorage.removeItem(STORAGE_KEYS.COUNT_MODE);
                }
                
                // Create default tab if none exist
                if (state.tabs.length === 0) {
                    tabManager.createTab('Untitled', '', false);
                    // Clear opening animation for default tab
                    state.tabs[0].isOpening = false;
                }
                
                // Load active tab
                const savedActiveTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
                if (savedActiveTab) {
                    const savedTabId = parseInt(savedActiveTab, 10);
                    if (!isNaN(savedTabId)) {
                        const activeTab = state.tabs.find(t => t.id === savedTabId);
                        if (activeTab) {
                            state.activeTabId = activeTab.id;
                        } else {
                            // Active tab ID doesn't exist, clear it
                            localStorage.removeItem(STORAGE_KEYS.ACTIVE_TAB);
                        }
                    } else {
                        // Invalid saved tab ID, clear it
                        localStorage.removeItem(STORAGE_KEYS.ACTIVE_TAB);
                    }
                }
                
                // Fallback to first tab
                if (!state.activeTabId && state.tabs.length > 0) {
                    state.activeTabId = state.tabs[0].id;
                }
                
                tabManager.renderTabs();
                if (state.activeTabId) {
                    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
                    if (activeTab) {
                        elements.page.value = activeTab.content || '';
                        ui.applySpellcheck(activeTab.spellcheck || true);
                        state.countMode = activeTab.countMode || COUNT_MODES.CHARACTERS;
                    }
                }
                
            } catch (error) {
                log.error('Error loading tabs:', error);
                // Create default tab on error
                if (state.tabs.length === 0) {
                    tabManager.createTab('Untitled', '', false);
                    state.activeTabId = state.tabs[0].id;
                    // Clear opening animation for error recovery tab
                    state.tabs[0].isOpening = false;
                    tabManager.renderTabs();
                    elements.page.value = '';
                    ui.applySpellcheck(true);
                }
                ui.showStatus('Error loading data - started fresh');
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
                // Don't save immediately here to avoid excessive localStorage writes
                // Saving will be handled by the periodic save in handleInput
            }
        },
        
        // Backup management functions
        createBackup: () => {
            try {
                if (state.activeTabId) {
                    // Save current content first
                    tabManager.saveCurrentTabContent();
                }
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupKey = `blank-page-backup-${timestamp}`;
                const tabsData = {
                    tabs: state.tabs,
                    nextTabId: state.nextTabId,
                    activeTabId: state.activeTabId,
                    timestamp: Date.now()
                };
                
                localStorage.setItem(backupKey, JSON.stringify(tabsData));
                log.info('Created backup:', backupKey);
                
                // Clean up old backups (keep only last 5)
                tabManager.cleanupBackups();
            } catch (error) {
                log.error('Error creating backup:', error);
            }
        },
        
        cleanupBackups: () => {
            try {
                const allKeys = Object.keys(localStorage);
                const backupKeys = allKeys
                    .filter(key => key.startsWith('blank-page-backup-'))
                    .sort()
                    .reverse(); // Most recent first
                
                // Keep only the 5 most recent backups
                const keysToDelete = backupKeys.slice(5);
                keysToDelete.forEach(key => {
                    localStorage.removeItem(key);
                    log.info('Removed old backup:', key);
                });
            } catch (error) {
                log.error('Error cleaning up backups:', error);
            }
        },
        
        startPeriodicBackups: () => {
            // Clear any existing interval
            if (state.backupInterval) {
                clearInterval(state.backupInterval);
            }
            
            // Create backup every 10 minutes if there have been changes
            state.backupInterval = setInterval(() => {
                if (state.contentModified || state.tabs.some(tab => tab.lastModified > Date.now() - 600000)) {
                    tabManager.createBackup();
                }
            }, 600000); // 10 minutes
        },
        
        stopPeriodicBackups: () => {
            if (state.backupInterval) {
                clearInterval(state.backupInterval);
                state.backupInterval = null;
            }
        }
    };
    
    // Helper functions for import/export (moved inside IIFE)
    const helpers = {
        downloadFile: (blob, fileName) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        },
        
        loadJSZipLibrary: async () => {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                script.integrity = 'sha512-XMVd28F1oH/O71fzwBnV7HucLxVwtxf26XV8P4wPk26EDxuGZ91N8bsOttmnomcCD3CS5ZMRL50H0GgOHvegtg==';
                script.crossOrigin = 'anonymous';
                script.referrerPolicy = 'no-referrer';
                script.onload = () => resolve();
                script.onerror = () => {
                    reject(new Error('Failed to load JSZip library'));
                    ui.showStatus('Error loading zip library');
                };
                document.head.appendChild(script);
            });
        },
        
        importZipFile: async (file) => {
            // Dynamically load JSZip library
            if (typeof JSZip === 'undefined') {
                await helpers.loadJSZipLibrary();
            }
            
            try {
                const zip = new JSZip();
                const contents = await zip.loadAsync(file);
                let importCount = 0;
                
                // Process each file in the zip
                const filePromises = [];
                contents.forEach((relativePath, zipEntry) => {
                    if (!zipEntry.dir && relativePath.endsWith('.txt')) {
                        const promise = zipEntry.async('string').then(content => {
                            const fileName = relativePath.split('/').pop().replace('.txt', '');
                            tabManager.createTab(fileName, content, importCount === 0);
                            importCount++;
                        });
                        filePromises.push(promise);
                    }
                });
                
                await Promise.all(filePromises);
                ui.showStatus(`Imported ${importCount} tabs`);
            } catch (error) {
                console.error('Error importing zip file:', error);
                ui.showStatus('Error importing zip file');
            }
        },
        
        exportTabsAsZip: async () => {
            // Dynamically load JSZip library
            if (typeof JSZip === 'undefined') {
                await helpers.loadJSZipLibrary();
            }
            
            try {
                const zip = new JSZip();
                
                // Add each tab as a text file
                state.tabs.forEach(tab => {
                    const fileName = `${tab.title}.txt`;
                    zip.file(fileName, tab.content);
                });
                
                // Generate the zip file
                const blob = await zip.generateAsync({ type: 'blob' });
                const fileName = 'blank-page-tabs.zip';
                
                // Download the zip file
                helpers.downloadFile(blob, fileName);
                ui.showStatus(`Exported ${state.tabs.length} tabs as zip`);
            } catch (error) {
                console.error('Error exporting zip file:', error);
                ui.showStatus('Error exporting zip file');
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
        handleInput: () => {
            // Don't process input during tab operations to prevent race conditions
            if (state.isProcessingTabOperation) {
                log.info('Ignoring input event during tab operation');
                return;
            }
            
            // Ensure we have an active tab before processing input
            if (!state.activeTabId) {
                return;
            }
            
            // Verify the active tab still exists in our tabs array
            const activeTab = state.tabs.find(t => t.id === state.activeTabId);
            if (!activeTab) {
                console.warn('Active tab not found in tabs array, skipping input handling');
                return;
            }
            
            // Mark content as modified
            state.contentModified = true;
            
            ui.showStatus('Saving...');
            app.updateCount();
            
            // Update tab title based on first line if it's auto-titled
            tabManager.updateTabTitle();
            
            if (state.saveTimeout) {
                clearTimeout(state.saveTimeout);
            }
            
            // Save after 1 second of inactivity
            state.saveTimeout = setTimeout(() => {
                app.saveContent();
                
                // Add a backup save to ensure content is persisted even if the first save attempt fails
                setTimeout(() => {
                    // Verify content was saved by checking localStorage
                    try {
                        const tabsJson = localStorage.getItem(STORAGE_KEYS.TABS);
                        if (!tabsJson) {
                            // If tabs aren't in localStorage, try saving again
                            console.warn('Backup save triggered - no tabs data found in localStorage');
                            tabManager.saveCurrentTabContent();
                            tabManager.saveTabs();
                        }
                    } catch (error) {
                        console.error('Error in backup save verification:', error);
                    }
                }, 500);
            }, 1000);
        },
        
        saveContent: () => {
            try {
                // Save current tab content first
                if (state.activeTabId) {
                    const beforeContent = state.tabs.find(t => t.id === state.activeTabId)?.content;
                    const currentContent = elements.page.value;
                    
                    // Only save if content has actually changed
                    if (beforeContent !== currentContent || state.contentModified) {
                        tabManager.saveCurrentTabContent();
                        state.contentModified = false; // Reset modification flag after saving
                        ui.showStatus('Saved');
                    } else {
                        // If content is unchanged, just update the status without saving
                        ui.showStatus('No changes to save');
                    }
                } else {
                    ui.showStatus('No active tab to save');
                }
            } catch (error) {
                console.error('Error saving content:', error);
                ui.showStatus('Error saving: ' + (error.message || 'Unknown error'));
            }
        },
        
        updateCount: () => {
            const text = elements.page.value || '';
            const selectionStart = elements.page.selectionStart;
            const selectionEnd = elements.page.selectionEnd;
            const hasSelection = selectionStart !== selectionEnd;
            
            elements.countDisplay.classList.toggle('highlighted', hasSelection);
            
            const textToCount = hasSelection ? text.substring(selectionStart, selectionEnd) : text;
            
            let countText;
            if (state.countMode === COUNT_MODES.CHARACTERS) {
                countText = `${textToCount.length} characters`;
            } else {
                const wordCount = textToCount.trim() === '' ? 0 : textToCount.trim().split(/\s+/).length;
                countText = `${wordCount} words`;
            }
            
            // Early return check - only if nothing meaningful has changed
            const currentHighlighted = elements.countDisplay.classList.contains('highlighted');
            if (currentHighlighted === hasSelection && 
                !hasSelection && 
                state.lastTextLength === text.length && 
                state.lastDisplayedCountText === countText) {
                return;
            }
            
            // Update DOM
            elements.countDisplay.textContent = countText;
            
            // Update caches
            state.lastTextLength = text.length;
            state.lastDisplayedCountText = countText;
            
            const newTitle = hasSelection 
                ? "Counting selected text" 
                : "Click to toggle between characters/words count";
            
            // Only update title if it changed
            if (elements.countDisplay.title !== newTitle) {
                elements.countDisplay.title = newTitle;
            }
            
            // Only update aria-label if it changed
            const newAriaLabel = `${hasSelection ? 'Selected text: ' : ''}${countText}`;
            if (elements.countDisplay.getAttribute('aria-label') !== newAriaLabel) {
                elements.countDisplay.setAttribute('aria-label', newAriaLabel);
            }
        },
        
        toggleCountMode: () => {
            if (!state.activeTabId) return;
            
            const tab = state.tabs.find(t => t.id === state.activeTabId);
            if (!tab) return;
            
            // Toggle the count mode
            const newCountMode = state.countMode === COUNT_MODES.CHARACTERS 
                ? COUNT_MODES.WORDS 
                : COUNT_MODES.CHARACTERS;
            
            // Update both the tab and global state
            tab.countMode = newCountMode;
            state.countMode = newCountMode;
            tab.lastModified = Date.now();
            
            try {
                tabManager.saveTabs(); // Save tabs with updated count mode setting
                app.updateCount(); // Force update of the display
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
                            log.info('ServiceWorker registration successful with scope: ', registration.scope);
                        })
                        .catch(error => {
                            log.error('ServiceWorker registration failed: ', error);
                        });
                });
            }
        },
        
        loadSettings: () => {
            try {
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
                
                // Note: Count mode is now stored per-tab, not globally
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
                // Add subtle click animation
                elements.addTabButton.style.transform = 'scale(0.96)';
                elements.addTabButton.style.transitionDuration = '0.15s';
                
                setTimeout(() => {
                    elements.addTabButton.style.transform = '';
                    elements.addTabButton.style.transitionDuration = '';
                    
                    // Create new tab with auto-generated title
                    tabManager.createTab('Untitled');
                }, 150);
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
                
                const darkModeHandler = (e) => {
                    if (state.displayMode === DISPLAY_MODES.AUTO) {
                        document.body.classList.toggle('dark-mode', e.matches);
                    }
                };
                
                // Use addEventListener for all browsers (backwards compatibility handled internally)
                try {
                    darkModeMediaQuery.addEventListener('change', darkModeHandler);
                } catch (error) {
                    // Fallback for older browsers
                    console.warn('MediaQueryList.addEventListener not supported');
                    darkModeMediaQuery.addListener(darkModeHandler);
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
            window.addEventListener('beforeunload', (e) => {
                // Don't show confirmation if there's no active tab
                if (!state.activeTabId) return;
                
                // Stop periodic backups
                tabManager.stopPeriodicBackups();
                
                // Force immediate save of any pending content
                if (state.saveTimeout) {
                    clearTimeout(state.saveTimeout);
                    state.saveTimeout = null;
                }
                
                try {
                    // Get current content
                    const currentContent = elements.page.value;
                    
                    // Get the tab's stored content before saving
                    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
                    const storedContent = activeTab ? activeTab.content : '';
                    
                    // Check if there are unsaved changes
                    const hasUnsavedChanges = currentContent !== storedContent || state.contentModified;
                    
                    // If there are changes, save them
                    if (hasUnsavedChanges) {
                        // Save current tab content
                        tabManager.saveCurrentTabContent();
                        
                        // Save tabs to localStorage
                        tabManager.saveTabs();
                        
                        // Create final backup before unload
                        tabManager.createBackup();
                        
                        // Log content saving in development mode
                        log.info('Saved content before unload:', 
                            currentContent.length > 100 ? 
                            currentContent.substring(0, 100) + '...' : 
                            currentContent);
                        
                        // Reset modification flag after saving
                        state.contentModified = false;
                    }
                } catch (error) {
                    console.error('Error saving before unload:', error);
                    // Don't block the page unload, but log the error
                }
            });
            
            // More dropdown toggle
            elements.moreButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event from bubbling to document
                elements.moreDropdown.classList.toggle('show');
                elements.moreButton.setAttribute('aria-expanded', elements.moreDropdown.classList.contains('show'));
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!elements.moreButton.contains(e.target) && !elements.moreDropdown.contains(e.target)) {
                    elements.moreDropdown.classList.remove('show');
                    elements.moreButton.setAttribute('aria-expanded', 'false');
                }
            });
            
            // Clear all tabs
            elements.clearAllButton.addEventListener('click', () => {
                // Save current content before showing confirmation
                if (state.activeTabId) {
                    tabManager.saveCurrentTabContent();
                }
                
                // Check if there's any content to lose
                const hasContent = state.tabs.some(tab => tab.content.trim() !== '');
                
                let confirmMessage = 'Are you sure you want to clear all tabs?';
                if (hasContent) {
                    confirmMessage = 'Are you sure you want to clear all tabs? This will permanently delete all your content and cannot be undone.';
                }
                
                const confirmClear = confirm(confirmMessage);
                if (confirmClear) {
                    // Set processing flag to prevent input events during clearing
                    state.isProcessingTabOperation = true;
                    
                    // Remove all existing tabs
                    state.tabs = [];
                    
                    // Create a new empty tab
                    tabManager.createTab('Untitled', '', true);
                    
                    // Update UI
                    ui.showStatus('All tabs cleared');
                    elements.moreDropdown.classList.remove('show');
                    elements.moreButton.setAttribute('aria-expanded', 'false');
                    
                    // Clear the processing flag
                    state.isProcessingTabOperation = false;
                }
            });
            
            // Import file
            elements.importButton.addEventListener('click', () => {
                // Create an invisible file input
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.txt,.zip';
                fileInput.style.display = 'none';
                
                // Handle file selection
                const handleFileSelection = (e) => {
                    const file = e.target.files[0];
                    if (!file) {
                        fileInput.remove();
                        return;
                    }
                    
                    if (file.name.endsWith('.txt')) {
                        // Import single text file
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const content = e.target.result;
                            const fileName = file.name.replace('.txt', '');
                            tabManager.createTab(fileName, content, true);
                            ui.showStatus(`Imported "${fileName}"`);
                        };
                        reader.readAsText(file);
                    } else if (file.name.endsWith('.zip')) {
                        // Import zip file (multiple tabs)
                        helpers.importZipFile(file);
                    }
                    
                    // Clean up
                    fileInput.remove();
                    elements.moreDropdown.classList.remove('show');
                    elements.moreButton.setAttribute('aria-expanded', 'false');
                };
                
                fileInput.addEventListener('change', handleFileSelection);
                document.body.appendChild(fileInput);
                
                // Trigger the file selection dialog
                fileInput.click();
            });
            
            // Export file(s)
            elements.exportButton.addEventListener('click', () => {
                // Save current tab content before exporting
                tabManager.saveCurrentTabContent();
                
                if (state.tabs.length === 1) {
                    // Export single tab as text file
                    const tab = state.tabs[0];
                    const fileName = `${tab.title}.txt`;
                    const blob = new Blob([tab.content], { type: 'text/plain' });
                    
                    // Create download link
                    helpers.downloadFile(blob, fileName);
                    ui.showStatus(`Exported "${fileName}"`);
                } else {
                    // Export multiple tabs as zip file
                    helpers.exportTabsAsZip();
                }
                
                elements.moreDropdown.classList.remove('show');
                elements.moreButton.setAttribute('aria-expanded', 'false');
            });
            
            // PWA install button
            elements.installButton.addEventListener('click', app.installApp);
            elements.closePromptButton.addEventListener('click', app.closeInstallPrompt);
        },
        
        init: () => {
            try {
                app.loadSettings();
                tabManager.loadTabs();
                
                // Ensure active tab content is immediately set in the editor
                if (state.activeTabId) {
                    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
                    if (activeTab) {
                        elements.page.value = activeTab.content;
                        
                        // Apply tab-specific spellcheck setting
                        ui.applySpellcheck(activeTab.spellcheck || true);
                        
                        // Mark content as not modified since we just loaded it
                        state.contentModified = false;
                    }
                    
                    // Don't save immediately after loading - this could overwrite correct data
                    // Only save if the user actually makes changes
                }
                
                // Call setup event listeners explicitly
                app.setupEventListeners();
                app.setupPWA();
                
                // Start periodic backups for data protection
                tabManager.startPeriodicBackups();
                
                // Create initial backup after successful load
                setTimeout(() => {
                    tabManager.createBackup();
                }, 2000);
                
            } catch (error) {
                log.error('Error initializing app:', error);
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
                    
                    // Still try to start backups even in fallback mode
                    tabManager.startPeriodicBackups();
                } catch (fallbackError) {
                    log.error('Critical error in app initialization:', fallbackError);
                }
            }
        }
    };
    
    // Initialize the application
    app.init();
})(); 