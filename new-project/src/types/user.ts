/**
 * User Domain Types for Enterprise Users Console
 * Conforming strictly to UI Blueprint and Interaction Contract.
 */

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'disabled';
  createdAt: string;
}

export interface CreateUserDto {
  username: string;
  email?: string;
  role: string;
}

export type PageState = 'ready' | 'loading' | 'empty' | 'error';
