import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService {
  constructor(@Inject('PG_CONNECTION') private pool: Pool) { }

  // A reusable method to execute queries
  async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }


  async createUser(email: string, passwordHash: string, role: 'buyer' | 'seller') {
    const result = await this.pool.query(
      `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, $3)
     RETURNING id, email, role, created_at`,
      [email, passwordHash, role],
    );
    return result.rows[0];
  }

  async findUserByEmail(email: string) {
    const result = await this.pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

}