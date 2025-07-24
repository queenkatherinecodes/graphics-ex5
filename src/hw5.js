import {OrbitControls} from './OrbitControls.js'
import {createCourtLines} from './courtLines.js'
import {createBasketballHoops} from './basketballHoops.js'
import {createBasketball} from './basketball.js'

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
scene.background = new THREE.Color(0x000000);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 15);
scene.add(directionalLight);

renderer.shadowMap.enabled = true;
directionalLight.castShadow = true;

function degrees_to_radians(degrees) {
  var pi = Math.PI;
  return degrees * (pi/180);
}


let gameStats = {
  score: 0,
  shotsMade: 0,
  shotAttempts: 0,
  shotPower: 50,
  gameStatus: "Ready to Shoot!",
  currentStreak: 0,
  bestStreak: 0
};


let basketball;
const courtBoundaries = {
  minX: -14.5,
  maxX: 14.5,
  minZ: -7,
  maxZ: 7
};


const movementConfig = {
  speed: 0.15,          
  smoothing: 0.85,      
  courtSurfaceHeight: 0.1,
  ballRadius: 0.18
};


const shotPowerConfig = {
  min: 0,               
  max: 100,             
  default: 50,          
  step: 2,              
  smoothing: 0.9        
};


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


const shotPowerState = {
  current: shotPowerConfig.default,
  target: shotPowerConfig.default,
  displayValue: shotPowerConfig.default
};

const physicsConfig = {
  gravity: -9.8,        
  timeScale: 0.016,     
  minArcHeight: 2.0,    
  rimHeight: 3.15,      
  courtHeight: 0.1,     
  groundBounce: 0.6,    
  wallBounce: 0.4,      
  rimBounce: 0.3,       
  friction: 0.85,       
  minBounceVelocity: 0.5, 
  rimRadius: 0.225,     
  ballRadius: 0.18,     
  backboardWidth: 1.8,
  backboardHeight: 1.05,
  backboardThickness: 0.05,
  backboardBounce: 0.4
};


const ballPhysics = {
  isFlying: false,     
  velocity: { x: 0, y: 0, z: 0 },  
  position: { x: 0, y: 0, z: 0 },  
  restingPosition: { x: 0, y: 0, z: 0 }, 
  timeInFlight: 0,      
  lastCollision: null,  
  bounceCount: 0,       
  scoreRecorded: false, 
  missRecorded: false,  
  rimHit: false         
};


const ballRotation = {
  rotation: { x: 0, y: 0, z: 0 },  
  angularVelocity: { x: 0, y: 0, z: 0 }, 
  rotationScale: 2.5,   
  smoothing: 0.9,       
  minRotationSpeed: 0.1 
};


const scoringSystem = {
  score: 0,             
  shotAttempts: 0,      
  shotsMade: 0,         
  accuracy: 0,          
  lastShotResult: null  
};

const hoopPositions = [
  { 
    x: -14, 
    y: physicsConfig.rimHeight, 
    z: 0, 
    side: 'left',
    backboard: {
      x: -14 + 0.4, 
      y: physicsConfig.rimHeight,
      z: 0
    },
    rim: {
      x: -14 + 0.4 - 0.25, 
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
      x: 14 - 0.4, 
      y: physicsConfig.rimHeight,
      z: 0
    },
    rim: {
      x: 14 - 0.4 + 0.25, 
      y: physicsConfig.rimHeight,
      z: 0
    }
  }
];



function initializeUI() {
  updateScoreDisplay();
  updatePowerDisplay();
  updateGameStatus("Ready to Shoot!");
}

