import {OrbitControls} from './OrbitControls.js'
import {createCourtLines} from './courtLines.js'
import {createBasketballHoops} from './basketballHoops.js'
import {createBasketball} from './basketball.js'

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
// Set background color
scene.background = new THREE.Color(0x000000);

// Add lights to the scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 15);
scene.add(directionalLight);

// Enable shadows
renderer.shadowMap.enabled = true;
directionalLight.castShadow = true;

function degrees_to_radians(degrees) {
  var pi = Math.PI;
  return degrees * (pi/180);
}

// UI Enhancement Variables
let gameStats = {
  score: 0,
  shotsMade: 0,
  shotAttempts: 0,
  shotPower: 50,
  gameStatus: "Ready to Shoot!",
  currentStreak: 0,
  bestStreak: 0
};

// Global variables for basketball movement
let basketball;
const courtBoundaries = {
  minX: -14.5,
  maxX: 14.5,
  minZ: -7,
  maxZ: 7
};

// Movement configuration
const movementConfig = {
  speed: 0.15,          // Units per frame
  smoothing: 0.85,      // Smoothing factor (0-1, higher = smoother)
  courtSurfaceHeight: 0.1,
  ballRadius: 0.18
};

// Shot power configuration
const shotPowerConfig = {
  min: 0,               // Minimum power (0%)
  max: 100,             // Maximum power (100%)
  default: 50,          // Default starting power (50%)
  step: 2,              // Power adjustment per key press
  smoothing: 0.9        // Power indicator smoothing
};

// Movement state
const movementState = {
  velocity: { x: 0, z: 0 },
  targetVelocity: { x: 0, z: 0 },
  keys: {
    left: false,
    right: false,
    up: false,
    down: false,
    powerUp: false,
    powerDown: false
  }
};

// Shot power state
const shotPowerState = {
  current: shotPowerConfig.default,
  target: shotPowerConfig.default,
  displayValue: shotPowerConfig.default
};

// UPDATED Physics configuration with backboard support
const physicsConfig = {
  gravity: -9.8,        // Gravity acceleration (m/s²)
  timeScale: 0.016,     // Time scale for physics (60 FPS)
  minArcHeight: 2.0,    // Minimum arc height for successful shots
  rimHeight: 3.15,      // Height of basketball rim
  courtHeight: 0.1,     // Height of court surface
  // Enhanced collision parameters
  groundBounce: 0.6,    // Ground bounce energy retention (60%)
  wallBounce: 0.4,      // Wall bounce energy retention (40%)
  rimBounce: 0.3,       // Rim bounce energy retention (30%)
  friction: 0.85,       // Friction coefficient (15% energy loss)
  minBounceVelocity: 0.5, // Minimum velocity to continue bouncing
  rimRadius: 0.225,     // Basketball rim radius (from basketballHoops.js)
  ballRadius: 0.18,     // Basketball radius
  // NEW: Backboard collision parameters
  backboardWidth: 1.8,
  backboardHeight: 1.05,
  backboardThickness: 0.05,
  backboardBounce: 0.4
};

// Basketball physics state
const ballPhysics = {
  isFlying: false,      // Is the ball currently in flight?
  velocity: { x: 0, y: 0, z: 0 },  // Current velocity vector
  position: { x: 0, y: 0, z: 0 },  // Current position
  restingPosition: { x: 0, y: 0, z: 0 }, // Position when ball is at rest
  timeInFlight: 0,      // How long has ball been flying
  lastCollision: null,  // Last collision type for debugging
  bounceCount: 0,       // Number of bounces for this shot
  scoreRecorded: false, // Has scoring been recorded for this shot?
  missRecorded: false,  // Has miss been recorded for this shot?
  rimHit: false         // Did ball hit the rim this shot?
};

// Basketball rotation state
const ballRotation = {
  rotation: { x: 0, y: 0, z: 0 },  // Current rotation angles (radians)
  angularVelocity: { x: 0, y: 0, z: 0 }, // Rotation speed per axis
  rotationScale: 2.5,   // Multiplier for rotation speed
  smoothing: 0.9,       // Rotation smoothing factor
  minRotationSpeed: 0.1 // Minimum speed to show rotation
};

// Scoring system state
const scoringSystem = {
  score: 0,             // Total points scored
  shotAttempts: 0,      // Number of shots taken
  shotsMade: 0,         // Number of successful shots
  accuracy: 0,          // Shooting percentage
  lastShotResult: null  // 'made' or 'missed'
};

// UPDATED hoop positions with backboard and rim data
const hoopPositions = [
  { 
    x: -14, 
    y: physicsConfig.rimHeight, 
    z: 0, 
    side: 'left',
    backboard: {
      x: -14 + 0.4, // backboard is 0.4 units toward center from hoop position
      y: physicsConfig.rimHeight,
      z: 0
    },
    rim: {
      x: -14 + 0.4 - 0.25, // rim is 0.25 units in front of backboard
      y: physicsConfig.rimHeight,
      z: 0
    }
  },
  { 
    x: 14, 
    y: physicsConfig.rimHeight, 
    z: 0, 
    side: 'right',
    backboard: {
      x: 14 - 0.4, // backboard is 0.4 units toward center from hoop position
      y: physicsConfig.rimHeight,
      z: 0
    },
    rim: {
      x: 14 - 0.4 + 0.25, // rim is 0.25 units in front of backboard
      y: physicsConfig.rimHeight,
      z: 0
    }
  }
];

