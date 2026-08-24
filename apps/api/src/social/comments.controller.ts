import { Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@insula/auth';
import type { AccessTokenPayload } from '@insula/contracts';

import { CommentsService } from './comments.service.js';
import { LikesService } from './likes.service.js';

@ApiTags('comments')
@ApiBearerAuth()
@Controller('comments')
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly likesService: LikesService,
  ) {}

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment. Author only. Cascades remove replies and likes.' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'Comment does not exist, or the caller does not own it' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.commentsService.remove(id, user.profileId);
  }

  @Put(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Like a comment. Idempotent.' })
  @ApiNoContentResponse({ description: 'Liked (or already liked)' })
  @ApiNotFoundResponse({ description: 'Comment not found' })
  like(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.likesService.likeComment(id, user.profileId);
  }

  @Delete(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlike a comment. Idempotent.' })
  @ApiNoContentResponse({ description: 'Unliked (or was never liked)' })
  unlike(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.likesService.unlikeComment(id, user.profileId);
  }
}
