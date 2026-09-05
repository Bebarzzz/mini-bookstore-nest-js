import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class ProductsService {
  constructor(private readonly databaseService: DatabaseService) { }

  async create(sellerId: string, createProductDto: CreateProductDto) {
    return this.databaseService.createProduct(sellerId, createProductDto);
  }

  async findAll(queryDto: QueryProductsDto) {
    return this.databaseService.findAllProducts(queryDto);
  }

  async findOne(id: string) {
    const product = await this.databaseService.findProductById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: string, sellerId: string, updateProductDto: UpdateProductDto) {
    const product = await this.findOne(id);
    if (product.sellerId && String(product.sellerId) !== String(sellerId)) {
      throw new ForbiddenException('You can only update your own products');
    }
    return this.databaseService.updateProduct(id, updateProductDto);
  }

  async remove(id: string, sellerId: string) {
    const product = await this.findOne(id);
    if (product.sellerId && String(product.sellerId) !== String(sellerId)) {
      throw new ForbiddenException('You can only delete your own products');
    }
    return this.databaseService.deleteProduct(id);
  }
}
