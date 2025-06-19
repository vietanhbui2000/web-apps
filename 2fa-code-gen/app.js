// Constants
const TOTP_INTERVAL = 30; // seconds
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// State management
let accounts = [];
let editingIndex = -1;
let activeButton = null; // Track currently active button
let deletingIndex = -1;
let isSearchActive = false; // Track search state

// Timing state - sync once at startup, then use internal timing
let startupTime = 0; // Unix timestamp when app started
let startupTimeLeft = 0; // Time left in TOTP period when app started
let internalTimer = null; // Main timer interval
let lastTimeLeft = -1; // Track previous time left for reset detection

// Page visibility state management
let isPageVisible = true;
let wasHiddenTime = 0; // When the page was hidden

// DOM element cache
const elements = {};

// Simple tooltip texts
const tooltipTexts = {
    edit: "Edit",
    delete: "Delete",
    copy: "Click to copy"
};

// Add deleted accounts array for undo functionality
let deletedAccounts = [];

// Initialize DOM cache
function initializeElements() {
    elements.codesContainer = document.getElementById('codesContainer');
    elements.searchInput = document.getElementById('searchInput');
    elements.countdownTimer = document.getElementById('countdownTimer');
    elements.miniCountdownTimer = document.getElementById('miniCountdownTimer');
    elements.progressBar = document.querySelector('.timer-progress-bar');
    elements.circleProgress = document.querySelector('.timer-circle-progress');
    elements.timerSearchContainer = document.querySelector('.timer-search-container');
    elements.searchArea = document.querySelector('.search-area');
    elements.addAccountForm = document.getElementById('addAccountForm');
    elements.toggleAddAccount = document.getElementById('toggleAddAccount');
    
    // Form elements
    elements.accountName = document.getElementById('accountName');
    elements.secretKey = document.getElementById('secretKey');
    elements.editAccountName = document.getElementById('editAccountName');
    elements.editSecretKey = document.getElementById('editSecretKey');
    elements.importText = document.getElementById('importText');
    elements.exportText = document.getElementById('exportText');
    
    // Dialog elements
    elements.importDialog = document.getElementById('importDialog');
    elements.exportDialog = document.getElementById('exportDialog');
    elements.editDialog = document.getElementById('editDialog');
    elements.deleteDialog = document.getElementById('deleteDialog');
    elements.confirmDialog = document.getElementById('confirmDialog');
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM cache
    initializeElements();
    
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    }

    // Load accounts from local storage
    loadAccounts();

    // Initialize timing system - sync once at startup
    initializeTiming();

    // Setup page visibility handling for hibernation/wake
    setupPageVisibilityHandling();

    // Attach event listeners
    setupEventListeners();
});

// Initialize timing system - sync once at startup, then use internal timing
function initializeTiming() {
    try {
        // Get current time and calculate position in TOTP cycle
        const now = Math.floor(Date.now() / 1000);
        startupTime = now;
        startupTimeLeft = TOTP_INTERVAL - (now % TOTP_INTERVAL);
        
        console.log(`Timing initialized - Current time: ${now}, Time left in cycle: ${startupTimeLeft}s`);
        
        // Update display immediately
        updateTimersDisplay();
        
        // Generate initial codes
        updateAllCodes();
        
        // Start internal timer only if page is visible
        startTimerIfVisible();
        
    } catch (error) {
        console.error('Failed to initialize timing system:', error);
        showToast('Error: Failed to initialize timing. Please refresh the page.', 'error', 5000);
    }
}

// Start timer only if page is currently visible
function startTimerIfVisible() {
    // Clear any existing timer
    if (internalTimer) {
        clearInterval(internalTimer);
        internalTimer = null;
    }
    
    // Only start timer if page is visible
    if (isPageVisible) {
        internalTimer = setInterval(updateTimersDisplay, 100);
        console.log('Timer started - page is visible');
    } else {
        console.log('Timer not started - page is hidden');
    }
}

// Pause the app when page becomes hidden
function pauseApp() {
    console.log('App pausing - page hidden');
    
    // Stop the timer
    if (internalTimer) {
        clearInterval(internalTimer);
        internalTimer = null;
    }
    
    // Record when we went hidden
    wasHiddenTime = Date.now();
    isPageVisible = false;
}

// Resume the app when page becomes visible
function resumeApp() {
    console.log('App resuming - page visible');
    
    isPageVisible = true;
    
    // Calculate how long we were hidden
    const hiddenDuration = wasHiddenTime ? (Date.now() - wasHiddenTime) / 1000 : 0;
    console.log(`Was hidden for ${hiddenDuration.toFixed(1)} seconds`);
    
    // If we were hidden for more than 1 second, resync timing
    // This handles cases where system was suspended or significant time passed
    if (hiddenDuration > 1) {
        console.log('Resyncing timing after being hidden');
        showToast('Resyncing time...', 'info', 1500);
        initializeTiming();
    } else {
        // Just restart the timer if it was a brief hide
        startTimerIfVisible();
    }
    
    wasHiddenTime = 0;
}

