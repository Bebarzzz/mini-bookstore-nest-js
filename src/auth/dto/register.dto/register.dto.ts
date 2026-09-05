import { IsEmail, IsString, MinLength, MaxLength, IsIn } from 'class-validator';

export class RegisterDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8)
    @MaxLength(72)
    password: string;

    @IsIn(['buyer', 'seller'])
    role: 'buyer' | 'seller';
}