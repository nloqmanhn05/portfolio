/* ============================================================
   script.js — Interactive Scroll-Driven Scramble Sequence
   ============================================================ */

// ──────────────────────────────────────────────
// CONFIGURATION & TIMINGS
// ──────────────────────────────────────────────
// Speed of the forward letter-by-letter scramble animation in ms (higher = slower)
const SCRAMBLE_SPEED_MS = 1400;

// Speed of the "scramble back to name" animation in ms (right → left reveal)
const RETURN_TO_NAME_SPEED_MS = 1400;

// Duration to hold after the last role finishes scrambling, before the next
// scroll attempt is allowed to trigger the "return to name" sequence (in seconds)
const HOLD_AFTER_LAST_WORD_SEC = 1;

// DOM Elements
const navbar = document.getElementById('navbar');
const hero = document.getElementById('hero');
const scrollTitle = document.getElementById('scroll-title');
const scrollIndicator = document.getElementById('scroll-indicator-wave');
const typewriterEl = document.getElementById('typewriter');
const heroDude = document.querySelector('.hero-dude');

// Title Stages for Scroll Interaction
// index 0 = the user's NAME (special / distinct styling via .is-name class)
// index 1..n = ROLE stages (styled via .is-role class)
const STAGES = [
    "LOQMAN HAKIM",
    "Frontend Dev",
    "Graphic Designer"
];
const NAME_INDEX = 0;
const LAST_ROLE_INDEX = STAGES.length - 1;

let currentStageIndex = 0;              // Starts at 0 ("LOQMAN HAKIM")
let isScrambling = false;               // True during ANY scramble animation (forward or return)
let isHoldingAfterRole = false;         // True during the short pause after the last role finishes
let roleCycleComplete = false;          // True once the hold ends — next "down" scroll starts the return-to-name animation
let isReturningToName = false;          // True while the right-to-left "return to name" animation plays
let isScrollFullyUnlocked = false;      // True ONLY after the return-to-name animation completes
let lastScrollTime = 0;
let isTypewriterFinished = false;       // Prevents scroll sequence until typewriter finishes
let holdTimer = null;

// Ensure page starts at top & set initial title text
window.scrollTo(0, 0);
if (scrollTitle) {
    scrollTitle.textContent = STAGES[NAME_INDEX];
    scrollTitle.classList.add('is-name');
}

// Lock body scroll initially
document.body.classList.add('scroll-locked');


// ──────────────────────────────────────────────
// 1. TYPEWRITER & SEQUENCED REVEAL
// ──────────────────────────────────────────────
function revealHeroElements() {
    // 1. LOQMAN HAKIM fades in & slides up
    if (scrollTitle) {
        scrollTitle.classList.add('visible');
    }
    // 2. Waving Guy gif fades in & slides up
    if (heroDude) {
        heroDude.classList.add('visible');
    }
    // 3. Scroll Down text fades in (ALWAYS APPEARS)
    if (scrollIndicator) {
        scrollIndicator.classList.add('visible');
        scrollIndicator.classList.remove('hidden');
    }
}

if (typewriterEl) {
    const fullText = typewriterEl.textContent || "Hi! I am ";
    typewriterEl.textContent = "";
    let index = 0;

    function typeNextChar() {
        if (index < fullText.length) {
            typewriterEl.textContent += fullText.charAt(index);
            index++;
            setTimeout(typeNextChar, 110);
        } else {
            // "Hi! I am " has finished typing! Reveal LOQMAN HAKIM, WAVING GUY & SCROLL DOWN
            isTypewriterFinished = true;
            setTimeout(revealHeroElements, 150);
        }
    }

    // Start typing after brief initial delay
    setTimeout(typeNextChar, 300);
} else {
    // Fallback if element not present
    isTypewriterFinished = true;
    revealHeroElements();
}


