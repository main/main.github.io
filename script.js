var container = document.getElementById( 'container' );

var renderer = new THREE.WebGLRenderer( { antialias: true } );
// renderer.setClearColor( 0xBBBBBB, 1 );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
container.appendChild( renderer.domElement );

var camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, .1, 100000 );
camera.position.set( 0, -0.03, 2.8 );

var controls = new THREE.OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 1.3, 0.08 );

var scene = new THREE.Scene();

scene.background = new THREE.Color( 0x716c7c );
scene.fog = new THREE.Fog( scene.background, 1, 5 );

var bg = scene.background.getHSL();
var bgL = bg.l;

var aLight = new THREE.AmbientLight( 0x2e2833 );
scene.add( aLight );

// sun or moon
var dLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
dLight.position.set( 1, 1, 1 );
scene.add( dLight );

// lightning
var pLight = new THREE.PointLight( 0xffff00, 0 );
pLight.position.y = 1;
scene.add( pLight );

// var dlh = new THREE.DirectionalLightHelper( dLight, 0.5 );
// scene.add( dlh );

// var plh = new THREE.PointLightHelper( pLight, 0.1 );
// scene.add( plh );

// var gh = new THREE.GridHelper( 2, 10, 0x000000, 0xbbbbbb );
// scene.add( gh );
// gh.position.y = -0.02;

// ------------------------------------------------------------

var clock = new THREE.Clock();
var time = 0;

// ------------------------------------------------------------

// tornado lathe + torus rings

var Tornado = function(){

	THREE.Group.call( this );

	var points = [];

	for ( var i = 0; i < 10; i ++ ) {
		var point = new THREE.Vector2(
			Math.sin( i * 0.2 ) * 8 + 1,
			i * 2
		);

		points.push( point );
	}

	var latheGeo = new THREE.LatheBufferGeometry( points, 8 );
	var latheMat = new THREE.MeshPhongMaterial({
		color: 0xd9edfd,
		side: THREE.DoubleSide,
		transparent: true,
		opacity: 0.3
	});
	var lathe = this.lathe = new THREE.Mesh( latheGeo, latheMat );
	lathe.scale.setScalar( 0.1 );
	this.add( lathe );

	// ------------------------------------------

	// torus ring column following lathe points

	var ringGroup = this.ringGroup = new THREE.Group();
	this.add( ringGroup );

	var torusMat = new THREE.MeshPhongMaterial({
		color: 0xd9edfd,
		specular: 0x111111,
		shininess: 1
	});

	for (var i = 0; i < points.length; i++ ) {
		var radius = points[i].x * 0.1;
		var torusGeo = new THREE.TorusBufferGeometry( radius, i / points.length * 0.04 + 0.02, 12, 32 );
		var torus = new THREE.Mesh( torusGeo, torusMat );
		torus.rotation.x = Math.PI / 2;
		torus.position.y = points[i].y * 0.1;
		ringGroup.add( torus );
	}
};

Tornado.prototype = Object.create( THREE.Group.prototype );
Tornado.prototype.constructor = Tornado;

Tornado.prototype.update = function() {
	this.lathe.rotation.y -= 0.05;

	// rotate rings
	var rings = this.ringGroup.children;
	for (var i = 0; i < rings.length; i++) {
		var ring = rings[i];
		ring.position.x = Math.cos( time * i ) * i / rings.length * 0.4;
		ring.position.z = Math.sin( time * i ) * i / rings.length * 0.4;
	}
}

var tornado = new Tornado();
scene.add( tornado );

// ------------------------------------------------------------

// rain particles

// https://aerotwist.com/tutorials/creating-particles-with-three-js/
// https://aerotwist.com/static/tutorials/creating-particles-with-three-js/demo/

