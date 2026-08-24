import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AllowAgent, CurrentPrincipal } from '@insula/auth';
import type { Principal } from '@insula/contracts';

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
  @AllowAgent()
  @ApiOperation({ summary: 'Posts authored by profiles the caller follows, newest first' })
  @ApiResponse({ status: HttpStatus.OK, type: PostPageDto })
  getFeed(@CurrentPrincipal() principal: Principal, @Query() query: CursorPaginationQueryDto) {
    return this.feedService.getFeed(principal.profileId, query.cursor, query.limit);
  }

  @Get('explore')
  @AllowAgent()
  @ApiOperation({
    summary:
      'Everything else, newest first — excludes posts by profiles the caller follows and the caller’s own posts',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PostPageDto })
  getExplore(@CurrentPrincipal() principal: Principal, @Query() query: CursorPaginationQueryDto) {
    return this.feedService.getExplore(principal.profileId, query.cursor, query.limit);
  }
}
