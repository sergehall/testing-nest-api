import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  Ip,
  Query,
  HttpCode,
  HttpStatus,
  Put,
} from '@nestjs/common';
import { SaService } from './sa.service';
import { BaseAuthGuard } from '../../auth/guards/base-auth.guard';
import { AbilitiesGuard } from '../../../ability/abilities.guard';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { UsersService } from '../../users/application/users.service';
import { CheckAbilities } from '../../../ability/abilities.decorator';
import { Action } from '../../../ability/roles/action.enum';
import { User } from '../../users/infrastructure/schemas/user.schema';
import { ParseQuery } from '../../common/parse-query/parse-query';
import { PaginationDto } from '../../common/pagination/dto/pagination.dto';
import { PaginationTypes } from '../../common/pagination/types/pagination.types';
import { BloggerBlogsService } from '../../blogger-blogs/application/blogger-blogs.service';
import { SkipThrottle } from '@nestjs/throttler';
import { CommandBus } from '@nestjs/cqrs';
import { RemoveUserByIdCommand } from '../../users/application/use-cases/remove-user-byId.use-case';
import { ChangeRoleCommand } from './use-cases/change-role.use-case';
import { CreateUserCommand } from '../../users/application/use-cases/create-user-byInstance.use-case';
import { SaBanUserCommand } from './use-cases/sa-ban-user.use-case';
import { IdParams } from '../../common/params/id.params';
import { SaBanUserDto } from '../dto/sa-ban-user..dto';
import { SaBanBlogDto } from '../dto/sa-ban-blog.dto';
import { SaBanBlogCommand } from './use-cases/sa-ban-blog.use-case';
import { RolesEnums } from '../../../ability/enums/roles.enums';

@SkipThrottle()
@Controller('sa')
export class SaController {
  constructor(
    private saService: SaService,
    private usersService: UsersService,
    private bloggerBlogsService: BloggerBlogsService,
    private commandBus: CommandBus,
  ) {}

  @Get('blogs')
  @UseGuards(BaseAuthGuard)
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.READ, subject: User })
  async saFindBlogs(
    @Request() req: any,
    @Query() query: any,
  ): Promise<PaginationTypes> {
    const queryData = ParseQuery.getPaginationData(query);
    const searchFilters = { searchNameTerm: queryData.searchNameTerm };
    const banStatus = { banStatus: queryData.banStatus };
    const queryPagination: PaginationDto = queryData.queryPagination;
    return await this.bloggerBlogsService.saFindBlogs(queryPagination, [
      searchFilters,
      banStatus,
    ]);
  }

  @Post('users')
  @UseGuards(BaseAuthGuard)
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.CREATE, subject: User })
  async saCreateUser(
    @Request() req: any,
    @Body() createUserDto: CreateUserDto,
    @Ip() ip: string,
  ) {
    const userAgent = req.get('user-agent') || 'None user-agent';
    const registrationData = {
      ip: ip,
      userAgent: userAgent,
    };

    const newUser = await this.commandBus.execute(
      new CreateUserCommand(createUserDto, registrationData),
    );
    newUser.roles = RolesEnums.SA;
    const saUser = await this.commandBus.execute(
      new ChangeRoleCommand(newUser),
    );
    return {
      id: saUser.id,
      login: saUser.login,
      email: saUser.email,
      createdAt: saUser.createdAt,
      banInfo: {
        isBanned: saUser.banInfo.isBanned,
        banDate: saUser.banInfo.banDate,
        banReason: saUser.banInfo.banReason,
      },
    };
  }

  @Get('users')
  @UseGuards(BaseAuthGuard)
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.READ, subject: User })
  async saFindUsers(@Query() query: any) {
    const queryData = ParseQuery.getPaginationData(query);
    const searchLoginTerm = { searchLoginTerm: queryData.searchLoginTerm };
    const searchEmailTerm = { searchEmailTerm: queryData.searchEmailTerm };
    const banStatus = { banStatus: queryData.banStatus };
    const queryPagination: PaginationDto = queryData.queryPagination;
    return this.usersService.findUsers(queryPagination, [
      searchLoginTerm,
      searchEmailTerm,
      banStatus,
    ]);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(BaseAuthGuard)
  async removeUserById(@Request() req: any, @Param() params: IdParams) {
    const currentUserDto = req.user;
    return await this.commandBus.execute(
      new RemoveUserByIdCommand(params.id, currentUserDto),
    );
  }
  @Put('users/:id/ban')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(BaseAuthGuard)
  async banUser(
    @Request() req: any,
    @Param() params: IdParams,
    @Body() updateSaBanDto: SaBanUserDto,
  ) {
    const currentUserDto = req.user;
    return await this.commandBus.execute(
      new SaBanUserCommand(params.id, updateSaBanDto, currentUserDto),
    );
  }
  @Put('blogs/:id/ban')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(BaseAuthGuard)
  async banBlogs(
    @Request() req: any,
    @Param() params: IdParams,
    @Body() saBanBlogDto: SaBanBlogDto,
  ) {
    const currentUserDto = req.user;
    return await this.commandBus.execute(
      new SaBanBlogCommand(params.id, saBanBlogDto, currentUserDto),
    );
  }
}
