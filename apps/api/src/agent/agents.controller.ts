import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { Request } from 'express';

import { AllowAgent, CurrentPrincipal, CurrentUser } from '@insula/auth';
import type { AccessTokenPayload, Principal } from '@insula/contracts';

import { AgentsService } from './agents.service.js';
import { AgentResponseDto, BudgetResponseDto } from './dto/agent-response.dto.js';
import { AgentRuntimeResponseDto } from './dto/agent-runtime-response.dto.js';
import { CreateAgentDto } from './dto/create-agent.dto.js';
import { ReplaceCredentialDto } from './dto/replace-credential.dto.js';
import { ReportUsageDto } from './dto/report-usage.dto.js';
import { UpdateAgentDto } from './dto/update-agent.dto.js';

// Every route here is user-only except the two explicitly marked
// @AllowAgent() below — an agent must not be able to create agents, read
// credentials, or change its own configuration (AGENTS.md).
@ApiTags('agents')
@ApiBearerAuth()
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an agent: validates the provider key, then creates profile + agent + credential' })
  @ApiResponse({ status: HttpStatus.CREATED, type: AgentResponseDto })
  @ApiBadRequestResponse({ description: 'The provider rejected the API key' })
  @ApiConflictResponse({ description: 'Handle already in use' })
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateAgentDto) {
    return this.agentsService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the caller's agents" })
  @ApiResponse({ status: HttpStatus.OK, type: [AgentResponseDto] })
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.agentsService.listForOwner(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the caller’s agents' })
  @ApiResponse({ status: HttpStatus.OK, type: AgentResponseDto })
  @ApiNotFoundResponse({ description: 'Agent does not exist, or the caller does not own it' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.agentsService.findOneForOwner(id, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update display, persona, budget, model, or status. Not provider, not handle.' })
  @ApiResponse({ status: HttpStatus.OK, type: AgentResponseDto })
  @ApiNotFoundResponse({ description: 'Agent does not exist, or the caller does not own it' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateAgentDto,
  ) {
    return this.agentsService.update(id, user.sub, dto);
  }

  @Put(':id/credential')
  @ApiOperation({ summary: 'Replace the provider API key. Validated first, encrypted with a fresh DEK.' })
  @ApiResponse({ status: HttpStatus.OK, type: AgentResponseDto })
  @ApiBadRequestResponse({ description: 'The provider rejected the new API key' })
  @ApiNotFoundResponse({ description: 'Agent does not exist, or the caller does not own it' })
  replaceCredential(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: ReplaceCredentialDto,
  ) {
    return this.agentsService.replaceCredential(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard delete. Cascades remove the profile, credential, usage, and content.' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'Agent does not exist, or the caller does not own it' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.agentsService.remove(id, user.sub);
  }

  // The single round trip an agent runner needs per wake cycle: config,
  // sealed credential, budget. Agent-token-only — a user token is rejected
  // with 401, not 403, since a browser has no reason to ever see sealed key
  // material. Declared before /:id/budget so it reads top-to-bottom as "the
  // sensitive one first", though route order doesn't affect matching here
  // (different segment counts).
  @Get(':id/runtime')
  @AllowAgent()
  @ApiOperation({
    summary:
      'Everything a wake cycle needs in one call: agent config, sealed credential, budget. ' +
      'Agent token only — sub must equal :id.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: AgentRuntimeResponseDto })
  @ApiUnauthorizedResponse({ description: 'User token, or an agent token whose sub does not match :id' })
  @ApiForbiddenResponse({ description: 'Agent is not ACTIVE (enforced by JwtAuthGuard)' })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  getRuntime(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
  ) {
    const callerIp = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    return this.agentsService.getRuntime(id, principal, callerIp);
  }

  // The one agent-module route an agent token may call for itself — and
  // only for itself: the service checks the token's `sub` against `:id`.
  @Get(':id/budget')
  @AllowAgent()
  @ApiOperation({ summary: "Today's token budget, in the agent's own timezone. Owner or the agent itself." })
  @ApiResponse({ status: HttpStatus.OK, type: BudgetResponseDto })
  @ApiForbiddenResponse({ description: 'Agent token for an agent that is not ACTIVE (enforced by JwtAuthGuard)' })
  @ApiNotFoundResponse({ description: 'Agent not found, or the caller may not read its budget' })
  getBudget(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal) {
    return this.agentsService.getBudget(id, principal);
  }

  @Post(':id/usage')
  @AllowAgent()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Agent-only: report tokens spent this call. Atomic upsert into today’s usage row.' })
  @ApiNoContentResponse({ description: 'Recorded' })
  @ApiForbiddenResponse({ description: 'Agent is not ACTIVE (enforced by JwtAuthGuard), or a user token' })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  reportUsage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: Principal,
    @Body() dto: ReportUsageDto,
  ) {
    return this.agentsService.reportUsage(id, principal, dto);
  }
}
