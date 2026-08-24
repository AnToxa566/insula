import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@insula/auth';
import type { AccessTokenPayload } from '@insula/contracts';

import { CursorPaginationQueryDto } from './dto/cursor-pagination-query.dto.js';
import { PostPageDto } from './dto/post-response.dto.js';
import { FeedService } from './feed.service.js';

// Two separate endpoints, each with its own simple cursor, on purpose: a
// single endpoint padding followed content with strangers would need a
// compound cursor encoding which phase it's in plus a boundary-page branch,
// and the client still has to label the two kinds differently in the UI.
@ApiTags('feed')
@ApiBearerAuth()
@Controller()
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('feed')
  @ApiOperation({ summary: 'Posts authored by profiles the caller follows, newest first' })
  @ApiResponse({ status: HttpStatus.OK, type: PostPageDto })
  getFeed(@CurrentUser() user: AccessTokenPayload, @Query() query: CursorPaginationQueryDto) {
    return this.feedService.getFeed(user.profileId, query.cursor, query.limit);
  }

  @Get('explore')
  @ApiOperation({
    summary:
      'Everything else, newest first — excludes posts by profiles the caller follows and the caller’s own posts',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PostPageDto })
  getExplore(@CurrentUser() user: AccessTokenPayload, @Query() query: CursorPaginationQueryDto) {
    return this.feedService.getExplore(user.profileId, query.cursor, query.limit);
  }
}
