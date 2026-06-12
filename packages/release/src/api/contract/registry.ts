/**
 * @module api/contract/registry
 *
 * Registry, GitHub-host, and publish-profile contracts: where artifacts are
 * published and through which drivers.
 */
import { Fs } from '@kitz/fs'
import { Sch } from '@kitz/sch'
import { Schema } from 'effect'
import { PublishDriverId } from '../publishing/models/driver-id.js'

export class RegistryProfile extends Sch.Class<RegistryProfile>()('RegistryProfile', {
  id: Schema.String,
  protocol: Schema.Literal('npm-registry-api'),
  url: Schema.String,
  authKind: Schema.Literals(['npm-token', 'oidc-trusted-publisher', 'basic', 'bearer-token']),
  strictSsl: Schema.Boolean,
  caFile: Schema.optional(Fs.Path.AbsFile.Schema),
  trustedPublisherAdmin: Schema.optional(Schema.String),
}) {}

export class GithubHostProfile extends Sch.Class<GithubHostProfile>()('GithubHostProfile', {
  id: Schema.String,
  kind: Schema.Literals(['github.com', 'github-enterprise']),
  apiUrl: Schema.String,
  webUrl: Schema.String,
  oidcIssuer: Schema.optional(Schema.String),
}) {}

export class PublishProfile extends Sch.Class<PublishProfile>()('PublishProfile', {
  id: Schema.String,
  packDriver: PublishDriverId,
  publishInvoker: PublishDriverId,
  registryClient: Schema.String,
  credentialProvider: Schema.String,
  trustedPublisherAdmin: Schema.optional(Schema.String),
}) {}

export const defaultRegistryProfile = (): RegistryProfile =>
  RegistryProfile.make({
    id: 'npmjs',
    protocol: 'npm-registry-api',
    url: 'https://registry.npmjs.org/',
    authKind: 'npm-token',
    strictSsl: true,
  })

export const defaultGithubHostProfile = (): GithubHostProfile =>
  GithubHostProfile.make({
    id: 'github.com',
    kind: 'github.com',
    apiUrl: 'https://api.github.com',
    webUrl: 'https://github.com',
    oidcIssuer: 'https://token.actions.githubusercontent.com',
  })
