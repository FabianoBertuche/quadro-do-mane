module.exports = {
  apps: [
    {
      name: 'quadro-api',
      script: './apps/api/dist/main.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 'max',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
        API_PORT: '3001',
      },
      env_development: {
        NODE_ENV: 'development',
        API_PORT: '3001',
      },
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      log_file: 'logs/api-combined.log',
      time: true,
    },
  ],
  restart_policy: {
    auto_restart: true,
    max_restarts: 10,
  },
};