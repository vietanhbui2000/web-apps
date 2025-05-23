// Constants
const TOTP_INTERVAL = 30; // seconds
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// State management
let accounts = [];
let editingIndex = -1;
let activeButton = null; // Track currently active button
let deletingIndex = -1;
let isSearchActive = false; // Track search state
let lastTimeLeft = -1; // Track previous time left for reset detection

// Simple tooltip texts
const tooltipTexts = {
    edit: "Edit",
    delete: "Delete",
    copy: "Double click to copy"
};

// Add deleted accounts array for undo functionality
let deletedAccounts = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
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

    // Set up timer update interval with higher frequency for smoother animation
    setInterval(updateTimers, 100);

    // Attach event listeners
    setupEventListeners();
});

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
            showToast('Error: Cryptography library failed to load', 'error', 3000);
            return '------';
        }
        
        // Get current time period
        const epoch = Math.floor(Date.now() / 1000);
        const time = Math.floor(epoch / TOTP_INTERVAL);
        
        // Convert time to hex
        const timeHex = time.toString(16).padStart(16, '0');
        
        // Convert secret from base32 to hex
        const secretHex = base32ToHex(secret);
        if (!secretHex) return '------'; // Handle empty secret
        
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

// Account management
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

// Update name validation
function validateAccountName(name) {
    // Only restrict characters that could cause issues with HTML/JavaScript
    return name.length >= 1 && 
           name.length <= 50 && 
           !/<[^>]*>/.test(name) && // Prevent HTML tags
           !/[\|\\\n\r]/.test(name); // Prevent characters that could break import/export
}

async function addAccount() {
    const nameInput = document.getElementById('accountName');
    const secretInput = document.getElementById('secretKey');
    const name = nameInput.value.trim();
    const secret = secretInput.value.trim();
    
    // Validate inputs
    let errorMessage = null;
    
    if (!name) {
        errorMessage = 'Please enter an account name';
        nameInput.focus();
    } else if (!validateAccountName(name)) {
        if (name.length < 1 || name.length > 50) {
            errorMessage = 'Account name must be between 1 and 50 characters';
        } else if (/<[^>]*>/.test(name)) {
            errorMessage = 'Account name cannot contain HTML tags';
        } else if (/[\|\\\n\r]/.test(name)) {
            errorMessage = 'Account name cannot contain | \\ or line breaks';
        }
        nameInput.focus();
    } else if (!secret) {
        errorMessage = 'Please enter a secret key';
        secretInput.focus();
    } else if (!validateSecretKey(secret)) {
        errorMessage = 'Invalid secret key format';
        secretInput.focus();
    } else if (accounts.some(acc => acc.name === name)) {
        errorMessage = 'An account with this name already exists';
        nameInput.focus();
    }
    
    if (errorMessage) {
        showToast(errorMessage, 'error', 3000);
        return;
    }

    accounts.push({ name, secret });
    saveAccounts();
    updateAccountsDisplay();
    updateAllCodes();
    
    // Reset form and hide it
    nameInput.value = '';
    secretInput.value = '';
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
        
        document.getElementById('editAccountName').value = account.name;
        document.getElementById('editSecretKey').value = account.secret;
        document.querySelector('.input-group').classList.remove('error');
        
        showEditDialog();
    }
}

