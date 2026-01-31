/**
 * CHECKPOINT COURIER - Officer AI Service
 * Handles all officer decision-making logic
 */

import {
    OfficerPersonality,
    OfficerStats,
    NegotiationAction,
    NegotiationOutcome,
    Officer,
    clamp,
    randomFloat,
    randomChoice,
    weightedRandom,
} from './models.js';

// ============================================
// OFFICER GENERATION
// ============================================

/**
 * Generate an officer for a checkpoint
 */
export function generateOfficer(isBlitz = false) {
    // Weighted distribution of personalities
    const personalities = Object.values(OfficerPersonality);
    const weights = isBlitz
        ? [0.1, 0.15, 0.1, 0.05, 0.3, 0.3] // More zealots/shakedowns during blitz
        : [0.15, 0.25, 0.2, 0.2, 0.1, 0.1]; // Normal distribution

    const personality = weightedRandom(personalities, weights);
    return new Officer(personality, isBlitz);
}

// ============================================
// FINE CALCULATION
// ============================================

/**
 * Calculate the base fine for violations
 */
export function calculateFine(context) {
    const {
        isSpeeding,
        hasPermit,
        hasContraband,
        isAggravated, // from failed bluff or flee
        officer,
    } = context;

    let fine = 100; // Base fine

    // Speeding violation
    if (isSpeeding) {
        fine += 50;
    }

    // Missing permit
    if (!hasPermit) {
        fine += 100;
    }

    // Contraband multiplier
    if (hasContraband) {
        fine *= 3;
    }

    // Aggravated circumstances (fleeing/bluffing)
    if (isAggravated) {
        fine *= 2;
    }

    // Officer strictness affects fine (zealots charge max)
    const strictnessMultiplier = 0.8 + (officer.stats.strictness * 0.4);
    fine = Math.floor(fine * strictnessMultiplier);

    return fine;
}

// ============================================
// BRIBE CALCULATION
// ============================================

/**
 * Calculate the expected bribe amount
 */
export function calculateExpectedBribe(context) {
    const {
        fine,
        officer,
        heatLevel,
        previousBribesThisRun,
        contactsDiscount,
    } = context;

    // Base: 40-70% of fine depending on greed
    const greedMultiplier = 0.4 + (0.3 * officer.stats.greed);
    let expectedBribe = fine * greedMultiplier;

    // Heat increases expectations
    const heatMultiplier = 1 + (0.5 * heatLevel);
    expectedBribe *= heatMultiplier;

    // Each previous bribe this run increases expectation
    expectedBribe += previousBribesThisRun * 15;

    // Contacts discount
    if (contactsDiscount > 0) {
        expectedBribe *= (1 - contactsDiscount);
    }

    // Minimum bribe
    expectedBribe = Math.max(25, Math.floor(expectedBribe));

    return expectedBribe;
}

/**
 * Calculate suggested bribe for player UI
 */
export function calculateSuggestedBribe(context) {
    const expected = calculateExpectedBribe(context);
    // Suggest slightly above expected for better acceptance
    return Math.floor(expected * 1.1);
}

/**
 * Evaluate if a bribe offer is accepted
 */
export function evaluateBribeAcceptance(context) {
    const {
        officer,
        bribeOffered,
        bribeExpected,
        heatLevel,
        contactsBonus,
        isBlitz,
    } = context;

    // Base chance is officer corruptibility
    let acceptanceChance = officer.stats.corruptibility;

    // Offer ratio adjustment
    const offerRatio = bribeOffered / bribeExpected;
    if (offerRatio < 0.5) {
        // Way too low - insulting
        acceptanceChance *= 0.2;
    } else if (offerRatio < 0.8) {
        // Low offer
        acceptanceChance *= 0.5 + (offerRatio - 0.5) * 1.5;
    } else if (offerRatio >= 1.0) {
        // Generous offer
        acceptanceChance *= Math.min(1.3, 1 + (offerRatio - 1) * 0.3);
    }

    // Heat penalty - known bribers get less leeway
    acceptanceChance -= heatLevel * 0.3;

    // Contacts bonus
    acceptanceChance += contactsBonus;

    // By-the-book officers are extra resistant
    if (officer.personality === OfficerPersonality.BY_THE_BOOK) {
        acceptanceChance *= 0.3;
    }

    // Zealots never accept (but they have 0 corruptibility anyway)
    if (officer.personality === OfficerPersonality.ZEALOT) {
        acceptanceChance = 0;
    }

    // Blitz events reduce acceptance
    if (isBlitz) {
        acceptanceChance *= 0.5;
    }

    // Clamp and roll
    acceptanceChance = clamp(acceptanceChance, 0, 0.95);
    return Math.random() < acceptanceChance;
}