// Setup Page Visibility API handling
function setupPageVisibilityHandling() {
    // Check if Page Visibility API is supported
    if (typeof document.visibilityState === 'undefined') {
        console.warn('Page Visibility API not supported - hibernation disabled');
        return;
    }
    
    // Set initial visibility state
    isPageVisible = !document.hidden;
    console.log(`Initial page visibility: ${isPageVisible ? 'visible' : 'hidden'}`);
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Page became hidden (tab switched, window minimized, etc.)
            pauseApp();
        } else {
            // Page became visible again
            resumeApp();
        }
    });
    
    // Also handle window focus/blur as fallback for older browsers
    window.addEventListener('blur', () => {
        if (isPageVisible) {
            console.log('Window lost focus');
            // Don't pause on blur alone, but log it
        }
    });
    
    window.addEventListener('focus', () => {
        if (!isPageVisible) {
            console.log('Window gained focus while page was hidden');
            // This will trigger when user comes back to a hidden tab
        }
    });
    
    console.log('Page visibility handling initialized');
}

// Calculate current time left based on startup time and internal counting
function getCurrentTimeLeft() {
    const elapsedSinceStartup = Math.floor((Date.now() - (startupTime * 1000)) / 1000);
    const totalElapsed = elapsedSinceStartup;
    const currentTimeLeft = (startupTimeLeft - totalElapsed) % TOTP_INTERVAL;
    
    // Handle negative values (cycle completed)
    return currentTimeLeft <= 0 ? TOTP_INTERVAL + currentTimeLeft : currentTimeLeft;
}

// Check if we need to resync (detect system suspension/major time changes)
function needsResync() {
    const expectedTime = startupTime + Math.floor((Date.now() - (startupTime * 1000)) / 1000);
    const actualTime = Math.floor(Date.now() / 1000);
    const drift = Math.abs(actualTime - expectedTime);
    
    // If drift is more than 5 seconds, we probably need to resync
    return drift > 5;
}

