import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { User } from './entities/user.entity.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly db: DatabaseService) {}

  async createUser(email: string, passwordHash: string, role: 'buyer' | 'seller'): Promise<User> {
    const result = await this.db.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, role, created_at, updated_at`,
      [email, passwordHash, role],
    );
    return result.rows[0];
  }

  async findByEmail(email: string): Promise<any | null> {
    const result = await this.db.query(
      `SELECT * FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT id, email, role, created_at, updated_at FROM users WHERE id::text = $1::text`,
      [id],
    );
    return result.rows[0] ?? null;
  }
}
