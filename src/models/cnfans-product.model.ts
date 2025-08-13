import mongoose from 'mongoose';
import Config from './../config';

interface ICNFansProduct {
  id_2: string;
  title: string;
  images: string[];
  price: number;
}

const CNFansProductSchema = new mongoose.Schema<ICNFansProduct>(
  {
    id_2: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    images: [{ type: String }],
    price: { type: Number, required: true },
  },
  {
    collection: 'cnfans_products',
    timestamps: true,
  }
);

const db = mongoose.connection.useDb(Config.getInstance().databases.main, { useCache: true });
const CNFansProduct = db.model<ICNFansProduct>('CNFansProduct', CNFansProductSchema);

type CNFansProductDoc = ReturnType<(typeof CNFansProduct)['hydrate']>;

export { CNFansProduct, CNFansProductDoc, ICNFansProduct }; 