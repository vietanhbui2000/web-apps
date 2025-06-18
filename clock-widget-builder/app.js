class TimeWidget {
    constructor() {
        // Settings
        this.is24HourFormat = false;
        this.showSeconds = false;
        this.blinkColons = false;
        this.textAlignment = 'center';
        this.backgroundColor = 'transparent';
        this.timeColor = '#007acc';
        this.dateColor = '#333333';
        this.timeFontSize = 3;
        this.dateFontSize = 3;
        this.showFrame = false;
        this.roundedCorners = false;
        this.showShadow = false;
        
        // Font styling options
        this.timeBold = false;
        this.timeItalic = false;
        this.dateBold = false;
        this.dateItalic = false;
        
        // Size options
        this.sizeMode = 'adaptive'; // 'adaptive', 'fixed'
        this.widgetWidth = 340;
        this.widgetHeight = 120;
        
        // DOM elements - controls
        this.formatToggle = document.getElementById('format-toggle');
        this.secondsToggle = document.getElementById('seconds-toggle');
        this.blinkToggle = document.getElementById('blink-toggle');
        
        this.alignLeft = document.getElementById('align-left');
        this.alignCenter = document.getElementById('align-center');
        this.alignRight = document.getElementById('align-right');
        
        this.bgTransparent = document.getElementById('bg-transparent');
        this.bgColorPicker = document.getElementById('bg-color-picker');
        
        this.timeColorPicker = document.getElementById('time-color-picker');
        this.dateColorPicker = document.getElementById('date-color-picker');
        
        this.timeSizeSlider = document.getElementById('time-size');
        this.dateSizeSlider = document.getElementById('date-size');
        
        // Font styling controls
        this.timeBoldBtn = document.getElementById('time-bold');
        this.timeItalicBtn = document.getElementById('time-italic');
        this.dateBoldBtn = document.getElementById('date-bold');
        this.dateItalicBtn = document.getElementById('date-italic');
        
        this.frameToggle = document.getElementById('frame-toggle');
        this.roundedToggle = document.getElementById('rounded-toggle');
        this.shadowToggle = document.getElementById('shadow-toggle');
        this.resetButton = document.getElementById('reset-all');
        
        // Size controls
        this.sizeAdaptiveBtn = document.getElementById('size-adaptive');
        this.sizeFixedBtn = document.getElementById('size-fixed');
        this.fixedSizeControls = document.getElementById('fixed-size-controls');
        this.widgetWidthInput = document.getElementById('widget-width');
        this.widgetHeightInput = document.getElementById('widget-height');
        
        // DOM elements - preview and code
        this.clockIframe = document.getElementById('clock-iframe');
        this.codeTextarea = document.getElementById('code-textarea');
        this.copyBtn = document.getElementById('copy-code');
        
        this.init();
    }
    
    init() {
        // Load saved preferences
        this.loadPreferences();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Update preview and code
        this.updatePreview();
        this.updateCode();
        
        // Update button states
        this.updateButtonStates();
    }
    
    setupEventListeners() {
        // Format and display controls
        this.formatToggle.addEventListener('click', () => this.toggleTimeFormat());
        this.secondsToggle.addEventListener('click', () => this.toggleSeconds());
        this.blinkToggle.addEventListener('click', () => this.toggleBlink());
        
        // Alignment controls
        this.alignLeft.addEventListener('click', () => this.setAlignment('left'));
        this.alignCenter.addEventListener('click', () => this.setAlignment('center'));
        this.alignRight.addEventListener('click', () => this.setAlignment('right'));
        
        // Background controls
        this.bgTransparent.addEventListener('click', () => this.setBackgroundTransparent());
        this.bgColorPicker.addEventListener('input', (e) => this.setBackgroundColor(e.target.value));
        
        // Text color controls
        this.timeColorPicker.addEventListener('input', (e) => this.setTimeColor(e.target.value));
        this.dateColorPicker.addEventListener('input', (e) => this.setDateColor(e.target.value));
        
        // Font size controls
        this.timeSizeSlider.addEventListener('input', (e) => this.setTimeFontSize(parseInt(e.target.value)));
        this.dateSizeSlider.addEventListener('input', (e) => this.setDateFontSize(parseInt(e.target.value)));
        
        // Font styling controls
        this.timeBoldBtn.addEventListener('click', () => this.toggleTimeBold());
        this.timeItalicBtn.addEventListener('click', () => this.toggleTimeItalic());
        this.dateBoldBtn.addEventListener('click', () => this.toggleDateBold());
        this.dateItalicBtn.addEventListener('click', () => this.toggleDateItalic());
        
        // Frame controls
        this.frameToggle.addEventListener('click', () => this.toggleFrame());
        this.roundedToggle.addEventListener('click', () => this.toggleRounded());
        this.shadowToggle.addEventListener('click', () => this.toggleShadow());
        
        // Reset button
        this.resetButton.addEventListener('click', () => this.resetAll());
        
        // Size controls
        this.sizeAdaptiveBtn.addEventListener('click', () => this.setSizeMode('adaptive'));
        this.sizeFixedBtn.addEventListener('click', () => this.setSizeMode('fixed'));
        this.widgetWidthInput.addEventListener('input', (e) => this.setWidgetWidth(parseInt(e.target.value)));
        this.widgetHeightInput.addEventListener('input', (e) => this.setWidgetHeight(parseInt(e.target.value)));
        
        // Copy button
        this.copyBtn.addEventListener('click', () => this.copyCode());
    }
    
            // Note: The main builder interface doesn't need a live clock
        // The clock display is handled by the iframe preview
    
    // Toggle functions
    toggleTimeFormat() {
        this.is24HourFormat = !this.is24HourFormat;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
    }
    
    toggleSeconds() {
        this.showSeconds = !this.showSeconds;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
    }
    
    toggleBlink() {
        this.blinkColons = !this.blinkColons;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
    }
    
    toggleFrame() {
        this.showFrame = !this.showFrame;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
    }
    
    toggleRounded() {
        if (!this.showFrame) return; // Don't allow toggling if frame is not enabled
        this.roundedCorners = !this.roundedCorners;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
    }
    
    toggleShadow() {
        if (!this.showFrame) return; // Don't allow toggling if frame is not enabled
        this.showShadow = !this.showShadow;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
    }
    
    toggleTimeBold() {
        this.timeBold = !this.timeBold;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
    }
    
    toggleTimeItalic() {
        this.timeItalic = !this.timeItalic;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
    }
    
    toggleDateBold() {
        this.dateBold = !this.dateBold;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
    }
    
    toggleDateItalic() {
        this.dateItalic = !this.dateItalic;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
    }
    
    resetAll() {
        // Reset all options to defaults
        this.is24HourFormat = false;
        this.showSeconds = false;
        this.blinkColons = false;
        this.textAlignment = 'center';
        this.backgroundColor = 'transparent';
        this.timeColor = '#007acc';
        this.dateColor = '#333333';
        this.timeFontSize = 3;
        this.dateFontSize = 3;
        this.showFrame = false;
        this.roundedCorners = false;
        this.showShadow = false;
        
        // Reset font styling
        this.timeBold = false;
        this.timeItalic = false;
        this.dateBold = false;
        this.dateItalic = false;
        
        // Reset size options
        this.sizeMode = 'adaptive';
        this.widgetWidth = 340;
        this.widgetHeight = 120;
        
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
    }
    
    // Setting functions
    setAlignment(alignment) {
        this.textAlignment = alignment;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
    }
    
    setBackgroundTransparent() {
        this.backgroundColor = 'transparent';
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
    }
    
    setBackgroundColor(color) {
        this.backgroundColor = color;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
    }
    
    setTimeColor(color) {
        this.timeColor = color;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
    }
    
    setDateColor(color) {
        this.dateColor = color;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
    }
    
    setTimeFontSize(size) {
        this.timeFontSize = size;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
    }
    
    setDateFontSize(size) {
        this.dateFontSize = size;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
    }
    
    // Size functions
    setSizeMode(mode) {
        this.sizeMode = mode;
        this.savePreferences();
        this.updatePreview();
        this.updateCode();
        this.updateButtonStates();
        this.updateSizeControls();
    }
    
    setWidgetWidth(width) {
        if (width >= 200 && width <= 800) {
            this.widgetWidth = width;
            this.savePreferences();
            this.updatePreview();
            this.updateCode();
        }
    }
    
    setWidgetHeight(height) {
        if (height >= 100 && height <= 400) {
            this.widgetHeight = height;
            this.savePreferences();
            this.updatePreview();
            this.updateCode();
        }
    }

    
    updateSizeControls() {
        // Show/hide size controls based on mode
        if (this.sizeMode === 'fixed') {
            this.fixedSizeControls.classList.remove('hidden');
        } else {
            this.fixedSizeControls.classList.add('hidden');
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
        // Base widths for different time formats (in pixels at font size 3)
        let baseTimeWidth = 120; // Base for "12:34" format
        
        // Adjust for format type
        if (!this.is24HourFormat) {
            baseTimeWidth = 140; // "12:34 AM" is wider
        }
        
        // Adjust for seconds display
        if (this.showSeconds) {
            baseTimeWidth += 60; // ":45" addition
        }
        
        // Scale by time font size
        const timeSizeMultipliers = { 1: 0.5, 2: 0.7, 3: 1.0, 4: 1.4, 5: 1.8 };
        baseTimeWidth *= timeSizeMultipliers[this.timeFontSize] || 1.0;
        
        // Adjust for font styling (bold text is wider)
        if (this.timeBold) {
            baseTimeWidth *= 1.1;
        }
        
        return baseTimeWidth;
    }
    
    calculateDateWidth() {
        // Base width for full date "Wednesday, December 25, 2024" at font size 3
        let baseDateWidth = 280;
        
        // Scale by date font size
        const dateSizeMultipliers = { 1: 0.5, 2: 0.7, 3: 1.0, 4: 1.4, 5: 1.8 };
        baseDateWidth *= dateSizeMultipliers[this.dateFontSize] || 1.0;
        
        // Adjust for font styling (bold text is wider)
        if (this.dateBold) {
            baseDateWidth *= 1.1;
        }
        
        return baseDateWidth;
    }
    
    calculateAdaptiveHeight() {
        // Base height for time portion
        let timeHeight = 50;
        const timeSizeMultipliers = { 1: 0.5, 2: 0.7, 3: 1.0, 4: 1.4, 5: 1.8 };
        timeHeight *= timeSizeMultipliers[this.timeFontSize] || 1.0;
        
        // Base height for date portion
        let dateHeight = 25;
        const dateSizeMultipliers = { 1: 0.5, 2: 0.7, 3: 1.0, 4: 1.4, 5: 1.8 };
        dateHeight *= dateSizeMultipliers[this.dateFontSize] || 1.0;
        
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
        this.clockIframe.src = `clock.html?${params}`;
        
        // Update iframe dimensions based on size mode
        if (this.sizeMode === 'fixed') {
            this.clockIframe.width = this.widgetWidth;
            this.clockIframe.height = this.widgetHeight;
        } else {
            // Use calculated adaptive dimensions for preview
            const adaptiveWidth = this.calculateAdaptiveWidth();
            const adaptiveHeight = this.calculateAdaptiveHeight();
            this.clockIframe.width = adaptiveWidth;
            this.clockIframe.height = adaptiveHeight;
        }
        
        // Apply frame styling directly to preview iframe
        this.applyFrameStyleToIframe(this.clockIframe);
    }
    
    buildUrlParams() {
        const params = new URLSearchParams();
        
        // 1. Format controls (first section in interface)
        if (this.is24HourFormat) params.set('format', '24h');
        if (this.showSeconds) params.set('seconds', 'true');
        if (this.blinkColons) params.set('blink', 'true');
        
        // 2. Alignment (second section in interface)
        if (this.textAlignment !== 'center') params.set('align', this.textAlignment);
        
        // 3. Text Colors (third section in interface)
        if (this.timeColor !== '#007acc') params.set('timeColor', encodeURIComponent(this.timeColor));
        if (this.dateColor !== '#333333') params.set('dateColor', encodeURIComponent(this.dateColor));
        
        // 4. Font Styling (fourth section in interface)
        if (this.timeBold) params.set('timeBold', 'true');
        if (this.timeItalic) params.set('timeItalic', 'true');
        if (this.dateBold) params.set('dateBold', 'true');
        if (this.dateItalic) params.set('dateItalic', 'true');
        
        // 5. Font Sizes (fifth section in interface)
        if (this.timeFontSize !== 3) params.set('timeSize', this.timeFontSize.toString());
        if (this.dateFontSize !== 3) params.set('dateSize', this.dateFontSize.toString());
        
        // 6. Background (sixth section in interface)
        if (this.backgroundColor !== 'transparent') params.set('bg', encodeURIComponent(this.backgroundColor));
        
        // Note: Frame styling is now handled entirely by iframe style attributes
        // Note: Size parameters not needed - iframe dimensions handle everything
        
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
        
        this.codeTextarea.value = iframeCode;
    }
    
    async copyCode() {
        try {
            await navigator.clipboard.writeText(this.codeTextarea.value);
            
            // Visual feedback - change text to "COPIED"
            const originalText = this.copyBtn.textContent;
            this.copyBtn.textContent = 'COPIED';
            this.copyBtn.classList.add('copied');
            
            setTimeout(() => {
                this.copyBtn.textContent = originalText;
                this.copyBtn.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
            
            // Fallback: select text
            this.codeTextarea.select();
            this.codeTextarea.setSelectionRange(0, 99999);
            
            try {
                document.execCommand('copy');
                const originalText = this.copyBtn.textContent;
                this.copyBtn.textContent = 'COPIED';
                this.copyBtn.classList.add('copied');
                
                setTimeout(() => {
                    this.copyBtn.textContent = originalText;
                    this.copyBtn.classList.remove('copied');
                }, 2000);
            } catch (fallbackErr) {
                console.error('Fallback copy failed:', fallbackErr);
            }
        }
    }
    
    updateButtonStates() {
        // Format toggle
        this.formatToggle.textContent = this.is24HourFormat ? '24H' : '12H';
        this.formatToggle.classList.toggle('active', this.is24HourFormat);
        
        // Seconds toggle
        this.secondsToggle.classList.toggle('active', this.showSeconds);
        
        // Blink toggle
        this.blinkToggle.classList.toggle('active', this.blinkColons);
        
        // Alignment buttons
        this.alignLeft.classList.toggle('active', this.textAlignment === 'left');
        this.alignCenter.classList.toggle('active', this.textAlignment === 'center');
        this.alignRight.classList.toggle('active', this.textAlignment === 'right');
        
        // Background buttons
        this.bgTransparent.classList.toggle('active', this.backgroundColor === 'transparent');
        
        // Update color pickers
        if (this.backgroundColor !== 'transparent') {
            this.bgColorPicker.value = this.backgroundColor;
        }
        this.timeColorPicker.value = this.timeColor;
        this.dateColorPicker.value = this.dateColor;
        
        // Font size sliders
        this.timeSizeSlider.value = this.timeFontSize;
        this.dateSizeSlider.value = this.dateFontSize;
        
        // Font styling buttons
        this.timeBoldBtn.classList.toggle('active', this.timeBold);
        this.timeItalicBtn.classList.toggle('active', this.timeItalic);
        this.dateBoldBtn.classList.toggle('active', this.dateBold);
        this.dateItalicBtn.classList.toggle('active', this.dateItalic);
        
        // Frame toggles
        this.frameToggle.classList.toggle('active', this.showFrame);
        this.roundedToggle.classList.toggle('active', this.roundedCorners);
        this.shadowToggle.classList.toggle('active', this.showShadow);
        
        // Disable/enable rounded and shadow toggles based on frame state
        this.roundedToggle.disabled = !this.showFrame;
        this.shadowToggle.disabled = !this.showFrame;
        if (!this.showFrame && this.roundedCorners) {
            this.roundedCorners = false;
            this.savePreferences();
            this.updatePreview();
            this.updateCode();
        }
        if (!this.showFrame && this.showShadow) {
            this.showShadow = false;
            this.savePreferences();
            this.updatePreview();
            this.updateCode();
        }
        
        // Size mode buttons
        this.sizeAdaptiveBtn.classList.toggle('active', this.sizeMode === 'adaptive');
        this.sizeFixedBtn.classList.toggle('active', this.sizeMode === 'fixed');
        
        // Update dimension inputs
        this.widgetWidthInput.value = this.widgetWidth;
        this.widgetHeightInput.value = this.widgetHeight;
        
        // Update size controls visibility and description
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
            
            localStorage.setItem('timeWidget_preferences', JSON.stringify(preferences));
        } catch (error) {
            console.warn('Unable to save preferences to localStorage:', error);
        }
    }
    
    loadPreferences() {
        try {
            const saved = localStorage.getItem('timeWidget_preferences');
            if (saved) {
                const preferences = JSON.parse(saved);
                
                this.is24HourFormat = preferences.is24HourFormat ?? false;
                this.showSeconds = preferences.showSeconds ?? false;
                this.blinkColons = preferences.blinkColons ?? false;
                this.textAlignment = preferences.textAlignment ?? 'center';
                this.backgroundColor = preferences.backgroundColor ?? 'transparent';
                this.timeColor = preferences.timeColor ?? '#007acc';
                this.dateColor = preferences.dateColor ?? '#333333';
                this.timeFontSize = preferences.timeFontSize ?? 3;
                this.dateFontSize = preferences.dateFontSize ?? 3;
                this.showFrame = preferences.showFrame ?? false;
                this.roundedCorners = preferences.roundedCorners ?? false;
                this.showShadow = preferences.showShadow ?? false;
                this.timeBold = preferences.timeBold ?? false;
                this.timeItalic = preferences.timeItalic ?? false;
                this.dateBold = preferences.dateBold ?? false;
                this.dateItalic = preferences.dateItalic ?? false;
                this.sizeMode = preferences.sizeMode ?? 'adaptive';
                this.widgetWidth = preferences.widgetWidth ?? 340;
                this.widgetHeight = preferences.widgetHeight ?? 120;
            }
        } catch (error) {
            console.warn('Unable to load preferences from localStorage:', error);
        }
    }
}

// Keyboard accessibility
document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    
    switch (event.key.toLowerCase()) {
        case 't':
            document.getElementById('format-toggle').click();
            break;
        case 's':
            document.getElementById('seconds-toggle').click();
            break;
        case 'b':
            document.getElementById('blink-toggle').click();
            break;
        case 'f':
            document.getElementById('frame-toggle').click();
            break;
        case 'r':
            document.getElementById('rounded-toggle').click();
            break;
        case 'w':
            document.getElementById('shadow-toggle').click();
            break;
        case 'arrowleft':
            document.getElementById('align-left').click();
            break;
        case 'arrowup':
            document.getElementById('align-center').click();
            break;
        case 'arrowright':
            document.getElementById('align-right').click();
            break;
    }
});

// Initialize the widget when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TimeWidget();
});

// Handle visibility change to maintain performance
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Clock builder hidden - continuing updates');
    } else {
        console.log('Clock builder visible - ensuring updates');
    }
}); 