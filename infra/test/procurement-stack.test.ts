import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { App } from 'aws-cdk-lib'
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions'
import { beforeAll, describe, expect, it } from 'vitest'
import { ProcurementStack } from '../lib/procurement-stack.js'

function synth(frontendDist?: string) {
  const app = new App()
  const stack = new ProcurementStack(app, 'Test', { frontendDist })
  return { stack, template: Template.fromStack(stack) }
}

let template: Template

beforeAll(() => {
  const dist = mkdtempSync(join(tmpdir(), 'dist-'))
  writeFileSync(join(dist, 'index.html'), '<!doctype html>')
  template = synth(dist).template
})

describe('database', () => {
  it('is PostgreSQL 16, encrypted and not public', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
      EngineVersion: Match.stringLikeRegexp('^16'),
      StorageEncrypted: true,
      PubliclyAccessible: false,
    })
  })

  it('keeps a snapshot when the stack is deleted', () => {
    template.hasResource('AWS::RDS::DBInstance', { DeletionPolicy: 'Snapshot' })
  })
})

describe('frontend hosting', () => {
  it('keeps the bucket private', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    })
  })

  it('sends /api, /admin and /static to the load balancer without caching', () => {
    const [dist] = Object.values(template.findResources('AWS::CloudFront::Distribution'))
    const behaviors = dist.Properties.DistributionConfig.CacheBehaviors as {
      PathPattern: string
      CachePolicyId: string
      ViewerProtocolPolicy: string
    }[]
    expect(behaviors.map((b) => b.PathPattern).sort()).toEqual(['admin/*', 'api/*', 'static/*'])
    for (const b of behaviors) {
      expect(b.ViewerProtocolPolicy).toBe('redirect-to-https')
      // Managed "CachingDisabled" policy.
      expect(b.CachePolicyId).toBe('4135ea2d-6df8-44a3-9df3-4b5a84be39ad')
    }
  })

  it('uploads the React build when it exists', () => {
    template.resourceCountIs('Custom::CDKBucketDeployment', 1)
  })

  it('warns instead of failing when the frontend is not built', () => {
    const { stack, template: t } = synth(join(tmpdir(), 'does-not-exist'))
    t.resourceCountIs('Custom::CDKBucketDeployment', 0)
    Annotations.fromStack(stack).hasWarning('*', Match.stringLikeRegexp('No frontend build'))
  })
})

describe('api service', () => {
  it('runs Django in production mode with secrets from Secrets Manager', () => {
    const [taskDef] = Object.values(template.findResources('AWS::ECS::TaskDefinition'))
    const container = taskDef.Properties.ContainerDefinitions[0]
    const env = Object.fromEntries(
      (container.Environment as { Name: string; Value: unknown }[]).map((e) => [e.Name, e.Value]),
    )
    const secrets = (container.Secrets as { Name: string }[]).map((s) => s.Name).sort()

    expect(env.DJANGO_DEBUG).toBe('false')
    expect(secrets).toEqual([
      'DB_PASSWORD',
      'DB_USER',
      'DJANGO_SECRET_KEY',
      'LUCKY_MART_PASSWORD',
      'LUCKY_MART_PHONE_NUMBER',
    ])
    // No secret value is ever written into the template as plain text.
    expect(JSON.stringify(env)).not.toMatch(/password/i)
  })

  it('health-checks /healthz', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      HealthCheckPath: '/healthz',
      Port: 80,
    })
  })

  it('lets only the API reach the database port', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
      FromPort: { 'Fn::GetAtt': [Match.stringLikeRegexp('Database'), 'Endpoint.Port'] },
      Description: 'Django API to PostgreSQL',
    })
  })
})

describe('cognito', () => {
  it('has no public sign-up', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
    })
  })

  it('has one group per portal role', () => {
    const groups = Object.values(template.findResources('AWS::Cognito::UserPoolGroup')).map(
      (g) => g.Properties.GroupName,
    )
    expect(groups.sort()).toEqual(['OWNER', 'STAFF'])
  })

  it('uses a public SRP client for the browser', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
      ExplicitAuthFlows: Match.arrayWith(['ALLOW_USER_SRP_AUTH']),
    })
  })
})
