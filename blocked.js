// Blocked page JavaScript - CSP compliant

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const blockedSite = urlParams.get('site');

// Motivational quotes
const quotes = [
    { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
    { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
    { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
    { text: "Concentrate all your thoughts upon the work at hand.", author: "Alexander Graham Bell" },
    { text: "The successful warrior is the average person with laser-like focus.", author: "Bruce Lee" }
];

// Initialize page
function initializePage() {
    // Set site name
    if (blockedSite) {
        document.getElementById('siteName').textContent = blockedSite + ' is blocked';
    }

    // Set random motivational quote
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('motivationalQuote').textContent = `"${randomQuote.text}"`;
    document.getElementById('quoteAuthor').textContent = `- ${randomQuote.author}`;

    // Setup event listeners
    setupEventListeners();

    // Load stats
    loadBlockingStats();

    // Check if in focus mode
    checkFocusMode();
}

function setupEventListeners() {
    // Add event listeners to buttons instead of onclick
    const productivityBtn = document.getElementById('productivityBtn');
    const goBackBtn = document.getElementById('goBackBtn');

    if (productivityBtn) {
        productivityBtn.addEventListener('click', openProductivitySite);
    }

    if (goBackBtn) {
        goBackBtn.addEventListener('click', goBack);
    }
}

// Function to open a random productive site from user's list
async function openProductivitySite() {
    console.log('Opening productive site...');
    
    try {
        // Check if chrome.runtime is available
        if (!chrome.runtime || !chrome.runtime.sendMessage) {
            console.error('Chrome runtime not available');
            fallbackToDefaultSite();
            return;
        }

        // Get productive sites from storage with timeout
        const timeout = setTimeout(() => {
            console.log('Timeout getting productive sites, using fallback');
            fallbackToDefaultSite();
        }, 3000);

        chrome.runtime.sendMessage({ action: 'getProductiveSites' }, (response) => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
                console.error('Runtime error:', chrome.runtime.lastError.message);
                fallbackToDefaultSite();
                return;
            }

            const productiveSites = response || [];
            console.log('Retrieved productive sites:', productiveSites);
            
            if (productiveSites.length === 0) {
                console.log('No productive sites found, using defaults');
                fallbackToDefaultSite();
            } else {
                // Pick a random site from user's productive sites list
                const randomSite = productiveSites[Math.floor(Math.random() * productiveSites.length)];
                console.log('Redirecting to productive site:', randomSite);
                
                // Ensure the URL has a protocol
                const url = randomSite.startsWith('http') ? randomSite : `https://${randomSite}`;
                window.location.href = url;
            }
        });
    } catch (error) {
        console.error('Error getting productive sites:', error);
        fallbackToDefaultSite();
    }
}

function fallbackToDefaultSite() {
    // Fallback to some default productive sites if user hasn't added any
    const defaultSites = [
        'https://github.com',
        'https://stackoverflow.com',
        'https://docs.google.com'
    ];
    const randomSite = defaultSites[Math.floor(Math.random() * defaultSites.length)];
    console.log('Using fallback site:', randomSite);
    window.location.href = randomSite;
}

function loadBlockingStats() {
    // Get real data from Chrome storage
    chrome.storage.local.get([
        'blockedToday', 
        'timeSaved', 
        'streakDays', 
        'lastActiveDate',
        'totalBlockedSites'
    ], (result) => {
        // Get today's date
        const today = new Date().toDateString();
        
        // Blocked today count
        let blockedToday = 0;
        if (result.lastActiveDate === today && result.blockedToday) {
            blockedToday = result.blockedToday;
        } else {
            // Reset daily count if it's a new day
            chrome.storage.local.set({ 
                blockedToday: 1, 
                lastActiveDate: today 
            });
            blockedToday = 1;
        }
        
        // Time saved (estimate 5 minutes per blocked site)
        const timeSavedMinutes = blockedToday * 5;
        const hours = Math.floor(timeSavedMinutes / 60);
        const minutes = timeSavedMinutes % 60;
        let timeSavedText = '';
        if (hours > 0) {
            timeSavedText = hours + 'h';
            if (minutes > 0) timeSavedText += ' ' + minutes + 'm';
        } else {
            timeSavedText = minutes + 'm';
        }
        
        // Streak days calculation
        let streakDays = result.streakDays || 1;
        if (result.lastActiveDate !== today) {
            // Check if yesterday was active to maintain streak
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (result.lastActiveDate === yesterday.toDateString()) {
                streakDays += 1;
            } else {
                streakDays = 1; // Reset streak
            }
            chrome.storage.local.set({ streakDays: streakDays });
        }
        
        // Update UI with real data
        const blockedTodayEl = document.getElementById('blockedToday');
        const timeSavedEl = document.getElementById('timeSaved');
        const streakDaysEl = document.getElementById('streakDays');

        if (blockedTodayEl) blockedTodayEl.textContent = blockedToday;
        if (timeSavedEl) timeSavedEl.textContent = timeSavedText;
        if (streakDaysEl) streakDaysEl.textContent = streakDays;
        
        // Update storage with current values
        chrome.storage.local.set({
            blockedToday: blockedToday,
            timeSaved: timeSavedMinutes,
            streakDays: streakDays,
            lastActiveDate: today
        });
    });
}

function checkFocusMode() {
    // Check if we're in a focus session
    chrome.storage.local.get(['focusSession'], (result) => {
        if (result.focusSession && result.focusSession.active) {
            showFocusTimer(result.focusSession);
        }
    });
}

function showFocusTimer(focusSession) {
    const timerElement = document.getElementById('focusTimer');
    if (timerElement) {
        timerElement.classList.remove('initially-hidden');
        timerElement.style.display = 'block';
    }

    function updateTimer() {
        const now = Date.now();
        const remaining = focusSession.endTime - now;
        const total = focusSession.endTime - focusSession.startTime;

        if (remaining <= 0) {
            if (timerElement) {
                timerElement.style.display = 'none';
            }
            return;
        }

        const minutes = Math.floor(remaining / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) {
            timerDisplay.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        // Update progress bar
        const progress = ((total - remaining) / total) * 100;
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = progress + '%';
        }
    }

    updateTimer();
    setInterval(updateTimer, 1000);
}

function openProductivitySite() {
    const randomSite = productiveSites[Math.floor(Math.random() * productiveSites.length)];
    window.location.href = randomSite;
}

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = 'https://www.google.com';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initializePage);

// Update blocked count for today
chrome.storage.local.get(['blockedToday', 'lastActiveDate'], (result) => {
    const today = new Date().toDateString();
    let blockedToday = 1;
    
    if (result.lastActiveDate === today && result.blockedToday) {
        blockedToday = result.blockedToday + 1;
    }
    
    chrome.storage.local.set({ 
        blockedToday: blockedToday,
        lastActiveDate: today
    });
});

// Error handling for any image loading or other errors
window.addEventListener('error', (event) => {
    // Silently handle image loading errors and other issues
    if (event.target.tagName === 'IMG' || event.message.includes('icon') || event.message.includes('image')) {
        console.log('Image loading error handled:', event.message);
        event.preventDefault();
        return false;
    }
});

// Prevent any external resource loading errors
document.addEventListener('DOMContentLoaded', () => {
    // Remove any potentially problematic external references
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        if (img.src && (img.src.startsWith('http://') || img.src.startsWith('https://'))) {
            console.log('Removing external image reference:', img.src);
            img.remove();
        }
    });
});