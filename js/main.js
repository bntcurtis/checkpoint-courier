/**
 * CHECKPOINT COURIER - Main Application
 * Entry point and UI controller
 */

import { gameState } from './state.js';
import {
    DeliveryContract,
    DeliverySession,
    CheckpointEncounter,
    RouteThemes,
    PermitDefinitions,
    UpgradeDefinitions,
    NegotiationAction,
    getCheckpointCount,
    getPermitCost,
    getPermitDeliveries,
    randomChoice,
    generateUUID,
} from './models.js';
import { DrivingGame } from './game.js';
import {
    processNegotiation,
    calculateSuggestedBribe,
    calculateFine,
    getInitialDialogue,
    calculateExpectedBribe,
} from './officerAI.js';
import { permitService } from './permits.js';
import { uploadSession, exportPlayerData, processPendingUploads, testUploadEndpoint } from './cloudUpload.js';

// ============================================
// DOM REFERENCES
// ============================================

const screens = {
    consent: document.getElementById('consent-screen'),
    home: document.getElementById('home-screen'),
    delivery: document.getElementById('delivery-screen'),
    permits: document.getElementById('permits-screen'),
    upgrades: document.getElementById('upgrades-screen'),
    settings: document.getElementById('settings-screen'),
    game: document.getElementById('game-screen'),
};

const dialogs = {
    negotiation: document.getElementById('negotiation-dialog'),
    deliveryComplete: document.getElementById('delivery-complete-dialog'),
    tutorial: document.getElementById('tutorial-dialog'),
    permitApplication: document.getElementById('permit-application-dialog'),
};

// ============================================
// APPLICATION STATE
// ============================================

let drivingGame = null;
let currentDeliveryOptions = [];
let negotiationStartTime = 0;
let currentCheckpoint = null;

// Hover time tracking for behavioral analysis
let hoverTracking = {
    bribe: { total: 0, start: null },
    show_permit: { total: 0, start: null },
    argue: { total: 0, start: null },
    bluff: { total: 0, start: null },
    flee: { total: 0, start: null },
    comply: { total: 0, start: null },
};

function resetHoverTracking() {
    for (const key of Object.keys(hoverTracking)) {
        hoverTracking[key] = { total: 0, start: null };
    }
}

// Check for debug mode via URL parameter
const urlParams = new URLSearchParams(window.location.search);
const debugMode = urlParams.get('debug') === '1';

// ============================================
// INITIALIZATION
// ============================================

async function initialize() {
    // Initialize game state
    await gameState.initialize();

    // Set up event listeners
    setupNavigation();
    setupConsentFlow();
    setupGameControls();
    setupNegotiationActions();
    setupSettingsActions();
    setupPermitDialog();
    setupSoundSystem();

    // Update UI with player data
    updateAllDisplays();

    // Listen for state changes
    gameState.on('moneyChanged', updateMoneyDisplays);
    gameState.on('deliveryCompleted', updateDeliveryCount);

    // Check if we need to show consent screen (first launch)
    if (gameState.player.consentGiven === null) {
        showScreen('consent');
    } else {
        showScreen('home');
        // Show tutorial for players who haven't completed it
        if (!gameState.player.tutorialComplete) {
            showDialog('tutorial');
        }
    }

    // Check for impound status
    updateImpoundNotice();

    // Show diagnostics section if debug mode is enabled
    if (debugMode) {
        const diagnosticsSection = document.getElementById('diagnostics-section');
        if (diagnosticsSection) {
            diagnosticsSection.classList.remove('hidden');
        }
        console.log('Debug mode enabled - diagnostics visible');
    }

    console.log('Checkpoint Courier initialized');
    console.log(`Player: ${gameState.player.anonymousId}`);
    console.log(`Treatment: ${gameState.player.treatment}`);
    console.log(`Consent: ${gameState.player.consentGiven}`);
}

// ============================================
// CONSENT FLOW
// ============================================

function setupConsentFlow() {
    document.getElementById('btn-consent-donate').addEventListener('click', () => {
        gameState.setConsent(true);
        showScreen('home');
        if (!gameState.player.tutorialComplete) {
            showDialog('tutorial');
        }
    });

    document.getElementById('btn-consent-private').addEventListener('click', () => {
        gameState.setConsent(false);
        showScreen('home');
        if (!gameState.player.tutorialComplete) {
            showDialog('tutorial');
        }
    });
}

// ============================================
// NAVIGATION
// ============================================

function setupNavigation() {
    // Main menu buttons
    document.getElementById('btn-new-delivery').addEventListener('click', () => {
        generateDeliveryOptions();
        showScreen('delivery');
    });

    document.getElementById('btn-permits').addEventListener('click', () => {
        renderPermitsScreen();
        showScreen('permits');
    });

    document.getElementById('btn-upgrades').addEventListener('click', () => {
        renderUpgradesScreen();
        showScreen('upgrades');
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
        renderSettingsScreen();
        showScreen('settings');
    });

    // Back buttons
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            showScreen(target.replace('-screen', ''));
        });
    });

    // Tutorial close
    document.getElementById('btn-start-tutorial').addEventListener('click', () => {
        gameState.completeTutorial();
        hideDialog('tutorial');
    });

    // Delivery complete
    document.getElementById('btn-finish-delivery').addEventListener('click', () => {
        hideDialog('deliveryComplete');
        showScreen('home');
        updateAllDisplays();
    });
}

function showScreen(name) {
    // Null-safe iteration to prevent crashes if any screen element is missing
    Object.values(screens).filter(Boolean).forEach(screen => screen.classList.remove('active'));
    if (screens[name]) {
        screens[name].classList.add('active');
    }
}

function showDialog(name) {
    if (dialogs[name]) {
        dialogs[name].classList.remove('hidden');
    }
}

function hideDialog(name) {
    if (dialogs[name]) {
        dialogs[name].classList.add('hidden');
    }
}

// ============================================
// UI UPDATES
// ============================================

function updateAllDisplays() {
    updateMoneyDisplays();
    updateDeliveryCount();
    updatePlayerId();
    updateImpoundNotice();
}

