# Computer Graphics - Exercise 5 - WebGL Basketball Court

## Getting Started

1. Clone this repository to your local machine
2. Make sure you have Node.js installed
3. Start the local web server: `node index.js`
4. Open your browser and go to http://localhost:8000

## Complete Instructions

**All detailed instructions, requirements, and specifications can be found in:**
`basketball_exercise_instructions.html`

## Group Members

**MANDATORY: Add the full names of all group members here:**

- [Member 1 Katherine Berger]
- [Member 2 Amit Parann]

## Technical Details

- Run `npm i`
- Run the server with: `node index.js`
- Access at http://localhost:8000 in your web browser

## CONTROLS:

Arrow keys to move, W/S to increase/increase shot strength, and space to shoot

## Physics system:

#### Ball rotation: calculateBallRotation, updateBallRotation

These methods are used to change the ball's rotation based on the velocity in which it is flying

#### Collision: checkGroundCollision, checkWallCollisions, checkBackboardCollision,checkRimScoring

These methods are used to check if the ball interacts with different objects in the scene by comparing it's xyz coordinates to them.
updateBasketballPhysics updates our state every frame.

## Additional features:

Multiple hoops, combo system (without bonus points).

## Known issues:

Collision with backboard doesn't really work
A mismatch between the visible position of the rim, and its collision area (that dictates where is the "scoring area")