// ──────────────────────────────────────────────
// 2. NAV COLOUR SWITCH + PARALLAX
// ──────────────────────────────────────────────
function handleScroll() {
    const scrolled = window.scrollY;
    const heroBottom = hero ? hero.offsetTop + hero.offsetHeight : window.innerHeight;

    // Switch nav style past the hero section
    if (navbar) {
        if (scrolled > heroBottom - 80) {
            navbar.classList.add('nav-scrolled');
        } else {
            navbar.classList.remove('nav-scrolled');
        }
    }

    // Parallax title drift
    if (scrollTitle && scrolled < heroBottom && scrollTitle.classList.contains('visible')) {
        const drift = scrolled * 0.13;
        scrollTitle.style.transform = `translateY(${drift}px)`;
    } else if (scrollTitle && scrolled === 0 && scrollTitle.classList.contains('visible')) {
        scrollTitle.style.transform = 'translateY(0)';
    }

    // Scroll Down indicator is ALWAYS visible while on the hero section once revealed
    if (scrollIndicator && isTypewriterFinished) {
        if (scrolled > 60) {
            scrollIndicator.classList.add('hidden');
        } else {
            scrollIndicator.classList.remove('hidden');
            scrollIndicator.classList.add('visible');
        }
    }
}

window.addEventListener('scroll', handleScroll, { passive: true });
handleScroll();


// ──────────────────────────────────────────────
// 3. LETTER-BY-LETTER SCRAMBLE ENGINE
// ──────────────────────────────────────────────
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';

/**
 * Scrambles text starting from NO ALPHABET (blank), revealing/locking the
 * CENTER letter(s) first and expanding outward — simultaneously LEFT and
 * RIGHT — until the first and last letters lock in last.
 * Used for every word transition: name → Developer → Graphic Designer →
 * (return) → name.
 */
function scrambleText(element, targetText, duration = SCRAMBLE_SPEED_MS, onComplete) {
    if (!element) return;
    const startTime = performance.now();
    const targetLen = targetText.length;

    if (targetLen === 0) {
        element.textContent = '';
        if (typeof onComplete === 'function') onComplete();
        return;
    }

    // Center point of the string (can land between two letters for even lengths —
    // that's fine, both middle letters end up equidistant and reveal together)
    const centerIndex = (targetLen - 1) / 2;

    // Distance of each letter from the center, and the largest such distance
    const distances = new Array(targetLen);
    let maxDistance = 0;
    for (let i = 0; i < targetLen; i++) {
        const d = Math.abs(i - centerIndex);
        distances[i] = d;
        if (d > maxDistance) maxDistance = d;
    }

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        let result = '';
        for (let i = 0; i < targetLen; i++) {
            const charTarget = targetText[i];
            const d = distances[i];
            const startProgress = maxDistance === 0 ? 0 : d / (maxDistance + 1);
            const endProgress = maxDistance === 0 ? 1 : (d + 1) / (maxDistance + 1);

            // This letter's ring hasn't expanded out to it yet — skip it
            // (since revealed letters always form a contiguous center-out block,
            // skipping keeps the visible text correctly formed)
            if (progress < startProgress) {
                continue;
            }

            // Once its ring has fully expanded past it, lock into the target character
            if (progress >= endProgress || progress >= 1) {
                result += charTarget;
            } else {
                // Currently active letter scrambling with random characters
                if (charTarget === ' ' || charTarget === '|') {
                    result += charTarget;
                } else {
                    const randomChar = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                    result += randomChar;
                }
            }
        }

        element.textContent = result;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = targetText;
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }
    }

    requestAnimationFrame(update);
}


// ──────────────────────────────────────────────
// 4. HOLD LOGIC (after last role finishes)
// ──────────────────────────────────────────────
// After "Graphic Designer" finishes scrambling in, we DON'T auto-unlock anymore.
// We hold briefly (so the last role is readable, and to swallow the same
// scroll gesture that just landed us here), then flag roleCycleComplete = true.
// The NEXT deliberate "down" scroll from the user will trigger the
// scramble-back-to-name animation instead of moving to a new stage.
function startRoleCompleteHold() {
    isHoldingAfterRole = true;

    if (holdTimer) clearTimeout(holdTimer);

    holdTimer = setTimeout(() => {
        isHoldingAfterRole = false;
        roleCycleComplete = true; // now armed — waiting for the next scroll-down
    }, HOLD_AFTER_LAST_WORD_SEC * 1000);
}

