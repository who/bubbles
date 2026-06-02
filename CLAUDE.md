# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AI Guidance

* After receiving tool results, carefully reflect on their quality and determine optimal next steps before proceeding.
* For maximum efficiency, invoke multiple independent operations simultaneously rather than sequentially.
* Before you finish, verify your solution.
* Do what has been asked; nothing more, nothing less.
* NEVER create files unless absolutely necessary for achieving your goal.
* ALWAYS prefer editing an existing file to creating a new one.
* NEVER proactively create documentation files (*.md) or README files unless explicitly requested.

## Work Execution Policy

Work is driven by the global **`ortus` CLI** (https://github.com/who/ortus). Run `ortus grind .` to drain the `bd ready` queue — each iteration spawns a fresh `claude -p /goal` subprocess scoped to closing exactly one issue. See **AGENTS.md** for the full command surface.

When asked to implement features, fix bugs, or make code changes, prefer filing well-structured beads issues (`bd create` with clear titles, descriptions, and acceptance criteria; `bd dep add` for ordering) so `ortus grind` can pick them up.

## Project Overview

A new project

## Technology Stack

- **Language**: Typescript
- **Package Manager**: npm
- **Framework**: nextjs
- **Linter**: eslint

## Development Guidelines

### Code Standards
* TypeScript strict mode enabled
* Use interfaces for object shapes
* Follow Airbnb JavaScript Style Guide
* Use `eslint` for linting

### Before Committing
1. Run `npm run lint`
2. Run `npm test` if tests exist
3. Stage changes appropriately

## Command Reference

### Development
```bash
# Setup (first time)
npm install

# Run development server
npm run dev

# Run tests
npm test

# Linting
npm run lint
npm run format
```

### File Operations - Use Fast Tools

```bash
# List files (FAST)
fd . -t f           # All files recursively
rg --files          # All files (respects .gitignore)
fd . -t d           # All directories

# Search content (FAST)
rg "search_term"                # Search in all files
rg -i "case_insensitive"        # Case-insensitive
rg "pattern" -g "*.ext"         # Only specific file type
rg -l "pattern"                 # Filenames with matches
rg -c "pattern"                 # Count matches per file
rg -n "pattern"                 # Show line numbers
rg -A 3 -B 3 "pattern"          # Context lines

# Find files by name (FAST)
fd "filename"                   # Find by name pattern
fd -e ext                       # All files with extension
```

### Banned Commands - Avoid These Slow Tools

* `tree` - use `fd` instead
* `find` - use `fd` or `rg --files`
* `grep` or `grep -r` - use `rg` instead
* `ls -R` - use `rg --files` or `fd`
* `cat file | grep` - use `rg pattern file`

### Search Strategy

1. Start broad, then narrow: `rg "partial" | rg "specific"`
2. Filter by type early: `rg "pattern" -g "*.ext"`
3. Batch patterns: `rg "(pattern1|pattern2|pattern3)"`
4. Limit scope: `rg "pattern" src/`

## Project Architecture

### File Structure

```
bubbles/
├── src/                      # Source code
├── tests/                    # Test suite (optional)
├── prd/                      # Product requirements documents
├── .beads/                   # Issue tracking
├── .claude/                  # Claude Code settings
└── CLAUDE.md                 # This file
```

## Issue Tracking

This project uses **beads** (`bd`) for issue tracking. See **AGENTS.md** for workflow and session protocol.

### Beads Visualization

View your issues in a visual interface:
- [bdui](https://github.com/assimelha/bdui) - Web-based beads visualization

Or use the CLI:
```bash
bd list              # List all issues
bd ready             # Show issues ready to work
bd stats             # Project statistics
```

## Important Files

* **CLAUDE.md** - AI agent instructions (this file)
* **AGENTS.md** - Session rules, orchestrator (`ortus grind`) command surface, and landing-the-plane protocol
* **.ortusrc** - Per-project ortus config (prefix, project type)

## Pro Tips for AI Agents

* Always use `--json` flags when available for programmatic use
* Use dependency trees to understand complex relationships
* Higher priority issues (0-1) are usually more important than lower (2-4)

## CodeGraph (optional)

If you have [CodeGraph](https://github.com/colbymchenry/codegraph) installed, `ortus grind` will use it automatically; if not, nothing changes. Not required — CodeGraph is detected at runtime and falls back silently to grep/glob/Read when absent.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
