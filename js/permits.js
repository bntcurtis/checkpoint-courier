/**
 * CHECKPOINT COURIER - Permit System
 * Handles permit acquisition with bureaucracy simulation
 */

import {
    PermitType,
    PermitDefinitions,
    isHighBureaucracy,
    getPermitCost,
    getPermitSteps,
    getPermitDeliveries,
} from './models.js';
import { gameState } from './state.js';

// ============================================
// BUREAUCRACY STEPS
// ============================================

const PERMIT_STEPS_LOW = {
    [PermitType.TEMP_COURIER_PASS]: [
        { name: 'Fill Application', description: 'Complete Form A-1' },
        { name: 'Pay Fee', description: 'Processing fee required' },
    ],
    [PermitType.STANDARD_LICENSE]: [
        { name: 'Submit Documents', description: 'Proof of prior authorization' },
        { name: 'Pay Fee', description: 'License fee required' },
    ],
    [PermitType.PREMIUM_LICENSE]: [
        { name: 'Review Application', description: 'Verify credentials' },
        { name: 'Background Check', description: 'Standard verification' },
        { name: 'Pay Fee', description: 'Premium license fee' },
    ],
    [PermitType.HAZMAT_CERT]: [
        { name: 'Safety Training', description: 'Complete hazmat course' },
        { name: 'Certification Exam', description: 'Pass written test' },
        { name: 'Pay Fee', description: 'Certification fee' },
    ],
    [PermitType.EXPRESS_PASS]: [
        { name: 'Priority Application', description: 'Express processing' },
        { name: 'Pay Fee', description: 'Express pass fee' },
    ],
};

const PERMIT_STEPS_HIGH = {
    [PermitType.TEMP_COURIER_PASS]: [
        { name: 'Initial Inquiry', description: 'Submit Form A-1 (Section A)' },
        { name: 'Document Verification', description: 'Submit supporting documents' },
        { name: 'Interview Scheduling', description: 'Book appointment slot' },
        { name: 'In-Person Interview', description: 'Attend verification meeting' },
        { name: 'Pay Fee', description: 'Processing fee required' },
    ],
    [PermitType.STANDARD_LICENSE]: [
        { name: 'Application Form', description: 'Complete Form B-7 in triplicate' },
        { name: 'Document Collection', description: 'Gather all supporting materials' },
        { name: 'Notarization', description: 'Get documents notarized' },
        { name: 'Queue for Review', description: 'Submit to processing queue' },
        { name: 'Compliance Check', description: 'Regulatory verification' },
        { name: 'Pay Fee', description: 'License fee + admin surcharge' },
    ],
    [PermitType.PREMIUM_LICENSE]: [
        { name: 'Preliminary Application', description: 'Form C-12 (Parts A-D)' },
        { name: 'Character References', description: 'Submit 3 references' },
        { name: 'Financial Verification', description: 'Bank statements required' },
        { name: 'Background Investigation', description: 'Extended check (3 years)' },
        { name: 'Board Review', description: 'Committee evaluation' },
        { name: 'Appeals Window', description: 'Mandatory waiting period' },
        { name: 'Final Approval', description: 'Sign acceptance forms' },
        { name: 'Pay Fee', description: 'Premium fee + processing' },
    ],
    [PermitType.HAZMAT_CERT]: [
        { name: 'Prerequisite Check', description: 'Verify prior certifications' },
        { name: 'Safety Course', description: 'Complete 8-hour training' },
        { name: 'Written Exam', description: 'Pass theory test' },
        { name: 'Practical Assessment', description: 'Handling demonstration' },
        { name: 'Medical Clearance', description: 'Health check required' },
        { name: 'Insurance Verification', description: 'Proof of coverage' },
        { name: 'Pay Fee', description: 'Certification + insurance fee' },
    ],
    [PermitType.EXPRESS_PASS]: [
        { name: 'Express Application', description: 'Submit priority form' },
        { name: 'Expedited Review', description: 'Fast-track processing' },
        { name: 'Verification Call', description: 'Confirm details by phone' },
        { name: 'System Registration', description: 'Add to express database' },
        { name: 'Pay Fee', description: 'Express pass fee + rush fee' },
    ],
};

