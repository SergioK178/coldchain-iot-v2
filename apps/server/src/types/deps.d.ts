declare module 'argon2' {
  export const argon2id: number;
  export function hash(password: string, options?: { type?: number }): Promise<string>;
  export function verify(hash: string, password: string): Promise<boolean>;
}

declare module 'jose' {
  export const SignJWT: new (payload: object) => {
    setProtectedHeader(header: object): this;
    setIssuedAt(): this;
    setExpirationTime(time: string): this;
    sign(key: Uint8Array): Promise<string>;
  };
  export function jwtVerify(token: string, key: Uint8Array): Promise<{ payload: Record<string, unknown> }>;
}
