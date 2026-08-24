import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { profileSummarySelect } from './selects/social.selects.js';

// Lightweight internal handle -> profile lookup shared by every
// /profiles/:handle/* route. Not a public endpoint of its own — profile CRUD
// is out of scope for this module.
@Injectable()
export class ProfileLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async findByHandle(handle: string) {
    const profile = await this.prisma.client.profile.findUnique({
      where: { handle },
      select: profileSummarySelect,
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }
}