// ============================================
// FLEE EVALUATION
// ============================================

/**
 * Evaluate if a flee attempt succeeds
 */
export function evaluateFleeAttempt(context) {
    const {
        officer,
        playerSpeed,
        engineBonus,
        isBlitz,
    } = context;

    // Base success rate
    let successChance = 0.3;

    // Speed bonus
    if (playerSpeed > 60) {
        successChance += 0.15;
    }

    // Engine upgrade bonus
    successChance += engineBonus;

    // Lazy officers are easier to escape
    if (officer.personality === OfficerPersonality.LAZY) {
        successChance += 0.25;
    }

    // Zealots are hard to escape
    if (officer.personality === OfficerPersonality.ZEALOT) {
        successChance -= 0.15;
    }

    // Blitz events - more officers, harder to flee
    if (isBlitz) {
        successChance -= 0.2;
    }

    // Clamp to reasonable range
    successChance = clamp(successChance, 0.1, 0.75);
    return Math.random() < successChance;
}

// ============================================
// ARGUE/BLUFF EVALUATION
// ============================================

/**
 * Evaluate if an argument succeeds
 */
export function evaluateArgument(context) {
    const {
        officer,
        hasPermit,
        isSpeeding,
    } = context;

    // Base chance based on officer patience
    let successChance = officer.stats.patience * 0.4;

    // Having a permit helps your case
    if (hasPermit) {
        successChance += 0.2;
    }

    // Speeding makes arguing harder
    if (isSpeeding) {
        successChance -= 0.15;
    }

    // Lazy officers might just let you go
    if (officer.personality === OfficerPersonality.LAZY) {
        successChance += 0.3;
    }

    // Zealots don't care about your excuses
    if (officer.personality === OfficerPersonality.ZEALOT) {
        successChance *= 0.2;
    }

    successChance = clamp(successChance, 0.05, 0.6);
    return Math.random() < successChance;
}

/**
 * Evaluate if a bluff succeeds
 */
export function evaluateBluff(context) {
    const {
        officer,
        hasPermit, // If they actually have a permit, bluffing makes no sense but won't fail hard
    } = context;

    // Bluffing is risky - officer strictness is key
    let successChance = (1 - officer.stats.strictness) * 0.5;

    // If you actually have a permit, moderate success (you're just "emphasizing" it)
    if (hasPermit) {
        successChance += 0.3;
    }

    // Lazy officers don't check thoroughly
    if (officer.personality === OfficerPersonality.LAZY) {
        successChance += 0.35;
    }

    // By-the-book and zealots will verify everything
    if (officer.personality === OfficerPersonality.BY_THE_BOOK ||
        officer.personality === OfficerPersonality.ZEALOT) {
        successChance *= 0.3;
    }

    successChance = clamp(successChance, 0.05, 0.5);
    return Math.random() < successChance;
}

// ============================================
// IMPOUND EVALUATION
// ============================================

/**
 * Determine if truck gets impounded (after failed flee)
 */
export function evaluateImpound(context) {
    const {
        officer,
        hasContraband,
        isBlitz,
    } = context;

    let impoundChance = 0.2; // Base chance after failed flee

    // Contraband significantly increases impound risk
    if (hasContraband) {
        impoundChance += 0.25;
    }

    // Zealots love to impound
    if (officer.personality === OfficerPersonality.ZEALOT) {
        impoundChance += 0.15;
    }

    // Shakedowns prefer the fine money, less likely to impound
    if (officer.personality === OfficerPersonality.SHAKEDOWN) {
        impoundChance -= 0.1;
    }

    // Blitz events
    if (isBlitz) {
        impoundChance += 0.1;
    }

    impoundChance = clamp(impoundChance, 0.1, 0.5);
    return Math.random() < impoundChance;
}

