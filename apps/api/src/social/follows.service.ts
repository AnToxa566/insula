import { BadRequestException, Injectable } from '@nestjs/common';

import type { CursorPage, ProfileSummary } from '@insula/contracts';

import { PrismaService } from '../prisma/prisma.service.js';
import { toProfileSummary } from './mappers/social.mappers.js';
import { paginate } from './pagination/paginate.js';
import { profileSummarySelect } from './selects/social.selects.js';
import { ProfileLookupService } from './profile-lookup.service.js';

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileLookup: ProfileLookupService,
  ) {}

  async follow(handle: string, currentProfileId: string): Promise<void> {
    const target = await this.profileLookup.findByHandle(handle);
    if (target.id === currentProfileId) {
      throw new BadRequestException('Cannot follow yourself');
    }
    await this.prisma.client.follow.upsert({
      where: { followerId_followeeId: { followerId: currentProfileId, followeeId: target.id } },
      create: { followerId: currentProfileId, followeeId: target.id },
      update: {},
    });
  }

  async unfollow(handle: string, currentProfileId: string): Promise<void> {
    const target = await this.profileLookup.findByHandle(handle);
    await this.prisma.client.follow.deleteMany({
      where: { followerId: currentProfileId, followeeId: target.id },
    });
  }

  // Who follows `handle`. Follow has no surrogate id (composite PK
  // followerId+followeeId), so this queries Follow rows directly with a
  // compound cursor rather than reusing ORDER_BY_NEWEST_FIRST/`cursor: {id}`.
  // followerId — the half of the pair that varies per row — plays the id
  // tie-breaker role, and doubles as the ProfileSummary.id every mapped item
  // carries, so the generic paginate() still works unmodified once the rows
  // are mapped to their follower profile below.
  async listFollowers(
    handle: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<ProfileSummary>> {
    const target = await this.profileLookup.findByHandle(handle);
    const rows = await this.prisma.client.follow.findMany({
      where: { followeeId: target.id },
      take: limit + 1,
      ...(cursor && {
        cursor: { followerId_followeeId: { followerId: cursor, followeeId: target.id } },
        skip: 1,
      }),
      orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
      include: { follower: { select: profileSummarySelect } },
    });
    const profiles = rows.map((row) => toProfileSummary(row.follower));
    return paginate(profiles, limit);
  }

  // Who `handle` follows. Mirror image of listFollowers.
  async listFollowing(
    handle: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<ProfileSummary>> {
    const target = await this.profileLookup.findByHandle(handle);
    const rows = await this.prisma.client.follow.findMany({
      where: { followerId: target.id },
      take: limit + 1,
      ...(cursor && {
        cursor: { followerId_followeeId: { followerId: target.id, followeeId: cursor } },
        skip: 1,
      }),
      orderBy: [{ createdAt: 'desc' }, { followeeId: 'desc' }],
      include: { followee: { select: profileSummarySelect } },
    });
    const profiles = rows.map((row) => toProfileSummary(row.followee));
    return paginate(profiles, limit);
  }
}
