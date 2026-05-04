const mediasoup = require('mediasoup');
const os = require('os');
const config = require('../config');

class MediasoupManager {
  constructor() {
    this.workers = [];
    this.nextWorkerIdx = 0;
  }

  async init() {
    const numWorkers = config.mediasoup.numWorkers || 1;
    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
        logLevel: config.mediasoup.worker.logLevel,
      });

      worker.on('died', () => {
        console.error('mediasoup Worker died, pid:', worker.pid);
        // In production you'd want to restart, for now just log
      });

      this.workers.push(worker);
      console.log(`mediasoup Worker created [pid:${worker.pid}]`);
    }
  }

  getNextWorker() {
    const worker = this.workers[this.nextWorkerIdx];
    this.nextWorkerIdx = (this.nextWorkerIdx + 1) % this.workers.length;
    return worker;
  }

  async createRouter() {
    const worker = this.getNextWorker();
    // Data-channels only — no media codecs needed
    const router = await worker.createRouter({ mediaCodecs: [] });
    return router;
  }

  async createWebRtcTransport(router) {
    const transport = await router.createWebRtcTransport({
      listenInfos: config.mediasoup.webRtcTransport.listenInfos,
      enableSctp: true,
      numSctpStreams: config.mediasoup.webRtcTransport.numSctpStreams,
    });

    return {
      transport,
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
      },
    };
  }

  async createDirectTransport(router) {
    const transport = await router.createDirectTransport();
    return transport;
  }

  async close() {
    for (const worker of this.workers) {
      worker.close();
    }
    this.workers = [];
  }
}

module.exports = MediasoupManager;
