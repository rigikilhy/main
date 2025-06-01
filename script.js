document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const character = document.getElementById('interactive-character');
    const textBlocks = document.querySelectorAll('.text-block');
    const dialogueBubble = document.getElementById('dialogue-bubble');
    const searchBar = document.getElementById('search-bar');
    const bellButton = document.getElementById('bell-button');
    let searchResultsPopup = null; // Will be created dynamically

    // --- Tab Navigation Elements ---
    const tabNavigationItems = document.querySelectorAll('.tab-navigation li');
    const tabContentPanes = document.querySelectorAll('.tab-content-area .tab-pane');

    // --- Critical Element Checks ---
    // ... (existing checks)

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
    let isRespondingToSearch = false; // True if character is moving due to "come"
    let nextActionTimeoutId = null;
    let isCharacterOffScreen = false;
    let isCharacterEnabledByBell = false;
    let summonedInteractionTimeoutId = null;

    const animations = {
        "IDLE": [ { x: 0, y: 0 }, { x: -24, y: 0 }, { x: -48, y: 0 }, { x: -72, y: 0 }, { x: -96, y: 0 }, { x: -120, y: 0 } ],
        "WALK": [ { x: 0, y: -24 }, { x: -24, y: -24 }, { x: -48, y: -24 }, { x: -72, y: -24 }, { x: -96, y: -24 }, { x: -120, y: -24 } ],
        "RUN": [ { x: 0, y: -48 }, { x: -24, y: -48 }, { x: -48, y: -48 }, { x: -72, y: -48 }, { x: -96, y: -48 }, { x: -120, y: -48 } ],
        "SIT": [ { x: 0, y: -216 }, { x: -24, y: -216 } ]
    };

    function startSummonedInteractionLoop() {
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

    // ... (stopSpriteAnimation, spriteAnimate, playAnimation, getRandomInterval, createDustPuff, generalMoveLoop)
    function stopSpriteAnimation() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        currentAnimationName = null;
    }

    function spriteAnimate(timestamp) {
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

    window.playAnimation = function(animationNameInput) {
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

    function getRandomInterval(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function createDustPuff() {
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

    function generalMoveLoop(onArrivalCallback) {
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


    function clearAllTimeouts() {
        if (nextActionTimeoutId) clearTimeout(nextActionTimeoutId);
        if (dialogueTimeoutId) clearTimeout(dialogueTimeoutId);
        if (peekTimeoutId) clearTimeout(peekTimeoutId);
        if (postPeekTimeoutId) clearTimeout(postPeekTimeoutId);
        if (summonedInteractionTimeoutId) clearTimeout(summonedInteractionTimeoutId);
        nextActionTimeoutId = dialogueTimeoutId = peekTimeoutId = postPeekTimeoutId = summonedInteractionTimeoutId = null;
    }

    function getCurrentActiveTab() {
        const activeTab = document.querySelector('.tab-navigation li.active-tab');
        return activeTab ? activeTab.dataset.tab : null;
    }

    function interruptCharacterActions(makeInvisible = false) {
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

    function characterRunOffscreen() {
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

    function interruptAllActionsForSearch() {
        isRespondingToSearch = true;
        interruptCharacterActions(false);
        isCharacterOffScreen = false;
        if(character) character.style.display = 'block';
        isCharacterEnabledByBell = false;
        if (bellButton) bellButton.textContent = '🔔';
    }

    function scheduleNextAction() {
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

    function startRandomMovement() {
        if (isMoving || isHiding || isHidden || isTalking || isRespondingToSearch || isCharacterOffScreen || !character || character.style.display === 'none' || summonedInteractionTimeoutId !== null) return;
        // ... (rest of function)
    }
    function startHiding() {
        if (isMoving || isHiding || isHidden || isTalking || isRespondingToSearch || isCharacterOffScreen || !textBlocks || textBlocks.length === 0 || !character || character.style.display === 'none' || summonedInteractionTimeoutId !== null) {
            if (!isMoving && !isHiding && !isHidden && !isTalking && !isRespondingToSearch && !isCharacterOffScreen && summonedInteractionTimeoutId === null) scheduleNextAction();
            return;
        }
        // ... (rest of function)
    }
    function peek() {
        if (!isHidden || !isHiding || isTalking || isRespondingToSearch || isCharacterOffScreen || !character || character.style.display === 'none' || summonedInteractionTimeoutId !== null) return;
        // ... (rest of function)
    }
    function finishHiding() {
        if (!isHiding || isRespondingToSearch || isCharacterOffScreen || !character || summonedInteractionTimeoutId !== null) return;
        // ... (rest of function)
    }

    function showDialogueOrHideBubble() {
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
            // ... (rest of positioning logic)
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

    if (bellButton) { /* ... (bell logic) ... */ }

    // --- Search Functionality ---
    function clearSearchHighlights() {
        tabContentPanes.forEach(pane => {
            const marks = pane.querySelectorAll('mark');
            marks.forEach(mark => {
                const parent = mark.parentNode;
                if (parent) { // Ensure parent exists
                    while (mark.firstChild) {
                        parent.insertBefore(mark.firstChild, mark);
                    }
                    parent.removeChild(mark);
                    parent.normalize(); // Merges adjacent text nodes
                }
            });
        });
    }

    function performSearch(searchTerm) {
        if (!searchTerm) return;
        const searchResults = [];
        const regExp = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); // Escape special regex chars

        tabContentPanes.forEach(pane => {
            const tabName = tabNavigationItems[Array.from(tabContentPanes).indexOf(pane)]?.textContent || pane.id;
            // Search within relevant text elements (e.g., p, h2, h3 within articles)
            pane.querySelectorAll('article p, article h2, article h3, .text-block').forEach(el => {
                // Avoid re-highlighting already processed elements in this search pass for a given pane
                // This simple check might not be perfect if elements have identical initial innerHTML
                // A more robust way would be to store original content and restore before each search.
                if (el.dataset.originalHtml === undefined) {
                     el.dataset.originalHtml = el.innerHTML; // Store only once
                } else {
                     el.innerHTML = el.dataset.originalHtml; // Restore before new search
                }


                if (regExp.test(el.textContent)) { // Test on textContent for matches
                    let matchFoundInElement = false;
                    // Highlight based on innerHTML to preserve structure
                    el.innerHTML = el.innerHTML.replace(regExp, (match) => {
                        matchFoundInElement = true;
                        return `<mark>${match}</mark>`;
                    });

                    if (matchFoundInElement) {
                         // Check if this element (or a very similar one) is already added for this tab
                        const existingResult = searchResults.find(r => r.tabId === pane.id && r.elementToScrollTo === el);
                        if (!existingResult) {
                            searchResults.push({
                                tabId: pane.id,
                                tabName: tabName,
                                elementToScrollTo: el,
                                snippet: el.textContent.substring(0, 150) + "..."
                            });
                        }
                    }
                }
            });
        });
        displaySearchResults(searchResults, searchTerm);
    }

    function displaySearchResults(results, searchTerm) {
        if (!searchResultsPopup) {
            searchResultsPopup = document.createElement('div');
            searchResultsPopup.id = 'search-results-popup';
            // Basic styling, will be enhanced by CSS
            searchResultsPopup.style.position = 'absolute';
            searchResultsPopup.style.top = `${(searchBar?.offsetTop || 0) + (searchBar?.offsetHeight || 0) + 5}px`;
            searchResultsPopup.style.left = `${searchBar?.offsetLeft || 0}px`;
            searchResultsPopup.style.width = `${searchBar?.offsetWidth || 250}px`;
            searchResultsPopup.style.border = '1px solid #ccc';
            searchResultsPopup.style.backgroundColor = 'white';
            searchResultsPopup.style.zIndex = '1001'; // Above most things
            searchResultsPopup.style.maxHeight = '300px';
            searchResultsPopup.style.overflowY = 'auto';
            const newsContainer = document.querySelector('.news-container');
            if (newsContainer) newsContainer.appendChild(searchResultsPopup); // Append to news-container
            else document.body.appendChild(searchResultsPopup); // Fallback to body
        }
        searchResultsPopup.innerHTML = ''; // Clear previous results

        if (results.length === 0) {
            searchResultsPopup.innerHTML = `<p style="padding:10px;">No results found for "<strong>${searchTerm}</strong>".</p>`;
        } else {
            results.forEach(result => {
                const item = document.createElement('div');
                item.className = 'search-result-item'; // For CSS styling
                // Basic styling for item
                item.style.padding = '8px 10px';
                item.style.borderBottom = '1px solid #eee';
                item.style.cursor = 'pointer';

                // Create snippet with highlighted term, careful with HTML in snippet
                let displaySnippet = result.snippet.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const regExp = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                displaySnippet = displaySnippet.replace(regExp, (match) => `<strong><mark>${match}</mark></strong>`);


                item.innerHTML = `Found in <strong>${result.tabName}</strong>: ${displaySnippet}`;
                item.addEventListener('mouseover', () => item.style.backgroundColor = '#f0f0f0');
                item.addEventListener('mouseout', () => item.style.backgroundColor = 'white');

                item.addEventListener('click', () => {
                    const targetTabNav = document.querySelector(`.tab-navigation li[data-tab="${result.tabId.replace('tab-', '')}"]`);
                    if (targetTabNav) targetTabNav.click(); // Simulate click to switch tab

                    // Ensure tab switch completes and content is visible before scrolling
                    setTimeout(() => {
                        if (result.elementToScrollTo && typeof result.elementToScrollTo.scrollIntoView === 'function') {
                             result.elementToScrollTo.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 100); // Small delay for tab switch

                    if (searchResultsPopup) searchResultsPopup.style.display = 'none';
                    if (searchBar) searchBar.value = searchTerm; // Keep search term in bar
                });
                searchResultsPopup.appendChild(item);
            });
        }
        if (searchResultsPopup) searchResultsPopup.style.display = 'block';
    }


    if (searchBar) {
        searchBar.addEventListener('input', () => {
            const searchTerm = searchBar.value.trim();
            if (searchTerm.toLowerCase() === "come") {
                if (!character) return;
                // Hide search results popup if "come" is typed
                if (searchResultsPopup) searchResultsPopup.style.display = 'none';
                clearSearchHighlights(); // Clear highlights when "come" is typed

                const currentTab = getCurrentActiveTab();
                if (currentTab === "main" || isCharacterEnabledByBell) {
                    if (currentTab !== "main") {
                        const mainTabNav = document.querySelector('.tab-navigation li[data-tab="main"]');
                        if (mainTabNav) mainTabNav.click();
                    }
                    interruptAllActionsForSearch();
                    playAnimation("RUN");
                    // ... (rest of "come" logic)
                    const searchBarRect = searchBar.getBoundingClientRect();
                    const charRect = character.getBoundingClientRect();
                    targetX = searchBarRect.left + window.scrollX - (character.offsetWidth || 24) - 10;
                    targetY = searchBarRect.top + window.scrollY + (searchBarRect.height / 2) - ((character.offsetHeight || 24) / 2);
                    targetX = Math.max(0, Math.min(targetX, document.body.scrollWidth - (character.offsetWidth || 24)));
                    targetY = Math.max(0, Math.min(targetY, document.body.scrollHeight - (character.offsetHeight || 24)));
                    generalMoveLoop(() => {
                        isRespondingToSearch = false;
                        if(searchBar) searchBar.value = ""; // Clear "come" from search bar
                        startSummonedInteractionLoop();
                    });

                } else {
                    console.log("Typed 'come' on a non-main tab without bell activation.");
                }
            } else { // General search
                clearSearchHighlights(); // Clear previous highlights immediately
                if (searchTerm.length < 3) {
                    if (searchResultsPopup) searchResultsPopup.style.display = 'none';
                    return;
                }
                performSearch(searchTerm);
            }
        });

        searchBar.addEventListener('blur', () => {
            // Hide results popup when search bar loses focus, after a short delay
            // to allow click on result item
            setTimeout(() => {
                if (searchResultsPopup && !searchResultsPopup.contains(document.activeElement)) { // Check if focus moved outside popup
                    searchResultsPopup.style.display = 'none';
                }
            }, 200);
        });
         searchBar.addEventListener('focus', () => {
            // Potentially re-show results if search term is still valid
            const searchTerm = searchBar.value.trim();
            if (searchTerm.length >= 3 && searchResultsPopup && searchResultsPopup.children.length > 0) {
                searchResultsPopup.style.display = 'block';
            }
        });
    }

    // ... (tabNavigationItems event listeners, Initialization)
    if (tabNavigationItems.length > 0 && tabContentPanes.length > 0) {
        tabNavigationItems.forEach(tab => {
            tab.addEventListener('click', (event) => {
                const newlyClickedTabName = event.currentTarget.dataset.tab;
                const previousActiveTabName = getCurrentActiveTab();
                if (previousActiveTabName === newlyClickedTabName) return;

                if (previousActiveTabName === "main" && newlyClickedTabName !== "main") {
                    if (bellButton) bellButton.style.display = 'flex';
                    if (character && !isTalking && !isRespondingToSearch && !isHidden && !isCharacterOffScreen) {
                        characterRunOffscreen();
                    }
                } else if (newlyClickedTabName === "main") {
                    if (bellButton) bellButton.style.display = 'none';
                }

                tabNavigationItems.forEach(item => item.classList.remove('active-tab'));
                event.currentTarget.classList.add('active-tab');
                tabContentPanes.forEach(pane => pane.classList.remove('active-content'));
                const targetPane = document.getElementById(`tab-${newlyClickedTabName}`);
                if (targetPane) targetPane.classList.add('active-content');

                // Clear search highlights and results when changing tabs
                clearSearchHighlights();
                if (searchResultsPopup) searchResultsPopup.style.display = 'none';


                setTimeout(scheduleNextAction, 50);
            });
        });
    }
     if (character) { /* ... (Initialization) ... */ }
});
