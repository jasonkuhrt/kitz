import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import { sha256Text } from '../../digest.js'
import {
  DriverVersionProof,
  PackedArtifact,
  PublishDryRunProof,
  PublishReceipt,
  SubcommandProof,
} from './proof.js'

describe('publishing proof models', () => {
  test('schema classes round-trip through their public constructors and codecs', () => {
    const driverVersion = DriverVersionProof.make({
      driver: 'npm',
      binary: 'npm',
      version: '11.14.1',
      observedAt: '2026-05-13T00:00:00.000Z',
    })
    const subcommands = SubcommandProof.make({
      driver: 'npm',
      binary: 'npm',
      subcommands: { pack: true, publish: true },
      observedAt: '2026-05-13T00:00:00.000Z',
    })
    const packedArtifact = PackedArtifact.make({
      packageName: Pkg.Moniker.parse('@kitz/core'),
      version: Semver.fromString('1.0.0'),
      tarball: Fs.Path.AbsFile.fromString('/repo/.release/artifacts/core-1.0.0.tgz'),
      sha256: sha256Text('artifact'),
      sizeBytes: 123,
      packlist: [Fs.Path.RelFile.fromString('./package.json')],
    })
    const dryRun = PublishDryRunProof.make({
      driver: 'npm',
      command: Pkg.Manager.Command.fromParts('npm', ['publish', '--dry-run']),
      capabilities: ['publish:tarball', 'publish:dry-run'],
      observedAt: '2026-05-13T00:00:00.000Z',
    })
    const receipt = PublishReceipt.make({
      driver: 'npm',
      packageName: Pkg.Moniker.parse('@kitz/core'),
      version: Semver.fromString('1.0.0'),
      distTag: 'latest',
      registry: 'https://registry.npmjs.org/',
      command: Pkg.Manager.Command.fromParts('npm', ['publish']),
      observedAt: '2026-05-13T00:00:00.000Z',
    })

    expect(DriverVersionProof.is(driverVersion)).toBe(true)
    expect(SubcommandProof.decodeSync(SubcommandProof.encodeSync(subcommands))).toEqual(subcommands)
    expect(PackedArtifact.decodeSync(PackedArtifact.encodeSync(packedArtifact))).toEqual(
      packedArtifact,
    )
    expect(PublishDryRunProof.decodeSync(PublishDryRunProof.encodeSync(dryRun))).toEqual(dryRun)
    expect(PublishReceipt.decodeSync(PublishReceipt.encodeSync(receipt))).toEqual(receipt)
    expect(receipt.command.argv).toEqual(['npm', 'publish'])
    expect(PublishReceipt.equivalence(receipt, receipt)).toBe(true)
  })
})
