import { Module } from '@nestjs/common';

import { IdempotencyModule } from '../idempotency/idempotency.module.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';
import { FeedController } from './feed.controller.js';
import { FeedService } from './feed.service.js';
import { FollowsService } from './follows.service.js';
import { LikesService } from './likes.service.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';
import { ProfileLookupService } from './profile-lookup.service.js';
import { ProfilesController } from './profiles.controller.js';

// PrismaModule is @Global(), same as auth.module.ts — IdempotencyModule is
// the only explicit import, needed so IdempotencyInterceptor can be resolved
// by @UseInterceptors on PostsController/CommentsController/ProfilesController.
@Module({
  imports: [IdempotencyModule],
  controllers: [PostsController, CommentsController, ProfilesController, FeedController],
  providers: [
    PostsService,
    CommentsService,
    LikesService,
    FollowsService,
    FeedService,
    ProfileLookupService,
  ],
})
export class SocialModule {}