function updateMoneyDisplays() {
    const money = gameState.player.money;
    document.querySelectorAll('#player-money, .player-money-display').forEach(el => {
        el.textContent = money;
    });
}

function updateDeliveryCount() {
    const deliveries = gameState.player.totalDeliveries;
    document.getElementById('player-deliveries').textContent = deliveries;
}

function updatePlayerId() {
    const id = gameState.player.anonymousId;
    document.getElementById('player-id').textContent = id;
    document.getElementById('settings-player-id').textContent = gameState.player.id;
    document.getElementById('settings-treatment').textContent = gameState.player.treatment;
}

function updateImpoundNotice() {
    const notice = document.getElementById('impound-notice');
    if (gameState.player.isImpounded()) {
        const remaining = gameState.player.impoundedUntilDelivery - gameState.player.totalDeliveries;
        document.getElementById('impound-remaining').textContent = remaining;
        notice.classList.remove('hidden');
    } else {
        notice.classList.add('hidden');
    }
}

// ============================================
// DELIVERY SELECTION
// ============================================

function generateDeliveryOptions() {
    currentDeliveryOptions = [];
    const routes = Object.values(RouteThemes);

    for (let i = 0; i < 3; i++) {
        const route = randomChoice(routes);
        const baseReward = 150 + Math.floor(Math.random() * 150);
        const baseCheckpoints = 2 + Math.floor(Math.random() * 2);
        const hasContraband = Math.random() < 0.3;

        const delivery = new DeliveryContract({
            id: generateUUID(),
            name: `${route.name} Route ${i + 1}`,
            route,
            baseReward,
            checkpointCount: getCheckpointCount(baseCheckpoints, gameState.player.treatment),
            hasContraband,
            distance: 800 + Math.floor(Math.random() * 400),
        });

        currentDeliveryOptions.push(delivery);
    }

    renderDeliveryOptions();
}

function renderDeliveryOptions() {
    const container = document.getElementById('delivery-options');
    container.innerHTML = '';

    currentDeliveryOptions.forEach((delivery, index) => {
        const effectiveReward = delivery.getEffectiveReward(gameState.player);
        const hasPermit = gameState.player.hasAnyValidPermit();

        const card = document.createElement('div');
        card.className = 'delivery-card';
        card.innerHTML = `
            <div class="delivery-header">
                <span class="delivery-name">${delivery.name}</span>
                <span class="delivery-reward">+${effectiveReward} 💰</span>
            </div>
            <div class="delivery-details">
                <span class="delivery-tag">🛑 ${delivery.checkpointCount} checkpoints</span>
                <span class="delivery-tag">📏 ${delivery.distance}m</span>
                ${delivery.hasContraband ? '<span class="delivery-tag danger">⚠️ Contraband (3x risk)</span>' : ''}
            </div>
            <div class="delivery-requirements">
                ${!hasPermit ? '⚠️ No valid permit - expect fines at checkpoints' : '✅ Permit valid'}
            </div>
        `;

        card.addEventListener('click', () => selectDelivery(index));
        container.appendChild(card);
    });

    // Add start button area
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'delivery-actions';
    actionsDiv.innerHTML = `<button id="btn-start-delivery" class="btn btn-primary" disabled>Select a Delivery</button>`;
    container.appendChild(actionsDiv);

    document.getElementById('btn-start-delivery').addEventListener('click', startSelectedDelivery);
}

let selectedDeliveryIndex = -1;

function selectDelivery(index) {
    selectedDeliveryIndex = index;

    // Update selection UI
    document.querySelectorAll('.delivery-card').forEach((card, i) => {
        card.classList.toggle('selected', i === index);
    });

    const btn = document.getElementById('btn-start-delivery');
    btn.disabled = false;
    btn.textContent = 'Start Delivery';
}

function startSelectedDelivery() {
    if (selectedDeliveryIndex < 0) return;

    const delivery = currentDeliveryOptions[selectedDeliveryIndex];
    gameState.setCurrentDelivery(delivery);

    // Create session
    const session = new DeliverySession({
        playerId: gameState.player.id,
        treatment: gameState.player.treatment,
        deliveryId: delivery.id,
        moneyBefore: gameState.player.money,
        checkpointsTotal: delivery.checkpointCount,
        hadContraband: delivery.hasContraband,
    });
    gameState.startSession(session);

    // Initialize driving game
    initializeDrivingGame(delivery);

    showScreen('game');
}

// ============================================
// DRIVING GAME
// ============================================

function initializeDrivingGame(delivery) {
    const canvas = document.getElementById('game-canvas');
    drivingGame = new DrivingGame(canvas);

    // Set up callbacks
    drivingGame.onCheckpoint = handleCheckpoint;
    drivingGame.onComplete = handleDeliveryComplete;
    drivingGame.onSpeedChange = (speed) => {
        document.getElementById('speed-display').textContent = `🚚 ${speed} km/h`;
    };
    drivingGame.onLivesChange = (lives) => {
        updateLivesDisplay(lives);
    };
    drivingGame.onCollision = () => {
        playSound('hit');
    };
    drivingGame.onCrash = () => {
        // Immediately save state to prevent refresh exploit
        gameState.save();
        playSound('crash');
    };
    drivingGame.onGameOver = handleGameOver;

    // Initialize and start
    drivingGame.initialize(delivery, gameState.player.treatment);

    // Update HUD
    document.querySelector('#delivery-reward span').textContent = delivery.getEffectiveReward(gameState.player);
    updateCheckpointCounter();
    updateLivesDisplay(3); // Reset lives display

    // Start after a brief delay
    setTimeout(() => drivingGame.start(), 500);
}

function updateCheckpointCounter() {
    if (!drivingGame) return;
    const info = drivingGame.getCurrentCheckpointInfo();
    document.getElementById('checkpoint-counter').textContent = `Checkpoint ${info.current}/${info.total}`;
}

