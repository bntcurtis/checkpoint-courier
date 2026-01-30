/**
 * CHECKPOINT COURIER - Cloud Upload Service
 * Handles data upload to Cloudflare Workers endpoint
 */

import { gameState } from './state.js';

const UPLOAD_ENDPOINT = 'https://checkpoint-ingest.bntcurtis.workers.dev/';
const APP_SECRET = 'cc_v1_secure_8823x9'; // App attestation
const UPLOAD_TIMEOUT = 30000; // 30 seconds

// Store last upload result for diagnostics
let lastUploadResult = null;

/**
 * Upload session data to cloud
 */
export async function uploadSession(session) {
    // Check consent
    if (!gameState.player.consentGiven) {
        console.log('Data upload skipped: consent not given');
        return { success: false, reason: 'no_consent' };
    }

    const payload = {
        playerId: gameState.player.id,
        treatmentCode: gameState.player.treatment,
        session: session.toJSON ? session.toJSON() : session,
        timestamp: new Date().toISOString(),
        appVersion: '1.0.0',
        platform: 'web',
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

        const response = await fetch(UPLOAD_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-App-Attest': APP_SECRET,
                'X-Player-UUID': gameState.player.id,
                'X-Treatment-ID': gameState.player.treatment,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            console.log('Session uploaded successfully');
            return { success: true };
        } else {
            // Queue for retry on server errors
            if (response.status >= 500) {
                queueForRetry(payload);
            }
            console.error('Upload failed:', response.status);
            return { success: false, status: response.status };
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('Upload timed out');
            queueForRetry(payload);
            return { success: false, reason: 'timeout' };
        }

        console.error('Upload error:', error);
        queueForRetry(payload);
        return { success: false, reason: 'network_error' };
    }
}

/**
 * Queue failed upload for retry
 */
function queueForRetry(payload) {
    gameState.queueUpload(payload);
}

/**
 * Process pending uploads
 */
export async function processPendingUploads() {
    if (!gameState.player.consentGiven) return;

    const pending = [...gameState.pendingUploads];
    if (pending.length === 0) return;

    console.log(`Processing ${pending.length} pending uploads...`);

    for (let i = 0; i < pending.length; i++) {
        const payload = pending[i];

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

            const response = await fetch(UPLOAD_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-App-Attest': APP_SECRET,
                    'X-Player-UUID': payload.playerId,
                    'X-Treatment-ID': payload.treatmentCode,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                // Remove from queue
                gameState.clearUpload(i - (pending.length - gameState.pendingUploads.length));
                console.log('Pending upload successful');
            }
        } catch (error) {
            console.error('Pending upload failed:', error);
            // Keep in queue for next attempt
        }
    }
}

/**
 * Export player data as JSON for download
 */
export function exportPlayerData() {
    const data = {
        exportDate: new Date().toISOString(),
        player: gameState.player.toJSON(),
        note: 'This is your Checkpoint Courier game data. It contains only anonymous gameplay information.',
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `checkpoint-courier-data-${gameState.player.anonymousId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Process pending uploads on module load (with delay)
setTimeout(() => {
    processPendingUploads();
}, 5000);

/**
 * Test the upload endpoint and return diagnostic info
 */
export async function testUploadEndpoint() {
    const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        playerId: gameState.player?.id || 'test-player',
        treatmentCode: gameState.player?.treatment || 'TEST',
    };

    const results = {
        endpoint: UPLOAD_ENDPOINT,
        appSecret: APP_SECRET ? `${APP_SECRET.substring(0, 10)}...` : 'NOT SET',
        timestamp: new Date().toISOString(),
        steps: [],
    };

    try {
        // Step 1: Check if endpoint is reachable
        results.steps.push({ step: 'Starting test...', status: 'ok' });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(UPLOAD_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-App-Attest': APP_SECRET,
                'X-Player-UUID': testPayload.playerId,
                'X-Treatment-ID': testPayload.treatmentCode,
            },
            body: JSON.stringify(testPayload),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        results.httpStatus = response.status;
        results.httpStatusText = response.statusText;

        // Try to get response body
        try {
            const responseText = await response.text();
            results.responseBody = responseText.substring(0, 500);

            // Try to parse as JSON
            try {
                results.responseJson = JSON.parse(responseText);
            } catch (e) {
                // Not JSON, that's ok
            }
        } catch (e) {
            results.responseBody = 'Could not read response body';
        }

        // Interpret result
        if (response.status === 200) {
            results.steps.push({ step: 'Upload successful!', status: 'ok' });
            results.success = true;
            results.diagnosis = 'Worker is accepting uploads. If data is not appearing in OSF, check the scheduled cron job.';
        } else if (response.status === 401) {
            results.steps.push({ step: 'Authentication failed', status: 'error' });
            results.success = false;
            results.diagnosis = 'APP_SECRET mismatch. The web app secret does not match what the Cloudflare Worker expects.';
        } else if (response.status === 405) {
            results.steps.push({ step: 'Method not allowed', status: 'error' });
            results.success = false;
            results.diagnosis = 'Worker may not be configured for POST requests, or the route is wrong.';
        } else if (response.status === 404) {
            results.steps.push({ step: 'Endpoint not found', status: 'error' });
            results.success = false;
            results.diagnosis = 'The Cloudflare Worker may not be deployed, or the URL is incorrect.';
        } else if (response.status >= 500) {
            results.steps.push({ step: 'Server error', status: 'error' });
            results.success = false;
            results.diagnosis = 'The Cloudflare Worker encountered an error. Check the worker logs in Cloudflare dashboard.';
        } else {
            results.steps.push({ step: `Unexpected status: ${response.status}`, status: 'warning' });
            results.success = false;
            results.diagnosis = 'Unexpected response. Check Cloudflare Worker logs.';
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            results.steps.push({ step: 'Request timed out', status: 'error' });
            results.success = false;
            results.diagnosis = 'The endpoint did not respond within 10 seconds. Worker may be down or misconfigured.';
        } else if (error.message.includes('Failed to fetch')) {
            results.steps.push({ step: 'Network error', status: 'error' });
            results.success = false;
            results.diagnosis = 'Could not reach the endpoint. Possible causes: CORS issue, DNS error, or worker not deployed.';
            results.corsNote = 'If this is a CORS error, the Cloudflare Worker needs to return Access-Control-Allow-Origin headers.';
        } else {
            results.steps.push({ step: `Error: ${error.message}`, status: 'error' });
            results.success = false;
            results.diagnosis = `Unexpected error: ${error.message}`;
        }
        results.error = error.message;
    }

    lastUploadResult = results;
    return results;
}

/**
 * Get diagnostic info for display
 */
export function getUploadDiagnostics() {
    return {
        endpoint: UPLOAD_ENDPOINT,
        appSecretConfigured: !!APP_SECRET,
        lastResult: lastUploadResult,
        pendingUploads: gameState.pendingUploads?.length || 0,
        consentGiven: gameState.player?.consentGiven,
    };
}

// Make test function available globally for console debugging
if (typeof window !== 'undefined') {
    window.testCloudUpload = testUploadEndpoint;
    window.getUploadDiagnostics = getUploadDiagnostics;
}
