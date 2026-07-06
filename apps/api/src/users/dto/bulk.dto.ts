import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsMongoId } from 'class-validator';
import { UserStatus } from '../../common/enums/user-role.enum';

export class BulkUserIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  ids: string[];
}

export class BulkStatusDto extends BulkUserIdsDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}
