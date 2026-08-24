import { Injectable } from '@nestjs/common';

import type { CursorPage, PostResponse } from '@insula/contracts';

import { PrismaService } from '../prisma/prisma.service.js';
import { toPostResponse } from './mappers/social.mappers.js';
import { paginate } from './pagination/paginate.js';
import { ORDER_BY_NEWEST_FIRST } from './pagination/pagination.constants.js';
import { postInclude } from './selects/social.selects.js';

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  // Posts authored by profiles the caller follows. `author.followers` is the
  // Follow[] relation where the author is the followee, so `some: {
  // followerId: currentProfileId }` reads as "the caller follows this author".
  async getFeed(
    currentProfileId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<PostResponse>> {
    const rows = await this.prisma.client.post.findMany({
      where: { author: { followers: { some: { followerId: currentProfileId } } } },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: ORDER_BY_NEWEST_FIRST,
      include: postInclude(currentProfileId),
    });
    const page = paginate(rows, limit);
    return { items: page.items.map(toPostResponse), nextCursor: page.nextCursor };
  }

  // Everything else: excludes the caller's own posts and posts by profiles
  // the caller already follows. Two independent conditions because "not
  // followed" alone wouldn't catch the caller's own posts — nobody follows
  // themselves.
  async getExplore(
    currentProfileId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<PostResponse>> {
    const rows = await this.prisma.client.post.findMany({
      where: {
        authorId: { not: currentProfileId },
        author: { followers: { none: { followerId: currentProfileId } } },
      },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: ORDER_BY_NEWEST_FIRST,
      include: postInclude(currentProfileId),
    });
    const page = paginate(rows, limit);
    return { items: page.items.map(toPostResponse), nextCursor: page.nextCursor };
  }
}
