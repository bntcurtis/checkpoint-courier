/**
 * CHECKPOINT COURIER - Game State Management
 * Central state store with persistence
 */

import { Player, assignTreatment } from './models.js';

const STORAGE_KEY = 'checkpoint_courier_state';

/**
 * Global game state
 */
class GameState {
    constructor() {
        this.player = null;
        this.currentSession = null;
        this.currentDelivery = null;
        this.currentCheckpoint = 0;
        this.currentOfficer = null;
        this.gameSpeed = 0;
        this.sessionBribes = 0;
        this.sessionFines = 0;
        this.sessionBribeAmount = 0;
        this.sessionFineAmount = 0;
        this.pendingUploads = [];
        this.listeners = new Map();
    }

    /**
     * Initialize state - load from storage or create new
     */
    async initialize() {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.player = new Player(data.player);
                this.pendingUploads = data.pendingUploads || [];
            } catch (e) {
                console.error('Failed to load saved state:', e);
                await this.createNewPlayer();
            }
        } else {
            await this.createNewPlayer();
        }

        // Ensure treatment is assigned
        if (!this.player.treatment) {
            this.player.treatment = await assignTreatment(this.player.id);
            this.save();
        }

        this.emit('initialized', this.player);
        return this.player;
    }

    /**
     * Create a new player
     */
    async createNewPlayer() {
        this.player = new Player();
        this.player.treatment = await assignTreatment(this.player.id);
        this.save();
    }

    /**
     * Save state to localStorage
     */
    save() {
        const data = {
            player: this.player.toJSON(),
            pendingUploads: this.pendingUploads,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        this.emit('saved', this.player);
    }

    /**
     * Reset all data
     */
    async reset() {
        localStorage.removeItem(STORAGE_KEY);
        await this.createNewPlayer();
        this.emit('reset', this.player);
        return this.player;
    }

    // ========================================
    // PLAYER STATE MUTATIONS
    // ========================================

    updateMoney(delta) {
        this.player.money += delta;
        this.save();
        this.emit('moneyChanged', this.player.money);
    }

    setMoney(amount) {
        this.player.money = amount;
        this.save();
        this.emit('moneyChanged', this.player.money);
    }

    recordDelivery() {
        this.player.totalDeliveries++;
        this.save();
        this.emit('deliveryCompleted', this.player.totalDeliveries);
    }

    recordBribe(amount) {
        this.player.totalBribes++;
        this.player.totalBribeAmount += amount;
        this.sessionBribes++;
        this.sessionBribeAmount += amount;
        this.save();
        this.emit('bribeRecorded', { count: this.player.totalBribes, total: this.player.totalBribeAmount });
    }

    recordFine(amount) {
        this.player.totalFines++;
        this.player.totalFineAmount += amount;
        this.sessionFines++;
        this.sessionFineAmount += amount;
        this.save();
        this.emit('fineRecorded', { count: this.player.totalFines, total: this.player.totalFineAmount });
    }

    // ========================================
    // HEAT MANAGEMENT
    // ========================================

    increaseHeat(personality, amount = 0.15) {
        const current = this.player.heatTracker[personality] || 0;
        this.player.heatTracker[personality] = Math.min(1.0, current + amount);
        this.save();
        this.emit('heatChanged', this.player.heatTracker);
    }

    decayHeat(amount = 0.05) {
        let changed = false;
        for (const personality of Object.keys(this.player.heatTracker)) {
            if (this.player.heatTracker[personality] > 0) {
                this.player.heatTracker[personality] = Math.max(0, this.player.heatTracker[personality] - amount);
                changed = true;
            }
        }
        if (changed) {
            this.save();
            this.emit('heatChanged', this.player.heatTracker);
        }
    }

    // ========================================
    // PERMITS
    // ========================================

    addPermit(permitType, deliveries) {
        const current = this.player.permitInventory[permitType] || 0;
        this.player.permitInventory[permitType] = current + deliveries;
        // Track that player has owned this permit type (for prerequisite checking)
        this.player.permitsEverOwned[permitType] = true;
        this.save();
        this.emit('permitAdded', { type: permitType, remaining: this.player.permitInventory[permitType] });
    }

    usePermit(permitType) {
        if (this.player.permitInventory[permitType] > 0) {
            this.player.permitInventory[permitType]--;
            this.save();
            this.emit('permitUsed', { type: permitType, remaining: this.player.permitInventory[permitType] });
            return true;
        }
        return false;
    }

    consumeOnePermitUse() {
        // Use up one delivery from any valid permit
        for (const permitType of Object.keys(this.player.permitInventory)) {
            if (this.player.permitInventory[permitType] > 0) {
                this.player.permitInventory[permitType]--;
                this.save();
                this.emit('permitUsed', { type: permitType, remaining: this.player.permitInventory[permitType] });
                return true;
            }
        }
        return false;
    }

    // ========================================
    // UPGRADES
    // ========================================

    addUpgrade(upgradeId) {
        if (!this.player.upgrades.includes(upgradeId)) {
            this.player.upgrades.push(upgradeId);
            this.save();
            this.emit('upgradeAdded', upgradeId);
        }
    }

    // ========================================
    // IMPOUND
    // ========================================

    impoundTruck(deliveriesToWait = 3) {
        this.player.impoundedUntilDelivery = this.player.totalDeliveries + deliveriesToWait;
        this.save();
        this.emit('truckImpounded', this.player.impoundedUntilDelivery);
    }

    // ========================================
    // CONSENT & SETTINGS
    // ========================================

    setConsent(value) {
        this.player.consentGiven = value;
        this.save();
        this.emit('consentChanged', value);
    }

    setSoundEnabled(value) {
        this.player.soundEnabled = value;
        this.save();
        this.emit('soundChanged', value);
    }

    setSoundVolume(value) {
        this.player.soundVolume = value;
        this.save();
    }

    completeTutorial() {
        this.player.tutorialComplete = true;
        this.save();
        this.emit('tutorialCompleted');
    }

    // ========================================
    // PERMIT FRUSTRATION TRACKING
    // ========================================

    recordPermitAttempt() {
        this.player.permitApplicationAttempts++;
        this.save();
    }

    recordPermitFailure() {
        this.player.permitApplicationFailures++;
        this.save();
        this.emit('permitFailed', this.player.permitApplicationFailures);
    }

    recordPermitAbandon() {
        this.player.permitApplicationAbandons++;
        this.save();
        this.emit('permitAbandoned', this.player.permitApplicationAbandons);
    }

    // ========================================
    // SESSION MANAGEMENT
    // ========================================

    startSession(session) {
        this.currentSession = session;
        this.sessionBribes = 0;
        this.sessionFines = 0;
        this.sessionBribeAmount = 0;
        this.sessionFineAmount = 0;
        this.currentCheckpoint = 0;
        this.emit('sessionStarted', session);
    }

    endSession(outcome) {
        if (this.currentSession) {
            this.currentSession.outcome = outcome;
            // Use setEndTime for consistent timestamp coarsening
            if (this.currentSession.setEndTime) {
                this.currentSession.setEndTime();
            } else {
                this.currentSession.endTime = new Date().toISOString();
            }
            this.currentSession.moneyAfter = this.player.money;
            this.emit('sessionEnded', this.currentSession);
        }
        this.currentSession = null;
        this.currentDelivery = null;
        this.currentOfficer = null;
    }

    setCurrentDelivery(delivery) {
        this.currentDelivery = delivery;
        this.emit('deliverySelected', delivery);
    }

    setCurrentOfficer(officer) {
        this.currentOfficer = officer;
        this.emit('officerEncountered', officer);
    }

    advanceCheckpoint() {
        this.currentCheckpoint++;
        if (this.currentSession) {
            this.currentSession.checkpointsPassed++;
        }
        this.emit('checkpointAdvanced', this.currentCheckpoint);
    }

    setGameSpeed(speed) {
        this.gameSpeed = speed;
        this.emit('speedChanged', speed);
    }

    // ========================================
    // DATA UPLOAD QUEUE
    // ========================================

    queueUpload(data) {
        this.pendingUploads.push(data);
        this.save();
        this.emit('uploadQueued', data);
    }

    clearUpload(index) {
        this.pendingUploads.splice(index, 1);
        this.save();
    }

    // ========================================
    // EVENT SYSTEM
    // ========================================

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            for (const callback of this.listeners.get(event)) {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`Error in event listener for ${event}:`, e);
                }
            }
        }
    }
}

// Singleton instance
export const gameState = new GameState();
