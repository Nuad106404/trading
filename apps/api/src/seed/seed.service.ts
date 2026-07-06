import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { UserRole, UserStatus } from '../common/enums/user-role.enum';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureSuperadmin(false);
  }

  /**
   * Idempotent superadmin seeder.
   * - Missing → create with isProtected=true.
   * - Exists → do nothing, unless forceReset=true (the ONLY sanctioned way
   *   to rotate the protected account's credentials, via the re-seed script).
   */
  async ensureSuperadmin(forceReset: boolean): Promise<void> {
    const username = this.config.get<string>('superadmin.username', '').trim().toLowerCase();
    const password = this.config.get<string>('superadmin.password', '');
    const email = this.config.get<string>('superadmin.email', 'superadmin@local.host');

    if (!username || !password) {
      this.logger.warn('SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD not set — skipping seed.');
      return;
    }

    const rounds = this.config.get<number>('bcryptRounds', 12);
    const existing = await this.userModel
      .findOne({ username })
      .select('+passwordHash')
      .exec();

    if (!existing) {
      await this.userModel.create({
        username,
        email: email.trim().toLowerCase(),
        passwordHash: await bcrypt.hash(password, rounds),
        fullName: 'Primary Superadmin',
        role: UserRole.SUPERADMIN,
        status: UserStatus.ACTIVE,
        isProtected: true,
      });
      this.logger.log(`Protected superadmin "${username}" seeded.`);
      return;
    }

    if (forceReset) {
      existing.passwordHash = await bcrypt.hash(password, rounds);
      existing.email = email.trim().toLowerCase();
      existing.role = UserRole.SUPERADMIN;
      existing.status = UserStatus.ACTIVE;
      existing.isProtected = true;
      await existing.save();
      this.logger.log(`Protected superadmin "${username}" credentials re-seeded from .env.`);
      return;
    }

    this.logger.log(`Protected superadmin "${username}" already exists — skipping.`);
  }
}