function saveEditAccount() {
    if (editingIndex < 0 || editingIndex >= accounts.length) {
        hideEditDialog();
        return;
    }
    
    const nameInput = document.getElementById('editAccountName');
    const secretInput = document.getElementById('editSecretKey');
    const name = nameInput.value.trim();
    const secret = secretInput.value.trim();
    
    // Validate inputs
    let errorMessage = null;
    
    if (!name) {
        errorMessage = 'Please enter an account name';
        nameInput.focus();
    } else if (!validateAccountName(name)) {
        const nameInputGroup = nameInput.closest('.input-group');
        nameInputGroup.classList.add('error');
        nameInput.focus();
        return;
    } else if (!secret) {
        errorMessage = 'Please enter a secret key';
        secretInput.focus();
    } else if (!validateSecretKey(secret)) {
        errorMessage = 'Invalid secret key format';
        secretInput.focus();
    } else if (name !== accounts[editingIndex].name && accounts.some(acc => acc.name === name)) {
        errorMessage = 'An account with this name already exists';
        nameInput.focus();
    }
    
    if (errorMessage) {
        showToast(errorMessage, 'error', 3000);
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
    const importText = document.getElementById('importText').value.trim();
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
        
        if (!validateAccountName(name)) {
            errors++;
            continue;
        }
        
        if (!validateSecretKey(secret)) {
            errors++;
            continue;
        }
        
        if (accounts.some(acc => acc.name === name)) {
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
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    const accountElements = document.querySelectorAll('.code-display');
    
    if (searchTerm === '') {
        // Reset all visibility if search is empty
        accountElements.forEach(el => {
            el.style.display = 'flex';
            
            // Remove any existing highlighting
            const nameEl = el.querySelector('.account-name');
            nameEl.innerHTML = nameEl.textContent;
        });
        
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

// UI Functions
function updateAccountsDisplay() {
    const container = document.getElementById('codesContainer');
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
        const codeDisplay = document.createElement('div');
        codeDisplay.className = 'code-display';
        
        const nameContainer = document.createElement('div');
        nameContainer.className = 'account-name-container';
        
        const accountName = document.createElement('p');
        accountName.className = 'account-name';
        accountName.textContent = account.name;
        
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'account-actions';
        
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'account-action-btn edit';
        editBtn.innerHTML = '<i class="fas fa-pen" aria-hidden="true"></i>';
        editBtn.setAttribute('aria-label', `Edit ${account.name}`);
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editAccount(index);
        });
        
        const editTooltip = document.createElement('span');
        editTooltip.className = 'action-tooltip';
        editTooltip.textContent = tooltipTexts.edit;
        editBtn.appendChild(editTooltip);
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'account-action-btn delete';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt" aria-hidden="true"></i>';
        deleteBtn.setAttribute('aria-label', `Delete ${account.name}`);
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteClick(e, index);
        });
        
        const deleteTooltip = document.createElement('span');
        deleteTooltip.className = 'action-tooltip';
        deleteTooltip.textContent = tooltipTexts.delete;
        deleteBtn.appendChild(deleteTooltip);
        
        actionsContainer.appendChild(editBtn);
        actionsContainer.appendChild(deleteBtn);
        
        nameContainer.appendChild(accountName);
        nameContainer.appendChild(actionsContainer);
        
        // Code display with copy functionality
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
        
        // Tooltip for double-click to copy
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = tooltipTexts.copy;
        tooltip.setAttribute('aria-hidden', 'true');
        
        // Append elements to code wrapper in the correct order
        codeWrapper.appendChild(codeElement);
        codeWrapper.appendChild(copyIndicator);
        codeWrapper.appendChild(tooltip);
        
        codeDisplay.appendChild(nameContainer);
        codeDisplay.appendChild(codeWrapper);
        
        codesContainerInner.appendChild(codeDisplay);
        
        // Attach copy event handler
        attachCodeCopyEvents(index, true);
    });
    
    container.appendChild(codesContainerInner);
    
    // Filter results if there's a search term
    filterAccounts();
}

function showDeleteDialog() {
    // Close any other open dialogs first
    closeAllDialogs();
    
    const dialog = document.getElementById('deleteDialog');
    dialog.classList.add('visible');
    
    // Set focus to the confirm button for keyboard accessibility
    setTimeout(() => {
        const confirmButton = dialog.querySelector('button:first-of-type');
        if (confirmButton) confirmButton.focus();
    }, 100);
}

function hideDeleteDialog() {
    document.getElementById('deleteDialog').classList.remove('visible');
    deletingIndex = -1;
}

function handleDeleteClick(event, index) {
    event.stopPropagation(); // Prevent event bubbling
    deletingIndex = index;
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
}