function setupGameControls() {
    const accelerateBtn = document.getElementById('btn-accelerate');
    const brakeBtn = document.getElementById('btn-brake');
    const laneLeftBtn = document.getElementById('btn-lane-left');
    const laneRightBtn = document.getElementById('btn-lane-right');
    const exitBtn = document.getElementById('btn-exit-game');
    const canvas = document.getElementById('game-canvas');

    // Touch/mouse events for acceleration
    accelerateBtn.addEventListener('mousedown', () => drivingGame?.setAccelerating(true));
    accelerateBtn.addEventListener('mouseup', () => drivingGame?.setAccelerating(false));
    accelerateBtn.addEventListener('mouseleave', () => drivingGame?.setAccelerating(false));
    accelerateBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        drivingGame?.setAccelerating(true);
    });
    accelerateBtn.addEventListener('touchend', () => drivingGame?.setAccelerating(false));
    accelerateBtn.addEventListener('touchcancel', () => drivingGame?.setAccelerating(false));

    // Touch/mouse events for braking
    brakeBtn.addEventListener('mousedown', () => drivingGame?.setBraking(true));
    brakeBtn.addEventListener('mouseup', () => drivingGame?.setBraking(false));
    brakeBtn.addEventListener('mouseleave', () => drivingGame?.setBraking(false));
    brakeBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        drivingGame?.setBraking(true);
    });
    brakeBtn.addEventListener('touchend', () => drivingGame?.setBraking(false));
    brakeBtn.addEventListener('touchcancel', () => drivingGame?.setBraking(false));

    // Lane change buttons
    laneLeftBtn.addEventListener('mousedown', () => drivingGame?.changeLane(-1));
    laneLeftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        drivingGame?.changeLane(-1);
    });

    laneRightBtn.addEventListener('mousedown', () => drivingGame?.changeLane(1));
    laneRightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        drivingGame?.changeLane(1);
    });

    // Exit button
    exitBtn.addEventListener('click', handleExitGame);
    exitBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleExitGame();
    });

    // Swipe gesture support on canvas
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
        }
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
        if (!drivingGame || !drivingGame.running) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const touchDuration = Date.now() - touchStartTime;

        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Minimum swipe distance and max time for it to count as a swipe
        const minSwipeDistance = 30;
        const maxSwipeTime = 500;

        if (touchDuration < maxSwipeTime) {
            if (absX > absY && absX > minSwipeDistance) {
                // Horizontal swipe - lane change
                if (deltaX < 0) {
                    drivingGame.changeLane(-1); // Swipe left
                } else {
                    drivingGame.changeLane(1); // Swipe right
                }
            } else if (absY > absX && absY > minSwipeDistance) {
                // Vertical swipe - speed control
                if (deltaY < 0) {
                    // Swipe up - brief acceleration boost
                    drivingGame.setAccelerating(true);
                    setTimeout(() => drivingGame?.setAccelerating(false), 200);
                } else {
                    // Swipe down - brief brake
                    drivingGame.setBraking(true);
                    setTimeout(() => drivingGame?.setBraking(false), 200);
                }
            } else if (absX < 10 && absY < 10) {
                // Tap - toggle acceleration
                if (drivingGame.accelerating) {
                    drivingGame.setAccelerating(false);
                } else {
                    drivingGame.setAccelerating(true);
                }
            }
        }
    }, { passive: true });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (!drivingGame || !drivingGame.running) return;

        switch (e.key) {
            case 'ArrowUp':
            case 'w':
                drivingGame.setAccelerating(true);
                break;
            case 'ArrowDown':
            case 's':
                drivingGame.setBraking(true);
                break;
            case 'ArrowLeft':
            case 'a':
                drivingGame.changeLane(-1);
                break;
            case 'ArrowRight':
            case 'd':
                drivingGame.changeLane(1);
                break;
            case 'Escape':
                handleExitGame();
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (!drivingGame) return;

        switch (e.key) {
            case 'ArrowUp':
            case 'w':
                drivingGame.setAccelerating(false);
                break;
            case 'ArrowDown':
            case 's':
                drivingGame.setBraking(false);
                break;
        }
    });
}

function handleExitGame() {
    if (!drivingGame) {
        showScreen('home');
        return;
    }

    // Stop the game
    drivingGame.stop();

    // End session as abandoned if there was one
    const session = gameState.currentSession;
    if (session) {
        gameState.endSession('abandoned');

        // Upload the partial session data
        session.totalBribes = gameState.sessionBribeAmount || 0;
        session.totalFines = gameState.sessionFineAmount || 0;

        console.log(`📤 Uploading abandoned session (user exited)...`);
        uploadSession(session)
            .then(result => {
                if (result.success) {
                    console.log('✅ Session data uploaded');
                }
            })
            .catch(err => console.error('❌ Upload error:', err));
    }

    // Clear game state
    gameState.currentDelivery = null;
    gameState.currentSession = null;
    drivingGame = null;

    // Return to home
    showScreen('home');
    updateAllDisplays();
}

// ============================================
// CHECKPOINT NEGOTIATION
// ============================================

function handleCheckpoint(checkpoint, index) {
    currentCheckpoint = checkpoint;
    gameState.setCurrentOfficer(checkpoint.officer);
    gameState.advanceCheckpoint();

    updateCheckpointCounter();

    // Show negotiation dialog
    showNegotiationDialog(checkpoint);
}