// ===== UI ENHANCEMENT FUNCTIONS =====

function initializeUI() {
  updateScoreDisplay();
  updatePowerDisplay();
  updateGameStatus("Ready to Shoot!");
}

function updateScoreDisplay() {
  // Update basic score elements
  const currentScore = document.getElementById('currentScore');
  const shotsMade = document.getElementById('shotsMade');
  const shotAttempts = document.getElementById('shotAttempts');
  const accuracy = document.getElementById('accuracy');
  
  if (currentScore) currentScore.textContent = gameStats.score;
  if (shotsMade) shotsMade.textContent = gameStats.shotsMade;
  if (shotAttempts) shotAttempts.textContent = gameStats.shotAttempts;
  
  // Calculate and display accuracy
  const accuracyPercent = gameStats.shotAttempts > 0 
    ? Math.round((gameStats.shotsMade / gameStats.shotAttempts) * 100) 
    : 0;
  if (accuracy) accuracy.textContent = accuracyPercent + '%';
  
  // Add pulse animation to score when updated
  const scoreDisplay = document.getElementById('scoreDisplay');
  if (scoreDisplay) {
    scoreDisplay.classList.add('pulse');
    setTimeout(() => scoreDisplay.classList.remove('pulse'), 500);
  }
}

function updatePowerDisplay() {
  const powerBar = document.getElementById('powerBar');
  const powerValue = document.getElementById('powerValue');
  
  if (powerBar) {
    powerBar.style.width = gameStats.shotPower + '%';
  }
  
  if (powerValue) {
    powerValue.textContent = gameStats.shotPower + '%';
    
    // Color coding based on power level
    if (gameStats.shotPower < 30) {
      powerValue.style.color = '#00ff00'; // Green for low power
    } else if (gameStats.shotPower < 70) {
      powerValue.style.color = '#ffff00'; // Yellow for medium power
    } else {
      powerValue.style.color = '#ff0000'; // Red for high power
    }
  }
}

function updateGameStatus(status) {
  gameStats.gameStatus = status;
  const gameStatusElement = document.getElementById('gameStatus');
  if (gameStatusElement) {
    gameStatusElement.textContent = status;
  }
}

function showShotFeedback(isSuccess, message = null) {
  const feedbackMessage = document.getElementById('feedbackMessage');
  
  if (!feedbackMessage) return;
  
  // Clear previous classes
  feedbackMessage.classList.remove('show', 'success', 'miss');
  
  if (isSuccess) {
    feedbackMessage.textContent = message || 'SHOT MADE! 🏀';
    feedbackMessage.classList.add('success');
  } else {
    feedbackMessage.textContent = message || 'MISSED SHOT!';
    feedbackMessage.classList.add('miss');
  }
  
  // Show the message
  feedbackMessage.classList.add('show');
  
  // Hide after 2 seconds
  setTimeout(() => {
    feedbackMessage.classList.remove('show');
  }, 2000);
}

function onShotAttemptUI() {
  gameStats.shotAttempts++;
  updateScoreDisplay();
  updateGameStatus("Shot in progress...");
  showShotFeedback(false, "SHOOTING...");
  
  // Flash the power display to show shot taken
  const powerDisplay = document.getElementById('powerDisplay');
  if (powerDisplay) {
    powerDisplay.classList.add('flash');
    setTimeout(() => powerDisplay.classList.remove('flash'), 300);
  }
}

function onShotMadeUI() {
  gameStats.score += 2; // 2 points per basket
  gameStats.shotsMade++;
  gameStats.currentStreak++;
  gameStats.bestStreak = Math.max(gameStats.bestStreak, gameStats.currentStreak);
  
  updateScoreDisplay();
  
  // Show streak message for 3+ consecutive shots
  if (gameStats.currentStreak >= 3) {
    updateGameStatus(`🔥 ${gameStats.currentStreak} STREAK! 🔥`);
    showShotFeedback(true, `🔥 ${gameStats.currentStreak} STREAK! 🔥`);
  } else {
    updateGameStatus("Great shot! Ready for next...");
    showShotFeedback(true, 'SHOT MADE! +2 🏀');
  }
}

function onShotMissedUI() {
  gameStats.currentStreak = 0; // Reset streak on miss
  updateGameStatus("Missed! Try again...");
  showShotFeedback(false, 'MISSED SHOT!');
  updateScoreDisplay(); // Update accuracy
}

