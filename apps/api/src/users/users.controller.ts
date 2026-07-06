import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateStatusDto, UpdateUserDto } from './dto/update-user.dto';
import { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get('stats')
  stats() {
    return this.usersService.stats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: UserDocument) {
    return this.usersService.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: UserDocument,
  ) {
    return this.usersService.update(id, dto, actor);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() actor: UserDocument,
  ) {
    return this.usersService.setStatus(id, dto.status, actor);
  }

  @Post(':id/reset-password')
  @Roles(UserRole.SUPERADMIN)
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: UserDocument,
  ) {
    return this.usersService.resetPassword(id, dto.newPassword, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: UserDocument) {
    return this.usersService.remove(id, actor);
  }
}