// Once the user scrolls again after the hold, this plays the reverse
// scramble back to the name and unlocks the page on completion.
function startReturnToName() {
    isReturningToName = true;
    isScrambling = true;
    roleCycleComplete = false;

    scrollTitle.classList.remove('is-role');

    scrambleText(scrollTitle, STAGES[NAME_INDEX], RETURN_TO_NAME_SPEED_MS, () => {
        isScrambling = false;
        isReturningToName = false;
        currentStageIndex = NAME_INDEX;
        scrollTitle.classList.add('is-name');

        // NOW fully unlock scrolling to the rest of the page
        isScrollFullyUnlocked = true;
        document.body.classList.remove('scroll-locked');
    });
}


// ──────────────────────────────────────────────
// 5. SCROLL STEPPER LOGIC (DOWN & UP)
// ──────────────────────────────────────────────
function handleStageChange(direction) {
    if (!isTypewriterFinished) return false;
    if (isScrambling || isHoldingAfterRole || isReturningToName) return false;

    const now = Date.now();
    const activeSpeed = roleCycleComplete ? RETURN_TO_NAME_SPEED_MS : SCRAMBLE_SPEED_MS;
    const scrollCooldown = activeSpeed + 100;
    if (now - lastScrollTime < scrollCooldown) return false;

    if (direction === 'down') {
        // Case A: role cycle already finished + held — this scroll triggers the return-to-name animation
        if (roleCycleComplete) {
            lastScrollTime = now;
            document.body.classList.add('scroll-locked');
            startReturnToName();
            return true;
        }

        // Case B: still stepping forward through the role stages
        if (currentStageIndex < LAST_ROLE_INDEX) {
            currentStageIndex++;
            lastScrollTime = now;
            isScrambling = true;

            document.body.classList.add('scroll-locked');
            scrollTitle.classList.remove('is-name');
            scrollTitle.classList.add('is-role');

            scrambleText(scrollTitle, STAGES[currentStageIndex], SCRAMBLE_SPEED_MS, () => {
                isScrambling = false;

                // Reached the last role ("Graphic Designer") — start the hold, then arm the return
                if (currentStageIndex === LAST_ROLE_INDEX) {
                    startRoleCompleteHold();
                }
            });
            return true;
        }
    } else if (direction === 'up') {
        // Step backward only when user is at the top of the hero, and hasn't fully unlocked yet
        if (window.scrollY <= 10 && currentStageIndex > NAME_INDEX) {
            currentStageIndex--;
            lastScrollTime = now;
            isScrambling = true;
            isScrollFullyUnlocked = false;
            isHoldingAfterRole = false;
            roleCycleComplete = false;
            if (holdTimer) clearTimeout(holdTimer);

            document.body.classList.add('scroll-locked');

            if (currentStageIndex === NAME_INDEX) {
                scrollTitle.classList.remove('is-role');
                scrollTitle.classList.add('is-name');
            }

            scrambleText(scrollTitle, STAGES[currentStageIndex], SCRAMBLE_SPEED_MS, () => {
                isScrambling = false;
            });
            return true;
        }
    }
    return false;
}


// ──────────────────────────────────────────────
// 6. EVENT LISTENERS (WHEEL, TOUCH, KEYBOARD)
// ──────────────────────────────────────────────
function isScrollUnlocked() {
    return isTypewriterFinished && isScrollFullyUnlocked && !isScrambling && !isHoldingAfterRole && !isReturningToName;
}

// Mouse Wheel / Trackpad
window.addEventListener('wheel', (e) => {
    if (!isTypewriterFinished) {
        e.preventDefault();
        return;
    }

    if (e.deltaY > 0) {
        if (!isScrollUnlocked()) {
            e.preventDefault();
            window.scrollTo(0, 0);
            handleStageChange('down');
        }
    } else if (e.deltaY < 0) {
        if (window.scrollY <= 10 && currentStageIndex > NAME_INDEX) {
            e.preventDefault();
            window.scrollTo(0, 0);
            handleStageChange('up');
        }
    }
}, { passive: false });