// ============================================
// DIALOGUE GENERATION
// ============================================

const DIALOGUE = {
    initial: {
        [OfficerPersonality.BY_THE_BOOK]: [
            "License and permits, please.",
            "Routine checkpoint. Documentation required.",
            "Stop for inspection. Papers, now.",
        ],
        [OfficerPersonality.PRAGMATIC]: [
            "Hey there. Quick check - got your papers?",
            "Just need to see your permits. Shouldn't take long.",
            "Checkpoint. Let's make this quick.",
        ],
        [OfficerPersonality.CORRUPT]: [
            "Well, well... what do we have here?",
            "Nice truck. Would be a shame if there was a problem...",
            "Papers? Sure, let's talk about that...",
        ],
        [OfficerPersonality.LAZY]: [
            "*yawn* Papers... or whatever.",
            "Checkpoint. Show me something, I guess.",
            "Make this quick, I'm on break soon.",
        ],
        [OfficerPersonality.ZEALOT]: [
            "STOP! Full inspection required!",
            "This checkpoint is under enhanced enforcement. PAPERS!",
            "I will find any violation. Cooperate fully.",
        ],
        [OfficerPersonality.SHAKEDOWN]: [
            "Well, this is going to be interesting...",
            "Lot of violations happening today. Real shame.",
            "Let's discuss how we can... resolve this.",
        ],
    },

    permitValid: {
        [OfficerPersonality.BY_THE_BOOK]: "Documentation checks out. You may proceed.",
        [OfficerPersonality.PRAGMATIC]: "All good. Safe travels.",
        [OfficerPersonality.CORRUPT]: "Hmph. Fine. Go on, then.",
        [OfficerPersonality.LAZY]: "Yeah, yeah. Go ahead.",
        [OfficerPersonality.ZEALOT]: "Papers are in order... this time. Move along.",
        [OfficerPersonality.SHAKEDOWN]: "Lucky you actually have permits. Get going.",
    },

    bribeAccepted: {
        [OfficerPersonality.BY_THE_BOOK]: "*quietly pockets money* ...Don't make this a habit.",
        [OfficerPersonality.PRAGMATIC]: "Appreciated. Drive safe.",
        [OfficerPersonality.CORRUPT]: "Pleasure doing business. See you next time.",
        [OfficerPersonality.LAZY]: "Yeah, that works. Go.",
        [OfficerPersonality.ZEALOT]: "...", // Should never happen
        [OfficerPersonality.SHAKEDOWN]: "This will do... for today.",
    },

    bribeRejected: {
        [OfficerPersonality.BY_THE_BOOK]: "Are you trying to bribe an officer?! Fine DOUBLED!",
        [OfficerPersonality.PRAGMATIC]: "Not today. That's going to cost you extra.",
        [OfficerPersonality.CORRUPT]: "That's insulting. You'll pay more now.",
        [OfficerPersonality.LAZY]: "Too risky right now. Full fine.",
        [OfficerPersonality.ZEALOT]: "BRIBERY?! You'll regret this!",
        [OfficerPersonality.SHAKEDOWN]: "That's not nearly enough. Full fine, plus 'processing'.",
    },

    bribeInsulting: {
        generic: "That's insulting. You want to make this worse?",
    },

    fleeSuccess: {
        generic: "You floor it and disappear into traffic before they can react!",
    },

    fleeFailed: {
        generic: "They radio ahead - you're pulled over again with a bigger problem.",
    },

    impounded: {
        generic: "Your truck is being impounded. You'll need to complete deliveries on foot to get it back.",
    },

    argueSuccess: {
        [OfficerPersonality.BY_THE_BOOK]: "*sighs* Fine. Consider this a warning.",
        [OfficerPersonality.PRAGMATIC]: "Alright, fair enough. Just watch it.",
        [OfficerPersonality.CORRUPT]: "Ugh, whatever. Not worth my time.",
        [OfficerPersonality.LAZY]: "Yeah, okay. Just go.",
        [OfficerPersonality.ZEALOT]: "...I'll let it slide. THIS TIME.",
        [OfficerPersonality.SHAKEDOWN]: "You're lucky I have other stops.",
    },

    argueFailed: {
        [OfficerPersonality.BY_THE_BOOK]: "Your arguments don't change the facts. Full fine.",
        [OfficerPersonality.PRAGMATIC]: "Nice try. Pay up.",
        [OfficerPersonality.CORRUPT]: "Save your breath. Fine.",
        [OfficerPersonality.LAZY]: "*sigh* Just pay the fine already.",
        [OfficerPersonality.ZEALOT]: "The law is the law! No exceptions!",
        [OfficerPersonality.SHAKEDOWN]: "Cute. Now pay up.",
    },

    bluffSuccess: {
        [OfficerPersonality.BY_THE_BOOK]: "Hmm... I suppose that's in order. Go.",
        [OfficerPersonality.PRAGMATIC]: "Okay, looks legit. Move along.",
        [OfficerPersonality.CORRUPT]: "Whatever. Not my problem.",
        [OfficerPersonality.LAZY]: "Good enough for me.",
        [OfficerPersonality.ZEALOT]: "...Very well. But I'm noting this.",
        [OfficerPersonality.SHAKEDOWN]: "Fine, fine. Next time, have real papers.",
    },

    bluffFailed: {
        [OfficerPersonality.BY_THE_BOOK]: "These are FAKE! You just made this much worse!",
        [OfficerPersonality.PRAGMATIC]: "Nice try. That's going to cost you extra.",
        [OfficerPersonality.CORRUPT]: "Ha! Fake papers? That's a bigger fine.",
        [OfficerPersonality.LAZY]: "Come on, those are obviously fake. Ugh, fine time.",
        [OfficerPersonality.ZEALOT]: "FRAUD! Maximum penalties!",
        [OfficerPersonality.SHAKEDOWN]: "Fake papers? Oh, this is going to cost you.",
    },

    comply: {
        generic: "Fine processed. Don't let it happen again.",
    },

    report: {
        generic: "Your report has been noted. That's... all we can do for now.",
    },
};

