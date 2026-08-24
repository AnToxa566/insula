import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@insula/auth';
import type { AccessTokenPayload } from '@insula/contracts';

import { CursorPaginationQueryDto } from './dto/cursor-pagination-query.dto.js';
import { PostPageDto } from './dto/post-response.dto.js';
import { ProfileSummaryPageDto } from './dto/profile-page.dto.js';
import { FollowsService } from './follows.service.js';
import { PostsService } from './posts.service.js';
import { ProfileLookupService } from './profile-lookup.service.js';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profileLookup: ProfileLookupService,
    private readonly postsService: PostsService,
    private readonly followsService: FollowsService,
  ) {}

  @Get(':handle/posts')
  @ApiOperation({ summary: "List a profile's posts" })
  @ApiResponse({ status: HttpStatus.OK, type: PostPageDto })
  @ApiNotFoundResponse({ description: 'Profile not found' })
  async listPosts(
    @Param('handle') handle: string,
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: CursorPaginationQueryDto,
  ) {
    const target = await this.profileLookup.findByHandle(handle);
    return this.postsService.listByAuthor(target.id, user.profileId, query.cursor, query.limit);
  }

  @Put(':handle/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Follow a profile. Idempotent.' })
  @ApiNoContentResponse({ description: 'Followed (or already following)' })
  @ApiNotFoundResponse({ description: 'Profile not found' })
  @ApiBadRequestResponse({ description: 'Cannot follow yourself' })
  follow(@Param('handle') handle: string, @CurrentUser() user: AccessTokenPayload) {
    return this.followsService.follow(handle, user.profileId);
  }

  @Delete(':handle/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unfollow a profile. Idempotent.' })
  @ApiNoContentResponse({ description: 'Unfollowed (or was never following)' })
  @ApiNotFoundResponse({ description: 'Profile not found' })
  unfollow(@Param('handle') handle: string, @CurrentUser() user: AccessTokenPayload) {
    return this.followsService.unfollow(handle, user.profileId);
  }

  @Get(':handle/followers')
  @ApiOperation({ summary: 'List profiles following this profile' })
  @ApiResponse({ status: HttpStatus.OK, type: ProfileSummaryPageDto })
  @ApiNotFoundResponse({ description: 'Profile not found' })
  listFollowers(@Param('handle') handle: string, @Query() query: CursorPaginationQueryDto) {
    return this.followsService.listFollowers(handle, query.cursor, query.limit);
  }

  @Get(':handle/following')
  @ApiOperation({ summary: 'List profiles this profile follows' })
  @ApiResponse({ status: HttpStatus.OK, type: ProfileSummaryPageDto })
  @ApiNotFoundResponse({ description: 'Profile not found' })
  listFollowing(@Param('handle') handle: string, @Query() query: CursorPaginationQueryDto) {
    return this.followsService.listFollowing(handle, query.cursor, query.limit);
  }
}
