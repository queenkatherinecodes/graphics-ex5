export function createBasketball(scene) {
    const courtSurfaceHeight = 0.1;
    const ballRadius = 0.18;
    const ballPosition = {
        x: 0,
        y: courtSurfaceHeight + ballRadius,
        z: 0
    };
    
    const basketballGroup = new THREE.Group();
    const textureLoader = new THREE.TextureLoader();
    const basketballTexture = textureLoader.load(
        'src/basketball.jpeg',
        function(texture) {
            console.log('Basketball texture loaded successfully');
        },
        function(progress) {
            console.log('Basketball texture loading progress:', progress);
        },
        function(error) {
            console.error('Error loading basketball texture:', error);
            console.log('Make sure src/basketball.jpg is in the correct directory');
        }
    );
    
    basketballTexture.wrapS = THREE.RepeatWrapping;
    basketballTexture.wrapT = THREE.RepeatWrapping;
    basketballTexture.minFilter = THREE.LinearFilter;
    basketballTexture.magFilter = THREE.LinearFilter;
    
    const ballGeometry = new THREE.SphereGeometry(ballRadius, 64, 64);
    const ballMaterial = new THREE.MeshPhongMaterial({ 
        map: basketballTexture,
        shininess: 25,
        specular: 0x222222,
    });
    
    const basketball = new THREE.Mesh(ballGeometry, ballMaterial);
    basketball.castShadow = true;
    basketball.receiveShadow = true;
    basketballGroup.add(basketball);
    
    basketballGroup.position.set(ballPosition.x, ballPosition.y, ballPosition.z);
    scene.add(basketballGroup);
    return basketballGroup;
}