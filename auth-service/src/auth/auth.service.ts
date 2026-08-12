
import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthDatabaseService } from '../common/database.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly db: AuthDatabaseService,
  ) {}

  private isInstitutionalEmail(email: string): boolean {
    const regex = /^[a-zA-Z0-9._%+-]+@(ingenieria\.usac\.edu\.gt|ing\.usac\.edu\.gt)$/;
    return regex.test(email);
  }

  async register(email: string, password: string, fullName: string) {
    // Validación de dominio institucional
    if (!this.isInstitutionalEmail(email)) {
      throw new BadRequestException(
        'Solo se permiten correos institucionales de la Facultad de Ingeniería (@ingenieria.usac.edu.gt o @ing.usac.edu.gt)',
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
      await this.db.authQuery('CALL sp_register_user($1, $2, $3)', [
        email,
        passwordHash,
        fullName,
      ]);
    } catch (err: any) {
      // Los RAISE EXCEPTION del SP llegan como errores de PostgreSQL
      const msg = err?.message || '';
      if (msg.includes('ya está registrado')) {
        throw new BadRequestException('Este correo ya tiene una cuenta registrada');
      }
      if (msg.includes('no institucional')) {
        throw new BadRequestException('Solo se permiten correos institucionales');
      }
      throw new BadRequestException(msg || 'Error al registrar usuario');
    }

    return { message: 'Usuario registrado exitosamente' };
  }

  async login(email: string, password: string) {
    // Validación de dominio antes de consultar BD 
    if (!this.isInstitutionalEmail(email)) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    // Consultar usuario 
    const result = await this.db.authQuery(
      'SELECT u.id, u.email, u.password_hash, u.is_blocked, u.failed_attempts, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = $1',
      [email],
    );

    const user = result.rows[0];

    if (!user) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    // Verificar si la cuenta está bloqueada
    if (user.is_blocked) {
      throw new ForbiddenException(
        'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Revise su correo institucional.',
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      // Registrar intento fallido usando el SP
      await this.db.authQuery('CALL sp_handle_failed_login($1)', [email]);
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    // Login exitoso: resetear intentos fallidos
    await this.db.authQuery('CALL sp_handle_successful_login($1)', [email]);

    // Generar JWT con datos del usuario y rol
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role_name,
    });

    return { token, role: user.role_name, email: user.email };
  }

  async logout(token: string) {
    try {
      const decoded = this.jwtService.decode(token) as any;
      if (decoded) {
        const expiresAt = new Date(decoded.exp * 1000);
        // Revocar token usando el SP
        await this.db.authQuery('CALL sp_revoke_token($1, $2, $3)', [
          decoded.jti || token.slice(-20),
          decoded.sub,
          expiresAt,
        ]);
      }
    } catch {
      // Si falla la revocación no bloqueamos el logout
    }
  }
}