function adjustShotPower(increase) {
  const oldPower = gameStats.shotPower;
  
  if (increase) {
    gameStats.shotPower = Math.min(100, gameStats.shotPower + shotPowerConfig.step);
    updateGameStatus("Power increased!");
  } else {
    gameStats.shotPower = Math.max(0, gameStats.shotPower - shotPowerConfig.step);
    updateGameStatus("Power decreased!");
  }
  
  // Sync with existing power state
  shotPowerState.target = gameStats.shotPower;
  shotPowerState.current = gameStats.shotPower;
  shotPowerState.displayValue = gameStats.shotPower;
  
  updatePowerDisplay();
  
  // Show power change feedback
  if (gameStats.shotPower !== oldPower) {
    const powerDisplay = document.getElementById('powerDisplay');
    if (powerDisplay) {
      powerDisplay.classList.add('pulse');
      setTimeout(() => powerDisplay.classList.remove('pulse'), 300);
    }
  }
}

function onBallResetUI() {
  updateGameStatus("Ball reset to center!");
  gameStats.shotPower = 50; // Reset power to default
  shotPowerState.target = 50;
  shotPowerState.current = 50;
  shotPowerState.displayValue = 50;
  updatePowerDisplay();
}

function onBallMoveUI(direction) {
  updateGameStatus(`Moving ${direction}...`);
}

// ===== END UI ENHANCEMENT FUNCTIONS =====

// Scoring system functions (enhanced with UI)
function recordShotAttempt() {
  scoringSystem.shotAttempts++;
  onShotAttemptUI(); // Add UI feedback
  console.log(`Shot attempt #${scoringSystem.shotAttempts}`);
}

function recordMadeShot(points = 2) {
  scoringSystem.score += points;
  scoringSystem.shotsMade++;
  scoringSystem.lastShotResult = 'made';
  
  // Sync with UI stats
  gameStats.score = scoringSystem.score;
  gameStats.shotsMade = scoringSystem.shotsMade;
  gameStats.shotAttempts = scoringSystem.shotAttempts;
  
  // Calculate accuracy percentage
  scoringSystem.accuracy = Math.round((scoringSystem.shotsMade / scoringSystem.shotAttempts) * 100);
  
  console.log(`🏀 SHOT MADE! +${points} points (${scoringSystem.score} total)`);
  console.log(`Made: ${scoringSystem.shotsMade}, Accuracy: ${scoringSystem.accuracy}%`);
  
  onShotMadeUI(); // Add UI feedback
}

function recordMissedShot() {
  scoringSystem.lastShotResult = 'missed';
  
  // Sync with UI stats
  gameStats.score = scoringSystem.score;
  gameStats.shotsMade = scoringSystem.shotsMade;
  gameStats.shotAttempts = scoringSystem.shotAttempts;
  
  // Calculate accuracy percentage
  scoringSystem.accuracy = scoringSystem.shotAttempts > 0 ? 
    Math.round((scoringSystem.shotsMade / scoringSystem.shotAttempts) * 100) : 0;
  
  console.log(`❌ Shot missed. Accuracy: ${scoringSystem.accuracy}%`);
  
  onShotMissedUI(); // Add UI feedback
}

function calculateBallRotation(velocity) {
  // Calculate rotation based on ball movement
  // For a rolling ball: angular velocity = linear velocity / radius
  const ballRadius = physicsConfig.ballRadius;
  
  // Calculate angular velocity for each axis
  const angularVelocityX = -velocity.z / ballRadius; // Rolling forward/backward
  const angularVelocityY = 0; // No spinning around Y-axis for now
  const angularVelocityZ = velocity.x / ballRadius;  // Rolling left/right
  
  return {
    x: angularVelocityX * ballRotation.rotationScale,
    y: angularVelocityY * ballRotation.rotationScale,
    z: angularVelocityZ * ballRotation.rotationScale
  };
}

// Update ball rotation based on current velocity
function updateBallRotation() {
  if (!basketball) return;
  
  // Get current velocity (either from physics or movement)
  let currentVelocity;
  if (ballPhysics.isFlying) {
    // Use physics velocity during flight
    currentVelocity = ballPhysics.velocity;
  } else {
    // Use movement velocity when on ground
    currentVelocity = {
      x: movementState.velocity.x / physicsConfig.timeScale,
      y: 0,
      z: movementState.velocity.z / physicsConfig.timeScale
    };
  }
  
  // Calculate target angular velocity
  const targetAngularVelocity = calculateBallRotation(currentVelocity);
  
  // Apply smoothing to angular velocity
  ballRotation.angularVelocity.x = 
    ballRotation.angularVelocity.x * ballRotation.smoothing + 
    targetAngularVelocity.x * (1 - ballRotation.smoothing);
  
  ballRotation.angularVelocity.y = 
    ballRotation.angularVelocity.y * ballRotation.smoothing + 
    targetAngularVelocity.y * (1 - ballRotation.smoothing);
  
  ballRotation.angularVelocity.z = 
    ballRotation.angularVelocity.z * ballRotation.smoothing + 
    targetAngularVelocity.z * (1 - ballRotation.smoothing);
  
  // Update rotation angles
  ballRotation.rotation.x += ballRotation.angularVelocity.x * physicsConfig.timeScale;
  ballRotation.rotation.y += ballRotation.angularVelocity.y * physicsConfig.timeScale;
  ballRotation.rotation.z += ballRotation.angularVelocity.z * physicsConfig.timeScale;
  
  // Apply rotation to basketball mesh
  const basketballMesh = basketball.children[0]; // Get the actual sphere mesh
  if (basketballMesh) {
    basketballMesh.rotation.x = ballRotation.rotation.x;
    basketballMesh.rotation.y = ballRotation.rotation.y;
    basketballMesh.rotation.z = ballRotation.rotation.z;
  }
  
  // Debug rotation (optional - can be removed)
  const rotationSpeed = Math.sqrt(
    ballRotation.angularVelocity.x * ballRotation.angularVelocity.x +
    ballRotation.angularVelocity.y * ballRotation.angularVelocity.y +
    ballRotation.angularVelocity.z * ballRotation.angularVelocity.z
  );
  
  // Only log significant rotations to avoid console spam
  if (rotationSpeed > ballRotation.minRotationSpeed && Math.random() < 0.01) {
    console.log(`Ball rotation speed: ${rotationSpeed.toFixed(2)} rad/s`);
  }
}