function showNegotiationDialog(checkpoint) {
    const officer = checkpoint.officer;
    const player = gameState.player;
    const delivery = gameState.currentDelivery;

    // Prepare player context for dynamic dialogue
    const playerContext = {
        heatLevel: player.getHeat(officer.personality),
        totalBribes: player.totalBribes,
        totalFines: player.totalFines,
        sessionBribes: gameState.sessionBribes,
        frustrationIndex: player.getFrustrationIndex(),
    };

    // Update dialog content with history-aware dialogue
    document.getElementById('officer-title').textContent = 'Checkpoint Officer';
    document.getElementById('officer-personality').textContent = officer.stats.name;
    document.getElementById('officer-dialogue').textContent = `"${getInitialDialogue(officer, playerContext)}"`;

    // Situation info
    const speed = gameState.gameSpeed;
    const hasPermit = player.hasAnyValidPermit();
    const hasContraband = delivery?.hasContraband || false;

    document.getElementById('neg-speed').textContent = `${Math.round(speed)} km/h ${speed > 50 ? '⚠️' : ''}`;
    document.getElementById('neg-permit-status').textContent = hasPermit ? '✅ Valid' : '❌ None';

    // Calculate fine
    const fineContext = {
        isSpeeding: speed > 50,
        hasPermit,
        hasContraband,
        isAggravated: false,
        officer,
    };
    const fine = calculateFine(fineContext);
    document.getElementById('neg-fine-amount').textContent = `${fine} 💰`;

    // Calculate suggested bribe
    const bribeContext = {
        fine,
        officer,
        heatLevel: player.getHeat(officer.personality),
        previousBribesThisRun: gameState.sessionBribes,
        contactsDiscount: player.getUpgradeBonus('bribeDiscount'),
    };
    const suggestedBribe = calculateSuggestedBribe(bribeContext);
    document.getElementById('bribe-suggestion').textContent = suggestedBribe;

    // Show/hide permit button based on status
    const showPermitBtn = document.querySelector('[data-action="show_permit"]');
    showPermitBtn.disabled = !hasPermit;

    // Reset result area
    document.getElementById('negotiation-result').classList.add('hidden');
    document.getElementById('negotiation-actions').classList.remove('hidden');

    // Track response time and reset hover tracking
    negotiationStartTime = performance.now();
    resetHoverTracking();

    showDialog('negotiation');
}

function setupNegotiationActions() {
    document.querySelectorAll('#negotiation-actions .btn-action').forEach(btn => {
        const action = btn.dataset.action;

        // Track hover time - mouse events
        btn.addEventListener('mouseenter', () => {
            if (action && hoverTracking[action]) {
                hoverTracking[action].start = performance.now();
            }
        });

        btn.addEventListener('mouseleave', () => {
            if (action && hoverTracking[action] && hoverTracking[action].start !== null) {
                hoverTracking[action].total += performance.now() - hoverTracking[action].start;
                hoverTracking[action].start = null;
            }
        });

        // Track hover time - touch events (for mobile)
        btn.addEventListener('touchstart', () => {
            if (action && hoverTracking[action]) {
                hoverTracking[action].start = performance.now();
            }
        }, { passive: true });

        btn.addEventListener('touchend', () => {
            if (action && hoverTracking[action] && hoverTracking[action].start !== null) {
                hoverTracking[action].total += performance.now() - hoverTracking[action].start;
                hoverTracking[action].start = null;
            }
        }, { passive: true });

        // Click handler
        btn.addEventListener('click', () => {
            // Finalize hover time for the clicked button
            if (action && hoverTracking[action] && hoverTracking[action].start !== null) {
                hoverTracking[action].total += performance.now() - hoverTracking[action].start;
                hoverTracking[action].start = null;
            }
            handleNegotiationAction(action);
        });
    });

    document.getElementById('btn-continue').addEventListener('click', () => {
        hideDialog('negotiation');
        continueAfterNegotiation();
    });
}

function handleNegotiationAction(action) {
    const responseTimeMs = performance.now() - negotiationStartTime;
    const officer = currentCheckpoint.officer;
    const player = gameState.player;
    const delivery = gameState.currentDelivery;

    // Prepare context
    const bribeContext = {
        fine: parseInt(document.getElementById('neg-fine-amount').textContent),
        officer,
        heatLevel: player.getHeat(officer.personality),
        previousBribesThisRun: gameState.sessionBribes,
        contactsDiscount: player.getUpgradeBonus('bribeDiscount'),
    };
    const expectedBribe = calculateExpectedBribe(bribeContext);
    const suggestedBribe = parseInt(document.getElementById('bribe-suggestion').textContent);

    const context = {
        officer,
        player,
        hasPermit: player.hasAnyValidPermit(),
        hasContraband: delivery?.hasContraband || false,
        playerSpeed: gameState.gameSpeed,
        bribeAmount: suggestedBribe, // Use suggested bribe amount
        previousBribesThisRun: gameState.sessionBribes,
        isBlitz: currentCheckpoint.isBlitz,
    };

    // Capture money before the encounter for budget constraint analysis
    const moneyBeforeEncounter = player.money;

    // Process the action
    const result = processNegotiation(action, context);

    // Log encounter with hover time data and contextual factors
    const encounter = new CheckpointEncounter({
        sessionId: gameState.currentSession?.id,
        playerId: player.id,
        treatment: player.treatment,
        checkpointNumber: gameState.currentCheckpoint,
        officerPersonality: officer.personality,
        officerCorruptibility: officer.stats.corruptibility,
        officerStrictness: officer.stats.strictness,
        officerGreed: officer.stats.greed,
        playerAction: action,
        outcome: result.outcome,
        bribeOffered: result.bribeAmount,
        bribeExpected: expectedBribe,
        fineAmount: result.fineAmount,
        playerSpeed: context.playerSpeed,
        hadPermit: context.hasPermit,
        hadContraband: context.hasContraband,
        heatLevel: context.player.getHeat(officer.personality),
        responseTimeMs: Math.round(responseTimeMs),
        // Environmental/contextual factors
        isBlitz: currentCheckpoint.isBlitz || false,
        moneyBeforeEncounter: moneyBeforeEncounter,
        // Hover time tracking - captures hesitation/consideration behavior
        hoverTimeBribe: Math.round(hoverTracking.bribe?.total || 0),
        hoverTimePermit: Math.round(hoverTracking.show_permit?.total || 0),
        hoverTimeArgue: Math.round(hoverTracking.argue?.total || 0),
        hoverTimeBluff: Math.round(hoverTracking.bluff?.total || 0),
        hoverTimeFlee: Math.round(hoverTracking.flee?.total || 0),
        hoverTimeComply: Math.round(hoverTracking.comply?.total || 0),
    });

    if (gameState.currentSession) {
        gameState.currentSession.encounters.push(encounter);
    }

    // Apply results
    if (result.moneyChange !== 0) {
        gameState.updateMoney(result.moneyChange);
    }

    // Track bribes - record ALL bribe attempts (accepted or rejected) for accurate accounting
    // Heat is applied for ANY bribe attempt (you tried to bribe, officer remembers)
    if (result.bribeAmount > 0) {
        if (result.passed) {
            // Bribe was accepted
            gameState.recordBribe(result.bribeAmount);
            playSound('bribe');
        }
        // Apply heat for ANY bribe attempt - attempting bribery is noticed regardless of outcome
        gameState.increaseHeat(officer.personality, result.heatChange || 0.15);
    }

    if (result.fineAmount > 0) {
        gameState.recordFine(result.fineAmount);
        playSound('error');
    }

    if (result.impounded) {
        gameState.impoundTruck(3);
        playSound('error');
    }

    // Use permit if showed valid one
    if (action === NegotiationAction.SHOW_PERMIT && result.passed) {
        gameState.consumeOnePermitUse();
        playSound('success');
    }

    // Play success sound for other passes
    if (result.passed && action !== NegotiationAction.SHOW_PERMIT && !result.bribeAmount) {
        playSound('success');
    }

    // Show result
    showNegotiationResult(result);
}

