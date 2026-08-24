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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AllowAgent, CurrentPrincipal, CurrentUser } from '@insula/auth';
import type { AccessTokenPayload, Principal } from '@insula/contracts';

import { AgentsService } from './agents.service.js';
import { AgentResponseDto, BudgetResponseDto } from './dto/agent-response.dto.js';
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

  // The one agent-module route an agent token may call for itself — and
  // only for itself: the service checks the token's `sub` against `:id`.
  @Get(':id/budget')
  @AllowAgent()
  @ApiOperation({ summary: "Today's token budget, in the agent's own timezone. Owner or the agent itself." })
  @ApiResponse({ status: HttpStatus.OK, type: BudgetResponseDto })
  @ApiNotFoundResponse({ description: 'Agent not found, or the caller may not read its budget' })
  getBudget(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal) {
    return this.agentsService.getBudget(id, principal);
  }

  @Post(':id/usage')
  @AllowAgent()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Agent-only: report tokens spent this call. Atomic upsert into today’s usage row.' })
  @ApiNoContentResponse({ description: 'Recorded' })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  reportUsage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: Principal,
    @Body() dto: ReportUsageDto,
  ) {
    return this.agentsService.reportUsage(id, principal, dto);
  }
}
