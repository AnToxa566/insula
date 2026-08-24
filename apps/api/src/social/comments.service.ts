import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type { CommentResponse, CreateCommentInput, CursorPage } from '@insula/contracts';

import { PrismaService } from '../prisma/prisma.service.js';
import { toCommentResponse } from './mappers/social.mappers.js';
import { paginate } from './pagination/paginate.js';
import { ORDER_BY_NEWEST_FIRST } from './pagination/pagination.constants.js';
import { commentInclude } from './selects/social.selects.js';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    postId: string,
    currentProfileId: string,
    input: CreateCommentInput,
  ): Promise<CommentResponse> {
    const post = await this.prisma.client.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (input.parentId) {
      const parent = await this.prisma.client.comment.findUnique({
        where: { id: input.parentId },
        select: { id: true, postId: true, parentId: true },
      });
      if (!parent) {
        throw new BadRequestException('parentId does not refer to an existing comment');
      }
      if (parent.postId !== postId) {
        throw new BadRequestException('parentId does not belong to this post');
      }
      if (parent.parentId !== null) {
        throw new BadRequestException('Replies can only be one level deep');
      }
    }

    const comment = await this.prisma.client.comment.create({
      data: {
        postId,
        authorId: currentProfileId,
        parentId: input.parentId ?? null,
        body: input.body,
      },
      include: commentInclude(currentProfileId),
    });
    // No `replies` key: a freshly created comment (root or reply) never
    // carries a populated replies list — that only appears in the
    // GET /posts/:id/comments listing view.
    return toCommentResponse(comment);
  }

  async remove(id: string, currentProfileId: string): Promise<void> {
    const comment = await this.prisma.client.comment.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });
    if (!comment || comment.authorId !== currentProfileId) {
      throw new NotFoundException('Comment not found');
    }
    // Cascades (schema: Comment.parent onDelete: Cascade, CommentLike.comment
    // onDelete: Cascade) clean up replies and likes.
    await this.prisma.client.comment.delete({ where: { id } });
  }

  async listRootWithReplies(
    postId: string,
    currentProfileId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<CommentResponse>> {
    const rootRows = await this.prisma.client.comment.findMany({
      where: { postId, parentId: null },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: ORDER_BY_NEWEST_FIRST,
      include: commentInclude(currentProfileId),
    });
    const page = paginate(rootRows, limit);

    if (page.items.length === 0) {
      return { items: [], nextCursor: page.nextCursor };
    }

    // Replies for just the kept root comments. Not independently
    // cursor-paginated: "one level of nesting only" makes each root's reply
    // list inherently bounded, so a client sees the full thread in one page.
    const replyRows = await this.prisma.client.comment.findMany({
      where: { parentId: { in: page.items.map((root) => root.id) } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: commentInclude(currentProfileId),
    });

    const repliesByParentId = new Map<string, CommentResponse[]>();
    for (const reply of replyRows) {
      const parentId = reply.parentId as string;
      const bucket = repliesByParentId.get(parentId) ?? [];
      bucket.push(toCommentResponse(reply));
      repliesByParentId.set(parentId, bucket);
    }

    const items = page.items.map((root) =>
      toCommentResponse(root, repliesByParentId.get(root.id) ?? []),
    );
    return { items, nextCursor: page.nextCursor };
  }
}
