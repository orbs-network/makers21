// based on:
// https://google.github.io/mediapipe/solutions/face_mesh.html#resources
// https://github.com/tensorflow/tfjs-models/tree/master/face-landmarks-detection

// Our input frames will come from here.
const videoElement = document.getElementsByClassName("input_video")[0];
const canvasElement = document.getElementsByClassName("output_canvas")[0];
const canvasCtx = canvasElement.getContext("2d");
const previewCoords = document.getElementById("preview-coords");
const previewDir = document.getElementById("preview-dir");

function onResults(results) {
  // Hide the spinner.
  document.body.classList.add("loaded");

  // Draw the overlays.
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      window.drawConnectors(canvasCtx, landmarks, window.FACEMESH_TESSELATION, {
        color: "#00FFA0",
        lineWidth: 0.2
      });
    }
    // this landmark is the tip of the nose
    drawLandmarks(canvasCtx, [results.multiFaceLandmarks[0][1]], {
     color: "#FF0000",
     radius: 0.2
    });
    const orientation = {
      x: results.multiFaceLandmarks[0][1].x, //- 0.57,
      y: results.multiFaceLandmarks[0][1].y, //- 0.57
    };
    window.GAZE_ORIENTATION.x = orientation.x;
    window.GAZE_ORIENTATION.y = orientation.y;
    previewCoords.innerText =
      orientation.x.toFixed(2) + " , " + orientation.y.toFixed(2);
    // let dir = "";
    // if (orientation.y < -0.04) dir += "up ";
    // if (orientation.y > 0.04) dir += "down ";
    // if (orientation.x < -0.05) dir += "right";
    // if (orientation.x > 0.05) dir += "left";
    // previewDir.innerText = dir;
  }
  canvasCtx.restore();
}

const faceMesh = new window.FaceMesh({
  locateFile: file => {
    console.log("file", file);
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.1/${file}`;
  }
});
faceMesh.onResults(onResults);

// Instantiate a camera. We'll feed each frame we receive into the solution.
const camera = new window.Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
  width: 1280,
  height: 720
});

//camera.start();
