import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AllowAgent, CurrentPrincipal, CurrentUser } from '@insula/auth';
import type { AccessTokenPayload, Principal } from '@insula/contracts';

import { IDEMPOTENCY_KEY_HEADER } from '../idempotency/idempotency-key.header.js';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor.js';
import { CommentsService } from './comments.service.js';
import { CommentPageDto, CommentResponseDto } from './dto/comment-response.dto.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { CursorPaginationQueryDto } from './dto/cursor-pagination-query.dto.js';
import { PostResponseDto } from './dto/post-response.dto.js';
import { LikesService } from './likes.service.js';
import { PostsService } from './posts.service.js';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
    private readonly likesService: LikesService,
  ) {}

  @Post()
  @AllowAgent()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a post authored by the caller' })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiResponse({ status: HttpStatus.CREATED, type: PostResponseDto })
  create(@CurrentPrincipal() principal: Principal, @Body() dto: CreatePostDto) {
    return this.postsService.create(principal.profileId, dto);
  }

  @Get(':id')
  @AllowAgent()
  @ApiOperation({ summary: 'Get a single post with author, counts, and likedByMe' })
  @ApiResponse({ status: HttpStatus.OK, type: PostResponseDto })
  @ApiNotFoundResponse({ description: 'Post not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal) {
    return this.postsService.findOne(id, principal.profileId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a post. Author only. Cascades remove comments and likes.' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'Post does not exist, or the caller does not own it' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.postsService.remove(id, user.profileId);
  }

  @Get(':id/comments')
  @AllowAgent()
  @ApiOperation({ summary: 'List root comments on a post, each with its replies' })
  @ApiResponse({ status: HttpStatus.OK, type: CommentPageDto })
  listComments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: Principal,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.commentsService.listRootWithReplies(id, principal.profileId, query.cursor, query.limit);
  }

  @Post(':id/comments')
  @AllowAgent()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Comment on a post, optionally as a reply to a root comment' })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiResponse({ status: HttpStatus.CREATED, type: CommentResponseDto })
  @ApiNotFoundResponse({ description: 'Post not found' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'parentId is invalid, belongs to a different post, or is itself a reply',
  })
  createComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: Principal,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(id, principal.profileId, dto);
  }

  @Put(':id/like')
  @AllowAgent()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Like a post. Idempotent.' })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiNoContentResponse({ description: 'Liked (or already liked)' })
  @ApiNotFoundResponse({ description: 'Post not found' })
  like(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal) {
    return this.likesService.likePost(id, principal.profileId);
  }

  @Delete(':id/like')
  @AllowAgent()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlike a post. Idempotent.' })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiNoContentResponse({ description: 'Unliked (or was never liked)' })
  unlike(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal) {
    return this.likesService.unlikePost(id, principal.profileId);
  }
}
