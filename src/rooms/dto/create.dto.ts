import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({
    description: 'Title of the room. Must be unique for each owner.',
    example: 'Game Night',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Maximum number of users allowed in the room.',
    example: 5,
    minimum: 0,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  limit: number;

  @IsBoolean()
  randomizer: boolean;
}
