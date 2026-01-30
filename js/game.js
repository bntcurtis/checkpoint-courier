/**
 * CHECKPOINT COURIER - 2D Driving Game
 * Canvas-based driving segment with checkpoints
 * Now with emoji-based graphics!
 */

import { gameState } from './state.js';
import { generateOfficer } from './officerAI.js';
import { getOfficerPresenceProbability, getBlitzProbability, randomFloat, randomChoice } from './models.js';

// ============================================
// GAME CONSTANTS
// ============================================

const ROAD_COLOR = '#555';
const LANE_MARKER_COLOR = '#fff';
const GRASS_COLOR = '#228B22';
const SHOULDER_COLOR = '#8B4513';

const TRUCK_WIDTH = 50;
const TRUCK_HEIGHT = 70;
const LANE_WIDTH = 80;
const ROAD_WIDTH = LANE_WIDTH * 3;
const SHOULDER_WIDTH = 30;

const MAX_SPEED = 100;
const ACCELERATION = 0.8;
const DECELERATION = 0.5;
const NATURAL_DECEL = 0.15;

// Emoji graphics
const EMOJI = {
    truck: '🚚',
    police: '👮',
    checkpoint: '🚧',
    guardhouse: '🏠',
    cone: '🔶',
    oil: '🛢️',
    rock: '🪨',
    pothole: '🕳️',
    debris: '📦',
    tree: '🌳',
    bush: '🌿',
    flag: '🚩',
    finish: '🏁',
    siren: '🚨',
    stop: '🛑',
    heart: '❤️',
    heartEmpty: '🖤',
};

// Obstacle types with their emoji and size
const OBSTACLE_TYPES = [
    { emoji: EMOJI.cone, width: 30, height: 30, name: 'cone' },
    { emoji: EMOJI.oil, width: 40, height: 40, name: 'oil' },
    { emoji: EMOJI.rock, width: 35, height: 35, name: 'rock' },
    { emoji: EMOJI.pothole, width: 45, height: 30, name: 'pothole' },
    { emoji: EMOJI.debris, width: 40, height: 40, name: 'debris' },
];

// ============================================
// GAME ENGINE
// ============================================

