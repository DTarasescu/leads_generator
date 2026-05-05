module.exports = {
  apps: [{
    name: 'leads-generator',
    script: 'node_modules/.bin/next',
    args: 'start -p 3400',
    cwd: '/var/www/leads_generator',
    env: {
      NODE_ENV: 'production',
      PORT: 3400,
    },
    max_restarts: 5,
    restart_delay: 3000,
    error_file: '/var/log/leads-generator/error.log',
    out_file: '/var/log/leads-generator/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