// ============================================
// PERMIT SERVICE
// ============================================

// ============================================
// FRUSTRATION MESSAGES
// ============================================

const DELAY_MESSAGES = [
    "Please wait while we process your request...",
    "Your application has been placed in the queue.",
    "System maintenance in progress. Please stand by.",
    "Verifying your information with central database...",
    "A supervisor review is required. Please wait.",
    "Processing... please do not close this window.",
    "Your file is being retrieved from archives...",
    "Network congestion detected. Processing slowly.",
    "Cross-referencing with compliance database...",
    "Performing mandatory security check...",
];

const REJECTION_MESSAGES = [
    { title: "Form Error", message: "A required field was filled incorrectly. Please try again." },
    { title: "System Error", message: "A technical issue occurred. Please restart the application." },
    { title: "Verification Failed", message: "Unable to verify your information. Please resubmit." },
    { title: "Processing Error", message: "Your request could not be processed at this time." },
    { title: "Queue Timeout", message: "Application timed out. Please try again." },
    { title: "Database Mismatch", message: "Records do not match. Please start over." },
    { title: "Session Expired", message: "Your session has expired. Please begin again." },
    { title: "Duplicate Entry", message: "A similar application is pending. Reset required." },
];

// ============================================
// PERMIT SERVICE
// ============================================

export class PermitService {
    constructor() {
        this.currentApplication = null;
        this.currentStep = 0;
        this.pendingDelay = null;
        this.delayMessage = null;
    }

    /**
     * Get all available permits for the player
     */
    getAvailablePermits() {
        const player = gameState.player;
        const permits = [];

        for (const [type, def] of Object.entries(PermitDefinitions)) {
            const status = this.getPermitStatus(type, player);
            permits.push({
                ...def,
                status,
                currentCost: getPermitCost(type, player.treatment),
                currentSteps: getPermitSteps(type, player.treatment),
                currentDeliveries: getPermitDeliveries(type, player.treatment),
            });
        }

        return permits;
    }

    /**
     * Get status of a specific permit for the player
     */
    getPermitStatus(permitType, player) {
        const def = PermitDefinitions[permitType];
        if (!def) return 'unknown';

        // Check if player already owns this permit
        if (player.permitInventory[permitType] > 0) {
            return 'owned';
        }

        // Check prerequisites
        if (def.prerequisite) {
            // Must have owned the prerequisite at some point (or currently own it)
            // For simplicity, we check if they have deliveries remaining OR have completed deliveries with it
            const hasPrereq = player.permitInventory[def.prerequisite] > 0 ||
                              player.totalDeliveries > 0; // Simplified check

            if (!hasPrereq) {
                return 'locked';
            }
        }

        // Check if player can afford it
        const cost = getPermitCost(permitType, player.treatment);
        if (player.money < cost) {
            return 'unaffordable';
        }

        return 'available';
    }

    /**
     * Start a permit application
     */
    startApplication(permitType) {
        const player = gameState.player;
        const status = this.getPermitStatus(permitType, player);

        if (status !== 'available') {
            return { success: false, error: `Cannot apply: ${status}` };
        }

        const steps = this.getSteps(permitType, player.treatment);

        this.currentApplication = {
            permitType,
            steps,
            totalSteps: steps.length,
        };
        this.currentStep = 0;
        this.pendingDelay = null;
        this.delayMessage = null;

        // Track application attempt
        gameState.recordPermitAttempt();

        return {
            success: true,
            application: this.currentApplication,
            currentStep: this.currentStep,
        };
    }

    /**
     * Get the steps for a permit type
     */
    getSteps(permitType, treatment) {
        const stepsMap = isHighBureaucracy(treatment) ? PERMIT_STEPS_HIGH : PERMIT_STEPS_LOW;
        return stepsMap[permitType] || [{ name: 'Apply', description: 'Submit application' }];
    }

