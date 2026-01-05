# TypeScript Conventions

## General

- Use strict mode (enforced via tsconfig)
- Prefer `const` over `let`, never use `var`
- Use explicit return types on exported functions
- Prefer interfaces over type aliases for object shapes

## Imports

- Use path aliases (`@/` for src)
- Group imports: external, then internal, then relative
- No default exports (except for configs)

## Async/Await

- Always use async/await over raw promises
- Handle errors with try/catch
- Use `Promise.all` for parallel operations

## Types

- No `any` - use `unknown` and narrow
- Use Zod for runtime validation
- Export types from dedicated `types/` files

## Naming

- camelCase for variables and functions
- PascalCase for types, interfaces, classes
- SCREAMING_SNAKE_CASE for constants
- Descriptive names over abbreviations

## Error Handling

- Create custom error classes for domains
- Always include context in error messages
- Log errors before re-throwing
