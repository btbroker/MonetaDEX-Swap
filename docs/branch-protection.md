# Branch Protection Recommendations

This document outlines recommended branch protection rules for the MonetaDEX repository.

## Protected Branches

### Main Branch

The `main` branch should be protected with the following rules:

#### Required Status Checks

- `lint` - All code must pass linting
- `typecheck` - All code must pass TypeScript type checking
- `test` - All tests must pass
- `build` - All packages must build successfully

#### Branch Protection Rules

1. **Require pull request reviews before merging**
   - Required approvals: 1
   - Dismiss stale reviews when new commits are pushed: Yes
   - Require review from code owners: Yes

2. **Require status checks to pass before merging**
   - Require branches to be up to date before merging: Yes
   - Status checks required:
     - `lint`
     - `typecheck`
     - `test`
     - `build`

3. **Require conversation resolution before merging**: Yes

4. **Do not allow bypassing the above settings**: Yes (for administrators)

5. **Restrict who can push to matching branches**: Only administrators

6. **Allow force pushes**: No

7. **Allow deletions**: No

### Develop Branch

The `develop` branch should have similar protection but slightly relaxed:

1. **Require pull request reviews before merging**
   - Required approvals: 1
   - Require review from code owners: Optional

2. **Require status checks to pass before merging**: Yes

3. **Allow force pushes**: No (except for administrators in emergencies)

## Branch Strategy

### Main Branches

- `main`: Production-ready code
- `develop`: Integration branch for features

### Feature Branches

- Format: `feature/description` or `feat/description`
- Created from: `develop`
- Merged to: `develop`

### Bug Fix Branches

- Format: `fix/description` or `bugfix/description`
- Created from: `develop` or `main` (for hotfixes)
- Merged to: `develop` or `main`

### Release Branches

- Format: `release/v1.x.x`
- Created from: `develop`
- Merged to: `main` and `develop`

### Hotfix Branches

- Format: `hotfix/description`
- Created from: `main`
- Merged to: `main` and `develop`

## Pull Request Requirements

### Before Opening a PR

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Build succeeds
- [ ] Documentation updated if needed
- [ ] Changeset added if version bump needed

### PR Title Format

Use conventional commits format:
- `feat: add new feature`
- `fix: fix bug`
- `docs: update documentation`
- `refactor: refactor code`
- `test: add tests`
- `chore: update dependencies`

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
```

## Setting Up Branch Protection

1. Go to repository Settings → Branches
2. Click "Add rule" or edit existing rule
3. Configure branch name pattern (e.g., `main`, `develop`)
4. Enable desired protection rules
5. Save changes

## Emergency Procedures

In case of emergencies requiring immediate fixes:

1. Create hotfix branch from `main`
2. Make minimal necessary changes
3. Request expedited review
4. After merge, cherry-pick to `develop`

## Automation

Consider using GitHub Actions or similar tools to:

- Automatically add labels based on PR content
- Run additional checks (security scanning, dependency updates)
- Enforce commit message format
- Auto-merge approved PRs with all checks passing
