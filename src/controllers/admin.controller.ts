import { ObjectId } from 'mongodb';
import { Request, RequestHandler } from 'express';
import { Readable } from 'stream';

import CustomError from './../utils/custom-error.utils';
import FileStorageUtil from './../utils/file-storage.util';
import { EmailUtil, EmailType } from './../utils/email.util';

import DocumentDataLayer from './../data-layers/document.data-layer';
import OrderDataLayer from './../data-layers/order.data-layer';
import mongoose from 'mongoose';

export default class AdminController {

    private logContext = 'Admin Controller';

    private orderDataLayer = OrderDataLayer.getInstance();
    private documentDataLayer = DocumentDataLayer.getInstance();
    private fileStorageUtil = FileStorageUtil.getInstance();
    private emailUtil = EmailUtil.getInstance();

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

            const order = await this.orderDataLayer.getById(id, logContext);
            const updatedOrder = await this.orderDataLayer.update(id, update, logContext);

            // Send email when order is marked as finished, attaching all finishedFiles from GridFS
            if (update.status === 'finished' && Array.isArray(order.finishedFiles) && order.finishedFiles.length > 0) {
                const customerEmail = order.customerData?.email;
                if (customerEmail) {
                    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

                    for (const file of order.finishedFiles) {
                        try {
                            const stream = await this.fileStorageUtil.downloadFile(file.fileId.toString());
                            const buffer = await this.streamToBuffer(stream);
                            attachments.push({
                                filename: file.filename,
                                content: buffer,
                                contentType: file.mimetype || 'application/octet-stream',
                            });
                        } catch (err) {
                            console.error(`Failed to read finished file ${file.fileId} from GridFS: ${(err as Error).message}`);
                        }
                    }

                    const customerName = [order.customerData?.firstName, order.customerData?.lastName]
                        .filter(Boolean).join(' ') || 'клиент';

                    const itemNames = Array.isArray(order.items)
                        ? order.items.map((item: any) => item.name).join(', ')
                        : '';

                    this.emailUtil.sendEmail({
                        toEmail: customerEmail,
                        subject: `Поръчка ${order.orderId} — Вашите документи са готови`,
                        template: 'order-finished',
                        payload: {
                            customerName,
                            orderId: order.orderId,
                            itemNames,
                            hasAttachments: attachments.length > 0,
                        },
                        attachments,
                    }, EmailType.Info, logContext)
                        .catch((err: any) => console.error(`Failed to send order finished email: ${err.message}`));
                }
            }

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
     * Upload files/documents for an order (stored in GridFS)
     */
    public uploadOrderFiles: RequestHandler = async (req, res, next) => {
        const logContext = `${this.logContext} -> uploadOrderFiles()`;

        try {
            const { id } = req.params;

            // Verify order exists
            await this.orderDataLayer.getById(id, logContext);

            const files = req.files as Express.Multer.File[];

            if (!files || files.length === 0) {
                throw new CustomError(400, 'No files uploaded');
            }

            // Upload each file to GridFS
            const uploadedFiles = [];
            for (const file of files) {
                const stream = Readable.from(file.buffer);
                const fileId = await this.fileStorageUtil.uploadFile(stream, file.originalname, file.mimetype);
                uploadedFiles.push({
                    fileId,
                    filename: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                });
            }

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

    /**
     * GET /api/admin/orders/:id/finished-files/:fileId
     * Download an admin-uploaded finished file (stored in GridFS)
     */
    public downloadFinishedFile: RequestHandler = async (req, res, next) => {
        const logContext = `${this.logContext} -> downloadFinishedFile()`;

        try {
            const { id, fileId } = req.params;

            if (!fileId) {
                throw new CustomError(400, 'Missing fileId');
            }

            const order = await this.orderDataLayer.getById(id, logContext);
            const file = order.finishedFiles?.find((f: any) => f.fileId?.toString() === fileId);

            if (!file) {
                throw new CustomError(404, 'Finished file not found on order');
            }

            const fileStream = await this.fileStorageUtil.downloadFile(fileId);

            res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);

            fileStream.pipe(res);
        } catch (err) {
            next(err);
        }
    };

    /**
     * DELETE /api/admin/orders/:id/finished-files/:fileId
     * Delete an admin-uploaded finished file from GridFS and the order
     */
    public deleteFinishedFile: RequestHandler = async (req, res, next) => {
        const logContext = `${this.logContext} -> deleteFinishedFile()`;

        try {
            const { id, fileId } = req.params;

            if (!fileId) {
                throw new CustomError(400, 'Missing fileId');
            }

            const order = await this.orderDataLayer.getById(id, logContext);
            const file = order.finishedFiles?.find((f: any) => f.fileId?.toString() === fileId);

            if (!file) {
                throw new CustomError(404, 'Finished file not found on order');
            }

            // Delete from GridFS
            await this.fileStorageUtil.deleteFile(new mongoose.Types.ObjectId(fileId));

            // Remove from order's finishedFiles array
            await this.orderDataLayer.update(id, {
                $pull: { finishedFiles: { fileId: new ObjectId(fileId) } }
            }, logContext);

            // If no finished files remain, reset documentsGenerated
            const updatedOrder = await this.orderDataLayer.getById(id, logContext);
            if (!updatedOrder.finishedFiles || updatedOrder.finishedFiles.length === 0) {
                await this.orderDataLayer.update(id, { documentsGenerated: false }, logContext);
            }

            res.status(200).json({
                success: true,
                data: updatedOrder,
            });
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

    private streamToBuffer(stream: Readable): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    }

    private static instance: AdminController;

    public static getInstance(): AdminController {
        if (!AdminController.instance) {
            AdminController.instance = new AdminController();
        }

        return AdminController.instance;
    }

}
