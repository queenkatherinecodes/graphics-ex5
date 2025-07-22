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
  minX: -14,
  maxX: 14,
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
  courtHeight: 0.1      // Height of court surface
};

// Basketball physics state
const ballPhysics = {
  isFlying: false,      // Is the ball currently in flight?
  velocity: { x: 0, y: 0, z: 0 },  // Current velocity vector
  position: { x: 0, y: 0, z: 0 },  // Current position
  restingPosition: { x: 0, y: 0, z: 0 }, // Position when ball is at rest
  timeInFlight: 0       // How long has ball been flying
};

// Hoop positions (matching basketballHoops.js)
const hoopPositions = [
  { x: -16, y: physicsConfig.rimHeight, z: 0, side: 'left' },
  { x: 16, y: physicsConfig.rimHeight, z: 0, side: 'right' }
];

// Create basketball court
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
  
  // Store resting position for potential reset
  ballPhysics.restingPosition = {
    x: basketball.position.x,
    y: movementConfig.courtSurfaceHeight + movementConfig.ballRadius,
    z: basketball.position.z
  };
  
  // Show shooting feedback (you can enhance this later)
  console.log(`Shot fired with ${shotPowerState.displayValue}% power toward ${targetHoop.side} hoop!`);
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
  
  // Check for ground collision
  const groundY = physicsConfig.courtHeight + movementConfig.ballRadius;
  if (ballPhysics.position.y <= groundY) {
    // Ball hit the ground
    ballPhysics.position.y = groundY;
    
    // Simple bounce with energy loss
    if (Math.abs(ballPhysics.velocity.y) > 0.5) {
      ballPhysics.velocity.y = -ballPhysics.velocity.y * 0.6; // 60% energy retained
      ballPhysics.velocity.x *= 0.8; // Friction
      ballPhysics.velocity.z *= 0.8; // Friction
    } else {
      // Ball comes to rest
      ballPhysics.isFlying = false;
      ballPhysics.velocity = { x: 0, y: 0, z: 0 };
      console.log("Ball came to rest");
    }
  }
  
  // Apply boundary constraints even during flight
  if (ballPhysics.position.x < courtBoundaries.minX || 
      ballPhysics.position.x > courtBoundaries.maxX ||
      ballPhysics.position.z < courtBoundaries.minZ || 
      ballPhysics.position.z > courtBoundaries.maxZ) {
    
    // Ball went out of bounds - stop flight
    ballPhysics.isFlying = false;
    ballPhysics.position = { ...ballPhysics.restingPosition };
    ballPhysics.velocity = { x: 0, y: 0, z: 0 };
    console.log("Ball went out of bounds - reset to starting position");
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
  
  // Update shot power system
  updateShotPower();
  
  // Update controls
  controls.enabled = isOrbitEnabled;
  controls.update();
  
  renderer.render(scene, camera);
}

animate();