import mongoose, { FilterQuery, UpdateQuery } from 'mongoose';

import CustomError from './../utils/custom-error.utils';

import { Document, DocumentDoc, IDocument } from './../models/document.model';

export default class DocumentDataLayer {

 private logContext = 'Document Data Layer';

 public async create(data: Partial<IDocument>, logContext: string): Promise<DocumentDoc> {
  logContext = `${logContext} -> ${this.logContext} -> create()`;

  const document = await Document.create(data)
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> data: ${JSON.stringify(data)}`);
   });

  return document;
 }

 public async get(filter: FilterQuery<IDocument>, logContext: string): Promise<DocumentDoc> {
  logContext = `${logContext} -> ${this.logContext} -> get()`;

  const document = await Document.findOne(filter)
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> filter: ${JSON.stringify(filter)}`);
   });

  if (!document) {
   throw new CustomError(404, `No document found`);
  }

  return document;
 }

 public async getById(id: string | mongoose.Types.ObjectId, logContext: string): Promise<DocumentDoc> {
  logContext = `${logContext} -> ${this.logContext} -> getById()`;

  if (!mongoose.isValidObjectId(id)) {
   throw new CustomError(400, `Invalid ID`);
  }

  const document = await Document.findById(id)
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> id: ${id.toString()}`);
   });

  if (!document) {
   throw new CustomError(404, `No document found`);
  }

  return document;
 }

 public async getAll(filter: FilterQuery<IDocument>, logContext: string): Promise<DocumentDoc[]> {
  logContext = `${logContext} -> ${this.logContext} -> getAll()`;

  const documents = await Document.find(filter)
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> filter: ${JSON.stringify(filter)}`);
   });

  return documents;
 }

 public async update(id: string | mongoose.Types.ObjectId, update: UpdateQuery<IDocument>, logContext: string): Promise<DocumentDoc> {
  logContext = `${logContext} -> ${this.logContext} -> update()`;

  if (!mongoose.isValidObjectId(id)) {
   throw new CustomError(400, `Invalid ID`);
  }

  const document = await Document.findByIdAndUpdate(id, update, { new: true })
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> findByIdAndUpdate() -> id: ${id.toString()} | update: ${JSON.stringify(update)}`);
   });

  if (!document) {
   throw new CustomError(404, `No document found`);
  }

  return document;
 }

 public async updateByFilter(filter: FilterQuery<IDocument>, update: UpdateQuery<IDocument>, logContext: string): Promise<DocumentDoc> {
  logContext = `${logContext} -> ${this.logContext} -> updateByFilter()`;

  const document = await Document.findOneAndUpdate(filter, update, { new: true })
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> findOneAndUpdate() -> filter: ${JSON.stringify(filter)} | update: ${JSON.stringify(update)}`);
   });

  if (!document) {
   throw new CustomError(404, `No document found`);
  }

  return document;
 }

 private static instance: DocumentDataLayer;

 public static getInstance(): DocumentDataLayer {
  if (!DocumentDataLayer.instance) {
   DocumentDataLayer.instance = new DocumentDataLayer();
  }

  return DocumentDataLayer.instance;
 }

}

