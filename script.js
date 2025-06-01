document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const character = document.getElementById('interactive-character');
    const textBlocks = document.querySelectorAll('.text-block');
    const dialogueBubble = document.getElementById('dialogue-bubble');
    const searchBar = document.getElementById('search-bar');
    const bellButton = document.getElementById('bell-button');
    let searchResultsPopup = null;

    // --- Tab Navigation Elements ---
    const tabNavigationItems = document.querySelectorAll('.tab-navigation li');
    const tabContentPanes = document.querySelectorAll('.tab-content-area .tab-pane');

    // --- Critical Element Checks ---
    if (!character) { console.error("Interactive character element not found!"); return; }
    if (!dialogueBubble) console.error("Dialogue bubble element not found!");
    if (!searchBar) console.error("Search bar element not found!");
    if (!bellButton) console.error("Bell button element not found!");
    if (tabNavigationItems.length === 0 || tabContentPanes.length === 0) {
        console.warn("Tab navigation elements not found. Tab functionality will be disabled.");
    }

    // --- State Variables ... ---
    let currentAnimationName = null;
    let currentFrame = 0;
    let animationFrameId = null;
    let lastFrameTime = 0;
    const animationSpeed = 150;
    let isMoving = false;
    let targetX = 0;
    let targetY = 0;
    const moveSpeed = 2;
    let movementFrameId = null;
    let isHiding = false;
    let isHidden = false;
    let currentHidingSpot = null;
    let peekTimeoutId = null;
    let postPeekTimeoutId = null;
    let isTalking = false;
    let dialogueTimeoutId = null;
    let previousAnimationBeforeTalk = "IDLE";
    let isRespondingToSearch = false;
    let nextActionTimeoutId = null;
    let isCharacterOffScreen = false;
    let isCharacterEnabledByBell = false;
    let summonedInteractionTimeoutId = null;

    const animations = { /* ... animations object ... */
        "IDLE": [ { x: 0, y: 0 }, { x: -24, y: 0 }, { x: -48, y: 0 }, { x: -72, y: 0 }, { x: -96, y: 0 }, { x: -120, y: 0 } ],
        "WALK": [ { x: 0, y: -24 }, { x: -24, y: -24 }, { x: -48, y: -24 }, { x: -72, y: -24 }, { x: -96, y: -24 }, { x: -120, y: -24 } ],
        "RUN": [ { x: 0, y: -48 }, { x: -24, y: -48 }, { x: -48, y: -48 }, { x: -72, y: -48 }, { x: -96, y: -48 }, { x: -120, y: -48 } ],
        "SIT": [ { x: 0, y: -120 }, { x: -24, y: -120 } ]
    };

    function startSummonedInteractionLoop() { /* ... (already updated in previous step, ensure it's correct) ... */
        console.log("Entering startSummonedInteractionLoop");
        if (!character || character.style.display === 'none' || isCharacterOffScreen) {
            if (summonedInteractionTimeoutId) clearTimeout(summonedInteractionTimeoutId);
            summonedInteractionTimeoutId = null;
            console.log("startSummonedInteractionLoop: Character not present or visible, loop not started.");
            if (getCurrentActiveTab() === "main" && !isCharacterOffScreen) {
                 scheduleNextAction();
            }
            return;
        }
        if (summonedInteractionTimeoutId) clearTimeout(summonedInteractionTimeoutId);
        playAnimation("IDLE");
        console.log("Summoned interaction loop started/restarted. Character will leave in 5s if not clicked or talked to.");

        summonedInteractionTimeoutId = setTimeout(() => {
            if (!isTalking && !isRespondingToSearch) {
                console.log("Summoned interaction timeout. Character running off screen.");
                const currentTabDuringTimeout = getCurrentActiveTab();
                characterRunOffscreen(() => {
                    if (currentTabDuringTimeout === "main") {
                        console.log("Summoned loop timed out on Main Tab, character ran off, now rescheduling actions.");
                        // isCharacterOffScreen is set true by characterRunOffscreen's callback
                        scheduleNextAction();
                    }
                    // If timeout occurs on non-main tab, character runs off, bell remains ON.
                    // isCharacterEnabledByBell remains true.
                });
            } else {
                console.log("Summoned interaction timeout: Character is busy, deferring run off. Will try again.");
                startSummonedInteractionLoop();
            }
            summonedInteractionTimeoutId = null;
        }, 5000);
    }

    function stopSpriteAnimation() { /* ... existing function ... */ }
    function spriteAnimate(timestamp) { /* ... existing function ... */ }
    window.playAnimation = function(animationNameInput) { /* ... existing function ... */ };
    function getRandomInterval(min, max) { /* ... existing function ... */ }
    function createDustPuff() { /* ... existing function ... */ }
    function generalMoveLoop(onArrivalCallback) { /* ... existing function ... */ }
    function clearAllTimeouts() { /* ... existing function ... */ }
    function getCurrentActiveTab() { /* ... existing function ... */ }
    function interruptCharacterActions(makeInvisible = false) { /* ... existing function ... */ }
    function characterRunOffscreen(onTrulyOffScreenCallback = null) { /* ... (already updated in previous step, ensure it's correct) ... */
        console.log("Entering characterRunOffscreen");
        if (!character || (isCharacterOffScreen && character.style.display === 'none')) {
            console.log("characterRunOffscreen: Already off-screen and hidden, or no character.");
            if (typeof onTrulyOffScreenCallback === 'function') {
                onTrulyOffScreenCallback();
            }
            return;
        }

        interruptCharacterActions(false); // Important: This now also clears summonedInteractionTimeoutId
        isCharacterOffScreen = false;
        isMoving = true;

        const charRect = character.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();

        if (searchBar) {
            const searchBarRect = searchBar.getBoundingClientRect();
            if (searchBarRect.left + (searchBarRect.width / 2) < bodyRect.width / 2) {
                targetX = - (character.offsetWidth || 24) - 20;
            } else { targetX = bodyRect.width + 20; }
        } else { targetX = bodyRect.width + 20; }
        targetY = character.offsetTop;

        console.log(`characterRunOffscreen: Target X: ${targetX}, Target Y: ${targetY}`);
        playAnimation("RUN");
        generalMoveLoop(() => {
            if(character) character.style.display = 'none';
            isCharacterOffScreen = true;
            isMoving = false;
            stopSpriteAnimation();
            if(character) character.style.transform = '';
            console.log("Character ran off-screen and arrived.");
            if (typeof onTrulyOffScreenCallback === 'function') {
                onTrulyOffScreenCallback();
            }
        });
    }

    function interruptAllActionsForSearch() {
        console.log("Entering interruptAllActionsForSearch");
        isRespondingToSearch = true;
        interruptCharacterActions(false); // This clears summonedInteractionTimeoutId
        isCharacterOffScreen = false;
        if(character) character.style.display = 'block';

        const currentTab = getCurrentActiveTab();
        if (currentTab === "main") { // Only reset bell if "come" used on main tab
            isCharacterEnabledByBell = false;
            if (bellButton) {
                bellButton.textContent = '🔔';
                bellButton.classList.remove('bell-active');
                bellButton.classList.add('bell-inactive');
            }
        }
        // If "come" used on non-main tab (via bell), isCharacterEnabledByBell and bell visual state remain ON.
    }

    function scheduleNextAction() { /* ... existing function with console logs ... */ }
    function startRandomMovement() { /* ... existing function with console logs ... */ }
    function startHiding() { /* ... existing function with console logs ... */ }
    function peek() { /* ... existing function with console logs ... */ }
    function finishHiding() { /* ... existing function with console logs ... */ }
    function showDialogueOrHideBubble() { /* ... (already updated in previous step, ensure it's correct) ... */ }
    if (character) character.addEventListener('click', showDialogueOrHideBubble);

    // --- Bell Button Logic ---
    if (bellButton) {
        bellButton.addEventListener('click', () => {
            if (bellButton.style.display === 'none') return;

            isCharacterEnabledByBell = !isCharacterEnabledByBell;

            if (isCharacterEnabledByBell) {
                bellButton.textContent = '🔔 On';
                bellButton.classList.add('bell-active');
                bellButton.classList.remove('bell-inactive');
                if(searchBar) { setTimeout(() => { searchBar.focus(); }, 300); }
            } else {
                bellButton.textContent = '🔔 Off';
                bellButton.classList.remove('bell-active');
                bellButton.classList.add('bell-inactive');
            }
        });
    }

    function clearSearchHighlights() { /* ... existing ... */ }
    function performSearch(searchTerm) { /* ... existing ... */ }
    function displaySearchResults(results, searchTerm) { /* ... existing ... */ }
    if (searchBar) { /* ... (already updated in previous step, ensure it's correct) ... */ }

    // --- Tab Navigation Logic ---
    if (tabNavigationItems.length > 0 && tabContentPanes.length > 0) {
        tabNavigationItems.forEach(tab => {
            tab.addEventListener('click', (event) => {
                const newlyClickedTabName = event.currentTarget.dataset.tab;
                const previousActiveTabName = getCurrentActiveTab();
                if (previousActiveTabName === newlyClickedTabName) return;

                // Unconditionally reset bell state when changing tabs
                isCharacterEnabledByBell = false;
                if (bellButton) {
                    bellButton.classList.remove('bell-active');
                    bellButton.classList.add('bell-inactive'); // Or rely on default style
                    bellButton.textContent = '🔔 Off'; // Or default '🔔'
                }

                if (newlyClickedTabName !== "main") { // Switched to a non-main tab
                    if (bellButton) bellButton.style.display = 'flex';
                    if (character && !isTalking && !isRespondingToSearch && !isHidden && !isCharacterOffScreen) {
                        characterRunOffscreen();
                    }
                } else { // Switched to the main tab
                    if (bellButton) bellButton.style.display = 'none';
                }

                tabNavigationItems.forEach(item => item.classList.remove('active-tab'));
                event.currentTarget.classList.add('active-tab');
                tabContentPanes.forEach(pane => pane.classList.remove('active-content'));
                const targetPane = document.getElementById(`tab-${newlyClickedTabName}`);
                if (targetPane) targetPane.classList.add('active-content');

                clearSearchHighlights();
                if (searchResultsPopup) searchResultsPopup.style.display = 'none';

                setTimeout(scheduleNextAction, 50);
            });
        });
    }
     if (character) { /* ... (Initialization) ... */ }
});
