# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

1. **Do not** open a public GitHub issue
2. Email security details to: security@fortuna.tech (or your security contact)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

- We will acknowledge receipt within 48 hours
- We will provide an initial assessment within 7 days
- We will keep you informed of our progress
- We will notify you when the vulnerability is fixed

## Security Best Practices

### For Contributors

- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive configuration
- Review dependencies for known vulnerabilities
- Follow secure coding practices
- Keep dependencies up to date

### For Users

- Keep your dependencies updated
- Use environment variables for sensitive data
- Review and understand the code you're running
- Report security issues responsibly

## Security Features

### Current Implementations

- Input validation using Zod schemas
- Policy engine for risk controls
- Sanctions screening interface (stub)
- Environment-based configuration
- Secure transaction handling

### Planned Enhancements

- Rate limiting
- Authentication and authorization
- Enhanced monitoring and alerting
- Security audit logging

## Dependencies

We regularly update dependencies to address security vulnerabilities. Run `pnpm audit` to check for known vulnerabilities in dependencies.

## Disclosure Policy

- Security vulnerabilities will be disclosed after a fix is available
- We will credit security researchers who responsibly disclose vulnerabilities
- We will not take legal action against security researchers who follow this policy

## Contact

For security-related inquiries, please contact: security@fortuna.tech
