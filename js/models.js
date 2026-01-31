/**
 * CHECKPOINT COURIER - Data Models
 * Core entities and enums for the game
 */

// ============================================
// ENUMS
// ============================================

export const TreatmentCondition = {
    LR: 'LR', // Low bureaucracy, Rare enforcement (Control)
    HR: 'HR', // High bureaucracy, Rare enforcement
    LF: 'LF', // Low bureaucracy, Frequent enforcement
    HF: 'HF', // High bureaucracy, Frequent enforcement
};

export const OfficerPersonality = {
    BY_THE_BOOK: 'byTheBook',
    PRAGMATIC: 'pragmatic',
    CORRUPT: 'corrupt',
    LAZY: 'lazy',
    ZEALOT: 'zealot',
    SHAKEDOWN: 'shakedown',
};

export const NegotiationAction = {
    SHOW_PERMIT: 'show_permit',
    BRIBE: 'bribe',
    ARGUE: 'argue',
    BLUFF: 'bluff',
    FLEE: 'flee',
    COMPLY: 'comply',
    REPORT: 'report',
};

export const NegotiationOutcome = {
    PASSED: 'passed',
    FINED: 'fined',
    BRIBE_ACCEPTED: 'bribe_accepted',
    BRIBE_REJECTED: 'bribe_rejected',
    FLED_SUCCESS: 'fled_success',
    FLED_CAUGHT: 'fled_caught',
    IMPOUNDED: 'impounded',
    ARGUED_SUCCESS: 'argued_success',
    ARGUED_FAILED: 'argued_failed',
    BLUFF_SUCCESS: 'bluff_success',
    BLUFF_FAILED: 'bluff_failed',
    REPORTED: 'reported',
};

export const PermitType = {
    TEMP_COURIER_PASS: 'temp_courier_pass',
    STANDARD_LICENSE: 'standard_courier_license',
    PREMIUM_LICENSE: 'premium_courier_license',
    HAZMAT_CERT: 'hazmat_certification',
    EXPRESS_PASS: 'express_lane_pass',
};

export const UpgradeCategory = {
    ENGINE: 'engine',
    CARGO: 'cargo',
    VISUAL: 'visual',
    CONTACTS: 'contacts',
};

// ============================================
// OFFICER PERSONALITY STATS
// ============================================

export const OfficerStats = {
    [OfficerPersonality.BY_THE_BOOK]: {
        name: 'By the Book',
        corruptibility: 0.1,
        strictness: 0.9,
        greed: 0.2,
        patience: 0.7,
    },
    [OfficerPersonality.PRAGMATIC]: {
        name: 'Pragmatic',
        corruptibility: 0.5,
        strictness: 0.5,
        greed: 0.5,
        patience: 0.6,
    },
    [OfficerPersonality.CORRUPT]: {
        name: 'Corrupt',
        corruptibility: 0.85,
        strictness: 0.4,
        greed: 0.9,
        patience: 0.4,
    },
    [OfficerPersonality.LAZY]: {
        name: 'Lazy',
        corruptibility: 0.6,
        strictness: 0.2,
        greed: 0.3,
        patience: 0.8,
    },
    [OfficerPersonality.ZEALOT]: {
        name: 'Zealot',
        corruptibility: 0.0,
        strictness: 0.95,
        greed: 0.1,
        patience: 0.3,
    },
    [OfficerPersonality.SHAKEDOWN]: {
        name: 'Shakedown',
        corruptibility: 0.85,
        strictness: 0.85,
        greed: 0.95,
        patience: 0.2,
    },
};

// ============================================
// PERMIT DEFINITIONS
// ============================================

