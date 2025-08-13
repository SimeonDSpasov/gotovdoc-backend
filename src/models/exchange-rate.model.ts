import mongoose, { Document, Schema } from 'mongoose';

import Config from './../config';

interface IExchangeRate extends Document {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  updatedAt: Date;
}

const exchangeRateSchema = new Schema<IExchangeRate>({
  baseCurrency: { type: String, required: true },
  targetCurrency: { type: String, required: true },
  rate: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for faster lookups
exchangeRateSchema.index({ baseCurrency: 1, targetCurrency: 1 }, { unique: true });

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const ExchangeRate = db.model<IExchangeRate>('exchange-rate', exchangeRateSchema);

type ExchangeRateDoc = ReturnType<(typeof ExchangeRate)['hydrate']>;

export { ExchangeRate, ExchangeRateDoc, IExchangeRate };