// Base32 decode function
function base32ToHex(base32) {
    let bits = '';
    // Clean input by removing spaces and converting to uppercase
    base32 = base32.replace(/\s+/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
    
    // Return empty if input is too short or invalid after cleaning
    if (base32.length < 8) {
        return '';
    }
    
    for (let i = 0; i < base32.length; i++) {
        const val = BASE32_CHARS.indexOf(base32[i]);
        if (val === -1) return ''; // Return empty string for invalid characters
        bits += val.toString(2).padStart(5, '0');
    }

    // Make sure the length is a multiple of 8
    bits = bits.slice(0, Math.floor(bits.length / 8) * 8);
    
    // Convert to hex
    let hex = '';
    for (let i = 0; i < bits.length; i += 8) {
        const chunk = bits.substr(i, 8);
        hex += parseInt(chunk, 2).toString(16).padStart(2, '0');
    }
    return hex;
}

// Generate TOTP code
function generateTOTP(secret) {
    try {
        // Check if CryptoJS is available
        if (typeof CryptoJS === 'undefined') {
            console.error('CryptoJS library not loaded');
            showToast('Error: Cryptography library failed to load. Please refresh the page.', 'error', 5000);
            return '------';
        }
        
        // Get current time period (use actual current time for TOTP calculation)
        const epoch = Math.floor(Date.now() / 1000);
        const time = Math.floor(epoch / TOTP_INTERVAL);
        
        // Convert time to hex
        const timeHex = time.toString(16).padStart(16, '0');
        
        // Convert secret from base32 to hex
        const secretHex = base32ToHex(secret);
        if (!secretHex) {
            console.warn('Invalid or empty secret key for TOTP generation');
            return '------';
        }
        
        // Calculate HMAC
        const hmac = CryptoJS.HmacSHA1(
            CryptoJS.enc.Hex.parse(timeHex),
            CryptoJS.enc.Hex.parse(secretHex)
        );
        
        const hmacHex = hmac.toString();
        
        // Get offset
        const offset = parseInt(hmacHex.slice(-1), 16);
        
        // Generate 4-byte code starting at offset
        const codeHex = hmacHex.substr(offset * 2, 8);
        let code = parseInt(codeHex, 16) & 0x7fffffff;
        
        // Get 6-digit code
        return (code % 1000000).toString().padStart(6, '0');
    } catch (error) {
        console.error('Error generating TOTP:', error);
        showToast('Code generation failed. Please refresh the page.', 'error', 3000);
        return '------';
    }
}

// Local storage operations
function loadAccounts() {
    try {
        const saved = localStorage.getItem('totpAccounts');
        accounts = saved ? JSON.parse(saved) : [];
        updateAccountsDisplay();
        updateAllCodes();
    } catch (error) {
        console.error('Error loading accounts:', error);
        showToast('Failed to load accounts', 'error', 3000);
        accounts = [];
        updateAccountsDisplay();
    }
}

// Save accounts to localStorage
function saveAccounts() {
    try {
        localStorage.setItem('totpAccounts', JSON.stringify(accounts));
        showToast('Changes saved', 'success', 2000);
    } catch (error) {
        showToast('Failed to save changes', 'error', 3000);
        console.error('Save error:', error);
    }
}

// Validation functions
function validateSecretKey(secret) {
    if (!secret || typeof secret !== 'string') return false;
    
    // Quick validation before generating code
    const cleanedSecret = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
    if (cleanedSecret.length < 8) return false; // Too short to be valid
    
    try {
        const testCode = generateTOTP(secret);
        return testCode !== '------';
    } catch {
        return false;
    }
}

function validateAccountName(name) {
    // Only restrict characters that could cause issues with HTML/JavaScript
    return name.length >= 1 && 
           name.length <= 50 && 
           !/<[^>]*>/.test(name) && // Prevent HTML tags
           !/[\|\\\n\r]/.test(name); // Prevent characters that could break import/export
}

function validateAccountInput(name, secret, excludeIndex = -1) {
    if (!name) {
        return { valid: false, message: 'Please enter an account name', field: 'name' };
    }
    
    if (!validateAccountName(name)) {
        if (name.length < 1 || name.length > 50) {
            return { valid: false, message: 'Account name must be between 1 and 50 characters', field: 'name' };
        } else if (/<[^>]*>/.test(name)) {
            return { valid: false, message: 'Account name cannot contain HTML tags', field: 'name' };
        } else if (/[\|\\\n\r]/.test(name)) {
            return { valid: false, message: 'Account name cannot contain | \\ or line breaks', field: 'name' };
        }
    }
    
    if (!secret) {
        return { valid: false, message: 'Please enter a secret key', field: 'secret' };
    }
    
    if (!validateSecretKey(secret)) {
        return { valid: false, message: 'Invalid secret key format', field: 'secret' };
    }
    
    const duplicateIndex = accounts.findIndex(acc => acc.name === name);
    if (duplicateIndex !== -1 && duplicateIndex !== excludeIndex) {
        return { valid: false, message: 'An account with this name already exists', field: 'name' };
    }
    
    return { valid: true };
}

async function addAccount() {
    const name = elements.accountName.value.trim();
    const secret = elements.secretKey.value.trim();
    
    const validation = validateAccountInput(name, secret);
    if (!validation.valid) {
        showToast(validation.message, 'error', 3000);
        if (validation.field === 'name') {
            elements.accountName.focus();
        } else {
            elements.secretKey.focus();
        }
        return;
    }

    accounts.push({ name, secret });
    saveAccounts();
    updateAccountsDisplay();
    updateAllCodes();
    
    // Reset form and hide it
    elements.accountName.value = '';
    elements.secretKey.value = '';
    hideAddAccountForm();
}

function deleteAccount(index) {
    const account = accounts[index];
    if (!account) return;
    
    // Store deleted account for possible undo
    deletedAccounts.push({ index, account });
    
    // Remove the account
    accounts.splice(index, 1);
    saveAccounts();
    updateAccountsDisplay();
    updateAllCodes(); // Update codes immediately after deletion
    
    // Show toast with undo option
    showUndoToast('Account deleted', undoDelete);
}

function undoDelete() {
    if (deletedAccounts.length === 0) return;
    
    const { index, account } = deletedAccounts.pop();
    
    // Restore the account to its original position if possible
    if (index <= accounts.length) {
        accounts.splice(index, 0, account);
    } else {
        accounts.push(account);
    }
    
    saveAccounts();
    updateAccountsDisplay();
    updateAllCodes();
    
    showToast('Account restored', 'success', 3000);
}

function editAccount(index) {
    if (index >= 0 && index < accounts.length) {
        const account = accounts[index];
        editingIndex = index;
        
        elements.editAccountName.value = account.name;
        elements.editSecretKey.value = account.secret;
        document.querySelector('.input-group').classList.remove('error');
        
        showEditDialog();
    }
}

function saveEditAccount() {
    if (editingIndex < 0 || editingIndex >= accounts.length) {
        hideEditDialog();
        return;
    }
    
    const name = elements.editAccountName.value.trim();
    const secret = elements.editSecretKey.value.trim();
    
    const validation = validateAccountInput(name, secret, editingIndex);
    if (!validation.valid) {
        showToast(validation.message, 'error', 3000);
        if (validation.field === 'name') {
            const nameInputGroup = elements.editAccountName.closest('.input-group');
            nameInputGroup.classList.add('error');
            elements.editAccountName.focus();
        } else {
            elements.editSecretKey.focus();
        }
        return;
    }
    
    // Update account
    accounts[editingIndex].name = name;
    accounts[editingIndex].secret = secret;
    
    saveAccounts();
    updateAccountsDisplay();
    updateAllCodes();
    
    hideEditDialog();
}

function importAccounts() {
    const importText = elements.importText.value.trim();
    if (!importText) {
        showToast('No data to import', 'error', 3000);
        return;
    }
    
    const lines = importText.split('\n');
    let imported = 0;
    let errors = 0;
    
    for (const line of lines) {
        if (!line.trim()) continue;
        
        const parts = line.split('|');
        if (parts.length !== 2) {
            errors++;
            continue;
        }
        
        const name = parts[0].trim();
        const secret = parts[1].trim();
        
        const validation = validateAccountInput(name, secret);
        if (!validation.valid) {
            errors++;
            continue;
        }
        
        accounts.push({ name, secret });
        imported++;
    }
    
    if (imported > 0) {
        saveAccounts();
        updateAccountsDisplay();
        updateAllCodes();
        showToast(`Imported ${imported} accounts`, 'success', 3000);
    } else {
        showToast('No valid accounts to import', 'error', 3000);
    }
    
    if (errors > 0) {
        showToast(`${errors} accounts couldn't be imported`, 'warning', 3000);
    }
    
    hideImportDialog();
}

function filterAccounts() {
    const searchTerm = elements.searchInput.value.trim().toLowerCase();
    const accountElements = document.querySelectorAll('.code-display');
    
    if (searchTerm === '') {
        resetSearchFilter(accountElements);
        return;
    }
    
    accountElements.forEach((el, index) => {
        if (index >= accounts.length) return;
        
        const nameEl = el.querySelector('.account-name');
        const name = accounts[index].name.toLowerCase();
        
        if (name.includes(searchTerm)) {
            el.style.display = 'flex';
            
            // Highlight matching text
            const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            nameEl.innerHTML = accounts[index].name.replace(regex, '<mark>$1</mark>');
        } else {
            el.style.display = 'none';
        }
    });
}

// Reset search filter and clear highlights
function resetSearchFilter(accountElements = null) {
    const elements = accountElements || document.querySelectorAll('.code-display');
    elements.forEach(el => {
        el.style.display = 'flex';
        // Remove any existing highlighting
        const nameEl = el.querySelector('.account-name');
        if (nameEl) {
            nameEl.innerHTML = nameEl.textContent;
        }
    });
}

// UI Functions
function updateAccountsDisplay() {
    const container = elements.codesContainer;
    if (!container) return;
    
    // Clear existing content
    container.innerHTML = '';
    
    // Show message if no accounts
    if (accounts.length === 0) {
        container.innerHTML = '<div class="no-accounts-message">No accounts added yet. Add your first account below.</div>';
        return;
    }
    
    // Create container for all codes
    const codesContainerInner = document.createElement('div');
    codesContainerInner.className = 'codes-container-inner';
    
    // Add each account
    accounts.forEach((account, index) => {
        const codeDisplay = createAccountElement(account, index);
        codesContainerInner.appendChild(codeDisplay);
    });
    
    container.appendChild(codesContainerInner);
    
    // Filter results if there's a search term
    filterAccounts();
}

function createAccountElement(account, index) {
    const codeDisplay = document.createElement('div');
    codeDisplay.className = 'code-display';
    
    const nameContainer = document.createElement('div');
    nameContainer.className = 'account-name-container';
    
    const accountName = document.createElement('p');
    accountName.className = 'account-name';
    accountName.textContent = account.name;
    
    const actionsContainer = createActionsContainer(account, index);
    const codeWrapper = createCodeWrapper(account, index);
    
    nameContainer.appendChild(accountName);
    nameContainer.appendChild(actionsContainer);
    
    codeDisplay.appendChild(nameContainer);
    codeDisplay.appendChild(codeWrapper);
    
    return codeDisplay;
}

function createActionsContainer(account, index) {
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'account-actions';
    
    // Edit button
    const editBtn = createActionButton('edit', account.name, (e) => handleEditClick(e, index));
    const deleteBtn = createActionButton('delete', account.name, (e) => handleDeleteClick(e, index));
    
    actionsContainer.appendChild(editBtn);
    actionsContainer.appendChild(deleteBtn);
    
    return actionsContainer;
}

function createActionButton(type, accountName, handler) {
    const btn = document.createElement('button');
    btn.className = `account-action-btn ${type}`;
    
    const icon = type === 'edit' ? 'fas fa-pen' : 'fas fa-trash-alt';
    btn.innerHTML = `<i class="${icon}" aria-hidden="true"></i>`;
    btn.setAttribute('aria-label', `${tooltipTexts[type]} ${accountName}`);
    btn.addEventListener('click', handler);
    
    const tooltip = document.createElement('span');
    tooltip.className = 'action-tooltip';
    tooltip.textContent = tooltipTexts[type];
    btn.appendChild(tooltip);
    
    return btn;
}

function createCodeWrapper(account, index) {
    const codeWrapper = document.createElement('div');
    codeWrapper.className = 'code-wrapper';
    codeWrapper.id = `code-wrapper-${index}`;
    codeWrapper.setAttribute('role', 'button');
    codeWrapper.setAttribute('tabindex', '0');
    codeWrapper.setAttribute('aria-label', `Copy code for ${account.name}`);
    
    const codeElement = document.createElement('div');
    codeElement.className = 'code loading';
    codeElement.id = `code-${index}`;
    codeElement.textContent = '------';
    
    // Copy indicator (checkmark)
    const copyIndicator = document.createElement('div');
    copyIndicator.className = 'copy-indicator';
    copyIndicator.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i>';
    copyIndicator.setAttribute('aria-hidden', 'true');
    
    // Tooltip for click to copy
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = tooltipTexts.copy;
    tooltip.setAttribute('aria-hidden', 'true');
    
    // Append elements to code wrapper in the correct order
    codeWrapper.appendChild(codeElement);
    codeWrapper.appendChild(copyIndicator);
    codeWrapper.appendChild(tooltip);
    
    // Attach copy event handler
    attachCodeCopyEvents(index, true);
    
    return codeWrapper;
}

function showDeleteDialog() {
    const dialog = elements.deleteDialog;
    
    // Update dialog content with account name
    if (deletingIndex >= 0 && deletingIndex < accounts.length) {
        const accountName = accounts[deletingIndex].name;
        const description = dialog.querySelector('.dialog-description');
        if (description) {
            description.innerHTML = `Are you sure you want to delete <strong>"${accountName}"</strong>?`;
        }
    }
    
    // Close any other open dialogs first (but preserve our active button)
    closeAllDialogs(true);
    
    dialog.classList.add('visible');
    
    // Set focus to the confirm button for keyboard accessibility
    setTimeout(() => {
        const confirmButton = dialog.querySelector('button:first-of-type');
        if (confirmButton) confirmButton.focus();
    }, 100);
}

function hideDeleteDialog() {
    elements.deleteDialog.classList.remove('visible');
    deletingIndex = -1;
    
    // Reset the active delete button
    if (activeButton && activeButton.classList.contains('delete')) {
        activeButton.classList.remove('active');
        activeButton = null;
    }
}

function handleEditClick(event, index) {
    event.stopPropagation(); // Prevent event bubbling
    
    // Reset any previously active button first
    resetActionButtons();
    
    // Keep the edit button visually active
    const editButton = event.currentTarget;
    if (editButton) {
        editButton.classList.add('active');
        // Store reference to the active button
        activeButton = editButton;
    }
    
    editAccount(index);
}

function handleDeleteClick(event, index) {
    event.stopPropagation(); // Prevent event bubbling
    deletingIndex = index;
    
    // Reset any previously active button first
    resetActionButtons();
    
    // Keep the delete button visually active
    const deleteButton = event.currentTarget;
    if (deleteButton) {
        deleteButton.classList.add('active');
        // Store reference to the active button
        activeButton = deleteButton;
    }
    
    showDeleteDialog();
}

function confirmDeleteAccount() {
    if (deletingIndex < 0 || deletingIndex >= accounts.length) {
        hideDeleteDialog();
        return;
    }
    
    // Store deleted account for possible undo
    const account = accounts[deletingIndex];
    deletedAccounts.push({ index: deletingIndex, account });
    
    // Remove the account
    accounts.splice(deletingIndex, 1);
    saveAccounts();
    updateAccountsDisplay();
    updateAllCodes();
    
    // Hide dialog and show toast with undo option
    hideDeleteDialog();
    showUndoToast('Account deleted', undoDelete);
    
    // Reset dialog text back to default
    const description = elements.deleteDialog.querySelector('.dialog-description');
    if (description) {
        description.innerHTML = 'Are you sure you want to delete this account?';
    }
}

function resetActionButtons(preserveActiveButton = false) {
    if (!preserveActiveButton && activeButton) {
        // Reset any active buttons
        if (activeButton.classList.contains('delete')) {
            activeButton.classList.remove('active');
        } else if (activeButton.classList.contains('edit')) {
            activeButton.classList.remove('active');
            const codeDisplay = activeButton.closest('.code-display');
            if (codeDisplay) {
                codeDisplay.classList.remove('active-edit');
            }
        }
        activeButton = null;
    }
}

function resetDeleteButton(button) {
    button.classList.remove('active');
    const tooltip = button.querySelector('.action-tooltip');
    if (tooltip) {
        tooltip.textContent = tooltipTexts.delete;
    }
}

// Update timer display using internal timing (called every 100ms)
function updateTimersDisplay() {
    try {
        // Don't update if page is hidden (shouldn't happen since timer is paused, but safety check)
        if (!isPageVisible) {
            return;
        }
        
        // Check if we need to resync due to system suspension or major drift
        if (needsResync()) {
            console.warn('Time drift detected, reinitializing timing system');
            showToast('Time drift detected - resyncing...', 'warning', 2000);
            initializeTiming();
            return;
        }
        
        // Use internal calculation for current time left
        const timeLeft = Math.floor(getCurrentTimeLeft());
        const preciseTimeLeft = getCurrentTimeLeft(); // With decimals for smooth animation
        const preciseProgress = preciseTimeLeft / TOTP_INTERVAL;

        // Update global timer display
        if (elements.countdownTimer) {
            elements.countdownTimer.textContent = timeLeft;
        }
        
        // Update minimized timer
        if (elements.miniCountdownTimer) {
            elements.miniCountdownTimer.textContent = timeLeft;
        }

        // Update ARIA values for accessibility
        if (elements.progressBar) {
            elements.progressBar.style.setProperty('--progress', preciseProgress);
            elements.progressBar.setAttribute('aria-valuenow', timeLeft);
        }
        
        // Update circle timer progress using the same progress value
        if (elements.circleProgress) {
            // Update ARIA values
            elements.circleProgress.setAttribute('aria-valuenow', timeLeft);
            
            // Detect timer reset (when timeLeft jumps from a low value back to TOTP_INTERVAL)
            if (lastTimeLeft <= 1 && timeLeft >= TOTP_INTERVAL - 1) {
                // Apply reset class for smoother transition
                elements.circleProgress.classList.add('resetting');
                
                // Set to maximum value immediately
                elements.circleProgress.style.setProperty('--progress', 1);
                
                // Remove the class after animation completes
                setTimeout(() => {
                    elements.circleProgress.classList.remove('resetting');
                }, 700);
                
                // Generate new codes when cycle resets
                console.log('TOTP cycle completed, generating new codes');
                updateAllCodes();
            } else {
                // Normal countdown behavior
                elements.circleProgress.style.setProperty('--progress', preciseProgress);
            }
        }
        
        // Store current timeLeft for next comparison
        lastTimeLeft = timeLeft;

    } catch (error) {
        console.error('Error updating timer display:', error);
        showToast('Timer error occurred. Please refresh the page.', 'error', 3000);
    }
}

// Optimized event attachment with proper cleanup
const eventListeners = new Map();

function attachCodeCopyEvents(index, preserveState = false) {
    const wrapper = document.getElementById(`code-wrapper-${index}`);
    if (!wrapper) return;
    
    // Remove existing listeners to prevent memory leaks
    const existingListeners = eventListeners.get(wrapper);
    if (existingListeners) {
        wrapper.removeEventListener('click', existingListeners.click);
        wrapper.removeEventListener('keydown', existingListeners.keydown);
    }
    
    // Create new event handlers
    const clickHandler = () => copyCode(index);
    const keydownHandler = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            copyCode(index);
        }
    };
    
    // Add event listeners
    wrapper.addEventListener('click', clickHandler);
    wrapper.addEventListener('keydown', keydownHandler);
    
    // Store references for cleanup
    eventListeners.set(wrapper, { click: clickHandler, keydown: keydownHandler });
}

