import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class OrdersService {
  constructor(private readonly databaseService: DatabaseService) { }

  async create(createOrderDto: CreateOrderDto) {
    return this.databaseService.createOrder(createOrderDto.userId!, createOrderDto.items);
  }

  async findAll() {
    return this.databaseService.findAllOrders();
  }

  async findByUserId(userId: string) {
    return this.databaseService.findOrdersByUser(userId);
  }

  async findOne(id: string) {
    return this.databaseService.findOrderById(id);
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    return this.databaseService.updateOrder(id, updateOrderDto);
  }

  async remove(id: string) {
    return this.databaseService.deleteOrder(id);
  }
}
