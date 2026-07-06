import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { isValidObjectId, Model } from 'mongoose';
import { UserRole, UserStatus } from '../common/enums/user-role.enum';
import { PushService } from '../push/push.service';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

const PROTECTED_MESSAGE = 'This account is protected and cannot be modified or deleted.';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly pushService: PushService,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------- queries

  async findAll(query: QueryUsersDto) {
    const filter: Record<string, any> = {};
    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search.trim()), 'i');
      filter.$or = [{ username: rx }, { email: rx }, { fullName: rx }];
    }
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;

    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [data, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async stats() {
    const [total, active, suspended, admins] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.userModel.countDocuments({ status: UserStatus.ACTIVE }).exec(),
      this.userModel.countDocuments({ status: UserStatus.SUSPENDED }).exec(),
      this.userModel
        .countDocuments({ role: { $in: [UserRole.ADMIN, UserRole.SUPERADMIN] } })
        .exec(),
    ]);
    return { total, active, suspended, admins };
  }

  async findById(id: string): Promise<UserDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException('User not found.');
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async findByIdWithHash(id: string): Promise<UserDocument | null> {
    if (!isValidObjectId(id)) return null;
    return this.userModel.findById(id).select('+passwordHash').exec();
  }

  async findByUsernameOrEmailWithHash(usernameOrEmail: string): Promise<UserDocument | null> {
    const value = usernameOrEmail.trim().toLowerCase();
    return this.userModel
      .findOne({ $or: [{ username: value }, { email: value }] })
      .select('+passwordHash')
      .exec();
  }

  // ---------------------------------------------------------------- mutations

  /** Used by public registration — always creates a plain `user` account. */
  async register(data: {
    username: string;
    email: string;
    password: string;
    fullName?: string;
  }): Promise<UserDocument> {
    await this.assertUnique(data.username, data.email);
    const passwordHash = await this.hashPassword(data.password);
    return this.userModel.create({
      username: data.username,
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      isProtected: false,
    });
  }

  /** Admin/superadmin management endpoint. */
  async create(dto: CreateUserDto, actor: UserDocument): Promise<UserDocument> {
    const role = dto.role ?? UserRole.USER;
    if (actor.role === UserRole.ADMIN && role !== UserRole.USER) {
      throw new ForbiddenException('Admins can only create user-role accounts.');
    }
    await this.assertUnique(dto.username, dto.email);
    const passwordHash = await this.hashPassword(dto.password);
    const created = await this.userModel.create({
      username: dto.username,
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role,
      status: dto.status ?? UserStatus.ACTIVE,
      isProtected: false,
    });

    this.notifyAdmins(
      'User created',
      `${actor.username} created account "${created.username}" (${created.role}).`,
    );
    return created;
  }

  async update(id: string, dto: UpdateUserDto, actor: UserDocument): Promise<UserDocument> {
    const target = await this.findById(id);

    this.ensureNotProtected(target);
    this.ensureActorCanTouch(actor, target);

    const isSelf = actor._id.toString() === target._id.toString();
    if (isSelf && dto.role !== undefined && dto.role !== target.role) {
      throw new ForbiddenException('You cannot change your own role.');
    }
    if (isSelf && dto.status !== undefined && dto.status !== target.status) {
      throw new ForbiddenException('You cannot change your own status.');
    }
    if (dto.role !== undefined && dto.role !== target.role && actor.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Only a superadmin can change roles.');
    }

    if (dto.email !== undefined && dto.email !== target.email) {
      const clash = await this.userModel.findOne({ email: dto.email, _id: { $ne: target._id } });
      if (clash) throw new ConflictException('Email is already in use.');
      target.email = dto.email;
    }
    if (dto.fullName !== undefined) target.fullName = dto.fullName;
    if (dto.role !== undefined) target.role = dto.role;

    const statusChanged = dto.status !== undefined && dto.status !== target.status;
    if (dto.status !== undefined) target.status = dto.status;

    await target.save();

    if (statusChanged) this.emitStatusNotifications(target, actor);
    return target;
  }

  async setStatus(id: string, status: UserStatus, actor: UserDocument): Promise<UserDocument> {
    const target = await this.findById(id);

    this.ensureNotProtected(target);
    this.ensureActorCanTouch(actor, target);
    if (actor._id.toString() === target._id.toString()) {
      throw new ForbiddenException('You cannot change your own status.');
    }

    if (target.status === status) return target;
    target.status = status;
    await target.save();

    this.emitStatusNotifications(target, actor);
    return target;
  }

  async remove(id: string, actor: UserDocument): Promise<{ deleted: true }> {
    const target = await this.findById(id);

    this.ensureNotProtected(target);
    this.ensureActorCanTouch(actor, target);
    if (actor._id.toString() === target._id.toString()) {
      throw new ForbiddenException('You cannot delete your own account.');
    }

    await this.userModel.deleteOne({ _id: target._id }).exec();

    this.notifyAdmins(
      'User deleted',
      `${actor.username} deleted account "${target.username}" (${target.role}).`,
    );
    return { deleted: true };
  }

  async resetPassword(id: string, newPassword: string, actor: UserDocument): Promise<{ success: true }> {
    const target = await this.findByIdWithHash(id);
    if (!target) throw new NotFoundException('User not found.');

    this.ensureNotProtected(target);
    this.ensureActorCanTouch(actor, target);

    target.passwordHash = await this.hashPassword(newPassword);
    await target.save();
    return { success: true };
  }

  /** Own-password change from /profile. Blocked for the protected superadmin (env-rotation only). */
  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.findByIdWithHash(userId);
    if (!user) throw new NotFoundException('User not found.');
    if (user.isProtected) {
      throw new ForbiddenException(
        'The protected superadmin password can only be rotated via the re-seed script.',
      );
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect.');
    user.passwordHash = await this.hashPassword(newPassword);
    await user.save();
    return { success: true };
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } }).exec();
  }

  // ---------------------------------------------------------------- protection rules

  /** Layer 1+2: an isProtected account can never be modified or deleted, by anyone. */
  private ensureNotProtected(target: User): void {
    if (target.isProtected) {
      throw new ForbiddenException(PROTECTED_MESSAGE);
    }
  }

  /** Admins may only act on user-role targets. */
  private ensureActorCanTouch(actor: UserDocument, target: UserDocument): void {
    const isSelf = actor._id.toString() === target._id.toString();
    if (actor.role === UserRole.ADMIN && target.role !== UserRole.USER && !isSelf) {
      throw new ForbiddenException('Admins can only manage user-role accounts.');
    }
  }

  // ---------------------------------------------------------------- helpers

  private async assertUnique(username: string, email: string): Promise<void> {
    const existing = await this.userModel
      .findOne({ $or: [{ username }, { email }] })
      .exec();
    if (existing) {
      throw new ConflictException(
        existing.username === username ? 'Username is already taken.' : 'Email is already in use.',
      );
    }
  }

  private hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.get<number>('bcryptRounds', 12));
  }

  private emitStatusNotifications(target: UserDocument, actor: UserDocument): void {
    const suspended = target.status === UserStatus.SUSPENDED;
    this.notifyAdmins(
      suspended ? 'User suspended' : 'User activated',
      `${actor.username} ${suspended ? 'suspended' : 'activated'} account "${target.username}".`,
    );
    if (suspended) {
      this.pushService
        .sendToUser(target._id.toString(), {
          title: 'Account suspended',
          body: 'Your account has been suspended by an administrator.',
          url: '/profile',
          tag: 'account-status',
        })
        .catch((err) => this.logger.warn(`Push to user failed: ${err?.message}`));
    }
  }

  /** Audit-style alert to every superadmin + admin. Fire-and-forget. */
  private notifyAdmins(title: string, body: string): void {
    this.pushService
      .sendToRoles([UserRole.SUPERADMIN, UserRole.ADMIN], {
        title,
        body,
        url: '/admin/users',
        tag: 'user-management-audit',
      })
      .catch((err) => this.logger.warn(`Push to admins failed: ${err?.message}`));
  }
}
