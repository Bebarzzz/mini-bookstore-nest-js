export class Product {
  id: string;
  title: string;
  author: string;
  category?: string;
  price: number;
  stock: number;
  sellerId: string;
  seller?: {
    id: string;
    email: string;
    role: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
