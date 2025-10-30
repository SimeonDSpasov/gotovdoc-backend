const scriptApp = './dist/app.js';
const scriptWorker = './dist/worker.js';

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
      script: scriptApp,
      exec_mode: 'fork',
      instances: 1,
      env_test,
      env_prod,
      env: {
        WORKER_ID: 'worker-1',
      },
      interpreter: 'node',
      interpreter_args: '--max-old-space-size=4096',
    },

    // Worker 2 – Small Orders
    {
      name: 'worker-2',
      script: scriptApp,
      exec_mode: 'fork',
      instances: 1,
      env_test,
      env_prod,
      env: {
        WORKER_ID: 'worker-2',
      },
      interpreter: 'node',
      interpreter_args: '--max-old-space-size=4096',
    },
  ],
};
