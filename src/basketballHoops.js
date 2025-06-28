export function createBasketballHoops(scene) {
    const rimHeight = 3.05;
    const courtLevel = 0.1;
    const actualRimHeight = courtLevel + rimHeight;
    
    const leftHoopX = -16;
    const rightHoopX = 16;
    
    const leftHoop = createSingleHoop(scene, leftHoopX, actualRimHeight, 1);
    
    const rightHoop = createSingleHoop(scene, rightHoopX, actualRimHeight, -1);
    
    return { leftHoop, rightHoop };
}

function createSingleHoop(scene, hoopX, rimHeight, direction) {
    
    const hoopGroup = new THREE.Group();
    
    const poleHeight = rimHeight + 1;
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, poleHeight, 8);
    const poleMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(0, poleHeight/2, 0);
    pole.castShadow = true;
    hoopGroup.add(pole);
    
    const backboardWidth = 1.8;
    const backboardHeight = 1.05;
    const backboardThickness = 0.05;
    
    const armExtension = 0.4;
    const backboardPosition = direction * armExtension;
    
    const backboardGeometry = new THREE.BoxGeometry(backboardThickness, backboardHeight, backboardWidth);
    const backboardMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        shininess: 100
    });
    const backboard = new THREE.Mesh(backboardGeometry, backboardMaterial);
    
    backboard.position.set(backboardPosition, rimHeight, 0);
    backboard.castShadow = true;
    hoopGroup.add(backboard);
    
    const armStart = 0;
    const armEnd = backboardPosition;
    const armLength = Math.abs(armEnd - armStart);
    const armCenter = (armStart + armEnd) / 2;
    
    const armGeometry = new THREE.CylinderGeometry(0.05, 0.05, armLength, 8);
    const armMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    
    arm.rotation.z = Math.PI / 2;
    arm.position.set(armCenter, rimHeight, 0);
    arm.castShadow = true;
    hoopGroup.add(arm);
    
    const rimRadius = 0.225;
    const rimGeometry = new THREE.TorusGeometry(rimRadius, 0.02, 5, 32);
    const rimMaterial = new THREE.MeshPhongMaterial({ color: 0xff6600 });
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    
    rim.rotation.x = Math.PI / 2;
    
    const backboardFrontFace = backboardPosition + (direction * backboardThickness/2);
    
    const rimPosition = backboardPosition + (direction * .25);
    
    rim.position.set(rimPosition, rimHeight, 0);
    rim.castShadow = true;
    hoopGroup.add(rim);
    
    const netGroup = createNet(hoopGroup, rimPosition, rimHeight, rimRadius, direction);
    
    hoopGroup.position.set(hoopX, 0, 0);
    
    scene.add(hoopGroup);
    
    return hoopGroup;
}

function createNet(parentGroup, rimX, rimY, rimRadius, direction) {
    const netMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffffff,
        linewidth: 2
    });
    
    const netLength = 0.4;
    const netSegments = 12;
    
    for (let i = 0; i < netSegments; i++) {
        const angle = (i / netSegments) * Math.PI * 2;
        
        const startX = rimX + Math.cos(angle) * rimRadius * 0.9;
        const startY = rimY - 0.02;
        const startZ = Math.sin(angle) * rimRadius * 0.9;
        
        const endX = rimX + Math.cos(angle) * rimRadius * 0.6;
        const endY = rimY - netLength;
        const endZ = Math.sin(angle) * rimRadius * 0.6;
        
        const points = [
            new THREE.Vector3(startX, startY, startZ),
            new THREE.Vector3(endX, endY, endZ)
        ];
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const netSegment = new THREE.Line(geometry, netMaterial);
        parentGroup.add(netSegment);
    }
    
    const connectingHeight = rimY - netLength * 0.3;
    for (let i = 0; i < netSegments; i++) {
        const angle1 = (i / netSegments) * Math.PI * 2;
        const angle2 = ((i + 1) / netSegments) * Math.PI * 2;
        
        const x1 = rimX + Math.cos(angle1) * rimRadius * 0.75;
        const z1 = Math.sin(angle1) * rimRadius * 0.75;
        const x2 = rimX + Math.cos(angle2) * rimRadius * 0.75;
        const z2 = Math.sin(angle2) * rimRadius * 0.75;
        
        const connectingPoints = [
            new THREE.Vector3(x1, connectingHeight, z1),
            new THREE.Vector3(x2, connectingHeight, z2)
        ];
        
        const connectingGeometry = new THREE.BufferGeometry().setFromPoints(connectingPoints);
        const connectingSegment = new THREE.Line(connectingGeometry, netMaterial);
        parentGroup.add(connectingSegment);
    }
}