/**
 * Get initial dialogue for an officer
 * Now includes dynamic elements based on player history
 */
export function getInitialDialogue(officer, playerContext = null) {
    // If we have player context, check for history-based dialogue
    if (playerContext) {
        const historyDialogue = getHistoryBasedDialogue(officer, playerContext);
        if (historyDialogue) {
            return historyDialogue;
        }
    }

    // Fall back to standard personality-based dialogue
    const options = DIALOGUE.initial[officer.personality] || DIALOGUE.initial[OfficerPersonality.PRAGMATIC];
    return randomChoice(options);
}

/**
 * Generate dynamic dialogue based on player history with this officer type
 */
function getHistoryBasedDialogue(officer, context) {
    const { heatLevel, totalBribes, totalFines, sessionBribes, frustrationIndex } = context;

    // High heat - officer recognizes player as a known briber
    if (heatLevel > 0.6) {
        const highHeatDialogue = {
            [OfficerPersonality.BY_THE_BOOK]: [
                "You again? I've heard about you. Full inspection.",
                "Word travels fast. You're on our watch list now.",
                "I know your type. Let's see those papers.",
            ],
            [OfficerPersonality.PRAGMATIC]: [
                "Hey, I've heard about you. Let's keep this clean today.",
                "You're getting a reputation. Might want to fix that.",
                "Someone mentioned your name. Don't make this complicated.",
            ],
            [OfficerPersonality.CORRUPT]: [
                "Ah, my favorite customer returns! What do you have for me today?",
                "I was hoping I'd see you again. We have unfinished business.",
                "Word is you're a... generous driver. Let's talk.",
            ],
            [OfficerPersonality.LAZY]: [
                "*yawn* Oh, you again. Whatever. Papers.",
                "Ugh, I was warned you'd show up. Make it quick.",
                "You again? Fine, let's get this over with.",
            ],
            [OfficerPersonality.ZEALOT]: [
                "YOU! I've been waiting for this! FULL INSPECTION!",
                "The notorious one appears! Today, justice is served!",
                "I KNOW what you've been doing! This ends NOW!",
            ],
            [OfficerPersonality.SHAKEDOWN]: [
                "Well, if it isn't my favorite repeat offender. Premium rates today.",
                "I heard you're generous with your money. Let's test that.",
                "They told me you pay well. Don't disappoint me.",
            ],
        };

        const options = highHeatDialogue[officer.personality];
        if (options && Math.random() < 0.7) { // 70% chance to use history dialogue
            return randomChoice(options);
        }
    }

    // Moderate heat - officer is somewhat wary
    if (heatLevel > 0.3) {
        const midHeatDialogue = {
            [OfficerPersonality.BY_THE_BOOK]: "You seem... familiar. Papers, please.",
            [OfficerPersonality.PRAGMATIC]: "Have we met before? Anyway, papers.",
            [OfficerPersonality.CORRUPT]: "Didn't I see you earlier? Interesting...",
            [OfficerPersonality.LAZY]: "Wait, weren't you... eh, whatever. Papers.",
            [OfficerPersonality.ZEALOT]: "Your face rings a bell. I'm watching you.",
            [OfficerPersonality.SHAKEDOWN]: "I feel like we've done business before...",
        };

        if (Math.random() < 0.5) {
            return midHeatDialogue[officer.personality];
        }
    }

    // Multiple bribes this session - officers are getting wise
    if (sessionBribes >= 2) {
        const bribeAwareDialogue = {
            [OfficerPersonality.BY_THE_BOOK]: "I've been radioed ahead. Don't try anything.",
            [OfficerPersonality.PRAGMATIC]: "I heard there's someone paying off officers today...",
            [OfficerPersonality.CORRUPT]: "Word is there's a big spender on the road today.",
            [OfficerPersonality.LAZY]: "Heard you've been busy. Let me guess...",
            [OfficerPersonality.ZEALOT]: "Reports of bribery on this route! You're SUSPECT!",
            [OfficerPersonality.SHAKEDOWN]: "I heard you're making friends on the road...",
        };

        if (Math.random() < 0.6) {
            return bribeAwareDialogue[officer.personality];
        }
    }

    // High frustration with permits - officer notices player seems worn down
    if (frustrationIndex && frustrationIndex > 0.5) {
        const frustratedPlayerDialogue = {
            [OfficerPersonality.BY_THE_BOOK]: "You look stressed. Permit troubles? Let's verify.",
            [OfficerPersonality.PRAGMATIC]: "Tough day? Permit office giving you grief?",
            [OfficerPersonality.CORRUPT]: "You look like someone who's had a bad day at the permit office...",
            [OfficerPersonality.LAZY]: "You look tired. Bureaucracy wearing you down? Papers.",
            [OfficerPersonality.ZEALOT]: "You look like someone who's been avoiding paperwork!",
            [OfficerPersonality.SHAKEDOWN]: "Permit problems, huh? I might be able to help... for a price.",
        };

        if (Math.random() < 0.4) {
            return frustratedPlayerDialogue[officer.personality];
        }
    }

    // New player with no history - welcome dialogue occasionally
    if (totalBribes === 0 && totalFines === 0 && Math.random() < 0.2) {
        const newPlayerDialogue = {
            [OfficerPersonality.BY_THE_BOOK]: "First time through here? The rules are simple. Papers.",
            [OfficerPersonality.PRAGMATIC]: "New to this route? Let's make this easy. Papers?",
            [OfficerPersonality.CORRUPT]: "Fresh face. Let me tell you how things work around here...",
            [OfficerPersonality.LAZY]: "New driver? Great. Less paperwork. Show me something.",
            [OfficerPersonality.ZEALOT]: "A newcomer! Let me show you proper procedure!",
            [OfficerPersonality.SHAKEDOWN]: "New driver, eh? Welcome to the checkpoint. Let's talk.",
        };

        return newPlayerDialogue[officer.personality];
    }

    return null; // No history-specific dialogue, use default
}

