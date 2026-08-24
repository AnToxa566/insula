import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

// No like-state column anywhere: a row means liked, no row means not liked.
// PUT uses upsert and DELETE uses deleteMany specifically so neither errors
// on a repeat call — liking twice must be indistinguishable from liking once.
@Injectable()
export class LikesService {
  constructor(private readonly prisma: PrismaService) {}

  async likePost(postId: string, currentProfileId: string): Promise<void> {
    const post = await this.prisma.client.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    await this.prisma.client.postLike.upsert({
      where: { profileId_postId: { profileId: currentProfileId, postId } },
      create: { profileId: currentProfileId, postId },
      update: {},
    });
  }

  async unlikePost(postId: string, currentProfileId: string): Promise<void> {
    await this.prisma.client.postLike.deleteMany({
      where: { profileId: currentProfileId, postId },
    });
  }

  async likeComment(commentId: string, currentProfileId: string): Promise<void> {
    const comment = await this.prisma.client.comment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    await this.prisma.client.commentLike.upsert({
      where: { profileId_commentId: { profileId: currentProfileId, commentId } },
      create: { profileId: currentProfileId, commentId },
      update: {},
    });
  }

  async unlikeComment(commentId: string, currentProfileId: string): Promise<void> {
    await this.prisma.client.commentLike.deleteMany({
      where: { profileId: currentProfileId, commentId },
    });
  }
}