export class DrivingGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Game state
        this.running = false;
        this.paused = false;
        this.speed = 0;
        this.distance = 0;
        this.targetDistance = 1000;

        // Truck position (horizontal only, we scroll background)
        this.truckX = 0;
        this.truckLane = 1; // 0, 1, 2 (left, center, right)

        // Checkpoints
        this.checkpoints = [];
        this.currentCheckpointIndex = 0;

        // Obstacles
        this.obstacles = [];
        this.obstacleFrequency = 0.3;

        // Scenery (trees, bushes on sides)
        this.scenery = [];

        // Lives system (3 hearts)
        this.lives = 3;
        this.maxLives = 3;
        this.invincibleUntil = 0; // Brief invincibility after hit

        // Visual scroll offset
        this.scrollOffset = 0;

        // Input state
        this.accelerating = false;
        this.braking = false;

        // Callbacks
        this.onCheckpoint = null;
        this.onComplete = null;
        this.onSpeedChange = null;
        this.onLivesChange = null;
        this.onGameOver = null;

        // Animation frame ID
        this.animationId = null;

        // Animation time for effects
        this.animTime = 0;

        this.resize();
    }

    /**
     * Resize canvas to fit container
     */
    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth || 400;
        this.canvas.height = container.clientHeight || 600;

        // Center road
        this.roadX = (this.canvas.width - ROAD_WIDTH) / 2;

        // Position truck
        this.updateTruckPosition();
    }

    updateTruckPosition() {
        this.truckX = this.roadX + this.truckLane * LANE_WIDTH + (LANE_WIDTH - TRUCK_WIDTH) / 2;
    }

    /**
     * Initialize game for a delivery
     */
    initialize(delivery, treatment) {
        this.resize();

        this.running = false;
        this.paused = false;
        this.speed = 0;
        this.distance = 0;
        this.targetDistance = delivery.distance || 1000;
        this.truckLane = 1;
        this.scrollOffset = 0;
        this.currentCheckpointIndex = 0;
        this.animTime = 0;
        this.lives = 3;
        this.invincibleUntil = 0;

        // Calculate checkpoint positions - ensure good spacing
        this.checkpoints = [];
        const numCheckpoints = delivery.checkpointCount;
        // Minimum spacing of 150 units, spread evenly
        const minSpacing = 150;
        const availableDistance = this.targetDistance - 100; // Leave buffer at start/end
        const spacing = Math.max(minSpacing, availableDistance / (numCheckpoints + 1));

        for (let i = 0; i < numCheckpoints; i++) {
            const position = 50 + spacing * (i + 1);
            const hasOfficer = Math.random() < getOfficerPresenceProbability(treatment);
            const isBlitz = hasOfficer && Math.random() < getBlitzProbability(treatment);

            this.checkpoints.push({
                position,
                passed: false,
                hasOfficer,
                isBlitz,
                officer: hasOfficer ? generateOfficer(isBlitz) : null,
            });
        }

        // Generate obstacles (avoid checkpoint areas)
        this.obstacles = [];
        this.obstacleFrequency = delivery.route?.obstacleFrequency || 0.3;
        this.generateObstacles();

        // Generate scenery
        this.generateScenery();

        // Position truck in center lane
        this.updateTruckPosition();

        this.render();
    }

    /**
     * Generate obstacles along the route, avoiding checkpoints
     */
    generateObstacles() {
        this.obstacles = [];
        let position = 80;

        // Create checkpoint zones to avoid
        const checkpointZones = this.checkpoints.map(cp => ({
            start: cp.position - 40,
            end: cp.position + 40,
        }));

        while (position < this.targetDistance - 50) {
            // Check if we're in a checkpoint zone
            const inCheckpointZone = checkpointZones.some(
                zone => position >= zone.start && position <= zone.end
            );

            if (!inCheckpointZone && Math.random() < this.obstacleFrequency) {
                const lane = Math.floor(Math.random() * 3);
                const type = randomChoice(OBSTACLE_TYPES);

                this.obstacles.push({
                    position,
                    lane,
                    ...type,
                });
            }

            position += 60 + Math.random() * 80;
        }
    }

    /**
     * Generate roadside scenery
     */
    generateScenery() {
        this.scenery = [];
        let position = 0;

        while (position < this.targetDistance + 200) {
            // Left side scenery
            if (Math.random() < 0.4) {
                this.scenery.push({
                    position,
                    side: 'left',
                    emoji: Math.random() < 0.7 ? EMOJI.tree : EMOJI.bush,
                    offset: Math.random() * 30,
                });
            }

            // Right side scenery
            if (Math.random() < 0.4) {
                this.scenery.push({
                    position,
                    side: 'right',
                    emoji: Math.random() < 0.7 ? EMOJI.tree : EMOJI.bush,
                    offset: Math.random() * 30,
                });
            }

            position += 40 + Math.random() * 60;
        }
    }

    /**
     * Start the game loop
     */
    start() {
        this.running = true;
        this.paused = false;
        this.lastTime = performance.now();
        this.gameLoop();
    }

    /**
     * Pause the game
     */
    pause() {
        this.paused = true;
    }

    /**
     * Resume the game
     */
    resume() {
        if (this.running && this.paused) {
            this.paused = false;
            this.lastTime = performance.now();
            this.gameLoop();
        }
    }

    /**
     * Stop the game
     */
    stop() {
        this.running = false;
        this.paused = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Main game loop
     */
    gameLoop() {
        if (!this.running || this.paused) return;

        const now = performance.now();
        const dt = (now - this.lastTime) / 1000; // Delta time in seconds
        this.lastTime = now;

        this.update(dt);
        this.render();

        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }

    /**
     * Update game state
     */
    update(dt) {
        this.animTime += dt;

        // Update speed based on input
        if (this.accelerating) {
            this.speed = Math.min(MAX_SPEED, this.speed + ACCELERATION);
        } else if (this.braking) {
            this.speed = Math.max(0, this.speed - DECELERATION);
        } else {
            // Natural deceleration
            this.speed = Math.max(0, this.speed - NATURAL_DECEL);
        }

        // Update distance
        const distanceDelta = this.speed * dt * 2; // Scale for gameplay
        this.distance += distanceDelta;
        this.scrollOffset += distanceDelta;

        // Update speed display
        if (this.onSpeedChange) {
            this.onSpeedChange(Math.round(this.speed));
        }

        // Store speed in game state
        gameState.setGameSpeed(this.speed);

        // Check for obstacle collisions
        this.checkObstacleCollisions();

        // Check for checkpoint collision
        this.checkCheckpoints();

        // Check for completion
        if (this.distance >= this.targetDistance) {
            this.onDeliveryComplete();
        }
    }

    /**
     * Check for collisions with obstacles
     */
    checkObstacleCollisions() {
        const now = performance.now();

        // Skip if invincible (recently hit)
        if (now < this.invincibleUntil) return;

        for (const obstacle of this.obstacles) {
            // Skip already-hit obstacles
            if (obstacle.hit) continue;

            // Check if obstacle is near truck (within collision range)
            const relativePos = obstacle.position - this.distance;
            if (relativePos < -20 || relativePos > 30) continue;

            // Check if in same lane
            if (obstacle.lane === this.truckLane) {
                // Collision!
                obstacle.hit = true;
                this.lives--;

                // Brief invincibility (1 second)
                this.invincibleUntil = now + 1000;

                // Notify UI
                if (this.onLivesChange) {
                    this.onLivesChange(this.lives);
                }

                // Slow down on hit
                this.speed = Math.max(0, this.speed - 20);

                // Check for game over
                if (this.lives <= 0) {
                    this.stop();
                    if (this.onGameOver) {
                        this.onGameOver();
                    }
                    return;
                }
            }
        }
    }

    /**
     * Check if we've reached a checkpoint
     */
    checkCheckpoints() {
        if (this.currentCheckpointIndex >= this.checkpoints.length) return;

        const checkpoint = this.checkpoints[this.currentCheckpointIndex];
        if (this.distance >= checkpoint.position && !checkpoint.passed) {
            checkpoint.passed = true;

            if (checkpoint.hasOfficer && this.onCheckpoint) {
                // Pause game for negotiation
                this.pause();
                this.onCheckpoint(checkpoint, this.currentCheckpointIndex);
            }

            this.currentCheckpointIndex++;
        }
    }

    /**
     * Called when delivery is complete
     */
    onDeliveryComplete() {
        this.stop();
        if (this.onComplete) {
            this.onComplete();
        }
    }

    /**
     * Render the game
     */
    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas with grass
        ctx.fillStyle = GRASS_COLOR;
        ctx.fillRect(0, 0, width, height);

        // Draw shoulders
        ctx.fillStyle = SHOULDER_COLOR;
        ctx.fillRect(this.roadX - SHOULDER_WIDTH, 0, SHOULDER_WIDTH, height);
        ctx.fillRect(this.roadX + ROAD_WIDTH, 0, SHOULDER_WIDTH, height);

        // Draw road
        ctx.fillStyle = ROAD_COLOR;
        ctx.fillRect(this.roadX, 0, ROAD_WIDTH, height);

        // Draw lane markers (dashed lines)
        this.renderLaneMarkers(ctx, height);

        // Draw road edges (white lines)
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.roadX, 0);
        ctx.lineTo(this.roadX, height);
        ctx.moveTo(this.roadX + ROAD_WIDTH, 0);
        ctx.lineTo(this.roadX + ROAD_WIDTH, height);
        ctx.stroke();

        // Draw scenery (behind everything)
        this.renderScenery(ctx, height);

        // Draw obstacles
        this.renderObstacles(ctx, height);

        // Draw checkpoints
        this.renderCheckpoints(ctx, height);

        // Draw truck
        this.renderTruck(ctx, height);

        // Draw progress bar
        this.renderProgress(ctx, width);

        // Draw lives (hearts)
        this.renderLives(ctx, width);

        // Draw finish line if close
        this.renderFinishLine(ctx, height);
    }

    /**
     * Render animated lane markers
     */
    renderLaneMarkers(ctx, height) {
        ctx.strokeStyle = LANE_MARKER_COLOR;
        ctx.lineWidth = 3;
        ctx.setLineDash([40, 30]);

        const scrollMod = this.scrollOffset % 70;

        for (let i = 1; i < 3; i++) {
            const x = this.roadX + i * LANE_WIDTH;
            ctx.beginPath();
            ctx.moveTo(x, -scrollMod);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        ctx.setLineDash([]);
    }

    /**
     * Render roadside scenery
     */
    renderScenery(ctx, height) {
        const truckScreenY = height - 120;

        for (const item of this.scenery) {
            const relativePos = item.position - this.distance;
            if (relativePos < -50 || relativePos > height + 50) continue;

            const screenY = truckScreenY - relativePos;
            let screenX;

            if (item.side === 'left') {
                screenX = this.roadX - SHOULDER_WIDTH - 20 - item.offset;
            } else {
                screenX = this.roadX + ROAD_WIDTH + SHOULDER_WIDTH + 10 + item.offset;
            }

            ctx.font = '28px serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.emoji, screenX, screenY);
        }
    }

    /**
     * Render obstacles with emoji
     */
    renderObstacles(ctx, height) {
        const truckScreenY = height - 120;

        for (const obstacle of this.obstacles) {
            const relativePos = obstacle.position - this.distance;
            if (relativePos < -50 || relativePos > height + 100) continue;

            const screenY = truckScreenY - relativePos;
            const screenX = this.roadX + obstacle.lane * LANE_WIDTH + LANE_WIDTH / 2;

            // Draw emoji
            ctx.font = `${obstacle.width}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(obstacle.emoji, screenX, screenY);
        }
    }

    /**
     * Render checkpoints with guardhouse and officer
     */
    renderCheckpoints(ctx, height) {
        const truckScreenY = height - 120;

        for (let i = 0; i < this.checkpoints.length; i++) {
            const checkpoint = this.checkpoints[i];
            const relativePos = checkpoint.position - this.distance;

            if (relativePos < -80 || relativePos > height + 100) continue;

            const screenY = truckScreenY - relativePos;

            // Draw checkpoint barrier across road
            if (!checkpoint.passed) {
                // Striped barrier
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(this.roadX, screenY - 4, ROAD_WIDTH, 8);
                ctx.fillStyle = '#ffffff';
                for (let x = 0; x < ROAD_WIDTH; x += 20) {
                    ctx.fillRect(this.roadX + x, screenY - 4, 10, 8);
                }
            } else {
                // Passed checkpoint - green
                ctx.fillStyle = 'rgba(74, 222, 128, 0.5)';
                ctx.fillRect(this.roadX, screenY - 3, ROAD_WIDTH, 6);
            }

            // Draw guardhouse on left side
            ctx.font = '40px serif';
            ctx.textAlign = 'center';
            ctx.fillText(EMOJI.guardhouse, this.roadX - 35, screenY + 10);

            // Draw stop sign
            ctx.font = '30px serif';
            ctx.fillText(EMOJI.stop, this.roadX - 35, screenY - 25);

            // Draw officer if present
            if (checkpoint.hasOfficer && !checkpoint.passed) {
                // Officer standing by checkpoint
                ctx.font = '35px serif';
                ctx.fillText(EMOJI.police, this.roadX + 40, screenY + 5);

                // Blitz event - add siren
                if (checkpoint.isBlitz) {
                    const sirenOffset = Math.sin(this.animTime * 10) * 5;
                    ctx.font = '25px serif';
                    ctx.fillText(EMOJI.siren, this.roadX + 70, screenY - 15 + sirenOffset);
                    ctx.fillText(EMOJI.siren, this.roadX + ROAD_WIDTH - 40, screenY - 15 - sirenOffset);
                }
            }

            // Checkpoint number label
            ctx.fillStyle = checkpoint.passed ? '#4ade80' : '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`CP ${i + 1}`, this.roadX + ROAD_WIDTH + 35, screenY + 5);
        }
    }

    /**
     * Render the truck with emoji
     */
    renderTruck(ctx, height) {
        const truckScreenY = height - 120;
        const isInvincible = performance.now() < this.invincibleUntil;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.truckX + TRUCK_WIDTH / 2, truckScreenY + 30, 30, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Damage flash effect (red glow when recently hit)
        if (isInvincible && Math.floor(performance.now() / 100) % 2 === 0) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.arc(this.truckX + TRUCK_WIDTH / 2, truckScreenY, 40, 0, Math.PI * 2);
            ctx.fill();
        }

        // Truck emoji
        ctx.font = '60px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = isInvincible ? 0.7 : 1;
        ctx.fillText(EMOJI.truck, this.truckX + TRUCK_WIDTH / 2, truckScreenY);
        ctx.globalAlpha = 1;

        // Speed lines when moving fast
        if (this.speed > 50) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            const numLines = Math.floor(this.speed / 20);
            for (let i = 0; i < numLines; i++) {
                const lineY = truckScreenY + 20 + i * 8;
                const lineLength = 10 + this.speed / 5;
                ctx.beginPath();
                ctx.moveTo(this.truckX - 10, lineY);
                ctx.lineTo(this.truckX - 10 - lineLength, lineY);
                ctx.moveTo(this.truckX + TRUCK_WIDTH + 10, lineY);
                ctx.lineTo(this.truckX + TRUCK_WIDTH + 10 + lineLength, lineY);
                ctx.stroke();
            }
        }
    }

    /**
     * Render finish line when close
     */
    renderFinishLine(ctx, height) {
        const truckScreenY = height - 120;
        const distanceToFinish = this.targetDistance - this.distance;

        if (distanceToFinish < height && distanceToFinish > -50) {
            const screenY = truckScreenY - distanceToFinish;

            // Checkered pattern
            const squareSize = 15;
            for (let x = 0; x < ROAD_WIDTH; x += squareSize) {
                for (let row = 0; row < 2; row++) {
                    const isWhite = ((x / squareSize) + row) % 2 === 0;
                    ctx.fillStyle = isWhite ? '#fff' : '#000';
                    ctx.fillRect(this.roadX + x, screenY + row * squareSize - squareSize, squareSize, squareSize);
                }
            }

            // Finish flag
            ctx.font = '40px serif';
            ctx.textAlign = 'center';
            ctx.fillText(EMOJI.finish, this.roadX + ROAD_WIDTH / 2, screenY - 40);
        }
    }

    /**
     * Render progress bar
     */
    renderProgress(ctx, width) {
        const barWidth = width - 40;
        const barHeight = 12;
        const barX = 20;
        const barY = 25;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.roundRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4, 4);
        ctx.fill();

        // Progress fill
        const progress = Math.min(1, this.distance / this.targetDistance);
        const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
        gradient.addColorStop(0, '#4ade80');
        gradient.addColorStop(1, '#22c55e');
        ctx.fillStyle = gradient;
        ctx.roundRect(barX, barY, barWidth * progress, barHeight, 3);
        ctx.fill();

        // Checkpoint markers on progress bar
        for (let i = 0; i < this.checkpoints.length; i++) {
            const checkpoint = this.checkpoints[i];
            const markerX = barX + (checkpoint.position / this.targetDistance) * barWidth;

            ctx.fillStyle = checkpoint.passed ? '#4ade80' : '#e94560';
            ctx.beginPath();
            ctx.moveTo(markerX, barY - 4);
            ctx.lineTo(markerX + 6, barY + barHeight / 2);
            ctx.lineTo(markerX, barY + barHeight + 4);
            ctx.lineTo(markerX - 6, barY + barHeight / 2);
            ctx.closePath();
            ctx.fill();
        }

        // Truck position indicator
        const truckMarkerX = barX + progress * barWidth;
        ctx.font = '16px serif';
        ctx.textAlign = 'center';
        ctx.fillText('🚚', truckMarkerX, barY + barHeight + 18);

        // Distance text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.floor(this.distance)}m / ${this.targetDistance}m`, barX, barY - 8);
    }

    /**
     * Render lives (hearts) display
     */
    renderLives(ctx, width) {
        const heartSize = 24;
        const startX = width - 90;
        const startY = 25;

        // Background for hearts
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.roundRect(startX - 8, startY - 5, 85, 30, 5);
        ctx.fill();

        // Draw hearts
        ctx.font = `${heartSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < this.maxLives; i++) {
            const x = startX + i * 28;
            const y = startY + 10;

            // Flash effect when invincible
            const isFlashing = performance.now() < this.invincibleUntil &&
                               Math.floor(performance.now() / 100) % 2 === 0;

            if (i < this.lives) {
                // Full heart
                ctx.globalAlpha = isFlashing ? 0.5 : 1;
                ctx.fillText(EMOJI.heart, x, y);
                ctx.globalAlpha = 1;
            } else {
                // Empty heart
                ctx.fillText(EMOJI.heartEmpty, x, y);
            }
        }
    }

    /**
     * Handle lane change
     */
    changeLane(direction) {
        const newLane = this.truckLane + direction;
        if (newLane >= 0 && newLane <= 2) {
            this.truckLane = newLane;
            this.updateTruckPosition();
        }
    }

    /**
     * Set acceleration state
     */
    setAccelerating(value) {
        this.accelerating = value;
    }

    /**
     * Set braking state
     */
    setBraking(value) {
        this.braking = value;
    }

    /**
     * Get current checkpoint info
     */
    getCurrentCheckpointInfo() {
        return {
            current: this.currentCheckpointIndex,
            total: this.checkpoints.length,
        };
    }

    /**
     * Get current lives
     */
    getLives() {
        return this.lives;
    }
}

// Polyfill for roundRect if not available
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}
