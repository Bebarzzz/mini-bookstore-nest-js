import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto/register.dto.js';
import { LoginDto } from './dto/login.dto/login.dto.js';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        const user = await this.authService.register(
            registerDto.email,
            registerDto.password,
            registerDto.role,
        );
        return { message: 'User registered successfully', user };
    }

    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        const result = await this.authService.login(loginDto.email, loginDto.password);
        return result;
    }
}