function showNegotiationResult(result) {
    document.getElementById('negotiation-actions').classList.add('hidden');
    const resultDiv = document.getElementById('negotiation-result');
    resultDiv.classList.remove('hidden');

    let resultText = result.dialogue;

    if (result.moneyChange < 0) {
        resultText += `\n\n💸 Cost: ${Math.abs(result.moneyChange)}`;
    }

    if (result.impounded) {
        resultText += '\n\n🚫 Your truck has been impounded!';
    }

    document.getElementById('result-text').textContent = resultText;
}

function continueAfterNegotiation() {
    updateMoneyDisplays();

    // Check if impounded
    if (gameState.player.isImpounded()) {
        // End delivery early
        handleDeliveryComplete(true);
        return;
    }

    // Resume driving game
    if (drivingGame) {
        drivingGame.resume();
    }
}

// ============================================
// LIVES DISPLAY
// ============================================

function updateLivesDisplay(lives) {
    // Update any UI element showing lives
    const livesDisplay = document.getElementById('lives-display');
    if (livesDisplay) {
        let hearts = '';
        for (let i = 0; i < 3; i++) {
            hearts += i < lives ? '❤️' : '🖤';
        }
        livesDisplay.textContent = hearts;
    }
}

function handleGameOver() {
    console.log('💀 Game Over - Vehicle destroyed!');

    // Stop the game if it's still running
    if (drivingGame) {
        drivingGame.stop();
    }

    // End the session as abandoned
    const session = gameState.currentSession;
    if (session) {
        gameState.endSession('abandoned');

        // Upload the session data
        session.totalBribes = gameState.sessionBribeAmount || 0;
        session.totalFines = gameState.sessionFineAmount || 0;

        console.log(`📤 Auto-uploading abandoned session...`);
        uploadSession(session)
            .then(result => {
                if (result.success) {
                    console.log('✅ Session data uploaded successfully');
                }
            })
            .catch(err => console.error('❌ Upload error:', err));
    }

    // Show game over message
    const delivery = gameState.currentDelivery;
    showGameOverSummary(delivery);

    // Clear game state
    gameState.currentDelivery = null;
    gameState.currentSession = null;
}

function showGameOverSummary(delivery) {
    const dialog = document.getElementById('delivery-complete-dialog');
    if (!dialog) {
        console.error('Could not find delivery-complete-dialog');
        showScreen('home');
        return;
    }

    // Update the dialog header
    const titleEl = dialog.querySelector('.dialog-header h3');
    if (titleEl) {
        titleEl.textContent = '💥 Vehicle Destroyed!';
    }

    // Update the summary to show game over info
    document.getElementById('summary-base-reward').textContent = '0 (Crashed)';
    document.getElementById('summary-fines').textContent = '0';
    document.getElementById('summary-bribes').textContent = '0';
    document.getElementById('summary-total').textContent = '0';
    document.getElementById('summary-total').style.color = 'var(--accent-danger)';

    // Clear game reference
    drivingGame = null;

    // Show the dialog
    showDialog('deliveryComplete');
}

// ============================================
// DELIVERY COMPLETION
// ============================================

function handleDeliveryComplete(wasImpounded = false) {
    if (drivingGame) {
        drivingGame.stop();
    }

    const delivery = gameState.currentDelivery;
    const session = gameState.currentSession;

    if (!wasImpounded && delivery) {
        // Award delivery reward
        const reward = delivery.getEffectiveReward(gameState.player);
        gameState.updateMoney(reward);
        gameState.recordDelivery();

        // Decay heat
        if (gameState.player.totalDeliveries % 3 === 0) {
            gameState.decayHeat();
        }
    }

    // Finalize session - this adds outcome, endTime, moneyAfter to the session object
    const outcome = wasImpounded ? 'impounded' : 'completed';
    gameState.endSession(outcome);

    // Show summary
    showDeliverySummary(delivery, wasImpounded);

    // AUTOMATIC UPLOAD: Upload session data at end of every delivery
    if (session) {
        // Add final session stats before upload
        session.totalBribes = gameState.sessionBribeAmount;
        session.totalFines = gameState.sessionFineAmount;

        console.log(`📤 Auto-uploading session data...`);
        console.log(`   Session ID: ${session.id}`);
        console.log(`   Encounters: ${session.encounters?.length || 0}`);
        console.log(`   Outcome: ${session.outcome}`);

        uploadSession(session)
            .then(result => {
                if (result.success) {
                    console.log('✅ Session data uploaded successfully');
                } else {
                    console.warn('⚠️ Session upload queued for retry:', result.reason || `HTTP ${result.status}`);
                }
            })
            .catch(err => {
                console.error('❌ Session upload error (queued for retry):', err);
            });
    } else {
        console.warn('⚠️ No session data to upload');
    }
}

