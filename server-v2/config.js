module.exports = {
  port: 4000,
  roomCleanupInterval: 60_000,       // check for empty rooms every 60s
  roomEmptyTimeout: 5 * 60_000,      // delete empty rooms after 5 min
  maxTeamSize: 6,

  mediasoup: {
    numWorkers: 1,
    worker: {
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
      logLevel: 'warn',
    },
    webRtcTransport: {
      listenInfos: [
        { protocol: 'udp', ip: '0.0.0.0', announcedAddress: null },
        { protocol: 'tcp', ip: '0.0.0.0', announcedAddress: null },
      ],
      numSctpStreams: { OS: 1024, MIS: 1024 },
    },
  },
};