function copyCode(index) {
    const codeElement = document.getElementById(`code-${index}`);
    const wrapper = document.getElementById(`code-wrapper-${index}`);
    
    if (!codeElement || !wrapper) return;
    
    // Don't copy if the code is in loading state or not available
    if (codeElement.textContent === '------' || codeElement.classList.contains('loading')) {
        showToast('Code not yet available', 'warning', 3000);
        return;
    }
    
    const codeText = codeElement.textContent;
    
    // Try to use clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(codeText)
            .then(() => {
                showCopySuccess(wrapper, index);
            })
            .catch(err => {
                console.error('Failed to copy:', err);
                fallbackCopy(codeText, wrapper, index);
            });
    } else {
        // Fallback for browsers without clipboard API
        fallbackCopy(codeText, wrapper, index);
    }
}

function showCopySuccess(wrapper, index) {
    // Get account name for accessibility announcement
    const accountName = index < accounts.length ? accounts[index].name : '';
    
    // Remove copied class first in case it's already there
    wrapper.classList.remove('copied');
    
    // Force browser to process the removal before adding it again
    void wrapper.offsetWidth;
    
    // Add copied class to trigger animation
    wrapper.classList.add('copied');
    
    // Update ARIA attributes for accessibility
    wrapper.setAttribute('aria-label', `Code for ${accountName} copied to clipboard`);
    
    // Clear existing timeout
    const timeoutId = wrapper.getAttribute('data-timeout-id');
    if (timeoutId) {
        clearTimeout(parseInt(timeoutId));
    }
    
    const newTimeoutId = setTimeout(() => {
        wrapper.classList.remove('copied');
        wrapper.removeAttribute('data-timeout-id');
        // Restore original ARIA label
        wrapper.setAttribute('aria-label', `Copy code for ${accountName}`);
    }, 2000);
    
    wrapper.setAttribute('data-timeout-id', newTimeoutId);
    
    showToast('Code copied to clipboard', 'success', 2000);
}

