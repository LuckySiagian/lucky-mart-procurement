import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Annotations, CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import type { Construct } from 'constructs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export interface ProcurementStackProps extends StackProps {
  /** Built React app to upload. Defaults to ../frontend/dist when it exists. */
  frontendDist?: string
}

/**
 * The whole portal on AWS:
 *
 *   browser ──▶ CloudFront ──┬─ /*                 ─▶ S3 (React build)
 *                            └─ /api/* /admin/* /static/* ─▶ ALB ─▶ ECS Fargate (Django) ─▶ RDS PostgreSQL
 *
 * Cognito holds the users; Django verifies Cognito JWTs (accounts/cognito.py).
 */
export class ProcurementStack extends Stack {
  constructor(scope: Construct, id: string, props: ProcurementStackProps = {}) {
    super(scope, id, props)

    // ---- Network: public subnets for the load balancer, private ones for the app,
    // isolated ones for the database. One NAT gateway keeps the bill small.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC },
        { name: 'app', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: 'data', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    })

    // ---- Database: password generated and kept in Secrets Manager, never in code.
    const db = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      databaseName: 'procurement',
      credentials: rds.Credentials.fromGeneratedSecret('procurement'),
      allocatedStorage: 20,
      storageEncrypted: true,
      backupRetention: Duration.days(7),
      removalPolicy: RemovalPolicy.SNAPSHOT,
    })

    const djangoSecretKey = new secretsmanager.Secret(this, 'DjangoSecretKey', {
      description: 'Django SECRET_KEY for the procurement portal',
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
    })

    // Filled in by hand after the first deploy (a Lucky Mart user with a warehouse role).
    const luckyMartAccount = new secretsmanager.Secret(this, 'LuckyMartServiceAccount', {
      description: 'Lucky Mart service account used to read low stock and add received stock',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ phone_number: '' }),
        generateStringKey: 'password',
      },
    })

    // ---- Users: Cognito with one group per portal role. No public sign-up:
    // the owner creates accounts for their staff.
    const userPool = new cognito.UserPool(this, 'Users', {
      selfSignUpEnabled: false,
      signInAliases: { username: true, email: true },
      passwordPolicy: { minLength: 8, requireDigits: true, requireLowercase: true, requireUppercase: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    })
    for (const role of ['OWNER', 'STAFF']) {
      new cognito.CfnUserPoolGroup(this, `Group${role}`, {
        userPoolId: userPool.userPoolId,
        groupName: role,
        description: `Portal role ${role}`,
      })
    }
    const webClient = userPool.addClient('WebClient', {
      authFlows: { userSrp: true },
      generateSecret: false,
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.minutes(30),
      idTokenValidity: Duration.minutes(30),
      refreshTokenValidity: Duration.days(7),
    })

    // ---- Load balancer, created first so its DNS name can go into ALLOWED_HOSTS.
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', { vpc, internetFacing: true })

    // ---- Frontend bucket and CDN. The bucket is private; CloudFront reads it via OAC.
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    // React Router paths like /orders/12 have no file in S3: serve index.html instead.
    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(
        "function handler(event) { var r = event.request; if (r.uri.indexOf('.') === -1) { r.uri = '/index.html'; } return r; }",
      ),
    })

    const apiOrigin = new origins.LoadBalancerV2Origin(alb, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    })
    const apiBehavior: cloudfront.BehaviorOptions = {
      origin: apiOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    }

    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          { function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      additionalBehaviors: {
        'api/*': apiBehavior,
        'admin/*': apiBehavior,
        'static/*': apiBehavior,
      },
    })

    // ---- Django API on Fargate, built from backend/Dockerfile during `cdk deploy`.
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    })

    const api = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Api', {
      cluster,
      loadBalancer: alb,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 1,
      // Start the new task before stopping the old one, so a deploy never drops to zero.
      minHealthyPercent: 100,
      taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset(join(ROOT, 'backend')),
        containerPort: 8000,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'api',
          logRetention: logs.RetentionDays.ONE_MONTH,
        }),
        environment: {
          DJANGO_DEBUG: 'false',
          DJANGO_ALLOWED_HOSTS: alb.loadBalancerDnsName,
          CSRF_TRUSTED_ORIGINS: `https://${distribution.distributionDomainName}`,
          DB_HOST: db.dbInstanceEndpointAddress,
          DB_PORT: db.dbInstanceEndpointPort,
          DB_NAME: 'procurement',
          COGNITO_REGION: this.region,
          COGNITO_USER_POOL_ID: userPool.userPoolId,
          COGNITO_APP_CLIENT_ID: webClient.userPoolClientId,
          LUCKY_MART_API_URL: '',
        },
        secrets: {
          DJANGO_SECRET_KEY: ecs.Secret.fromSecretsManager(djangoSecretKey),
          DB_USER: ecs.Secret.fromSecretsManager(db.secret!, 'username'),
          DB_PASSWORD: ecs.Secret.fromSecretsManager(db.secret!, 'password'),
          LUCKY_MART_PHONE_NUMBER: ecs.Secret.fromSecretsManager(luckyMartAccount, 'phone_number'),
          LUCKY_MART_PASSWORD: ecs.Secret.fromSecretsManager(luckyMartAccount, 'password'),
        },
      },
    })

    // The ALB health check uses a Host header Django doesn't know, so it hits /healthz,
    // which is answered before host validation (config/middleware.py).
    api.targetGroup.configureHealthCheck({ path: '/healthz', healthyHttpCodes: '200' })
    db.connections.allowDefaultPortFrom(api.service, 'Django API to PostgreSQL')

    // ---- Upload the React build if it exists (`npm run build` in frontend/ first).
    const dist = props.frontendDist ?? join(ROOT, 'frontend', 'dist')
    if (existsSync(join(dist, 'index.html'))) {
      new s3deploy.BucketDeployment(this, 'DeploySite', {
        sources: [s3deploy.Source.asset(dist)],
        destinationBucket: siteBucket,
        distribution,
        distributionPaths: ['/index.html'],
      })
    } else {
      Annotations.of(this).addWarningV2(
        'procurement:frontend-not-built',
        `No frontend build at ${dist}; run "npm run build" in frontend/ before deploying.`,
      )
    }

    new CfnOutput(this, 'AppUrl', { value: `https://${distribution.distributionDomainName}` })
    new CfnOutput(this, 'ApiLoadBalancer', { value: alb.loadBalancerDnsName })
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId })
    new CfnOutput(this, 'UserPoolClientId', { value: webClient.userPoolClientId })
    new CfnOutput(this, 'DatabaseEndpoint', { value: db.dbInstanceEndpointAddress })
  }
}
