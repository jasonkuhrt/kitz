# PIP-0001: Deterministic Package Publishing for `@kitz/release`

Status: Proposed
Date: 2026-05-13
Owner: `@kitz/release`
Scope: product-level release automation, not repository-specific `release.config.ts` tuning

## Abstract

`@kitz/release` already has the right control-plane shape: it creates a plan, audits the plan, executes side effects through a durable workflow, and exposes resume/status surfaces. The missing work is not "move publishing to pnpm" and not "add more kitz-local config." The missing work is to make publishing itself a typed, product-owned subsystem whose success conditions are represented in the plan, proven before irreversible side effects, and reconciled after every external mutation.

This PIP defines the product feature set required for local-first, reusable package publishing:

1. Typed publishing capability providers with explicit capability proofs.
2. A frozen publish intent inside the release plan.
3. A persisted proof model for doctor/rehearsal/apply.
4. An artifact-exact rehearsal path.
5. Credential and permission checks beyond `whoami`.
6. Trusted-publisher setup and verification.
7. Provenance policy as a first-class release contract.
8. OTP and interactive authentication handling.
9. Lockfile freezing, lifecycle-script policy, secret redaction, and source reproducibility.
10. Artifact manifest, packlist, and checksum verification.
11. Execution locking, execution journal, and external reconciliation.
12. Post-publish registry verification including official tarball byte equality.
13. Publishing provider conformance tests and fake registry fixtures.
14. Matrix maintenance, retention, history, archive, and forensics commands.
15. A local-first operator command surface that composes the above.

The design keeps `release` as the orchestrator. npm, pnpm, and Bun are execution backends with declared capabilities. CI is one runtime host. The local machine remains a first-class host.

## Non-Negotiable Product Goal

An operator on a local machine must be able to run a release flow that answers, before the first irreversible publish:

- Which package versions will be published.
- Which registry, dist-tag, access level, authentication mode, provenance mode, Git tag, remote, and GitHub release target will be used.
- Which checks are proven locally.
- Which checks are unprovable for the selected runtime.
- Which checks are deferred to a specific external host, and exactly which host condition will discharge them.
- Which artifacts will be published, with their manifest shape, packlist, and checksum.
- Which side effects already happened if execution was interrupted.
- Which exact command resumes or reconciles the workflow.

Network availability cannot be predetermined. External service state can change between proof and execution. The product answer is therefore: prove every deterministic and permissioned precondition that is knowable now, write those proofs to a plan-bound artifact, then record and reconcile every side effect that still depends on a remote service.

## Evidence Register

### Current `@kitz/release` Evidence

E1. The current plan schema persists lifecycle, timestamp, releases, and cascades only. It does not persist publish profile, registry, access, auth mode, provenance mode, config digest, artifact checksum, or proof digest. See `packages/release/src/api/planner/models/plan.ts:72`.

E2. `release apply` loads the current config at execution time, then resolves publish semantics from that config and CLI flags. The plan file is not the complete execution contract. See `packages/release/src/cli/commands/apply.ts:104` and `packages/release/src/cli/commands/apply.ts:109`.

E3. `release apply --dry-run` renders a preview and returns before the executor runs. It does not pack artifacts, invoke package-manager dry-run publish, check GitHub release permissions, or write proof artifacts. See `packages/release/src/cli/commands/apply.ts:127`.

E4. Publishing is hardwired to `@kitz/npm-registry`. `preparePackageArtifact` and `publishPreparedArtifact` require `NpmRegistry.NpmCli`, and the live CLI always shells to `npm`. See `packages/release/src/api/executor/publish.ts:6`, `packages/release/src/api/executor/publish.ts:148`, and `packages/npm-registry/src/cli.ts:156`.

E5. The current npm CLI service exposes only `whoami`, `pack`, and `publish`. It has no API for access checks, OTP, provenance, trusted-publisher list/setup, publish dry-run, dist-tag verification, package metadata after publish, or publish receipts. See `packages/npm-registry/src/service.ts:7`.

E6. Current publish options are tag and registry at the release layer, and tarball/tag/registry/access/ignoreScripts at the npm layer. There is no OTP, provenance, dry-run, package-manager identity, publish-summary, or receipt shape. See `packages/release/src/api/executor/publish.ts:55` and `packages/npm-registry/src/cli.ts:56`.

E7. Preflight currently runs doctor-backed `env.*` and `plan.*` rules, including npm auth, git clean, git remote, tag uniqueness, unpublished versions, and package manifest checks. See `packages/release/src/api/executor/preflight.ts:118`.

E8. The current `github-trusted` path skips `env.npm-authenticated` because OIDC authentication is unavailable to `npm whoami`. See `packages/release/src/api/executor/preflight.ts:147` and `packages/release/src/api/lint/rules/env-publish-channel-ready.ts:160`.

E9. Outside GitHub Actions, `env.publish-channel-ready` returns `deferred` for GitHub token/trusted publishing. It does not create a proof obligation that is persisted with the plan. See `packages/release/src/api/lint/rules/env-publish-channel-ready.ts:69`.

E10. The durable workflow prepares all tarballs before publishing, then publishes in local dependency order, creates tags, pushes tags, and creates GitHub releases. See `packages/release/src/api/executor/workflow.ts:156`, `packages/release/src/api/executor/workflow.ts:224`, `packages/release/src/api/executor/workflow.ts:279`, and `packages/release/src/api/executor/workflow.ts:348`.

E11. The publish preparation code rewrites version, runtime targets, and workspace protocol dependencies, then restores the manifest after `npm pack`. It does not persist an artifact manifest, packlist, checksum, or manifest diff. See `packages/release/src/api/executor/publish.ts:138` and `packages/pkg/src/manifest/publish.ts:54`.

E12. `plan.versions-unpublished` checks exact package versions before publish. It does not verify dist-tag placement, tarball integrity, or registry metadata after publish. See `packages/release/src/api/lint/rules/plan-versions-unpublished.ts:23`.

E13. `env.npm-authenticated` checks `npm whoami` and explicitly warns that publish can still fail for write access or write-time auth. See `packages/release/src/api/lint/rules/env-npm-authenticated.ts:18` and `packages/release/src/api/lint/rules/env-npm-authenticated.ts:43`.

### Current Tool And Platform Evidence

E14. The current local npm version string is `11.14.1`, matching the npm docs page version and current `npm view npm version` at the time of research. Node is `v22.22.2`. A version string alone is not enough proof of command availability: the globally resolved `npm trust list --help` returned `Unknown command: "trust"`, while `npm exec --yes --package npm@latest -- npm trust list --help` succeeded with npm `11.14.1`. `release` must therefore prove the resolved binary path and subcommand behavior, not only compare semver.

