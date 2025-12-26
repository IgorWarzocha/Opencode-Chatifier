CODING.md - Development Guidelines

Core Principles for Clean, Maintainable Code Architecture. Universal development guidelines applicable to any project. Focus on DRY principles, maintainable architecture, and type safety. READ files before editing.

General coding guidelines for building robust, scalable applications across any technology stack.

CORE CODING PRINCIPLES

DRY PRINCIPLE: Pattern recognition is key - if you see similar code twice, abstract it immediately. Create reusable components, shared utilities, and unified interfaces.

Core Development Principles (apply naturally):
- DRY First: Check if something similar exists to extend/reuse before writing new code
- Single Purpose: Each component/function does ONE thing really well  
- Compose, Don't Inherit: Build complex things from simple, reusable pieces
- KISS: Simple solutions beat clever ones - readable code > smart code
- Fail Fast: Throw errors clearly rather than hiding problems with defensive code
- Extract Early: See a pattern emerging? Pull it into a shared utility immediately
- Occam's Razor: Simplest explanation is usually correct - avoid over-engineering
- Pareto Principle: 80% of results come from 20% of effort - focus on high-impact features

Code Quality Habits:
- File Headers: Start every file with 2-3 sentence comment explaining what it does
- Strategic Comments: Comment major sections and complex logic, not every line
- NO Logging: No console.log, console.error, or any logging - trust TypeScript and DevTools
- Progressive Cleanup: When editing files, replace any types with proper interfaces/delete console statements - technical debt decreases over time
- Real Features: Build actual functionality, not fake implementations that pretend to be dynamic but return hardcoded results
- Error Prevention: Catch problems before they happen, not just handle them
- Systems Thinking: Consider how changes affect the bigger picture
- Zero Technical Debt: No quick hacks that compromise system integrity

Development Tool Best Practices:
- Read First: Always understand existing code before making changes - read files and understand context fully
- Search Smart: Use appropriate search tools for file patterns and content discovery
- Batch Operations: Group related operations when possible for better performance
- Edit Precisely: Make targeted changes rather than broad rewrites when possible
- Plan Complex Tasks: Break down multi-step operations into manageable pieces
- Schema Work: Always review existing data structures and schemas before modifications

Type Safety Patterns (Modern Approach):
- Trust Inference: Let your type system infer types rather than explicit typing everything
- Return Types Sparingly: Only add explicit return types when they add value or prevent errors
- Inference > Explicit: Modern type systems are smarter than manual type annotations
- Structured Data: Use strict schemas for API boundaries, flexible types for internal logic
- Type Safety First: Prefer typed languages and avoid any types when possible
- End-to-End Types: Leverage type safety across your entire stack when available
- Validation: Use runtime validation for external data and API boundaries

Project Documentation

Essential Documentation (maintain these files for project clarity):
- README.md - Project overview, setup instructions, and getting started guide
- CHANGELOG.md - Version history and breaking changes
- CONTRIBUTING.md - Development workflow, coding standards, and contribution guidelines
- ARCHITECTURE.md - System design, directory structure, and technical decisions
- API.md - API documentation and endpoint specifications

Architecture Principles

System Design Patterns:
- Modular Architecture: Break systems into focused, single-responsibility modules
- Database-First Design: Store configuration and business logic in persistent storage
- Service Separation: Isolate different concerns into separate services when appropriate
- API-First Development: Design clear interfaces between system components
- Real-time Capabilities: Leverage real-time features when user experience benefits

Common Architecture Patterns:
- Pipeline Processing: Chain operations in logical sequences (input → process → output)
- Event-Driven Systems: Use events for loose coupling between components
- Caching Strategies: Implement appropriate caching for performance optimization
- Error Handling: Design robust error handling and recovery mechanisms
- Scalability Planning: Consider horizontal and vertical scaling from the start

Development Guidelines

Core Development Rules:
1. Domain Separation - Organize code by business domain, not technical layers
2. Configuration Management - Store configuration in persistent storage, avoid hardcoded values
3. Specialized Modules - Create focused modules for specific business logic
4. Structured Data Validation - Validate all external data with proper schemas
5. Pattern Recognition - Extract common patterns into reusable utilities early
6. Function Relationships - Consider how different functions interact and consolidate when patterns emerge
7. Clean Organization - Maintain clear directory structure and avoid code sprawl

Integration Best Practices:
- Data Flow: Design clear data flow patterns (input → validation → processing → output)
- Service Communication: Use well-defined APIs for service-to-service communication
- Frontend Integration: Optimize queries and data fetching for performance
- Error Propagation: Design consistent error handling across all layers
- Testing Strategy: Implement comprehensive testing at unit, integration, and system levels