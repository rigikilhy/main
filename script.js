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

    function startSummonedInteractionLoop() {
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
                // const currentTabDuringTimeout = getCurrentActiveTab(); // No longer needed for this simplified logic
                characterRunOffscreen(); // No callback, character runs off and stays off.
                                         // If on a non-main tab, bell remains enabled.
                                         // If on main tab, it will just run off. New "come" needed.
            } else {
                console.log("Summoned interaction timeout: Character is busy, deferring run off. Will try again.");
                startSummonedInteractionLoop(); // Restart timer if busy
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
    function characterRunOffscreen(onTrulyOffScreenCallback = null) { /* ... existing function ... */ }
    function interruptAllActionsForSearch() { /* ... existing function ... */ }
    function scheduleNextAction() { /* ... existing function ... */ }
    function startRandomMovement() { /* ... existing function ... */ }
    function startHiding() { /* ... existing function ... */ }
    function peek() { /* ... existing function ... */ }
    function finishHiding() { /* ... existing function ... */ }
    function showDialogueOrHideBubble() { /* ... existing function ... */ }
    if (character) character.addEventListener('click', showDialogueOrHideBubble);
    if (bellButton) { /* ... existing bell logic ... */ }
    function clearSearchHighlights() { /* ... existing ... */ }
    function performSearch(searchTerm) { /* ... existing ... */ }
    function displaySearchResults(results, searchTerm) { /* ... existing ... */ }
    if (searchBar) { /* ... existing searchBar listener ... */ }
    if (tabNavigationItems.length > 0 && tabContentPanes.length > 0) { /* ... existing tab listener ... */ }
    if (character) { /* ... (Initialization) ... */ }
});
