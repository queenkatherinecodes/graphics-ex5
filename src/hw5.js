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

// Physics configuration
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
  ballRadius: 0.18      // Basketball radius
};

// Basketball physics state
const ballPhysics = {
  isFlying: false,      // Is the ball currently in flight?
  velocity: { x: 0, y: 0, z: 0 },  // Current velocity vector
  position: { x: 0, y: 0, z: 0 },  // Current position
  restingPosition: { x: 0, y: 0, z: 0 }, // Position when ball is at rest
  timeInFlight: 0,      // How long has ball been flying
  lastCollision: null,  // Last collision type for debugging
  bounceCount: 0        // Number of bounces for this shot
};

// Basketball rotation state
const ballRotation = {
  rotation: { x: 0, y: 0, z: 0 },  // Current rotation angles (radians)
  angularVelocity: { x: 0, y: 0, z: 0 }, // Rotation speed per axis
  rotationScale: 2.5,   // Multiplier for rotation speed
  smoothing: 0.9,       // Rotation smoothing factor
  minRotationSpeed: 0.1 // Minimum speed to show rotation
};

// Hoop positions (matching your updated basketballHoops.js)
const hoopPositions = [
  { x: -14, y: physicsConfig.rimHeight, z: 0, side: 'left' },
  { x: 14, y: physicsConfig.rimHeight, z: 0, side: 'right' }
];

// Calculate ball rotation based on velocity
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

function checkRimCollisions() {
  hoopPositions.forEach(hoop => {
    // Calculate distance from ball to rim center
    const dx = ballPhysics.position.x - hoop.x;
    const dz = ballPhysics.position.z - hoop.z;
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    
    // Check if ball is near rim height and within rim radius
    const rimTop = hoop.y + 0.05; // Slightly above rim
    const rimBottom = hoop.y - 0.1; // Slightly below rim
    
    if (ballPhysics.position.y <= rimTop && 
        ballPhysics.position.y >= rimBottom &&
        horizontalDistance <= physicsConfig.rimRadius + physicsConfig.ballRadius) {
      
      // Check if this is a successful shot (ball going downward through rim)
      if (horizontalDistance <= physicsConfig.rimRadius * 0.8 && 
          ballPhysics.velocity.y < 0) {
        // SCORE! Ball went through the hoop
        ballPhysics.lastCollision = `score-${hoop.side}`;
        console.log(`🏀 SCORE! Shot made on ${hoop.side} hoop!`);
        
        // Let ball continue through (don't bounce off rim)
        return;
      }
      
      // Ball hit the rim - bounce off
      if (horizontalDistance > physicsConfig.rimRadius * 0.8) {
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
        console.log(`Rim collision on ${hoop.side} hoop, bounce #${ballPhysics.bounceCount}`);
      }
    }
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
      Math.pow(ballPos.x - hoop.x, 2) + 
      Math.pow(ballPos.z - hoop.z, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestHoop = hoop;
    }
  });
  
  return { hoop: nearestHoop, distance: minDistance };
}

// Calculate trajectory to reach target hoop
function calculateTrajectory(targetHoop, shotVelocity) {
  const ballPos = basketball.position;
  
  // Distance to target
  const dx = targetHoop.x - ballPos.x;
  const dz = targetHoop.z - ballPos.z;
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
  
  // Height difference
  const dy = targetHoop.y - ballPos.y;
  
  // Calculate optimal launch angle for given velocity
  const g = Math.abs(physicsConfig.gravity);
  const v = shotVelocity;
  
  // Use physics formula to find launch angle
  // For projectile motion: range = v²sin(2θ)/g
  // We'll use a fixed optimal angle and adjust velocity accordingly
  const optimalAngle = Math.PI / 4; // 45 degrees for maximum range
  const launchAngle = Math.atan2(dy + physicsConfig.minArcHeight, horizontalDistance);
  
  // Calculate velocity components
  const totalTime = horizontalDistance / (v * Math.cos(launchAngle));
  const vx = dx / totalTime;
  const vz = dz / totalTime;
  const vy = (dy - 0.5 * physicsConfig.gravity * totalTime * totalTime) / totalTime;
  
  return {
    velocity: { x: vx, y: vy, z: vz },
    angle: launchAngle,
    time: totalTime,
    distance: horizontalDistance
  };
}

