import axios from 'axios';
import cron from 'node-cron';

import { Product } from './../models/product.model';

const BASE_URL = 'https://orientdigfinds.com/api/products?currency=USD&category=All';
const LIMIT = 100;

export default class ProductsCronjob {

  constructor() {
    // Run every hour
    cron.schedule('0 * * * *', () => {
      this.fetchAllProducts();
    });
  }

  private logContext = 'Replace Products Cronjob';

  public async fetchAllProducts(): Promise<void> {
    const firstResponse = await axios.get(`${BASE_URL}&page=1&limit=${LIMIT}`)
      .catch(error => {
        logger.error(`Error fetching first page: ${error.message}`, this.logContext);
      });

    if (!firstResponse) {
      logger.error('Error: Unable to retrieve first page of products from API.', this.logContext);
      return;
    }

    const { totalProducts, products: firstPageProducts } = firstResponse.data;
  
  
    if (!totalProducts) {
      logger.error('Error: Unable to retrieve totalProducts from API.', this.logContext);

      return;
    }

    const totalPages = Math.ceil(totalProducts / LIMIT);
    logger.info(`Total Products: ${totalProducts}, Total Pages: ${totalPages}`);

    let allProducts = firstPageProducts;

    for (let page = 2; page <= totalPages; page++) {
      const response = await axios.get(`${BASE_URL}&page=${page}&limit=${LIMIT}`)
        .catch(error => {
          logger.error(`Error retrieving page ${page}: ${error.message}`, this.logContext);
        });

      if (!response) {
        logger.error(`Error: Unable to retrieve page ${page} products from API.`, this.logContext);
        continue;
      }

      const products = response.data.products;
      if (products && products.length > 0) {
        allProducts = allProducts.concat(products);
      } else {
        logger.info(`Page ${page} has no products.`);
      }
    }

    const transformedProducts = allProducts.map((product: any) => new Product(transformProduct(product)));

    await Product.deleteMany({})
      .catch(err => {
        logger.error(`Error deleting products collection: ${err.message}`, this.logContext);
      });

    const chunkArray = (arr: any[], size: number): any[][] => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    const batches = chunkArray(transformedProducts, 100);
    let totalInserted = 0;

    for (const batch of batches) {
      const insertedProducts = await Product.insertMany(batch)
        .catch(err => {
          console.log(err);
        })

      if (!insertedProducts) {
        continue;
      }

      totalInserted += insertedProducts.length;
      logger.info(`Inserted batch of ${insertedProducts.length} products.`);
    }

    logger.info(`Replaced products collection with ${totalInserted} products.`);
  }

  public async updateAllProductsFromAPI(): Promise<void> {
    const logContext = `${this.logContext} - updateAllProductsFromAPI`;
  
    const products = await Product.find({})
      .catch(err => {
        logger.error(err.message, logContext);
      });

      if (!products) {
        logger.error('No products found.', logContext);

        return;
      }

      logger.info(`Found ${products.length} products in MongoDB.`);
  
      const bulkOps: any[] = [];
      const batchSize = 100;

      let updatedCount = 0;
  
      for (const product of products) {
        const { name, creatorName } = product;
  
        if (!name || !creatorName) {
          logger.error(`Skipping product with missing name or creatorName.`, this.logContext);
          continue;
        }
  
        const encodedName = encodeURIComponent(name);
        const encodedCreator = encodeURIComponent(creatorName);
  
        const url = `https://orientdigfinds.com/api/getProductData?creatorName=${encodedCreator}&productName=${encodedName}&currency=USD`;
  
          const response = await axios.get(url)
            .catch(err => {
              logger.error(`Error fetching data for "${name} ${err}"`, `${logContext} -> axios.get`);
            });

          if (!response || !response.data) {
            logger.error(`No data returned for product "${name}".`, this.logContext);

            continue;
          }
  
          const updatedData = response.data;
          console.log(updatedData)
          const transformedProduct = transformProduct(updatedData.body);

          bulkOps.push({ updateOne: { filter: { _id: product._id }, update: transformedProduct, },});
          updatedCount++;
  
          console.log(updatedCount);
    
          if (bulkOps.length === batchSize) {
            await Product.bulkWrite(bulkOps)
              .catch(err => {
                logger.error(`Error updating products in bulk: ${err.message}`, `${logContext} -> bulkWrite()`);
              })

            logger.info(`Bulk updated ${bulkOps.length} products.`);
            bulkOps.length = 0; // Clear the bulkOps array
          }
      }
  
      if (bulkOps.length > 0) {
        await Product.bulkWrite(bulkOps)
          .catch(err => {
            logger.error(`Error updating products in bulk: ${err.message}`, `${logContext} -> bulkWrite()`);
          });
    
        logger.info(`Bulk updated remaining ${bulkOps.length} products.`, this.logContext);
      }
  
      logger.info(`Finished updating ${updatedCount} products from API.`, this.logContext);
  }
  
}

const ADDITIONAL_DATA_ENDPOINT = 'https://orientdigfinds.com/api/getProductData';

/**
 * Enriches a product by fetching the link property from the external API.
 * @param product The product object to enrich.
 * @returns The product object with an added "link" property.
 */
export async function enrichProductData(product: any): Promise<any> {
  const encodedCreator = encodeURIComponent(product.creatorName);
  const encodedName = encodeURIComponent(product.name);
  const url = `${ADDITIONAL_DATA_ENDPOINT}?creatorName=${encodedCreator}&productName=${encodedName}&currency=USD`;

  try {
    const response = await axios.get(url);

    const link = response.data.body.link;

    return {
      ...product,
      link,
    };
  } catch (error: any) {
    return product;
  }
}

export function transformProduct(product: any): any {
  return {
    _id: product._id,  // Using the custom _id from the API
    name: product.name,
    description: product.description || '',
    price: product.price,
    category: product.category,
    store: product.store,
    id_2: product.id,
    images: product.images && Array.isArray(product.images)
      ? product.images
          .filter((img: any) => img.url && img.url.trim() !== '')
          .map((img: any) => ({
            url: img.url,
            description: img.description || ''
          }))
      : [],
    creatorName: product.creatorName,
    mainImage: product.mainImage,
  };
}
