export class User {
  id: string;
  email: string;
  password_hash?: string;
  role: 'buyer' | 'seller';
  created_at: Date;
  updated_at: Date;
}
