import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles/roles.guard.js';
import { Roles } from '../decorators/roles/roles.decorator.js';
import { CurrentUser } from '../decorators/current-user/current-user.decorator.js';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  /**
   * POST /orders
   * Buyers create their own orders; userId is taken from the JWT token.
   */
  @Post()
  @Roles('buyer')
  create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    createOrderDto.userId = user.id;
    return this.ordersService.create(createOrderDto);
  }

  /**
   * GET /orders
   * Sellers (admins) can see all orders.
   */
  @Get()
  @Roles('seller')
  findAll() {
    return this.ordersService.findAll();
  }

  /**
   * GET /orders/my
   * Buyers can see their own orders.
   */
  @Get('my')
  @Roles('buyer')
  findMyOrders(@CurrentUser() user: { id: string; role: string }) {
    return this.ordersService.findByUserId(user.id);
  }

  /**
   * GET /orders/:id
   * Both buyers and sellers can view a single order by ID.
   */
  @Get(':id')
  @Roles('buyer', 'seller')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    const order = await this.ordersService.findOne(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    if (user.role === 'buyer' && String(order.user_id) !== String(user.id)) {
      throw new ForbiddenException('You do not have permission to view this order');
    }
    return order;
  }

  /**
   * PATCH /orders/:id
   * Sellers can update order status.
   */
  @Patch(':id')
  @Roles('seller')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(id, updateOrderDto);
  }

  /**
   * DELETE /orders/:id
   * Sellers can cancel/delete an order.
   */
  @Delete(':id')
  @Roles('seller')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}
