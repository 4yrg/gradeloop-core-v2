import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  User,
} from "@/schemas/auth.schema";

// JWT Configuration
const JWT_CONFIG = {
  ACCESS_TOKEN: {
    SECRET: process.env.JWT_ACCESS_SECRET || "dev-access-secret-key",
    ALGORITHM: "HS256" as const,
    EXPIRES_IN: "15m", // 15 minutes
    ISSUER: "gradeloop.com",
    AUDIENCE: "gradeloop-web",
  },
  REFRESH_TOKEN: {
    SECRET: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-key",
    ALGORITHM: "HS256" as const,
    EXPIRES_IN: "30d", // 30 days
    ISSUER: "gradeloop.com",
    AUDIENCE: "gradeloop-web",
  },
} as const;

// Token validation schemas
const JWTHeaderSchema = z.object({
  alg: z.string(),
  typ: z.literal("JWT"),
});

const AccessTokenClaimsSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  user_type: z.enum(["student", "employee"]),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  iat: z.number(),
  exp: z.number(),
  iss: z.string(),
  aud: z.string(),
  jti: z.string().uuid(),
  session_id: z.string().uuid(),
});

const RefreshTokenClaimsSchema = z.object({
  sub: z.string().uuid(),
  session_id: z.string().uuid(),
  token_id: z.string().uuid(),
  iat: z.number(),
  exp: z.number(),
  iss: z.string(),
  aud: z.string(),
  jti: z.string().uuid(),
});

// Error types for JWT operations
export class JWTError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = "JWTError";
  }
}

export class TokenExpiredError extends JWTError {
  constructor(message = "Token has expired") {
    super(message, "TOKEN_EXPIRED", 401);
    this.name = "TokenExpiredError";
  }
}

export class TokenInvalidError extends JWTError {
  constructor(message = "Token is invalid") {
    super(message, "TOKEN_INVALID", 401);
    this.name = "TokenInvalidError";
  }
}

export class TokenMalformedError extends JWTError {
  constructor(message = "Token is malformed") {
    super(message, "TOKEN_MALFORMED", 400);
    this.name = "TokenMalformedError";
  }
}

// JWT Token Manager
export class JWTManager {
  /**
   * Generate a secure JWT ID
   */
  private static generateJTI(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate an access token with user claims
   */
  static generateAccessToken(
    user: User,
    sessionId: string,
    jti?: string
  ): {
    token: string;
    payload: AccessTokenPayload;
    expiresAt: Date;
  } {
    const now = Math.floor(Date.now() / 1000);
    const tokenJTI = jti || this.generateJTI();

    // Extract roles and permissions from user
    const roles = user.roles?.map((role) => role.name) || [];
    const permissions = user.roles?.flatMap((role) => role.permissions) || [];

    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      user_type: user.user_type,
      roles,
      permissions,
      iat: now,
      exp: now + 15 * 60, // 15 minutes
      jti: tokenJTI,
      session_id: sessionId,
    };

    const token = jwt.sign(payload, JWT_CONFIG.ACCESS_TOKEN.SECRET, {
      algorithm: JWT_CONFIG.ACCESS_TOKEN.ALGORITHM,
      issuer: JWT_CONFIG.ACCESS_TOKEN.ISSUER,
      audience: JWT_CONFIG.ACCESS_TOKEN.AUDIENCE,
      expiresIn: JWT_CONFIG.ACCESS_TOKEN.EXPIRES_IN,
      jwtid: tokenJTI,
    });

    return {
      token,
      payload,
      expiresAt: new Date((now + 15 * 60) * 1000),
    };
  }

