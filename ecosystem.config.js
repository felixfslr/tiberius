// PM2 process definition for the Tiberius file-processing worker.
//
// Start:    pm2 start ecosystem.config.js
// Reload:   pm2 reload tiberius-worker
// Logs:     pm2 logs tiberius-worker
// Persist:  pm2 save  (then `pm2 startup` if not yet done)

module.exports = {
  apps: [
    {
      name: "tiberius-worker",
      script: "dist-worker/index.mjs",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      interpreter: "node",
      node_args: "--enable-source-maps --env-file=.env.production",
      env: {
        NODE_ENV: "production",
      },
      error_file: "logs/worker.err.log",
      out_file: "logs/worker.out.log",
      time: true,
      max_memory_restart: "512M",
    },
  ],
};