function fallbackCopy(text, wrapper, index) {
    try {
        // Create temporary textarea element
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';  // Avoid scrolling to bottom
        textArea.style.opacity = '0';
        textArea.style.left = '-9999px'; // Move off-screen
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        // Execute copy command
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            showCopySuccess(wrapper, index);
        } else {
            showToast('Failed to copy code to clipboard', 'error', 3000);
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showToast('Failed to copy code to clipboard', 'error', 3000);
    }
}

function updateAllCodes() {
    for (let index = 0; index < accounts.length; index++) {
        const code = generateTOTP(accounts[index].secret);
        const codeElement = document.getElementById(`code-${index}`);
        const wrapper = document.getElementById(`code-wrapper-${index}`);
        
        if (codeElement) {
            codeElement.textContent = code;
            codeElement.classList.remove('loading');
            
            // Update ARIA label with new code
            if (wrapper) {
                // Reset copy state when code changes
                if (wrapper.classList.contains('copied')) {
                    wrapper.classList.remove('copied');
                }
                
                // Update ARIA label with new code for screen readers
                wrapper.setAttribute('aria-label', `Copy code for ${accounts[index].name}`);
                
                // Make sure click handler is attached
                attachCodeCopyEvents(index, true);
            }
        }
    }
}

// Dialog Functions
function toggleImportDialog() {
    const dialog = elements.importDialog;
    
    if (dialog.classList.contains('visible')) {
        hideImportDialog();
    } else {
        showImportDialog();
    }
}

