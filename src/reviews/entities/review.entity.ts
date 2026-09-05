export class Review {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  comment?: string;
  user?: {
    id: string;
    email: string;
  };
  product?: {
    id: string;
    title: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
