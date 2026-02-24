import { EmailType, EmailUtil } from './../src/utils/email.util';

const recipientEmail = 'thegamefan36@gmail.com';

const sampleEmails = [
 {
  subject: 'Добре дошли',
  template: 'welcome',
  payload: {
   email: recipientEmail,
   firstName: 'Alex',
   lastName: 'Petrov',
  },
 },
 {
  subject: 'Паролата е променена',
  template: 'change-password',
  payload: {
   email: recipientEmail,
   firstName: 'Alex',
   lastName: 'Petrov',
  },
 },
 {
  subject: 'Заявка за смяна на парола',
  template: 'reset-password-request',
  payload: {
   email: recipientEmail,
   firstName: 'Alex',
   lastName: 'Petrov',
   resetPasswordLink: 'https://gotovdoc.bg/reset-password?token=sample-token',
  },
 },
 {
  subject: 'Паролата е променена успешно',
  template: 'reset-password-success',
  payload: {
   email: recipientEmail,
   firstName: 'Alex',
   lastName: 'Petrov',
  },
 },
 {
  subject: 'Документът е генериран',
  template: 'document-generated',
  payload: {
   fullName: 'Alex Petrov',
   companyName: 'Sample Company Ltd.',
   documentName: 'Спесимент',
  },
  attachments: [
   {
    filename: 'sample-document.pdf',
    content: Buffer.from('%PDF-1.4\n%Sample PDF\n', 'utf8'),
    contentType: 'application/pdf',
   },
  ],
 },
 {
  subject: 'Контактна форма',
  template: 'contact-us',
  payload: {
   name: 'Alex Petrov',
   email: recipientEmail,
   phoneNumber: '+359 88 123 4567',
   message: 'Здравейте! Това е примерен имейл от контактната форма.',
  },
 },
 {
  subject: 'Нова поръчка',
  template: 'new-order',
  payload: {
   orderId: 'ORD-123456-789',
   createdAt: new Date().toLocaleString('bg-BG'),
   customerName: 'Alex Petrov',
   customerEmail: recipientEmail,
   customerPhone: '+359 88 123 4567',
   companyName: 'Sample Company Ltd.',
   companyEik: '123456789',
   notes: 'Моля, обработете поръчката възможно най-скоро.',
   includeRegistration: 'Да',
   deliveryMethod: 'Качени файлове',
   hasUploads: true,
   downloadAllUrl: 'https://gotovdoc.bg/api/capital-revaluation/order/ORD-123456-789/uploads',
   uploadedFiles: [
    {
     filename: 'document-1.pdf',
     size: 245678,
     mimetype: 'application/pdf',
     downloadUrl: 'https://gotovdoc.bg/api/capital-revaluation/order/ORD-123456-789/uploads/abc123',
    },
    {
     filename: 'notes.txt',
     size: 2048,
     mimetype: 'text/plain',
     downloadUrl: 'https://gotovdoc.bg/api/capital-revaluation/order/ORD-123456-789/uploads/def456',
    },
   ],
  },
 },
 {
  subject: 'Системна грешка',
  template: 'error',
  payload: {
   context: 'Sample job runner',
   errorMessage: 'Example error message for testing email rendering.',
   stackTrace: 'Error: Example error\n    at SampleModule (sample.ts:10:5)',
  },
 },
 {
  subject: 'Административна грешка',
  template: 'admin-error-notification',
  payload: {
   level: 'critical',
   errorMessage: 'Database connection failed',
   errorType: 'MongoNetworkError',
   errorCode: 'ECONNREFUSED',
   timestamp: new Date().toISOString(),
   environment: 'dev',
   requestMethod: 'POST',
   requestUrl: 'https://gotovdoc.bg/api/orders',
   requestIp: '192.168.0.10',
   requestBody: '{"orderId":"123","amount":99.99}',
   userId: '64f1c2d3e4b5a6c7d8e9f0a1',
   userEmail: recipientEmail,
   stackTrace: 'MongoNetworkError: connection failed\n    at connect (mongo.ts:45:3)',
   additionalContext: 'Triggered during nightly reconciliation.',
  },
 },
];

const run = async (): Promise<void> => {
 const emailUtil = EmailUtil.getInstance();

 for (const emailData of sampleEmails) {
  console.log(`Sending ${emailData.template} to ${recipientEmail}...`);
  await emailUtil
   .sendEmail(
    {
     toEmail: recipientEmail,
     subject: emailData.subject,
     template: emailData.template,
     payload: emailData.payload,
     attachments: emailData.attachments,
    },
    EmailType.Info,
    'scripts/send-sample-emails'
   )
   .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to send ${emailData.template}: ${message}`);
   });
 }
};

run().catch((error) => {
 const message = error instanceof Error ? error.message : String(error);
 console.error(`Sample email script failed: ${message}`);
 process.exit(1);
});
