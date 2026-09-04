import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { RolesGuard } from '../guards/roles/roles.guard.js';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, RolesGuard],
})
export class OrdersModule { }