function showDeliverySummary(delivery, wasImpounded) {
    const dialog = document.getElementById('delivery-complete-dialog');

    // Always reset the title to normal (in case it was changed by game over)
    const titleEl = dialog?.querySelector('.dialog-header h3');
    if (titleEl) {
        titleEl.textContent = wasImpounded ? '🚫 Truck Impounded!' : 'Delivery Complete!';
    }

    const baseReward = wasImpounded ? 0 : (delivery?.getEffectiveReward(gameState.player) || 0);
    const totalFines = gameState.sessionFineAmount;
    const totalBribes = gameState.sessionBribeAmount;
    const netEarnings = baseReward - totalFines - totalBribes;

    document.getElementById('summary-base-reward').textContent = wasImpounded ? '0 (Impounded)' : `+${baseReward}`;
    document.getElementById('summary-fines').textContent = totalFines > 0 ? `-${totalFines}` : '0';
    document.getElementById('summary-bribes').textContent = totalBribes > 0 ? `-${totalBribes}` : '0';
    document.getElementById('summary-total').textContent = netEarnings >= 0 ? `+${netEarnings}` : `${netEarnings}`;
    document.getElementById('summary-total').style.color = netEarnings >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';

    showDialog('deliveryComplete');
}

// ============================================
// PERMITS SCREEN
// ============================================

function renderPermitsScreen() {
    renderOwnedPermits();
    renderAvailablePermits();
}

function renderOwnedPermits() {
    const container = document.getElementById('permit-inventory');
    const permits = Object.entries(gameState.player.permitInventory).filter(([_, v]) => v > 0);

    if (permits.length === 0) {
        container.innerHTML = '<p class="empty-state">No permits held</p>';
        return;
    }

    container.innerHTML = permits.map(([type, remaining]) => {
        const def = PermitDefinitions[type];
        return `
            <div class="permit-card owned">
                <div class="permit-header">
                    <span class="permit-name">${def?.name || type}</span>
                </div>
                <p class="permit-description">${def?.description || ''}</p>
                <p class="permit-validity ${remaining <= 2 ? 'low' : ''}">
                    ${remaining} deliveries remaining
                </p>
            </div>
        `;
    }).join('');
}

function renderAvailablePermits() {
    const container = document.getElementById('permit-shop');
    const available = permitService.getAvailablePermits();

    container.innerHTML = available.map(permit => {
        const isOwned = permit.status === 'owned';
        const isLocked = permit.status === 'locked';
        const canAfford = permit.status === 'available';

        return `
            <div class="permit-card ${isOwned ? 'owned' : ''} ${isLocked ? 'locked' : ''}">
                <div class="permit-header">
                    <span class="permit-name">${permit.name}</span>
                    <span class="permit-cost">${permit.currentCost} 💰</span>
                </div>
                <p class="permit-description">${permit.description}</p>
                <p class="permit-validity">Valid for ${permit.currentDeliveries} deliveries</p>
                <p class="permit-validity">${permit.currentSteps} steps to acquire</p>
                ${permit.prerequisite ? `<p class="permit-prereq">Requires: ${PermitDefinitions[permit.prerequisite]?.name}</p>` : ''}
                ${isOwned ? '<p class="permit-validity" style="color: var(--accent-success)">✅ Owned</p>' : ''}
                ${canAfford ? `<button class="btn btn-primary" onclick="window.startPermitApplication('${permit.id}')">Apply</button>` : ''}
                ${permit.status === 'unaffordable' ? '<p class="permit-prereq">Cannot afford</p>' : ''}
            </div>
        `;
    }).join('');
}

// Global function for permit application
window.startPermitApplication = function(permitType) {
    const result = permitService.startApplication(permitType);
    if (result.success) {
        showPermitApplicationDialog();
    } else {
        alert(result.error);
    }
};

function setupPermitDialog() {
    document.getElementById('btn-cancel-permit').addEventListener('click', () => {
        permitService.cancelApplication();
        hideDialog('permitApplication');
        playSound('click');
    });

    document.getElementById('btn-next-permit-step').addEventListener('click', () => {
        handlePermitStepAdvance();
    });
}

function handlePermitStepAdvance() {
    const nextBtn = document.getElementById('btn-next-permit-step');
    const result = permitService.advanceStep();

    // Handle rejection
    if (result.isRejection) {
        playSound('error');
        showPermitRejection(result.rejectionTitle, result.rejectionMessage);
        return;
    }

    // Handle delay
    if (result.isDelay) {
        playSound('click');
        showPermitDelay(result.delayMs, result.delayMessage, () => {
            // After delay, actually advance (this simulates the wait)
            const nextResult = permitService.advanceStep();
            if (nextResult.isComplete) {
                playSound('success');
                hideDialog('permitApplication');
                renderPermitsScreen();
                updateMoneyDisplays();
            } else if (nextResult.isRejection) {
                // Rejection can happen after delay too
                playSound('error');
                showPermitRejection(nextResult.rejectionTitle, nextResult.rejectionMessage);
            } else {
                updatePermitApplicationDialog();
            }
        });
        return;
    }

    // Normal success
    if (result.isComplete) {
        playSound('success');
        hideDialog('permitApplication');
        renderPermitsScreen();
        updateMoneyDisplays();
    } else {
        playSound('click');
        updatePermitApplicationDialog();
    }
}

function showPermitDelay(delayMs, message, callback) {
    const nextBtn = document.getElementById('btn-next-permit-step');
    const progressText = document.getElementById('permit-progress-text');
    const originalBtnText = nextBtn.textContent;
    const originalProgressText = progressText.textContent;

    // Disable button and show delay message
    nextBtn.disabled = true;
    nextBtn.textContent = '⏳ Processing...';
    progressText.textContent = message;
    progressText.style.color = 'var(--accent-warning)';

    // Wait for delay then continue
    setTimeout(() => {
        nextBtn.disabled = false;
        nextBtn.textContent = originalBtnText;
        progressText.style.color = '';
        callback();
    }, delayMs);
}

function showPermitRejection(title, message) {
    const stepsContainer = document.getElementById('permit-steps');
    const nextBtn = document.getElementById('btn-next-permit-step');
    const cancelBtn = document.getElementById('btn-cancel-permit');
    const progressText = document.getElementById('permit-progress-text');

    // Show rejection message
    stepsContainer.innerHTML = `
        <div class="permit-rejection">
            <div class="rejection-icon">❌</div>
            <h3 class="rejection-title">${title}</h3>
            <p class="rejection-message">${message}</p>
            <p class="rejection-hint">You will need to restart the application process.</p>
        </div>
    `;

    // Update progress
    progressText.textContent = 'Application Rejected';
    progressText.style.color = 'var(--accent-danger)';
    document.getElementById('permit-progress-fill').style.width = '0%';
    document.getElementById('permit-progress-fill').style.backgroundColor = 'var(--accent-danger)';

    // Update buttons
    nextBtn.classList.add('hidden');
    cancelBtn.textContent = 'Close';
}

