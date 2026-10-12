# Infrastructure (AWS CDK)

The whole portal on AWS, written as TypeScript with the AWS CDK.

> **Not deployed.** This stack is checked in CI with unit tests and `cdk synth`, but it has not
> been deployed to a real AWS account yet.

## Architecture

```
                       ┌────────────── CloudFront (HTTPS) ──────────────┐
browser ──────────────▶│  /*                    → S3 bucket (React build, private, OAC)
                       │  /api/* /admin/* /static/* → Application Load Balancer
                       └────────────────────────────────────────────────┘
                                                     │
                                VPC                  ▼
   public subnets:   ALB
   private subnets:  ECS Fargate service (Django + gunicorn, built from backend/Dockerfile)
   isolated subnets: RDS PostgreSQL 16 (encrypted, 7-day backups, snapshot on delete)

   Secrets Manager: DB credentials, Django SECRET_KEY, Lucky Mart service account
   Cognito user pool: groups OWNER and STAFF, no public sign-up, SRP browser client
```

| Decision | Why |
| --- | --- |
| One CloudFront domain for the app and the API | Same origin, so no CORS; HTTPS for both |
| Private S3 bucket with Origin Access Control | The bucket can't be read except through CloudFront |
| CloudFront Function rewrites paths to `/index.html` | React Router URLs like `/orders/12` work on refresh; `/api/*` is not affected |
| Fargate in private subnets, RDS in isolated subnets | Neither is reachable from the internet; only the API's security group can reach port 5432 |
| Secrets as ECS secrets, not environment values | Passwords never appear in the CloudFormation template (a unit test checks this) |
| `/healthz` for the ALB health check | The check calls the task by IP, which Django's `ALLOWED_HOSTS` would reject; `/healthz` answers before host validation |
| `minHealthyPercent: 100` and deployment circuit breaker | A deploy starts the new task first and rolls back if it never gets healthy |
| Cognito groups → portal roles | `accounts/cognito.py` verifies the access token against the pool's JWKS and maps `OWNER`/`STAFF` |

## Commands

```bash
npm ci
npm run typecheck
npm test          # assertions on the synthesized template
npm run synth     # writes cdk.out/, no AWS account needed
```

To deploy (needs an AWS account and Docker; builds the backend image and uploads the
React build from `../frontend/dist`):

```bash
cd ../frontend && npm run build && cd ../infra
npx cdk bootstrap --profile <profile>
npx cdk deploy --profile <profile>
```

After the first deploy, fill in the `LuckyMartServiceAccount` secret, and create users in the
Cognito pool (add them to the `OWNER` or `STAFF` group).

## Known gaps before production

- **Custom domain and HTTPS to the origin.** CloudFront talks to the ALB over HTTP. Add an ACM
  certificate on the ALB and a Route 53 domain, and allow only CloudFront's managed prefix list
  in the ALB security group.
- **Frontend sign-in with Cognito.** The API already accepts Cognito access tokens; the React
  app still uses the local username/password login. Next step: Cognito Hosted UI or the SRP flow.
- **Cost.** One NAT gateway, one ALB, one Fargate task and a `t4g.micro` database are the
  smallest sensible setup. Check the AWS Pricing Calculator before deploying.