function resetActionButtons(preserveActiveButton = false) {
    if (!preserveActiveButton) {
        // Reset any active buttons
        if (activeButton) {
            if (activeButton.classList.contains('delete')) {
                resetDeleteButton(activeButton);
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
}

function resetDeleteButton(button) {
    button.classList.remove('active');
    const tooltip = button.querySelector('.action-tooltip');
    if (tooltip) {
        tooltip.textContent = tooltipTexts.delete;
    }
}

function updateTimers() {
    const currentTime = Math.floor(Date.now() / 1000);
    const timeLeft = TOTP_INTERVAL - (currentTime % TOTP_INTERVAL);
    const progress = timeLeft / TOTP_INTERVAL;  // Progress now represents remaining time as a ratio
    
    // Calculate more precise progress with milliseconds for smoother animation
    const millisecondTime = Date.now() / 1000; // Get time with millisecond precision
    const preciseTimeLeft = TOTP_INTERVAL - (millisecondTime % TOTP_INTERVAL);
    const preciseProgress = preciseTimeLeft / TOTP_INTERVAL;

    // Update global timer display
    const countdownEl = document.getElementById('countdownTimer');
    if (countdownEl) {
        countdownEl.textContent = timeLeft;
    }
    
    // Update minimized timer
    const miniCountdownEl = document.getElementById('miniCountdownTimer');
    if (miniCountdownEl) {
        miniCountdownEl.textContent = timeLeft;
    }

    // Update ARIA values for accessibility
    const progressBar = document.querySelector('.timer-progress-bar');
    if (progressBar) {
        progressBar.style.setProperty('--progress', preciseProgress);
        progressBar.setAttribute('aria-valuenow', timeLeft);
    }
    
    // Update circle timer progress using the same progress value
    const circleProgress = document.querySelector('.timer-circle-progress');
    if (circleProgress) {
        // Update ARIA values
        circleProgress.setAttribute('aria-valuenow', timeLeft);
        
        // Detect timer reset (when timeLeft jumps from a low value back to TOTP_INTERVAL)
        if (lastTimeLeft === 0 && timeLeft === TOTP_INTERVAL) {
            // Apply reset class for smoother transition
            circleProgress.classList.add('resetting');
            
            // Set to maximum value immediately
            circleProgress.style.setProperty('--progress', 1);
            
            // Remove the class after animation completes
            setTimeout(() => {
                circleProgress.classList.remove('resetting');
            }, 700);
        } else {
            // Normal countdown behavior
            circleProgress.style.setProperty('--progress', preciseProgress);
        }
    }
    
    // Store current timeLeft for next comparison
    lastTimeLeft = timeLeft;

    // If time is up (0 seconds left), update all codes
    if (timeLeft === 0) {
        updateAllCodes();
    }
    // Or if we're in the last 3 seconds, prepare for update
    else if (timeLeft <= 3) {
        // Schedule the update for exactly when the time hits 0
        setTimeout(() => {
            updateAllCodes();
        }, timeLeft * 1000);
    }
}

function attachCodeCopyEvents(index, preserveState = false) {
    const wrapper = document.getElementById(`code-wrapper-${index}`);
    if (!wrapper) return;
    
    if (preserveState) {
        // Just add/update the event listener without replacing the element
        wrapper.addEventListener('click', function() {
            copyCode(index);
        });
        
        // Add keyboard support for accessibility
        wrapper.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                copyCode(index);
            }
        });
    } else {
        // Clear any existing event listeners by cloning and replacing the element
        const newWrapper = wrapper.cloneNode(true);
        wrapper.parentNode.replaceChild(newWrapper, wrapper);
        
        // Add the new event listeners
        newWrapper.addEventListener('click', function() {
            copyCode(index);
        });
        
        // Add keyboard support for accessibility
        newWrapper.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                copyCode(index);
            }
        });
    }
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
    
    // Set a timeout to remove the class
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
function showImportDialog() {
    // Close any other open dialogs first
    closeAllDialogs();
    
    document.getElementById('importDialog').classList.add('visible');
    document.getElementById('importText').focus();
}

function hideImportDialog() {
    document.getElementById('importDialog').classList.remove('visible');
    document.getElementById('importText').value = '';
}

function showExportDialog() {
    // Close any other open dialogs first
    closeAllDialogs();
    
    const exportText = accounts.map(acc => `${acc.name}|${acc.secret}`).join('\n');
    document.getElementById('exportText').value = exportText;
    
    document.getElementById('exportDialog').classList.add('visible');
    document.getElementById('exportText').select();
}