function showImportDialog() {
    // Close any other open dialogs first
    closeAllDialogs();
    
    elements.importDialog.classList.add('visible');
    elements.importText.focus();
    
    // Add active state to button
    const importBtn = document.getElementById('importButton');
    if (importBtn) {
        importBtn.classList.add('active');
    }
}

function hideImportDialog() {
    elements.importDialog.classList.remove('visible');
    elements.importText.value = '';
    
    // Remove active state from button
    const importBtn = document.getElementById('importButton');
    if (importBtn) {
        importBtn.classList.remove('active');
    }
}

function toggleExportDialog() {
    const dialog = elements.exportDialog;
    
    if (dialog.classList.contains('visible')) {
        hideExportDialog();
    } else {
        showExportDialog();
    }
}

function showExportDialog() {
    // Close any other open dialogs first
    closeAllDialogs();
    
    const exportText = accounts.map(acc => `${acc.name}|${acc.secret}`).join('\n');
    elements.exportText.value = exportText;
    
    elements.exportDialog.classList.add('visible');
    elements.exportText.select();
    
    // Add active state to button
    const exportBtn = document.getElementById('exportButton');
    if (exportBtn) {
        exportBtn.classList.add('active');
    }
}

function hideExportDialog() {
    elements.exportDialog.classList.remove('visible');
    elements.exportText.value = '';
    
    // Remove active state from button
    const exportBtn = document.getElementById('exportButton');
    if (exportBtn) {
        exportBtn.classList.remove('active');
    }
}