export const PermitDefinitions = {
    [PermitType.TEMP_COURIER_PASS]: {
        id: PermitType.TEMP_COURIER_PASS,
        name: 'Temporary Courier Pass',
        description: 'Basic authorization for courier activities',
        baseCost: 100,
        deliveriesGranted: 3,
        prerequisite: null,
        tier: 1,
        stepsLowBureaucracy: 2,
        stepsHighBureaucracy: 5,
    },
    [PermitType.STANDARD_LICENSE]: {
        id: PermitType.STANDARD_LICENSE,
        name: 'Standard Courier License',
        description: 'Full courier authorization with extended validity',
        baseCost: 250,
        deliveriesGranted: 5,
        prerequisite: PermitType.TEMP_COURIER_PASS,
        tier: 2,
        stepsLowBureaucracy: 2,
        stepsHighBureaucracy: 6,
    },
    [PermitType.PREMIUM_LICENSE]: {
        id: PermitType.PREMIUM_LICENSE,
        name: 'Premium Courier License',
        description: 'Priority courier status with maximum validity',
        baseCost: 500,
        deliveriesGranted: 8,
        prerequisite: PermitType.STANDARD_LICENSE,
        tier: 3,
        stepsLowBureaucracy: 3,
        stepsHighBureaucracy: 8,
    },
    [PermitType.HAZMAT_CERT]: {
        id: PermitType.HAZMAT_CERT,
        name: 'Hazmat Certification',
        description: 'Required for transporting special cargo',
        baseCost: 400,
        deliveriesGranted: 10,
        prerequisite: PermitType.STANDARD_LICENSE,
        tier: 2,
        stepsLowBureaucracy: 3,
        stepsHighBureaucracy: 7,
    },
    [PermitType.EXPRESS_PASS]: {
        id: PermitType.EXPRESS_PASS,
        name: 'Express Lane Pass',
        description: 'Priority passage through checkpoints',
        baseCost: 350,
        deliveriesGranted: 4,
        prerequisite: null,
        tier: 1,
        stepsLowBureaucracy: 2,
        stepsHighBureaucracy: 5,
    },
};

// ============================================
// UPGRADE DEFINITIONS
// ============================================

export const UpgradeDefinitions = {
    engine_t1: {
        id: 'engine_t1',
        category: UpgradeCategory.ENGINE,
        name: 'Tuned Engine',
        tier: 1,
        cost: 300,
        effect: '+5% flee success',
        fleeBonus: 0.05,
        prerequisite: null,
    },
    engine_t2: {
        id: 'engine_t2',
        category: UpgradeCategory.ENGINE,
        name: 'Sport Engine',
        tier: 2,
        cost: 600,
        effect: '+10% flee success',
        fleeBonus: 0.10,
        prerequisite: 'engine_t1',
    },
    engine_t3: {
        id: 'engine_t3',
        category: UpgradeCategory.ENGINE,
        name: 'Racing Engine',
        tier: 3,
        cost: 1200,
        effect: '+15% flee success',
        fleeBonus: 0.15,
        prerequisite: 'engine_t2',
    },
    cargo_t1: {
        id: 'cargo_t1',
        category: UpgradeCategory.CARGO,
        name: 'Cargo Racks',
        tier: 1,
        cost: 250,
        effect: '+15% delivery rewards',
        rewardBonus: 0.15,
        prerequisite: null,
    },
    cargo_t2: {
        id: 'cargo_t2',
        category: UpgradeCategory.CARGO,
        name: 'Expanded Cargo',
        tier: 2,
        cost: 500,
        effect: '+25% delivery rewards',
        rewardBonus: 0.25,
        prerequisite: 'cargo_t1',
    },
    cargo_t3: {
        id: 'cargo_t3',
        category: UpgradeCategory.CARGO,
        name: 'Max Capacity',
        tier: 3,
        cost: 1000,
        effect: '+40% delivery rewards',
        rewardBonus: 0.40,
        prerequisite: 'cargo_t2',
    },
    visual_t1: {
        id: 'visual_t1',
        category: UpgradeCategory.VISUAL,
        name: 'Custom Paint',
        tier: 1,
        cost: 150,
        effect: 'Looks cool',
        prerequisite: null,
    },
    visual_t2: {
        id: 'visual_t2',
        category: UpgradeCategory.VISUAL,
        name: 'Chrome Trim',
        tier: 2,
        cost: 350,
        effect: 'Looks cooler',
        prerequisite: 'visual_t1',
    },
    visual_t3: {
        id: 'visual_t3',
        category: UpgradeCategory.VISUAL,
        name: 'Full Custom',
        tier: 3,
        cost: 750,
        effect: 'Maximum style',
        prerequisite: 'visual_t2',
    },
    contacts_t1: {
        id: 'contacts_t1',
        category: UpgradeCategory.CONTACTS,
        name: 'Local Contacts',
        tier: 1,
        cost: 400,
        effect: '10% bribe discount, +5% acceptance',
        bribeDiscount: 0.10,
        acceptanceBonus: 0.05,
        prerequisite: null,
    },
    contacts_t2: {
        id: 'contacts_t2',
        category: UpgradeCategory.CONTACTS,
        name: 'Network',
        tier: 2,
        cost: 800,
        effect: '20% bribe discount, +10% acceptance',
        bribeDiscount: 0.20,
        acceptanceBonus: 0.10,
        prerequisite: 'contacts_t1',
    },
    contacts_t3: {
        id: 'contacts_t3',
        category: UpgradeCategory.CONTACTS,
        name: 'Inner Circle',
        tier: 3,
        cost: 1500,
        effect: '35% bribe discount, +15% acceptance',
        bribeDiscount: 0.35,
        acceptanceBonus: 0.15,
        prerequisite: 'contacts_t2',
    },
};

