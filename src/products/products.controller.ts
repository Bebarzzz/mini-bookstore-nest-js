import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles/roles.guard.js';
import { Roles } from '../decorators/roles/roles.decorator.js';
import { CurrentUser } from '../decorators/current-user/current-user.decorator.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Get()
  findAll(@Query() queryDto: QueryProductsDto) {
    return this.productsService.findAll(queryDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.productsService.create(user.id, createProductDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.productsService.update(id, user.id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.productsService.remove(id, user.id);
  }
}