/**
 * Get dialogue for an outcome
 */
export function getOutcomeDialogue(officer, outcomeType) {
    const category = DIALOGUE[outcomeType];
    if (!category) return "...";

    if (typeof category === 'string') {
        return category;
    }

    if (category.generic) {
        return category.generic;
    }

    return category[officer.personality] || category[OfficerPersonality.PRAGMATIC] || "...";
}

// ============================================
// NEGOTIATION RESULT
// ============================================

export class NegotiationResult {
    constructor(data) {
        this.outcome = data.outcome;
        this.dialogue = data.dialogue;
        this.moneyChange = data.moneyChange || 0;
        this.fineAmount = data.fineAmount || 0;
        this.bribeAmount = data.bribeAmount || 0;
        this.passed = data.passed || false;
        this.impounded = data.impounded || false;
        this.heatChange = data.heatChange || 0;
    }
}

// ============================================
// MAIN NEGOTIATION PROCESSOR
// ============================================

/**
 * Process a negotiation action and return the result
 */
export function processNegotiation(action, context) {
    const {
        officer,
        player,
        hasPermit,
        hasContraband,
        playerSpeed,
        bribeAmount,
        previousBribesThisRun,
        isBlitz,
    } = context;

    const isSpeeding = playerSpeed > 50;
    const heatLevel = player.getHeat(officer.personality);
    const contactsDiscount = player.getUpgradeBonus('bribeDiscount');
    const contactsBonus = player.getUpgradeBonus('acceptanceBonus');
    const engineBonus = player.getUpgradeBonus('fleeBonus');

    // Calculate fine for reference
    const fineContext = { isSpeeding, hasPermit, hasContraband, isAggravated: false, officer };
    const baseFine = calculateFine(fineContext);

    // Calculate expected bribe
    const bribeContext = {
        fine: baseFine,
        officer,
        heatLevel,
        previousBribesThisRun,
        contactsDiscount,
    };
    const expectedBribe = calculateExpectedBribe(bribeContext);

    switch (action) {
        case NegotiationAction.SHOW_PERMIT:
            return processShowPermit(officer, hasPermit, baseFine);

        case NegotiationAction.BRIBE:
            return processBribe(officer, bribeAmount, expectedBribe, baseFine, {
                heatLevel,
                contactsBonus,
                isBlitz,
            });

        case NegotiationAction.ARGUE:
            return processArgue(officer, hasPermit, isSpeeding, baseFine);

        case NegotiationAction.BLUFF:
            return processBluff(officer, hasPermit, baseFine);

        case NegotiationAction.FLEE:
            return processFlee(officer, playerSpeed, engineBonus, isBlitz, hasContraband, baseFine);

        case NegotiationAction.COMPLY:
            return processComply(officer, baseFine);

        case NegotiationAction.REPORT:
            return processReport(officer);

        default:
            return new NegotiationResult({
                outcome: NegotiationOutcome.FINED,
                dialogue: "Invalid action. Fine issued.",
                moneyChange: -baseFine,
                fineAmount: baseFine,
                passed: false,
            });
    }
}

