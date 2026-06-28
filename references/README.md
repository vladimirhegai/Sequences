# Local references

This directory is a parking area for material that informs development but is
not part of either application.

- `upstream/` contains optional full checkouts such as HyperFrames, Excalidraw,
  and the GSAP agent-skills repository. Its contents are gitignored.
- `agent-sources/` contains original third-party agent packages retained for
  research. It is gitignored and is deliberately outside `.claude/skills`, so
  Claude does not auto-discover those packages while developing this repo.

Forge must not require either directory at runtime. Prompt material that Forge
actually retrieves belongs in `apps/forge/knowledge/`.
