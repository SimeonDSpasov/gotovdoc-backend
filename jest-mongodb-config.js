module.exports = {
  mongodbMemoryServerOptions: {
    binary: {
      version: '7.0.11',
      skipMD5: true,
    },
    instance: {
      dbName: 'kst-main-dev',
    },
    autoStart: false,
  },
};