var Rain = function() {

	THREE.Group.call( this );

	// circle texture

	var canvas = document.createElement('canvas');
	canvas.width = canvas.height = 128;
	var ctx = canvas.getContext( '2d' );

	var centerX = canvas.width / 2;
	var centerY = canvas.height / 2;
	var radius = canvas.width / 3;

	ctx.beginPath();
	ctx.arc( centerX, centerY, radius, 0, 2 * Math.PI, false );
	ctx.fillStyle = '#fff';
	ctx.fill();

	var texture = new THREE.Texture( canvas );
	texture.premultiplyAlpha = true;
	texture.needsUpdate = true;

	//

	var pointsGeo = new THREE.Geometry();
	var pointsMat = new THREE.PointsMaterial({
		color: 0x2e2833,
		size: 0.05,
		map: texture,
		transparent: true,
		depthWrite: false
	});

	var pointCount = this.pointCount = 400; // 1800
	var rangeV = this.rangeV = 2.5; // 600
	var rangeH = this.rangeH = 4;

	for (var p = 0; p < pointCount; p++) {

		var point = new THREE.Vector3(
			THREE.Math.randFloatSpread( rangeH ),
			THREE.Math.randFloatSpread( rangeV ),
			THREE.Math.randFloatSpread( rangeH )
		);

		point.velocity = new THREE.Vector3( 0, -Math.random() * 0.05, 0);

		pointsGeo.vertices.push( point );
	}

	var points = this.points = new THREE.Points( pointsGeo, pointsMat );
	points.position.y = - rangeV / 2;
	points.sortParticles = true;

	this.add( points );

}

Rain.prototype = Object.create( THREE.Group.prototype );
Rain.prototype.constructor = Rain;

Rain.prototype.update = function(){
	this.points.rotation.y -= 0.01;

	var pCount = this.pointCount;
	while ( pCount-- ) {

		var point = this.points.geometry.vertices[pCount];

		// check if we need to reset
		if ( point.y < - this.rangeV / 2 ) {
			point.y = this.rangeV / 2;
			point.velocity.y = 0;
		}

		// update the velocity
		point.velocity.y -= Math.random() * 0.0005; // .1

		// and the position
		point.add( point.velocity );
	}

	this.points.geometry.verticesNeedUpdate = true;
}

var rain = new Rain();
rain.position.y = 2;
scene.add( rain );

// -----------------------------------------------------------

// clouds: marching cubes voxel field
// https://threejs.org/examples/webgl_marchingcubes

var resolution = 32;
var cloudMat = new THREE.MeshPhongMaterial({
	color: 0xd9edfd,
	specular: 0x111111,
	shininess: 1
});
var clouds = new THREE.MarchingCubes( resolution, cloudMat, false, false );
clouds.isolation = 80;
clouds.position.set( 0, 2, 0 );
clouds.scale.setScalar( 3 );
scene.add( clouds );

var cloudController = {
	speed: 0.5,
	resolution: 64,
	numBlobs: 50,
	scale: 3,
	isolation: 190,
	subtract: 20
};

function cloudsUpdate( delta ) {

	time += delta * cloudController.speed;

	if ( cloudController.resolution !== resolution ) {
		resolution = cloudController.resolution;
		clouds.init( Math.floor( resolution ) );
	}

	if ( cloudController.isolation !== clouds.isolation ) {
		clouds.isolation = cloudController.isolation;
	}

	var numBlobs = cloudController.numBlobs;

	clouds.reset();

	//

	var strength = 1.2 / ( ( Math.sqrt( numBlobs ) - 1 ) / 4 + 1 );

	for ( var i = 0; i < numBlobs; i ++ ) {
		// wtf?
		var ballx = Math.sin( i + 1.26 * time * ( 1.03 + 0.5 * Math.cos( 0.21 * i ) ) ) * 0.27 + 0.5;
		var bally = Math.sin( i + 0.2 * time ) * .08 + 0.5;
		var ballz = Math.cos( i + 1.32 * time * 0.1 * Math.sin( ( 0.92 + 0.53 * i ) ) ) * 0.27 + 0.5;

		clouds.addBall( ballx, bally, ballz, strength, cloudController.subtract );
	}

}

// ------------------------------------------------------------

window.addEventListener( 'resize', resize, false );
function resize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
}

loop();

function loop() {

	requestAnimationFrame( loop );

	controls.update();

	var t = clock.elapsedTime;
	var dt = clock.getDelta();

	// lightning flicker
	if ( Math.round( t ) % 2 && Math.random() > 0.8 ) {
		pLight.intensity = 0.4;
		scene.background.setHSL( bg.h, bg.s, bgL + 0.1 );
	} else {
		pLight.intensity = 0;
		scene.background.setHSL( bg.h, bg.s, bgL );
	}

	tornado.update();

	rain.update();

	cloudsUpdate( dt );

	renderer.render( scene, camera );
}