  /**
   * Generate a refresh token
   */
  static generateRefreshToken(
    userId: string,
    sessionId: string,
    jti?: string
  ): {
    token: string;
    payload: RefreshTokenPayload;
    tokenId: string;
    expiresAt: Date;
  } {
    const now = Math.floor(Date.now() / 1000);
    const tokenJTI = jti || this.generateJTI();
    const tokenId = crypto.randomUUID();

    const payload: RefreshTokenPayload = {
      sub: userId,
      session_id: sessionId,
      token_id: tokenId,
      iat: now,
      exp: now + 30 * 24 * 60 * 60, // 30 days
      jti: tokenJTI,
    };

    const token = jwt.sign(payload, JWT_CONFIG.REFRESH_TOKEN.SECRET, {
      algorithm: JWT_CONFIG.REFRESH_TOKEN.ALGORITHM,
      issuer: JWT_CONFIG.REFRESH_TOKEN.ISSUER,
      audience: JWT_CONFIG.REFRESH_TOKEN.AUDIENCE,
      expiresIn: JWT_CONFIG.REFRESH_TOKEN.EXPIRES_IN,
      jwtid: tokenJTI,
    });

    return {
      token,
      payload,
      tokenId,
      expiresAt: new Date((now + 30 * 24 * 60 * 60) * 1000),
    };
  }

  /**
   * Verify and decode an access token
   */
  static verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, JWT_CONFIG.ACCESS_TOKEN.SECRET, {
        algorithms: [JWT_CONFIG.ACCESS_TOKEN.ALGORITHM],
        issuer: JWT_CONFIG.ACCESS_TOKEN.ISSUER,
        audience: JWT_CONFIG.ACCESS_TOKEN.AUDIENCE,
        clockTolerance: 30, // 30 seconds clock skew tolerance
      });

      // Validate the decoded payload structure
      const validatedPayload = AccessTokenClaimsSchema.parse(decoded);

      return validatedPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError("Access token has expired");
      }

      if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenInvalidError("Access token is invalid");
      }

      if (error instanceof jwt.NotBeforeError) {
        throw new TokenInvalidError("Access token is not active yet");
      }

      if (error instanceof z.ZodError) {
        throw new TokenMalformedError("Access token payload is malformed");
      }

      throw new JWTError("Failed to verify access token", "TOKEN_VERIFICATION_FAILED");
    }
  }

  /**
   * Verify and decode a refresh token
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, JWT_CONFIG.REFRESH_TOKEN.SECRET, {
        algorithms: [JWT_CONFIG.REFRESH_TOKEN.ALGORITHM],
        issuer: JWT_CONFIG.REFRESH_TOKEN.ISSUER,
        audience: JWT_CONFIG.REFRESH_TOKEN.AUDIENCE,
        clockTolerance: 30, // 30 seconds clock skew tolerance
      });

      // Validate the decoded payload structure
      const validatedPayload = RefreshTokenClaimsSchema.parse(decoded);

      return validatedPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError("Refresh token has expired");
      }

      if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenInvalidError("Refresh token is invalid");
      }

      if (error instanceof jwt.NotBeforeError) {
        throw new TokenInvalidError("Refresh token is not active yet");
      }

      if (error instanceof z.ZodError) {
        throw new TokenMalformedError("Refresh token payload is malformed");
      }

      throw new JWTError("Failed to verify refresh token", "TOKEN_VERIFICATION_FAILED");
    }
  }

  /**
   * Decode token without verification (for inspection)
   */
  static decodeToken(token: string): any {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      throw new TokenMalformedError("Token cannot be decoded");
    }
  }

  /**
   * Check if a token is expired without full verification
   */
  static isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as { exp?: number };
      if (!decoded?.exp) return true;

      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as { exp?: number };
      return decoded?.exp ? new Date(decoded.exp * 1000) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get time until token expiration
   */
  static getTimeUntilExpiration(token: string): number {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return 0;

    return Math.max(0, expiration.getTime() - Date.now());
  }

  /**
   * Extract user ID from token without full verification
   */
  static extractUserId(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as { sub?: string };
      return decoded?.sub || null;
    } catch {
      return null;
    }
  }

  /**
   * Extract session ID from token without full verification
   */
  static extractSessionId(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as { session_id?: string };
      return decoded?.session_id || null;
    } catch {
      return null;
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  static generateTokenPair(user: User, sessionId: string): {
    accessToken: {
      token: string;
      payload: AccessTokenPayload;
      expiresAt: Date;
    };
    refreshToken: {
      token: string;
      payload: RefreshTokenPayload;
      tokenId: string;
      expiresAt: Date;
    };
  } {
    const accessToken = this.generateAccessToken(user, sessionId);
    const refreshToken = this.generateRefreshToken(user.id, sessionId);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Validate token structure without signature verification
   */
  static validateTokenStructure(token: string): {
    isValid: boolean;
    header: any;
    payload: any;
    errors: string[];
  } {
    const errors: string[] = [];
    let header: any = null;
    let payload: any = null;

    try {
      const decoded = jwt.decode(token, { complete: true });

      if (!decoded) {
        errors.push("Token cannot be decoded");
        return { isValid: false, header, payload, errors };
      }

      header = decoded.header;
      payload = decoded.payload;

      // Validate header
      try {
        JWTHeaderSchema.parse(header);
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push("Invalid JWT header structure");
        }
      }

      // Basic payload validation
      if (!payload.sub) errors.push("Missing subject (sub) claim");
      if (!payload.iat) errors.push("Missing issued at (iat) claim");
      if (!payload.exp) errors.push("Missing expiration (exp) claim");
      if (!payload.jti) errors.push("Missing JWT ID (jti) claim");

      // Check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        errors.push("Token is expired");
      }

    } catch (error) {
      errors.push("Token is malformed");
    }

    return {
      isValid: errors.length === 0,
      header,
      payload,
      errors,
    };
  }
}

