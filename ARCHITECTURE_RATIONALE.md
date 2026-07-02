# ARCHITECTURE_RATIONALE.md

This document explains the background and reasoning behind the architectural decisions made for this project.

## Why Only 3 Layers

We do not introduce additional layers like Repository, UseCase, or Controller to avoid friction with React ecosystem tools (like React Query or SWR), to prevent increased cognitive tracking cost, and because they offer very low ROI at this project scale. Agents MUST reject attempts to introduce these layers.