function hideExportDialog() {
    document.getElementById('exportDialog').classList.remove('visible');
    document.getElementById('exportText').value = '';
}

function showEditDialog() {
    // Close any other open dialogs first
    closeAllDialogs();
    
    document.getElementById('editDialog').classList.add('visible');
    document.getElementById('editAccountName').focus();
}

function hideEditDialog() {
    document.getElementById('editDialog').classList.remove('visible');
    editingIndex = -1;
}

function hideConfirmDialog() {
    const dialog = document.getElementById('confirmDialog');
    dialog.classList.remove('visible');
}

function closeAllDialogs() {
    // Hide all dialogs
    const dialogs = document.querySelectorAll('.dialog-form');
    dialogs.forEach(dialog => {
        dialog.classList.remove('visible');
    });
    
    // Reset all states
    editingIndex = -1;
    deletingIndex = -1;
    
    // Reset all buttons
    resetActionButtons();
    
    // Hide add account form
    hideAddAccountForm();
}

function toggleAddAccountForm() {
    const form = document.getElementById('addAccountForm');
    const btn = document.getElementById('toggleAddAccount');
    
    if (form.classList.contains('visible')) {
        hideAddAccountForm();
    } else {
        // Close any dialogs first
        closeAllDialogs();
        
        // Reset form values
        document.getElementById('accountName').value = '';
        document.getElementById('secretKey').value = '';
        
        // Show form
        form.classList.add('visible');
        
        // Update icon but preserve the span text
        const icon = btn.querySelector('i');
        icon.className = 'fas fa-times';
        
        btn.classList.add('active');
        
        // Focus on first input
        document.getElementById('accountName').focus();
    }
}

function hideAddAccountForm() {
    const form = document.getElementById('addAccountForm');
    const btn = document.getElementById('toggleAddAccount');
    
    form.classList.remove('visible');
    
    // Update icon but preserve the span text
    const icon = btn.querySelector('i');
    icon.className = 'fas fa-plus';
    
    btn.classList.remove('active');
}

function copyExportText() {
    const textArea = document.getElementById('exportText');
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
    setTimeout(() => {
        toast.classList.add('visible');
    }, 10);
    
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
    undoBtn.style.marginLeft = '8px';
    undoBtn.style.fontWeight = 'bold';
    undoBtn.style.textDecoration = 'none';
    undoBtn.style.color = 'white';
    
    undoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        undoCallback();
        hideToast(toast);
    });
    
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
    setTimeout(() => {
        toast.classList.add('visible');
    }, 10);
    
    // Hide toast after 5 seconds (longer than normal toast)
    setTimeout(() => {
        hideToast(toast);
    }, 5000);
}

// Toggle search functionality
function toggleSearch() {
    const container = document.querySelector('.timer-search-container');
    const searchInput = document.getElementById('searchInput');
    
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

// Reset search filter and clear highlights
function resetSearchFilter() {
    const accountElements = document.querySelectorAll('.code-display');
    accountElements.forEach(el => {
        el.style.display = 'flex';
        // Remove any existing highlighting
        const nameEl = el.querySelector('.account-name');
        if (nameEl) {
            nameEl.innerHTML = nameEl.textContent;
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Add account button
    document.getElementById('toggleAddAccount').addEventListener('click', toggleAddAccountForm);
    
    // Add account form submit
    document.getElementById('addAccountBtn').addEventListener('click', addAccount);
    
    // Import/Export buttons
    document.getElementById('importButton').addEventListener('click', showImportDialog);
    document.getElementById('exportButton').addEventListener('click', showExportDialog);
    
    // Search toggle
    document.getElementById('searchToggle').addEventListener('click', toggleSearch);
    
    // Search input
    document.getElementById('searchInput').addEventListener('input', filterAccounts);
    
    // Close search when clicking outside
    document.addEventListener('click', (e) => {
        if (isSearchActive) {
            // Check if click is outside search container
            const searchContainer = document.querySelector('.timer-search-container');
            const searchArea = document.querySelector('.search-area');
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
        if (e.key === 'Enter' && document.getElementById('addAccountForm').classList.contains('visible')) {
            if (document.activeElement === document.getElementById('secretKey') || 
                document.activeElement === document.getElementById('accountName')) {
                addAccount();
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