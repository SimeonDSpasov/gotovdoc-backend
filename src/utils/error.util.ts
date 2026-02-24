export default class ErrorUtil extends Error {

 constructor(status: number, message: string, source?: string, sendEmail = false) {
  super(message);

  this.status = status;
  this.message = message;

  if (source) {
   this.source = source;
   this.sendEmail = sendEmail;
  }
 }

 public status: number;
 public message: string;
 public source?: string;
 public sendEmail?: boolean;

}
