import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService {
  constructor(@Inject('PG_CONNECTION') private pool: Pool) {}

  // A reusable method to execute queries
  async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }
}