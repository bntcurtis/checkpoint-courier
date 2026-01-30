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

export class PermitService {
    constructor() {
        this.currentApplication = null;
        this.currentStep = 0;
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
     */
    advanceStep() {
        if (!this.currentApplication) {
            return { success: false, error: 'No active application' };
        }

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
        this.currentApplication = null;
        this.currentStep = 0;
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
