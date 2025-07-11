module.exports = {
    apps: [{
        name: 'auto-scheduler',
        script: './scheduler.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'production'
        },
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_file: './logs/combined.log',
        time: true
    }]
};
