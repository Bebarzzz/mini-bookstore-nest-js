import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from './database.service.js';

// 1. Make the module global so you don't have to import it everywhere
@Global()
@Module({
  providers: [
    {
      // 2. Define a custom token for the connection pool
      provide: 'PG_CONNECTION',
      useFactory: () => {
        return new Pool({
          user: process.env.DB_USER || 'my_user',
          host: process.env.DB_HOST || 'localhost',
          database: process.env.DB_NAME || 'my_database',
          password: process.env.DB_PASSWORD || 'my_password',
          port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
        });
      },
    },
    DatabaseService,
  ],
  // 3. Export the provider and service to be used in other modules
  exports: ['PG_CONNECTION', DatabaseService],
})
export class DatabaseModule {}