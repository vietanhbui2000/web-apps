class TimeWidget {
    // Constants for better maintainability
    static CONSTANTS = {
        FONT_SIZE: {
            MIN: 1,
            MAX: 5,
            DEFAULT: 3
        },
        DIMENSIONS: {
            WIDTH: { MIN: 200, MAX: 800, DEFAULT: 340 },
            HEIGHT: { MIN: 100, MAX: 400, DEFAULT: 120 }
        },
        DEBOUNCE_DELAY: 150,
        SIZE_MULTIPLIERS: {
            TIME: { 1: 0.5, 2: 0.7, 3: 1.0, 4: 1.4, 5: 1.8 },
            DATE: { 1: 0.5, 2: 0.7, 3: 1.0, 4: 1.4, 5: 1.8 }
        },
        BASE_WIDTHS: {
            TIME_12H: 140,
            TIME_24H: 120,
            SECONDS_ADDITION: 60,
            DATE_FULL: 280
        },
        DEFAULTS: {
            IS_24_HOUR: false,
            SHOW_SECONDS: false,
            BLINK_COLONS: false,
            TEXT_ALIGNMENT: 'center',
            BACKGROUND_COLOR: 'transparent',
            TIME_COLOR: '#007acc',
            DATE_COLOR: '#333333',
            SHOW_FRAME: false,
            ROUNDED_CORNERS: false,
            SHOW_SHADOW: false,
            SIZE_MODE: 'adaptive'
        },
        VALID_ALIGNMENTS: ['left', 'center', 'right'],
        VALID_SIZE_MODES: ['adaptive', 'fixed'],
        COLOR_PATTERNS: {
            HEX: /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/,
            RGB: /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/,
            RGBA: /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/
        },
        STORAGE_KEY: 'timeWidget_preferences',
        COPY_FEEDBACK_DURATION: 2000
    };

    constructor() {
        // Initialize settings with defaults
        this.initializeSettings();
        
        // Debouncing for updates
        this.updateDebounceTimer = null;
        
        // Cache DOM elements to avoid repeated queries
        this.elements = this.cacheElements();
        
        this.init();
    }

    initializeSettings() {
        const defaults = TimeWidget.CONSTANTS.DEFAULTS;
        this.is24HourFormat = defaults.IS_24_HOUR;
        this.showSeconds = defaults.SHOW_SECONDS;
        this.blinkColons = defaults.BLINK_COLONS;
        this.textAlignment = defaults.TEXT_ALIGNMENT;
        this.backgroundColor = defaults.BACKGROUND_COLOR;
        this.timeColor = defaults.TIME_COLOR;
        this.dateColor = defaults.DATE_COLOR;
        this.timeFontSize = TimeWidget.CONSTANTS.FONT_SIZE.DEFAULT;
        this.dateFontSize = TimeWidget.CONSTANTS.FONT_SIZE.DEFAULT;
        this.showFrame = defaults.SHOW_FRAME;
        this.roundedCorners = defaults.ROUNDED_CORNERS;
        this.showShadow = defaults.SHOW_SHADOW;
        
        // Font styling options
        this.timeBold = false;
        this.timeItalic = false;
        this.dateBold = false;
        this.dateItalic = false;
        
        // Size options
        this.sizeMode = defaults.SIZE_MODE;
        this.widgetWidth = TimeWidget.CONSTANTS.DIMENSIONS.WIDTH.DEFAULT;
        this.widgetHeight = TimeWidget.CONSTANTS.DIMENSIONS.HEIGHT.DEFAULT;
    }
    
    cacheElements() {
        return {
            // Format controls
            formatToggle: document.getElementById('format-toggle'),
            secondsToggle: document.getElementById('seconds-toggle'),
            blinkToggle: document.getElementById('blink-toggle'),
            
            // Alignment controls
            alignLeft: document.getElementById('align-left'),
            alignCenter: document.getElementById('align-center'),
            alignRight: document.getElementById('align-right'),
            
            // Background controls
            bgTransparent: document.getElementById('bg-transparent'),
            bgColorPicker: document.getElementById('bg-color-picker'),
            
            // Color controls
            timeColorPicker: document.getElementById('time-color-picker'),
            dateColorPicker: document.getElementById('date-color-picker'),
            
            // Size controls
            timeSizeSlider: document.getElementById('time-size'),
            dateSizeSlider: document.getElementById('date-size'),
            
            // Font styling controls
            timeBoldBtn: document.getElementById('time-bold'),
            timeItalicBtn: document.getElementById('time-italic'),
            dateBoldBtn: document.getElementById('date-bold'),
            dateItalicBtn: document.getElementById('date-italic'),
            
            // Frame controls
            frameToggle: document.getElementById('frame-toggle'),
            roundedToggle: document.getElementById('rounded-toggle'),
            shadowToggle: document.getElementById('shadow-toggle'),
            resetButton: document.getElementById('reset-all'),
            
            // Size mode controls
            sizeAdaptiveBtn: document.getElementById('size-adaptive'),
            sizeFixedBtn: document.getElementById('size-fixed'),
            fixedSizeControls: document.getElementById('fixed-size-controls'),
            widgetWidthInput: document.getElementById('widget-width'),
            widgetHeightInput: document.getElementById('widget-height'),
            
            // Preview and code
            clockIframe: document.getElementById('clock-iframe'),
            codeTextarea: document.getElementById('code-textarea'),
            copyBtn: document.getElementById('copy-code')
        };
    }
    
    init() {
        // Load saved preferences
        this.loadPreferences();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Apply saved preferences immediately (no debouncing on initial load)
        this.updatePreview();
        this.updateCode();
        
        // Update button states
        this.updateButtonStates();
    }
    
    setupEventListeners() {
        const { elements } = this;
        
        // Format and display controls
        elements.formatToggle.addEventListener('click', () => this.toggle('is24HourFormat'));
        elements.secondsToggle.addEventListener('click', () => this.toggle('showSeconds'));
        elements.blinkToggle.addEventListener('click', () => this.toggle('blinkColons'));
        
        // Alignment controls
        elements.alignLeft.addEventListener('click', () => this.setAlignment('left'));
        elements.alignCenter.addEventListener('click', () => this.setAlignment('center'));
        elements.alignRight.addEventListener('click', () => this.setAlignment('right'));
        
        // Background controls
        elements.bgTransparent.addEventListener('click', () => this.setBackgroundTransparent());
        elements.bgColorPicker.addEventListener('input', (e) => this.setBackgroundColor(e.target.value));
        
        // Text color controls
        elements.timeColorPicker.addEventListener('input', (e) => this.setTimeColor(e.target.value));
        elements.dateColorPicker.addEventListener('input', (e) => this.setDateColor(e.target.value));
        
        // Font size controls
        elements.timeSizeSlider.addEventListener('input', (e) => this.setTimeFontSize(parseInt(e.target.value)));
        elements.dateSizeSlider.addEventListener('input', (e) => this.setDateFontSize(parseInt(e.target.value)));
        
        // Font styling controls
        elements.timeBoldBtn.addEventListener('click', () => this.toggle('timeBold'));
        elements.timeItalicBtn.addEventListener('click', () => this.toggle('timeItalic'));
        elements.dateBoldBtn.addEventListener('click', () => this.toggle('dateBold'));
        elements.dateItalicBtn.addEventListener('click', () => this.toggle('dateItalic'));
        
        // Frame controls
        elements.frameToggle.addEventListener('click', () => this.toggle('showFrame'));
        elements.roundedToggle.addEventListener('click', () => this.toggleDependent('roundedCorners', 'showFrame'));
        elements.shadowToggle.addEventListener('click', () => this.toggleDependent('showShadow', 'showFrame'));
        
        // Reset button
        elements.resetButton.addEventListener('click', () => this.resetAll());
        
        // Size controls
        elements.sizeAdaptiveBtn.addEventListener('click', () => this.setSizeMode('adaptive'));
        elements.sizeFixedBtn.addEventListener('click', () => this.setSizeMode('fixed'));
        elements.widgetWidthInput.addEventListener('input', (e) => this.setWidgetWidth(parseInt(e.target.value)));
        elements.widgetHeightInput.addEventListener('input', (e) => this.setWidgetHeight(parseInt(e.target.value)));
        
        // Copy button
        elements.copyBtn.addEventListener('click', () => this.copyCode());
    }
    
    // Debounced update to prevent excessive calls
    debouncedUpdate() {
        clearTimeout(this.updateDebounceTimer);
        this.updateDebounceTimer = setTimeout(() => {
            this.updatePreview();
            this.updateCode();
        }, TimeWidget.CONSTANTS.DEBOUNCE_DELAY);
    }
    
    // Consolidated toggle function
    toggle(property) {
        this[property] = !this[property];
        this.savePreferences();
        this.debouncedUpdate();
        this.updateButtonStates();
    }
    
    // Toggle function for dependent properties
    toggleDependent(property, dependency) {
        if (!this[dependency]) return;
        this.toggle(property);
    }
    
    resetAll() {
        // Reset all options to defaults
        this.initializeSettings();
        
        // Reset UI elements to default values
        const defaults = TimeWidget.CONSTANTS.DEFAULTS;
        this.elements.bgColorPicker.value = '#ffffff';
        this.elements.timeColorPicker.value = defaults.TIME_COLOR;
        this.elements.dateColorPicker.value = defaults.DATE_COLOR;
        this.elements.timeSizeSlider.value = TimeWidget.CONSTANTS.FONT_SIZE.DEFAULT;
        this.elements.dateSizeSlider.value = TimeWidget.CONSTANTS.FONT_SIZE.DEFAULT;
        this.elements.widgetWidthInput.value = TimeWidget.CONSTANTS.DIMENSIONS.WIDTH.DEFAULT;
        this.elements.widgetHeightInput.value = TimeWidget.CONSTANTS.DIMENSIONS.HEIGHT.DEFAULT;
        
        this.savePreferences();
        this.debouncedUpdate();
        this.updateButtonStates();
    }
    
    // Setting functions
    setAlignment(alignment) {
        if (!TimeWidget.CONSTANTS.VALID_ALIGNMENTS.includes(alignment)) return;
        this.textAlignment = alignment;
        this.savePreferences();
        this.debouncedUpdate();
        this.updateButtonStates();
    }
    
    setBackgroundTransparent() {
        this.backgroundColor = 'transparent';
        this.savePreferences();
        this.debouncedUpdate();
        this.updateButtonStates();
    }
    
    setBackgroundColor(color) {
        if (this.isValidColor(color)) {
            this.backgroundColor = color;
            this.savePreferences();
            this.debouncedUpdate();
        }
    }
    
    setTimeColor(color) {
        if (this.isValidColor(color)) {
            this.timeColor = color;
            this.savePreferences();
            this.debouncedUpdate();
        }
    }
    
    setDateColor(color) {
        if (this.isValidColor(color)) {
            this.dateColor = color;
            this.savePreferences();
            this.debouncedUpdate();
        }
    }
    
    setTimeFontSize(size) {
        const validSize = this.clampValue(
            size, 
            TimeWidget.CONSTANTS.FONT_SIZE.MIN, 
            TimeWidget.CONSTANTS.FONT_SIZE.MAX, 
            TimeWidget.CONSTANTS.FONT_SIZE.DEFAULT
        );
        this.timeFontSize = validSize;
        this.savePreferences();
        this.debouncedUpdate();
    }
    
    setDateFontSize(size) {
        const validSize = this.clampValue(
            size, 
            TimeWidget.CONSTANTS.FONT_SIZE.MIN, 
            TimeWidget.CONSTANTS.FONT_SIZE.MAX, 
            TimeWidget.CONSTANTS.FONT_SIZE.DEFAULT
        );
        this.dateFontSize = validSize;
        this.savePreferences();
        this.debouncedUpdate();
    }
    
    // Size functions
    setSizeMode(mode) {
        if (!TimeWidget.CONSTANTS.VALID_SIZE_MODES.includes(mode)) return;
        this.sizeMode = mode;
        this.savePreferences();
        this.debouncedUpdate();
        this.updateButtonStates();
        this.updateSizeControls();
    }
    
    setWidgetWidth(width) {
        const constants = TimeWidget.CONSTANTS.DIMENSIONS.WIDTH;
        if (width >= constants.MIN && width <= constants.MAX) {
            this.widgetWidth = width;
            this.savePreferences();
            this.debouncedUpdate();
        }
    }
    
    setWidgetHeight(height) {
        const constants = TimeWidget.CONSTANTS.DIMENSIONS.HEIGHT;
        if (height >= constants.MIN && height <= constants.MAX) {
            this.widgetHeight = height;
            this.savePreferences();
            this.debouncedUpdate();
        }
    }

    
    updateSizeControls() {
        // Show/hide size controls based on mode
        if (this.sizeMode === 'fixed') {
            this.elements.fixedSizeControls.classList.remove('hidden');
        } else {
            this.elements.fixedSizeControls.classList.add('hidden');
        }
    }
    
    // Adaptive size calculation methods
    calculateAdaptiveWidth() {
        // Calculate width requirements for both time and date, use the larger
        const timeWidth = this.calculateTimeWidth();
        const dateWidth = this.calculateDateWidth();
        
        // Use the larger of time or date width requirements
        let requiredWidth = Math.max(timeWidth, dateWidth);
        
        // Add padding for comfortable spacing
        requiredWidth += 60;
        
        // Adjust for frame padding
        if (this.showFrame) {
            requiredWidth += 30;
        }
        
        // Round and ensure minimum width
        return Math.max(Math.round(requiredWidth), 280);
    }
    
    calculateTimeWidth() {
        const constants = TimeWidget.CONSTANTS;
        // Base widths for different time formats (in pixels at font size 3)
        let baseTimeWidth = this.is24HourFormat ? 
            constants.BASE_WIDTHS.TIME_24H : 
            constants.BASE_WIDTHS.TIME_12H;
        
        // Adjust for seconds display
        if (this.showSeconds) {
            baseTimeWidth += constants.BASE_WIDTHS.SECONDS_ADDITION;
        }
        
        // Scale by time font size
        baseTimeWidth *= constants.SIZE_MULTIPLIERS.TIME[this.timeFontSize] || 1.0;
        
        // Adjust for font styling (bold text is wider)
        if (this.timeBold) {
            baseTimeWidth *= 1.1;
        }
        
        return baseTimeWidth;
    }
    
    calculateDateWidth() {
        const constants = TimeWidget.CONSTANTS;
        // Base width for full date "Wednesday, December 25, 2024" at font size 3
        let baseDateWidth = constants.BASE_WIDTHS.DATE_FULL;
        
        // Scale by date font size
        baseDateWidth *= constants.SIZE_MULTIPLIERS.DATE[this.dateFontSize] || 1.0;
        
        // Adjust for font styling (bold text is wider)
        if (this.dateBold) {
            baseDateWidth *= 1.1;
        }
        
        return baseDateWidth;
    }
    
    calculateAdaptiveHeight() {
        const constants = TimeWidget.CONSTANTS;
        // Base height for time portion
        let timeHeight = 50;
        timeHeight *= constants.SIZE_MULTIPLIERS.TIME[this.timeFontSize] || 1.0;
        
        // Base height for date portion
        let dateHeight = 25;
        dateHeight *= constants.SIZE_MULTIPLIERS.DATE[this.dateFontSize] || 1.0;
        
        // Total height with spacing between time and date
        let totalHeight = timeHeight + dateHeight + 40; // 40px for spacing and padding
        
        // Adjust for frame padding
        if (this.showFrame) {
            totalHeight += 30;
        }
        
        // Round and ensure minimum height
        return Math.max(Math.round(totalHeight), 120);
    }
    
    // Frame styling helper methods
    generateFrameStyle() {
        if (!this.showFrame) return '';
        
        let styles = ['border: 2px solid #e0e0e0'];
        
        if (this.roundedCorners) {
            styles.push('border-radius: 12px');
        }
        
        if (this.showShadow) {
            styles.push('box-shadow: 0 2px 10px rgba(0,0,0,0.1)');
        }
        
        return ` style="${styles.join('; ')};"`;
    }
    
    applyFrameStyleToIframe(iframe) {
        if (this.showFrame) {
            iframe.style.border = '2px solid #e0e0e0';
            iframe.style.borderRadius = this.roundedCorners ? '12px' : '';
            iframe.style.boxShadow = this.showShadow ? '0 2px 10px rgba(0,0,0,0.1)' : '';
        } else {
            // Remove frame styling
            iframe.style.border = '';
            iframe.style.borderRadius = '';
            iframe.style.boxShadow = '';
        }
    }
    
    // Preview and code functions
    updatePreview() {
        const params = this.buildUrlParams();
        this.elements.clockIframe.src = `clock.html?${params}`;
        
        // Update iframe dimensions based on size mode
        if (this.sizeMode === 'fixed') {
            this.elements.clockIframe.width = this.widgetWidth;
            this.elements.clockIframe.height = this.widgetHeight;
        } else {
            // Use calculated adaptive dimensions for preview
            const adaptiveWidth = this.calculateAdaptiveWidth();
            const adaptiveHeight = this.calculateAdaptiveHeight();
            this.elements.clockIframe.width = adaptiveWidth;
            this.elements.clockIframe.height = adaptiveHeight;
        }
        
        // Apply frame styling directly to preview iframe
        this.applyFrameStyleToIframe(this.elements.clockIframe);
    }
    
    buildUrlParams() {
        const params = new URLSearchParams();
        const defaults = TimeWidget.CONSTANTS.DEFAULTS;
        
        // Only add non-default parameters to keep URL clean
        if (this.is24HourFormat !== defaults.IS_24_HOUR) params.set('format', '24h');
        if (this.showSeconds !== defaults.SHOW_SECONDS) params.set('seconds', 'true');
        if (this.blinkColons !== defaults.BLINK_COLONS) params.set('blink', 'true');
        if (this.textAlignment !== defaults.TEXT_ALIGNMENT) params.set('align', this.textAlignment);
        if (this.timeColor !== defaults.TIME_COLOR) params.set('timeColor', this.timeColor);
        if (this.dateColor !== defaults.DATE_COLOR) params.set('dateColor', this.dateColor);
        if (this.timeBold) params.set('timeBold', 'true');
        if (this.timeItalic) params.set('timeItalic', 'true');
        if (this.dateBold) params.set('dateBold', 'true');
        if (this.dateItalic) params.set('dateItalic', 'true');
        if (this.timeFontSize !== TimeWidget.CONSTANTS.FONT_SIZE.DEFAULT) {
            params.set('timeSize', this.timeFontSize.toString());
        }
        if (this.dateFontSize !== TimeWidget.CONSTANTS.FONT_SIZE.DEFAULT) {
            params.set('dateSize', this.dateFontSize.toString());
        }
        
        // Background
        if (this.backgroundColor !== defaults.BACKGROUND_COLOR) {
            params.set('bg', encodeURIComponent(this.backgroundColor));
        }
        
        return params.toString();
    }
    
    updateCode() {
        const params = this.buildUrlParams();
        const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '') + 'clock.html';
        const fullUrl = params ? `${baseUrl}?${params}` : baseUrl;
        
        // Generate iframe styling based on settings
        const iframeStyle = this.generateFrameStyle();
        
        // Generate iframe code based on size mode
        let iframeCode;
        
        if (this.sizeMode === 'fixed') {
            // Fixed mode - use custom dimensions
            iframeCode = `<iframe width="${this.widgetWidth}" height="${this.widgetHeight}"${iframeStyle} src="${fullUrl}">
</iframe>`;
        } else {
            // Adaptive mode - calculate dimensions based on content
            const adaptiveWidth = this.calculateAdaptiveWidth();
            const adaptiveHeight = this.calculateAdaptiveHeight();
            
            iframeCode = `<iframe width="${adaptiveWidth}" height="${adaptiveHeight}"${iframeStyle} src="${fullUrl}">
</iframe>`;
        }
        
        this.elements.codeTextarea.value = iframeCode;
    }
    
    async copyCode() {
        try {
            await navigator.clipboard.writeText(this.elements.codeTextarea.value);
            this.showCopyFeedback();
        } catch (err) {
            // Fallback: select text
            this.elements.codeTextarea.select();
            this.elements.codeTextarea.setSelectionRange(0, 99999);
            
            try {
                document.execCommand('copy');
                this.showCopyFeedback();
            } catch (fallbackErr) {
                // Copy failed completely - could show user message here if needed
            }
        }
    }

    showCopyFeedback() {
        // Visual feedback - change text to "COPIED"
        const originalText = this.elements.copyBtn.textContent;
        this.elements.copyBtn.textContent = 'COPIED';
        this.elements.copyBtn.classList.add('copied');
        
        setTimeout(() => {
            this.elements.copyBtn.textContent = originalText;
            this.elements.copyBtn.classList.remove('copied');
        }, TimeWidget.CONSTANTS.COPY_FEEDBACK_DURATION);
    }
    
    updateButtonStates() {
        // Format toggle
        this.elements.formatToggle.textContent = this.is24HourFormat ? '24H' : '12H';
        this.elements.formatToggle.classList.toggle('active', this.is24HourFormat);
        
        // Seconds toggle
        this.elements.secondsToggle.classList.toggle('active', this.showSeconds);
        
        // Blink toggle
        this.elements.blinkToggle.classList.toggle('active', this.blinkColons);
        
        // Alignment buttons
        this.elements.alignLeft.classList.toggle('active', this.textAlignment === 'left');
        this.elements.alignCenter.classList.toggle('active', this.textAlignment === 'center');
        this.elements.alignRight.classList.toggle('active', this.textAlignment === 'right');
        
        // Background buttons
        this.elements.bgTransparent.classList.toggle('active', this.backgroundColor === 'transparent');
        
        // Update color pickers
        if (this.backgroundColor !== 'transparent') {
            this.elements.bgColorPicker.value = this.backgroundColor;
        }
        this.elements.timeColorPicker.value = this.timeColor;
        this.elements.dateColorPicker.value = this.dateColor;
        
        // Font size sliders
        this.elements.timeSizeSlider.value = this.timeFontSize;
        this.elements.dateSizeSlider.value = this.dateFontSize;
        
        // Font styling buttons
        this.elements.timeBoldBtn.classList.toggle('active', this.timeBold);
        this.elements.timeItalicBtn.classList.toggle('active', this.timeItalic);
        this.elements.dateBoldBtn.classList.toggle('active', this.dateBold);
        this.elements.dateItalicBtn.classList.toggle('active', this.dateItalic);
        
        // Frame toggles
        this.elements.frameToggle.classList.toggle('active', this.showFrame);
        this.elements.roundedToggle.classList.toggle('active', this.roundedCorners);
        this.elements.shadowToggle.classList.toggle('active', this.showShadow);
        
        // Disable/enable rounded and shadow toggles based on frame state
        this.elements.roundedToggle.disabled = !this.showFrame;
        this.elements.shadowToggle.disabled = !this.showFrame;
        if (!this.showFrame && this.roundedCorners) {
            this.roundedCorners = false;
            this.savePreferences();
            this.debouncedUpdate();
        }
        if (!this.showFrame && this.showShadow) {
            this.showShadow = false;
            this.savePreferences();
            this.debouncedUpdate();
        }
        
        // Size mode buttons
        this.elements.sizeAdaptiveBtn.classList.toggle('active', this.sizeMode === 'adaptive');
        this.elements.sizeFixedBtn.classList.toggle('active', this.sizeMode === 'fixed');
        
        // Update dimension inputs
        this.elements.widgetWidthInput.value = this.widgetWidth;
        this.elements.widgetHeightInput.value = this.widgetHeight;
        
        // Update size controls visibility
        this.updateSizeControls();
    }
    
    savePreferences() {
        try {
            const preferences = {
                is24HourFormat: this.is24HourFormat,
                showSeconds: this.showSeconds,
                blinkColons: this.blinkColons,
                textAlignment: this.textAlignment,
                backgroundColor: this.backgroundColor,
                timeColor: this.timeColor,
                dateColor: this.dateColor,
                timeFontSize: this.timeFontSize,
                dateFontSize: this.dateFontSize,
                showFrame: this.showFrame,
                roundedCorners: this.roundedCorners,
                showShadow: this.showShadow,
                timeBold: this.timeBold,
                timeItalic: this.timeItalic,
                dateBold: this.dateBold,
                dateItalic: this.dateItalic,
                sizeMode: this.sizeMode,
                widgetWidth: this.widgetWidth,
                widgetHeight: this.widgetHeight
            };
            
            const serialized = JSON.stringify(preferences);
            localStorage.setItem(TimeWidget.CONSTANTS.STORAGE_KEY, serialized);
        } catch (error) {
            // Silently handle localStorage errors - app should still function
            // without persistence
        }
    }
    
    loadPreferences() {
        try {
            const saved = localStorage.getItem(TimeWidget.CONSTANTS.STORAGE_KEY);
            if (!saved) return;
            
            const preferences = JSON.parse(saved);
            
            // Validate and assign preferences with fallbacks
            this.is24HourFormat = Boolean(preferences.is24HourFormat);
            this.showSeconds = Boolean(preferences.showSeconds);
            this.blinkColons = Boolean(preferences.blinkColons);
            this.textAlignment = TimeWidget.CONSTANTS.VALID_ALIGNMENTS.includes(preferences.textAlignment) 
                ? preferences.textAlignment : TimeWidget.CONSTANTS.DEFAULTS.TEXT_ALIGNMENT;
            this.backgroundColor = preferences.backgroundColor || TimeWidget.CONSTANTS.DEFAULTS.BACKGROUND_COLOR;
            this.timeColor = this.isValidColor(preferences.timeColor) ? preferences.timeColor : TimeWidget.CONSTANTS.DEFAULTS.TIME_COLOR;
            this.dateColor = this.isValidColor(preferences.dateColor) ? preferences.dateColor : TimeWidget.CONSTANTS.DEFAULTS.DATE_COLOR;
            this.timeFontSize = this.clampValue(preferences.timeFontSize, 
                TimeWidget.CONSTANTS.FONT_SIZE.MIN, 
                TimeWidget.CONSTANTS.FONT_SIZE.MAX, 
                TimeWidget.CONSTANTS.FONT_SIZE.DEFAULT);
            this.dateFontSize = this.clampValue(preferences.dateFontSize, 
                TimeWidget.CONSTANTS.FONT_SIZE.MIN, 
                TimeWidget.CONSTANTS.FONT_SIZE.MAX, 
                TimeWidget.CONSTANTS.FONT_SIZE.DEFAULT);
            this.showFrame = Boolean(preferences.showFrame);
            this.roundedCorners = Boolean(preferences.roundedCorners);
            this.showShadow = Boolean(preferences.showShadow);
            this.timeBold = Boolean(preferences.timeBold);
            this.timeItalic = Boolean(preferences.timeItalic);
            this.dateBold = Boolean(preferences.dateBold);
            this.dateItalic = Boolean(preferences.dateItalic);
            this.sizeMode = TimeWidget.CONSTANTS.VALID_SIZE_MODES.includes(preferences.sizeMode) 
                ? preferences.sizeMode : TimeWidget.CONSTANTS.DEFAULTS.SIZE_MODE;
            this.widgetWidth = this.clampValue(preferences.widgetWidth, 
                TimeWidget.CONSTANTS.DIMENSIONS.WIDTH.MIN, 
                TimeWidget.CONSTANTS.DIMENSIONS.WIDTH.MAX, 
                TimeWidget.CONSTANTS.DIMENSIONS.WIDTH.DEFAULT);
            this.widgetHeight = this.clampValue(preferences.widgetHeight, 
                TimeWidget.CONSTANTS.DIMENSIONS.HEIGHT.MIN, 
                TimeWidget.CONSTANTS.DIMENSIONS.HEIGHT.MAX, 
                TimeWidget.CONSTANTS.DIMENSIONS.HEIGHT.DEFAULT);
        } catch (error) {
            // Silently handle localStorage errors and use defaults
        }
    }
    
    // Helper function to validate color strings
    isValidColor(color) {
        if (!color || typeof color !== 'string') return false;
        const patterns = TimeWidget.CONSTANTS.COLOR_PATTERNS;
        return color === 'transparent' || 
               patterns.HEX.test(color) ||
               patterns.RGB.test(color) ||
               patterns.RGBA.test(color);
    }
    
    // Helper function to clamp numeric values
    clampValue(value, min, max, defaultValue) {
        const num = parseInt(value);
        if (isNaN(num)) return defaultValue;
        return Math.max(min, Math.min(max, num));
    }
}

// Keyboard accessibility - optimized with better event handling
document.addEventListener('keydown', (event) => {
    // Ignore if modifier keys are pressed or if user is typing in an input
    if (event.altKey || event.ctrlKey || event.metaKey || 
        event.target.matches('input, textarea, [contenteditable]')) {
        return;
    }
    
    const keyMap = {
        't': 'format-toggle',
        's': 'seconds-toggle', 
        'b': 'blink-toggle',
        'f': 'frame-toggle',
        'r': 'rounded-toggle',
        'w': 'shadow-toggle',
        'arrowleft': 'align-left',
        'arrowup': 'align-center',
        'arrowright': 'align-right'
    };
    
    const elementId = keyMap[event.key.toLowerCase()];
    if (elementId) {
        event.preventDefault();
        const element = document.getElementById(elementId);
        if (element && !element.disabled) {
            element.click();
        }
    }
});

// Initialize the widget when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const widget = new TimeWidget();
    
    // Cleanup on page unload to prevent memory leaks
    window.addEventListener('beforeunload', () => {
        if (widget.updateDebounceTimer) {
            clearTimeout(widget.updateDebounceTimer);
        }
    });
}); 