function showPermitApplicationDialog() {
    // Reset dialog state (in case it was left in rejection state)
    const nextBtn = document.getElementById('btn-next-permit-step');
    const cancelBtn = document.getElementById('btn-cancel-permit');
    const progressText = document.getElementById('permit-progress-text');
    const progressFill = document.getElementById('permit-progress-fill');

    nextBtn.classList.remove('hidden');
    nextBtn.disabled = false;
    cancelBtn.textContent = 'Cancel';
    progressText.style.color = '';
    progressFill.style.backgroundColor = '';

    updatePermitApplicationDialog();
    showDialog('permitApplication');
}

function updatePermitApplicationDialog() {
    const state = permitService.getApplicationState();
    if (!state) return;

    const permit = PermitDefinitions[state.permitType];
    document.getElementById('permit-app-title').textContent = `Applying for: ${permit?.name}`;

    // Render steps
    const stepsContainer = document.getElementById('permit-steps');
    stepsContainer.innerHTML = state.steps.map((step, i) => {
        const isCompleted = i < state.currentStep;
        const isCurrent = i === state.currentStep;
        return `
            <div class="permit-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}">
                <span class="step-number">${isCompleted ? '✓' : i + 1}</span>
                <div class="step-content">
                    <span class="step-name">${step.name}</span>
                    <span class="step-description">${step.description}</span>
                </div>
            </div>
        `;
    }).join('');

    // Update progress
    document.getElementById('permit-progress-fill').style.width = `${state.progress}%`;
    document.getElementById('permit-progress-text').textContent = `Step ${state.currentStep + 1} of ${state.totalSteps}`;

    // Update button text for final step
    const nextBtn = document.getElementById('btn-next-permit-step');
    if (state.currentStep === state.totalSteps - 1) {
        nextBtn.textContent = `Complete & Pay ${getPermitCost(state.permitType, gameState.player.treatment)} 💰`;
    } else {
        nextBtn.textContent = 'Next Step';
    }
}

// ============================================
// UPGRADES SCREEN
// ============================================

function renderUpgradesScreen() {
    const container = document.getElementById('upgrades-grid');
    const upgrades = Object.values(UpgradeDefinitions);

    container.innerHTML = upgrades.map(upgrade => {
        const isOwned = gameState.player.hasUpgrade(upgrade.id);
        const hasPrereq = !upgrade.prerequisite || gameState.player.hasUpgrade(upgrade.prerequisite);
        const canAfford = gameState.player.money >= upgrade.cost;
        const canBuy = !isOwned && hasPrereq && canAfford;

        const icon = {
            engine: '🏎️',
            cargo: '📦',
            visual: '🎨',
            contacts: '🤝',
        }[upgrade.category] || '🔧';

        return `
            <div class="upgrade-card ${isOwned ? 'owned' : ''} ${!hasPrereq ? 'locked' : ''}">
                <div class="upgrade-icon">${icon}</div>
                <div class="upgrade-name">${upgrade.name}</div>
                <div class="upgrade-tier">Tier ${upgrade.tier}</div>
                <div class="upgrade-effect">${upgrade.effect}</div>
                <div class="upgrade-cost">${upgrade.cost} 💰</div>
                ${isOwned ? '<p style="color: var(--accent-success)">✅ Owned</p>' : ''}
                ${!hasPrereq ? '<p style="color: var(--text-muted)">🔒 Requires previous tier</p>' : ''}
                ${canBuy ? `<button class="btn btn-primary" onclick="window.buyUpgrade('${upgrade.id}')">Buy</button>` : ''}
            </div>
        `;
    }).join('');
}

// Global function for buying upgrades
window.buyUpgrade = function(upgradeId) {
    const upgrade = UpgradeDefinitions[upgradeId];
    if (!upgrade) return;

    if (gameState.player.money < upgrade.cost) {
        alert('Not enough money!');
        return;
    }

    if (upgrade.prerequisite && !gameState.player.hasUpgrade(upgrade.prerequisite)) {
        alert('You need the previous tier first!');
        return;
    }

    gameState.updateMoney(-upgrade.cost);
    gameState.addUpgrade(upgradeId);
    renderUpgradesScreen();
    updateMoneyDisplays();
};

// ============================================
// SETTINGS SCREEN
// ============================================

function renderSettingsScreen() {
    document.getElementById('consent-toggle').checked = gameState.player.consentGiven === true;
    document.getElementById('sound-toggle').checked = gameState.player.soundEnabled;
    document.getElementById('volume-slider').value = gameState.player.soundVolume;
    document.getElementById('settings-player-id').textContent = gameState.player.anonymousId;
    document.getElementById('settings-treatment').textContent = gameState.player.treatment || '--';
}

