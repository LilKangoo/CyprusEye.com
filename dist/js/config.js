/**
 * Central configuration for CyprusEye application
 * All environment-specific settings should be defined here
 * 
 * @file config.js
 * @description Centralized configuration to avoid hardcoded values across the codebase
 */

export const SUPABASE_CONFIG = {
  url: 'https://daoohnbnnowmmcizgvrq.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb29obmJubm93bW1jaXpndnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjkwNDksImV4cCI6MjA3NjM0NTA0OX0.AJrmxrk18yWxL1_Ejk_SZ1-X04YxN4C8LXCn9c3yFSM',
  storageKey: 'sb-daoohnbnnowmmcizgvrq-auth-token',
};

export const APP_CONFIG = {
  name: 'CyprusEye Quest',
  version: '1.0.0',
  debug: typeof localStorage !== 'undefined' && localStorage.getItem('CE_DEBUG') === 'true',
};

export const URLS = {
  passwordReset: 'https://cypruseye.com/reset/',
  verification: 'https://cypruseye.com/auth/',
  base: 'https://cypruseye.com',
};