// Touch Devices (Mobile / Tablet)
let touchStartY = 0;
window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (!isTypewriterFinished) {
        if (e.cancelable) e.preventDefault();
        return;
    }
    if (!e.touches || e.touches.length === 0) return;
    const touchCurrentY = e.touches[0].clientY;
    const deltaY = touchStartY - touchCurrentY;

    if (deltaY > 15) {
        if (!isScrollUnlocked()) {
            if (e.cancelable) e.preventDefault();
            window.scrollTo(0, 0);
            if (handleStageChange('down')) {
                touchStartY = touchCurrentY;
            }
        }
    } else if (deltaY < -15) {
        if (window.scrollY <= 10 && currentStageIndex > NAME_INDEX) {
            if (e.cancelable) e.preventDefault();
            window.scrollTo(0, 0);
            if (handleStageChange('up')) {
                touchStartY = touchCurrentY;
            }
        }
    }
}, { passive: false });

// Keyboard Controls (ArrowDown / ArrowUp / PageDown / PageUp / Space)
window.addEventListener('keydown', (e) => {
    if (!isTypewriterFinished) return;
    const downKeys = ['ArrowDown', 'PageDown', 'Space', 'Down'];
    const upKeys = ['ArrowUp', 'PageUp', 'Up'];

    if (downKeys.includes(e.key)) {
        if (!isScrollUnlocked()) {
            e.preventDefault();
            handleStageChange('down');
        }
    } else if (upKeys.includes(e.key)) {
        if (window.scrollY <= 10 && currentStageIndex > NAME_INDEX) {
            e.preventDefault();
            handleStageChange('up');
        }
    }
}, { passive: false });

// Navbar Links interaction
const navLinks = document.querySelectorAll('.nav-links a');
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        if (!isScrollUnlocked()) {
            e.preventDefault();
            if (isTypewriterFinished) {
                handleStageChange('down');
            }
        }
    });
});


// ──────────────────────────────────────────────
// 7. SCROLL REVEAL (Dark Sections)
// ──────────────────────────────────────────────
const reveals = document.querySelectorAll('.reveal');

function revealOnScroll() {
    reveals.forEach(el => {
        const top = el.getBoundingClientRect().top;
        if (top < window.innerHeight - 100) {
            el.classList.add('active');
        }
    });
}

window.addEventListener('scroll', revealOnScroll, { passive: true });
revealOnScroll();


// ──────────────────────────────────────────────
// 8. ACCORDION DROPDOWN INTERACTION
// ──────────────────────────────────────────────
const accordionHeaders = document.querySelectorAll('.accordion-header');

accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
        const item = header.parentElement;
        const content = item.querySelector('.accordion-content');
        const isOpen = item.classList.contains('active');

        if (isOpen) {
            item.classList.remove('active');
            header.setAttribute('aria-expanded', 'false');
            content.style.maxHeight = null;
        } else {
            item.classList.add('active');
            header.setAttribute('aria-expanded', 'true');
            content.style.maxHeight = content.scrollHeight + 'px';
        }
    });
});

/* ============================================================
ENGINEERING CARDS + PORTFOLIO CARD — FOLLOW CURSOR HOVER BUTTON
============================================================ */

const engineeringCards = document.querySelectorAll(
    '.engineering-grid .project-card, .portfolio-card'
);

engineeringCards.forEach(card => {
    const btn = card.querySelector('.view-repo-btn');


    if (!btn) return;

    // Follow cursor inside the card
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        btn.style.left = `${x}px`;
        btn.style.top = `${y}px`;
    });

    // Show button when entering the card
    card.addEventListener('mouseenter', () => {
        btn.style.opacity = '1';
    });

    // Hide button when leaving the card
    card.addEventListener('mouseleave', () => {
        btn.style.opacity = '0';
    });


});