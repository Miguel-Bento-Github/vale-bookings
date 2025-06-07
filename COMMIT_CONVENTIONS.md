# Backend Commit Conventions

This project enforces **semantic commit messages** using [Conventional Commits](https://www.conventionalcommits.org/) standard with automated linting via [commitlint](https://commitlint.js.org/).

## 🚀 Quick Start

All commits must follow this format:
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Backend-Specific Examples
```bash
# ✅ Good commits for backend
git commit -m "feat(api): add user authentication endpoints"
git commit -m "fix(auth): resolve jwt token expiration issue"
git commit -m "perf(db): optimize booking queries with indexing"
git commit -m "test(bookings): add comprehensive booking validation tests"
git commit -m "refactor(middleware): simplify error handling logic"
git commit -m "docs(api): update endpoint documentation for locations"

# ❌ Bad commits (will be rejected)
git commit -m "fixed bug"
git commit -m "Added new API endpoint"
git commit -m "WIP: working on authentication"
git commit -m "Update tests"
```

## 📋 Commit Types

| Type | Description | When to Use |
|------|-------------|-------------|
| `feat` | New feature | Adding new API endpoints, new functionality |
| `fix` | Bug fix | Fixing broken endpoints, resolving errors |
| `docs` | Documentation | API docs, README updates, code comments |
| `style` | Code style | Formatting, linting fixes (no logic changes) |
| `refactor` | Code refactoring | Restructuring without changing functionality |
| `perf` | Performance improvements | Database optimization, caching, etc. |
| `test` | Testing | Adding/updating unit tests, integration tests |
| `build` | Build system | Dependencies, Docker, deployment scripts |
| `ci` | CI/CD changes | GitHub Actions, pipeline configuration |
| `chore` | Maintenance | Package updates, tooling changes |
| `revert` | Revert changes | Undoing previous commits |

## 🎯 Backend-Specific Scopes

| Scope | Description | Examples |
|-------|-------------|----------|
| `api` | API endpoints | REST routes, controllers |
| `auth` | Authentication | JWT, login, registration |
| `db` | Database | Models, migrations, queries |
| `middleware` | Middleware | Error handling, validation |
| `services` | Business logic | User service, booking service |
| `models` | Data models | User, Booking, Location models |
| `utils` | Utilities | Helper functions, validators |
| `config` | Configuration | Environment, database config |
| `security` | Security features | Rate limiting, CORS, helmet |
| `admin` | Admin features | Admin endpoints, management |
| `bookings` | Booking system | Booking logic, validation |
| `locations` | Location features | Location management, search |
| `schedules` | Schedule management | Working hours, availability |

## 📏 Message Format Rules

- **Header**: Maximum 100 characters
- **Type**: Always lowercase (`feat`, not `Feat`)
- **Scope**: Optional, lowercase, kebab-case for multi-word scopes
- **Subject**: Lowercase, no period at the end
- **Body**: Wrap at 72 characters, explain *what* and *why*
- **Footer**: Reference issues, breaking changes

## 🔧 Advanced Examples

### Feature with Breaking Change
```bash
git commit -m "feat(api)!: change booking endpoint response format

BREAKING CHANGE: Booking API now returns ISO date strings instead of timestamps.
Update all clients to handle the new date format.

Closes #123"
```

### Bug Fix with Details
```bash
git commit -m "fix(auth): resolve memory leak in jwt token validation

Token validation was keeping references to expired tokens causing
memory consumption to grow over time.

- Clear token cache after validation
- Add token cleanup job
- Update token expiration logic

Fixes #456"
```

### Performance Improvement
```bash
git commit -m "perf(db): add indexes for booking queries

Added composite indexes on booking collection:
- (userId, status, createdAt)
- (locationId, startTime, endTime)

Reduces query time from 2s to 200ms for booking history.

Closes #789"
```

## 🚫 Enforcement

Commitlint will **automatically reject** commits that don't follow these rules:

### Common Rejections
```bash
# ❌ Missing type
"add new feature" → ✖ type may not be empty

# ❌ Wrong case
"Feat: add endpoint" → ✖ type must be lowercase  

# ❌ Period at end
"feat: add new endpoint." → ✖ subject may not end with period

# ❌ Too long
"feat: add very long commit message that exceeds..." → ✖ header too long
```

## 🛠️ Testing Your Commits

Test commit messages before committing:
```bash
# Test a commit message
npm run commitlint:test

# Manually test any message
echo "feat(api): add user endpoints" | npx commitlint
```

## 🔄 Integration with Development Workflow

### Pre-commit Testing
All commits automatically run:
1. **Full test suite** (514 tests must pass)
2. **Commitlint validation** (message format check)

### Recommended Workflow
```bash
# 1. Make your changes
# 2. Run tests locally
npm test

# 3. Stage changes
git add .

# 4. Commit with proper message
git commit -m "feat(api): add location search endpoint"

# If commit is rejected, fix the message:
git commit --amend -m "feat(api): add location search endpoint"
```

## 🎓 Tips for Backend Developers

### API Development
```bash
git commit -m "feat(api): add user registration endpoint"
git commit -m "feat(auth): implement jwt refresh token logic"
git commit -m "fix(api): handle duplicate email registration error"
```

### Database Changes
```bash
git commit -m "feat(db): add booking status index for performance"
git commit -m "fix(models): correct location coordinate validation"
git commit -m "refactor(db): simplify user query methods"
```

### Testing
```bash
git commit -m "test(auth): add integration tests for login flow"
git commit -m "test(bookings): increase test coverage to 95%"
git commit -m "fix(tests): resolve flaky booking creation test"
```

### Security & Performance
```bash
git commit -m "security(auth): add rate limiting to login endpoint"
git commit -m "perf(db): optimize location search queries"
git commit -m "security(api): validate all input parameters"
```

## 📊 Current Project Status

- **Backend**: Node.js/TypeScript with Express and MongoDB
- **Test Coverage**: 514/514 tests passing (100%)
- **Commit Enforcement**: Active with pre-commit hooks
- **Code Quality**: ESLint + Prettier + TypeScript strict mode

---

*This commit standard ensures clean, readable git history and facilitates automated versioning, changelog generation, and release management.* 