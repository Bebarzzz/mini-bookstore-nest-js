import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { QueryReviewsDto } from './dto/query-reviews.dto.js';
import { ReviewsRepository } from './reviews.repository.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import { ProductsRepository } from '../products/products.repository.js';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewsRepo: ReviewsRepository,
    private readonly ordersRepo: OrdersRepository,
    private readonly productsRepo: ProductsRepository,
  ) {}

  async create(userId: string, createReviewDto: CreateReviewDto) {
    // 1. Confirm product exists via ProductsRepository
    const product = await this.productsRepo.findById(createReviewDto.productId);
    if (!product) {
      throw new NotFoundException(`Product with ID ${createReviewDto.productId} not found`);
    }

    // 2. Cross-domain check: confirm buyer actually purchased this product via OrdersRepository
    const hasPurchased = await this.ordersRepo.hasUserPurchasedProduct(
      userId,
      createReviewDto.productId,
    );
    if (!hasPurchased) {
      throw new ForbiddenException('You can only review products that you have purchased');
    }

    // 3. Prevent duplicate reviews by the same buyer for the same product
    const existing = await this.reviewsRepo.findByUserAndProduct(
      userId,
      createReviewDto.productId,
    );
    if (existing) {
      throw new ConflictException('You have already submitted a review for this product');
    }

    return this.reviewsRepo.create(
      userId,
      createReviewDto.productId,
      createReviewDto.rating,
      createReviewDto.comment,
    );
  }

  async findAll(queryDto?: QueryReviewsDto) {
    return this.reviewsRepo.findAll(queryDto);
  }

  async findByProduct(productId: string, queryDto?: QueryReviewsDto) {
    return this.reviewsRepo.findByProduct(productId, queryDto);
  }

  async findOne(id: string) {
    const review = await this.reviewsRepo.findById(id);
    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }
    return review;
  }

  async update(id: string, userId: string, updateReviewDto: UpdateReviewDto) {
    const review = await this.findOne(id);
    if (String(review.userId) !== String(userId)) {
      throw new ForbiddenException('You can only update your own review');
    }
    return this.reviewsRepo.update(id, updateReviewDto);
  }

  async remove(id: string, userId: string) {
    const review = await this.findOne(id);
    if (String(review.userId) !== String(userId)) {
      throw new ForbiddenException('You can only delete your own review');
    }
    return this.reviewsRepo.delete(id);
  }
}