function processShowPermit(officer, hasPermit, baseFine) {
    if (hasPermit) {
        return new NegotiationResult({
            outcome: NegotiationOutcome.PASSED,
            dialogue: getOutcomeDialogue(officer, 'permitValid'),
            passed: true,
        });
    } else {
        return new NegotiationResult({
            outcome: NegotiationOutcome.FINED,
            dialogue: "No valid permit? That's a fine.",
            moneyChange: -baseFine,
            fineAmount: baseFine,
            passed: false,
        });
    }
}

function processBribe(officer, bribeAmount, expectedBribe, baseFine, context) {
    const { heatLevel, contactsBonus, isBlitz } = context;

    const acceptanceContext = {
        officer,
        bribeOffered: bribeAmount,
        bribeExpected: expectedBribe,
        heatLevel,
        contactsBonus,
        isBlitz,
    };

    if (evaluateBribeAcceptance(acceptanceContext)) {
        return new NegotiationResult({
            outcome: NegotiationOutcome.BRIBE_ACCEPTED,
            dialogue: getOutcomeDialogue(officer, 'bribeAccepted'),
            moneyChange: -bribeAmount,
            bribeAmount: bribeAmount,
            passed: true,
            heatChange: 0.15, // Increase heat for this personality
        });
    } else {
        // Rejected - pay fine PLUS the attempted bribe is lost, plus surcharge
        const totalFine = Math.floor(baseFine * 1.5); // 50% surcharge for attempted bribery
        return new NegotiationResult({
            outcome: NegotiationOutcome.BRIBE_REJECTED,
            dialogue: getOutcomeDialogue(officer, 'bribeRejected'),
            moneyChange: -(bribeAmount + totalFine),
            fineAmount: totalFine,
            bribeAmount: bribeAmount,
            passed: false,
            heatChange: 0.2, // Even more heat for failed bribe
        });
    }
}

