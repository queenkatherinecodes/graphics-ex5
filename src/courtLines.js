export function createCourtLines(scene) {
  const lineHeight = 0.11;
  
  const lineMaterial = new THREE.LineBasicMaterial({ 
    color: 0xffffff,
    linewidth: 3
  });

  function createCenterLine(scene) {
    const points = [];
    points.push(new THREE.Vector3(0, lineHeight, -7.5));
    points.push(new THREE.Vector3(0, lineHeight, 7.5));
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const centerLine = new THREE.Line(geometry, lineMaterial);
    scene.add(centerLine);
  }

  function createThreePointLines(scene) {
    const radius = 6.25;
    const segments = 48;
    
    const leftPoints = [];
    const leftBasketX = -15;
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI - Math.PI/2;
      const x = leftBasketX + Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = lineHeight;
      
      if (Math.abs(z) <= 7.5 && x >= leftBasketX) {
        leftPoints.push(new THREE.Vector3(x, y, z));
      }
    }
    
    const leftGeometry = new THREE.BufferGeometry().setFromPoints(leftPoints);
    const leftThreePointLine = new THREE.Line(leftGeometry, lineMaterial);
    scene.add(leftThreePointLine);
    
    const rightPoints = [];
    const rightBasketX = 15;
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI + Math.PI/2;
      const x = rightBasketX + Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = lineHeight;
      
      if (Math.abs(z) <= 7.5 && x <= rightBasketX) {
        rightPoints.push(new THREE.Vector3(x, y, z));
      }
    }
    
    const rightGeometry = new THREE.BufferGeometry().setFromPoints(rightPoints);
    const rightThreePointLine = new THREE.Line(rightGeometry, lineMaterial);
    scene.add(rightThreePointLine);
  }

  function createCenterCircle(scene) {
    const radius = 2;
    const segments = 64;
    const points = [];
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = lineHeight;
      
      points.push(new THREE.Vector3(x, y, z));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const centerCircle = new THREE.Line(geometry, lineMaterial);
    scene.add(centerCircle);
  }

  function createKeyAreas(scene) {
      const keyWidth = 3.8;
      const keyLength = 4.2;
      
      const leftKeyPoints = [
        new THREE.Vector3(-15, lineHeight, -keyWidth/2),
        new THREE.Vector3(-15, lineHeight, keyWidth/2),
        new THREE.Vector3(-15 + keyLength, lineHeight, keyWidth/2),
        new THREE.Vector3(-15 + keyLength, lineHeight, -keyWidth/2),
        new THREE.Vector3(-15, lineHeight, -keyWidth/2)
      ];
      
      const leftKeyGeometry = new THREE.BufferGeometry().setFromPoints(leftKeyPoints);
      const leftKey = new THREE.Line(leftKeyGeometry, lineMaterial);
      scene.add(leftKey);
      
      const rightKeyPoints = [
        new THREE.Vector3(15, lineHeight, -keyWidth/2),
        new THREE.Vector3(15, lineHeight, keyWidth/2),
        new THREE.Vector3(15 - keyLength, lineHeight, keyWidth/2),
        new THREE.Vector3(15 - keyLength, lineHeight, -keyWidth/2),
        new THREE.Vector3(15, lineHeight, -keyWidth/2)
      ];
      
      const rightKeyGeometry = new THREE.BufferGeometry().setFromPoints(rightKeyPoints);
      const rightKey = new THREE.Line(rightKeyGeometry, lineMaterial);
      scene.add(rightKey);
  }

function createFreeThrowCircles(scene) {
  const keyWidth = 3.8;
  const keyLength = 4.2;
  const radius = keyWidth/2;
  const segments = 32;
  
  const leftCenterX = -15 + keyLength;
  const leftCenterZ = 0;
  const leftCirclePoints = [];
  
  for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI - Math.PI/2;
      const x = leftCenterX + Math.cos(angle) * radius;
      const z = leftCenterZ + Math.sin(angle) * radius;
      const y = lineHeight;
      
      leftCirclePoints.push(new THREE.Vector3(x, y, z));
  }
  
  const leftCircleGeometry = new THREE.BufferGeometry().setFromPoints(leftCirclePoints);
  const leftFTCircle = new THREE.Line(leftCircleGeometry, lineMaterial);
  scene.add(leftFTCircle);
  
  const rightCenterX = 15 - keyLength;
  const rightCenterZ = 0;
  const rightCirclePoints = [];
  
  for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI + Math.PI/2;
      const x = rightCenterX + Math.cos(angle) * radius;
      const z = rightCenterZ + Math.sin(angle) * radius;
      const y = lineHeight;
      
      rightCirclePoints.push(new THREE.Vector3(x, y, z));
  }
  
  const rightCircleGeometry = new THREE.BufferGeometry().setFromPoints(rightCirclePoints);
  const rightFTCircle = new THREE.Line(rightCircleGeometry, lineMaterial);
  scene.add(rightFTCircle);
}
  createCenterLine(scene);
  createKeyAreas(scene);
  createFreeThrowCircles(scene);
  createThreePointLines(scene);
  createCenterCircle(scene);
}