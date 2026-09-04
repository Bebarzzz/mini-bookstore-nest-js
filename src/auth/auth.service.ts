import { Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(private db: DatabaseService, private jwtService: JwtService) { }

    async register(email: string, password: string, role: 'buyer' | 'seller') {
        this.logger.log(`Register attempt for email: ${email}`);

        // 1. Check if email already exists
        const existingUser = await this.db.findUserByEmail(email);
        if (existingUser) {
            this.logger.warn(`Registration failed - email already exists: ${email}`);
            throw new ConflictException('Email already exists'); // 409
        }

        // 2. Hash the password
        const passwordHash = await bcrypt.hash(password, 10);

        // 3. Create the user in the database
        const user = await this.db.createUser(email, passwordHash, role);
        this.logger.log(`User registered successfully: ${email} (role: ${role})`);
        return user;
    }

    async login(email: string, password: string) {
        this.logger.log(`Login attempt for email: ${email}`);

        // 1. Find user by email
        const user = await this.db.findUserByEmail(email);
        if (!user) {
            this.logger.warn(`Login failed - user not found: ${email}`);
            throw new UnauthorizedException('Invalid credentials'); // 401
        }

        // 2. Compare the provided password with the stored hash
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            this.logger.warn(`Login failed - wrong password for: ${email}`);
            throw new UnauthorizedException('Invalid credentials'); // 401
        }

        // 3. Generate a JWT token
        const token = this.jwtService.sign({
            sub: user.id,
            email: user.email,
            role: user.role,
        });

        this.logger.log(`User logged in successfully: ${email}`);
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
        };
    }
}
