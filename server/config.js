module.exports = {
  port: 4000,
  roomCleanupInterval: 60_000,       // check for empty rooms every 60s
  roomEmptyTimeout: 5 * 60_000,      // delete empty rooms after 5 min

  // Capacity caps — enforced in server, surfaced in lobby UI
  maxTeamSize: 4,                    // 4 + 4 = 8 players per room
  maxRooms: 8,                       // active rooms across the server
  maxConcurrentPlayers: 64,          // total live players across all rooms (8 rooms × 8 players)

  mediasoup: {
    numWorkers: 1,
    worker: {
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
      logLevel: 'warn',
    },
    webRtcTransport: {
      // mediasoup binds to 0.0.0.0 but needs the public reachable IP to
      // advertise in ICE candidates. On EC2, set ANNOUNCED_IP to the
      // instance's Elastic IP. Falls back to null for local dev.
      listenInfos: [
        { protocol: 'udp', ip: '0.0.0.0', announcedAddress: process.env.ANNOUNCED_IP || null },
        { protocol: 'tcp', ip: '0.0.0.0', announcedAddress: process.env.ANNOUNCED_IP || null },
      ],
      numSctpStreams: { OS: 1024, MIS: 1024 },
    },
  },
};
