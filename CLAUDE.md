# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains JavaScript scripts and templates for the [Drafts app](https://getdrafts.com) on iOS and macOS. The scripts extend Drafts functionality with integrations to Airtable, Ulysses, Bear, and other apps.

## Development Commands

The project uses Gulp for build automation and file synchronization:

- `npm run sync` - Synchronize Library folder to iCloud Drafts directory
- `npm run watch` - Start file watcher that auto-syncs changes to iCloud
- `npm run debug` - Display sync paths for debugging
- `gulp inject` - Process template files (.tpl) using 1Password CLI to inject secrets
- `gulp data` - Copy JSON data files from iCloud to local Library
- `gulp yaml2json` - Convert YAML config files to JSON (runs automatically during build)

## Architecture

### Directory Structure

- `Library/` - Main source directory containing all Drafts resources
  - `Scripts/` - JavaScript files organized by functionality
  - `Templates/` - Markdown templates for various use cases
  - `Data/` - YAML/JSON configuration and data files
  - `Themes/` - Drafts theme files
- `gulpfile.js` - Build configuration that syncs files to iCloud Drafts directory

### Key Components

**Core Libraries (`Library/Scripts/libraries/`)**:
- `airtable-v2.js` - Main Airtable API wrapper (primary framework)
- `ulysses.js` - Ulysses app integration
- `bear.js` - Bear notes app integration

**Project Modules**:
- `cp/` - Content Pipeline system for managing writing workflows
- `bvr/` - Sports team management (attendance, scores, messaging)
- `nr/` - Personal productivity and note-taking utilities

**Framework Classes**:
- `Airtable` - API wrapper with credential management
- `ATBase` - Represents an Airtable base
- `ATTable` - Table operations with query building
- `RecentRecords` - Caches frequently accessed records
- `Sport` - Sports-specific configuration management

### Configuration System

The project uses a build-time compilation approach for configuration:
- Template files (`.tpl`) contain secrets managed by 1Password CLI
- YAML files (`.yaml`) are human-friendly source files for configuration
- JSON files (`.json`) are build artifacts generated from YAML files at build time
- Scripts load JSON files at runtime (no YAML parsing overhead)
- YAML files should be edited for configuration changes; JSON files are auto-generated

### Sync Workflow

Files are developed locally in `Library/` and synchronized to the iCloud Drafts directory at:
`~/Library/Mobile Documents/iCloud~com~agiletortoise~Drafts5/Documents/`

The sync process:
1. Copies JSON data from iCloud to local
2. Processes template files to inject secrets (`.tpl` → `.yaml`)
3. Converts YAML config files to JSON (`.yaml` → `.json`)
4. Syncs all files to iCloud Drafts directory
5. Optionally watches for changes in development mode

## Secret Management

Secrets are managed using 1Password CLI (`op inject`) with template files. Never commit actual API keys or credentials to the repository.