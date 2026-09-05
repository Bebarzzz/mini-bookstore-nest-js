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
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { QueryReviewsDto } from './dto/query-reviews.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles/roles.guard.js';
import { Roles } from '../decorators/roles/roles.decorator.js';
import { CurrentUser } from '../decorators/current-user/current-user.decorator.js';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer')
  create(
    @Body() createReviewDto: CreateReviewDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.reviewsService.create(user.id, createReviewDto);
  }

  @Get()
  findAll(@Query() queryDto: QueryReviewsDto) {
    return this.reviewsService.findAll(queryDto);
  }

  @Get('product/:productId')
  findByProduct(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Query() queryDto: QueryReviewsDto,
  ) {
    return this.reviewsService.findByProduct(productId, queryDto);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reviewsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.reviewsService.update(id, user.id, updateReviewDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.reviewsService.remove(id, user.id);
  }
}
