#!/usr/bin/env node
import { App, Tags } from 'aws-cdk-lib'
import { ProcurementStack } from '../lib/procurement-stack.js'

const app = new App()

// Environment-agnostic on purpose: `cdk synth` works without AWS credentials.
// Pass CDK_DEFAULT_ACCOUNT / CDK_DEFAULT_REGION (via `cdk deploy --profile ...`) to deploy.
const stack = new ProcurementStack(app, 'LuckyMartProcurement', {
  env: process.env.CDK_DEFAULT_ACCOUNT
    ? { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'ap-southeast-3' }
    : undefined,
  description: 'Lucky Mart Procurement Portal: Django API on ECS Fargate, React on S3 + CloudFront, Cognito',
})

Tags.of(stack).add('project', 'lucky-mart-procurement')
