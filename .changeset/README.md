# Changesets

This repository uses [Changesets](https://github.com/changesets/changesets) for version management and changelog generation.

## Adding a Changeset

When making changes that affect package versions, create a changeset:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages are affected
2. Choose the type of change (major, minor, patch)
3. Write a summary of the changes

## Release Process

1. Create changesets for your changes
2. Open a PR with your changes
3. After PR is merged, changesets will be processed
4. A release PR will be created automatically
5. Merge the release PR to publish packages

## Version Strategy

- **Patch**: Bug fixes, internal refactoring
- **Minor**: New features, non-breaking changes
- **Major**: Breaking changes

Packages are versioned independently, but related packages should be updated together when making breaking changes.