function processArgue(officer, hasPermit, isSpeeding, baseFine) {
    const argueContext = { officer, hasPermit, isSpeeding };

    if (evaluateArgument(argueContext)) {
        return new NegotiationResult({
            outcome: NegotiationOutcome.ARGUED_SUCCESS,
            dialogue: getOutcomeDialogue(officer, 'argueSuccess'),
            passed: true,
        });
    } else {
        return new NegotiationResult({
            outcome: NegotiationOutcome.ARGUED_FAILED,
            dialogue: getOutcomeDialogue(officer, 'argueFailed'),
            moneyChange: -baseFine,
            fineAmount: baseFine,
            passed: false,
        });
    }
}

function processBluff(officer, hasPermit, baseFine) {
    const bluffContext = { officer, hasPermit };

    if (evaluateBluff(bluffContext)) {
        return new NegotiationResult({
            outcome: NegotiationOutcome.BLUFF_SUCCESS,
            dialogue: getOutcomeDialogue(officer, 'bluffSuccess'),
            passed: true,
        });
    } else {
        // Failed bluff is aggravated
        const aggravatedFine = baseFine * 2;
        return new NegotiationResult({
            outcome: NegotiationOutcome.BLUFF_FAILED,
            dialogue: getOutcomeDialogue(officer, 'bluffFailed'),
            moneyChange: -aggravatedFine,
            fineAmount: aggravatedFine,
            passed: false,
        });
    }
}

function processFlee(officer, playerSpeed, engineBonus, isBlitz, hasContraband, baseFine) {
    const fleeContext = { officer, playerSpeed, engineBonus, isBlitz };

    if (evaluateFleeAttempt(fleeContext)) {
        return new NegotiationResult({
            outcome: NegotiationOutcome.FLED_SUCCESS,
            dialogue: getOutcomeDialogue(officer, 'fleeSuccess'),
            passed: true,
        });
    } else {
        // Failed flee - check for impound
        const impoundContext = { officer, hasContraband, isBlitz };
        const isImpounded = evaluateImpound(impoundContext);

        if (isImpounded) {
            const impoundFee = 500;
            return new NegotiationResult({
                outcome: NegotiationOutcome.IMPOUNDED,
                dialogue: getOutcomeDialogue(officer, 'impounded'),
                moneyChange: -(baseFine * 2 + impoundFee),
                fineAmount: baseFine * 2 + impoundFee,
                passed: false,
                impounded: true,
            });
        } else {
            // Just a bigger fine for fleeing
            const fleeFine = baseFine * 2;
            return new NegotiationResult({
                outcome: NegotiationOutcome.FLED_CAUGHT,
                dialogue: getOutcomeDialogue(officer, 'fleeFailed'),
                moneyChange: -fleeFine,
                fineAmount: fleeFine,
                passed: false,
            });
        }
    }
}

function processComply(officer, baseFine) {
    return new NegotiationResult({
        outcome: NegotiationOutcome.FINED,
        dialogue: getOutcomeDialogue(officer, 'comply'),
        moneyChange: -baseFine,
        fineAmount: baseFine,
        passed: false,
    });
}

function processReport(officer) {
    // Reporting doesn't help immediately but doesn't hurt either
    return new NegotiationResult({
        outcome: NegotiationOutcome.REPORTED,
        dialogue: getOutcomeDialogue(officer, 'report'),
        passed: true, // You get to pass after filing a report
    });
}
