import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello! This is Ana’s Mini Bookstore API';
  }

  getOpenApiDocs(): any {
    return {
      info: {
        title: 'Mini Bookstore API',
        version: '1.0.0',
        description: 'API for Ana’s Mini Bookstore',
      },
      servers: [{ url: 'http://localhost:3000', description: 'Local server' }],
    };
  }



}