    /**
     * Advance to the next step in the application
     * May include random delays or rejections based on treatment condition
     */
    advanceStep() {
        if (!this.currentApplication) {
            return { success: false, error: 'No active application' };
        }

        const player = gameState.player;
        const isHighBureaucracyTreatment = isHighBureaucracy(player.treatment);

        // Check for random rejection (high bureaucracy only)
        if (isHighBureaucracyTreatment && this.currentStep > 0) {
            const rejectionChance = this.calculateRejectionChance();
            if (Math.random() < rejectionChance) {
                // Application rejected - must restart
                const rejection = this.getRandomRejection();
                gameState.recordPermitFailure();

                // Reset application
                this.currentApplication = null;
                this.currentStep = 0;
                this.pendingDelay = null;
                this.delayMessage = null;

                return {
                    success: false,
                    isRejection: true,
                    rejectionTitle: rejection.title,
                    rejectionMessage: rejection.message,
                    isComplete: false,
                };
            }
        }

        // Check for random delay (high bureaucracy has higher chance)
        const delayChance = isHighBureaucracyTreatment ? 0.4 : 0.1;
        if (Math.random() < delayChance) {
            // Generate a random delay between 1-4 seconds
            const delayMs = 1000 + Math.random() * 3000;
            this.pendingDelay = delayMs;
            this.delayMessage = this.getRandomDelayMessage();

            return {
                success: true,
                isDelay: true,
                delayMs,
                delayMessage: this.delayMessage,
                currentStep: this.currentStep,
                isComplete: false,
            };
        }

        // Normal advancement
        this.currentStep++;

        if (this.currentStep >= this.currentApplication.totalSteps) {
            // Application complete - grant permit
            return this.completeApplication();
        }

        return {
            success: true,
            currentStep: this.currentStep,
            isComplete: false,
        };
    }

    /**
     * Calculate rejection chance based on current state
     */
    calculateRejectionChance() {
        // Base 15% rejection chance for high bureaucracy
        let chance = 0.15;

        // Higher steps = slightly lower rejection (you're almost there!)
        const progress = this.currentStep / this.currentApplication.totalSteps;
        chance *= (1 - progress * 0.3);

        // More attempts = slightly higher rejection (the system remembers)
        const attempts = gameState.player.permitApplicationAttempts;
        if (attempts > 5) {
            chance *= 1.1;
        }

        return Math.min(0.25, chance); // Cap at 25%
    }

    /**
     * Get a random delay message
     */
    getRandomDelayMessage() {
        return DELAY_MESSAGES[Math.floor(Math.random() * DELAY_MESSAGES.length)];
    }

    /**
     * Get a random rejection
     */
    getRandomRejection() {
        return REJECTION_MESSAGES[Math.floor(Math.random() * REJECTION_MESSAGES.length)];
    }

    /**
     * Complete the permit application
     */
    completeApplication() {
        if (!this.currentApplication) {
            return { success: false, error: 'No active application' };
        }

        const { permitType } = this.currentApplication;
        const player = gameState.player;
        const cost = getPermitCost(permitType, player.treatment);
        const deliveries = getPermitDeliveries(permitType, player.treatment);

        // Deduct cost
        gameState.updateMoney(-cost);

        // Add permit
        gameState.addPermit(permitType, deliveries);

        const result = {
            success: true,
            isComplete: true,
            permitType,
            cost,
            deliveriesGranted: deliveries,
        };

        // Reset application state
        this.currentApplication = null;
        this.currentStep = 0;

        return result;
    }

    /**
     * Cancel the current application
     */
    cancelApplication() {
        // Track abandonment if they were mid-application
        if (this.currentApplication && this.currentStep > 0) {
            gameState.recordPermitAbandon();
        }

        this.currentApplication = null;
        this.currentStep = 0;
        this.pendingDelay = null;
        this.delayMessage = null;
        return { success: true };
    }

    /**
     * Get current application state
     */
    getApplicationState() {
        if (!this.currentApplication) {
            return null;
        }

        return {
            permitType: this.currentApplication.permitType,
            steps: this.currentApplication.steps,
            currentStep: this.currentStep,
            totalSteps: this.currentApplication.totalSteps,
            progress: (this.currentStep / this.currentApplication.totalSteps) * 100,
        };
    }
}

// Singleton instance
export const permitService = new PermitService();
