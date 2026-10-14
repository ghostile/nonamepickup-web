module.exports = {
  apps: [{
    name: 'tfcapi',
    cwd: '/var/www/tfcbot/api',
    script: 'api.js',
    env: {
      PORT: 4000,
      ELO_DB: '/root/tfcbot/elo.db',
      TRUST_PROXY: 'true',
      NN_MVP_SYNC_INTERVAL_MS: 60000
    }
  }]
}
