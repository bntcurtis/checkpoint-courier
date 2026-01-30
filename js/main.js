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
    setupGameControls();
    setupNegotiationActions();
    setupSettingsActions();
    setupPermitDialog();

    // Update UI with player data
    updateAllDisplays();

    // Listen for state changes
    gameState.on('moneyChanged', updateMoneyDisplays);
    gameState.on('deliveryCompleted', updateDeliveryCount);

    // Show tutorial for new players
    if (!gameState.player.tutorialComplete) {
        showDialog('tutorial');
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
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
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

    // Touch/mouse events for acceleration
    accelerateBtn.addEventListener('mousedown', () => drivingGame?.setAccelerating(true));
    accelerateBtn.addEventListener('mouseup', () => drivingGame?.setAccelerating(false));
    accelerateBtn.addEventListener('mouseleave', () => drivingGame?.setAccelerating(false));
    accelerateBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        drivingGame?.setAccelerating(true);
    });
    accelerateBtn.addEventListener('touchend', () => drivingGame?.setAccelerating(false));

    // Touch/mouse events for braking
    brakeBtn.addEventListener('mousedown', () => drivingGame?.setBraking(true));
    brakeBtn.addEventListener('mouseup', () => drivingGame?.setBraking(false));
    brakeBtn.addEventListener('mouseleave', () => drivingGame?.setBraking(false));
    brakeBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        drivingGame?.setBraking(true);
    });
    brakeBtn.addEventListener('touchend', () => drivingGame?.setBraking(false));

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

    // Update dialog content
    document.getElementById('officer-title').textContent = 'Checkpoint Officer';
    document.getElementById('officer-personality').textContent = officer.stats.name;
    document.getElementById('officer-dialogue').textContent = `"${getInitialDialogue(officer)}"`;

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

    // Track response time
    negotiationStartTime = performance.now();

    showDialog('negotiation');
}

function setupNegotiationActions() {
    document.querySelectorAll('#negotiation-actions .btn-action').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
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

    // Process the action
    const result = processNegotiation(action, context);

    // Log encounter
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
    });

    if (gameState.currentSession) {
        gameState.currentSession.encounters.push(encounter);
    }

    // Apply results
    if (result.moneyChange !== 0) {
        gameState.updateMoney(result.moneyChange);
    }

    if (result.bribeAmount > 0 && result.passed) {
        gameState.recordBribe(result.bribeAmount);
        gameState.increaseHeat(officer.personality, result.heatChange || 0.15);
    }

    if (result.fineAmount > 0) {
        gameState.recordFine(result.fineAmount);
    }

    if (result.impounded) {
        gameState.impoundTruck(3);
    }

    // Use permit if showed valid one
    if (action === NegotiationAction.SHOW_PERMIT && result.passed) {
        gameState.consumeOnePermitUse();
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

    // End the session as abandoned
    const session = gameState.currentSession;
    gameState.endSession('abandoned');

    // Upload the session data
    if (session) {
        session.totalBribes = gameState.sessionBribeAmount;
        session.totalFines = gameState.sessionFineAmount;

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
}

function showGameOverSummary(delivery) {
    const dialog = document.getElementById('delivery-complete-dialog');
    const titleEl = dialog.querySelector('h2');
    const detailsEl = dialog.querySelector('.delivery-details');
    const rewardEl = dialog.querySelector('.delivery-reward');

    titleEl.textContent = '💥 Vehicle Destroyed!';

    detailsEl.innerHTML = `
        <p>Your truck took too much damage from obstacles.</p>
        <p>The delivery was abandoned.</p>
        ${delivery ? `<p class="route-name">${delivery.name}</p>` : ''}
    `;

    rewardEl.innerHTML = `
        <p style="color: #ef4444; font-size: 1.2em;">No reward earned</p>
        <p>Current balance: $${gameState.player.money}</p>
    `;

    showDialog('delivery-complete');
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
    });

    document.getElementById('btn-next-permit-step').addEventListener('click', () => {
        const result = permitService.advanceStep();
        if (result.isComplete) {
            hideDialog('permitApplication');
            renderPermitsScreen();
            updateMoneyDisplays();
        } else {
            updatePermitApplicationDialog();
        }
    });
}

function showPermitApplicationDialog() {
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
    document.getElementById('consent-toggle').checked = gameState.player.consentGiven;
}

function setupSettingsActions() {
    document.getElementById('consent-toggle').addEventListener('change', (e) => {
        gameState.setConsent(e.target.checked);
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
    // If there's an active session, try to upload it
    if (gameState.currentSession) {
        const session = gameState.currentSession;
        session.outcome = 'abandoned';
        session.endTime = new Date().toISOString();
        session.totalBribes = gameState.sessionBribeAmount;
        session.totalFines = gameState.sessionFineAmount;

        // Use sendBeacon for reliable delivery during page unload
        const payload = JSON.stringify({
            playerId: gameState.player.id,
            treatmentCode: gameState.player.treatment,
            session: session.toJSON ? session.toJSON() : session,
            timestamp: new Date().toISOString(),
            appVersion: '1.0.0',
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

    // Also process any pending uploads
    processPendingUploads();
});

// Also try on visibility change (mobile browsers)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        processPendingUploads();
    }
});