// ============================================
// DELIVERY ROUTE THEMES
// ============================================

export const RouteThemes = {
    CITY: {
        id: 'city',
        name: 'City Streets',
        color: '#4a5568',
        obstacleFrequency: 0.3,
    },
    HIGHWAY: {
        id: 'highway',
        name: 'Highway',
        color: '#2d3748',
        obstacleFrequency: 0.2,
    },
    RURAL: {
        id: 'rural',
        name: 'Rural Roads',
        color: '#276749',
        obstacleFrequency: 0.25,
    },
    MOUNTAIN: {
        id: 'mountain',
        name: 'Mountain Pass',
        color: '#553c2a',
        obstacleFrequency: 0.4,
    },
    COASTAL: {
        id: 'coastal',
        name: 'Coastal Route',
        color: '#2b6cb0',
        obstacleFrequency: 0.35,
    },
    INDUSTRIAL: {
        id: 'industrial',
        name: 'Industrial Zone',
        color: '#4a5568',
        obstacleFrequency: 0.3,
    },
};

// ============================================
// DATA CLASSES
// ============================================

/**
 * Player state
 */
export class Player {
    constructor(data = {}) {
        this.id = data.id || generateUUID();
        this.anonymousId = data.anonymousId || this.id.substring(0, 8);
        this.treatment = data.treatment || null; // Assigned on first load
        this.money = data.money ?? 500;
        this.totalDeliveries = data.totalDeliveries ?? 0;
        this.totalBribes = data.totalBribes ?? 0;
        this.totalFines = data.totalFines ?? 0;
        this.totalBribeAmount = data.totalBribeAmount ?? 0;
        this.totalFineAmount = data.totalFineAmount ?? 0;
        this.permitInventory = data.permitInventory || {}; // { permitType: deliveriesRemaining }
        this.permitsEverOwned = data.permitsEverOwned || {}; // { permitType: true } - tracks permit ownership history
        this.heatTracker = data.heatTracker || this.initializeHeatTracker();
        this.upgrades = data.upgrades || []; // Array of upgrade IDs
        this.impoundedUntilDelivery = data.impoundedUntilDelivery ?? 0;
        this.firstLaunch = data.firstLaunch || new Date().toISOString();
        this.tutorialComplete = data.tutorialComplete ?? false;

        // Consent & Settings
        this.consentGiven = data.consentGiven ?? null; // null = not yet asked, true/false = answered
        this.soundEnabled = data.soundEnabled ?? false;
        this.soundVolume = data.soundVolume ?? 50;

        // Research metrics: Bureaucracy Frustration Index
        this.permitApplicationAttempts = data.permitApplicationAttempts ?? 0;
        this.permitApplicationFailures = data.permitApplicationFailures ?? 0;
        this.permitApplicationAbandons = data.permitApplicationAbandons ?? 0;
    }

    initializeHeatTracker() {
        const tracker = {};
        Object.values(OfficerPersonality).forEach(p => {
            tracker[p] = 0;
        });
        return tracker;
    }

    hasPermit(permitType) {
        return (this.permitInventory[permitType] || 0) > 0;
    }

    hasAnyValidPermit() {
        return Object.values(this.permitInventory).some(v => v > 0);
    }

    getHeat(personality) {
        return this.heatTracker[personality] || 0;
    }

    hasUpgrade(upgradeId) {
        return this.upgrades.includes(upgradeId);
    }

    getUpgradeBonus(bonusType) {
        let total = 0;
        for (const upgradeId of this.upgrades) {
            const upgrade = UpgradeDefinitions[upgradeId];
            if (upgrade && upgrade[bonusType]) {
                total = upgrade[bonusType]; // Use highest tier only
            }
        }
        return total;
    }

    isImpounded() {
        return this.impoundedUntilDelivery > this.totalDeliveries;
    }

    toJSON() {
        return {
            id: this.id,
            anonymousId: this.anonymousId,
            treatment: this.treatment,
            money: this.money,
            totalDeliveries: this.totalDeliveries,
            totalBribes: this.totalBribes,
            totalFines: this.totalFines,
            totalBribeAmount: this.totalBribeAmount,
            totalFineAmount: this.totalFineAmount,
            permitInventory: this.permitInventory,
            permitsEverOwned: this.permitsEverOwned,
            heatTracker: this.heatTracker,
            upgrades: this.upgrades,
            impoundedUntilDelivery: this.impoundedUntilDelivery,
            firstLaunch: this.firstLaunch,
            tutorialComplete: this.tutorialComplete,
            // Settings
            consentGiven: this.consentGiven,
            soundEnabled: this.soundEnabled,
            soundVolume: this.soundVolume,
            // Research metrics
            permitApplicationAttempts: this.permitApplicationAttempts,
            permitApplicationFailures: this.permitApplicationFailures,
            permitApplicationAbandons: this.permitApplicationAbandons,
        };
    }