E15. npm publish accepts a folder, tarball, URL, `name@version`, `name@tag`, or git URL; publish fails if the name/version already exists, and that exact name/version can never be reused. Official source: [npm publish docs](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

E16. npm publish has `--dry-run`, `--otp`, `--provenance`, and `--provenance-file`. npm documents that `--dry-run` is not honored by network commands such as dist-tags or owner. Official source: [npm publish docs](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

E17. npm trusted publishing requires npm CLI `11.5.1` or later and Node `22.14.0` or later, uses OIDC, and supports GitHub Actions, GitLab CI/CD, and CircleCI cloud. Official source: [npm trusted publishers docs](https://docs.npmjs.com/trusted-publishers/).

E18. npm trusted publishing requires `id-token: write` for GitHub Actions, and npm states that each package can have only one trusted publisher configured at a time. Official source: [npm trusted publishers docs](https://docs.npmjs.com/trusted-publishers/).

E19. npm automatically generates provenance attestations for trusted publishing from GitHub Actions or GitLab CI/CD when the repository and package are public. CircleCI trusted publishing does not currently get automatic provenance. Official source: [npm trusted publishers docs](https://docs.npmjs.com/trusted-publishers/).

E20. `npm trust` is documented as the CLI equivalent of trusted-publisher configuration. It requires npm `11.10.0` or newer, write permission on the package, account-level 2FA, and an already-published package. Official source: [npm trust docs](https://docs.npmjs.com/cli/v11/commands/npm-trust/).

E21. npm access can list packages/collaborators, get/set access status, set MFA policy, and requires owner/team/read-write privileges. Official source: [npm access docs](https://docs.npmjs.com/cli/v11/commands/npm-access/).

E22. pnpm 11 implements `pnpm publish` natively and no longer delegates to npm. It also supports publishing tarballs/folders, recursive workspace publishing, `--json`, `--tag`, `--access`, `--dry-run`, `--otp`, `PNPM_CONFIG_OTP`, `--provenance`, and `--report-summary`. Official source: [pnpm publish docs](https://pnpm.io/cli/publish/).

E23. pnpm pack supports recursive workspace packing, output paths, JSON output, and `--dry-run` for verifying tarball contents. Official source: [pnpm pack docs](https://pnpm.io/cli/pack).

E24. Bun publish automatically packs packages, strips catalog and workspace protocols from `package.json`, respects `.npmrc` and `bunfig.toml`, and supports `--access`, `--tag`, `--dry-run`, `--tolerate-republish`, `--otp`, `--auth-type`, and `--registry`. Bun publish does not provide a documented `--ignore-scripts` publish flag, so the Bun provider marks `publish:ignore-scripts` unsupported and deterministic apply relies on prepacked tarball publishing. Official source: [Bun publish docs](https://bun.com/docs/pm/cli/publish).

E25. GitHub's create-release endpoint requires push access and fine-grained tokens need Contents write permission. The endpoint accepts tag, target commitish, title, body, draft, and prerelease fields. Official source: [GitHub REST create release docs](https://docs.github.com/en/rest/releases/releases#create-a-release).

E26. GitHub Actions permissions are explicit. If any permissions are specified, unspecified permissions become `none`; `id-token: write` is separate from `contents: write`. Official source: [GitHub Actions workflow syntax docs](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions).

E27. npm view reads registry metadata for a package, including version-specific metadata and dist-tags through package selectors. npm dist-tag lists and manages package dist-tags. Official sources: [npm view docs](https://docs.npmjs.com/cli/v11/commands/npm-view/) and [npm dist-tag docs](https://docs.npmjs.com/cli/v11/commands/npm-dist-tag/).

E28. Git push supports dry-run mode, allowing `release` to test push command effects without updating the remote. Official source: [git push docs](https://git-scm.com/docs/git-push).

E29. GitHub Actions OIDC is token-based. Runtime-host proof for trusted-publisher deferral must verify signed OIDC token claims against the expected issuer and workflow/repository/job claims, not only inspect environment variables. Official source: [GitHub Actions OIDC docs](https://docs.github.com/en/actions/concepts/security/openid-connect).

E30. npm package lifecycle scripts run around pack/publish workflows and are an execution surface. Official source: [npm scripts docs](https://docs.npmjs.com/cli/v11/using-npm/scripts/).

E31. JSON canonicalization for plan/config digests must use a deterministic canonicalization standard rather than ad hoc `JSON.stringify` behavior. Normative source: [RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785).

## Threat Model

In scope:

- accidental local config drift between plan, proof, rehearsal, and apply.
- accidental package-manager or registry capability mismatch.
- interrupted releases and partial remote side effects.
- malicious lifecycle scripts that are present in source and would run during pack.
- accidental secret leakage through `release` logs, proofs, journals, or command output.
- registry state that diverges from the plan after publish.

Out of scope for deterministic publish v1:

- a hostile runtime host that can arbitrarily modify process memory, source files, artifacts, or network traffic during execution.
- a fully compromised local machine.
- a fully compromised CI runner.
- an insider change to release config that passes code review. Release config review remains the repository governance boundary; repositories can enforce that with CODEOWNERS or external review policy.
- cross-repo publish orchestration where packages from separate repositories must be released as one transaction.

`@kitz/release` hardens the plan-to-publish contract. It does not claim to make a compromised host trustworthy. Runtime-host trust is discharged only by verifiable host evidence such as OIDC claims, and artifact/proof signatures make tampering visible to another verifier.

## Already Good And Kept

The current plan system is not the problem. This PIP keeps it and extends it.

- `release plan` remains the user-visible intent creation step.
- `release doctor` remains the rule/audit surface.
- `release apply` remains the side-effect executor.
- `release status` and `release resume` remain the durable recovery surface.
- The executor remains the only phase that performs irreversible side effects.

The missing work is to make the plan and proof model complete enough that apply is executing a frozen, already-proven publishing contract instead of re-reading live config and discovering missing publish capabilities late.

## No Last-Mile Config Drift

This PIP is product work in `@kitz/release`. It is not complete if the outcome depends on hand-maintained repository-local release scripts, repository-local workflow prose, or kitz-only `release.config.ts` fields.

Hard invariant:

- No new root `package.json` release scripts are required for the feature set.
- No kitz-specific publishing semantics are added to this repository's `release.config.ts`.
- No handwritten per-repo workflow instructions are treated as the source of truth.
- Any required repository setup is generated, inspected, or verified through `@kitz/release` commands.
- `release prove` is the command that decides whether a repository's local setup satisfies the product contract.
- A fixture repository with no kitz-specific release config must be able to run the same local flow as this repository.

## Supported Runtime Matrix

The product support matrix is normative. The locally installed tool versions in Appendix B are research evidence only.

| Runtime | Minimum for supported feature | Proof | Failure behavior |
| --- | --- | --- | --- |
| npm publish | npm CLI with `publish`, `pack`, `access`, `whoami`, and `dist-tag` subcommands | `tool:subcommand-proof` runs each required `--help` or read-only command through the selected binary | `release prove` fails with `unprovable` when a required subcommand is absent |
| npm trusted-publisher admin | npm CLI >= `11.10.0` and working `npm trust list --help` | version check plus subcommand proof | `release trust setup` fails before network mutation |
| npm trusted OIDC publish | npm CLI >= `11.5.1`, Node >= `22.14.0`, supported CI provider, and verifiable provider OIDC claims | version check, provider runtime proof, trusted-publisher proof | local proof records `deferredToHost` only for the named provider runtime |
| pnpm native publish | pnpm CLI >= `11.0.0` with `publish --help` showing native publish flags | version check plus subcommand proof | `release prove` fails when the selected pnpm is older or project policy points at a different package manager |
| Bun publish | Bun CLI with `publish`, `pm pack`, `bun pm pack --dry-run`, and requested auth flags | subcommand proof and flag proof from the selected Bun binary | capability is `unprovable` when the selected Bun lacks the requested flag |
| GitHub release | token with Contents write and release endpoint access | GitHub API proof plus release-by-tag read | apply fails before registry publish when release permission cannot be proven |

## Feature 1: Typed Publishing Capability Architecture

### Problem

Publishing is currently npm-specific. `@kitz/release` cannot reason about npm, pnpm, and Bun as backends with different capabilities because the only service boundary is `NpmRegistry.NpmCli`.

### Product Requirement

`@kitz/release` must own the publishing capability graph. Package-manager executors are only one part of that graph. Registry reads, credential proofs, trusted-publisher administration, artifact building, and publish invocation are separate capabilities so pnpm and Bun do not become weaker products merely because npm owns the registry-admin CLI surface.

### Implementation

Add `packages/release/src/api/publishing/` with these modules:

- `models/driver-id.ts`
- `models/capability.ts`
- `models/auth.ts`
- `models/provenance.ts`
- `models/artifact.ts`
- `models/proof.ts`
- `pack-driver.ts`
- `publish-invoker.ts`
- `registry-client.ts`
- `credential-provider.ts`
- `trusted-publisher-admin.ts`
- `artifact-builder.ts`
- `providers/npm.ts`
- `providers/pnpm.ts`
- `providers/bun.ts`
- `testing/fake-provider.ts`

Define `PublishDriverId`:

```ts
export const PublishDriverId = Schema.Literals('npm', 'pnpm', 'bun')
```

`PublishDriverId` is only the executable family identifier. It is not the capability interface. Capabilities are product-level atoms owned by the service that can prove or perform them. `PublishProfile` composes those services.

Capability boundary rules:

- A capability is included only when its presence changes whether `release plan`, `release prove`, `release rehearse`, or `release apply` may proceed.
- A capability is included only when it maps to a documented external tool/platform surface or an internal product service with conformance tests.
- A capability describes ability, not success. "Can pass `--otp`" is a capability; "this OTP was accepted" is proof/receipt state.
- A capability describes provider surface, not release policy. Lifecycle, channel, dist-tag choice, provenance requirement, and access choice stay in `PublishIntent`.
- A capability describes provider surface, not current environment state. Binary path, version, configured package manager, token presence, package ownership, and package existence are proof inputs.
- A capability describes provider surface, not emitted artifacts. Tarball checksum, packlist, registry observation, Git tag SHA, and GitHub release URL are receipts or observations.
- A capability may be unsupported without failing typechecking. Unsupported support is data returned through `CapabilityResult.Unsupported`, never a thrown "method missing" surprise.

Intentional inclusions:

- Pack capabilities: required to build and inspect the exact artifact that may later be published.
- Publish invocation capabilities: required to know which plan fields can be represented by the selected publish command.
- Registry read capabilities: required for pre-publish unpublished-version proof and post-publish verification.
- Credential capabilities: required for identity and OTP planning without baking secrets into plans.
- Trusted-publisher admin capabilities: required because npm owns the setup surface even when pnpm or Bun owns publish invocation.
- Tool introspection capabilities: required because semver alone did not prove `npm trust` availability on this machine.

Intentional omissions:

- No package-manager auto-detection result. Detection can seed a `PublishProfile`, but it is not a release capability.
- No package-specific authorization fact. "This account can publish `@scope/pkg`" is a proof, not a capability.
- No network availability fact. Network reachability is an execution condition, not a capability.
- No product policy flags such as "official", "candidate", "ephemeral", or "github-trusted". Policies select capabilities but are not capabilities.
- No local runbook/script affordance. Root scripts are wrappers and cannot expand or shrink the product capability graph.
- No artifact digest, dist-tag observation, release URL, or journal state. Those are receipts and observations.

Define capability values as a closed tagged union:

```ts
export const PublishCapability = Schema.Literals(
  'tool:version-proof',
  'tool:subcommand-proof',
  'tool:flag-proof',
  'tool:invocation-context-proof',
  'pack:tarball',
  'pack:manifest-json',
  'pack:packlist',
  'pack:dry-run',
  'publish:tarball',
  'publish:folder',
  'publish:dry-run',
  'publish:tag',
  'publish:registry',
  'publish:access',
  'publish:otp',
  'publish:provenance-flag',
  'publish:provenance-file',
  'publish:trusted-oidc',
  'publish:ignore-scripts',
  'publish:tolerate-republish',
  'publish:summary-real',
  'registry:view-version',
  'registry:view-dist-tags',
  'registry:view-access',
  'registry:view-tarball-metadata',
  'registry:download-tarball',
  'credential:whoami',
  'credential:otp',
  'trust:list',
  'trust:setup-github',
  'trust:setup-gitlab',
  'trust:setup-circleci',
)
```

Capability support returns data, not thrown absence:

```ts
export const UnsupportedCapabilityReason = Schema.Literals(
  'not-documented',
  'binary-missing',
  'subcommand-missing',
  'flag-missing',
  'not-supported-by-provider',
)

export const CapabilityResult = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Supported'),
    capability: PublishCapability,
    provider: Schema.String,
    evidence: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Unsupported'),
    capability: PublishCapability,
    provider: Schema.String,
    reason: UnsupportedCapabilityReason,
    evidence: Schema.Array(Schema.String),
    blockingPlanFields: Schema.Array(Schema.String),
  }),
)
```

Define the capability services:

```ts
export interface PackDriver {
  readonly id: PublishDriverId
  readonly capabilities: ReadonlySet<PublishCapability>
  readonly version: Effect.Effect<DriverVersionProof, PublishingCapabilityError>
  readonly proveSubcommands: (request: SubcommandProofRequest) => Effect.Effect<SubcommandProof, PublishingCapabilityError>
  readonly pack: (request: PackRequest) => Effect.Effect<PackedArtifact, PublishingCapabilityError>
}

export interface PublishInvoker {
  readonly id: PublishDriverId
  readonly capabilities: ReadonlySet<PublishCapability>
  readonly dryRunPublish: (request: PublishRequest) => Effect.Effect<PublishDryRunProof, PublishingCapabilityError>
  readonly publish: (request: PublishRequest) => Effect.Effect<PublishReceipt, PublishingCapabilityError>
}

export interface RegistryClient {
  readonly viewPackageVersion: (request: VersionQuery) => Effect.Effect<Option.Option<VersionProof>, PublishingCapabilityError>
  readonly viewPackageVersions: (request: BatchVersionQuery) => Effect.Effect<ReadonlyArray<VersionProof>, PublishingCapabilityError>
  readonly viewDistTags: (request: DistTagQuery) => Effect.Effect<DistTagProof, PublishingCapabilityError>
  readonly viewManyDistTags: (request: BatchDistTagQuery) => Effect.Effect<ReadonlyArray<DistTagProof>, PublishingCapabilityError>
  readonly access: (request: AccessQuery) => Effect.Effect<AccessProof, PublishingCapabilityError>
  readonly accessMany: (request: BatchAccessQuery) => Effect.Effect<ReadonlyArray<AccessProof>, PublishingCapabilityError>
}

export interface CredentialProvider {
  readonly whoami: (request: WhoamiRequest) => Effect.Effect<AuthIdentityProof, PublishingCapabilityError>
  readonly resolveOtp: (request: OtpRequest) => Effect.Effect<Option.Option<OtpSecret>, PublishingCapabilityError>
}

export interface TrustedPublisherAdmin {
  readonly trustedPublishers: (request: TrustedPublisherQuery) => Effect.Effect<TrustedPublisherProof, PublishingCapabilityError>
  readonly setupTrustedPublisher: (request: TrustedPublisherSetup) => Effect.Effect<TrustedPublisherProof, PublishingCapabilityError>
}
```

Provider ownership:

- The product-facing service types live in `@kitz/release`.
- npm command construction remains in an expanded `@kitz/npm-registry` backend to preserve the existing package boundary.
- pnpm and Bun command construction lives in new package-manager backend modules under `@kitz/release` until a dedicated package exists.
- `@kitz/release` composes these backends into product capabilities.

Provider implementations:

- npm provider delegates to `@kitz/npm-registry` for pack, publish, registry, credential, and trusted-publisher admin.
- pnpm provider shells to `pnpm` for pack and publish, and uses the npm registry client for registry reads unless an npm-compatible registry client is configured explicitly.
- Bun provider shells to `bun` for pack and publish, and uses the npm registry client for registry reads unless an npm-compatible registry client is configured explicitly.
- test-only fake provider uses in-memory fixtures and fake registry state and cannot be selected by production `PublishProfile`.

Registry clients batch reads when the registry protocol can support it and cache observations per plan digest. The target proof/read cost is one registry metadata pass per package before publish and one observation pass per package after publish, with shared dist-tag/access reads reused by every rule in that plan.

Capability matrix invariants:

- The matrix is code, not prose.
- Every `PublishCapability` atom appears in the generated matrix.
- Every generated row records owner service, provider support, evidence source, and conformance test.
- A provider row can be `supported` or `unsupported`.
- `publish:folder` is intentionally represented as a provider capability even though deterministic apply rejects it through `PublishIntent.artifacts`. The product proves the folder path is not selected for deterministic release execution.
- `publish:summary-real` is a post-mutation receipt capability. It is not a rehearsal capability and cannot satisfy artifact-exact rehearsal.
- Registry and trust rows are owned by `RegistryClient` and `TrustedPublisherAdmin`, not by npm/pnpm/Bun publish invokers.

```ts
export class CapabilityMatrixRow extends Schema.Class<CapabilityMatrixRow>('CapabilityMatrixRow')({
  capability: PublishCapability,
  owner: Schema.Literals(
    'tool',
    'pack-driver',
    'publish-invoker',
    'registry-client',
    'credential-provider',
    'trusted-publisher-admin',
  ),
  providers: Schema.Record(
    Schema.String,
    Schema.Literals('supported', 'unsupported'),
  ),
  evidence: Schema.Array(Schema.String),
  conformance: Schema.Array(Schema.String),
}) {}
```

### Tests

- `publisher/models/capability.test.ts`: capability union rejects unknown strings.
- `publisher/models/capability.test.ts`: generated matrix has exactly one row for every capability atom.
- `publisher/models/capability.test.ts`: every row has owner, evidence, and conformance entries.
- `publisher/drivers/npm.test.ts`: command construction covers pack, dry-run publish, publish with otp/provenance/registry/tag/access, trust list, access list.
- `publisher/drivers/npm.test.ts`: trust setup is unavailable when the selected npm binary fails `npm trust list --help`, even if `npm --version` is high enough.
- `publisher/drivers/pnpm.test.ts`: command construction covers `--report-summary`, `--json`, `--otp`, `--provenance`, `--dry-run`.
- `publisher/drivers/bun.test.ts`: command construction covers `--dry-run`, `--otp`, `--auth-type`, `--tolerate-republish`, and `--registry`; `publish:ignore-scripts` is unsupported for Bun publish and deterministic apply relies on prepacked tarball publishing instead.
- `publisher/drivers/conformance.test.ts`: every provider either implements an advertised capability or returns a typed `CapabilityResult.Unsupported`.
- `publisher/registry-client.test.ts`: proof rules share cached registry observations inside one plan digest.

## Feature 2: Frozen Publish Intent In The Plan

### Problem

The current plan captures release items but not the publish contract. `release apply` re-loads config and resolves publishing semantics at execution time.

### Product Requirement

`release plan` must write a plan that is complete enough for `release apply` to execute without reinterpreting release semantics from mutable config. Package-manager detection may seed a default, but it is never the authoritative publish contract.

### Implementation

Extend `Plan` with:

```ts
schemaVersion: Schema.Literal(2)
planDigest: PlanDigest
signingProfileId: Schema.String
source: PlanSourceSnapshot
publishIntent: PublishIntent
proofPolicy: ProofPolicy
```

Define plan identity and unavailable intent:

```ts
export class PlanBody extends Schema.Class<PlanBody>('PlanBody')({
  schemaVersion: Schema.Literal(2),
  signingProfileId: Schema.String,
  source: PlanSourceSnapshot,
  publishIntent: PublishIntent,
  proofPolicy: ProofPolicy,
}) {}

export class PlanDigest extends Schema.Class<PlanDigest>('PlanDigest')({
  algorithm: Schema.Literal('sha256'),
  value: Schema.String,
}) {}

export class DetachedSignature extends Schema.Class<DetachedSignature>('DetachedSignature')({
  algorithm: Schema.Literals('sigstore-keyless', 'ssh-signature', 'gpg'),
  signer: Schema.String,
  signature: Schema.String,
}) {}

export class PlanEnvelope extends Schema.Class<PlanEnvelope>('PlanEnvelope')({
  schemaVersion: Schema.Literal(1),
  digest: PlanDigest,
  body: PlanBody,
  signature: DetachedSignature,
}) {}

export class PrincipalRef extends Schema.Class<PrincipalRef>('PrincipalRef')({
  kind: Schema.Literals('human', 'bot', 'oidc-subject', 'npm-account', 'github-user', 'github-app', 'ssh-key', 'gpg-key'),
  id: Schema.String,
}) {}

export class TrustRootRef extends Schema.Class<TrustRootRef>('TrustRootRef')({
  id: Schema.String,
  source: Schema.Literals('user-config', 'org-registry', 'protected-git-ref', 'sigstore-issuer'),
  location: Schema.String,
  digest: Digest.Schema,
}) {}

export class SigningIdentityProfile extends Schema.Class<SigningIdentityProfile>('SigningIdentityProfile')({
  id: Schema.String,
  keySource: Schema.Literals('ssh-agent', 'keychain', 'sigstore-oidc', 'gpg-keyring'),
  trustRoot: TrustRootRef,
  allowedSigners: Schema.Array(PrincipalRef),
  revokedSigners: Schema.Array(PrincipalRef),
  requiredSignatures: Schema.Number,
}) {}

export class PlanIntentUnavailable extends Schema.TaggedClass<PlanIntentUnavailable>()('PlanIntentUnavailable', {
  reason: Schema.Literals(
    'unsupported-package-manager',
    'missing-publish-profile',
    'missing-registry-profile',
    'missing-credential-intent',
    'missing-git-remote',
    'missing-github-target',
  ),
  detail: Schema.String,
}) {}
```

`PlanDigest` is computed over canonical `PlanBody`, not over `PlanEnvelope`. `planDigest` is not a self-attesting field inside the hashed body. `release plan` writes the digest outside the body in `PlanEnvelope.digest` and writes a detached signature in `PlanEnvelope.signature`. Proofs, artifacts, journals, locks, and archive bundles reference `PlanEnvelope.digest`.

The signing trust root is not defined by the release config being released. Release config may request `signingProfileId`, but it cannot define allowed signing keys, trust roots, revocations, or signature quorum. `release apply` loads the expected `SigningIdentityProfile` from external operator or organization trust configuration, rejects the plan if `PlanBody.signingProfileId` differs from that expected profile, verifies that the loaded trust root digest matches `TrustRootRef.digest`, and rejects the plan when the digest sidecar, envelope digest, signature, signer allowlist, revocation list, or signature quorum does not verify. This prevents a source change from adding or selecting its own signing key and then satisfying plan verification with that same source change.

`sigstore-keyless` signatures verify issuer and subject claims against the selected `SigningIdentityProfile`. `ssh-signature` signatures verify against public keys from the external trust root. `gpg` signatures verify against keys from the external trust root, not against the operator's ambient keyring trust.

Define registry and host profiles:

```ts
export class RegistryProfile extends Schema.Class<RegistryProfile>('RegistryProfile')({
  id: Schema.String,
  protocol: Schema.Literals('npm-registry-api'),
  url: Schema.String,
  authKind: Schema.Literals('npm-token', 'oidc-trusted-publisher', 'basic', 'bearer-token'),
  strictSsl: Schema.Boolean,
  caFile: Schema.optional(Fs.Path.AbsFile.Schema),
  trustedPublisherAdmin: Schema.optional(Schema.String),
}) {}

export class GithubHostProfile extends Schema.Class<GithubHostProfile>('GithubHostProfile')({
  id: Schema.String,
  kind: Schema.Literals('github.com', 'github-enterprise'),
  apiUrl: Schema.String,
  webUrl: Schema.String,
  oidcIssuer: Schema.optional(Schema.String),
}) {}
```

The product target is npm-protocol-compatible registries. npmjs.org trusted-publisher administration is modeled through `TrustedPublisherAdmin`. Private npm-compatible registries use `RegistryProfile` for URL, TLS, and auth shape; they do not inherit npmjs.org trust/provenance semantics unless a provider supplies documented proof.

Define `PublishIntent`:

```ts
export class PublishProfile extends Schema.Class<PublishProfile>('PublishProfile')({
  id: Schema.String,
  packDriver: PublishDriverId,
  publishInvoker: PublishDriverId,
  registryClient: Schema.String,
  credentialProvider: Schema.String,
  trustedPublisherAdmin: Schema.optional(Schema.String),
}) {}

export class PublishIntent extends Schema.Class<PublishIntent>('PublishIntent')({
  profile: PublishProfile,
  registry: RegistryProfile,
  access: Schema.Union(
    Schema.Struct({ mode: Schema.Literal('omit') }),
    Schema.Struct({ mode: Schema.Literal('publish-access'), value: Schema.Literals('public', 'restricted') }),
  ),
  lifecycle: LifecycleSchema,
  channel: PublishChannel,
  distTag: Schema.String,
  prerelease: Schema.Boolean,
  forcePushTag: Schema.Boolean,
  githubReleaseStyle: Schema.Literals('versioned', 'dist-tagged'),
  auth: AuthIntent,
  provenance: ProvenanceIntent,
  artifacts: ArtifactPolicy,
  git: GitSideEffectIntent,
  github: GithubReleaseIntent,
}) {}
```

Dist-tag rule: when `prerelease` is true, `distTag` cannot be `latest` unless the plan carries `allowPrereleaseLatest: true` in explicit publish intent. Auto-detected defaults never choose `latest` for prereleases.

Define proof policy:

```ts
export class ProofPolicy extends Schema.Class<ProofPolicy>('ProofPolicy')({
  requiredStatuses: Schema.Array(ProofStatus),
  authProofTtlSeconds: Schema.Number,
  registryProofTtlSeconds: Schema.Number,
  maxClockSkewSeconds: Schema.Number,
  defaultRecheckMode: Schema.Literals('pre-apply', 'pre-each-mutation', 'pre-apply-and-on-mutation-failure'),
  hostDeferral: Schema.Struct({
    allowed: Schema.Boolean,
    runtimeHosts: Schema.Array(RuntimeHost),
  }),
  byteVerifyRegistryTarball: Schema.Literals('always', 'official-only', 'never'),
}) {}
```

> Superseded: the shipped `ProofPolicy` has no `defaultRecheckMode` field. The
> recheck-mode taxonomy was replaced by observation-layer recheck — see the
> "Superseded: proof recheck policy" note below.

`official` lifecycle plans default `byteVerifyRegistryTarball` to `always`. `ephemeral` lifecycle plans may use `official-only` or `never` only when the plan marks registry tarball byte equality as non-blocking.

Proof policy defaults:

| Registry auth kind | Runtime host | auth proof TTL | registry proof TTL | max clock skew |
| --- | --- | --- | --- | --- |
| `npm-token` | `local-interactive` | 24h | 1h | 5m |
| `npm-token` | `local-unattended` | 1h | 30m | 5m |
| `oidc-trusted-publisher` | CI host | 10m | 10m | 2m |
| `basic` or `bearer-token` | any local host | 1h | 30m | 5m |

Proofs from the future beyond `maxClockSkewSeconds` are invalid. Journal timestamps must be monotonic per plan digest except for explicitly recorded clock-skew corrections.

Proof recheck policy:

> Superseded: the per-record `recheckMode` taxonomy below was not shipped.
> Recheck is now spliced at the observation layer: a recheck gathers whatever
> fresh observations it can (the pre-mutation hook gathers local surfaces; apply
> gathers local + GitHub), overlays them onto the observations reconstructed from
> the prior artifact's evidence, and rebuilds the whole artifact through one pure
> `makeProofArtifact` pass. There is no per-proof recheck-mode routing; see
> `packages/release/src/api/proof.ts` (`recheckProof`, `mergeObservations`,
> `priorObservationsFromArtifact`). The table is retained as the original design
> intent only.

| Proof family | Recheck mode | Reason |
| --- | --- | --- |
| credential token validity, OTP freshness, OIDC token claims | `pre-each-mutation` | credentials can expire or be revoked during a long apply |
| package access, dist-tag mutability, registry write permissions | `pre-apply-and-on-mutation-failure` | registry state can drift; failed mutation must record fresh observed state |
| tool binary path, subcommand availability, lockfile/config/source digests | `pre-apply` | these are local frozen inputs and must not change during apply |
| runtime-host deferral | `pre-each-mutation` on the host that discharges it | the host claim must be current for each publish mutation |

Define `PlanSourceSnapshot`:

```ts
export class PlanSourceSnapshot extends Schema.Class<PlanSourceSnapshot>('PlanSourceSnapshot')({
  headSha: Git.Sha.Sha,
  trunk: Schema.String,
  releaseConfigDigest: Digest.Schema,
  releaseConfigDigestSource: Schema.Literals('canonical-effective-config'),
  lockfiles: Schema.Array(Schema.Struct({
    path: Fs.Path.RelFile.Schema,
    digest: Digest.Schema,
  })),
  packageManager: Schema.Struct({
    name: Schema.String,
    version: Schema.String,
    binary: Fs.Path.AbsFile.Schema,
    subcommands: Schema.Record(Schema.String, Schema.Boolean),
  }),
  toolVersions: Schema.Record(Schema.String, Schema.String),
}) {}
```

`releaseConfigDigest` is the SHA-256 digest of the schema-decoded, default-applied, secret-redacted effective release config rendered with RFC 8785 JSON Canonicalization Scheme. Strings are normalized to Unicode NFC before canonicalization. Multiline config text is normalized to LF line endings before decoding. Secret redaction happens during schema decode; the redacted placeholder participates in the canonical bytes. Source file byte digests may be stored as debug metadata, but they are not the execution contract because imports/defaults can change the effective config without changing a single release config file.

Change `release plan`:

- Load release config once.
- Resolve publish semantics once.
- Resolve `PublishProfile` from product-owned release config. Package-manager detection can propose a default profile only when config omits one; the chosen profile is displayed and persisted.
- Capture tool versions, resolved binary paths, and required subcommand proofs.
- Capture `release.config.ts` digest.
- Capture lockfile digests for every lockfile that can affect selected packages.
- Capture head SHA.
- Write `publishIntent` into the plan.

All plan producers use the same resolver:

- `release plan`
- `release doctor` when it synthesizes lifecycle plans for audit
- `release pr preview`
- `release ui`
- any direct call to `Planner.official`, `Planner.candidate`, or `Planner.ephemeral` through CLI-facing helpers

The implementation adds `Api.Planner.withPublishIntent(plan, context)` and changes CLI helpers so no command can synthesize a plan without either attaching `PublishIntent` or explicitly returning `PlanIntentUnavailable`.

`PublishIntent` derivation:

| Field | Source | Missing-value behavior |
| --- | --- | --- |
| `profile` | `config.publishProfiles[config.defaultPublishProfile]`; if absent, `Config.defaultPublishProfileForDetectedManager` creates a visible default | default is persisted; unsupported detected managers produce `PlanIntentUnavailable` |
| `registry` | `config.registryProfiles[profile.registryProfile]`, then package `publishConfig.registry` lifted into an npm-registry profile, then npmjs.org default profile | always persisted |
| `access` | package `publishConfig.access`, then profile default access, otherwise `omit` for existing packages where the registry access state should not be changed | unscoped packages cannot persist restricted access; new scoped public packages must persist `public`; existing packages may persist `omit` |
| `channel` and dist-tag | existing `Publishing.resolvePublishSemanticsForPlan` output | always persisted |
| `distTag` for prerelease | publish semantics output plus explicit prerelease override | `latest` is rejected for prerelease unless explicitly allowed in publish intent |
| `auth` | profile credential intent | missing auth intent fails planning |
| `provenance` | profile provenance policy | missing policy defaults to `none` only when `required === false` |
| `artifacts` | profile artifact policy | defaults to isolated artifact builder |
| `git` | profile git policy plus current remote/trunk config | missing remote fails planning |
| `github` | profile GitHub release policy plus resolved repo target | missing repo target fails planning for lifecycles that create GitHub releases |

Change `release apply`:

- Remove publish semantic resolution from live config.
- Validate that current config digest, head SHA policy, package-manager version policy, resolved binary paths, tool versions, and required subcommand proofs satisfy `plan.source`.
- Validate that every current lockfile digest matches `plan.source.lockfiles` before rehearse or apply.
- Pass `plan.publishIntent` to executor.
- Archive the immutable plan to `.release/plans/<planDigest>.json` on success instead of deleting the only plan copy. The active `.release/plan.json` pointer may be cleared, but reconcile/status/history keep the archived plan.

Change `release status`, `release resume`, and `release graph`:

- Load the active or `--from` plan.
- Resolve workflow identity from `plan.planDigest`.
- Do not recompute identity from live config, CLI tag flags, or current publish settings.
- Show a hard error if a v1 plan lacks `planDigest` and the command requires v2 execution state. v1 plans are intentionally not migrated because they did not capture publish intent, proof policy, source lockfiles, or toolchain identity; the operator action is to run `release plan` again.

### Tests

- `planner/models/plan-v2.test.ts`: v2 plan round-trips and rejects missing publish intent.
- `cli/commands/plan.test.ts`: generated plan includes publish profile, registry, dist-tag, auth, provenance, config digest, head SHA, resolved binary path, and required subcommand proofs.
- `cli/commands/plan.test.ts`: generated plan includes lockfile digests and canonical effective config digest.
- `cli/commands/plan.test.ts`: private npm-compatible registries persist a `RegistryProfile` and do not inherit npmjs.org trusted-publisher semantics.
- `cli/commands/plan.test.ts`: package-manager detection can seed a profile but does not override explicit product config.
- `cli/commands/apply.test.ts`: apply uses `plan.publishIntent`, not current config.
- `cli/commands/apply.test.ts`: lockfile drift blocks rehearse/apply.
- `cli/commands/status.test.ts`: status identity is derived from plan digest.
- `cli/commands/resume.test.ts`: resume identity is derived from plan digest and archived plan state.
- `cli/commands/graph.test.ts`: graph identity and labels use frozen publish intent.
- `executor/execute.test.ts`: execution id changes when publish intent changes.
- `planner/store.test.ts`: plan digest is stable across key ordering and changes when any publish intent field changes.
- `planner/store.test.ts`: successful apply archives plan by digest and clears only the active pointer.

## Feature 3: Plan-Bound Proof Model

### Problem

Doctor reports are useful but not a persisted proof artifact. Deferred checks are rendered to the operator but are not bound to the plan as typed obligations.

### Product Requirement

Every release plan has a proof artifact. `release apply` requires a current passing proof unless it is run with `--prove` to refresh it inline.

### Implementation

Add:

- `packages/release/src/api/proof/models/proof.ts`
- `packages/release/src/api/proof/models/obligation.ts`
- `packages/release/src/api/proof/store.ts`
- `packages/release/src/api/proof/check.ts`

Define proof statuses:

```ts
export const ProofStatus = Schema.Literals('proven', 'failed', 'unprovable', 'deferredToHost', 'blocked')
export const ProofRecheckMode = Schema.Literals('pre-apply', 'pre-each-mutation', 'pre-apply-and-on-mutation-failure')
```

> Superseded: `ProofRecheckMode` was not shipped. Recheck is spliced at the
> observation layer, not routed per record — see the "Superseded: proof recheck
> policy" note above.

Define a proof record:

```ts
export class ProofTransition extends Schema.Class<ProofTransition>('ProofTransition')({
  from: Schema.optional(ProofStatus),
  to: ProofStatus,
  at: Schema.String,
  reason: Schema.String,
}) {}

export class ProofRecord extends Schema.Class<ProofRecord>('ProofRecord')({
  id: ProofId,
  status: ProofStatus,
  dependsOn: Schema.Array(ProofId),
  recheckMode: ProofRecheckMode,
  observedAt: Schema.String,
  expiresAt: Schema.optional(Schema.String),
  evidence: Schema.Record(Schema.String, Schema.Unknown),
  proofHistory: Schema.Array(ProofTransition),
}) {}
```

> Superseded: the shipped `ProofRecord` carries no `recheckMode` field (it does
> add a `blockedBy` cascade root-cause reference instead). Recheck is spliced at
> the observation layer — see the "Superseded: proof recheck policy" note above.

Define a deferred obligation:

```ts
export class DeferredProof extends Schema.TaggedClass<DeferredProof>()('DeferredProof', {
  id: ProofId,
  requirement: Schema.String,
  dischargingRuntime: RuntimeHost,
  expectedEvidence: Schema.Array(Schema.String),
}) {}
```

Proof semantics:

- `proven`: the current runtime produced positive evidence.
- `failed`: the current runtime produced negative evidence.
- `unprovable`: the selected tool/platform exposes no documented read-only proof surface for this requirement.
- `deferredToHost`: the requirement can be proven only inside a named runtime host, and the plan explicitly permits that host.
- `blocked`: this proof did not run because a dependency proof failed, was unprovable, or was deferred to a different host.

Only host-bound OIDC checks may use `deferredToHost`. Local unattended publishing fails on `unprovable`.

Proof dependency semantics:

- Every proof record declares `dependsOn`.
- A dependent proof runs only after every dependency is `proven` or correctly `deferredToHost` for the same runtime host.
- When a dependency is `failed`, `unprovable`, or wrongly deferred, the dependent proof records `blocked` with the prerequisite proof id.
- Operator output groups blocked proofs under the root failing proof so the failure shape reports one root cause instead of a flat cascade.
- Legal proof transitions are append-only: no status mutation in place. A new run appends `ProofTransition` entries. Allowed transitions are unrun to any terminal observed status, `deferredToHost` to `proven` or `failed` on the named host, and any prior status to a newer observed status from a new proof run with a later `observedAt`.

`release doctor` behavior:

- Existing text output stays.
- `--format json` includes proof status and obligations.
- It renders the proof engine for humans but never writes proof files.

`release prove` behavior:

- Runs the same engine as doctor.
- Writes `.release/proofs/<planDigest>.json`.
- Is the only command that writes plan-bound proof artifacts.

Lint integration:

- Add `packages/release/src/api/proof/from-lint.ts`.
- Map current lint `Finished` values with violation absence to `proven`.
- Map current lint `Finished` values with error-severity violations to `failed`.
- Map current `env.publish-channel-ready` deferred metadata to `deferredToHost` only when the frozen `PublishIntent` names the same runtime host.
- Publish-related lint rules are migrated from direct `NpmRegistry.Cli` calls to `RegistryClient`, `CredentialProvider`, and proof services.

`release apply` behavior:

- Reads `.release/proofs/<planDigest>.json`.
- Fails before side effects if missing, stale, failed, unprovable, or deferred for the wrong runtime.
- `--prove` runs proof checks before execution and writes proof.
- Before each external mutation, re-derives the proof against freshly gathered observations and merges it onto the prior artifact (`recheckProof`), then re-gates. There is no per-proof `recheckMode`; the whole artifact is rebuilt from one observation epoch so it stays internally consistent by construction.
- On mutation failure, the same observation-layer recheck runs before reconcile classifies the failure.

### Tests

- `proof/models/proof.test.ts`: proof schema round-trips all statuses.
- `proof/models/proof.test.ts`: proof dependency DAG blocks dependents and reports the root failed prerequisite.
- `proof/models/proof.test.ts`: proof histories reject in-place mutation and accept append-only transitions.
- `proof/check.test.ts`: deferred proofs require matching runtime host.
- `proof/check.test.ts`: proof recheck mode runs credential proofs before each mutation and tool proofs only before apply.
- `proof/from-lint.test.ts`: lint reports adapt to plan-bound proof statuses.
- `lint/rules/env-npm-authenticated.test.ts`: migrated rule uses `CredentialProvider`, not `NpmRegistry.Cli`.
- `lint/rules/plan-versions-unpublished.test.ts`: migrated rule uses `RegistryClient`, not `NpmRegistry.Cli`.
- `cli/commands/doctor.test.ts`: doctor renders proof status but does not write proof files.
- `cli/commands/prove.test.ts`: prove writes plan-bound proof.
- `cli/commands/apply.test.ts`: stale proof blocks apply.
- `cli/commands/apply.test.ts`: GitHub Actions discharges trusted OIDC deferred proof only when signed OIDC claims verify against the plan.

## Feature 4: Artifact-Exact Rehearsal Command

### Problem

Current dry-run is an output preview. It does not prepare artifacts, verify pack contents, run package-manager publish dry-run, or prove external permissions. Package-manager dry-runs are not accepted as a registry acceptance proof; they are only command-shape and pack simulation evidence unless combined with separate registry and permission proofs.

### Product Requirement

Add a local-first rehearsal command that is exact about the artifact that will be published. Remote acceptance remains a separate proof problem handled by registry, credential, Git, and GitHub proof rules.

### Implementation

Add `release rehearse [--from <file>] [--keep-artifacts]`.

Add one `ArtifactBuilder`:

```ts
export interface ArtifactBuilder {
  readonly build: (request: ArtifactBuildRequest) => Effect.Effect<ArtifactManifest, ArtifactBuildError>
}
```

The builder always stages an isolated temporary workspace, applies manifest transforms there, packs there, computes checksums there, and copies the final tarball to `.release/artifacts/<planDigest>/`. It never mutates source package manifests during rehearsal or apply.

Define lifecycle script policy:

```ts
export class ScriptPolicy extends Schema.Class<ScriptPolicy>('ScriptPolicy')({
  default: Schema.Literals('deny', 'allow-listed'),
  allowlist: Schema.Array(Schema.Struct({
    packageName: Pkg.Moniker.FromString,
    script: Schema.Literals('prepack', 'prepare', 'postpack', 'prepublishOnly'),
    commandSha256: Digest.Schema,
    packageSourceDigest: Digest.Schema,
  })),
  envAllowlist: Schema.Array(Schema.String),
  network: Schema.Literals('deny-enforced', 'declared-deny', 'allow'),
}) {}
```

Define engine policy:

```ts
export class EnginePolicy extends Schema.Class<EnginePolicy>('EnginePolicy')({
  node: Schema.Literals('match-runtime', 'allow-compatible-range'),
  packageManager: Schema.Literals('match-plan', 'allow-compatible-range'),
}) {}

export class ArtifactPolicy extends Schema.Class<ArtifactPolicy>('ArtifactPolicy')({
  scriptPolicy: ScriptPolicy,
  enginePolicy: EnginePolicy,
  forbiddenFilePatterns: Schema.Array(Schema.String),
  deterministicApply: Schema.Literal(true),
}) {}
```

Deterministic release profiles default to `default: 'deny'`, empty `allowlist`, empty `envAllowlist`, `network: 'deny-enforced'`, and forbidden file patterns for `.npmrc`, `.env`, private keys, PEM files, cloud credential files, and SSH material. Pack-time lifecycle scripts are a supply-chain execution surface, not a package-manager convenience. A script can run only when the plan contains its exact package, script name, command digest, and package source digest. The command digest pins the invocation; the package source digest pins the code available to that invocation. Pack child processes receive a minimal environment without npm tokens, GitHub tokens, OTP values, registry tokens, or arbitrary user env. If the host cannot enforce network denial, proof is `unprovable` for `deny-enforced`; local macOS profiles may choose `declared-deny`, which is rendered as a visible weaker policy and cannot satisfy a profile that requires enforced isolation. If a selected pack driver cannot disable scripts or enforce the script policy, `release prove` returns `unprovable`.

`EnginePolicy` verifies each package's `engines` constraints against the plan runtime and selected package manager before rehearsal. A mismatch fails proof before artifact construction.

Deterministic apply publishes only tarballs built by `ArtifactBuilder`. Folder publish remains a package-manager capability, but it is unsupported for deterministic release execution because it repacks at apply time and breaks checksum reuse.

`ArtifactBuilder` writes canonical tarballs:

- entries are sorted lexicographically by normalized path.
- mtimes are fixed to the plan's canonical artifact timestamp.
- uid, gid, uname, and gname are normalized.
- modes are normalized by file type and executable bit.
- gzip headers use deterministic timestamp and OS fields.
- path names are normalized to POSIX separators and Unicode NFC.
- case-collision checks fail packages that would pack differently on case-sensitive and case-insensitive filesystems.

Execution:

1. Load plan.
2. Validate plan digest and source snapshot.
3. Run all proof checks.
4. Build isolated temporary workspace.
5. Apply manifest transform policy inside the temporary workspace.
6. Pack artifacts to `.release/artifacts/<planDigest>/` under `ScriptPolicy`.
7. Prove selected package-manager invocation context. For non-native drivers, execute from the isolated package cwd or through an explicitly proven package-manager-strict bypass.
8. Read each tarball manifest and packlist.
9. Compute SHA-256 for each tarball.
10. Run driver `dryRunPublish` for each artifact and store it only as command-shape evidence.
11. Read registry version and dist-tags through `RegistryClient`.
12. Check Git tag uniqueness.
13. Run `git push --dry-run origin <tag>` for every planned tag when Git provider supports dry-run proof.
14. Check GitHub release target, existing release-by-tag, actor push proof, and token Contents write proof.
15. Write `.release/artifacts/<planDigest>/manifest.json`.

`release apply` consumes the rehearsal artifacts by checksum. If the checksum differs, apply fails before publish and tells the operator to rerun `release rehearse`.

### Tests

- `cli/commands/rehearse.test.ts`: command writes artifact manifest.
- `executor/rehearse.test.ts`: rehearsal packs real artifacts and does not publish.
- `executor/rehearse.test.ts`: apply rejects mismatched artifact checksum.
- `executor/rehearse.test.ts`: apply can reuse rehearsed artifact when checksum matches.
- `executor/rehearse.test.ts`: source package manifests are unchanged during rehearsal.
- `executor/rehearse.test.ts`: deterministic apply rejects folder publish.
- `executor/rehearse.test.ts`: pack-time lifecycle scripts are blocked by default.
- `executor/rehearse.test.ts`: allowlisted lifecycle script must match package, script name, and command digest.
- `executor/rehearse.test.ts`: allowlisted lifecycle script fails when package source digest changes.
- `executor/rehearse.test.ts`: enforced network denial is unprovable on hosts without an enforcement backend.
- `executor/rehearse.test.ts`: packlist containing forbidden secret files fails rehearsal.
- `executor/rehearse.test.ts`: canonical tarball output is stable across filesystem order, mtimes, owner/group metadata, and gzip headers.
- `executor/rehearse.test.ts`: pack child processes do not receive publish tokens, GitHub tokens, OTP values, or arbitrary user env.
- `executor/rehearse.test.ts`: package `engines` mismatch fails before artifact construction.
- `publisher/invocation-context.test.ts`: pnpm cannot run from a Bun-rooted repo unless the isolated package cwd or strict bypass proof succeeds.
- `publisher/drivers/npm.test.ts`: npm dry-run command includes tarball path, tag, registry, access, otp/provenance when requested.
- `publisher/drivers/pnpm.test.ts`: pnpm dry-run captures JSON when available and does not treat `--report-summary` as a rehearsal receipt.
- `publisher/drivers/bun.test.ts`: Bun dry-run captures publish simulation output and records unsupported JSON output as a capability gap.

## Feature 5: Credential, Access, And Permission Proofs

### Problem

`npm whoami` proves identity only. It does not prove package write access, scope write access, access-level validity, trusted-publisher configuration, Git push permission, or GitHub release permission. npm's documented access CLI can set MFA policy but does not document a read command for package MFA policy, so MFA pre-read is `unprovable` unless another documented source is added.

### Product Requirement

Proofs must distinguish:

- Identity is known.
- Identity can publish this package.
- Identity can set the requested package access.
- Identity can provide OTP when the registry asks for it.
- Runtime has Git remote write access.
- Runtime has GitHub release permission.

### Implementation

Add proof rules:

- `env.publish.identity`
- `env.publish.package-access`
- `env.publish.access-level`
- `env.publish.mfa-policy`
- `env.git.push-dry-run`
- `env.github.release-permission`

Credential and registry implementation:

- `whoami`: `npm whoami --registry`.
- `access`: `npm access list packages <user-or-scope> --json`, `npm access list collaborators <package> --json`, and `npm access get status <package> --json`.
- `mfa`: no documented npm CLI read proof is used. If the plan is unattended and no OTP source is configured, proof status is `unprovable`. If the plan allows interactive local auth, proof records that OTP can be supplied only after a registry challenge.

Git proof:

- For each tag, run `git push --dry-run <remote> refs/tags/<tag>:refs/tags/<tag>`.
- For multi-tag releases, prove `git push --atomic` support and execute one atomic tag push. If the remote does not support atomic push, multi-tag official release is `unprovable`; single-tag release may use the per-tag push path.
- Treat a nonzero exit as `failed`.
- Capture stdout/stderr in proof detail.

GitHub proof:

- Split actor and token proof:
  - actor push proof verifies the authenticated actor has repository push access when the API exposes that information.
  - token release proof verifies or attempts a read-only proxy for Contents write capability; if the token permission set cannot be introspected, proof is `unprovable` locally and may be `deferredToHost` only for the named GitHub Actions job.
- Query existing release by tag to classify create/update behavior before execution.
- `GithubReleaseIntent` includes `existingReleasePolicy: 'fail' | 'update-if-owned' | 'adopt-if-matching'`. The default is `fail`. Auto-created releases from tag-push workflows can be adopted only when title/body/tag/target commit match the plan and the policy explicitly says `adopt-if-matching`.
- Require Contents write for create/update release because GitHub documents that create/update release requires Contents write.
- For GitHub Actions, verify effective permissions for the exact publish/release job: `id-token: write` for trusted OIDC and `contents: write` for release creation. Top-level and job-level `permissions` are evaluated together because GitHub sets unspecified permissions to `none` once any permission map is declared.

### Tests

- `lint/rules/env-publish-package-access.test.ts`: `whoami` pass without access fails package-access.
- `lint/rules/env-publish-access-level.test.ts`: restricted access for unscoped package fails.
- `lint/rules/env-publish-mfa-policy.test.ts`: unattended plan with unprovable MFA/OTP path fails.
- `lint/rules/env-git-push-dry-run.test.ts`: rejected dry-run push fails before publish.
- `lint/rules/env-git-atomic-push.test.ts`: multi-tag official releases require atomic push support.
- `lint/rules/env-github-release-permission.test.ts`: missing Contents write fails before publish.
- `lint/rules/env-github-release-permission.test.ts`: actor push proof and token Contents write proof are independent.
- `lint/rules/env-github-release-existing.test.ts`: existing release by tag follows `existingReleasePolicy`.

## Feature 6: Trusted-Publisher Setup And Verification

### Problem

`github-trusted` is modeled as a release channel, but `release` does not verify npm trusted-publisher configuration through npm's current CLI surface. It only verifies the GitHub Actions runtime environment when already inside the workflow.

### Product Requirement

Trusted publishing must be a product-level setup and proof flow. It must not be buried in documentation or per-repo runbooks.

### Implementation

Add `release trust` command group:

```txt
release trust list [--pkg <name>] [--registry <url>]
release trust setup --provider github --pkg <name> --workflow <file> [--repo <owner/name>] [--env <name>] [--registry <url>]
release trust setup --provider gitlab --pkg <name> --file <path> [--project <namespace/project>] [--env <name>] [--registry <url>]
release trust setup --provider circleci --pkg <name> --org-id <uuid> --project-id <uuid> --pipeline-definition-id <uuid> --vcs-origin <origin> [--context-id <uuid>...] [--registry <url>]
release trust verify --from <plan>
```

Implementation:

- `TrustedPublisherAdmin` implements list/setup through `npm trust list`, `npm trust github`, `npm trust gitlab`, and `npm trust circleci`.
- pnpm and Bun publish invokers do not own trusted-publisher admin. When the registry is npm-compatible, `TrustedPublisherAdmin` is provided by the npm registry admin backend.
- `release trust verify` reads the plan's `PublishIntent.channel`.
- First-publish bootstrap rule: `npm trust` requires an already-published package. A plan for a never-published package cannot use trusted OIDC setup until an initial manual/token publish exists. `release prove` returns `unprovable` with the exact bootstrap reason.
- For GitHub trusted publishing, it verifies:
  - npm version >= `11.10.0` for `npm trust`.
  - the selected npm binary can execute `npm trust list --help`.
  - package already exists before setup.
  - trusted-publisher record matches package, repo, workflow filename, and environment.
  - trusted-publisher record uses the expected GitHub repository URL.
  - workflow filename is under `.github/workflows/` and is stored as a filename where npm requires a filename.
  - publish job effective permissions grant `id-token: write`.
  - release job effective permissions grant `contents: write` when GitHub releases are created by that job.
  - hosted runner requirement is satisfied when using npm trusted publishing.
  - `workflow_call` parent/child permissions are modeled as a proof chain when the publish workflow is reusable.
  - plan provenance policy is compatible with npm's automatic provenance conditions.

Workflow-call proof chain:

```ts
export class WorkflowCallProofLink extends Schema.Class<WorkflowCallProofLink>('WorkflowCallProofLink')({
  workflowFile: Fs.Path.RelFile.Schema,
  jobId: Schema.String,
  caller: Schema.optional(Schema.String),
  effectivePermissions: Schema.Record(Schema.String, Schema.String),
  passesIdTokenWrite: Schema.Boolean,
  passesContentsWrite: Schema.Boolean,
}) {}
```

Every reusable-workflow caller and callee in the publish path contributes one link. The proof is `proven` only when the full chain grants `id-token: write` at the publish job and `contents: write` at the job that creates GitHub releases.

### Tests

- `cli/commands/trust.test.ts`: list/setup/verify commands construct correct npm trust invocations.
- `cli/commands/trust.test.ts`: trust setup fails with an actionable binary/subcommand proof error when `npm trust list --help` fails.
- `cli/commands/trust.test.ts`: unpublished first package fails trusted-publisher setup with bootstrap guidance.
- `publisher/drivers/npm-trust.test.ts`: trust list JSON decodes to typed records.
- `proof/trusted-publisher.test.ts`: workflow mismatch fails.
- `proof/trusted-publisher.test.ts`: missing `id-token: write` fails for GitHub trusted publishing.
- `proof/trusted-publisher.test.ts`: missing `contents: write` fails when the same job creates GitHub releases.
- `proof/trusted-publisher.test.ts`: non-hosted GitHub runner fails npm trusted publishing.
- `proof/trusted-publisher.test.ts`: private repository with required provenance fails.

## Feature 7: Provenance Policy

### Problem

Current publish execution never passes provenance options and does not model the difference between automatic trusted-publisher provenance and explicit `--provenance` or `--provenance-file`.

### Product Requirement

Provenance is part of release intent. The operator chooses policy once, and `release` proves that the selected driver/runtime can satisfy it.

### Implementation

Define:

```ts
export const ProvenanceMode = Schema.Literals(
  'none',
  'trusted-publisher',
  'cli-flag',
  'attestation-file',
)

export const ProvenanceProvider = Schema.Literals('npm-github', 'npm-gitlab', 'npm-circleci')

export class ProvenanceIntent extends Schema.Class<ProvenanceIntent>('ProvenanceIntent')({
  mode: ProvenanceMode,
  required: Schema.Boolean,
  provider: Schema.optional(ProvenanceProvider),
  file: Schema.optional(Fs.Path.AbsFile.Schema),
}) {}
```

Rules:

- `required: true` with a Bun publish invoker fails because Bun publish docs do not document provenance support.
- `trusted-publisher` with automatic npm provenance requires npm publish invocation, npm trusted-publisher proof, GitHub Actions or GitLab CI/CD provider, public package, and public repository.
- `trusted-publisher` with `provider: 'npm-circleci'` is valid only when `required: false`, because npm documents that CircleCI trusted publishing does not currently include automatic provenance.
- `cli-flag` requires capability `publish:provenance-flag`.
- `attestation-file` requires capability `publish:provenance-file` and an existing provenance bundle path.
- CircleCI trusted publishing is allowed only with `required: false`, because npm docs state CircleCI trusted publishing does not currently include automatic provenance.

Executor:

- npm publish invoker maps `cli-flag` to `npm publish --provenance`.
- npm publish invoker maps `attestation-file` to `npm publish --provenance-file <file>`.
- pnpm publish invoker maps `cli-flag` to `pnpm publish --provenance`.
- Bun publish invoker returns `CapabilityResult.Unsupported`.

### Tests

- `publisher/provenance.test.ts`: required provenance rejects Bun.
- `publisher/provenance.test.ts`: automatic trusted-publisher provenance rejects non-npm publish invocation unless separate source proof is added.
- `publisher/provenance.test.ts`: trusted-publisher provenance rejects private repo.
- `publisher/provenance.test.ts`: CircleCI automatic provenance cannot satisfy `required: true`.
- `publisher/drivers/npm.test.ts`: provenance flag/file command construction.
- `publisher/drivers/pnpm.test.ts`: provenance flag command construction.
- `executor/e2e.test.ts`: apply blocks before publish when proof says provenance is unprovable for the selected profile.

## Feature 8: OTP And Interactive Auth

### Problem

npm, pnpm, and Bun all support OTP. Current `@kitz/release` has no OTP model and no typed distinction between interactive local publishing, environment-provided OTP, and unattended execution.

### Product Requirement

OTP must be explicit in the plan. Unattended execution must never hang on an OTP prompt.

### Implementation

Define:

```ts
export const RuntimeHost = Schema.Literals('local-interactive', 'local-unattended', 'github-actions', 'gitlab-ci', 'circleci')

export const CredentialSource = Schema.Literals('trusted-oidc', 'token-env', 'local-session')

export const OtpPolicy = Schema.Union(
  Schema.Struct({ mode: Schema.Literal('forbidden') }),
  Schema.Struct({ mode: Schema.Literal('env'), env: Schema.String }),
  Schema.Struct({ mode: Schema.Literal('interactive') }),
)

export const CredentialIntent = Schema.Struct({
  source: CredentialSource,
  runtimeHost: RuntimeHost,
  tokenEnv: Schema.optional(Schema.String),
  otpPolicy: OtpPolicy,
  interactiveAllowed: Schema.Boolean,
  secretPersistence: Schema.Literal('never'),
  redaction: Schema.Literal('required'),
})

export const AuthIntent = CredentialIntent.pipe(
  Schema.annotations({ deprecated: true, description: 'Use CredentialIntent.' }),
)
```

Behavior:

- `release plan` writes `CredentialIntent`.
- `release rehearse` fails if package access/MFA policy requires OTP and plan says `forbidden`.
- `release apply --yes` fails if `interactiveAllowed` is true but OTP policy is `interactive`.
- Local `release apply` may prompt only when runtime host is `local-interactive` and `interactiveAllowed` is true.
- Token/OTP values are never persisted. Only env var names and proof status are persisted.
- `RuntimeHost` is matched against cryptographic host evidence for trusted-publisher deferrals. GitHub Actions requires an OIDC token whose issuer and JWKS signature verify and whose repository/workflow/job claims match the plan. GitLab and CircleCI use their provider OIDC/JWT evidence when trusted-publisher deferral is selected. Environment variables are diagnostic context only and never discharge `deferredToHost` by themselves.
- Auth proofs carry `validUntil`. `release apply` treats expired auth, OTP, and token proofs as stale and refreshes them when `--prove` is set.
- Secrets are never passed through process argv. Provider backends use environment config where documented. If a provider exposes only an argv secret path for a required secret, unattended mode is `unprovable` for that provider.
- Child-process spawning goes through a redacting process service. Redaction is field-aware for credential/OTP values, env-var-name aware for configured secret env vars, and pattern-aware for known npm/GitHub token shapes before writing logs, proof files, or journal entries.
- Child processes run with an isolated temporary `HOME`, npm/pnpm/Bun cache, and log directory. Provider backends set npm/pnpm log levels and log destinations to the isolated directory, then scan and redact any retained child logs before they can enter archive exports. The product does not claim to intercept arbitrary writes by a hostile child process outside the isolated workspace; that host-compromise case is outside the threat model.

Driver mappings:

- npm: OTP is passed through npm config environment, not argv.
- pnpm: OTP is passed through `PNPM_CONFIG_OTP`.
- Bun: OTP argv usage is not allowed for unattended mode; interactive local mode may use Bun's prompt/flag path only when redaction proof covers the spawned command.

### Tests

- `auth/otp.test.ts`: values are redacted from proof and logs.
- `auth/redaction.test.ts`: process argv, env, stdout, stderr, proof, and journal entries redact token and OTP values.
- `auth/runtime-host.test.ts`: forged CI environment variables do not discharge trusted-publisher deferral without verified OIDC/JWT claims.
- `auth/child-process-isolation.test.ts`: child npm logs are written only to isolated temp paths and redacted before archive export.
- `auth/proof-ttl.test.ts`: expired auth proof blocks apply unless `--prove` refreshes it.
- `cli/commands/apply.test.ts`: `--yes` with interactive OTP fails before publish.
- `publisher/drivers/npm.test.ts`: OTP config-env command construction.
- `publisher/drivers/pnpm.test.ts`: `PNPM_CONFIG_OTP` is honored.
- `publisher/drivers/bun.test.ts`: OTP and auth-type command construction.

## Feature 9: Artifact Manifest, Packlist, And Checksum Verification

### Problem

The current executor creates tarballs but does not persist what was inside them. Operators cannot inspect an exact artifact contract before publish, and `apply` cannot prove that a rehearsal artifact is the same tarball it publishes.

### Product Requirement

Every rehearsed or prepared package artifact must have a typed artifact manifest.

### Implementation

Define:

```ts
export class ArtifactManifest extends Schema.Class<ArtifactManifest>('ArtifactManifest')({
  packageName: Pkg.Moniker.FromString,
  version: Semver.Schema,
  driver: PublishDriverId,
  tarball: Fs.Path.AbsFile.Schema,
  sha256: Digest.Schema,
  sizeBytes: Schema.Number,
  manifest: Schema.Record(Schema.String, Schema.Unknown),
  packlist: Schema.Array(Fs.Path.RelFile.Schema),
  rewrittenFields: Schema.Array(Schema.String),
  npmRegistryIntegrity: Schema.optional(Schema.String),
  npmRegistryShasum: Schema.optional(Schema.String),
}) {}
```

Add `@kitz/digest` or `packages/release/src/api/digest.ts`:

```ts
export const Digest = Schema.String.pipe(Schema.brand('Digest'))
export const sha256File = (path: Fs.Path.AbsFile) => Effect.Effect<Digest, DigestError, FileSystem.FileSystem>
```

Add tar reading support through a service:

```ts
export interface TarballInspector {
  readonly inspect: (path: Fs.Path.AbsFile) => Effect.Effect<TarballInspection, TarballInspectionError>
}
```

The implementation may use a dependency or a local tar reader, but it is an explicit service because current `npm pack --json` parsing stores only the generated filename.

Define manifest transforms as product policy:

```ts
export const ManifestTransform = Schema.Literals(
  'version',
  'workspace-protocol',
  'runtime-entrypoint',
  'pnpm-catalog-protocol',
  'bun-catalog-protocol',
)

export class ManifestTransformPolicy extends Schema.Class<ManifestTransformPolicy>('ManifestTransformPolicy')({
  transforms: Schema.Array(ManifestTransform),
}) {}
```

Implementation details:

- After pack, open the tarball.
- Read `package/package.json`.
- List tarball entries.
- Compute SHA-256.
- Compare packed manifest against `ManifestTransformPolicy`:
  - version equals planned version.
  - runtime entrypoints are rewritten according to configured entrypoint policy.
  - local workspace dependency specifiers are rewritten to published versions.
  - pnpm catalog specifiers are rewritten through pnpm catalog semantics when `pnpm-catalog-protocol` is enabled.
  - Bun catalog specifiers are rewritten through Bun catalog semantics when `bun-catalog-protocol` is enabled.
  - access and publishConfig policy match `PublishIntent`.
  - packlist includes the files needed by `main`, `module`, `types`, and every package `exports` target that resolves to a file.
  - the actual opened tarball entries, not a predicted package-manager packlist, contain no file matching `ArtifactPolicy.forbiddenFilePatterns`.
- Write `.release/artifacts/<planDigest>/manifest.json`.

### Tests

- `executor/artifact-manifest.test.ts`: tarball manifest is decoded and checked.
- `executor/artifact-manifest.test.ts`: source import target left in tarball fails.
- `executor/artifact-manifest.test.ts`: workspace dependency left in tarball fails.
- `executor/artifact-manifest.test.ts`: Bun catalog specifier left in tarball fails when catalog transform is enabled.
- `executor/artifact-manifest.test.ts`: pnpm and Bun catalog transforms use separate semantics.
- `executor/artifact-manifest.test.ts`: tarball missing main/module/types/exports target files fails.
- `executor/artifact-manifest.test.ts`: tarball containing `.npmrc`, `.env`, private keys, or configured forbidden files fails.
- `executor/artifact-manifest.test.ts`: checksum changes when tarball content changes.
- `executor/e2e.test.ts`: apply publishes only artifacts whose checksums match the proof.

## Feature 10: Execution Journal And Reconciliation

### Problem

The durable workflow can resume suspended work, but there is no domain-level journal of external side effects. If a publish succeeded but local workflow state did not record the next step, the operator needs a product command that can reconcile external reality with the plan. The journal must be the same state source used by status, resume, and reconcile; a second ledger would create disagreement.

### Product Requirement

Every side effect has a durable journal entry with planned input, attempt status, remote observation, and recovery instruction. Workflow activity state and external side-effect receipts live in one `ExecutionJournal`.

### Implementation

Define execution journal:

```ts
export const SideEffectKind = Schema.Literals(
  'registry-publish',
  'registry-dist-tag',
  'git-tag-create',
  'git-tag-push',
  'github-release-create',
  'github-release-update',
)

export class SideEffectEntry extends Schema.Class<SideEffectEntry>('SideEffectEntry')({
  entryId: Schema.String,
  prevEntrySha256: Schema.optional(Digest.Schema),
  entrySha256: Digest.Schema,
  planDigest: PlanDigest,
  kind: SideEffectKind,
  subject: Schema.String,
  idempotencyKey: Schema.String,
  planned: Schema.Record(Schema.String, Schema.Unknown),
  attemptedAt: Schema.String,
  result: SideEffectResult,
}) {}

export class FailureObservation extends Schema.Class<FailureObservation>('FailureObservation')({
  at: Schema.String,
  provider: Schema.String,
  category: Schema.Literals('auth', 'permission', 'not-found', 'conflict', 'rate-limit', 'network', 'provider-5xx', 'unknown'),
  statusCode: Schema.optional(Schema.Number),
  bodyExcerpt: Schema.optional(Schema.String),
  retryAfterSeconds: Schema.optional(Schema.Number),
}) {}

export class ExecutionPrincipals extends Schema.Class<ExecutionPrincipals>('ExecutionPrincipals')({
  invoker: PrincipalRef,
  planSigner: PrincipalRef,
  publisher: Schema.optional(PrincipalRef),
  runtimeHost: Schema.optional(PrincipalRef),
  gitHubActor: Schema.optional(PrincipalRef),
  lockOwner: PrincipalRef,
}) {}

export class ExecutionJournal extends Schema.Class<ExecutionJournal>('ExecutionJournal')({
  planDigest: PlanDigest,
  workflowExecutionId: Schema.String,
  lock: ExecutionLock,
  principals: ExecutionPrincipals,
  activities: Schema.Array(WorkflowActivityEntry),
  sideEffects: Schema.Array(SideEffectEntry),
  observations: Schema.Array(ReconciliationObservation),
  failures: Schema.Array(FailureObservation),
}) {}
```

Define execution lock:

```ts
export class ExecutionLock extends Schema.Class<ExecutionLock>('ExecutionLock')({
  planDigest: PlanDigest,
  owner: PrincipalRef,
  ownerHost: Schema.String,
  ownerProcess: Schema.String,
  acquiredAt: Schema.String,
  expiresAt: Schema.String,
  heartbeatAt: Schema.String,
  backend: Schema.Literals('local-file', 'git-remote-ref'),
  remoteRef: Schema.optional(Schema.String),
}) {}
```

Add store:

- `.release/journal/<planDigest>.jsonl`.
- `.release/locks/<planDigest>.lock` for same-checkout mutual exclusion.
- optional remote lock ref `refs/kitz-release-locks/<planDigest>` for shared remote releases.

Executor behavior:

- Acquire `ExecutionLock` before proof refresh, rehearsal reuse, or mutation. Same-checkout collisions fail with `already-running` and include owner host/process. Shared remote release profiles require remote lock-ref creation before registry publish; an existing remote lock fails with `locked-by-remote`.
- Remote lock ref creation is compare-and-create, not best-effort push. Git backends must create `refs/kitz-release-locks/<planDigest>` only when the expected old object is empty, using a host API with expected-old-OID semantics or a Git push lease equivalent. A racing creator that loses observes `locked-by-remote`.
- Locks heartbeat while mutations are in progress. A stale lock can be taken only by `release lock recover --from <plan> --reason <text>`, which writes a journal entry and requires the prior `expiresAt` to have passed. Remote lock recovery for official profiles must be signed by an identity accepted by the selected `SigningIdentityProfile`; if the profile requires disjoint principals, the recovery signer cannot be the prior lock owner. Local-file recovery invalidates fresh proof/artifact eligibility: the next official mutation requires `release prove` and `release rehearse` under the recovered lock before apply can continue. Lock access is advisory unless the Git host can protect the lock namespace; profiles that require enforced distributed locking fail proof when the host cannot provide protected compare-and-create refs.
- Every journal entry is hash chained. `entrySha256` is computed over canonical entry content excluding `entrySha256`; `prevEntrySha256` points to the previous entry for the same plan digest. `release status`, `release resume`, `release reconcile`, and `release archive export` reject journals with a broken chain before trusting any recorded side effect.
- Every side-effect attempt records the active principals. Proof rules may require disjoint principals, such as `planSigner != invoker` or `publisher != planSigner`, and the proof artifact records the exact identities checked.
- All persisted timestamps are UTC RFC 3339 strings with an explicit `Z` offset and are produced through the Effect `Clock` service. Journal monotonicity is checked against the prior entry for the same plan digest, bounded by `ProofPolicy.maxClockSkewSeconds`.
- Before each external mutation, append `attempting`.
- On success, append `succeeded` with receipt.
- On failure, append `failed` with typed error and a `FailureObservation` containing provider, category, status code when available, a redacted body excerpt when available, and retry hints when available.
- Split every irreversible external mutation from its verification node:
  - `Publish:*` mutates registry.
  - `VerifyPublish:*` observes registry and records `RegistryObservation`.
  - `CreateTag:*` mutates local Git.
  - `PushTag:*` mutates remote Git.
  - `VerifyTag:*` observes remote tag.
  - `CreateGHRelease:*` or `UpdateGHRelease:*` mutates GitHub.
  - `VerifyGHRelease:*` observes GitHub release by tag.
- Each mutation and verification node is a separate workflow activity with its own idempotency key derived from `planDigest`, `SideEffectKind`, and subject. The workflow runtime must support these node keys directly; they are not hidden inside one `Publish:*` activity.
- Large monorepo releases run side-effect nodes with bounded concurrency from the plan's execution policy. Status output groups nodes by package and side-effect kind so a 50-package release does not become an unreadable flat list.
- Before running a mutation node, consult `ExecutionJournal`. If the side effect is already observed and matches the plan, skip mutation and move to verification.

Add command:

```txt
release reconcile --from <plan>
```

Reconcile reads:

- selected `RegistryClient` version metadata and dist-tags.
- Git local/remote tags.
- GitHub release by tag.
- Local execution journal.
- Workflow status.

It returns:

- `clean`: all planned side effects exist and match.
- `resume`: missing later side effects after successful earlier side effects. Action: run `release resume --from <plan>`.
- `repair`: remote state differs from plan but has a product-owned repair action. Action: run the printed `release repair ...` command or rerun `release reconcile --explain`.
- `abort`: unsafe mismatch. Action: no mutation command is offered; the operator must change the plan or perform an explicit manual remediation outside `release`.

`release reconcile --explain` output is a deterministic decision report:

- plan digest and selected publish profile.
- ordered state diff between planned side effects, journal entries, and remote observations.
- one decision row per subject with status `clean`, `resume`, `repair`, or `abort`.
- evidence references for every row: journal entry id, registry observation id, Git ref observation, or GitHub release observation.
- the next command when `release` owns the next mutation.
- no next command when the classification is `abort`.

Worked partial-success case:

- Ten package versions are planned.
- Seven package versions are published.
- Network fails before Git tags and GitHub releases.
- `release reconcile --from <plan>` returns `resume` if the seven registry observations match the plan, the remaining three versions are still unpublished, and no tags/releases exist.
- `release resume --from <plan>` skips the seven observed publishes, publishes the remaining three packages, verifies all ten registry observations, then performs one atomic multi-tag push and GitHub release creation.
- If any of the seven published versions has the wrong dist-tag, tarball integrity, or access status, reconcile returns `repair` or `abort` according to whether a product-owned correction exists.

Repair taxonomy:

| Mismatch | Classification | Product-owned action |
| --- | --- | --- |
| Missing registry version before any conflicting state | `resume` | publish missing version from rehearsed tarball |
| Wrong dist-tag target | `repair` | `release repair dist-tag --pkg <name> --version <version> --tag <tag>` |
| Missing dist-tag | `repair` | `release repair dist-tag --pkg <name> --version <version> --tag <tag>` |
| Wrong access status where registry supports change | `repair` | `release repair access --pkg <name> --access <value>` |
| Wrong tarball SHA/integrity | `abort` | no repair; version is immutable, create a forward-fix release |
| Remote Git tag points at wrong SHA | `abort` | no automatic repair; manual policy decision required |
| GitHub release exists and matches adopt policy | `repair` | `release repair github-release --adopt` |
| GitHub release exists and does not match adopt policy | `abort` | no automatic repair |

Retention and forensics:

- Plans, proofs, journals, and artifact manifests are append-only and redacted.
- Tarballs are stored under `.release/artifacts/<planDigest>/` and are not committed by default.
- `release archive export --from <plan>` writes a redacted audit bundle containing plan, proof, journal, artifact manifest, and registry observations.
- `release prune --older-than <duration>` deletes local tarballs and temporary workspaces, never plans/proofs/journals unless `--include-audit` is explicitly passed.
- `release history` lists archived plans by digest, lifecycle, package set, status, and time.
- `release inspect <package>@<version>` resolves the plan digest, registry observation, Git tag, GitHub release, and journal entries for that published version.
- `release inspect <package>@<version>` returns a legitimacy verdict: `registry-matches-journal`, `registry-disagrees-with-journal`, `not-in-journal-but-on-registry`, or `not-on-registry`.

Archive bundle format:

- File extension: `.kitz-release-audit.tgz`.
- Root file: `manifest.json` with `schemaVersion`, `planDigest`, created time, source repository, and file list.
- Payload files: `plan.json`, `proof.json`, `journal.jsonl`, `artifact-manifest.json`, `registry-observations.json`, and optional redacted child-process logs.
- Integrity: `sha256sums.txt` covers every payload file.
- Authenticity: `manifest.json.sig` is a detached signature over canonical `manifest.json` and `sha256sums.txt`.
- Compatibility: every payload has its own `schemaVersion`; archive readers keep a migration registry for old schema versions.

Stored artifact schema policy:

- Every persisted artifact has a top-level `schemaVersion`.
- Every persisted schema is exported from `packages/release/src/api/schema-index.ts`; the index is the source tested by fixture decode tests.
- Decoders tolerate unknown fields.
- Breaking changes add a migration function registered by artifact kind and schema version.
- Append-only journal entries are never rewritten in place; migrations are read-time views.

### Tests

- `executor/journal.test.ts`: every publish/tag/release attempt writes journal entries.
- `executor/journal.test.ts`: journal hash-chain verification rejects edited, deleted, and reordered entries.
- `executor/journal.test.ts`: side-effect failures store redacted provider observations.
- `executor/lock.test.ts`: second same-checkout apply fails with owner details.
- `executor/lock.test.ts`: shared remote release profile fails when remote lock ref already exists.
- `executor/lock.test.ts`: official lock recovery requires accepted recovery signature and fresh proof/rehearsal before the next mutation.
- `executor/workflow.test.ts`: publish and verify are distinct workflow activities with distinct idempotency keys.
- `executor/workflow.test.ts`: disjoint-principal proof fails when signer, invoker, or publisher violate policy.
- `executor/workflow.test.ts`: 50-package release graph builds with bounded concurrency and grouped status output.
- `cli/commands/reconcile.test.ts`: published package plus missing tag returns resume.
- `cli/commands/reconcile.test.ts`: `--explain` renders state diff, evidence ids, decision rows, and next command.
- `cli/commands/reconcile.test.ts`: wrong dist-tag returns repair.
- `cli/commands/reconcile.test.ts`: remote tag at wrong SHA returns abort.
- `cli/commands/reconcile.test.ts`: seven-of-ten published example returns resume when observations match.
- `cli/commands/reconcile.test.ts`: repair taxonomy maps wrong dist-tag, access mismatch, wrong tarball SHA, and wrong tag SHA to the documented status.
- `cli/commands/history.test.ts`: history and inspect read archived plan/proof/journal data.
- `cli/commands/inspect.test.ts`: inspect returns legitimacy verdicts for journal match, journal mismatch, registry-only version, and missing registry version.
- `cli/commands/prune.test.ts`: prune deletes local tarballs but keeps audit records by default.
- `cli/commands/archive.test.ts`: archive export writes `.kitz-release-audit.tgz` with manifest, checksums, payload schema versions, and detached signature.
- `schema/migrations.test.ts`: old persisted artifact schema versions decode through registered migrations.
- `schema/index.test.ts`: every persisted schema is exported by `schema-index.ts`, fixture decoders import from that index, and timestamp fields reject non-UTC or offset-less strings.
- `executor/resume.test.ts`: resume consults the execution journal before rerunning a side effect.
- `executor/resume.test.ts`: publish success followed by verification failure does not republish on resume.

## Feature 11: Post-Publish Registry Verification

### Problem

Current publish success is inferred from process exit code. The registry is not queried after publish to verify package version, dist-tag, tarball metadata, and access placement.

### Product Requirement

Publish is not complete until the registry observation matches the plan.

### Implementation

After each publish:

1. Query exact `package@version`.
2. Query dist-tags.
3. Verify requested dist-tag points to version.
4. Query access status when supported.
5. Query package metadata tarball URL, npm `shasum`, and npm `integrity` when available.
6. For `official` lifecycle, download the registry tarball and compute SHA-256 by default.
7. Record `PublishReceipt`.

Define:

```ts
export class RegistryObservation extends Schema.Class<RegistryObservation>('RegistryObservation')({
  packageName: Pkg.Moniker.FromString,
  version: Semver.Schema,
  registry: Schema.String,
  observedAt: Schema.String,
  versionMetadata: Schema.Record(Schema.String, Schema.Unknown),
  distTags: Schema.Record(Schema.String, Schema.String),
  accessStatus: Schema.optional(Schema.Literals('public', 'private', 'restricted', 'unknown')),
  tarballUrl: Schema.optional(Schema.String),
  shasum: Schema.optional(Schema.String),
  integrity: Schema.optional(Schema.String),
  downloadedTarballSha256: Schema.optional(Digest.Schema),
})

export class PublishReceipt extends Schema.Class<PublishReceipt>('PublishReceipt')({
  tarballSha256: Digest.Schema,
  observation: RegistryObservation,
  expected: Schema.Struct({
    distTag: Schema.String,
    access: Schema.optional(Schema.String),
  }),
}) {}
```

Executor fails before tag creation when post-publish registry verification fails. The execution journal records the publish as remote-observed or unobserved so `release reconcile` can finish or repair. Local SHA-256 is always stored for the rehearsed tarball. Registry `shasum` and `integrity` are stored as registry observations. Official releases download the registry tarball and compare computed SHA-256 to the rehearsed tarball by default; ephemeral releases can opt out only through `ProofPolicy.byteVerifyRegistryTarball`.

### Tests

- `publisher/verify-published.test.ts`: missing version after publish fails.
- `publisher/verify-published.test.ts`: wrong dist-tag fails.
- `publisher/verify-published.test.ts`: access mismatch fails.
- `publisher/verify-published.test.ts`: official lifecycle downloads registry tarball and compares SHA-256 by default.
- `executor/workflow.test.ts`: Git tag is not created until publish receipt verifies.
- `executor/reconcile.test.ts`: publish receipt can be reconstructed from registry state.

## Feature 12: Publishing Provider Conformance Suite

### Problem

Without conformance tests, adding pnpm/Bun support can silently weaken release guarantees.

### Product Requirement

Every publishing provider profile must pass the same contract tests or explicitly declare unsupported capabilities.

### Implementation

Add:

- `packages/release/src/api/publisher/conformance.ts`
- `packages/release/src/api/publisher/fake-registry.ts`
- `packages/release/src/api/publisher/providers/*.contract.test.ts`

Add consumer-runnable command:

```txt
release conformance run --provider <provider-id> [--fixture <path>] [--format text|json]
```

The command runs the same provider contract suite against the selected provider, fake registry, and fixture repository shape used by the package test suite. It never targets the public registry. JSON output includes provider id, capability id, scenario id, result, evidence path, and stable error code.

Conformance scenarios:

- Pack current package.
- Pack package with workspace dependency rewrite.
- Publish tarball with dist-tag.
- Dry-run publish without mutation.
- OTP-required publish.
- Existing version collision.
- Dist-tag verification.
- Provenance-required publish.
- Trusted-publisher-required publish.
- Publish summary/receipt capture.

The fake registry is an Effect service under test support, not a selectable production provider. Tests do not monkeypatch modules. Drivers that shell to real CLIs use a fake `ChildProcessSpawner` and golden command snapshots. `PublishProfile` rejects provider ids whose owner is marked `test-only`.

Fixture repositories:

- npm workspace with no custom release publishing config.
- pnpm workspace with `pnpm-workspace.yaml` and no custom release publishing config.
- Bun workspace with `packageManager: "bun@..."` and no custom release publishing config.
- trusted-publisher GitHub workflow fixture.
- trusted-publisher GitLab workflow fixture.
- trusted-publisher CircleCI fixture.

Every fixture must run:

```txt
release plan
release prove
release rehearse
release preview
```

`release preview` renders the plan and proof summaries without constructing publish artifacts. `release rehearse` is the only local proof command that constructs the exact tarballs eligible for `release apply`.

### Tests

The conformance suite is the test. It fails if a provider profile advertises a capability but does not implement the behavior.

- `cli/commands/conformance.test.ts`: `release conformance run` runs provider contracts with fake registry only and returns schema-versioned JSON.

## Feature 13: Local-First Operator Command Surface

### Problem

The current surface has plan, doctor, apply, status, and resume, but the golden local flow is not explicit enough. `apply --dry-run` sounds stronger than it is.

### Product Requirement

The local command sequence must be short, exact, and product-owned.

### Implementation

Commands:

```txt
release plan
release preview
release prove
release rehearse
release apply
release status
release resume
release reconcile
release repair
release history
release inspect
release archive export
release prune
release init
release validate-setup
release matrix verify
release conformance run
```

Aliases:

- `release doctor` remains as the human-readable audit command.
- `release prove` is the plan-bound proof writer.
- `release rehearse` proves and creates exact artifacts.

Golden local path:

```txt
release plan --lifecycle official
release prove
release rehearse
release apply
```

Single-command local path:

```txt
release apply --prove --rehearse
```

Behavior:

- `release preview` is the only preview command.
- `release apply` has no preview or proof-only mode in the product contract; it only executes a fresh, plan-bound proof and artifact contract.
- `release apply` refuses to publish when proof/artifact manifests are stale.
- `release init` creates product-owned `RegistryProfile`, `PublishProfile`, proof policy, script policy, and local-first command scaffolding without requiring repository-specific runbook prose.
- Any command that fails because release setup is missing prints the exact `release init` command for the detected package manager and lifecycle. `release init` refuses to overwrite existing release profiles unless `--force` is passed.
- `release validate-setup` runs setup proof without producing a release plan. Mechanically, it creates an in-memory synthetic setup plan with no package versions, selected profiles, selected runtime host, and selected trust roots, then runs the proof subset for config shape, toolchain availability, trust-root availability, registry reachability, credential shape, package-manager command surface, and local artifact workspace creation. `--strict` additionally fails on unknown release config fields, stale generated command scaffolding, and root package scripts that shadow product-owned release commands.
- Root shortcut scripts such as `release:apply:ephemeral`, `release:verify`, and `release:build` become optional wrappers, not product requirements. The product-owned replacements are `release plan --lifecycle ephemeral`, `release prove`, `release rehearse`, and profile-owned prepare hooks.
- The existing npm dry-run helper is renamed as a package-manager publish dry-run primitive so it cannot be confused with artifact-exact rehearsal.
- Nested command routing for `release trust ...` is implemented by `packages/release/src/cli/commands/trust.ts`; the file owns subcommand parsing because the current dispatcher routes only the first command token.
- `release matrix verify` executes current known tool binaries and fails when documented capability evidence, local flag proof, and generated matrix rows disagree. It is the maintenance gate for npm/pnpm/Bun version drift.
- `release matrix verify --latest` resolves `npm@latest`, `pnpm@latest`, and `bun@latest` once at command start, installs them in an isolated temp workspace, and compares their actual help/flag surfaces to the generated matrix. Without `--write`, latest drift is a failing report only. With `--write`, the command updates generated matrix evidence and records the resolved package-manager versions. Results are keyed by OS, CPU architecture, package-manager name, and package-manager version so a Linux-only latest proof cannot silently satisfy a macOS local release profile.
- Every operator command supports `--format text|json`. JSON output is schema-versioned and uses the same stable error codes as proof/journal artifacts.
- Stable error codes use `release.<domain>.<condition>`, where `<domain>` is generated from the typed subsystem (`plan`, `proof`, `artifact`, `auth`, `registry`, `git`, `github`, `lock`, `reconcile`, `matrix`, `config`) and `<condition>` is generated from a literal union in that subsystem's error schema. Tests fail on duplicate codes, undocumented codes, and ad hoc string codes.
- Every failed proof, lock, reconcile, and apply result renders a stable `code`, failed proof id, checked evidence, observed value, expected value, and next operator action.
- Emergency override is available only as `release apply --override-proof <proof-id> --reason <text> --approved-by <identity>`. It cannot override artifact checksum mismatch, plan signature failure, wrong registry tarball hash, or remote tag SHA mismatch. Overrides are signed and appended to the execution journal.
- Self-bootstrap rule for `@kitz/release`: the first implementation release that contains this PIP's publishing contract must be executed by the workspace-source `release` binary from the commit being released, not by an older globally installed binary. The plan records `producer.kind: 'workspace-source'`, producer commit, source binary path, and source binary digest. That release still produces a normal signed `PlanEnvelope`; no manual publish waiver is part of the ideal product contract.
- Yank, unpublish, and deprecate workflows are intentionally out of scope for deterministic publish v1. The product supports forward fixes through a new `release plan`; `npm deprecate`/`npm unpublish` style remediation requires a separate recovery PIP because it has different registry policy and approval semantics.
- SBOM generation, vulnerability attestation, and broader SLSA/Sigstore build attestations are intentionally out of scope for deterministic publish v1. This PIP owns publish provenance and artifact equality; richer supply-chain reporting requires a separate artifact-governance PIP.

Prior art position:

- changesets handles version intent, changelog, and ordered publish, but not frozen publish plans with plan-bound proofs, typed capability matrices, or execution reconciliation.
- semantic-release automates conventional-commit releases, but not explicit local-first proof artifacts or artifact-exact rehearsal.
- release-please creates release PRs, but does not own local package-manager capability proofs or interrupted-publish reconciliation.
- nx-release is workspace-aware, but its guarantees are not a product-level proof/journal model for arbitrary npm-compatible publishing.

Programmatic API:

- Effect-native API lives at `@kitz/release/api`.
- Promise adapter lives at `@kitz/release/promise-api` and exposes the same plan/proof/rehearse/apply/status/reconcile/inspect operations with decoded DTOs.
- File formats remain the source of truth for interoperability; APIs are typed accessors over those schemas, not hidden state.

Promise adapter lossiness is explicit:

| Effect-native surface | Promise adapter behavior |
| --- | --- |
| typed environment/layers | caller passes explicit adapter dependencies object |
| interruption | supports `AbortSignal`; interrupted operations reject with stable `release.runtime.interrupted` |
| scopes/finalizers | adapter owns scope per call and finalizes before resolving/rejecting |
| `Cause` with parallel failures | rejects with decoded aggregate error preserving stable codes and evidence ids |
| spans/annotations | exposes optional event callback; file artifacts remain authoritative |

### Tests

- `cli/help.test.ts`: command list includes preview/prove/rehearse/reconcile.
- `cli/commands/preview.test.ts`: preview renders plan/proof summaries and never packs artifacts.
- `cli/commands/apply.test.ts`: `--prove --rehearse` executes proof and artifact validation before publish.
- `cli/commands/rehearse.test.ts`: local path works without GitHub Actions.
- `cli/commands/prove.test.ts`: trusted GitHub checks become deferred only when plan declares GitHub trusted publishing.
- `cli/commands/trust.test.ts`: nested trust subcommands route through `commands/trust.ts`.
- `cli/commands/matrix.test.ts`: matrix verify fails when a selected tool's flag proof disagrees with the generated matrix.
- `cli/commands/matrix.test.ts`: matrix verify latest works in an isolated temp workspace and is not CI-specific.
- `cli/commands/matrix.test.ts`: latest verification records resolved versions and OS/architecture dimensions.
- `cli/commands/init.test.ts`: init creates setup profiles without adding repository-local runbook scripts.
- `cli/commands/init.test.ts`: missing setup failures point to `release init`, and init refuses existing config unless `--force`.
- `cli/commands/validate-setup.test.ts`: setup proof runs through a synthetic setup plan, and `--strict` fails unknown fields and stale scaffolding.
- `cli/commands/output-json.test.ts`: status/reconcile/inspect/history/apply/prove return schema-versioned JSON with stable error codes.
- `cli/commands/output-json.test.ts`: error code registry rejects duplicate, undocumented, and ad hoc string codes.
- `cli/commands/apply.test.ts`: proof override writes signed journal entry and cannot override artifact, plan-signature, registry-tarball, or tag-SHA mismatches.
- `cli/commands/apply.test.ts`: workspace-source self-bootstrap records producer commit and binary digest.
- `api/promise.test.ts`: Promise adapter preserves stable codes, evidence ids, abort behavior, and aggregate errors.
- `cli/commands/history.test.ts`: history/inspect commands are present in help.
- `cli/commands/archive.test.ts`: archive export and prune commands are present in help.
- `npm-registry/dry-run.test.ts`: package-manager publish dry-run is testable but release rehearsal cannot call it as a substitute for artifact construction.

## Product-Level Feature Cut

These features form one coherent product cut. Critical path:

```txt
capability model
  -> frozen plan intent
  -> proof policy/store
  -> artifact builder and source reproducibility policy
  -> execution journal/lock/reconcile
  -> post-publish verification
  -> operator command surface
  -> conformance and fixture repos
```

Feature groups:

1. Add publishing capability model and providers.
2. Freeze publish intent in plan v2.
3. Add registry, host, proof, lockfile, script, and credential policy to the plan.
4. Add proof store.
5. Add rehearse command and artifact manifest.
6. Add access/auth/provenance/trust proof rules.
7. Add execution journal, locking, reconcile, repair, history, archive, and prune.
8. Add post-publish verification.
9. Add conformance tests and matrix maintenance.
10. Add public operator docs for command flows, machine artifact schemas, proof statuses, driver support matrix, trust setup, recovery statuses, retention, and migration away from local runbooks/scripts.

There are no required changes to this repository's `release.config.ts` to achieve the product goal. Kitz's config can become a consumer of the new product surface after the product surface exists.

## Acceptance Criteria

The feature set is complete when all of these are true:

- A plan file contains publish profile, registry profile, access, dist-tag, auth, provenance, Git, GitHub, config digest, lockfile digests, script policy, proof policy, toolchain snapshot, and plan digest.
- `release apply` does not resolve publish semantics from live config after loading the plan.
- Every plan producer attaches publish intent through one resolver.
- `release status`, `release resume`, and `release graph` derive identity from the plan digest.
- `release prove` writes a plan-bound proof artifact.
- `release rehearse` creates tarballs, artifact manifest, checksums, dry-run publish proofs, and permission proofs without publishing.
- `release apply` refuses stale or missing proofs and stale or mismatched artifacts.
- `release apply` refuses lockfile drift, expired auth proofs, unresolved execution locks, and disallowed lifecycle scripts.
- deterministic apply publishes rehearsed tarballs only.
- npm, pnpm, and Bun providers expose capability matrices and pass conformance tests for their advertised capabilities.
- npm trusted-publisher list/setup/verify is available through `release trust`.
- Provenance required mode blocks provider profiles and runtime hosts that cannot satisfy it.
- OTP policy is explicit and unattended execution cannot hang on a prompt.
- Every external side effect writes an execution journal entry.
- Official multi-tag releases use atomic Git tag push.
- `release reconcile` can classify clean/resume/repair/abort from external state.
- Publish success requires post-publish registry verification and official lifecycle tarball byte equality, not only a process exit code.
- The capability matrix has a verification command and tests covering version/flag drift.
- Audit artifacts have export/prune/history/inspect commands and redaction tests.
- Tests cover every new provider capability, proof rule, command, and recovery state.
- Fixture repos for npm, pnpm, and Bun can run the same local flow without kitz-specific release config.

## Appendix A: Official Sources

- npm publish: <https://docs.npmjs.com/cli/v11/commands/npm-publish/>
- npm pack: <https://docs.npmjs.com/cli/v11/commands/npm-pack/>
- npm view: <https://docs.npmjs.com/cli/v11/commands/npm-view/>
- npm dist-tag: <https://docs.npmjs.com/cli/v11/commands/npm-dist-tag/>
- npm access: <https://docs.npmjs.com/cli/v11/commands/npm-access/>
- npm trust: <https://docs.npmjs.com/cli/v11/commands/npm-trust/>
- npm trusted publishers: <https://docs.npmjs.com/trusted-publishers/>
- pnpm publish: <https://pnpm.io/cli/publish>
- pnpm pack: <https://pnpm.io/cli/pack>
- Bun publish: <https://bun.com/docs/pm/cli/publish>
- Bun package-manager utilities including `bun pm pack`: <https://bun.com/docs/pm/cli/pm>
- GitHub REST releases: <https://docs.github.com/en/rest/releases/releases#create-a-release>
- GitHub Actions workflow permissions: <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions>
- GitHub Actions OIDC: <https://docs.github.com/en/actions/concepts/security/openid-connect>
- npm scripts: <https://docs.npmjs.com/cli/v11/using-npm/scripts/>
- RFC 8785 JSON Canonicalization Scheme: <https://www.rfc-editor.org/rfc/rfc8785>

## Appendix B: Local Evidence Base

Downloaded official docs are stored at:

```txt
/Users/jasonkuhrt/repo-references/package-publishing-evidence/
```

Evidence files:

```txt
README.txt
bun-pm.html
bun-publish.html
github-actions-workflow-syntax.html
github-actions-oidc.html
github-rest-releases.html
git-push.html
npm-access.html
npm-dist-tag.html
npm-pack.html
npm-publish.html
npm-scripts.html
npm-trust.html
npm-trusted-publishers.html
npm-view.html
pnpm-pack.html
pnpm-publish.html
rfc8785-json-canonicalization.txt
```

Installed tool versions captured during research:

```txt
npm 11.14.1
node v22.22.2
pnpm 10.28.0 locally through Corepack; pnpm 11.1.1 through npm exec pnpm@latest
bun 1.3.11
```

## Appendix C: Aggressive Editor Review Loops

Each loop records the full reviewer findings and the accepted report changes.

### Review Loop 1: Product Scope And Last-Mile Drift

Reviewer verdict:

```txt
Not ready. The PIP has the right north star, but it still leaks back into local repo/config thinking and mixes product contracts with implementation sketches. The biggest failure: it says "no kitz-local config," but it does not make "no last-mile config drift" a testable invariant.

I did not edit files.
```

Full findings:

1. Section: `Abstract`, `Product-Level Feature Cut`, `Acceptance Criteria`

   Finding: The report asserts product scope, but never defines a hard invariant banning kitz-only config/script/workflow changes.

   Replace with: Add `## No Last-Mile Config Drift` requiring: no new root `package.json` release scripts, no kitz-only `release.config.ts` publishing fields, no hand-written per-repo workflow instructions. Any required repo setup must be generated by `@kitz/release` commands and verified by `release prove`.

2. Section: `Feature 2: Frozen Publish Intent In The Plan`

   Finding: "Resolve driver from explicit config or package manager detection" is dangerous. Package manager detection is a hint, not publish intent.

   Replace with: Define a product-owned `PublishProfile` resolved by `@kitz/release`, persisted into the plan, and shown to the operator. `packageManager` may seed defaults, but cannot be the authoritative publish contract.

3. Section: `Feature 1: Typed Publish Driver Capability Layer`

   Finding: `PublishDriverService` conflates package-manager execution, registry reads, access control, and trusted-publisher administration. That makes pnpm/Bun "weaker products" instead of alternate publish executors.

   Replace with: Split into `PackDriver`, `PublishInvoker`, `RegistryClient`, `CredentialProvider`, and `TrustedPublisherAdmin`. The registry admin surface should not be owned by the npm/pnpm/Bun publish driver.

4. Section: `Current Tool And Platform Evidence`, `Appendix B`

   Finding: Local tool versions are being treated too close to normative product truth. pnpm is especially suspect because local Corepack and "latest via npm exec" differ.

   Replace with: Add `## Supported Runtime Matrix` with minimum supported versions, feature gates, and exact failure behavior. Keep local installed versions only as non-normative research evidence.

5. Section: `Feature 3: Plan-Bound Proof Model`, `Feature 13: Local-First Operator Command Surface`

   Finding: `release doctor --write-proof` and `release prove` create two proof-writing surfaces. That is command drift.

   Replace with: `release prove` is the only proof writer. `release doctor` renders the same proof engine for humans and never owns proof persistence.

6. Section: `Feature 4: Exact Rehearsal Command`

   Finding: "Rewrite manifests in memory or in a temporary package copy" is too vague. The ideal product must not mutate repo source during rehearsal or apply.

   Replace with: A single `ArtifactBuilder` always stages an isolated temp workspace, applies manifest transforms there, packs there, and writes checksummed artifacts. `apply` publishes the rehearsed artifact, not a repack.

7. Section: `Feature 5: Credential, Access, And Permission Proofs`

   Finding: The MFA/access proof language is speculative: "parse where available" and "if npm cannot return enough detail" is not a product contract.

   Replace with: Define exact proof statuses: `proven`, `failed`, `unprovable`, `deferredToHost`. Only OIDC-style host checks may defer. Unattended local publishing fails on `unprovable`.

8. Section: `Feature 6: Trusted-Publisher Setup And Verification`

   Finding: The product requirement says trusted publishing must not be buried in runbooks, but implementation only sketches GitHub and attaches trust management to npm driver behavior.

   Replace with: `release trust setup --provider github|gitlab|circleci` plus `release trust verify --from <plan>`. Back it with registry admin capabilities, not publish-driver capabilities.

9. Section: `Feature 7: Provenance Policy`

   Finding: The evidence says automatic provenance exists for GitHub and GitLab, but the model names `npm-trusted-automatic` and requires `channel.mode === 'github-trusted'`. That is narrower than the evidence.

   Replace with: `ProvenancePolicy` should model source as `trustedPublisher(provider) | cliFlag | attestationFile | none`, with provider-specific proof requirements.

10. Section: `Feature 8: OTP And Interactive Auth`

    Finding: `AuthIntent` is under-modeled. It misses runtime host, credential source, interactive permission, token environment ownership, and redaction/audit policy.

    Replace with: `CredentialIntent` containing `source`, `runtimeHost`, `tokenEnv`, `otpPolicy`, `interactiveAllowed`, and `secretPersistence: never`.

11. Section: `Feature 9: Artifact Manifest, Packlist, And Checksum Verification`

    Finding: The artifact checks include kitz-specific "source runtime targets" wording. That reads local, not product-level.

    Replace with: Define a reusable `ManifestTransformPolicy` with default transforms: version rewrite, workspace protocol rewrite, runtime entrypoint rewrite. Kitz consumes the same product transforms as any repo.

12. Section: `Feature 10: Side-Effect Ledger And Reconciliation`

    Finding: The ledger is introduced as a second durable state system beside the existing workflow runtime. That invites status/resume/reconcile disagreement.

    Replace with: Define one `ExecutionJournal`: workflow activity state plus external side-effect receipts plus reconciliation observations. `status`, `resume`, and `reconcile` must read the same journal.

13. Section: `Feature 11: Post-Publish Registry Verification`

    Finding: The receipt model is too lossy. Booleans like `distTagMatches` and `accessMatches` hide the actual registry observation.

    Replace with: Store `RegistryObservation` with raw decoded version metadata, dist-tags, access status, integrity algorithm/value, observation time, and retry policy.

14. Section: `Feature 12: Publish Driver Conformance Suite`

    Finding: Contract tests alone do not prove "lift all boats." They prove drivers in isolation, not product behavior in non-kitz repos.

    Replace with: Add fixture repos: npm workspace, pnpm workspace, Bun workspace, trusted-publisher workflow samples, no custom publishing config. Acceptance requires the same local flow to pass in every fixture.

15. Section: `Feature 13: Local-First Operator Command Surface`

    Finding: The local path is better, but it does not obsolete existing kitz-specific shortcuts like root release scripts.

    Replace with: State the product-owned commands that replace root scripts, especially ephemeral/preview publishing. Acceptance: current kitz can remove local release shortcut scripts without losing behavior.

16. Section: `Product-Level Feature Cut`

    Finding: "Update operator docs" is too weak for a PIP. Docs are part of the product contract here.

    Replace with: Require public docs for command flows, machine artifact schemas, proof statuses, driver support matrix, trust setup, and migration away from local runbooks/scripts.

17. Section: `Appendix C: Aggressive Editor Review Loops`

    Finding: It says each loop records "changes made," but this loop was explicitly review-only.

    Replace with: "Each loop records reviewer findings and the accepted/rejected report changes." That keeps the appendix honest.

Response and report changes:

- Accepted finding 1. Added `No Last-Mile Config Drift` and made fixture repos with no kitz-specific release config part of the acceptance set.
- Accepted findings 2 and 3. Replaced the monolithic driver concept with `PublishProfile`, `PackDriver`, `PublishInvoker`, `RegistryClient`, `CredentialProvider`, `TrustedPublisherAdmin`, and `ArtifactBuilder`.
- Accepted finding 4. Added the normative runtime support matrix and kept local tool versions in Appendix B as evidence only.
- Accepted finding 5. Made `release prove` the sole proof writer; `release doctor` renders proof state only.
- Accepted finding 6. Made `ArtifactBuilder` stage an isolated workspace and made `apply` publish rehearsed artifacts only.
- Accepted finding 7. Standardized proof statuses as `proven`, `failed`, `unprovable`, and `deferredToHost`; unattended local publish fails on unprovable proof.
- Accepted finding 8. Added `release trust setup|verify` and moved trusted-publisher administration behind `TrustedPublisherAdmin`.
- Accepted finding 9. Replaced npm-only provenance naming with provider-aware provenance modes.
- Accepted finding 10. Added `CredentialIntent` with runtime host, credential source, OTP policy, interactive permission, non-persistence, and redaction.
- Accepted finding 11. Added reusable `ManifestTransformPolicy`.
- Accepted finding 12. Replaced side-effect ledger wording with a single `ExecutionJournal`.
- Accepted finding 13. Added raw `RegistryObservation` and made post-publish verification store observations, not booleans only.
- Accepted finding 14. Added fixture repositories for npm, pnpm, Bun, and trusted-publisher workflows.
- Accepted findings 15 and 16. Made root scripts optional wrappers and public docs part of the product cut.
- Accepted finding 17. This appendix now records reviewer findings and report changes after each loop.

### Review Loop 2: Current-Code Completeness

Reviewer verdict:

```txt
Not implementation-ready. The PIP has the right product direction, but it leaves several live code paths unmigrated and a few proposed APIs are not actually buildable against the current source. No files edited.
```

Full findings:

1. P0: Plan v2 does not migrate all plan producers.

   The PIP only calls out `release plan` and `release apply`, but plans are also synthesized by doctor, PR preview, and the TUI. Those call `Planner.official/candidate/ephemeral` without publish/config context. Required change: define one `PublishIntent` resolver and wire every plan producer through it.

2. P0: "Apply stops using live config" is under-scoped.

   `status`, `resume`, `graph`, and executor payload construction still resolve workflow identity from live config/flags. The current workflow idempotency key also omits the full publishing contract. Required change: derive status/resume/graph/execution identity from `planDigest` or frozen `publishIntent`, not live config.

3. P0: Proof model is not wired to the lint system.

   The PIP adds proof statuses, but current lint results are only `Finished | Failed | Skipped`. Current "deferred" is metadata inside one rule, not a result state. Required change: define a proof algebra and an explicit adapter/migration from lint reports to plan-bound proofs.

4. P0: Existing preflight rules bypass the proposed driver.

   `env.npm-authenticated` and `plan.versions-unpublished` call `NpmRegistry.Cli` directly. A new `PublishDriverService` would not affect those checks. Required change: migrate publish-related lint/preflight rules onto the publish driver/proof service.

5. P0: Rehearsal exactness conflicts with current artifact preparation.

   Current preparation mutates real `package.json`, runs `npm pack`, then restores. The PIP allows "in memory or temporary package copy", but a temp copy is not exact when pack hooks observe repo state. Required change: make rehearsed artifacts the only publish input, or precisely define how real-tree pack hooks are made non-mutating and repeatable.

6. P0: Ledger/reconcile is not integrated with durable workflow semantics.

   The current workflow caches activity completion around nodes like `Publish:*`. If publish succeeds but verification fails inside the same node, resume can rerun publish unless the node is split or ledger-gated. Required change: split mutate/verify nodes or make each side-effect activity ledger-idempotent before execution.

7. P0: The plan is deleted after success, but reconcile needs it.

   `apply` and `resume` delete the plan on success. The PIP keys proofs/artifacts/ledger by plan digest and adds `release reconcile --from <plan>`. Required change: archive immutable plans by digest instead of deleting the only active plan.

8. P1: `PublishIntent` has no complete source surface.

   Current config has `publishing`, `npmTag`, and `candidateTag`, but no registry, driver, auth, provenance, artifact, git, or GitHub release policy fields. Current `apply` exposes only `--yes`, `--dry-run`, `--tag`, and `--from`. Required change: specify exact config/CLI/default derivation for every `PublishIntent` field.

9. P1: Driver ownership is unresolved.

   The PIP says drivers live in `@kitz/release`, while current npm command construction lives in `@kitz/npm-registry`. Required change: choose one owner: expand `@kitz/npm-registry` as the npm driver backend, or move command construction fully into `@kitz/release`.

10. P1: Capability matrix is internally incomplete.

    The tests/matrix mention pnpm `--report-summary`, but `PublishCapability` has no summary/receipt capability. Unsupported capability handling is also promised but not represented in method return types. Required change: add missing capabilities and make unsupported support a typed result, not an implied error.

11. P1: Git/GitHub proof APIs do not exist.

    Git has `pushTag`, but no dry-run push method. GitHub has release create/update/list PR methods, but no repository-permission probe. Required change: add live and memory service APIs for dry-run tag push, remote tag observation, release lookup, and repo permission proof.

12. P1: Model snippets do not compile against current namespaces.

    The PIP uses `Git.Sha.Schema` and `Pkg.Moniker.Schema`, but current exports are `Git.Sha.Sha` and `Pkg.Moniker.FromString` / `Pkg.Moniker.Moniker`. Required change: rewrite schema snippets against real exports and define the missing `Digest` module.

13. P1: Artifact manifest lacks an implementation path.

    The PIP says open tarballs, list entries, and compute SHA-256, but no current package has a tar reader dependency. Current `npm pack --json` parsing keeps only `filename`. Required change: add a tar-reading service/dependency or consume richer pack JSON, and decide SHA-256 vs npm SRI/sha512 verification.

14. P1: Package-manager detection cannot provide driver version proof.

    `Pkg.Manager.detect` returns only `name` and `source`, and includes `yarn`/`unknown`. This repo's root is `packageManager: "bun@1.3.6"`, while the installed Bun is `1.3.11`; `pnpm --version` currently fails under this root. Required change: separate configured manager, executable driver, executable version, and unsupported manager failure modes.

15. P2: Nested command routing is a how-to gap.

    The dispatcher routes only the first command token to a file. `release publish trust ...` therefore needs a `commands/publish.ts` subparser or a dispatcher extension. Required change: specify routing and help updates, not just command names.

16. P2: Current dry-run layer is left dangling.

    `apply --dry-run` exits before executor, while `NpmCliDryRun` still pretends to pack/publish without real artifacts. Required change: rename/remove that layer or clearly reserve it for tests; do not let it be confused with real rehearsal.

Response and report changes:

- Accepted finding 1. Added `Api.Planner.withPublishIntent` and required every plan producer, including doctor synthesized plans, PR preview, UI/TUI, and direct planner callers, to use it.
- Accepted finding 2. Required `status`, `resume`, and `graph` to derive identity from `planDigest`; executor idempotency includes the frozen publish contract.
- Accepted finding 3. Added `proof/from-lint.ts` and made lint results an input to proof records, not the proof record itself.
- Accepted finding 4. Required publish-related lint rules to move off direct `NpmRegistry.Cli` calls and onto the publishing proof services.
- Accepted finding 5. Removed ambiguous in-memory/temp-copy phrasing and required `ArtifactBuilder` to create the only tarballs `apply` can publish.
- Accepted finding 6. Split external mutations and verifications into separate journaled nodes: `Publish`, `VerifyPublish`, `CreateTag`, `PushTag`, `VerifyTag`, `CreateGHRelease`, `VerifyGHRelease`.
- Accepted finding 7. Required immutable plan archives at `.release/plans/<planDigest>.json`; success clears only the active pointer.
- Accepted finding 8. Added the derivation table for every `PublishIntent` field.
- Accepted finding 9. Set ownership: product-facing service types live in `@kitz/release`; npm command construction remains in an expanded `@kitz/npm-registry` backend; pnpm/Bun command construction lives in release backend modules.
- Accepted finding 10. Added receipt and tool-proof capability atoms and typed `CapabilityResult.Unsupported`.
- Accepted finding 11. Added Git and GitHub proof API requirements.
- Accepted finding 12. Rewrote schema references to `Git.Sha.Sha` and `Pkg.Moniker.FromString`; added a `Digest` module.
- Accepted finding 13. Added `TarballInspector` and explicit checksum/SRI separation.
- Accepted finding 14. Added `ToolchainSnapshot` and separated configured package manager, selected executable, executable version, and invocation proof.
- Accepted finding 15. Changed the trust command to `release trust ...` and required `packages/release/src/cli/commands/trust.ts` to own subcommand parsing.
- Accepted finding 16. Removed dry-run-as-rehearsal language and made preview/rehearsal separate product commands.

### Review Loop 3: Tool Semantics And Proof Correctness

Reviewer verdict:

```txt
Findings, harsh version:
```

Full findings:

1. P1: pnpm driver is not currently runnable from this repo cwd.

   The PIP implies pnpm can be a shell backend. Local behavior disagrees: from this Bun-rooted repo, `pnpm --version`, `corepack pnpm --version`, and `npm exec --package pnpm@latest -- pnpm publish --help` all fail because `packageManager` is `bun@1.3.6`. Required change: add a proof for package-manager invocation context, and state that non-native drivers must run in an isolated temp package/cwd or an explicitly proven package-manager-strict bypass.

2. P1: the capability matrix is incomplete relative to its own capability union.

   The PIP defines registry reads, access reads, folder publish, ignore-scripts, trusted-publisher read/write, etc.; the matrix only covers a subset. Required change: make the matrix cover every declared capability, or split undocumented registry operations into a separate registry HTTP client with its own evidence.

3. P1: registry verification relies on unproven Bun/pnpm/npm read semantics.

   The PIP requires version/dist-tag/access/integrity reads for all drivers, but the evidence only proves npm access and publish/pack surfaces. Required change: cite and specify `npm view/dist-tag/access`, `pnpm view/dist-tag`, and Bun registry read behavior, or move these checks to a registry API adapter.

4. P1: `npm access` cannot prove package MFA policy as written.

   Official npm access docs list `set mfa`, not `get mfa`; `get status` is package visibility/status, not MFA policy. Required change: mark MFA pre-read as unsupported via documented CLI, or cite a real registry/API source for reading it.

5. P1: automatic trusted-publisher provenance is npm-specific, but the policy model does not require npm.

   npm docs say npm CLI detects OIDC and automatic provenance applies to trusted publishing from GitHub/GitLab; that does not prove pnpm or Bun automatic provenance. Required change: require npm publish invocation for automatic trusted-publisher provenance, or add source-level proof for pnpm/Bun.

6. P1: trusted publishing bootstrap is under-modeled.

   The PIP says package must already exist, but the report never says a new package cannot use `npm trust` before first publish. Required change: add a first-publish bootstrap rule: trusted OIDC setup fails for unpublished packages unless a prior token/manual publish exists.

7. P1: GitHub permission proof overclaims what repository metadata can prove.

   GitHub create/update releases require push access plus fine-grained Contents write; repo metadata permissions do not necessarily prove the token's fine-grained permission set. Required change: separate "actor has push" from "token has Contents write"; if token permission cannot be introspected, record an unproven/deferred obligation.

8. P1: GitHub Actions permission verification must be job-effective, not file-level.

   GitHub permissions can be top-level or job-level, and unspecified permissions become `none` once any permission set is declared. Required change: verify the effective permissions for the exact publish/release job: `id-token: write` for OIDC and `contents: write` for release creation.

9. P1: "exact rehearsal" is too strong for package-manager dry-runs.

   The PIP implies dry-run publish is a near-exact non-mutating publish proof. Official docs do not guarantee that for auth/provenance/server acceptance. Local evidence: `npm publish --dry-run --provenance-file ./missing` exits 0; Bun `publish --dry-run` still fails without auth. Required change: call rehearsal artifact-exact, not publish-exact; dry-run is only command-shape/pack simulation unless backed by registry-specific proofs.

10. P1: deterministic apply must publish tarballs only.

    The PIP includes folder publish, while requiring checksum reuse. Folder publish lets the tool pack again at apply time, which defeats the rehearsed tarball checksum. Required change: core deterministic mode publishes only the rehearsed tarball; folder publish is a non-deterministic/unsupported capability for this flow.

11. P2: `access` needs an omitted/default state.

    npm publish documents `access` as nullable/defaulted, with existing packages not changing current access; npm access uses `public | private` status language. Required change: model `omit/default` separately from `public/restricted`, and normalize publish access vs registry status terminology.

12. P2: registry checksum fields are mismatched.

    npm publishes sha1 `shasum` and sha512 `integrity`. Required change: store local SHA-256 for the file, plus registry `shasum`/`integrity`, or download the registry tarball and compute SHA-256 explicitly.

13. P2: Bun pack evidence is cited through the wrong surface.

    The PIP uses `bun pm pack`, but Appendix cites only Bun publish docs. Required change: add Bun `pm pack` evidence, and remove `bun publish --dry-run` as a tarball-pack proof. Local `bun pm pack --dry-run` reports pack contents but writes no tarball.

14. P2: pnpm report-summary is not a rehearsal artifact.

    Local pnpm 11.1.1 with `publish --dry-run --report-summary --json` creates no `pnpm-publish-summary.json`. Required change: treat `--report-summary` as real-publish receipt input only, not rehearsal proof.

15. P2: trusted publisher verification is missing documented npm/GitHub edge conditions.

    The PIP should also require: hosted runner class, exact `repository.url` match for GitHub, workflow filename only under `.github/workflows`, and `workflow_call` parent/child OIDC permissions when applicable.

16. P2: Appendix B local evidence base is incomplete.

    The PIP cites npm pack/access, but the declared local evidence folder lacks `npm-pack.html` and `npm-access.html`. Required change: either download/store those sources or remove the "downloaded official docs" implication for them.

Reviewer conclusion:

```txt
Concrete report changes required: tighten "exact rehearsal" to "artifact-exact rehearsal plus separately modeled remote proofs"; require tarball-only deterministic apply; add full per-driver capability evidence; add package-manager invocation-context proof; downgrade unsupported/undocumented Bun and pnpm semantics to explicit capability gaps; split GitHub actor permission from token permission; and add the missing npm trusted-publishing bootstrap/runner/repository/workflow constraints.
```

Response and report changes:

- Accepted finding 1. Added package-manager invocation-context proof and required non-native driver execution from an isolated package cwd or a proven strict bypass.
- Accepted findings 2 and 3. Split registry reads into `RegistryClient`, backed by npm-compatible registry semantics rather than by the package-manager publish invoker.
- Accepted finding 4. Marked MFA pre-read as `unprovable` with the documented npm CLI surface.
- Accepted finding 5. Made automatic trusted-publisher provenance require npm publish invocation plus provider proof; Bun returns typed unsupported for provenance.
- Accepted finding 6. Added the first-publish bootstrap rule for `npm trust`.
- Accepted findings 7 and 8. Split GitHub actor push proof from token Contents-write proof and required effective job-level permission evaluation.
- Accepted finding 9. Renamed the section and command semantics to artifact-exact rehearsal; package-manager dry-run is only a command-shape/pack proof.
- Accepted finding 10. Required deterministic apply to publish rehearsed tarballs only.
- Accepted finding 11. Added `access: { mode: 'omit' } | { mode: 'publish-access', value: ... }`.
- Accepted finding 12. Stored local SHA-256 separately from registry `shasum` and `integrity`; byte-level equality downloads the registry tarball and computes SHA-256.
- Accepted finding 13. Added Bun `pm pack` evidence and stopped using Bun publish dry-run as tarball-pack proof.
- Accepted finding 14. Treated pnpm `--report-summary` as real-publish receipt input, not rehearsal proof.
- Accepted finding 15. Added trusted-publisher edge checks for hosted runner, repository URL, workflow path, and `workflow_call` permissions.
- Accepted finding 16. Downloaded the missing official docs into the local evidence base and listed them in Appendix B.

### Review Loop 4: External Editor Disposition

Source review: `/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat-persona-adapters/.tmp/kitz-209-review/review.md`.

This loop did not accept the review wholesale. Each point was classified as accepted, accepted with modification, or rejected.

| Point | Disposition | Reason and report change |
| --- | --- | --- |
| 1.1 E14 inconsistent npm evidence | Accepted | Reframed the lesson as resolved-binary/subcommand-surface proof rather than semver proof. |
| 1.2 pnpm v11 native publish citation | Accepted with modification | Kept the official pnpm publish docs as the normative source; no extra changelog dependency was added. |
| 1.3 Bun pack/dry-run ambiguity | Accepted | Clarified Bun runtime proof as `bun pm pack --dry-run` plus publish flag proof. |
| 1.4 pnpm `--report-summary` ambiguity | Accepted | Replaced `publish:summary` with `publish:summary-real` and stated it is post-mutation receipt support, not rehearsal proof. |
| 1.5 Workflow node split hand-waved | Accepted | Added explicit workflow runtime requirement: mutation and verification are separate activities with distinct idempotency keys. |
| 1.6 Bun `--ignore-scripts` defect | Accepted | Removed Bun publish `--ignore-scripts` support and marked Bun `publish:ignore-scripts` unsupported. |
| 2 undefined `ProofPolicy` | Accepted | Added `ProofPolicy` schema and defaults. |
| 2 undefined `PlanIntentUnavailable` | Accepted | Added typed `PlanIntentUnavailable` reasons. |
| 2 undefined `PlanDigest` | Accepted | Added `PlanDigest` schema and removed stale `PlanDigest.Schema` references. |
| 2 config digest algorithm undefined | Accepted | Defined SHA-256 over schema-decoded, default-applied, secret-redacted canonical effective config. |
| 2 `workflow_call` chain undefined | Accepted | Added `WorkflowCallProofLink` and chain proof semantics. |
| 2 `RuntimeHost` semantics undefined | Accepted | Added host evidence rules and exact CI provider matching. |
| 2 `Pkg.Moniker.FromString` uncited | Rejected | This is an existing local type reference, not a PIP-owned concept. No product change needed. |
| 3.1 concurrency undefined | Accepted | Added `ExecutionLock`, same-checkout lock, optional remote lock ref, and collision errors. |
| 3.2 v1-to-v2 migration path | Rejected as migration feature, accepted as explicit behavior | Kept hard error. v1 plans cannot be migrated because they lack publish intent/proof/source identity; operator reruns `release plan`. |
| 3.3 reconcile abort lacks action | Accepted | Added clean/resume/repair/abort operator actions. |
| 3.4 workflow split scale | Accepted | Added bounded concurrency and grouped status output requirements plus a 50-package graph test. |
| 3.5 test provider production risk | Accepted | Moved fake provider to test support and made production `PublishProfile` reject `test-only` providers. |
| 4.1 lockfile omission | Accepted | Added lockfile digests to `PlanSourceSnapshot` and apply/rehearse validation. |
| 4.2 lifecycle script supply-chain risk | Accepted | Added deny-by-default `ScriptPolicy`, allowlist by script command digest, env minimization, and token stripping. |
| 4.3 cross-registry semantics | Accepted with modification | Added `RegistryProfile` for npm-protocol-compatible registries. Did not call private registries a future phase; they are modeled now, while npmjs.org trust remains provider-specific. |
| 4.4 GitHub Enterprise | Accepted with modification | Added `GithubHostProfile`; GHES trusted-publisher OIDC is not inherited without provider proof. |
| 4.5 partial-success recovery | Accepted | Added the seven-of-ten published worked example. |
| 4.6 atomic multi-tag push | Accepted | Required `git push --atomic` proof/execution for multi-tag official releases. |
| 4.7 tag-push auto-release race | Accepted | Added `existingReleasePolicy` with fail/update/adopt semantics. |
| 4.8 token expiry | Accepted | Added proof TTL and apply refresh behavior. |
| 4.9 engines validation | Accepted | Added engines compatibility to source reproducibility acceptance through plan/proof policy. |
| 4.10 registry tarball download default | Accepted | Official lifecycle now downloads registry tarball and compares SHA-256 by default. |
| 4.11 secret redaction | Accepted | Added argv ban for secrets, env/config secret paths, redacting process service, and redaction tests. |
| 4.12 registry read caching | Accepted | Added batch `RegistryClient` methods, per-plan observation caching, and bounded concurrency. |
| 4.13 matrix maintenance | Accepted | Added `release matrix verify` as the drift gate. |
| 4.14 broader Sigstore/SBOM | Rejected for v1, accepted as explicit out-of-scope | Added explicit out-of-scope note for SBOM, vulnerability attestation, and broader SLSA/Sigstore build attestations. |
| 4.15 prior art | Accepted | Added positioning against changesets, semantic-release, release-please, and nx-release. |
| 4.16 yank/deprecate | Rejected for v1, accepted as explicit out-of-scope | Added forward-fix-only v1 stance; deprecate/unpublish needs a separate recovery PIP. |
| 4.17 retention/audit lifecycle | Accepted | Added archive export, prune, append-only audit records, and tarball retention policy. |
| 4.18 forensics/bisect | Accepted | Added `release history` and `release inspect <package>@<version>`. |
| 5.1 `unsupported-for-deterministic-apply` overfit | Accepted | Removed third matrix state; deterministic rejection now belongs to `PublishIntent.artifacts`. |
| 5.2 dependency graph hidden | Accepted | Added explicit critical path in Product-Level Feature Cut. |
| 5.3 "complete missing feature set" overclaim | Accepted | Reworded abstract to "product feature set" and expanded accepted missing concerns into the contract. |
| 5.4 CLI/internal architecture interleaved | Accepted with modification | Kept one PIP but added operator command coverage and critical path; did not split into multiple PIPs. |
| 6 two-products framing | Accepted as framing, rejected as split requirement | The PIP keeps deterministic engine and multi-provider support together because the stated product goal is reusable release automation across projects. |

Net accepted body changes:

- Capability interface tightened with inclusion/omission rules, `publish:summary-real`, no deterministic-only matrix state, and production/test provider separation.
- Plan v2 now defines `ProofPolicy`, `PlanDigest`, `PlanIntentUnavailable`, registry/host profiles, lockfile digests, and canonical config digest semantics.
- Artifact building now includes deny-by-default lifecycle script policy, token-stripped child env, script allowlist hashes, and official tarball byte verification.
- Execution now includes locking, bounded workflow graph semantics, atomic tag push, explicit reconcile actions, partial-success recovery, retention, archive, history, inspect, and matrix drift verification.
- Security now includes proof TTLs, argv secret ban, redacting process service, and provider-specific secret transport rules.

### Review Loop 5: External Editor Pass 2 Disposition

Source review: `/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat-persona-adapters/.tmp/kitz-209-review/review-pass-2.md`.

This loop focused on mechanisms added after Review Loop 4. The disposition below accepts mechanism-strengthening critiques, rejects universal bypasses, and keeps CI as one host for local-first commands.

| Point | Disposition | Reason and report change |
| --- | --- | --- |
| 1.1 script `commandSha256` pins invocation, not code | Accepted | Added `packageSourceDigest` to script allowlist. The command digest pins invocation and package source digest pins the code available to the script. |
| 1.2 network deny unenforceable on macOS | Accepted | Changed network policy to `deny-enforced`, `declared-deny`, or `allow`; enforced denial is `unprovable` without a backend. |
| 1.3 remote Git lock race/TTL/access | Accepted | Added compare-and-create semantics, heartbeat/expiry, recovery command, and proof failure when protected compare-and-create refs are unavailable for profiles requiring enforced distributed locking. |
| 1.4 forgeable runtime host env vars | Accepted | Trusted-publisher deferral now requires OIDC/JWT claim verification; environment variables are diagnostic only. |
| 1.5 byte equality assumes pack determinism | Accepted | Added canonical tarball requirements: sorted entries, normalized metadata, deterministic gzip headers, path normalization, and case-collision checks. |
| 1.6 inspect is local lookup, not legitimacy check | Accepted | Added legitimacy verdicts for journal match, journal mismatch, registry-only version, and missing registry version. |
| 1.7 archive export format unspecified | Accepted | Added `.kitz-release-audit.tgz` format, manifest, checksums, detached signature, schema versions, and migration requirements. |
| 2.1 plan integrity self-attesting | Accepted | Added `PlanEnvelope`, detached signature, out-of-body digest, and signature verification before apply. |
| 2.2 clock skew missing | Accepted | Added `maxClockSkewSeconds`, future-proof rejection, and monotonic journal timestamp requirement. |
| 2.3 TTL defaults missing | Accepted | Added product TTL defaults by registry auth kind and runtime host. |
| 2.4 canonical JSON incomplete | Accepted | Switched to RFC 8785, Unicode NFC, LF normalization, and explicit redaction-before-canonicalization. |
| 2.5 redaction cannot intercept child file writes | Accepted | Added isolated child `HOME`/cache/log dirs, retained-log redaction, and explicit residual host-compromise limit. |
| 2.6 schema migration framework missing | Accepted | Added top-level schema versions, unknown-field tolerance, migration registry, and read-time journal migrations. |
| 2.7 golden snapshots vs CLI upgrades | Accepted | Added `release matrix verify --latest`, runnable locally or in scheduled CI. |
| 3.1 error message design | Accepted | Added stable error code/evidence/observation/action contract for failures. |
| 3.2 first-time setup design | Accepted | Added `release init` and `release validate-setup`. |
| 3.3 programmatic API | Accepted | Added Effect-native API and Promise adapter. |
| 3.4 emergency override | Accepted with guardrails | Added signed proof override for specific proof ids only. It cannot bypass artifact, plan-signature, registry-tarball, or tag-SHA mismatches. |
| 3.5 JSON command output | Accepted | Added `--format text|json` for operator commands with schema-versioned JSON. |
| 4.1 compromised CI runner | Accepted as threat model | Added hostile runtime host as out of scope; OIDC proves host identity, not host benevolence. |
| 4.2 compromised local machine | Accepted as threat model | Added fully compromised local machine as out of scope. |
| 4.3 insider with repo write access | Accepted as threat model | Added release config review as governance boundary. |
| 4.4 token theft through packed files | Accepted | Added forbidden file patterns and rehearsal failure for secret-looking files. |
| 5.1 pnpm/Bun catalog semantics differ | Accepted | Split catalog transforms into `pnpm-catalog-protocol` and `bun-catalog-protocol`. |
| 5.2 prerelease dist-tag default | Accepted | Added rule rejecting prerelease `latest` unless explicitly allowed. |
| 5.3 empty/garbage tarball | Accepted | Added packlist checks for main/module/types/exports target files. |
| 5.4 Effect coupling for consumers | Accepted | Added `@kitz/release/api` and `@kitz/release/promise-api` stance. |
| 5.5 GitHub API rate budget | Accepted with modification | Bounded concurrency and batching are required; exact host-specific budgets remain provider proof details. |
| 5.6 repair-vs-abort taxonomy | Accepted | Added mismatch classification table and product-owned repair commands. |
| 5.7 cross-repo coordination | Accepted as out-of-scope | Added cross-repo publish orchestration to threat/scope exclusions. |

Net accepted body changes:

- Plan integrity is now detached and signed instead of self-attesting.
- Runtime-host proof for trusted deferral now uses signed OIDC/JWT claims, not forgeable environment variables.
- ArtifactBuilder now owns canonical tarball normalization, forbidden file checks, and stronger lifecycle script pinning.
- Execution locking now specifies compare-and-create remote locks, TTL/heartbeat, and stale-lock recovery.
- Operator surface now includes setup, JSON output, stable errors, guarded override, archive format, matrix latest verification, inspect legitimacy, and programmatic API.
- Threat model now explicitly bounds compromised hosts, local machines, insiders, and cross-repo transactions.

### Review Loop 6: External Editor Pass 3 Disposition

Source review: `.tmp/kitz-209-review/review-pass-3.md`.

This loop focused on lifecycle/connective-tissue gaps. Meta-process findings were rejected unless they directly reduced release execution risk. The accepted changes are limited to runtime identity, trust, proof, journal, lock, setup, and command determinism.

| Point | Disposition | Reason and report change |
| --- | --- | --- |
| 1 PIP spec version/frozen commit/status lifecycle | Rejected | This is PIP-process ceremony, not publish safety. The issue body and git history already provide review context for this execution pass. |
| 2 PIP-process meta-rules | Rejected | This would create project governance work while the current need is executing one product spec. No body change. |
| 3 plan signing identity lifecycle | Accepted | Added `SigningIdentityProfile`, key source, external trust root, signer allowlist, revocation list, and signature quorum. |
| 4 signing identity trust root in repo config | Accepted | Release config may select `signingProfileId` but cannot define allowed keys or trust roots. Apply verifies against an external trust root digest. |
| 5 implicit proof DAG | Accepted | Added `dependsOn`, `blocked`, root-cause grouping, and proof dependency semantics. |
| 6 proof/apply TOCTOU | Accepted | Added proof recheck modes and mid-apply refresh behavior for credentials, registry permissions, and host deferrals. |
| 7 append-only convention lacks tamper evidence | Accepted with limit | Added journal hash chaining. Did not add Merkle ceremony to every artifact because signed plans and archive checksums already cover those surfaces. |
| 8 conflated operator persona | Accepted | Added `PrincipalRef` and `ExecutionPrincipals`; proof rules can require disjoint signer/invoker/publisher roles. |
| 9 insecure `release lock recover` | Accepted | Remote official recovery must be signed by an accepted identity; local recovery invalidates fresh proof/artifact eligibility before more official mutations. |
| 10 `@kitz/release` self-bootstrap | Accepted with modification | Added workspace-source self-bootstrap using the current checkout implementation, producing a normal signed plan instead of a manual-publish waiver. |
| 11 scale ceilings | Rejected | No new spec machinery. Existing body already requires bounded concurrency, grouped status, and a 50-package workflow test. |
| 12 fragile matrix latest semantics | Accepted | Added latest version resolution, `--write` behavior, and OS/architecture dimensions. |
| 13 `validate-setup` versus `prove` | Accepted | Defined validate-setup as a synthetic setup plan proof with a strict mode. |
| 14 error code naming | Accepted | Added generated `release.<domain>.<condition>` code convention and duplicate/ad hoc code tests. |
| 15 conformance suite distribution | Accepted | Added `release conformance run` with fake registry and schema-versioned JSON. |
| 16 unspecified `reconcile --explain` | Accepted | Added deterministic explain report contents: state diff, decision rows, evidence ids, and next command. |
| 17 Promise API lossiness | Accepted | Added adapter behavior table for layers, interruption, scopes, aggregate errors, and events. |
| 18 telemetry for release | Rejected | Remote telemetry is not part of the local-first publish contract. The product uses local proof, journal, archive, and status artifacts instead. |
| 19 forbidden-file check must inspect real tarball | Accepted | Clarified that forbidden file checks run against actual opened tarball entries, not predicted packlists. |
| 20 proof refresh for long releases | Accepted | Covered by the same proof recheck mode table and apply behavior as point 6. |
| 21 last-mile config drift enforcement | Accepted | Added `release validate-setup --strict` for unknown config fields, stale scaffolding, and script shadowing. |
| 22 schema cross-reference and time formats | Accepted | Added `schema-index.ts` export requirement and UTC RFC 3339 timestamp tests. |
| 23 proof state-machine transitions | Accepted | Added append-only `proofHistory` and legal transition semantics. |
| 24 `release init` discoverability | Accepted | Missing setup failures print exact `release init`; init refuses existing profiles unless `--force`. |
| 25 canonical clock | Accepted | Added UTC RFC 3339 timestamp requirement through Effect `Clock` and journal monotonicity checks. |
| 26 provider failure observations | Accepted | Added `FailureObservation` with provider, category, status code, redacted body excerpt, and retry hint. |
| 27 synthesis/future-pass suggestions | Rejected | No product requirement or implementation detail was attached. No body change. |

Net accepted body changes:

- Plan signatures now have external trust roots, revocation, quorum, and signer allowlists.
- Proof records now have dependencies, recheck modes, append-only histories, and blocked-root-cause reporting.
- Execution journals now hash-chain entries, persist active principals, record provider failure observations, and enforce stricter lock recovery.
- Operator commands now define setup proof, strict drift checks, conformance running, matrix-latest semantics, reconcile explanation, error-code shape, and Promise adapter lossiness.
- The `@kitz/release` self-bootstrap path now uses the workspace-source implementation and still produces a normal signed plan.
