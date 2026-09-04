import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class ProductsService {
  constructor(private readonly databaseService: DatabaseService) { }

  async create(createProductDto: CreateProductDto) {
    return await this.databaseService.createBook(createProductDto.title, createProductDto.author, createProductDto.price);
  }

  async findAll() {
    return await this.databaseService.findAllBooks();
  }

  async findOne(id: number) {
    return await this.databaseService.findBookById(id);
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    return await this.databaseService.updateBook(id, updateProductDto.title, updateProductDto.author, updateProductDto.price);
  }

  async remove(id: number) {
    return await this.databaseService.deleteBook(id);
  }
}
