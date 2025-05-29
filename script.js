document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const character = document.getElementById('interactive-character');
    const textBlocks = document.querySelectorAll('.text-block'); // Used for hiding spots
    const dialogueBubble = document.getElementById('dialogue-bubble');
    const searchBar = document.getElementById('search-bar');

    // --- Critical Element Checks ---
    if (!character) {
        console.error("Interactive character element not found!");
        return; // Stop script execution if character is missing
    }
    if (!dialogueBubble) {
        console.error("Dialogue bubble element not found!");
        // Non-critical, some features might still work
    }
    if (!searchBar) {
        console.error("Search bar element not found!");
        // Non-critical, some features might still work
    }

    // --- Animation & Sprite State ---
    let currentAnimationName = null; // Name of the current animation (e.g., "IDLE", "WALK")
    let currentFrame = 0;            // Index of the current frame in the animation sequence
    let animationFrameId = null;     // ID returned by requestAnimationFrame for sprite animation
    let lastFrameTime = 0;           // Timestamp of the last frame update
    const animationSpeed = 150;      // Time in ms between sprite frames

    // --- Movement State ---
    let isMoving = false;            // True if character is performing random movement
    let targetX = 0;                 // Target X coordinate for movement
    let targetY = 0;                 // Target Y coordinate for movement
    const moveSpeed = 2;             // Base speed for character movement (pixels per frame)
    let movementFrameId = null;      // ID returned by requestAnimationFrame for character position movement

    // --- Hiding State ---
    let isHiding = false;            // True if character is in the process of hiding or peeking
    let isHidden = false;            // True if character is currently fully hidden
    let currentHidingSpot = null;    // Reference to the text block character is hiding behind
    let peekTimeoutId = null;        // Timeout ID for scheduling a peek action
    let postPeekTimeoutId = null;    // Timeout ID for actions after peeking

    // --- Talking State ---
    let isTalking = false;           // True if the dialogue bubble is currently active
    let dialogueTimeoutId = null;    // Timeout ID for automatically hiding the dialogue bubble
    let previousAnimationBeforeTalk = "IDLE"; // Stores animation to resume after talking

    // --- Search Interaction State ---
    let isRespondingToSearch = false; // True if character is moving towards the search bar
    let nextActionTimeoutId = null;  // Timeout ID for the next scheduled general action (move/hide)

    // --- Animation Definitions (Sprite Sheet Mapping) ---
    // Each key is an animation name, value is an array of {x, y} objects for background-position
    const animations = {
        "IDLE": [
            { x: 0, y: 0 }, { x: -24, y: 0 }, { x: -48, y: 0 },
            { x: -72, y: 0 }, { x: -96, y: 0 }, { x: -120, y: 0 }
        ],
        "WALK": [
            { x: 0, y: -24 }, { x: -24, y: -24 }, { x: -48, y: -24 },
            { x: -72, y: -24 }, { x: -96, y: -24 }, { x: -120, y: -24 }
        ],
        "RUN": [
            { x: 0, y: -48 }, { x: -24, y: -48 }, { x: -48, y: -48 },
            { x: -72, y: -48 }, { x: -96, y: -48 }, { x: -120, y: -48 }
        ],
        "SIT": [
            { x: 0, y: -216 }, { x: -24, y: -216 }
        ]
    };

    // --- Core Animation Functions ---

    /**
     * Stops the current sprite animation loop.
     */
    function stopSpriteAnimation() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        currentAnimationName = null; // Explicitly set to null to indicate no active animation
    }

    /**
     * Main sprite animation loop. Cycles through frames of the current animation.
     * @param {DOMHighResTimeStamp} timestamp - The current time provided by requestAnimationFrame.
     */
    function spriteAnimate(timestamp) {
        if (!currentAnimationName) { 
            return; // No current animation, so do nothing
        }

        if (timestamp - lastFrameTime > animationSpeed) {
            lastFrameTime = timestamp;
            const frames = animations[currentAnimationName];
            if (!frames) return; // Should not happen if playAnimation validates name
            currentFrame = (currentFrame + 1) % frames.length;
            const frame = frames[currentFrame];
            if (character) { // Check if character element exists
                 character.style.backgroundPosition = `${frame.x}px ${frame.y}px`;
            }
        }
        animationFrameId = requestAnimationFrame(spriteAnimate);
    }

    /**
     * Starts or changes the character's sprite animation.
     * @param {string | null} animationNameInput - The name of the animation to play, or null to stop.
     */
    window.playAnimation = function(animationNameInput) {
        if (animationNameInput && !animations[animationNameInput]) {
            console.error("Unknown animation:", animationNameInput);
            return;
        }
        
        stopSpriteAnimation(); // Stop any current animation before starting a new one

        currentAnimationName = animationNameInput; 
        if (currentAnimationName) { // Only start if there's a valid animation name
             currentFrame = -1; // Start from the beginning of the animation
             lastFrameTime = performance.now() - animationSpeed; // Ensure first frame renders quickly
             animationFrameId = requestAnimationFrame(spriteAnimate); // Start the animation loop
        }
    };

    // --- Utility Functions ---

    /**
     * Generates a random integer within a specified range.
     * @param {number} min - The minimum value (inclusive).
     * @param {number} max - The maximum value (inclusive).
     * @returns {number} A random integer.
     */
    function getRandomInterval(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Creates and animates a small dust puff effect near the character's feet.
     */
    function createDustPuff() {
        if (isRespondingToSearch || !character) return; // No dust when running to search or if character is null

        const dustPuff = document.createElement('div');
        dustPuff.style.width = '5px';
        dustPuff.style.height = '5px';
        dustPuff.style.backgroundColor = '#88888880';
        dustPuff.style.borderRadius = '50%';
        dustPuff.style.position = 'absolute';
        dustPuff.style.left = `${character.offsetLeft + character.offsetWidth / 2 - 2}px`;
        dustPuff.style.top = `${character.offsetTop + character.offsetHeight - 2}px`;
        dustPuff.style.opacity = '1';
        dustPuff.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        
        document.body.appendChild(dustPuff);

        // Trigger animation
        setTimeout(() => {
            dustPuff.style.opacity = '0';
            dustPuff.style.transform = `translateY(-10px) scale(0.5)`;
        }, 0); // Apply transition immediately

        // Remove dust puff from DOM after animation
        setTimeout(() => {
            if (dustPuff.parentElement) {
                dustPuff.parentElement.removeChild(dustPuff);
            }
        }, 500); // Duration of the fade-out animation
    }
    
    /**
     * Generic movement loop for the character.
     * Moves the character towards (targetX, targetY) and calls a callback on arrival.
     * @param {function} onArrivalCallback - Function to call when the character reaches the target.
     */
    function generalMoveLoop(onArrivalCallback) {
        // Conditions for loop to run:
        // Character must be in a state that involves moving (isMoving, isHiding, isRespondingToSearch)
        // AND not currently talking (as talking pauses movement).
        if (!((isMoving || isHiding || isRespondingToSearch) && !isTalking) || !character) {
            if (movementFrameId) cancelAnimationFrame(movementFrameId);
            movementFrameId = null;
            return;
        }

        let currentX = parseFloat(character.style.left || '0');
        let currentY = parseFloat(character.style.top || '0');
        let dx = targetX - currentX;
        let dy = targetY - currentY;
        
        const effectiveMoveSpeed = (currentAnimationName === "RUN" || isRespondingToSearch) ? moveSpeed * 1.5 : moveSpeed;
        const arrivalThreshold = effectiveMoveSpeed * 1.1; // Allow slight overstep for smoother arrival with faster speeds


        if (Math.abs(dx) < arrivalThreshold && Math.abs(dy) < arrivalThreshold) {
            character.style.left = `${targetX}px`;
            character.style.top = `${targetY}px`;
            if (movementFrameId) cancelAnimationFrame(movementFrameId);
            movementFrameId = null;
            onArrivalCallback(); 
            return;
        }
        
        if (Math.abs(dx) > 0) currentX += Math.sign(dx) * effectiveMoveSpeed;
        if (Math.abs(dy) > 0) currentY += Math.sign(dy) * effectiveMoveSpeed;

        character.style.left = `${currentX}px`;
        character.style.top = `${currentY}px`;

        // Create dust puffs during random movement only
        if (isMoving && Math.random() < 0.3) { 
            createDustPuff();
        }
        
        movementFrameId = requestAnimationFrame(() => generalMoveLoop(onArrivalCallback));
    }
    
    // --- Global State Management & Interruptions ---

    /**
     * Clears all known character-related timeouts.
     */
    function clearAllTimeouts() { 
        if (nextActionTimeoutId) clearTimeout(nextActionTimeoutId);
        if (dialogueTimeoutId) clearTimeout(dialogueTimeoutId);
        if (peekTimeoutId) clearTimeout(peekTimeoutId);
        if (postPeekTimeoutId) clearTimeout(postPeekTimeoutId);
        nextActionTimeoutId = null;
        dialogueTimeoutId = null;
        peekTimeoutId = null;
        postPeekTimeoutId = null;
    }

    /**
     * Interrupts all current character actions, usually when "come" command is issued.
     * Sets `isRespondingToSearch` to true.
     */
    function interruptAllActionsForSearch() {
        isRespondingToSearch = true; // This is the primary flag for this state
        clearAllTimeouts(); // Clear any pending actions

        // Stop physical movement
        if (movementFrameId) {
            cancelAnimationFrame(movementFrameId);
            movementFrameId = null;
        }
        isMoving = false;

        // Reset hiding state if applicable
        if (isHiding || isHidden) {
            if (character) {
                character.style.zIndex = '100'; // Restore default z-index
                character.style.transform = 'translateY(0px)'; // Reset any peek transform
            }
            isHidden = false;
            isHiding = false;
            currentHidingSpot = null;
        }

        // Reset talking state if applicable
        if (isTalking) {
            if (dialogueBubble) {
                dialogueBubble.style.display = 'none';
                dialogueBubble.classList.remove('pointing-up', 'pointing-down');
            }
            isTalking = false;
        }
        
        stopSpriteAnimation(); // Stop current sprite animation; "RUN" will be set shortly
    }

    // --- Action Scheduling & Behavior Functions ---

    /**
     * Schedules the character's next autonomous action (random movement or hiding).
     * Ensures no action is scheduled if character is busy.
     */
    function scheduleNextAction() {
        clearTimeout(nextActionTimeoutId); // Clear any previously scheduled action
        if (isTalking || isMoving || isHiding || isRespondingToSearch) return; // Don't schedule if busy

        const actionDelay = isHidden ? getRandomInterval(3000, 6000) : getRandomInterval(5000, 10000);

        if (Math.random() < 0.25 && textBlocks && textBlocks.length > 0 && !isHidden) { 
            nextActionTimeoutId = setTimeout(startHiding, actionDelay);
        } else {
            nextActionTimeoutId = setTimeout(startRandomMovement, actionDelay);
        }
    }

    /**
     * Initiates random character movement.
     */
    function startRandomMovement() {
        if (isMoving || isHiding || isHidden || isTalking || isRespondingToSearch || !character) return;

        isMoving = true;
        playAnimation("WALK");
        previousAnimationBeforeTalk = "IDLE"; // Default state after movement

        const charRect = character.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();

        // Decide whether to move horizontally or vertically
        if (Math.random() < 0.5) { // Horizontal
            targetX = Math.random() * (bodyRect.width - charRect.width);
            targetY = parseFloat(character.style.top || '0'); // Keep current Y
        } else { // Vertical
            targetX = parseFloat(character.style.left || '0'); // Keep current X
            targetY = Math.random() * (bodyRect.height - charRect.height);
        }
        
        // Clamp target position to be within viewport boundaries
        targetX = Math.max(0, Math.min(targetX, bodyRect.width - charRect.width));
        targetY = Math.max(0, Math.min(targetY, bodyRect.height - charRect.height));

        generalMoveLoop(() => {
            // On arrival from random move:
            if (!isRespondingToSearch) { // Ensure not interrupted by "come"
                isMoving = false;
                playAnimation("IDLE");
                scheduleNextAction(); // Schedule the next autonomous action
            }
        });
    }
    
    /**
     * Initiates the character hiding sequence.
     */
    function startHiding() {
        if (isMoving || isHiding || isHidden || isTalking || isRespondingToSearch || !textBlocks || textBlocks.length === 0 || !character) {
            // If unable to hide, try to schedule a different action
            if (!isMoving && !isHiding && !isHidden && !isTalking && !isRespondingToSearch) {
                 scheduleNextAction(); 
            }
            return;
        }

        isHiding = true; // Mark character as "in the process of hiding"
        currentHidingSpot = textBlocks[Math.floor(Math.random() * textBlocks.length)];
        const spotRect = currentHidingSpot.getBoundingClientRect();
        const charRect = character.getBoundingClientRect();

        // Target behind the chosen text block
        targetX = spotRect.left + window.scrollX + 5; 
        targetY = spotRect.top + window.scrollY + 5;  

        targetX = Math.max(0, Math.min(targetX, document.body.scrollWidth - charRect.width));
        targetY = Math.max(0, Math.min(targetY, document.body.scrollHeight - charRect.height));
        
        playAnimation("WALK"); 
        previousAnimationBeforeTalk = "SIT"; // Character will sit when hidden

        generalMoveLoop(() => {
            // On arrival at hiding spot:
            if (!isRespondingToSearch) { 
                character.style.zIndex = '1'; // Lower z-index to appear behind text block
                isHidden = true;              
                playAnimation("SIT");
                clearTimeout(peekTimeoutId); 
                peekTimeoutId = setTimeout(peek, getRandomInterval(2000, 3000)); 
            }
        });
    }

    /**
     * Initiates the character "peeking" animation while hidden.
     */
    function peek() {
        if (!isHidden || !isHiding || isTalking || isRespondingToSearch || !character) return; 

        const peekAmount = -10; // Pixels to move up for peeking
        character.style.transition = 'transform 0.3s ease-in-out';
        character.style.transform = `translateY(${peekAmount}px)`;
        
        clearTimeout(postPeekTimeoutId); // Clear any pending post-peek action
        postPeekTimeoutId = setTimeout(() => {
            if (isRespondingToSearch || !character) return; // Interrupted or character gone
            character.style.transform = 'translateY(0px)'; // Return to original position
            
            // Schedule finishing the hiding sequence after peek animation completes
            clearTimeout(nextActionTimeoutId); // Use nextActionTimeoutId for finishHiding as it's a main action transition
            nextActionTimeoutId = setTimeout(finishHiding, getRandomInterval(1000, 2000) + 300); // +300 for transform
        }, 500); // Duration character stays peeked out
    }

    /**
     * Finishes the hiding sequence, making the character visible again.
     */
    function finishHiding() {
        if (!isHiding || isRespondingToSearch || !character) return;  

        character.style.zIndex = '100'; // Restore default z-index
        character.style.transition = ''; // Clear transform transition from peek
        isHidden = false;
        isHiding = false; 
        currentHidingSpot = null;
        playAnimation("IDLE");
        previousAnimationBeforeTalk = "IDLE";
        
        scheduleNextAction(); // Schedule the next autonomous action
    }

    /**
     * Handles click events on the character: shows or hides the dialogue bubble.
     */
    function showDialogueOrHideBubble() {
        if (isRespondingToSearch || !character || !dialogueBubble) return; 

        if (isTalking) { // If bubble is currently shown, hide it
            dialogueBubble.style.display = 'none';
            dialogueBubble.classList.remove('pointing-up', 'pointing-down');
            if (dialogueTimeoutId) clearTimeout(dialogueTimeoutId);
            dialogueTimeoutId = null;
            isTalking = false;
            playAnimation(previousAnimationBeforeTalk); // Resume previous animation
            scheduleNextAction(); 
        } else { // If bubble is hidden, show it
            // Prevent talking if character is actively moving or in the middle of hiding
            if (isMoving || (isHiding && !isHidden)) { 
                return;
            }

            isTalking = true;
            // Pause any ongoing character position movement (e.g. if an action was just about to start)
            if (movementFrameId) { 
                cancelAnimationFrame(movementFrameId);
                movementFrameId = null;
            }
            
            previousAnimationBeforeTalk = isHidden ? "SIT" : (currentAnimationName || "IDLE");
            stopSpriteAnimation(); // Pause sprite animation on current frame

            dialogueBubble.textContent = "What can I help you with?"; 
            
            const charRect = character.getBoundingClientRect();
            // Ensure bubble dimensions are calculated *after* content is set
            dialogueBubble.style.display = 'block'; // Temporarily display to get accurate dimensions
            let bubbleWidth = dialogueBubble.offsetWidth; 
            let bubbleHeight = dialogueBubble.offsetHeight;
            dialogueBubble.style.display = 'none'; // Hide again before positioning


            let bubbleLeft = charRect.left + window.scrollX + (charRect.width / 2) - (bubbleWidth / 2);
            let bubbleTop = charRect.top + window.scrollY - bubbleHeight - 15; // 15px accounts for tail + spacing

            dialogueBubble.classList.remove('pointing-up', 'pointing-down');
            // If bubble would go off-screen at top, or character is too high, position below
            if (bubbleTop < (window.scrollY + 5) || (charRect.top < bubbleHeight + 20)) { 
                bubbleTop = charRect.bottom + window.scrollY + 15; // 15px for spacing below
                dialogueBubble.classList.add('pointing-up');
            } else {
                dialogueBubble.classList.add('pointing-down');
            }

            // Keep bubble within horizontal viewport boundaries
            if (bubbleLeft < (window.scrollX + 5)) bubbleLeft = window.scrollX + 5;
            if ((bubbleLeft + bubbleWidth) > (window.scrollX + document.documentElement.clientWidth - 5)) {
                bubbleLeft = window.scrollX + document.documentElement.clientWidth - bubbleWidth - 5;
            }

            dialogueBubble.style.left = `${bubbleLeft}px`;
            dialogueBubble.style.top = `${bubbleTop}px`;
            dialogueBubble.style.display = 'block'; // Finally, display the bubble

            if (dialogueTimeoutId) clearTimeout(dialogueTimeoutId); 
            dialogueTimeoutId = setTimeout(() => {
                if (!isTalking || isRespondingToSearch) return; // State might have changed
                
                dialogueBubble.style.display = 'none';
                dialogueBubble.classList.remove('pointing-up', 'pointing-down');
                isTalking = false;
                playAnimation(previousAnimationBeforeTalk);
                scheduleNextAction();
                
            }, getRandomInterval(4000, 7000)); 
        }
    }
    if (character) { // Add listener only if character exists
        character.addEventListener('click', showDialogueOrHideBubble);
    }

    // --- Search Bar Interaction ---
    if (searchBar) { // Add listener only if searchBar exists
        searchBar.addEventListener('input', () => {
            if (searchBar.value.toLowerCase() === "come") {
                if (!character) return; // Need character to "come"
                interruptAllActionsForSearch(); 

                playAnimation("RUN");

                const searchBarRect = searchBar.getBoundingClientRect();
                const charRect = character.getBoundingClientRect();
                
                targetX = searchBarRect.left + window.scrollX - charRect.width - 10; // Position left of search bar
                targetY = searchBarRect.top + window.scrollY + (searchBarRect.height / 2) - (charRect.height / 2); // Vertically align

                targetX = Math.max(0, Math.min(targetX, document.body.scrollWidth - charRect.width));
                targetY = Math.max(0, Math.min(targetY, document.body.scrollHeight - charRect.height));
                
                generalMoveLoop(() => {
                    // On arrival at search bar:
                    playAnimation("IDLE");
                    isRespondingToSearch = false; // Clear the search response state
                    searchBar.value = "";       // Clear the search bar
                    scheduleNextAction();       // Resume normal scheduling
                });
            }
        });
    }

    // --- Initialization ---
    if (character) { // Initial position if not set by CSS
        if (!character.style.left && !character.style.top) {
            const bodyRect = document.body.getBoundingClientRect();
            character.style.left = `${(bodyRect.width - character.offsetWidth) / 2}px`;
            character.style.top = `${(bodyRect.height - character.offsetHeight) / 2}px`;
        } else if (!character.style.left) {
            character.style.left = `${(document.body.getBoundingClientRect().width - character.offsetWidth) / 2}px`;
        } else if (!character.style.top) {
            character.style.top = `${(document.body.getBoundingClientRect().height - character.offsetHeight) / 2}px`;
        }
        
        playAnimation("IDLE"); // Start with IDLE animation
        scheduleNextAction();  // Schedule the first autonomous action
    }
});
