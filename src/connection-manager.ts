import mongoose from 'mongoose';
import EventEmitter from 'events';
import logger from '@ipi-soft/logger';

import Config from './config';

EventEmitter.defaultMaxListeners = 0;

export default class ConnectionManager extends EventEmitter {

  public isConnected = false;

  private config = Config.getInstance();

  public async initConnections(): Promise<void> {
    mongoose.set('strictQuery', true);

    const uri = process.env.MONGODB_URI || '';
    if (!uri) {
      throw new Error('MONGODB_URI env variable is not set');
    }

    mongoose.connection.on('error', err => logger.error(err, 'DB Connection Runtime Error'));

    await mongoose.connect(uri);

    this.isConnected = true;

    this.emit('connectionEstablished');

  }

  public getConnection(): mongoose.Connection {
    return mongoose.connection;
  }

  private static instance: ConnectionManager;

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }

    return ConnectionManager.instance;
  }

}
