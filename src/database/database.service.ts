import { Injectable, Inject } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService {
  constructor(@Inject('PG_CONNECTION') private readonly pool: Pool) {}

  /**
   * Executes a parameterized query against the connection pool.
   */
  async query<R extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<R>> {
    return this.pool.query<R>(text, params);
  }

  /**
   * Acquires a dedicated client from the pool for transactions.
   * NOTE: The caller MUST call client.release() in a finally block!
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Helper to execute a sequence of queries within an atomic transaction.
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}