// Get shot velocity based on current power
function getShotVelocity() {
  const powerRatio = shotPowerState.current / 100;
  const minVelocity = 8;  // Minimum shot velocity
  const maxVelocity = 25; // Maximum shot velocity
  
  return minVelocity + (maxVelocity - minVelocity) * powerRatio;
}

// Shoot the basketball
function shootBasketball() {
  if (ballPhysics.isFlying || !basketball) return;
  
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
  
  // Store resting position for potential reset
  ballPhysics.restingPosition = {
    x: basketball.position.x,
    y: movementConfig.courtSurfaceHeight + movementConfig.ballRadius,
    z: basketball.position.z
  };
  
  // Show shooting feedback
  console.log(`🏀 Shot fired with ${shotPowerState.displayValue}% power toward ${targetHoop.side} hoop!`);
  console.log(`Distance: ${distance.toFixed(2)} units, Velocity: ${shotVelocity.toFixed(2)}`);
}

// Update basketball physics when in flight
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
  
  // Check for rim collisions first (scoring takes priority)
  checkRimCollisions();
  
  // Check for wall collisions
  checkWallCollisions();
  
  // Check for ground collision (this might stop the ball)
  const ballStopped = checkGroundCollision();
  
  // Check if ball has very low energy and should stop
  const totalVelocity = Math.sqrt(
    ballPhysics.velocity.x * ballPhysics.velocity.x +
    ballPhysics.velocity.y * ballPhysics.velocity.y +
    ballPhysics.velocity.z * ballPhysics.velocity.z
  );
  
  if (totalVelocity < physicsConfig.minBounceVelocity && 
      ballPhysics.position.y <= physicsConfig.courtHeight + physicsConfig.ballRadius + 0.01) {
    // Ball has very low energy and is near the ground - stop it
    ballPhysics.isFlying = false;
    ballPhysics.velocity = { x: 0, y: 0, z: 0 };
    ballPhysics.position.y = physicsConfig.courtHeight + physicsConfig.ballRadius;
    ballPhysics.bounceCount = 0;
    console.log("Ball stopped due to low energy");
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
  
  // Update UI elements
  updatePowerIndicatorUI();
}

// Update power indicator UI elements
function updatePowerIndicatorUI() {
  const powerFill = document.getElementById('powerFill');
  const powerValue = document.getElementById('powerValue');
  
  if (powerFill) {
    powerFill.style.width = shotPowerState.displayValue + '%';
  }
  
  if (powerValue) {
    powerValue.textContent = shotPowerState.displayValue;
  }
  
  // Add visual feedback based on power level
  const powerIndicator = document.getElementById('powerIndicator');
  if (powerIndicator) {
    // Remove existing power-level classes
    powerIndicator.classList.remove('power-low', 'power-medium', 'power-high');
    
    // Add appropriate class based on power level
    if (shotPowerState.displayValue < 33) {
      powerIndicator.classList.add('power-low');
    } else if (shotPowerState.displayValue < 67) {
      powerIndicator.classList.add('power-medium');
    } else {
      powerIndicator.classList.add('power-high');
    }
  }
}

// Input handling for movement controls
function handleKeyDown(e) {
  // Existing orbit camera toggle
  if (e.key === "o" || e.key === "O") {
    isOrbitEnabled = !isOrbitEnabled;
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
        break;
      case 'ArrowRight':
        e.preventDefault();
        movementState.keys.right = true;
        break;
      case 'ArrowUp':
        e.preventDefault();
        movementState.keys.up = true;
        break;
      case 'ArrowDown':
        e.preventDefault();
        movementState.keys.down = true;
        break;
    }
  }
  
  // Shot power controls (always available)
  switch(e.code) {
    case 'KeyW':
      e.preventDefault();
      movementState.keys.powerUp = true;
      break;
    case 'KeyS':
      e.preventDefault();
      movementState.keys.powerDown = true;
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