// Hash utility for refresh tokens (to be stored in database)
export class RefreshTokenHasher {
  /**
   * Hash a refresh token for secure database storage
   */
  static async hashToken(token: string): Promise<string> {
    const bcrypt = await import("bcryptjs");
    const saltRounds = 12;
    return bcrypt.hash(token, saltRounds);
  }

  /**
   * Verify a refresh token against its hash
   */
  static async verifyToken(token: string, hash: string): Promise<boolean> {
    try {
      const bcrypt = await import("bcryptjs");
      return bcrypt.compare(token, hash);
    } catch {
      return false;
    }
  }

  /**
   * Generate a secure random token string (alternative to JWT for simple use cases)
   */
  static generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString("base64url");
  }
}

// CSRF Token utilities
export class CSRFTokenManager {
  /**
   * Generate a CSRF token
   */
  static generateToken(): string {
    return crypto.randomBytes(32).toString("base64url");
  }

  /**
   * Validate CSRF token (double-submit cookie pattern)
   */
  static validateToken(headerToken: string, cookieToken: string): boolean {
    if (!headerToken || !cookieToken) return false;

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(headerToken, "base64url"),
      Buffer.from(cookieToken, "base64url")
    );
  }
}

// Export utilities
export const jwtUtils = {
  /**
   * Create a JWT token blacklist entry (for logout)
   */
  createBlacklistEntry(token: string): {
    jti: string;
    exp: number;
  } {
    const payload = JWTManager.decodeToken(token);
    return {
      jti: payload.payload.jti,
      exp: payload.payload.exp,
    };
  },

  /**
   * Check if we should refresh a token (5 minutes before expiry)
   */
  shouldRefreshToken(token: string): boolean {
    const timeUntilExpiry = JWTManager.getTimeUntilExpiration(token);
    const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    return timeUntilExpiry <= REFRESH_THRESHOLD && timeUntilExpiry > 0;
  },

  /**
   * Extract all claims from access token safely
   */
  extractAccessTokenClaims(token: string): Partial<AccessTokenPayload> {
    try {
      const decoded = jwt.decode(token) as AccessTokenPayload;
      return decoded || {};
    } catch {
      return {};
    }
  },

  /**
   * Format token for Authorization header
   */
  formatAuthorizationHeader(token: string): string {
    return `Bearer ${token}`;
  },

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    return authHeader.substring(7);
  },
};

// Type exports
export type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from "@/schemas/auth.schema";

export type TokenValidationResult = {
  isValid: boolean;
  payload?: AccessTokenPayload | RefreshTokenPayload;
  error?: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
};
