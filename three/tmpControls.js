( function () {

	const _lookDirection = new THREE.Vector3();

	const _spherical = new THREE.Spherical();

	const _target = new THREE.Vector3();

	class TmpControls {

		constructor( object, domElement ) {

			if ( domElement === undefined ) {

				console.warn( 'THREE.FirstPersonControls: The second parameter "domElement" is now mandatory.' );
				domElement = document;

			}

			this.object = object;
			this.domElement = domElement; // API

			this.enabled = true;
			this.movementSpeed = 0.05;
			this.lookSpeed = 0.005;
			this.lookVertical = true;
			this.autoForward = false;
			this.activeLook = true;
			this.heightSpeed = false;
			this.heightCoef = 1.0;
			this.heightMin = 0.0;
			this.heightMax = 1.0;
			this.constrainVertical = false;
			this.verticalMin = 0;
			this.verticalMax = Math.PI;
			this.mouseDragOn = false; // internals

			this.autoSpeedFactor = 0.0;
			this.mouseX = 0;
			this.mouseY = 0;
			this.moveForward = false;
			this.moveBackward = false;
			this.turnLeft = false;
			this.moveRight = false;
			this.viewHalfX = 0;
			this.viewHalfY = 0; // private variables

			let lat = 0;
			let lon = 0; //

			this.handleResize = function () {

				if ( this.domElement === document ) {

					this.viewHalfX = window.innerWidth / 2;
					this.viewHalfY = window.innerHeight / 2;

				} else {

					this.viewHalfX = this.domElement.offsetWidth / 2;
					this.viewHalfY = this.domElement.offsetHeight / 2;

				}

			};

			
			this.onKeyDown = function ( event ) {

				//event.preventDefault();
				switch ( event.code ) {

					case 'ArrowUp':
					case 'KeyW':
						this.moveForward = true;
						break;

					case 'ArrowLeft':
					case 'KeyA':
						this.turnLeft = true;
						break;

					case 'ArrowDown':
					case 'KeyS':
						this.moveBackward = true;
						break;

					case 'ArrowRight':
					case 'KeyD':
						this.moveRight = true;
						break;

					case 'KeyR':
						this.moveUp = true;
						break;

					case 'KeyF':
						this.moveDown = true;
						break;

				}

			};

			this.onKeyUp = function ( event ) {

				switch ( event.code ) {

					case 'ArrowUp':
					case 'KeyW':
						this.moveForward = false;
						break;

					case 'ArrowLeft':
					case 'KeyA':
						this.turnLeft = false;
						break;

					case 'ArrowDown':
					case 'KeyS':
						this.moveBackward = false;
						break;

					case 'ArrowRight':
					case 'KeyD':
						this.moveRight = false;
						break;

					case 'KeyR':
						this.moveUp = false;
						break;

					case 'KeyF':
						this.moveDown = false;
						break;

				}

			};

			this.lookAt = function ( x, y, z ) {

				if ( x.isVector3 ) {

					_target.copy( x );

				} else {

					_target.set( x, y, z );

				}

				this.object.lookAt( _target );
				setOrientation( this );
				return this;

			};

			this.update = function () {

				const targetPosition = new THREE.Vector3();
        let worldDir = new THREE.Vector3();
				return function update( delta ) {

					if ( this.enabled === false ) return;

					if ( this.heightSpeed ) {

						const y = THREE.MathUtils.clamp( this.object.position.y, this.heightMin, this.heightMax );
						const heightDelta = y - this.heightMin;
						this.autoSpeedFactor = delta * ( heightDelta * this.heightCoef );

					} else {

						this.autoSpeedFactor = 0.0;

					}

					const actualMoveSpeed = delta * this.movementSpeed;
					if ( this.moveForward || this.autoForward && ! this.moveBackward ) this.object.translateZ( - ( actualMoveSpeed + this.autoSpeedFactor ) );
					if ( this.moveBackward ) this.object.translateZ( actualMoveSpeed );
					//if ( this.turnLeft ) this.object.translateX( - actualMoveSpeed );
          if ( this.turnLeft ){
            this.object.getWorldDirection(worldDir);
            worldDir.x -= 1000;
            this.object.lookAt(this.object.position);
          }
					if ( this.moveRight ) this.object.translateX( actualMoveSpeed );
					if ( this.moveUp ) this.object.translateY( actualMoveSpeed );
					if ( this.moveDown ) this.object.translateY( - actualMoveSpeed );
					let actualLookSpeed = delta * this.lookSpeed;

					if ( ! this.activeLook ) {

						actualLookSpeed = 0;

					}

					let verticalLookRatio = 1;

					if ( this.constrainVertical ) {

						verticalLookRatio = Math.PI / ( this.verticalMax - this.verticalMin );

					}

					lon -= this.mouseX * actualLookSpeed;
					if ( this.lookVertical ) lat -= this.mouseY * actualLookSpeed * verticalLookRatio;
					lat = Math.max( - 85, Math.min( 85, lat ) );
					let phi = THREE.MathUtils.degToRad( 90 - lat );
					const theta = THREE.MathUtils.degToRad( lon );

					if ( this.constrainVertical ) {

						phi = THREE.MathUtils.mapLinear( phi, 0, Math.PI, this.verticalMin, this.verticalMax );

					}

					const position = this.object.position;
					targetPosition.setFromSphericalCoords( 1, phi, theta ).add( position );
					this.object.lookAt( targetPosition );

				};

			}();

		
			const _onKeyDown = this.onKeyDown.bind( this );
			const _onKeyUp = this.onKeyUp.bind( this );

			window.addEventListener( 'keydown', _onKeyDown );
			window.addEventListener( 'keyup', _onKeyUp );

			function setOrientation( controls ) {

				const quaternion = controls.object.quaternion;

				_lookDirection.set( 0, 0, - 1 ).applyQuaternion( quaternion );

				_spherical.setFromVector3( _lookDirection );

				lat = 90 - THREE.MathUtils.radToDeg( _spherical.phi );
				lon = THREE.MathUtils.radToDeg( _spherical.theta );

			}

			this.handleResize();
			setOrientation( this );

		}

	}

	THREE.TmpControls = TmpControls;

} )();