    /**
     * Get the bureaucracy frustration index (0-1)
     * Higher = more frustrated
     */
    getFrustrationIndex() {
        if (this.permitApplicationAttempts === 0) return 0;
        const failureRate = this.permitApplicationFailures / this.permitApplicationAttempts;
        const abandonRate = this.permitApplicationAbandons / Math.max(1, this.permitApplicationAttempts);
        return Math.min(1, (failureRate * 0.6) + (abandonRate * 0.4));
    }
}

/**
 * Delivery contract
 */
export class DeliveryContract {
    constructor(data) {
        this.id = data.id || generateUUID();
        this.name = data.name;
        this.route = data.route; // RouteTheme
        this.baseReward = data.baseReward;
        this.checkpointCount = data.checkpointCount;
        this.hasContraband = data.hasContraband || false;
        this.requiresPermit = data.requiresPermit ?? true;
        this.distance = data.distance || 1000; // meters for game
    }

    getEffectiveReward(player) {
        let reward = this.baseReward;
        if (this.hasContraband) {
            reward *= 3;
        }
        const cargoBonus = player.getUpgradeBonus('rewardBonus');
        reward *= (1 + cargoBonus);
        return Math.floor(reward);
    }
}

/**
 * Officer instance at a checkpoint
 */
export class Officer {
    constructor(personality, isBlitz = false) {
        this.personality = personality;
        this.stats = { ...OfficerStats[personality] };
        this.isBlitz = isBlitz; // Crackdown event
        this.dialogue = [];
    }

    get name() {
        return this.stats.name;
    }
}

/**
 * Checkpoint encounter data (for logging)
 */
export class CheckpointEncounter {
    constructor(data) {
        this.id = data.id || generateUUID();
        this.sessionId = data.sessionId;
        this.playerId = data.playerId;
        this.treatment = data.treatment;
        this.checkpointNumber = data.checkpointNumber;
        this.officerPersonality = data.officerPersonality;
        this.officerCorruptibility = data.officerCorruptibility;
        this.officerStrictness = data.officerStrictness;
        this.officerGreed = data.officerGreed;
        this.playerAction = data.playerAction;
        this.outcome = data.outcome;
        this.bribeOffered = data.bribeOffered || 0;
        this.bribeExpected = data.bribeExpected || 0;
        this.fineAmount = data.fineAmount || 0;
        // Net money change from this encounter (negative = cost)
        this.moneyChange = data.moneyChange ?? 0;
        this.playerSpeed = data.playerSpeed;
        this.hadPermit = data.hadPermit;
        this.hadContraband = data.hadContraband;
        this.heatLevel = data.heatLevel;
        this.responseTimeMs = data.responseTimeMs;
        this.timestamp = coarsenTimestamp(new Date());

        // Environmental/contextual factors for research
        this.isBlitz = data.isBlitz ?? false;
        this.moneyBeforeEncounter = data.moneyBeforeEncounter ?? 0;

        // Hover time tracking (behavioral hesitation metrics)
        // Each tracks milliseconds spent hovering over the button before final action
        this.hoverTimeBribe = data.hoverTimeBribe || 0;
        this.hoverTimePermit = data.hoverTimePermit || 0;
        this.hoverTimeArgue = data.hoverTimeArgue || 0;
        this.hoverTimeBluff = data.hoverTimeBluff || 0;
        this.hoverTimeFlee = data.hoverTimeFlee || 0;
        this.hoverTimeComply = data.hoverTimeComply || 0;
    }

    toJSON() {
        return { ...this };
    }
}

/**
 * Session data (one per delivery attempt)
 */