function checkGroundCollision() {
  const groundY = physicsConfig.courtHeight + physicsConfig.ballRadius;
  
  if (ballPhysics.position.y <= groundY && ballPhysics.velocity.y < 0) {
    // Ball hit the ground
    ballPhysics.position.y = groundY;
    ballPhysics.lastCollision = 'ground';
    ballPhysics.bounceCount++;
    
    // Apply bounce with energy loss
    if (Math.abs(ballPhysics.velocity.y) > physicsConfig.minBounceVelocity) {
      ballPhysics.velocity.y = -ballPhysics.velocity.y * physicsConfig.groundBounce;
      ballPhysics.velocity.x *= physicsConfig.friction;
      ballPhysics.velocity.z *= physicsConfig.friction;
      
      console.log(`Ground bounce #${ballPhysics.bounceCount}, velocity: ${Math.abs(ballPhysics.velocity.y).toFixed(2)}`);
      return false; // Continue bouncing
    } else {
      // Ball comes to rest
      ballPhysics.isFlying = false;
      ballPhysics.velocity = { x: 0, y: 0, z: 0 };
      ballPhysics.bounceCount = 0;
      console.log("Ball came to rest on ground");
      
      // Check if we need to record a miss (ball stopped without scoring)
      if (!ballPhysics.scoreRecorded && !ballPhysics.missRecorded) {
        ballPhysics.missRecorded = true;
        recordMissedShot();
      }
      
      return true; // Stop bouncing
    }
  }
  return false;
}

function checkWallCollisions() {
  let collided = false;
  
  // Check X boundaries (left/right walls)
  if (ballPhysics.position.x <= courtBoundaries.minX + physicsConfig.ballRadius) {
    ballPhysics.position.x = courtBoundaries.minX + physicsConfig.ballRadius;
    ballPhysics.velocity.x = -ballPhysics.velocity.x * physicsConfig.wallBounce;
    ballPhysics.velocity.y *= physicsConfig.friction;
    ballPhysics.velocity.z *= physicsConfig.friction;
    ballPhysics.lastCollision = 'wall-left';
    ballPhysics.bounceCount++;
    collided = true;
    console.log(`Left wall bounce #${ballPhysics.bounceCount}`);
  } else if (ballPhysics.position.x >= courtBoundaries.maxX - physicsConfig.ballRadius) {
    ballPhysics.position.x = courtBoundaries.maxX - physicsConfig.ballRadius;
    ballPhysics.velocity.x = -ballPhysics.velocity.x * physicsConfig.wallBounce;
    ballPhysics.velocity.y *= physicsConfig.friction;
    ballPhysics.velocity.z *= physicsConfig.friction;
    ballPhysics.lastCollision = 'wall-right';
    ballPhysics.bounceCount++;
    collided = true;
    console.log(`Right wall bounce #${ballPhysics.bounceCount}`);
  }
  
  // Check Z boundaries (front/back walls)
  if (ballPhysics.position.z <= courtBoundaries.minZ + physicsConfig.ballRadius) {
    ballPhysics.position.z = courtBoundaries.minZ + physicsConfig.ballRadius;
    ballPhysics.velocity.z = -ballPhysics.velocity.z * physicsConfig.wallBounce;
    ballPhysics.velocity.x *= physicsConfig.friction;
    ballPhysics.velocity.y *= physicsConfig.friction;
    ballPhysics.lastCollision = 'wall-front';
    ballPhysics.bounceCount++;
    collided = true;
    console.log(`Front wall bounce #${ballPhysics.bounceCount}`);
  } else if (ballPhysics.position.z >= courtBoundaries.maxZ - physicsConfig.ballRadius) {
    ballPhysics.position.z = courtBoundaries.maxZ - physicsConfig.ballRadius;
    ballPhysics.velocity.z = -ballPhysics.velocity.z * physicsConfig.wallBounce;
    ballPhysics.velocity.x *= physicsConfig.friction;
    ballPhysics.velocity.y *= physicsConfig.friction;
    ballPhysics.lastCollision = 'wall-back';
    ballPhysics.bounceCount++;
    collided = true;
    console.log(`Back wall bounce #${ballPhysics.bounceCount}`);
  }
  
  return collided;
}

