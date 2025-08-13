const scriptApp = '/home/ec2-user/backend/app.js';
const scriptWorker = '/home/ec2-user/backend/worker.js';

const env_test = {
  NODE_ENV: 'production',
  Project_ENV: 'test'
};

const env_prod = {
  NODE_ENV: 'production',
  Project_ENV: 'prod'
};

module.exports = {
  apps: [

    // Worker 1 – Small Orders
    {
      name: 'worker-1',
      script: scriptWorker,
      exec_mode: 'fork',
      instances: 1,
      env_test,
      env_prod,
      env: {
        WORKER_ID: 'worker-1',
        PREFER_LARGE_ORDERS: 'false',
      },
      interpreter: 'node',
      interpreter_args: '--max-old-space-size=6144', // 6GB RAM
    },

    // Worker 2 – Small Orders
    {
      name: 'worker-2',
      script: scriptWorker,
      exec_mode: 'fork',
      instances: 1,
      env_test,
      env_prod,
      env: {
        WORKER_ID: 'worker-2',
        PREFER_LARGE_ORDERS: 'false',
      },
      interpreter: 'node',
      interpreter_args: '--max-old-space-size=6144', // 6GB RAM
    },

    // Worker 3 – Big Orders
    {
      name: 'worker-3',
      script: scriptWorker,
      exec_mode: 'fork',
      instances: 1,
      env_test,
      env_prod,
      env: {
        WORKER_ID: 'worker-3',
        PREFER_LARGE_ORDERS: 'true',
      },
      interpreter: 'node',
      interpreter_args: '--max-old-space-size=12288', // 12GB RAM
    },

    // App 1 – Cronjobs YES
    {
      name: 'app-1',
      script: scriptApp,
      exec_mode: 'cluster',
      instances: 1,
      env_test,
      env_prod,
      interpreter: 'node',
      interpreter_args: '--max-old-space-size=2048', // 2GB RAM
    },

    // App 2 – Cronjobs NO
    {
      name: 'app-2',
      script: scriptApp,
      exec_mode: 'cluster',
      instances: 1,
      env_test,
      env_prod,
      interpreter: 'node',
      interpreter_args: '--max-old-space-size=2048', // 2GB RAM
    }

  ],
};
