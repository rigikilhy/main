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

    function startSummonedInteractionLoop() { /* ... existing function ... */
        if (!character || character.style.display === 'none' || isCharacterOffScreen) {
            if (summonedInteractionTimeoutId) clearTimeout(summonedInteractionTimeoutId);
            summonedInteractionTimeoutId = null;
            return;
        }
        if (summonedInteractionTimeoutId) clearTimeout(summonedInteractionTimeoutId);
        playAnimation("IDLE");
        console.log("Summoned interaction loop started/restarted. Character will leave in 5s if not clicked or talked to.");
        summonedInteractionTimeoutId = setTimeout(() => {
            if (!isTalking && !isRespondingToSearch) {
                console.log("Summoned interaction timeout. Character running off screen.");
                characterRunOffscreen();
            } else {
                console.log("Summoned interaction timeout: Character is busy, deferring run off.");
            }
            summonedInteractionTimeoutId = null;
        }, 5000);
    }
    function stopSpriteAnimation() { /* ... existing function ... */
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        currentAnimationName = null;
    }
    function spriteAnimate(timestamp) { /* ... existing function ... */
        if (!currentAnimationName || !character) return;
        if (timestamp - lastFrameTime > animationSpeed) {
            lastFrameTime = timestamp;
            const frames = animations[currentAnimationName];
            if (!frames) return;
            currentFrame = (currentFrame + 1) % frames.length;
            const frame = frames[currentFrame];
            character.style.backgroundPosition = `${frame.x}px ${frame.y}px`;
        }
        animationFrameId = requestAnimationFrame(spriteAnimate);
    }
    window.playAnimation = function(animationNameInput) { /* ... existing function ... */
        if (animationNameInput && !animations[animationNameInput]) {
            console.error("Unknown animation:", animationNameInput);
            return;
        }
        stopSpriteAnimation();
        currentAnimationName = animationNameInput;
        if (currentAnimationName) {
             currentFrame = -1;
             lastFrameTime = performance.now() - animationSpeed;
             animationFrameId = requestAnimationFrame(spriteAnimate);
        }
    };
    function getRandomInterval(min, max) { /* ... existing function ... */
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function createDustPuff() { /* ... existing function ... */
        if (isRespondingToSearch || !character || character.style.display === 'none' || isCharacterOffScreen) return;
        const dustPuff = document.createElement('div');
        dustPuff.style.width = '5px'; dustPuff.style.height = '5px';
        dustPuff.style.backgroundColor = '#88888880'; dustPuff.style.borderRadius = '50%';
        dustPuff.style.position = 'absolute';
        dustPuff.style.left = `${character.offsetLeft + character.offsetWidth / 2 - 2}px`;
        dustPuff.style.top = `${character.offsetTop + character.offsetHeight - 2}px`;
        dustPuff.style.opacity = '1';
        dustPuff.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        document.body.appendChild(dustPuff);
        setTimeout(() => {
            dustPuff.style.opacity = '0';
            dustPuff.style.transform = `translateY(-10px) scale(0.5)`;
        }, 0);
        setTimeout(() => { if (dustPuff.parentElement) dustPuff.parentElement.removeChild(dustPuff); }, 500);
    }
    function generalMoveLoop(onArrivalCallback) { /* ... existing function ... */
        if (!((isMoving || isRespondingToSearch) && !isTalking) || !character) {
            if (movementFrameId) cancelAnimationFrame(movementFrameId);
            movementFrameId = null;
            return;
        }
        let currentX = parseFloat(character.style.left || '0');
        let currentY = parseFloat(character.style.top || '0');
        let dx = targetX - currentX; let dy = targetY - currentY;
        const effectiveMoveSpeed = (currentAnimationName === "RUN" || isRespondingToSearch) ? moveSpeed * 1.5 : moveSpeed;
        const arrivalThreshold = effectiveMoveSpeed * 1.1;
        if (Math.abs(dx) < arrivalThreshold && Math.abs(dy) < arrivalThreshold) {
            character.style.left = `${targetX}px`; character.style.top = `${targetY}px`;
            if (movementFrameId) cancelAnimationFrame(movementFrameId);
            movementFrameId = null;
            onArrivalCallback();
            return;
        }
        if (Math.abs(dx) > 0) currentX += Math.sign(dx) * effectiveMoveSpeed;
        if (Math.abs(dy) > 0) currentY += Math.sign(dy) * effectiveMoveSpeed;
        character.style.left = `${currentX}px`; character.style.top = `${currentY}px`;
        if (isMoving && !isCharacterOffScreen && !isRespondingToSearch && currentAnimationName === "WALK" && Math.random() < 0.3) {
             createDustPuff();
        }
        movementFrameId = requestAnimationFrame(() => generalMoveLoop(onArrivalCallback));
    }
    function clearAllTimeouts() { /* ... existing function ... */
        if (nextActionTimeoutId) clearTimeout(nextActionTimeoutId);
        if (dialogueTimeoutId) clearTimeout(dialogueTimeoutId);
        if (peekTimeoutId) clearTimeout(peekTimeoutId);
        if (postPeekTimeoutId) clearTimeout(postPeekTimeoutId);
        if (summonedInteractionTimeoutId) clearTimeout(summonedInteractionTimeoutId);
        nextActionTimeoutId = dialogueTimeoutId = peekTimeoutId = postPeekTimeoutId = summonedInteractionTimeoutId = null;
    }
    function getCurrentActiveTab() { /* ... existing function ... */
        const activeTab = document.querySelector('.tab-navigation li.active-tab');
        return activeTab ? activeTab.dataset.tab : null;
    }
    function interruptCharacterActions(makeInvisible = false) { /* ... existing function ... */
        clearAllTimeouts();
        if (movementFrameId) cancelAnimationFrame(movementFrameId);
        movementFrameId = null;
        isMoving = false;

        if (isHiding || isHidden) {
            if (character) {
                character.style.zIndex = '100';
                character.style.transform = 'translateY(0px)';
            }
            isHidden = false; isHiding = false; currentHidingSpot = null;
        }
        if (isTalking) {
            if (dialogueBubble) dialogueBubble.style.display = 'none';
            isTalking = false;
        }
        stopSpriteAnimation();
        if (character) {
            if (makeInvisible) {
                character.style.display = 'none';
                isCharacterOffScreen = true;
            } else if (character.style.display === 'none' && !isCharacterOffScreen && !isRespondingToSearch) {
                 character.style.display = 'block';
            }
        }
    }
    function characterRunOffscreen() { /* ... existing function ... */
        if (!character || isCharacterOffScreen) return;
        interruptCharacterActions(false);
        isCharacterOffScreen = false;
        isMoving = true;
        const charRect = character.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();
        if (searchBar) {
            const searchBarRect = searchBar.getBoundingClientRect();
            if (searchBarRect.left + (searchBarRect.width / 2) < bodyRect.width / 2) {
                targetX = -charRect.width - 20;
            } else { targetX = bodyRect.width + 20; }
        } else { targetX = bodyRect.width + 20; }
        targetY = charRect.top;
        playAnimation("RUN");
        generalMoveLoop(() => {
            if(character) character.style.display = 'none';
            isCharacterOffScreen = true;
            isMoving = false;
            stopSpriteAnimation();
            if(character) character.style.transform = '';
            console.log("Character ran off-screen.");
        });
    }

    function interruptAllActionsForSearch() { // Called when "come" is successful
        isRespondingToSearch = true;
        interruptCharacterActions(false);
        isCharacterOffScreen = false;
        if(character) character.style.display = 'block';

        // Reset bell state as its purpose (enabling "come") is fulfilled
        isCharacterEnabledByBell = false;
        if (bellButton) {
            bellButton.textContent = '🔔';
            bellButton.classList.remove('bell-active');
            // Consider adding 'bell-inactive' or relying on default styles
        }
    }

    function scheduleNextAction() { /* ... existing function ... */
        clearTimeout(nextActionTimeoutId);
        if (summonedInteractionTimeoutId !== null) return;
        const currentTab = getCurrentActiveTab();
        if (currentTab !== "main") {
            if (!isCharacterOffScreen && character && character.style.display !== 'none') {
                characterRunOffscreen();
            }
            return;
        }
        if (character && (isCharacterOffScreen || character.style.display === 'none') && !isHidden && !isRespondingToSearch && !isTalking) {
             character.style.display = 'block';
             isCharacterOffScreen = false;
             if (!character.style.left || parseFloat(character.style.left) < 0 || parseFloat(character.style.left) > window.innerWidth) {
                character.style.left = `${window.innerWidth / 2 - character.offsetWidth / 2}px`;
             }
             if (!character.style.top || parseFloat(character.style.top) < 0 || parseFloat(character.style.top) > window.innerHeight) {
                character.style.top = `${window.innerHeight / 2 - character.offsetHeight / 2}px`;
             }
             playAnimation("IDLE");
        }
        if (isTalking || isMoving || isHiding || isRespondingToSearch || isCharacterOffScreen || (character && character.style.display === 'none')) return;
        const actionDelay = isHidden ? getRandomInterval(3000, 6000) : getRandomInterval(5000, 10000);
        if (Math.random() < 0.25 && textBlocks && textBlocks.length > 0 && !isHidden) {
            nextActionTimeoutId = setTimeout(startHiding, actionDelay);
        } else {
            nextActionTimeoutId = setTimeout(startRandomMovement, actionDelay);
        }
    }
    function startRandomMovement() { /* ... existing function ... */
         if (isMoving || isHiding || isHidden || isTalking || isRespondingToSearch || isCharacterOffScreen || !character || character.style.display === 'none' || summonedInteractionTimeoutId !== null) return;
        isMoving = true; playAnimation("WALK"); previousAnimationBeforeTalk = "IDLE";
        const charRect = character.getBoundingClientRect(); const bodyRect = document.body.getBoundingClientRect();
        if (Math.random() < 0.5) {
            targetX = Math.random() * (bodyRect.width - charRect.width);
            targetY = parseFloat(character.style.top || '0');
        } else {
            targetX = parseFloat(character.style.left || '0');
            targetY = Math.random() * (bodyRect.height - charRect.height);
        }
        targetX = Math.max(0, Math.min(targetX, bodyRect.width - charRect.width));
        targetY = Math.max(0, Math.min(targetY, bodyRect.height - charRect.height));
        generalMoveLoop(() => {
            if (!isRespondingToSearch) {
                isMoving = false; playAnimation("IDLE"); scheduleNextAction();
            }
        });
    }
    function startHiding() { /* ... existing function ... */
        if (isMoving || isHiding || isHidden || isTalking || isRespondingToSearch || isCharacterOffScreen || !textBlocks || textBlocks.length === 0 || !character || character.style.display === 'none' || summonedInteractionTimeoutId !== null) {
            if (!isMoving && !isHiding && !isHidden && !isTalking && !isRespondingToSearch && !isCharacterOffScreen && summonedInteractionTimeoutId === null) scheduleNextAction();
            return;
        }
        isHiding = true; currentHidingSpot = textBlocks[Math.floor(Math.random() * textBlocks.length)];
        const spotRect = currentHidingSpot.getBoundingClientRect(); const charRect = character.getBoundingClientRect();
        targetX = spotRect.left + window.scrollX + 5; targetY = spotRect.top + window.scrollY + 5;
        targetX = Math.max(0, Math.min(targetX, document.body.scrollWidth - charRect.width));
        targetY = Math.max(0, Math.min(targetY, document.body.scrollHeight - charRect.height));
        playAnimation("WALK"); previousAnimationBeforeTalk = "SIT";
        generalMoveLoop(() => {
            if (!isRespondingToSearch) {
                if(character) character.style.zIndex = '1';
                isHidden = true; playAnimation("SIT");
                clearTimeout(peekTimeoutId); peekTimeoutId = setTimeout(peek, getRandomInterval(2000, 3000));
            }
        });
    }
    function peek() { /* ... existing function ... */
        if (!isHidden || !isHiding || isTalking || isRespondingToSearch || isCharacterOffScreen || !character || character.style.display === 'none' || summonedInteractionTimeoutId !== null) return;
        const peekAmount = -10;
        if(character) {
            character.style.transition = 'transform 0.3s ease-in-out';
            character.style.transform = `translateY(${peekAmount}px)`;
        }
        clearTimeout(postPeekTimeoutId);
        postPeekTimeoutId = setTimeout(() => {
            if (isRespondingToSearch || !character) return;
            character.style.transform = 'translateY(0px)';
            clearTimeout(nextActionTimeoutId);
            nextActionTimeoutId = setTimeout(finishHiding, getRandomInterval(1000, 2000) + 300);
        }, 500);
    }
    function finishHiding() { /* ... existing function ... */
        if (!isHiding || isRespondingToSearch || isCharacterOffScreen || !character || summonedInteractionTimeoutId !== null) return;
         if(character) {
            character.style.zIndex = '100'; character.style.transition = '';
        }
        isHidden = false; isHiding = false; currentHidingSpot = null;
        playAnimation("IDLE"); previousAnimationBeforeTalk = "IDLE";
        scheduleNextAction();
    }
    function showDialogueOrHideBubble() { /* ... existing function ... */
        if (isRespondingToSearch || isCharacterOffScreen || !character || !dialogueBubble || character.style.display === 'none') return;
        if (isTalking) {
            dialogueBubble.style.display = 'none'; dialogueBubble.classList.remove('pointing-up', 'pointing-down');
            if (dialogueTimeoutId) clearTimeout(dialogueTimeoutId); dialogueTimeoutId = null;
            isTalking = false; playAnimation(previousAnimationBeforeTalk);
            if (summonedInteractionTimeoutId !== null) startSummonedInteractionLoop();
            else scheduleNextAction();
        } else {
            if (isMoving || (isHiding && !isHidden)) return;
            isTalking = true;
            if (movementFrameId) { cancelAnimationFrame(movementFrameId); movementFrameId = null; }
            previousAnimationBeforeTalk = isHidden ? "SIT" : (currentAnimationName || "IDLE");
            stopSpriteAnimation();
            dialogueBubble.textContent = "What can I help you with?";
            if (summonedInteractionTimeoutId !== null) startSummonedInteractionLoop();
            const charRect = character.getBoundingClientRect();
            dialogueBubble.style.display = 'block';
            let bubbleWidth = dialogueBubble.offsetWidth; let bubbleHeight = dialogueBubble.offsetHeight;
            dialogueBubble.style.display = 'none';
            const bubbleVerticalOffset = 15;
            let bubbleLeft = charRect.left + window.scrollX + (charRect.width / 2) - (bubbleWidth / 2);
            let bubbleTop = charRect.top + window.scrollY - bubbleHeight - bubbleVerticalOffset;
            dialogueBubble.classList.remove('pointing-up', 'pointing-down');
            if (bubbleTop < (window.scrollY + 5) || (charRect.top < bubbleHeight + bubbleVerticalOffset)) {
                bubbleTop = charRect.bottom + window.scrollY + bubbleVerticalOffset;
                dialogueBubble.classList.add('pointing-up');
            } else { dialogueBubble.classList.add('pointing-down'); }
            if (bubbleLeft < (window.scrollX + 5)) bubbleLeft = window.scrollX + 5;
            if ((bubbleLeft + bubbleWidth) > (window.scrollX + document.documentElement.clientWidth - 5)) {
                bubbleLeft = window.scrollX + document.documentElement.clientWidth - bubbleWidth - 5;
            }
            dialogueBubble.style.left = `${bubbleLeft}px`; dialogueBubble.style.top = `${bubbleTop}px`;
            dialogueBubble.style.display = 'block';
            if (dialogueTimeoutId) clearTimeout(dialogueTimeoutId);
            dialogueTimeoutId = setTimeout(() => {
                if (!isTalking || isRespondingToSearch) return;
                dialogueBubble.style.display = 'none'; dialogueBubble.classList.remove('pointing-up', 'pointing-down');
                isTalking = false; playAnimation(previousAnimationBeforeTalk);
                if (summonedInteractionTimeoutId !== null) startSummonedInteractionLoop();
                else scheduleNextAction();
            }, getRandomInterval(4000, 7000));
        }
    }
    if (character) character.addEventListener('click', showDialogueOrHideBubble);

    // --- Bell Button Logic ---
    if (bellButton) {
        bellButton.addEventListener('click', () => {
            if (bellButton.style.display === 'none') return; // Only if visible

            isCharacterEnabledByBell = !isCharacterEnabledByBell; // Toggle state

            if (isCharacterEnabledByBell) {
                bellButton.textContent = '🔔 On';
                bellButton.classList.add('bell-active');
                bellButton.classList.remove('bell-inactive'); // If using specific inactive class
                if(searchBar) { setTimeout(() => { searchBar.focus(); }, 300); }
            } else {
                bellButton.textContent = '🔔 Off';
                bellButton.classList.remove('bell-active');
                bellButton.classList.add('bell-inactive'); // If using specific inactive class
            }
        });
    }

    // --- Search Functionality (SearchBar Event Listener & related functions) ---
    // ... (clearSearchHighlights, performSearch, displaySearchResults)
    function clearSearchHighlights() { /* ... existing ... */ }
    function performSearch(searchTerm) { /* ... existing ... */ }
    function displaySearchResults(results, searchTerm) { /* ... existing ... */ }

    if (searchBar) { /* ... existing searchBar listener ... */
        searchBar.addEventListener('input', () => {
            const searchTerm = searchBar.value.trim();
            if (searchTerm.toLowerCase() === "come") {
                if (!character) return;
                if (searchResultsPopup) searchResultsPopup.style.display = 'none';
                clearSearchHighlights();

                const currentTab = getCurrentActiveTab();
                if (currentTab === "main" || isCharacterEnabledByBell) {
                    if (currentTab !== "main") {
                        const mainTabNav = document.querySelector('.tab-navigation li[data-tab="main"]');
                        if (mainTabNav) mainTabNav.click();
                    }
                    interruptAllActionsForSearch(); // Resets bell state and text
                    playAnimation("RUN");
                    const searchBarRect = searchBar.getBoundingClientRect();
                    const charRect = character.getBoundingClientRect();
                    targetX = searchBarRect.left + window.scrollX - (character.offsetWidth || 24) - 10;
                    targetY = searchBarRect.top + window.scrollY + (searchBarRect.height / 2) - ((character.offsetHeight || 24) / 2);
                    targetX = Math.max(0, Math.min(targetX, document.body.scrollWidth - (character.offsetWidth || 24)));
                    targetY = Math.max(0, Math.min(targetY, document.body.scrollHeight - (character.offsetHeight || 24)));
                    generalMoveLoop(() => {
                        isRespondingToSearch = false;
                        if(searchBar) searchBar.value = "";
                        startSummonedInteractionLoop();
                    });

                } else {
                    console.log("Typed 'come' on a non-main tab without bell activation.");
                }
            } else {
                clearSearchHighlights();
                if (searchTerm.length < 3) {
                    if (searchResultsPopup) searchResultsPopup.style.display = 'none';
                    return;
                }
                performSearch(searchTerm);
            }
        });

        searchBar.addEventListener('blur', () => { /* ... existing ... */ });
        searchBar.addEventListener('focus', () => { /* ... existing ... */ });
    }


    // --- Tab Navigation Logic ---
    if (tabNavigationItems.length > 0 && tabContentPanes.length > 0) {
        tabNavigationItems.forEach(tab => {
            tab.addEventListener('click', (event) => {
                const newlyClickedTabName = event.currentTarget.dataset.tab;
                const previousActiveTabName = getCurrentActiveTab();
                if (previousActiveTabName === newlyClickedTabName) return;

                if (previousActiveTabName === "main" && newlyClickedTabName !== "main") {
                    if (bellButton) {
                        bellButton.style.display = 'flex';
                        // Default bell to OFF state when it appears due to tab switch
                        isCharacterEnabledByBell = false;
                        bellButton.classList.remove('bell-active');
                        bellButton.classList.add('bell-inactive'); // Ensure this class exists or default is "off"
                        bellButton.textContent = '🔔 Off'; // Or just '🔔'
                    }
                    if (character && !isTalking && !isRespondingToSearch && !isHidden && !isCharacterOffScreen) {
                        characterRunOffscreen();
                    }
                } else if (newlyClickedTabName === "main") {
                    if (bellButton) {
                        bellButton.style.display = 'none';
                        // Bell state is not changed here; only "come" command resets it after use.
                    }
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