// NEW: Backboard collision detection
function checkBackboardCollision(hoop) {
  const backboard = hoop.backboard;
  const ball = ballPhysics.position;
  const ballRadius = physicsConfig.ballRadius;
  
  // Check if ball is near backboard
  const distanceToBackboard = Math.abs(ball.x - backboard.x);
  
  // Check if ball is within backboard bounds
  const withinHeight = ball.y >= (backboard.y - physicsConfig.backboardHeight/2 - ballRadius) && 
                      ball.y <= (backboard.y + physicsConfig.backboardHeight/2 + ballRadius);
  const withinWidth = Math.abs(ball.z - backboard.z) <= (physicsConfig.backboardWidth/2 + ballRadius);
  
  // Check for collision
  if (distanceToBackboard <= (physicsConfig.backboardThickness/2 + ballRadius) && 
      withinHeight && withinWidth) {
    
    // Determine which side of backboard was hit
    const isMovingTowardBackboard = (hoop.side === 'left' && ballPhysics.velocity.x > 0) ||
                                   (hoop.side === 'right' && ballPhysics.velocity.x < 0);
    
    if (isMovingTowardBackboard) {
      // Bounce off backboard
      ballPhysics.velocity.x = -ballPhysics.velocity.x * physicsConfig.backboardBounce;
      ballPhysics.velocity.y *= physicsConfig.backboardBounce;
      ballPhysics.velocity.z *= physicsConfig.backboardBounce;
      
      // Push ball away from backboard
      if (hoop.side === 'left') {
        ballPhysics.position.x = backboard.x - (physicsConfig.backboardThickness/2 + ballRadius);
      } else {
        ballPhysics.position.x = backboard.x + (physicsConfig.backboardThickness/2 + ballRadius);
      }
      
      ballPhysics.lastCollision = `backboard-${hoop.side}`;
      ballPhysics.bounceCount++;
      console.log(`Backboard collision on ${hoop.side} side`);
      return true;
    }
  }
  
  return false;
}

// NEW: Improved rim scoring detection
function checkRimScoring(hoop) {
  const rim = hoop.rim;
  const ball = ballPhysics.position;
  
  // Calculate distance from ball to rim center
  const dx = ball.x - rim.x;
  const dz = ball.z - rim.z;
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
  
  // Check if ball is at rim height and moving downward
  const rimTop = rim.y + 0.1;
  const rimBottom = rim.y - 0.15;
  const isAtRimLevel = ball.y <= rimTop && ball.y >= rimBottom;
  const isMovingDown = ballPhysics.velocity.y < -1; // Must be moving down with some speed
  
  // Check for successful shot (ball goes through rim)
  if (isAtRimLevel && isMovingDown && 
      horizontalDistance <= physicsConfig.rimRadius * 0.85 && // Within rim interior
      !ballPhysics.scoreRecorded) {
    
    // SCORE!
    ballPhysics.lastCollision = `score-${hoop.side}`;
    ballPhysics.scoreRecorded = true;
    console.log(`🏀 SCORE! Shot made on ${hoop.side} hoop!`);
    recordMadeShot();
    return;
  }
  
  // Check for rim collision (ball hits rim edge)
  if (isAtRimLevel && 
      horizontalDistance > physicsConfig.rimRadius * 0.85 && 
      horizontalDistance <= physicsConfig.rimRadius + physicsConfig.ballRadius) {
    
    // Calculate rim collision normal
    const normalX = dx / horizontalDistance;
    const normalZ = dz / horizontalDistance;
    
    // Reflect velocity off rim
    const dotProduct = ballPhysics.velocity.x * normalX + ballPhysics.velocity.z * normalZ;
    ballPhysics.velocity.x -= 2 * dotProduct * normalX * physicsConfig.rimBounce;
    ballPhysics.velocity.z -= 2 * dotProduct * normalZ * physicsConfig.rimBounce;
    ballPhysics.velocity.y *= physicsConfig.rimBounce;
    
    // Push ball away from rim
    const pushDistance = (physicsConfig.rimRadius + physicsConfig.ballRadius) - horizontalDistance;
    ballPhysics.position.x += normalX * pushDistance;
    ballPhysics.position.z += normalZ * pushDistance;
    
    ballPhysics.lastCollision = `rim-${hoop.side}`;
    ballPhysics.bounceCount++;
    ballPhysics.rimHit = true;
    console.log(`Rim collision on ${hoop.side} hoop`);
  }
}

// UPDATED: Enhanced collision detection with backboard support
function checkRimCollisions() {
  hoopPositions.forEach(hoop => {
    // First check backboard collision
    if (checkBackboardCollision(hoop)) {
      return; // If hit backboard, don't check rim
    }
    
    // Then check rim/scoring
    checkRimScoring(hoop);
  });
}

function createBasketballCourt() {
  // Court floor - just a simple brown surface
  const courtGeometry = new THREE.BoxGeometry(30, 0.2, 15);
  const courtMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xc68642,  // Brown wood color
    shininess: 50
  });
  const court = new THREE.Mesh(courtGeometry, courtMaterial);
  court.receiveShadow = true;
  scene.add(court);
  
  createCourtLines(scene);
  createBasketballHoops(scene);
  
  // Create basketball and store reference
  basketball = createBasketball(scene);
}

