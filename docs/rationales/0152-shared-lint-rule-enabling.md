# 0152 Shared Lint Rule Enabling

## Context

`doctor` and PR preview each rebuilt enabled lint rules by hand, including severity inheritance and rule option merging.

## Decision

Use one typed helper to build command-surface lint configs from explicit rule specs.

## Result

Doctor and preview now share one rule-enabling path, while each call site still states exactly which rules it enables and which typed options it passes.
