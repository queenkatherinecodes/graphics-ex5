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

// Input handling for movement controls
function handleKeyDown(e) {
  // Existing orbit camera toggle
  if (e.key === "o" || e.key === "O") {
    isOrbitEnabled = !isOrbitEnabled;
    return;
  }
  
  // Movement controls
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
    // Shot power controls
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

// Get shot velocity based on current power (for future use)
function getShotVelocity() {
  const powerRatio = shotPowerState.current / 100;
  const minVelocity = 8;  // Minimum shot velocity
  const maxVelocity = 25; // Maximum shot velocity
  
  return minVelocity + (maxVelocity - minVelocity) * powerRatio;
}
function updateBasketballMovement() {
  if (!basketball) return;
  
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
  
  // Stop velocity if we hit a boundary
  if (newX <= courtBoundaries.minX || newX >= courtBoundaries.maxX) {
    movementState.velocity.x = 0;
  }
  if (newZ <= courtBoundaries.minZ || newZ >= courtBoundaries.maxZ) {
    movementState.velocity.z = 0;
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
  
  // Update basketball movement
  updateBasketballMovement();
  
  // Update shot power system
  updateShotPower();
  
  // Update controls
  controls.enabled = isOrbitEnabled;
  controls.update();
  
  renderer.render(scene, camera);
}

animate();