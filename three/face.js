// based on:
// https://google.github.io/mediapipe/solutions/face_mesh.html#resources
// https://github.com/tensorflow/tfjs-models/tree/master/face-landmarks-detection
class Face  {
  //////////////////////////////////////////////////////////
  constructor(){
		this.drawVideo = false;
		// Our input frames will come from here.
		//const videoElement = document.getElementsByClassName("input_video")[0];
		//<video style="display: none;" class="input_video"></video>
		this.video = document.createElement("video");
		this.video.className = "input_video";
		this.video.style.display = "none";
		document.body.appendChild(this.video);

		this.faceX = document.getElementById('face-x');
		this.faceY = document.getElementById('face-y');

		//const canvasElement = document.getElementsByClassName("output_canvas")[0];
		//<canvas style="position: fixed; height: 144px; width: 256px; left: 0; top: 0; transform: scale(-1, 1);" class="output_canvas" width="256px" height="144px"></canvas>
		// this.canvas = document.createElement("canvas");
		// this.canvas.cssText = "position: fixed; height: 144px; width: 256px; left: 0; top: 0; transform: scale(-1, 1);";
		this.canvas = document.getElementById('face-canvas');
		//document.body.appendChild(this.canvas);

		this.canvasCtx = this.canvas.getContext("2d");
		// const previewCoords = document.getElementById("preview-coords");
		// const previewDir = document.getElementById("preview-dir");

		this.orientation = {x:0,y:0};
		this.center = {x:0,y:0};
	}
	//////////////////////////////////////////////////////////
	startCamera(cb){
		this.faceMesh = new window.FaceMesh({
			locateFile: file => {
				return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.1/${file}`;
			}
		});

		this.faceMesh.onResults(this.onResults.bind(this));

		// Instantiate a camera. We'll feed each frame we receive into the solution.
		const camera = new window.Camera(this.video, {
			onFrame: async () => {
				await this.faceMesh.send({ image: this.video });
			},
			width: 1280,
			height: 720
		});
		camera.start();
	}
	//////////////////////////////////////////////////////////
	captureCenterXY(){
		this.center.x = this.orientation.x;
		this.center.y = this.orientation.y;
	}
	getDelta(){
		return {
			x : this.orientation.x - this.center.x,
			y : this.orientation.y - this.center.y
		}
	}
	//////////////////////////////////////////////////////////
	onResults(results) {
		if(!results.multiFaceLandmarks)
			return;

		this.orientation.x = results.multiFaceLandmarks[0][1].x;
		this.orientation.y = results.multiFaceLandmarks[0][1].y;


		// Hide the spinner.
		//document.body.classList.add("loaded");
		//console.log('loaded')

		// Draw the overlays.
		this.canvasCtx.save();
		this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		if(this.drawVideo){
			this.canvasCtx.drawImage(
				results.image,
				0,
				0,
				this.canvas.width,
				this.canvas.height
			);
		}

		// grid face
		for (const landmarks of results.multiFaceLandmarks) {
			window.drawConnectors(this.canvasCtx, landmarks, window.FACEMESH_TESSELATION, {
				color: "#00FFA0",
				lineWidth: 0.2
			});
		}
		// // this landmark is the tip of the nose
		// drawLandmarks(this.canvasCtx, [results.multiFaceLandmarks[0][1]], {
		// 	color: "#FF0000",
		// 	radius: 0.2
		// });


		this.faceX.innerHTML = this.orientation.x.toFixed(2);
		this.faceY.innerHTML = this.orientation.y.toFixed(2);

		// const orientation = {
			// 	x: results.multiFaceLandmarks[0][1].x - 0.57,
			// 	y: results.multiFaceLandmarks[0][1].y - 0.57
			// };
			// window.GAZE_ORIENTATION.x = orientation.x;
			// window.GAZE_ORIENTATION.y = orientation.y;
			// previewCoords.innerText =
			// 	orientation.x.toFixed(2) + " , " + orientation.y.toFixed(2);
			// let dir = "";
			// if (orientation.y < -0.04) dir += "up ";
			// if (orientation.y > 0.04) dir += "down ";
			// if (orientation.x < -0.05) dir += "right";
			// if (orientation.x > 0.05) dir += "left";
			// previewDir.innerText = dir;
		//}
		this.canvasCtx.restore();
	}
}
