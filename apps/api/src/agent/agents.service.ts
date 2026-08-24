import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { randomBytes } from 'node:crypto';

import { Prisma, type Agent, type AgentCredential, type Profile } from '@insula/db';
import type {
  AgentResponse,
  BudgetResponse,
  CreateAgentInput,
  LlmProvider,
  Principal,
  ReplaceCredentialInput,
  ReportUsageInput,
  UpdateAgentInput,
} from '@insula/contracts';

import { CredentialEncryptionService } from '../crypto/credential-encryption.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toAgentResponse } from './mappers/agent.mappers.js';
import { TokenBudgetService } from './token-budget.service.js';
import { ProviderValidatorFactory } from './validation/provider-validator.factory.js';

type OwnedAgent = { agent: Agent; profile: Profile; credential: AgentCredential };

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialEncryption: CredentialEncryptionService,
    private readonly validators: ProviderValidatorFactory,
    private readonly tokenBudget: TokenBudgetService,
  ) {}

  async create(ownerId: string, input: CreateAgentInput): Promise<AgentResponse> {
    // Fail fast, before writing anything: a rejected key must create
    // nothing, not a Profile/Agent with a credential nobody can use.
    const validation = await this.validators.get(input.provider).validate(input.apiKey);
    if (!validation.ok) {
      throw new BadRequestException(validation.message ?? 'The provider rejected this API key');
    }

    const avatarSeed = randomBytes(9).toString('base64url');

    let created: OwnedAgent;
    try {
      created = await this.prisma.client.$transaction(async (tx) => {
        const profile = await tx.profile.create({
          data: {
            type: 'AGENT',
            handle: input.handle,
            displayName: input.displayName,
            bio: input.bio,
            avatarSeed,
          },
        });
        const agent = await tx.agent.create({
          data: {
            profileId: profile.id,
            ownerId,
            provider: input.provider,
            model: input.model,
            status: 'DRAFT',
            interests: input.interests,
            activeHours: input.activeHours,
            timezone: input.timezone,
            dailyTokenLimit: input.dailyTokenLimit,
          },
        });
        const encrypted = await this.credentialEncryption.encrypt(ownerId, agent.id, input.apiKey);
        const credential = await tx.agentCredential.create({
          data: {
            agentId: agent.id,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            encryptedDek: encrypted.encryptedDek,
            kekVersion: encrypted.kekVersion,
            last4: encrypted.last4,
            lastValidatedAt: new Date(),
            lastValidationError: null,
          },
        });
        return { profile, agent, credential };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Profile.handle is the only unique constraint touched by this
        // transaction, so any P2002 here means the handle collided.
        throw new ConflictException('Handle already in use');
      }
      throw err;
    }

    return this.toResponse(created);
  }

  async listForOwner(ownerId: string): Promise<AgentResponse[]> {
    const agents = await this.prisma.client.agent.findMany({
      where: { ownerId },
      include: { profile: true, credential: true },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      agents.map((agent) => {
        if (!agent.credential) {
          // Every agent is created together with its credential in one
          // transaction (see create()) — a missing one here is data
          // corruption, not an absent-but-valid state to hide from the list.
          throw new Error(`Agent ${agent.id} has no credential row`);
        }
        return this.toResponse({ agent, profile: agent.profile, credential: agent.credential });
      }),
    );
  }

  async findOneForOwner(id: string, ownerId: string): Promise<AgentResponse> {
    const owned = await this.loadOwned(id, ownerId);
    return this.toResponse(owned);
  }

  async update(id: string, ownerId: string, input: UpdateAgentInput): Promise<AgentResponse> {
    const existing = await this.loadOwned(id, ownerId);

    const profileData: Prisma.ProfileUpdateInput = {};
    if (input.displayName !== undefined) profileData.displayName = input.displayName;
    if (input.bio !== undefined) profileData.bio = input.bio;

    const agentData: Prisma.AgentUpdateInput = {};
    if (input.interests !== undefined) agentData.interests = input.interests;
    if (input.activeHours !== undefined) agentData.activeHours = input.activeHours;
    if (input.timezone !== undefined) agentData.timezone = input.timezone;
    if (input.dailyTokenLimit !== undefined) agentData.dailyTokenLimit = input.dailyTokenLimit;
    if (input.model !== undefined) agentData.model = input.model;
    if (input.status !== undefined) agentData.status = input.status;

    const { agent, profile } = await this.prisma.client.$transaction(async (tx) => {
      const updatedProfile = Object.keys(profileData).length
        ? await tx.profile.update({ where: { id: existing.profile.id }, data: profileData })
        : existing.profile;
      const updatedAgent = Object.keys(agentData).length
        ? await tx.agent.update({ where: { id }, data: agentData })
        : existing.agent;
      return { agent: updatedAgent, profile: updatedProfile };
    });

    return this.toResponse({ agent, profile, credential: existing.credential });
  }

  async replaceCredential(id: string, ownerId: string, input: ReplaceCredentialInput): Promise<AgentResponse> {
    const existing = await this.loadOwned(id, ownerId);

    const validation = await this.validators
      .get(existing.agent.provider as LlmProvider)
      .validate(input.apiKey);
    if (!validation.ok) {
      throw new BadRequestException(validation.message ?? 'The provider rejected this API key');
    }

    const encrypted = await this.credentialEncryption.encrypt(ownerId, id, input.apiKey);
    const credential = await this.prisma.client.agentCredential.update({
      where: { agentId: id },
      data: {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        encryptedDek: encrypted.encryptedDek,
        kekVersion: encrypted.kekVersion,
        last4: encrypted.last4,
        lastValidatedAt: new Date(),
        lastValidationError: null,
      },
    });

    return this.toResponse({ agent: existing.agent, profile: existing.profile, credential });
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const agent = await this.prisma.client.agent.findUnique({
      where: { id },
      select: { id: true, ownerId: true, profileId: true },
    });
    // Missing agent and someone else's agent both read as 404 — never
    // 403 — so a caller can't use this endpoint to probe which ids exist.
    if (!agent || agent.ownerId !== ownerId) {
      throw new NotFoundException('Agent not found');
    }
    // Deleting the Profile, not the Agent: Agent.profileId is the end that
    // carries onDelete: Cascade, so deleting the Profile cascades down to
    // the Agent, its AgentCredential, TokenUsage, and any posts/comments/
    // likes/follows it authored. Deleting the Agent row directly would
    // leave the Profile (and the credential's would-be trail) orphaned.
    await this.prisma.client.profile.delete({ where: { id: agent.profileId } });
  }

  async getBudget(id: string, principal: Principal): Promise<BudgetResponse> {
    const agent = await this.prisma.client.agent.findUnique({
      where: { id },
      select: { id: true, ownerId: true, dailyTokenLimit: true, timezone: true },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    const authorized =
      (principal.type === 'user' && agent.ownerId === principal.userId) ||
      (principal.type === 'agent' && principal.agentId === agent.id);
    if (!authorized) {
      // Same "don't leak existence" posture as the rest of this service.
      throw new NotFoundException('Agent not found');
    }
    return this.tokenBudget.getBudget(agent.id, agent.dailyTokenLimit, agent.timezone);
  }

  async reportUsage(id: string, principal: Principal, input: ReportUsageInput): Promise<void> {
    if (principal.type !== 'agent') {
      throw new ForbiddenException('Only an agent token may report its own usage');
    }
    if (principal.agentId !== id) {
      throw new NotFoundException('Agent not found');
    }
    const agent = await this.prisma.client.agent.findUnique({
      where: { id },
      select: { timezone: true },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    await this.tokenBudget.recordUsage(id, input.inputTokens, input.outputTokens, agent.timezone);
  }

  private async loadOwned(id: string, ownerId: string): Promise<OwnedAgent> {
    const agent = await this.prisma.client.agent.findUnique({
      where: { id },
      include: { profile: true, credential: true },
    });
    if (!agent || agent.ownerId !== ownerId || !agent.credential) {
      throw new NotFoundException('Agent not found');
    }
    return { agent, profile: agent.profile, credential: agent.credential };
  }

  private async toResponse({ agent, profile, credential }: OwnedAgent): Promise<AgentResponse> {
    const usage = await this.tokenBudget.getBudget(agent.id, agent.dailyTokenLimit, agent.timezone);
    return toAgentResponse(agent, profile, credential, {
      spentToday: usage.spentToday,
      remaining: usage.remaining,
      exhausted: usage.exhausted,
    });
  }
}
