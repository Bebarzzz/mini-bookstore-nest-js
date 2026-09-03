import { Global, Logger, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from './database.service.js';

// 1. Make the module global so you don't have to import it everywhere
@Global()
@Module({
  providers: [
    {
      // 2. Define a custom token for the connection pool
      provide: 'PG_CONNECTION',
      useFactory: async () => {
        const logger = new Logger('DatabaseModule');
        const pool = new Pool({
          user: process.env.DB_USER,
          host: process.env.DB_HOST,
          database: process.env.DB_NAME,
          password: process.env.DB_PASSWORD,
          port: Number(process.env.DB_PORT),
        });

        try {
          const client = await pool.connect();
          logger.log('Database connected successfully');
          client.release();
        } catch (error) {
          logger.error('Database connection failed', error);
          throw error;
        }

        return pool;
      },
    },
    DatabaseService,
  ],
  // 3. Export the provider and service to be used in other modules
  exports: ['PG_CONNECTION', DatabaseService],
})
export class DatabaseModule { }