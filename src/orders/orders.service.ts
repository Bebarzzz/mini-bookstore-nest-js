import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { OrdersRepository } from './orders.repository.js';

import { QueryOrdersDto } from './dto/query-orders.dto.js';

@Injectable()
export class OrdersService {
  constructor(private readonly ordersRepo: OrdersRepository) { }

  async create(createOrderDto: CreateOrderDto) {
    return this.ordersRepo.createOrder(createOrderDto.userId!, createOrderDto.items);
  }

  async findAll(queryDto?: QueryOrdersDto) {
    return this.ordersRepo.findAllOrders(queryDto);
  }

  async findByUserId(userId: string, queryDto?: QueryOrdersDto) {
    return this.ordersRepo.findOrdersByUser(userId, queryDto);
  }

  async findOne(id: string) {
    return this.ordersRepo.findOrderById(id);
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    return this.ordersRepo.updateOrder(id, updateOrderDto);
  }

  async remove(id: string) {
    return this.ordersRepo.deleteOrder(id);
  }

  async hasUserPurchasedProduct(userId: string, productId: string) {
    return this.ordersRepo.hasUserPurchasedProduct(userId, productId);
  }
}