function updateScoreDisplay() {
  
  const currentScore = document.getElementById('currentScore');
  const shotsMade = document.getElementById('shotsMade');
  const shotAttempts = document.getElementById('shotAttempts');
  const accuracy = document.getElementById('accuracy');
  
  if (currentScore) currentScore.textContent = gameStats.score;
  if (shotsMade) shotsMade.textContent = gameStats.shotsMade;
  if (shotAttempts) shotAttempts.textContent = gameStats.shotAttempts;
  
  const accuracyPercent = gameStats.shotAttempts > 0 
    ? Math.round((gameStats.shotsMade / gameStats.shotAttempts) * 100) 
    : 0;
  if (accuracy) accuracy.textContent = accuracyPercent + '%';
  
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
    
    if (gameStats.shotPower < 30) {
      powerValue.style.color = '#00ff00'; 
    } else if (gameStats.shotPower < 70) {
      powerValue.style.color = '#ffff00'; 
    } else {
      powerValue.style.color = '#ff0000'; 
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
  
  feedbackMessage.classList.remove('show', 'success', 'miss');
  
  if (isSuccess) {
    feedbackMessage.textContent = message || 'SHOT MADE!';
    feedbackMessage.classList.add('success');
  } else {
    feedbackMessage.textContent = message || 'MISSED SHOT!';
    feedbackMessage.classList.add('miss');
  }
  
  feedbackMessage.classList.add('show');
  
  setTimeout(() => {
    feedbackMessage.classList.remove('show');
  }, 2000);
}

function onShotAttemptUI() {
  gameStats.shotAttempts++;
  updateScoreDisplay();
  updateGameStatus("Shot in progress...");
  showShotFeedback(false, "SHOOTING...");
  
  const powerDisplay = document.getElementById('powerDisplay');
  if (powerDisplay) {
    powerDisplay.classList.add('flash');
    setTimeout(() => powerDisplay.classList.remove('flash'), 300);
  }
}

function onShotMadeUI() {
  console.log(`Incremented gamestats.score by 2`);
  gameStats.currentStreak++;
  gameStats.bestStreak = Math.max(gameStats.bestStreak, gameStats.currentStreak);
  
  updateScoreDisplay();
  
  if (gameStats.currentStreak >= 3) {
    updateGameStatus(`${gameStats.currentStreak} STREAK!`);
    showShotFeedback(true, `${gameStats.currentStreak} STREAK!`);
  } else {
    updateGameStatus("Great shot! Ready for next...");
    showShotFeedback(true, 'SHOT MADE! +2');
  }
}

function onShotMissedUI() {
  gameStats.currentStreak = 0; 
  updateGameStatus("Missed! Try again...");
  showShotFeedback(false, 'MISSED SHOT!');
  updateScoreDisplay(); 
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
  
  shotPowerState.target = gameStats.shotPower;
  shotPowerState.current = gameStats.shotPower;
  shotPowerState.displayValue = gameStats.shotPower;
  
  updatePowerDisplay();
  
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
  gameStats.shotPower = 50; 
  shotPowerState.target = 50;
  shotPowerState.current = 50;
  shotPowerState.displayValue = 50;
  updatePowerDisplay();
}

function onBallMoveUI(direction) {
  updateGameStatus(`Moving ${direction}...`);
}


function recordShotAttempt() {
  scoringSystem.shotAttempts++;
  onShotAttemptUI();
  console.log(`Shot attempt #${scoringSystem.shotAttempts}`);
}

function recordMadeShot(points = 2) {
  scoringSystem.score += points;
  scoringSystem.shotsMade++;
  scoringSystem.lastShotResult = 'made';
  
  gameStats.score = scoringSystem.score;
  gameStats.shotsMade = scoringSystem.shotsMade;
  gameStats.shotAttempts = scoringSystem.shotAttempts;
  
  scoringSystem.accuracy = Math.round((scoringSystem.shotsMade / scoringSystem.shotAttempts) * 100);
  
  console.log(`SHOT MADE! +${points} points (${scoringSystem.score} total)`);
  console.log(`Made: ${scoringSystem.shotsMade}, Accuracy: ${scoringSystem.accuracy}%`);
  
  onShotMadeUI();
}

function recordMissedShot() {
  scoringSystem.lastShotResult = 'missed';
  
  gameStats.score = scoringSystem.score;
  gameStats.shotsMade = scoringSystem.shotsMade;
  gameStats.shotAttempts = scoringSystem.shotAttempts;
  
  scoringSystem.accuracy = scoringSystem.shotAttempts > 0 ? 
    Math.round((scoringSystem.shotsMade / scoringSystem.shotAttempts) * 100) : 0;
  
  console.log(`Shot missed. Accuracy: ${scoringSystem.accuracy}%`);
  
  onShotMissedUI();
}

function calculateBallRotation(velocity) {

  const ballRadius = physicsConfig.ballRadius;
  
  const angularVelocityX = -velocity.z / ballRadius; 
  const angularVelocityY = 0; 
  const angularVelocityZ = velocity.x / ballRadius;  
  
  return {
    x: angularVelocityX * ballRotation.rotationScale,
    y: angularVelocityY * ballRotation.rotationScale,
    z: angularVelocityZ * ballRotation.rotationScale
  };
}

function updateBallRotation() {
  if (!basketball) return;
  
  let currentVelocity;
  if (ballPhysics.isFlying) {
    currentVelocity = ballPhysics.velocity;
  } else {
    currentVelocity = {
      x: movementState.velocity.x / physicsConfig.timeScale,
      y: 0,
      z: movementState.velocity.z / physicsConfig.timeScale
    };
  }
  
  const targetAngularVelocity = calculateBallRotation(currentVelocity);
  

  ballRotation.angularVelocity.x = 
    ballRotation.angularVelocity.x * ballRotation.smoothing + 
    targetAngularVelocity.x * (1 - ballRotation.smoothing);
  
  ballRotation.angularVelocity.y = 
    ballRotation.angularVelocity.y * ballRotation.smoothing + 
    targetAngularVelocity.y * (1 - ballRotation.smoothing);
  
  ballRotation.angularVelocity.z = 
    ballRotation.angularVelocity.z * ballRotation.smoothing + 
    targetAngularVelocity.z * (1 - ballRotation.smoothing);
  
  ballRotation.rotation.x += ballRotation.angularVelocity.x * physicsConfig.timeScale;
  ballRotation.rotation.y += ballRotation.angularVelocity.y * physicsConfig.timeScale;
  ballRotation.rotation.z += ballRotation.angularVelocity.z * physicsConfig.timeScale;
  
  const basketballMesh = basketball.children[0]; 
  if (basketballMesh) {
    basketballMesh.rotation.x = ballRotation.rotation.x;
    basketballMesh.rotation.y = ballRotation.rotation.y;
    basketballMesh.rotation.z = ballRotation.rotation.z;
  }
  
  const rotationSpeed = Math.sqrt(
    ballRotation.angularVelocity.x * ballRotation.angularVelocity.x +
    ballRotation.angularVelocity.y * ballRotation.angularVelocity.y +
    ballRotation.angularVelocity.z * ballRotation.angularVelocity.z
  );
  
  if (rotationSpeed > ballRotation.minRotationSpeed && Math.random() < 0.01) {
    console.log(`Ball rotation speed: ${rotationSpeed.toFixed(2)} rad/s`);
  }
}

function checkGroundCollision() {
  const groundY = physicsConfig.courtHeight + physicsConfig.ballRadius;
  
  if (ballPhysics.position.y <= groundY && ballPhysics.velocity.y < 0) {
    ballPhysics.position.y = groundY;
    ballPhysics.lastCollision = 'ground';
    ballPhysics.bounceCount++;
    
    if (Math.abs(ballPhysics.velocity.y) > physicsConfig.minBounceVelocity) {
      ballPhysics.velocity.y = -ballPhysics.velocity.y * physicsConfig.groundBounce;
      ballPhysics.velocity.x *= physicsConfig.friction;
      ballPhysics.velocity.z *= physicsConfig.friction;
      
      console.log(`Ground bounce #${ballPhysics.bounceCount}, velocity: ${Math.abs(ballPhysics.velocity.y).toFixed(2)}`);
      return false; 
    } else {
      ballPhysics.isFlying = false;
      ballPhysics.velocity = { x: 0, y: 0, z: 0 };
      ballPhysics.bounceCount = 0;
      console.log("Ball came to rest on ground");
      
      if (!ballPhysics.scoreRecorded && !ballPhysics.missRecorded) {
        ballPhysics.missRecorded = true;
        recordMissedShot();
      }
      
      return true; 
    }
  }
  return false;
}

function checkWallCollisions() {
  let collided = false;
  

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


function checkBackboardCollision(hoop) {
  const backboard = hoop.backboard;
  const ball = ballPhysics.position;
  const ballRadius = physicsConfig.ballRadius;
  

  const distanceToBackboard = Math.abs(ball.x - backboard.x);
  

  const withinHeight = ball.y >= (backboard.y - physicsConfig.backboardHeight/2 - ballRadius) && 
                      ball.y <= (backboard.y + physicsConfig.backboardHeight/2 + ballRadius);
  const withinWidth = Math.abs(ball.z - backboard.z) <= (physicsConfig.backboardWidth/2 + ballRadius);
  

  if (distanceToBackboard <= (physicsConfig.backboardThickness/2 + ballRadius) && 
      withinHeight && withinWidth) {
    
    const isMovingTowardBackboard = (hoop.side === 'left' && ballPhysics.velocity.x > 0) ||
                                   (hoop.side === 'right' && ballPhysics.velocity.x < 0);
    
    if (isMovingTowardBackboard) {

      ballPhysics.velocity.x = -ballPhysics.velocity.x * physicsConfig.backboardBounce;
      ballPhysics.velocity.y *= physicsConfig.backboardBounce;
      ballPhysics.velocity.z *= physicsConfig.backboardBounce;
      

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


function checkRimScoring(hoop) {
  const rim = hoop.rim;
  const ball = ballPhysics.position;
  

  const dx = ball.x - rim.x;
  const dz = ball.z - rim.z;
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
  

  const rimTop = rim.y + 0.1;
  const rimBottom = rim.y - 0.15;
  const isAtRimLevel = ball.y <= rimTop && ball.y >= rimBottom;
  const isMovingDown = ballPhysics.velocity.y < -1; 
  
 
  if (isAtRimLevel && isMovingDown && 
      horizontalDistance <= physicsConfig.rimRadius * 1.35 && 
      !ballPhysics.scoreRecorded) {
    

    ballPhysics.lastCollision = `score-${hoop.side}`;
    ballPhysics.scoreRecorded = true;
    console.log(`SCORE! Shot made on ${hoop.side} hoop!`);
    recordMadeShot();
    return;
  }
  

  if (isAtRimLevel && 
      horizontalDistance > physicsConfig.rimRadius * 0.85 && 
      horizontalDistance <= physicsConfig.rimRadius + physicsConfig.ballRadius) {
    
   
    const normalX = dx / horizontalDistance;
    const normalZ = dz / horizontalDistance;
    

    const dotProduct = ballPhysics.velocity.x * normalX + ballPhysics.velocity.z * normalZ;
    ballPhysics.velocity.x -= 2 * dotProduct * normalX * physicsConfig.rimBounce;
    ballPhysics.velocity.z -= 2 * dotProduct * normalZ * physicsConfig.rimBounce;
    ballPhysics.velocity.y *= physicsConfig.rimBounce;
    

    const pushDistance = (physicsConfig.rimRadius + physicsConfig.ballRadius) - horizontalDistance;
    ballPhysics.position.x += normalX * pushDistance;
    ballPhysics.position.z += normalZ * pushDistance;
    
    ballPhysics.lastCollision = `rim-${hoop.side}`;
    ballPhysics.bounceCount++;
    ballPhysics.rimHit = true;
    console.log(`Rim collision on ${hoop.side} hoop`);
    console.log(`isAtRimLevel: ${isAtRimLevel}`);
    console.log(`movingDown: ${isMovingDown}`);
    console.log(`horizontal distance is: ${horizontalDistance}`);
    console.log(`while required distance is: ${physicsConfig.rimRadius * 1.5}`);
  }
}


function checkRimCollisions() {
  hoopPositions.forEach(hoop => {
  
    if (checkBackboardCollision(hoop)) {
      return; 
    }
    
    checkRimScoring(hoop);
  });
}

function createBasketballCourt() {
  const courtGeometry = new THREE.BoxGeometry(30, 0.2, 15);
  const courtMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xc68642, 
    shininess: 50
  });
  const court = new THREE.Mesh(courtGeometry, courtMaterial);
  court.receiveShadow = true;
  scene.add(court);
  
  createCourtLines(scene);
  createBasketballHoops(scene);
  
  basketball = createBasketball(scene);
}


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


function calculateTrajectory(targetHoop, shotVelocity) {
  const ballPos = basketball.position;
  

  const dx = targetHoop.rim.x - ballPos.x;
  const dz = targetHoop.rim.z - ballPos.z;
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
  

  const dy = targetHoop.rim.y - ballPos.y;
  

  const g = Math.abs(physicsConfig.gravity);
  const arcHeight = Math.max(physicsConfig.minArcHeight, dy + 1.5); 
  
  const discriminant = Math.sqrt(2 * arcHeight / g);
  const timeToTarget = Math.sqrt(2 * (arcHeight - dy) / g) + discriminant;
  

  const vx = dx / timeToTarget;
  const vz = dz / timeToTarget;
  const vy = Math.sqrt(2 * g * arcHeight);
  

  const powerMultiplier = shotVelocity / 15; 
  
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


function getShotVelocity() {
  const powerRatio = shotPowerState.current / 100;
  

  const ballPos = basketball.position;
  
 
  const distanceFromCenter = Math.sqrt(ballPos.x * ballPos.x + ballPos.z * ballPos.z);
  
  if (distanceFromCenter <= 2 && Math.abs(shotPowerState.current - 50) <= 5) {

    return 12; 
  }
  
 
  const minVelocity = 6;   
  const maxVelocity = 20;  
  
  return minVelocity + (maxVelocity - minVelocity) * powerRatio;
}


function shouldEndShotAttempt() {

  
  const maxFlightTime = 8; 
  const isOnGround = ballPhysics.position.y <= physicsConfig.courtHeight + physicsConfig.ballRadius + 0.1;
  const isMovingSlowly = Math.sqrt(
    ballPhysics.velocity.x * ballPhysics.velocity.x +
    ballPhysics.velocity.y * ballPhysics.velocity.y +
    ballPhysics.velocity.z * ballPhysics.velocity.z
  ) < 1;
  
  return (ballPhysics.timeInFlight > maxFlightTime) ||
         (isOnGround && isMovingSlowly && ballPhysics.bounceCount > 0);
}

function shootBasketball() {
  if (ballPhysics.isFlying || !basketball) return;
  
  recordShotAttempt();
  
  const shotVelocity = getShotVelocity();
  
  const { hoop: targetHoop, distance } = findNearestHoop();
  
  const trajectory = calculateTrajectory(targetHoop, shotVelocity);
  
  ballPhysics.isFlying = true;
  ballPhysics.velocity = trajectory.velocity;
  ballPhysics.position = {
    x: basketball.position.x,
    y: basketball.position.y,
    z: basketball.position.z
  };
  ballPhysics.timeInFlight = 0;
  ballPhysics.bounceCount = 0;  
  ballPhysics.lastCollision = null;  
  
  ballPhysics.scoreRecorded = false;
  ballPhysics.missRecorded = false;
  ballPhysics.rimHit = false;
  
  ballPhysics.restingPosition = {
    x: basketball.position.x,
    y: movementConfig.courtSurfaceHeight + movementConfig.ballRadius,
    z: basketball.position.z
  };
  

  console.log(`Shot #${scoringSystem.shotAttempts} fired with ${shotPowerState.displayValue}% power toward ${targetHoop.side} hoop!`);
  console.log(`Distance: ${distance.toFixed(2)} units, Velocity: ${shotVelocity.toFixed(2)}`);
}


function updateBasketballPhysics() {
  if (!ballPhysics.isFlying || !basketball) return;
  ballPhysics.timeInFlight += physicsConfig.timeScale;
  ballPhysics.velocity.y += physicsConfig.gravity * physicsConfig.timeScale;
  
  ballPhysics.position.x += ballPhysics.velocity.x * physicsConfig.timeScale;
  ballPhysics.position.y += ballPhysics.velocity.y * physicsConfig.timeScale;
  ballPhysics.position.z += ballPhysics.velocity.z * physicsConfig.timeScale;
  
  checkRimCollisions();
  
  checkWallCollisions();
  
  const ballStopped = checkGroundCollision();

  if (shouldEndShotAttempt() && !ballPhysics.scoreRecorded && !ballPhysics.missRecorded) {
    ballPhysics.missRecorded = true;
    recordMissedShot();
    ballPhysics.isFlying = false;
    ballPhysics.velocity = { x: 0, y: 0, z: 0 };
    ballPhysics.position.y = physicsConfig.courtHeight + physicsConfig.ballRadius;
    console.log("Shot attempt ended - recorded as miss");
  }
  
  if (Math.abs(ballPhysics.position.x) > courtBoundaries.maxX + 5 ||
      Math.abs(ballPhysics.position.z) > courtBoundaries.maxZ + 5 ||
      ballPhysics.position.y < -2) {
    ballPhysics.isFlying = false;
    ballPhysics.position = { ...ballPhysics.restingPosition };
    ballPhysics.velocity = { x: 0, y: 0, z: 0 };
    ballPhysics.bounceCount = 0;
    console.log("Ball reset due to going out of bounds");
    
    if (!ballPhysics.scoreRecorded && !ballPhysics.missRecorded) {
      ballPhysics.missRecorded = true;
      recordMissedShot();
    }
  }
  
  basketball.position.set(
    ballPhysics.position.x,
    ballPhysics.position.y,
    ballPhysics.position.z
  );
}

function updateBasketballMovement() {
  if (!basketball || ballPhysics.isFlying) return;
  
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
  
  movementState.velocity.x = 
    movementState.velocity.x * movementConfig.smoothing + 
    movementState.targetVelocity.x * (1 - movementConfig.smoothing);
  
  movementState.velocity.z = 
    movementState.velocity.z * movementConfig.smoothing + 
    movementState.targetVelocity.z * (1 - movementConfig.smoothing);
  
  const currentPos = basketball.position;
  
  let newX = currentPos.x + movementState.velocity.x;
  let newZ = currentPos.z + movementState.velocity.z;
  
  newX = Math.max(courtBoundaries.minX, Math.min(courtBoundaries.maxX, newX));
  newZ = Math.max(courtBoundaries.minZ, Math.min(courtBoundaries.maxZ, newZ));
  
  basketball.position.set(
    newX,
    movementConfig.courtSurfaceHeight + movementConfig.ballRadius,
    newZ
  );
  
  ballPhysics.position = {
    x: newX,
    y: movementConfig.courtSurfaceHeight + movementConfig.ballRadius,
    z: newZ
  };
  
  if (newX <= courtBoundaries.minX || newX >= courtBoundaries.maxX) {
    movementState.velocity.x = 0;
  }
  if (newZ <= courtBoundaries.minZ || newZ >= courtBoundaries.maxZ) {
    movementState.velocity.z = 0;
  }
}

function updateShotPower() {
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
  
  shotPowerState.current = 
    shotPowerState.current * shotPowerConfig.smoothing + 
    shotPowerState.target * (1 - shotPowerConfig.smoothing);
  
  shotPowerState.displayValue = Math.round(shotPowerState.current);
  
  gameStats.shotPower = shotPowerState.displayValue;
  
  updatePowerIndicatorUI();
}

function updatePowerIndicatorUI() {
  updatePowerDisplay();
}

function resetBasketball() {
  if (!basketball) return;
  
  ballPhysics.isFlying = false;
  ballPhysics.velocity = { x: 0, y: 0, z: 0 };
  ballPhysics.bounceCount = 0;
  ballPhysics.scoreRecorded = false;
  ballPhysics.missRecorded = false;
  ballPhysics.rimHit = false;
  
  const centerPos = {
    x: 0,
    y: movementConfig.courtSurfaceHeight + movementConfig.ballRadius,
    z: 0
  };
  
  basketball.position.set(centerPos.x, centerPos.y, centerPos.z);
  ballPhysics.position = { ...centerPos };
  
  movementState.velocity = { x: 0, z: 0 };
  movementState.targetVelocity = { x: 0, z: 0 };
  
  ballRotation.rotation = { x: 0, y: 0, z: 0 };
  ballRotation.angularVelocity = { x: 0, y: 0, z: 0 };
  
  onBallResetUI();
  
  console.log("Basketball reset to center court");
}

function handleKeyDown(e) {
  if (e.key === "o" || e.key === "O") {
    isOrbitEnabled = !isOrbitEnabled;
    updateGameStatus("Camera toggled!");
    return;
  }
  
  if (e.key === "r" || e.key === "R") {
    e.preventDefault();
    resetBasketball();
    return;
  }
  
  if (e.code === 'Space') {
    e.preventDefault();
    shootBasketball();
    return;
  }
  
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

createBasketballCourt();

const cameraTranslate = new THREE.Matrix4();
cameraTranslate.makeTranslation(0, 15, 30);
camera.applyMatrix4(cameraTranslate);

const controls = new OrbitControls(camera, renderer.domElement);
let isOrbitEnabled = true;

document.addEventListener('DOMContentLoaded', function() {
  initializeUI();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUI);
} else {
  initializeUI();
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

window.addEventListener('resize', function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  
  updateBasketballPhysics();
  
  updateBasketballMovement();
  
  updateBallRotation();
  
  updateShotPower();
  
  controls.enabled = isOrbitEnabled;
  controls.update();
  
  renderer.render(scene, camera);
}

animate();