import { ObjectId } from 'mongodb';
import { Request, RequestHandler } from 'express';

import CustomError from './../utils/custom-error.utils';
import FileStorageUtil from './../utils/file-storage.util';

import DocumentDataLayer from './../data-layers/document.data-layer';
import OrderDataLayer from './../data-layers/order.data-layer';
import mongoose from 'mongoose';

export default class AdminController {

    private logContext = 'Admin Controller';

    private orderDataLayer = OrderDataLayer.getInstance();
    private documentDataLayer = DocumentDataLayer.getInstance();
    private fileStorageUtil = FileStorageUtil.getInstance();

    /**
     * GET /api/admin/orders
     * Fetch all orders with optional filtering
     */
    public getAllOrders: RequestHandler = async (req, res, next) => {
        const logContext = `${this.logContext} -> getAllOrders()`;

        try {
            const { status } = req.query;

            const filter: any = {};
            if (status) {
                filter.status = status;
            }

            const orders = await this.orderDataLayer.getAll(filter, logContext);

            const documentIds = orders
                .filter(order => order.documentId)
                .map(order => order.documentId!.toString());

            const documentEntries = await Promise.allSettled(
                documentIds.map(id => this.documentDataLayer.getById(id, logContext))
            );

            const documentMap = new Map<string, any>();
            documentEntries.forEach((entry) => {
                if (entry.status === 'fulfilled') {
                    documentMap.set(entry.value._id.toString(), entry.value);
                }
            });

            const ordersWithDetails = orders.map((order) => {
                const orderObj = order.toObject();
                const document = order.documentId ? documentMap.get(order.documentId.toString()) : null;
                const userUploadedFiles = this.getUserUploadedFiles(orderObj, req);

                return {
                    ...orderObj,
                    document,
                    userUploadedFiles,
                };
            });

            res.status(200).json({
                success: true,
                data: ordersWithDetails,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * GET /api/admin/orders/:id
     * Fetch single order with associated documents
     */
    public getOrderById: RequestHandler = async (req, res, next) => {
        const logContext = `${this.logContext} -> getOrderById()`;

        try {
            const { id } = req.params;

            const order = await this.orderDataLayer.getById(id, logContext);

            // Fetch associated document if exists
            let document = null;
            if (order.documentId) {
                try {
                    document = await this.documentDataLayer.getById(order.documentId, logContext);
                } catch (err) {
                    // Document might not exist, continue without it
                }
            }

            res.status(200).json({
                success: true,
                data: {
                    order,
                    document,
                    userUploadedFiles: this.getUserUploadedFiles(order.toObject(), req),
                },
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * PATCH /api/admin/orders/:id
     * Update order details (status, notes, etc.)
     */
    public updateOrder: RequestHandler = async (req, res, next) => {
        const logContext = `${this.logContext} -> updateOrder()`;

        try {
            const { id } = req.params;
            const updateData = req.body;

            // Validate allowed fields
            const allowedFields = ['status', 'documentsGenerated', 'documentsSent'];
            const update: any = {};

            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    update[field] = updateData[field];
                }
            }

            // If marking as ready (documentsGenerated), update timestamp
            if ((update.status === 'paid' || update.status === 'finished') && !update.documentsGenerated) {
                update.documentsGenerated = true;
            }

            const updatedOrder = await this.orderDataLayer.update(id, update, logContext);

            res.status(200).json({
                success: true,
                data: updatedOrder,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * POST /api/admin/orders/:id/upload
     * Upload files/documents for an order
     */
    public uploadOrderFiles: RequestHandler = async (req, res, next) => {
        const logContext = `${this.logContext} -> uploadOrderFiles()`;

        try {
            const { id } = req.params;

            // Verify order exists
            const order = await this.orderDataLayer.getById(id, logContext);

            // Files are available in req.files (handled by multer middleware)
            const files = req.files as Express.Multer.File[];

            if (!files || files.length === 0) {
                throw new CustomError(400, 'No files uploaded');
            }

            // Store file information
            const uploadedFiles = files.map(file => ({
                filename: file.filename,
                originalName: file.originalname,
                path: file.path,
                size: file.size,
                mimetype: file.mimetype,
            }));

            // Update order to mark documents as generated
            await this.orderDataLayer.update(id, {
                $set: {
                    documentsGenerated: true,
                },
                $push: {
                    finishedFiles: {
                        $each: uploadedFiles,
                    },
                },
            }, logContext);

            res.status(200).json({
                success: true,
                data: {
                    files: uploadedFiles,
                    message: 'Files uploaded successfully',
                },
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * GET /api/admin/orders/:id/uploads/:fileId
     * Download a user-uploaded file (stored in GridFS)
     */
    public downloadOrderUpload: RequestHandler = async (req, res, next) => {
        const logContext = `${this.logContext} -> downloadOrderUpload()`;

        try {
            const { id, fileId } = req.params;

            if (!fileId) {
                throw new CustomError(400, 'Missing fileId');
            }

            if (!ObjectId.isValid(fileId)) {
                throw new CustomError(400, 'Invalid fileId');
            }

            const order = await this.orderDataLayer.getById(id, logContext);
            const orderObj = order.toObject();

            const userUploads = this.getUserUploadedFiles(orderObj, req);
            const target = userUploads.find(upload => upload.fileId === fileId);

            if (!target) {
                throw new CustomError(404, 'File not found on order');
            }

            const fileStream = await this.fileStorageUtil.downloadFile((fileId));

            res.setHeader('Content-Type', target.mimetype || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${target.filename || 'download'}"`);

            fileStream.pipe(res);
        } catch (err) {
            next(err);
        }
    };

    private getUserUploadedFiles(order: any, req: Request): Array<{
        fileId: string;
        filename?: string;
        mimetype?: string;
        size?: number;
        downloadUrl: string;
    }> {
        const uploads: Array<any> = [];
        const items = Array.isArray(order.items) ? order.items : [];

        if (Array.isArray(order.userUploadedFiles)) {
            order.userUploadedFiles.forEach((file: any) => uploads.push(file));
        }

        items.forEach((item : any) => {
            const itemUploads = item?.formData?.uploadedFiles;
            if (Array.isArray(itemUploads)) {
                itemUploads.forEach((file: any) => uploads.push(file));
            }
        });

        const uniqueById = new Map<string, any>();
        uploads.forEach((file) => {
            const fileId = file?.fileId?.toString ? file.fileId.toString() : String(file.fileId);
            if (fileId) uniqueById.set(fileId, file);
        });

        return Array.from(uniqueById.entries()).map(([fileId, file]) => ({
            fileId,
            filename: file?.filename,
            mimetype: file?.mimetype,
            size: file?.size,
            downloadUrl: `${req.protocol}://${req.get('host')}/api/admin/orders/${order._id}/uploads/${fileId}`,
        }));
    }

    /**
     * GET /api/admin/stats
     * Get admin dashboard statistics
     */
    public getStats: RequestHandler = async (req, res, next) => {
        const logContext = `${this.logContext} -> getStats()`;

        try {
            const allOrders = await this.orderDataLayer.getAll({}, logContext);

            const stats = {
                totalOrders: allOrders.length,
                pendingOrders: allOrders.filter(o => o.status === 'pending').length,
                paidOrders: allOrders.filter(o => o.status === 'paid' || o.status === 'finished').length,
                failedOrders: allOrders.filter(o => o.status === 'failed').length,
                processingOrders: allOrders.filter(o => o.status === 'processing').length,
                totalRevenue: allOrders
                    .filter(o => o.status === 'paid' || o.status === 'finished')
                    .reduce((sum, o) => sum + (o.paidAmount || 0), 0),
                ordersNeedingDocuments: allOrders.filter(
                    o => (o.status === 'paid' || o.status === 'finished') && !o.documentsGenerated
                ).length,
            };

            res.status(200).json({
                success: true,
                data: stats,
            });
        } catch (err) {
            next(err);
        }
    };

    private static instance: AdminController;

    public static getInstance(): AdminController {
        if (!AdminController.instance) {
            AdminController.instance = new AdminController();
        }

        return AdminController.instance;
    }

}
