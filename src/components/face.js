// based on:
// https://google.github.io/mediapipe/solutions/face_mesh.html#resources
// https://github.com/tensorflow/tfjs-models/tree/master/face-landmarks-detection
class Face  {

    //////////////////////////////////////////////////////////
    constructor(){
        //this.drawVideo = false;
        // Our input frames will come from here.
        //const videoElement = document.getElementsByClassName("input_video")[0];
        //<video style="display: none;" class="input_video"></video>
        this.video = document.createElement("video");
        this.video.className = "input_video";
        this.video.style.display = "none";
        document.body.appendChild(this.video);

        this.faceX = document.getElementById('face-x');
        this.faceY = document.getElementById('face-y');
        this.faceDisplay = document.getElementById('face-display');
        if (this.faceDisplay) {
            this.faceDisplay.style.display = 'block';
            // Toggle button
            const toggle = document.getElementById('face-toggle');
            if (toggle) {
                toggle.addEventListener('click', () => {
                    const canvas = document.getElementById('face-canvas');
                    const hidden = canvas.style.display === 'none';
                    canvas.style.display = hidden ? '' : 'none';
                    toggle.textContent = hidden ? 'Hide' : 'Show';
                });
            }
        }

        this.ret = {};


        //const canvasElement = document.getElementsByClassName("output_canvas")[0];
        //<canvas style="position: fixed; height: 144px; width: 256px; left: 0; top: 0; transform: scale(-1, 1);" class="output_canvas" width="256px" height="144px"></canvas>
        // this.canvas = document.createElement("canvas");
        // this.canvas.cssText = "position: fixed; height: 144px; width: 256px; left: 0; top: 0; transform: scale(-1, 1);";
        this.canvas = document.getElementById('face-canvas');
        //document.body.appendChild(this.canvas);

        this.canvasCtx = this.canvas ? this.canvas.getContext("2d") : null;
        // const previewCoords = document.getElementById("preview-coords");
        // const previewDir = document.getElementById("preview-dir");

        this.orientation = {x:0,y:0};
        this.center = {x:0,y:0};
    }
    //////////////////////////////////////////////////////////
    // Returns a Promise that resolves when face detection is ready
    // Also supports legacy callback pattern for backward compatibility
    startCamera(cb) {
        return new Promise((resolve) => {
            // Check if FaceMesh library is available
            if (!window.FaceMesh || !window.Camera) {
                console.warn('FaceMesh or Camera not available - face tracking disabled');
                this.enabled = false;
                resolve();
                return;
            }

            this.enabled = true;
            this.onReady = () => {
                if (cb) cb();
                resolve();
            };

            this.faceMesh = new window.FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`;
                },
            });

            this.faceMesh.onResults(this.onResults.bind(this));

            // Instantiate a camera. We'll feed each frame we receive into the solution.
            const camera = new window.Camera(this.video, {
                onFrame: async () => {
                    await this.faceMesh.send({ image: this.video });
                },
                width: 1280,
                height: 720,
            });
            camera.start().then(() => {
                console.log('Face tracking: camera started successfully');
            }).catch((err) => {
                console.error('Face tracking: camera failed to start:', err);
                this.enabled = false;
                resolve();
            });
        });
    }
    //////////////////////////////////////////////////////////
    captureCenterXY(){
        this.center.x = this.orientation.x;
        this.center.y = this.orientation.y;
    }
    getDelta(){
        // Return zero delta if face tracking is disabled
        if (!this.enabled) {
            return { x: 0, y: 0 };
        }
        // x gimble, constraint on range of left/right
        let x = this.orientation.x - this.center.x;

        // limit left right look
        if(config.maxFaceX){
            const ax = Math.abs(x);
            if(ax >= config.maxFaceX){
                const sign = ax / x;
                x = config.maxFaceX * sign;
            }
        }

        this.ret.x = x;
        this.ret.y = this.orientation.y - this.center.y;
        return this.ret;
    }
    //////////////////////////////////////////////////////////
    draw(results) {
        if (!this.canvasCtx || !this.canvas) return;

        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            this.canvasCtx.restore();
            return;
        }

        // Compute bounding box of face landmarks (normalized 0-1 coords)
        const landmarks = results.multiFaceLandmarks[0];
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (const lm of landmarks) {
            if (lm.x < minX) minX = lm.x;
            if (lm.x > maxX) maxX = lm.x;
            if (lm.y < minY) minY = lm.y;
            if (lm.y > maxY) maxY = lm.y;
        }
        const bw = maxX - minX;
        const bh = maxY - minY;
        if (bw === 0 || bh === 0) { this.canvasCtx.restore(); return; }

        // Remap landmarks so face is centered and scaled to ~80% of canvas
        const fillRatio = 0.65;
        const scale = Math.min(fillRatio / bw, fillRatio / bh);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        const remapped = results.multiFaceLandmarks.map(face =>
            face.map(lm => ({
                x: (lm.x - cx) * scale + 0.5 + (50 / this.canvas.width),
                y: (lm.y - cy) * scale + 0.45,
                z: lm.z,
            }))
        );

        // grid face
        for (const lm of remapped) {
            window.drawConnectors(this.canvasCtx, lm, window.FACEMESH_TESSELATION, {
                color: "#00FFA0",
                lineWidth: 0.2
            });
        }
        // this landmark is the tip of the nose
        drawLandmarks(this.canvasCtx, [remapped[0][1]], {
            color: "#880000",
            radius: 0.2
        });
        this.canvasCtx.restore();

        // update x, y
        if (this.faceX) this.faceX.innerHTML = this.orientation.x.toFixed(2);
        if (this.faceY) this.faceY.innerHTML = this.orientation.y.toFixed(2);
    }
    //////////////////////////////////////////////////////////
    onResults(results) {
        if(!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0)
            return;

        if(this.onReady){
            this.onReady();
            this.onReady = null;
        }

        // from nose (center)
        this.orientation.x = results.multiFaceLandmarks[0][1].x;
        this.orientation.y = results.multiFaceLandmarks[0][1].y;

        if(this.faceDisplay && this.faceDisplay.style.display !== 'none'){
            this.draw(results);
        }
    }
}

window.Face = Face;
