import mongoose from 'mongoose';
import Config from './../config';

interface IProductImage {
  url: string;
  description: string;
}

type img = string | Object;

interface IProduct {
  name: string;
  description: string;
  price: string;
  link: string;
  images: IProductImage[];
  creatorName: string;
  mainImage: mongoose.Schema.Types.Mixed;
  id_2: string;
  store: string;
  category: string;
}

const ProductSchema = new mongoose.Schema<IProduct>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: String, required: true },
    link: { type: String, default: '' },
    id_2: { type: String },
    store: { type: String },
    category: { type: String },
    images: [
      {
        url: { type: String },
        description: { type: String, default: '' },
      },
    ],
    creatorName: { type: String },
    mainImage: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    collection: 'products',
    timestamps: true,
  }
);

const db = mongoose.connection.useDb(Config.getInstance().databases.main, { useCache: true });
const Product = db.model<IProduct>('Product', ProductSchema);

type ProductDoc = ReturnType<(typeof Product)['hydrate']>;

export { Product, ProductDoc, IProduct };
