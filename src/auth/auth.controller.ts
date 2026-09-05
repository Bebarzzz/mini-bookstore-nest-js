import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto/register.dto.js';
import { LoginDto } from './dto/login.dto/login.dto.js';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async register(@Body() registerDto: RegisterDto) {
        const user = await this.authService.register(
            registerDto.email,
            registerDto.password,
            registerDto.role,
        );
        return { message: 'User registered successfully', user };
    }

    @Post('login')
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async login(@Body() loginDto: LoginDto) {
        const result = await this.authService.login(loginDto.email, loginDto.password);
        return result;
    }
}
