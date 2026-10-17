# Documentation

This directory contains comprehensive documentation for the Drafts Scripts project, organized using the [Diátaxis framework](https://diataxis.fr/).

## Documentation Structure

The Diátaxis framework organizes documentation into four categories based on their purpose and the user's needs:

There are no tutorials or how-to guides yet. The change workflow (sizing, testing in Drafts, commits, checkpoints) lives in the `drafts-change-workflow` skill under `.claude/skills/`.

### 📋 [Reference](reference/)
**Information-oriented** - Technical descriptions and API documentation

- [Drafts Runtime Behavior](reference/drafts-runtime.md) - Non-obvious runtime facts (fresh context per run, global draft write-back, Eval Draft testing, 1Password)
- [Testing Guide](reference/testing.md) - Comprehensive test suite documentation, infrastructure, and best practices
- [TypeScript Migration](reference/typescript-migration.md) - Migration plan, with a resume guide at the top
- [Type Check Findings](reference/typecheck-findings.md) - Baseline type check errors ranked by production impact

### 💡 [Explanation](explanation/)
**Understanding-oriented** - Clarification, discussion, and context

- [Test Migration](explanation/test-migration.md) - History and reasoning behind the test infrastructure migration

## Quick Links

- [Project README](../README.md) - Main project documentation
- [Claude Code Instructions](../CLAUDE.md) - Development guidance for Claude Code
- [Library Scripts](../Library/Scripts/) - Source code
- [Test Suite](../Library/Tests/) - Test files

## About Diátaxis

The Diátaxis framework recognizes that documentation serves different purposes:

1. **Tutorials** teach basic competence through lessons
2. **How-to guides** solve specific problems with directions
3. **Reference** provides technical descriptions and facts
4. **Explanation** deepens understanding through discussion

This structure ensures documentation meets users where they are and guides them to where they need to be.