// Find the nearest hoop to the basketball
function findNearestHoop() {
  const ballPos = basketball.position;
  let nearestHoop = hoopPositions[0];
  let minDistance = Infinity;
  
  hoopPositions.forEach(hoop => {
    const distance = Math.sqrt(
      Math.pow(ballPos.x - hoop.rim.x, 2) + 
      Math.pow(ballPos.z - hoop.rim.z, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestHoop = hoop;
    }
  });
  
  return { hoop: nearestHoop, distance: minDistance };
}

// UPDATED: Improved trajectory calculation targeting rim position
function calculateTrajectory(targetHoop, shotVelocity) {
  const ballPos = basketball.position;
  
  // Target the rim position, not the hoop position
  const dx = targetHoop.rim.x - ballPos.x;
  const dz = targetHoop.rim.z - ballPos.z;
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
  
  // Height difference to rim
  const dy = targetHoop.rim.y - ballPos.y;
  
  // Calculate optimal trajectory for basketball shot
  // Use a parabolic arc that peaks above the rim
  const g = Math.abs(physicsConfig.gravity);
  const arcHeight = Math.max(physicsConfig.minArcHeight, dy + 1.5); // Ensure good arc
  
  // Calculate time to reach target
  const discriminant = Math.sqrt(2 * arcHeight / g);
  const timeToTarget = Math.sqrt(2 * (arcHeight - dy) / g) + discriminant;
  
  // Calculate velocity components
  const vx = dx / timeToTarget;
  const vz = dz / timeToTarget;
  const vy = Math.sqrt(2 * g * arcHeight);
  
  // Scale velocity based on shot power
  const powerMultiplier = shotVelocity / 15; // Normalize to reasonable range
  
  return {
    velocity: { 
      x: vx * powerMultiplier, 
      y: vy * powerMultiplier, 
      z: vz * powerMultiplier 
    },
    angle: Math.atan2(vy, Math.sqrt(vx * vx + vz * vz)),
    time: timeToTarget,
    distance: horizontalDistance
  };
}

// UPDATED: Calibrated shot velocity for perfect shots from center court
function getShotVelocity() {
  const powerRatio = shotPowerState.current / 100;
  
  // Calibrated so that 50% power from center court makes a shot
  const ballPos = basketball.position;
  
  // If ball is near center court (within 2 units of center)
  const distanceFromCenter = Math.sqrt(ballPos.x * ballPos.x + ballPos.z * ballPos.z);
  
  if (distanceFromCenter <= 2 && Math.abs(shotPowerState.current - 50) <= 5) {
    // Special calibration for center court at ~50% power
    return 12; // Calibrated velocity for perfect shot from center
  }
  
  // Normal velocity calculation for other positions/powers
  const minVelocity = 6;   // Reduced minimum
  const maxVelocity = 20;  // Reduced maximum
  
  return minVelocity + (maxVelocity - minVelocity) * powerRatio;
}

// NEW: Detect when a shot attempt should end
function shouldEndShotAttempt() {
  // End shot attempt if:
  // 1. Ball has been flying for too long (missed)
  // 2. Ball is on ground and moving very slowly
  // 3. Ball went out of bounds
  
  const maxFlightTime = 8; // 8 seconds max flight time
  const isOnGround = ballPhysics.position.y <= physicsConfig.courtHeight + physicsConfig.ballRadius + 0.1;
  const isMovingSlowly = Math.sqrt(
    ballPhysics.velocity.x * ballPhysics.velocity.x +
    ballPhysics.velocity.y * ballPhysics.velocity.y +
    ballPhysics.velocity.z * ballPhysics.velocity.z
  ) < 1;
  
  return (ballPhysics.timeInFlight > maxFlightTime) ||
         (isOnGround && isMovingSlowly && ballPhysics.bounceCount > 0);
}

// Shoot the basketball
function shootBasketball() {
  if (ballPhysics.isFlying || !basketball) return;
  
  // Record shot attempt
  recordShotAttempt();
  
  // Get current shot velocity based on power
  const shotVelocity = getShotVelocity();
  
  // Find nearest hoop
  const { hoop: targetHoop, distance } = findNearestHoop();
  
  // Calculate trajectory
  const trajectory = calculateTrajectory(targetHoop, shotVelocity);
  
  // Set physics state
  ballPhysics.isFlying = true;
  ballPhysics.velocity = trajectory.velocity;
  ballPhysics.position = {
    x: basketball.position.x,
    y: basketball.position.y,
    z: basketball.position.z
  };
  ballPhysics.timeInFlight = 0;
  ballPhysics.bounceCount = 0;  // Reset bounce counter
  ballPhysics.lastCollision = null;  // Reset collision tracker
  
  // Reset scoring state for new shot
  ballPhysics.scoreRecorded = false;
  ballPhysics.missRecorded = false;
  ballPhysics.rimHit = false;
  
  // Store resting position for potential reset
  ballPhysics.restingPosition = {
    x: basketball.position.x,
    y: movementConfig.courtSurfaceHeight + movementConfig.ballRadius,
    z: basketball.position.z
  };
  
  // Show shooting feedback
  console.log(`🏀 Shot #${scoringSystem.shotAttempts} fired with ${shotPowerState.displayValue}% power toward ${targetHoop.side} hoop!`);
  console.log(`Distance: ${distance.toFixed(2)} units, Velocity: ${shotVelocity.toFixed(2)}`);
}

// UPDATED: Enhanced physics update with improved shot detection
function updateBasketballPhysics() {
  if (!ballPhysics.isFlying || !basketball) return;
  
  // Update time in flight
  ballPhysics.timeInFlight += physicsConfig.timeScale;
  
  // Apply gravity to vertical velocity
  ballPhysics.velocity.y += physicsConfig.gravity * physicsConfig.timeScale;
  
  // Update position based on velocity
  ballPhysics.position.x += ballPhysics.velocity.x * physicsConfig.timeScale;
  ballPhysics.position.y += ballPhysics.velocity.y * physicsConfig.timeScale;
  ballPhysics.position.z += ballPhysics.velocity.z * physicsConfig.timeScale;
  
  // Check for rim/backboard collisions first (scoring takes priority)
  checkRimCollisions();
  
  // Check for wall collisions
  checkWallCollisions();
  
  // Check for ground collision
  const ballStopped = checkGroundCollision();
  
  // Check if shot attempt should end
  if (shouldEndShotAttempt() && !ballPhysics.scoreRecorded && !ballPhysics.missRecorded) {
    ballPhysics.missRecorded = true;
    recordMissedShot();
    
    // Stop the ball
    ballPhysics.isFlying = false;
    ballPhysics.velocity = { x: 0, y: 0, z: 0 };
    ballPhysics.position.y = physicsConfig.courtHeight + physicsConfig.ballRadius;
    console.log("Shot attempt ended - recorded as miss");
  }
  
  // Emergency boundary check - reset if ball goes way out of bounds
  if (Math.abs(ballPhysics.position.x) > courtBoundaries.maxX + 5 ||
      Math.abs(ballPhysics.position.z) > courtBoundaries.maxZ + 5 ||
      ballPhysics.position.y < -2) {
    // Ball went way out of bounds - reset
    ballPhysics.isFlying = false;
    ballPhysics.position = { ...ballPhysics.restingPosition };
    ballPhysics.velocity = { x: 0, y: 0, z: 0 };
    ballPhysics.bounceCount = 0;
    console.log("Ball reset due to going out of bounds");
    
    // Record as miss if not already recorded
    if (!ballPhysics.scoreRecorded && !ballPhysics.missRecorded) {
      ballPhysics.missRecorded = true;
      recordMissedShot();
    }
  }
  
  // Update basketball visual position
  basketball.position.set(
    ballPhysics.position.x,
    ballPhysics.position.y,
    ballPhysics.position.z
  );
}

// Update basketball movement based on input (only when not flying)
function updateBasketballMovement() {
  if (!basketball || ballPhysics.isFlying) return;
  
  // Calculate target velocity based on pressed keys
  movementState.targetVelocity.x = 0;
  movementState.targetVelocity.z = 0;
  
  if (movementState.keys.left) {
    movementState.targetVelocity.x -= movementConfig.speed;
  }
  if (movementState.keys.right) {
    movementState.targetVelocity.x += movementConfig.speed;
  }
  if (movementState.keys.up) {
    movementState.targetVelocity.z -= movementConfig.speed;
  }
  if (movementState.keys.down) {
    movementState.targetVelocity.z += movementConfig.speed;
  }
  
  // Apply smoothing to current velocity
  movementState.velocity.x = 
    movementState.velocity.x * movementConfig.smoothing + 
    movementState.targetVelocity.x * (1 - movementConfig.smoothing);
  
  movementState.velocity.z = 
    movementState.velocity.z * movementConfig.smoothing + 
    movementState.targetVelocity.z * (1 - movementConfig.smoothing);
  
  // Get current position
  const currentPos = basketball.position;
  
  // Calculate new position
  let newX = currentPos.x + movementState.velocity.x;
  let newZ = currentPos.z + movementState.velocity.z;
  
  // Apply boundary constraints
  newX = Math.max(courtBoundaries.minX, Math.min(courtBoundaries.maxX, newX));
  newZ = Math.max(courtBoundaries.minZ, Math.min(courtBoundaries.maxZ, newZ));
  
  // Update basketball position
  basketball.position.set(
    newX,
    movementConfig.courtSurfaceHeight + movementConfig.ballRadius,
    newZ
  );
  
  // Update physics position to match (when at rest)
  ballPhysics.position = {
    x: newX,
    y: movementConfig.courtSurfaceHeight + movementConfig.ballRadius,
    z: newZ
  };
  
  // Stop velocity if we hit a boundary
  if (newX <= courtBoundaries.minX || newX >= courtBoundaries.maxX) {
    movementState.velocity.x = 0;
  }
  if (newZ <= courtBoundaries.minZ || newZ >= courtBoundaries.maxZ) {
    movementState.velocity.z = 0;
  }
}

// Update shot power based on input
function updateShotPower() {
  // Adjust target power based on key presses
  if (movementState.keys.powerUp) {
    shotPowerState.target = Math.min(
      shotPowerConfig.max, 
      shotPowerState.target + shotPowerConfig.step
    );
  }
  if (movementState.keys.powerDown) {
    shotPowerState.target = Math.max(
      shotPowerConfig.min, 
      shotPowerState.target - shotPowerConfig.step
    );
  }
  
  // Apply smoothing to current power
  shotPowerState.current = 
    shotPowerState.current * shotPowerConfig.smoothing + 
    shotPowerState.target * (1 - shotPowerConfig.smoothing);
  
  // Update display value (rounded for UI)
  shotPowerState.displayValue = Math.round(shotPowerState.current);
  
  // Sync with UI
  gameStats.shotPower = shotPowerState.displayValue;
  
  // Update UI elements
  updatePowerIndicatorUI();
}

// Update power indicator UI elements (legacy function for compatibility)
function updatePowerIndicatorUI() {
  // This function now delegates to the new UI system
  updatePowerDisplay();
}

// Reset basketball to center court
function resetBasketball() {
  if (!basketball) return;
  
  // Stop any physics
  ballPhysics.isFlying = false;
  ballPhysics.velocity = { x: 0, y: 0, z: 0 };
  ballPhysics.bounceCount = 0;
  ballPhysics.scoreRecorded = false;
  ballPhysics.missRecorded = false;
  ballPhysics.rimHit = false;
  
  // Reset position to center court
  const centerPos = {
    x: 0,
    y: movementConfig.courtSurfaceHeight + movementConfig.ballRadius,
    z: 0
  };
  
  basketball.position.set(centerPos.x, centerPos.y, centerPos.z);
  ballPhysics.position = { ...centerPos };
  
  // Reset movement velocity
  movementState.velocity = { x: 0, z: 0 };
  movementState.targetVelocity = { x: 0, z: 0 };
  
  // Reset rotation
  ballRotation.rotation = { x: 0, y: 0, z: 0 };
  ballRotation.angularVelocity = { x: 0, y: 0, z: 0 };
  
  // UI feedback
  onBallResetUI();
  
  console.log("Basketball reset to center court");
}

// Enhanced keyboard handling with UI feedback
function handleKeyDown(e) {
  // Existing orbit camera toggle
  if (e.key === "o" || e.key === "O") {
    isOrbitEnabled = !isOrbitEnabled;
    updateGameStatus("Camera toggled!");
    return;
  }
  
  // Reset ball
  if (e.key === "r" || e.key === "R") {
    e.preventDefault();
    resetBasketball();
    return;
  }
  
  // Shooting control
  if (e.code === 'Space') {
    e.preventDefault();
    shootBasketball();
    return;
  }
  
  // Movement controls (only when ball is not flying)
  if (!ballPhysics.isFlying) {
    switch(e.code) {
      case 'ArrowLeft':
        e.preventDefault();
        movementState.keys.left = true;
        onBallMoveUI('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        movementState.keys.right = true;
        onBallMoveUI('right');
        break;
      case 'ArrowUp':
        e.preventDefault();
        movementState.keys.up = true;
        onBallMoveUI('forward');
        break;
      case 'ArrowDown':
        e.preventDefault();
        movementState.keys.down = true;
        onBallMoveUI('backward');
        break;
    }
  }
  
  // Shot power controls (always available)
  switch(e.code) {
    case 'KeyW':
      e.preventDefault();
      movementState.keys.powerUp = true;
      adjustShotPower(true);
      break;
    case 'KeyS':
      e.preventDefault();
      movementState.keys.powerDown = true;
      adjustShotPower(false);
      break;
  }
}

function handleKeyUp(e) {
  switch(e.code) {
    case 'ArrowLeft':
      e.preventDefault();
      movementState.keys.left = false;
      break;
    case 'ArrowRight':
      e.preventDefault();
      movementState.keys.right = false;
      break;
    case 'ArrowUp':
      e.preventDefault();
      movementState.keys.up = false;
      break;
    case 'ArrowDown':
      e.preventDefault();
      movementState.keys.down = false;
      break;
    // Shot power controls
    case 'KeyW':
      e.preventDefault();
      movementState.keys.powerUp = false;
      break;
    case 'KeyS':
      e.preventDefault();
      movementState.keys.powerDown = false;
      break;
  }
}

// Create all elements
createBasketballCourt();

// Set camera position for better view
const cameraTranslate = new THREE.Matrix4();
cameraTranslate.makeTranslation(0, 15, 30);
camera.applyMatrix4(cameraTranslate);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
let isOrbitEnabled = true;

// Initialize UI after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initializeUI();
});

// Initialize UI immediately if DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUI);
} else {
  initializeUI();
}

// Event listeners
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

// Handle window resize
window.addEventListener('resize', function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation function
function animate() {
  requestAnimationFrame(animate);
  
  // Update basketball physics (flight simulation)
  updateBasketballPhysics();
  
  // Update basketball movement (ground movement)
  updateBasketballMovement();
  
  // Update basketball rotation (both flight and ground)
  updateBallRotation();
  
  // Update shot power system
  updateShotPower();
  
  // Update controls
  controls.enabled = isOrbitEnabled;
  controls.update();
  
  renderer.render(scene, camera);
}

animate();