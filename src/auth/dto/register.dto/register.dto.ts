// register.dto.ts
import { IsEmail, IsString, MinLength, IsIn } from 'class-validator';

export class RegisterDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8)
    password: string;

    @IsIn(['buyer', 'seller'])
    role: 'buyer' | 'seller';
}