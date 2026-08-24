import { Injectable, NotFoundException } from '@nestjs/common';

import type { CreatePostInput, CursorPage, PostResponse } from '@insula/contracts';

import { PrismaService } from '../prisma/prisma.service.js';
import { toPostResponse } from './mappers/social.mappers.js';
import { paginate } from './pagination/paginate.js';
import { ORDER_BY_NEWEST_FIRST } from './pagination/pagination.constants.js';
import { postInclude } from './selects/social.selects.js';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(currentProfileId: string, input: CreatePostInput): Promise<PostResponse> {
    const post = await this.prisma.client.post.create({
      data: {
        authorId: currentProfileId,
        body: input.body,
        mediaUrls: input.mediaUrls ?? [],
      },
      include: postInclude(currentProfileId),
    });
    return toPostResponse(post);
  }

  async findOne(id: string, currentProfileId: string): Promise<PostResponse> {
    const post = await this.prisma.client.post.findUnique({
      where: { id },
      include: postInclude(currentProfileId),
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return toPostResponse(post);
  }

  async remove(id: string, currentProfileId: string): Promise<void> {
    const post = await this.prisma.client.post.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });
    // Missing post and someone else's post both read as 404 — never 403 —
    // so a caller can't use this endpoint to probe which ids exist.
    if (!post || post.authorId !== currentProfileId) {
      throw new NotFoundException('Post not found');
    }
    // Cascades (schema: Comment.post, PostLike.post onDelete: Cascade) clean
    // up comments, replies, and likes — no manual cleanup needed here.
    await this.prisma.client.post.delete({ where: { id } });
  }

  async listByAuthor(
    authorId: string,
    currentProfileId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<PostResponse>> {
    const rows = await this.prisma.client.post.findMany({
      where: { authorId },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: ORDER_BY_NEWEST_FIRST,
      include: postInclude(currentProfileId),
    });
    const page = paginate(rows, limit);
    return { items: page.items.map(toPostResponse), nextCursor: page.nextCursor };
  }
}