function setupSettingsActions() {
    document.getElementById('consent-toggle').addEventListener('change', (e) => {
        gameState.setConsent(e.target.checked);
    });

    // Sound settings
    document.getElementById('sound-toggle').addEventListener('change', (e) => {
        gameState.setSoundEnabled(e.target.checked);
        if (e.target.checked) {
            playSound('click'); // Test sound
        }
    });

    document.getElementById('volume-slider').addEventListener('input', (e) => {
        gameState.setSoundVolume(parseInt(e.target.value));
    });

    document.getElementById('btn-export-data').addEventListener('click', () => {
        exportPlayerData();
    });

    document.getElementById('btn-reset-data').addEventListener('click', async () => {
        if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
            await gameState.reset();
            updateAllDisplays();
            showScreen('home');
            showDialog('tutorial');
        }
    });

    // Upload diagnostics test
    document.getElementById('btn-test-upload').addEventListener('click', async () => {
        const btn = document.getElementById('btn-test-upload');
        const outputDiv = document.getElementById('upload-diagnostics');
        const resultPre = document.getElementById('diagnostics-result');

        btn.disabled = true;
        btn.textContent = '🔄 Testing...';
        outputDiv.classList.remove('hidden');
        resultPre.textContent = 'Running upload test...';

        try {
            const results = await testUploadEndpoint();

            let output = `=== Upload Diagnostic Results ===\n`;
            output += `Timestamp: ${results.timestamp}\n`;
            output += `Endpoint: ${results.endpoint}\n`;
            output += `App Secret: ${results.appSecret}\n\n`;

            output += `--- Steps ---\n`;
            for (const step of results.steps) {
                const icon = step.status === 'ok' ? '✅' : step.status === 'error' ? '❌' : '⚠️';
                output += `${icon} ${step.step}\n`;
            }

            output += `\n--- Response ---\n`;
            output += `HTTP Status: ${results.httpStatus || 'N/A'} ${results.httpStatusText || ''}\n`;
            if (results.responseBody) {
                output += `Response: ${results.responseBody}\n`;
            }
            if (results.error) {
                output += `Error: ${results.error}\n`;
            }

            output += `\n--- Diagnosis ---\n`;
            output += results.diagnosis || 'No diagnosis available';

            if (results.corsNote) {
                output += `\n\n⚠️ CORS Note: ${results.corsNote}`;
            }

            resultPre.textContent = output;

            // Color the output based on success
            if (results.success) {
                resultPre.className = 'success';
            } else {
                resultPre.className = 'error';
            }
        } catch (e) {
            resultPre.textContent = `Test failed with error: ${e.message}`;
            resultPre.className = 'error';
        }

        btn.disabled = false;
        btn.textContent = '🔬 Test Upload Connection';
    });
}

// ============================================
// START APPLICATION
// ============================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Handle window resize
window.addEventListener('resize', () => {
    if (drivingGame) {
        drivingGame.resize();
    }
});

// Process pending uploads periodically
setInterval(() => {
    processPendingUploads();
}, 60000); // Every minute

// BACKUP: Try to upload any in-progress session if user closes/navigates away
window.addEventListener('beforeunload', () => {
    // Only upload if user has given consent
    if (gameState.player?.consentGiven === true && gameState.currentSession) {
        const session = gameState.currentSession;
        session.outcome = 'abandoned';
        // Use setEndTime for consistent timestamp coarsening
        if (session.setEndTime) {
            session.setEndTime();
        } else {
            session.endTime = new Date().toISOString();
        }
        session.totalBribes = gameState.sessionBribeAmount;
        session.totalFines = gameState.sessionFineAmount;

        // Use sendBeacon for reliable delivery during page unload
        const payload = JSON.stringify({
            schemaVersion: '1.1.0',
            appVersion: '1.0.0',
            playerId: gameState.player.id,
            treatmentCode: gameState.player.treatment,
            session: session.toJSON ? session.toJSON() : session,
            timestamp: new Date().toISOString(),
            platform: 'web',
            uploadTrigger: 'beforeunload',
        });

        // sendBeacon is designed for this - it survives page close
        if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon('https://checkpoint-ingest.bntcurtis.workers.dev/', blob);
            console.log('📤 Emergency session upload via sendBeacon');
        }
    }

    // Also process any pending uploads (these are already consent-checked when queued)
    processPendingUploads();
});

// Also try on visibility change (mobile browsers)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        processPendingUploads();
    }
});

// ============================================
// SOUND SYSTEM
// ============================================

// Audio context for sound generation (no external files needed)
let audioContext = null;

function setupSoundSystem() {
    // Create audio context on first user interaction (required by browsers)
    const initAudio = () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        document.removeEventListener('click', initAudio);
        document.removeEventListener('touchstart', initAudio);
    };
    document.addEventListener('click', initAudio);
    document.addEventListener('touchstart', initAudio);
}

/**
 * Play a synthesized sound effect
 * @param {string} type - Sound type: 'click', 'success', 'error', 'coin', 'hit', 'checkpoint'
 */
function playSound(type) {
    if (!gameState.player.soundEnabled || !audioContext) return;

    const volume = (gameState.player.soundVolume / 100) * 0.3; // Max 30% volume
    const now = audioContext.currentTime;

    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        switch (type) {
            case 'click':
                oscillator.frequency.setValueAtTime(800, now);
                oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.05);
                gainNode.gain.setValueAtTime(volume * 0.5, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                oscillator.start(now);
                oscillator.stop(now + 0.05);
                break;

            case 'success':
            case 'coin':
                // Cha-ching sound (ascending notes)
                oscillator.frequency.setValueAtTime(523, now); // C5
                oscillator.frequency.setValueAtTime(659, now + 0.1); // E5
                oscillator.frequency.setValueAtTime(784, now + 0.2); // G5
                gainNode.gain.setValueAtTime(volume, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                oscillator.start(now);
                oscillator.stop(now + 0.4);
                break;

            case 'error':
            case 'buzzer':
                // Harsh buzzer
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(150, now);
                oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.3);
                gainNode.gain.setValueAtTime(volume * 0.7, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                break;

            case 'hit':
            case 'crash':
                // Impact sound
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(200, now);
                oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.15);
                gainNode.gain.setValueAtTime(volume, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                oscillator.start(now);
                oscillator.stop(now + 0.15);
                break;

            case 'checkpoint':
                // Alert sound
                oscillator.frequency.setValueAtTime(440, now);
                oscillator.frequency.setValueAtTime(550, now + 0.1);
                oscillator.frequency.setValueAtTime(440, now + 0.2);
                gainNode.gain.setValueAtTime(volume * 0.6, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                break;

            case 'bribe':
                // Sneaky sound (low tones)
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(200, now);
                oscillator.frequency.setValueAtTime(250, now + 0.1);
                oscillator.frequency.setValueAtTime(200, now + 0.2);
                gainNode.gain.setValueAtTime(volume * 0.5, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                oscillator.start(now);
                oscillator.stop(now + 0.25);
                break;

            default:
                // Generic beep
                oscillator.frequency.setValueAtTime(440, now);
                gainNode.gain.setValueAtTime(volume * 0.5, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                oscillator.start(now);
                oscillator.stop(now + 0.1);
        }
    } catch (e) {
        console.warn('Sound playback failed:', e);
    }
}

// Export for use in other modules
window.playSound = playSound;
