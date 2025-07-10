# AGENTS.md - d7shell Development Guide

## Build/Lint/Test Commands

- `bun run dev` - Development mode with hot reload using entr
- `bun run run` - Run the shell (`ags run app.ts --gtk4`)
- `bun run lint` - ESLint check (`.ts`, `.js` files)
- `bun run format` - Format code with Prettier
- `bun run check-format` - Check formatting without changes

## Code Style Guidelines

- **Language**: TypeScript with strict mode enabled
- **Framework**: Astal/GTK4 with JSX (`jsxImportSource: "astal/gtk4"`)
- **Imports**: Use relative imports for local files, absolute for libraries
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Components**: Export default function components, use JSX.Element return type
- **Error Handling**: Use try-catch blocks, log errors with `console.error`
- **Variables**: Use Astal's `Variable()` for reactive state
- **Formatting**: Prettier with default settings
- **Linting**: ESLint with TypeScript recommended rules, unused vars as warnings
- **Comments**: Use JSDoc style for util functions documentation and never add unnessary comments.

## Project Structure

- `lib/` - Core utilities and services
- `widget/` - UI components organized by feature
- `style/` - SCSS stylesheets
- `option.ts` - Configuration file
- `app.ts` - Main entry point
