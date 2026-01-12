import mongoose, { mongo } from 'mongoose';
import { Readable } from 'stream';
import Config from './../config';

export default class FileStorageUtil {
    private static instance: FileStorageUtil;
    private bucket: mongo.GridFSBucket | null = null;

    private constructor() {
        this.initBucket();
    }

    public static getInstance(): FileStorageUtil {
        if (!FileStorageUtil.instance) {
            FileStorageUtil.instance = new FileStorageUtil();
        }
        return FileStorageUtil.instance;
    }

    private initBucket() {
        const db = mongoose.connection.useDb(Config.getInstance().databases.main).db;
        if (db) {
            this.bucket = new mongo.GridFSBucket(db, { bucketName: 'uploads' });
        } else {
            // If connection not ready, try again later or handle error
            mongoose.connection.on('connected', () => {
                const db = mongoose.connection.useDb(Config.getInstance().databases.main).db;
                if (db) {
                    this.bucket = new mongo.GridFSBucket(db, { bucketName: 'uploads' });
                }
            });
        }
    }

    public async uploadFile(fileStream: Readable, filename: string, contentType: string): Promise<mongo.ObjectId> {
        if (!this.bucket) {
            this.initBucket();
            if (!this.bucket) throw new Error('GridFSBucket not initialized');
        }

        const uploadStream = this.bucket.openUploadStream(filename, {
            contentType,
        });

        return new Promise((resolve, reject) => {
            fileStream
                .pipe(uploadStream)
                .on('error', reject)
                .on('finish', () => {
                    resolve(uploadStream.id);
                });
        });
    }

    public async downloadFile(fileId: string): Promise<Readable> {
        if (!this.bucket) {
            this.initBucket();
            if (!this.bucket) throw new Error('GridFSBucket not initialized');
        }

        const objectId = new mongoose.Types.ObjectId(fileId);
        return this.bucket.openDownloadStream(objectId);
    }

    public async deleteFile(fileId: mongo.ObjectId): Promise<void> {
        if (!this.bucket) {
            this.initBucket();
            if (!this.bucket) throw new Error('GridFSBucket not initialized');
        }

        return this.bucket.delete(fileId);
    }
}