function showEditDialog() {
    // Close any other open dialogs first (but preserve our active button)
    closeAllDialogs(true);
    
    elements.editDialog.classList.add('visible');
    
    // Delay focus to prevent interfering with button states
    setTimeout(() => {
        elements.editAccountName.focus();
    }, 100);
}

function hideEditDialog() {
    elements.editDialog.classList.remove('visible');
    editingIndex = -1;
    
    // Reset the active edit button
    if (activeButton && activeButton.classList.contains('edit')) {
        activeButton.classList.remove('active');
        activeButton = null;
    }
}

function hideConfirmDialog() {
    elements.confirmDialog.classList.remove('visible');
}

function closeAllDialogs(preserveActiveActionButton = false) {
    // Hide all dialogs
    const dialogs = document.querySelectorAll('.dialog-form');
    dialogs.forEach(dialog => {
        dialog.classList.remove('visible');
    });
    
    // Reset all states (but preserve our editing/deleting state if needed)
    if (!preserveActiveActionButton) {
        editingIndex = -1;
        deletingIndex = -1;
    }
    
    // Reset all buttons (but preserve active action button if needed)
    resetActionButtons(preserveActiveActionButton);
    
    // Reset dialog button states
    const importBtn = document.getElementById('importButton');
    const exportBtn = document.getElementById('exportButton');
    
    if (importBtn) {
        importBtn.classList.remove('active');
    }
    if (exportBtn) {
        exportBtn.classList.remove('active');
    }
    
    // Hide add account form
    hideAddAccountForm();
}

function toggleAddAccountForm() {
    const form = elements.addAccountForm;
    const btn = elements.toggleAddAccount;
    
    if (form.classList.contains('visible')) {
        hideAddAccountForm();
    } else {
        // Close any dialogs first
        closeAllDialogs();
        
        // Reset form values
        elements.accountName.value = '';
        elements.secretKey.value = '';
        
        // Show form
        form.classList.add('visible');
        
        // Update icon but preserve the span text
        const icon = btn.querySelector('i');
        icon.className = 'fas fa-times';
        
        btn.classList.add('active');
        
        // Focus on first input
        elements.accountName.focus();
    }
}

function hideAddAccountForm() {
    const form = elements.addAccountForm;
    const btn = elements.toggleAddAccount;
    
    form.classList.remove('visible');
    
    // Update icon but preserve the span text
    const icon = btn.querySelector('i');
    icon.className = 'fas fa-plus';
    
    btn.classList.remove('active');
}

function copyExportText() {
    const textArea = elements.exportText;
    textArea.select();
    
    try {
        // Use modern clipboard API if available
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textArea.value)
                .then(() => {
                    showToast('Export data copied to clipboard', 'success', 2000);
                })
                .catch(err => {
                    console.error('Clipboard API error:', err);
                    fallbackCopyExport(textArea);
                });
        } else {
            fallbackCopyExport(textArea);
        }
    } catch (err) {
        console.error('Copy error:', err);
        fallbackCopyExport(textArea);
    }
}

function fallbackCopyExport(textArea) {
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast('Export data copied to clipboard', 'success', 2000);
        } else {
            showToast('Failed to copy to clipboard', 'error', 3000);
        }
    } catch (err) {
        showToast('Failed to copy to clipboard', 'error', 3000);
        console.error('Fallback copy error:', err);
    }
}

