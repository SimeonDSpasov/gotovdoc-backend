import { ErrorRequestHandler } from 'express';

import CustomError from './../utils/custom-error.utils';

export default class ErrorMiddleware {

 public init: ErrorRequestHandler = (err: CustomError, req, res, next) => {
  this.log(err);

  const status = err.status || 500;
  let message = err.message || 'Something went wrong. Please try again later.';

  if (err.status === 500) {
   message = 'Internal Server Error.';
  }

  res.status(status).send({ message });
 }

 private log(err: CustomError): void {
  if (err.source) {
   logger.error(err.message, err.source, err.sendEmail);
  }
 }

}
