const path = require('path');

module.exports = {
  apps: [
    {
      name: 'monte-moria-api',
      script: 'apps/api/dist/src/main.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      log_file: 'logs/api-combined.log',
      time: true,
    },
    {
      name: 'monte-moria-web',
      script: path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: ['start', '-p', '3000'],
      cwd: path.join(__dirname, 'apps', 'web'),
      exec_interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/web-error.log',
      out_file: 'logs/web-out.log',
      log_file: 'logs/web-combined.log',
      time: true,
    },
  ],
};