// Toast notification functions
function showToast(message, type = 'info', duration = 5000) {
    // Remove any existing toasts
    hideToast();
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    
    document.body.appendChild(toast);
    
    // Show toast
    requestAnimationFrame(() => {
        toast.classList.add('visible');
    });
    
    // Hide toast after duration
    if (duration > 0) {
        setTimeout(() => {
            hideToast(toast);
        }, duration);
    }
    
    return toast;
}

function hideToast(toastElement = null) {
    const toasts = toastElement ? [toastElement] : document.querySelectorAll('.toast');
    
    toasts.forEach(toast => {
        toast.classList.remove('visible');
        
        // Remove from DOM after animation
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    });
}

function showUndoToast(message, undoCallback) {
    // Create toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');
    
    // Add message
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);
    
    // Add space
    toast.appendChild(document.createTextNode(' '));
    
    // Add undo button
    const undoBtn = document.createElement('a');
    undoBtn.textContent = 'UNDO';
    undoBtn.href = '#';
    undoBtn.setAttribute('role', 'button');
    undoBtn.style.cssText = 'margin-left: 8px; font-weight: bold; text-decoration: none; color: white;';
    
    const handleUndo = (e) => {
        e.preventDefault();
        undoCallback();
        hideToast(toast);
    };
    
    undoBtn.addEventListener('click', handleUndo);
    
    // Add keyboard support for the undo button
    undoBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            undoCallback();
            hideToast(toast);
        }
    });
    
    undoBtn.setAttribute('tabindex', '0');
    
    toast.appendChild(undoBtn);
    
    // Add to document
    document.body.appendChild(toast);
    
    // Show toast
    requestAnimationFrame(() => {
        toast.classList.add('visible');
    });
    
    // Hide toast after 5 seconds (longer than normal toast)
    setTimeout(() => {
        hideToast(toast);
    }, 5000);
}

// Toggle search functionality
function toggleSearch() {
    const container = elements.timerSearchContainer;
    const searchInput = elements.searchInput;
    
    isSearchActive = !isSearchActive;
    
    if (isSearchActive) {
        // Activate search
        container.classList.add('search-active');
        // Focus on search input with slight delay to allow animation
        setTimeout(() => {
            searchInput.focus();
        }, 300);
    } else {
        // Deactivate search
        container.classList.remove('search-active');
        searchInput.value = ''; // Clear search input when closing
        searchInput.blur();
        
        // Reset the search filter
        resetSearchFilter();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Add account button
    elements.toggleAddAccount.addEventListener('click', toggleAddAccountForm);
    
    // Add account form submit
    document.getElementById('addAccountBtn').addEventListener('click', addAccount);
    document.getElementById('cancelAddAccountBtn').addEventListener('click', hideAddAccountForm);
    
    // Edit account buttons
    document.getElementById('saveEditAccountBtn').addEventListener('click', saveEditAccount);
    document.getElementById('cancelEditAccountBtn').addEventListener('click', hideEditDialog);
    
    // Import buttons
    document.getElementById('importButton').addEventListener('click', toggleImportDialog);
    document.getElementById('importAccountsBtn').addEventListener('click', importAccounts);
    document.getElementById('cancelImportBtn').addEventListener('click', hideImportDialog);
    
    // Export buttons
    document.getElementById('exportButton').addEventListener('click', toggleExportDialog);
    document.getElementById('copyExportBtn').addEventListener('click', copyExportText);
    document.getElementById('closeExportBtn').addEventListener('click', hideExportDialog);
    
    // Delete buttons
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDeleteAccount);
    document.getElementById('cancelDeleteBtn').addEventListener('click', hideDeleteDialog);
    
    // Confirm dialog buttons
    document.getElementById('cancelConfirmBtn').addEventListener('click', hideConfirmDialog);
    
    // Search toggle
    document.getElementById('searchToggle').addEventListener('click', toggleSearch);
    
    // Search input
    elements.searchInput.addEventListener('input', filterAccounts);
    
    // Close search when clicking outside
    document.addEventListener('click', (e) => {
        if (isSearchActive) {
            // Check if click is outside search container
            const searchArea = elements.searchArea;
            if (!searchArea.contains(e.target)) {
                toggleSearch();
            }
        }
    });
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape key closes dialogs and search
        if (e.key === 'Escape') {
            closeAllDialogs();
            hideAddAccountForm();
            if (isSearchActive) toggleSearch();
        }
        
        // Enter in add account form
        if (e.key === 'Enter' && elements.addAccountForm.classList.contains('visible')) {
            if (document.activeElement === elements.secretKey || 
                document.activeElement === elements.accountName) {
                addAccount();
            }
        }
        
        // Enter in edit account form
        if (e.key === 'Enter' && elements.editDialog.classList.contains('visible')) {
            if (document.activeElement === elements.editSecretKey || 
                document.activeElement === elements.editAccountName) {
                saveEditAccount();
            }
        }
        
        // Ctrl+F or Cmd+F to open search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            if (!isSearchActive) {
                toggleSearch();
            }
        }
    });
} 