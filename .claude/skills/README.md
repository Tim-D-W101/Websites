# Claude Code skills

Project skills for Claude Code. Each folder with a `SKILL.md` is one skill, copied unchanged from its upstream repo (October 2026) unless noted below. The code-simplifier agent lives in `.claude/agents/`. Nothing here is part of the website build.

| Source | Skills | License |
| --- | --- | --- |
| [mattpocock/skills](https://github.com/mattpocock/skills) @ `a496f55` | ask-matt, chief-of-staff, claude-handoff, code-review, codebase-design, diagnosing-bugs, domain-modeling, git-guardrails-claude-code, grill-me, grill-with-docs, grilling, handoff, implement, implement-spec, improve-codebase-architecture, loop-me, migrate-to-shoehorn, pr, prototype, research, retro, scaffold-exercises, setup-matt-pocock-skills, setup-pre-commit, setup-ts-deep-modules, tdd, teach, to-questionnaire, to-spec, to-tickets, triage, wait-what, wayfinder, wizard, writing-beats, writing-for-agents, writing-fragments, writing-shape | MIT, Copyright (c) 2026 Matt Pocock ([LICENSES/mattpocock-skills.txt](LICENSES/mattpocock-skills.txt)) |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) @ `d83f276` | hyperframes, hyperframes-cli, hyperframes-registry, media-use | Apache-2.0, Copyright 2026 HeyGen, Inc. ([LICENSES/hyperframes.txt](LICENSES/hyperframes.txt)) |
| [shader-effects-inc/shaders](https://github.com/shader-effects-inc/shaders) @ `eb3df5c` | shaders | MIT, Copyright (c) 2026 Shader Effects Inc. ([LICENSES/shaders.txt](LICENSES/shaders.txt)) |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) @ `28b3b8d` | ui-ux-pro-max | MIT, Copyright (c) 2024 Next Level Builder ([LICENSES/ui-ux-pro-max.txt](LICENSES/ui-ux-pro-max.txt)) |
| [anthropics/skills](https://github.com/anthropics/skills) @ `ca45fc4` | frontend-design | Apache-2.0, Anthropic, see `LICENSE.txt` in the folder |
| [obra/superpowers](https://github.com/obra/superpowers) @ `2ce8aa1` | brainstorming, diagnosing-superpowers, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills | MIT, Copyright (c) 2025 Jesse Vincent ([LICENSES/superpowers.txt](LICENSES/superpowers.txt)) |
| [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) @ `f8c5e7a` | code-simplifier agent (`.claude/agents/code-simplifier.md`, from `plugins/code-simplifier`) | Apache-2.0, Anthropic ([LICENSES/code-simplifier.txt](LICENSES/code-simplifier.txt)) |
| [uizze/uizze](https://github.com/uizze/uizze) @ `40b0ee4` | anti-ui-slop, ui-design | Apache-2.0, see `LICENSE` and `NOTICE` in each folder |
| | image-to-ui, ui-radar, uizze-ui | MIT, see `LICENSE` in each folder |

The mattpocock skills come from its `engineering`, `productivity`, `misc` and `in-progress` folders; in-progress ones may be unfinished.

ui-ux-pro-max is its `.claude/skills/ui-ux-pro-max` folder without `scripts/tests`. Its `SKILL.md` is changed in one way: the script paths read `.claude/skills/ui-ux-pro-max/scripts/search.py` (run from the project root) instead of `${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/scripts/search.py`. The scripts need Python 3 and nothing else.

The superpowers skills come without the plugin's SessionStart hook, so `using-superpowers` is not loaded automatically at the start of a session.

To update a skill, copy the folder again from upstream, then redo any change noted above.
