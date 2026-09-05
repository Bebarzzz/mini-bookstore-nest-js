import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';
import { ProductsRepository } from './products.repository.js';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepo: ProductsRepository) { }

  async create(sellerId: string, createProductDto: CreateProductDto) {
    return this.productsRepo.create(sellerId, createProductDto);
  }

  async findAll(queryDto: QueryProductsDto) {
    return this.productsRepo.findAll(queryDto);
  }

  async findOne(id: string) {
    const product = await this.productsRepo.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: string, sellerId: string, updateProductDto: UpdateProductDto) {
    const product = await this.findOne(id);
    if (!product.sellerId || String(product.sellerId) !== String(sellerId)) {
      throw new ForbiddenException('You can only update your own products');
    }
    return this.productsRepo.update(id, updateProductDto);
  }

  async remove(id: string, sellerId: string) {
    const product = await this.findOne(id);
    if (!product.sellerId || String(product.sellerId) !== String(sellerId)) {
      throw new ForbiddenException('You can only delete your own products');
    }
    return this.productsRepo.delete(id);
  }
}
