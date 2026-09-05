import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class ReviewsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(userId: string, createReviewDto: CreateReviewDto) {
    // 1. Confirm product exists
    const product = await this.databaseService.findProductById(createReviewDto.productId);
    if (!product) {
      throw new NotFoundException(`Product with ID ${createReviewDto.productId} not found`);
    }

    // 2. Cross-domain check: confirm buyer actually purchased this product via Orders -> OrderItems
    const hasPurchased = await this.databaseService.hasUserPurchasedProduct(
      userId,
      createReviewDto.productId,
    );
    if (!hasPurchased) {
      throw new ForbiddenException('You can only review products that you have purchased');
    }

    // 3. Prevent duplicate reviews by the same buyer for the same product
    const existing = await this.databaseService.findReviewByUserAndProduct(
      userId,
      createReviewDto.productId,
    );
    if (existing) {
      throw new ConflictException('You have already submitted a review for this product');
    }

    return this.databaseService.createReview(
      userId,
      createReviewDto.productId,
      createReviewDto.rating,
      createReviewDto.comment,
    );
  }

  async findAll() {
    return this.databaseService.findAllReviews();
  }

  async findByProduct(productId: string) {
    return this.databaseService.findReviewsByProduct(productId);
  }

  async findOne(id: string) {
    const review = await this.databaseService.findReviewById(id);
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
    return this.databaseService.updateReview(id, updateReviewDto);
  }

  async remove(id: string, userId: string) {
    const review = await this.findOne(id);
    if (String(review.userId) !== String(userId)) {
      throw new ForbiddenException('You can only delete your own review');
    }
    return this.databaseService.deleteReview(id);
  }
}