export class DeliverySession {
    constructor(data) {
        this.id = data.id || generateUUID();
        this.playerId = data.playerId;
        this.treatment = data.treatment;
        this.deliveryId = data.deliveryId;
        this.startTime = data.startTime || coarsenTimestamp(new Date());
        this.endTime = data.endTime || null; // Set via setEndTime() for consistency
        this.moneyBefore = data.moneyBefore;
        this.moneyAfter = data.moneyAfter || null;
        this.checkpointsTotal = data.checkpointsTotal;
        this.checkpointsPassed = data.checkpointsPassed || 0;
        this.outcome = data.outcome || null; // 'completed', 'abandoned', 'impounded'
        this.encounters = data.encounters || [];
        this.totalBribes = data.totalBribes || 0;
        this.totalFines = data.totalFines || 0;
        // Optional richer aggregates (filled in by main.js before upload)
        this.totalBribesOffered = data.totalBribesOffered ?? null;
        this.totalBribesAccepted = data.totalBribesAccepted ?? null;
        this.bribeAttempts = data.bribeAttempts ?? null;
        this.totalCheckpointCosts = data.totalCheckpointCosts ?? null;
        this.hadContraband = data.hadContraband || false;
        // Duration in milliseconds (more useful than precise timestamps for research)
        this.durationMs = data.durationMs || null;
    }

    /**
     * Set end time with coarsened timestamp for privacy consistency
     */
    setEndTime() {
        const now = new Date();
        this.endTime = coarsenTimestamp(now);
        // Also calculate duration if we have start time
        if (this.startTime) {
            const start = new Date(this.startTime);
            this.durationMs = now.getTime() - start.getTime();
        }
    }

    toJSON() {
        return {
            ...this,
            encounters: this.encounters.map(e => e.toJSON ? e.toJSON() : e),
        };
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a UUID v4
 */
export function generateUUID() {
    // Use crypto.randomUUID() if available (modern browsers), fallback to custom implementation
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Coarsen timestamp to hour level for privacy
 */
export function coarsenTimestamp(date) {
    const coarsened = new Date(date);
    coarsened.setMinutes(0, 0, 0);
    return coarsened.toISOString();
}

/**
 * Deterministic treatment assignment using SHA-256 hash of UUID
 */
export async function assignTreatment(playerId) {
    const encoder = new TextEncoder();
    const data = encoder.encode(playerId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);

    // Use first two bytes for 2x2 factorial design
    const highBureaucracy = (hashArray[0] % 2) === 1;
    const frequentEnforcement = (hashArray[1] % 2) === 1;

    if (highBureaucracy && frequentEnforcement) {
        return TreatmentCondition.HF;
    } else if (highBureaucracy) {
        return TreatmentCondition.HR;
    } else if (frequentEnforcement) {
        return TreatmentCondition.LF;
    } else {
        return TreatmentCondition.LR;
    }
}

/**
 * Check if player has high bureaucracy treatment
 */
export function isHighBureaucracy(treatment) {
    return treatment === TreatmentCondition.HR || treatment === TreatmentCondition.HF;
}

/**
 * Check if player has frequent enforcement treatment
 */
export function isFrequentEnforcement(treatment) {
    return treatment === TreatmentCondition.LF || treatment === TreatmentCondition.HF;
}

/**
 * Get permit cost with bureaucracy multiplier
 */
export function getPermitCost(permitType, treatment) {
    const permit = PermitDefinitions[permitType];
    if (!permit) return 0;

    let cost = permit.baseCost;
    if (isHighBureaucracy(treatment)) {
        cost = Math.floor(cost * 1.5);
    }
    return cost;
}

/**
 * Get permit steps based on treatment
 */
export function getPermitSteps(permitType, treatment) {
    const permit = PermitDefinitions[permitType];
    if (!permit) return 2;

    return isHighBureaucracy(treatment)
        ? permit.stepsHighBureaucracy
        : permit.stepsLowBureaucracy;
}

/**
 * Get deliveries granted by permit (reduced for high bureaucracy)
 */
export function getPermitDeliveries(permitType, treatment) {
    const permit = PermitDefinitions[permitType];
    if (!permit) return 3;

    let deliveries = permit.deliveriesGranted;
    if (isHighBureaucracy(treatment)) {
        // High bureaucracy: shorter validity
        deliveries = Math.max(2, Math.floor(deliveries * 0.6));
    }
    return deliveries;
}

/**
 * Get number of checkpoints for a delivery based on treatment
 */
export function getCheckpointCount(baseCount, treatment) {
    if (isFrequentEnforcement(treatment)) {
        return Math.min(baseCount * 2, 8);
    }
    return baseCount;
}

/**
 * Get officer presence probability
 * Per research design: officers should be present at EVERY checkpoint
 */
export function getOfficerPresenceProbability(treatment) {
    // Always 100% - every checkpoint has an officer
    return 1.0;
}

/**
 * Get blitz event probability
 */
export function getBlitzProbability(treatment) {
    return isFrequentEnforcement(treatment) ? 0.4 : 0.1;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Random float between min and max
 */
export function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Pick a random item from an array
 */
export function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Weighted random selection
 */
export function weightedRandom(items, weights) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return items[i];
        }
    }
    return items[items.length - 1];
}
