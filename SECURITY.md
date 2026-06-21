# Security Policy — Study Superz

## Report a Vulnerability
**DO NOT** create public issues for security bugs.

Email: yadavnitish23709@gmail.com  
Subject: `SECURITY: [description]`  
Response: within 24 hours | Fix: within 72 hours (critical)

## Scope
- studysuperz.vercel.app and all API endpoints
- Authentication and authorization systems

## Out of Scope
- Third-party services (Supabase, Spotify, AI providers)

## Key Security Measures
- All AI API keys server-side only (never in frontend)
- JWT auth with 15-minute access token expiry
- bcrypt password hashing (12 salt rounds)
- Rate limiting on all sensitive endpoints
- Row Level Security on all database tables
- Full audit trail in security_events table
