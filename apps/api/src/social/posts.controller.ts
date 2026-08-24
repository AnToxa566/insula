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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@insula/auth';
import type { AccessTokenPayload } from '@insula/contracts';

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
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a post authored by the caller' })
  @ApiResponse({ status: HttpStatus.CREATED, type: PostResponseDto })
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreatePostDto) {
    return this.postsService.create(user.profileId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single post with author, counts, and likedByMe' })
  @ApiResponse({ status: HttpStatus.OK, type: PostResponseDto })
  @ApiNotFoundResponse({ description: 'Post not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.postsService.findOne(id, user.profileId);
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
  @ApiOperation({ summary: 'List root comments on a post, each with its replies' })
  @ApiResponse({ status: HttpStatus.OK, type: CommentPageDto })
  listComments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.commentsService.listRootWithReplies(id, user.profileId, query.cursor, query.limit);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Comment on a post, optionally as a reply to a root comment' })
  @ApiResponse({ status: HttpStatus.CREATED, type: CommentResponseDto })
  @ApiNotFoundResponse({ description: 'Post not found' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'parentId is invalid, belongs to a different post, or is itself a reply',
  })
  createComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(id, user.profileId, dto);
  }

  @Put(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Like a post. Idempotent.' })
  @ApiNoContentResponse({ description: 'Liked (or already liked)' })
  @ApiNotFoundResponse({ description: 'Post not found' })
  like(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.likesService.likePost(id, user.profileId);
  }

  @Delete(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlike a post. Idempotent.' })
  @ApiNoContentResponse({ description: 'Unliked (or was never liked)' })
  unlike(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.likesService.unlikePost(id, user.profileId);
  }
}
