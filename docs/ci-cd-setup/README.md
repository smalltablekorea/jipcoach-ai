# CI/CD 파이프라인 설정

## 자동 설치

```bash
gh auth refresh -h github.com -s workflow
cd /tmp/jipcoach-ai
mkdir -p .github/workflows
cp docs/ci-cd-setup/ci.yml .github/workflows/
cp docs/ci-cd-setup/deploy.yml .github/workflows/
cp docs/ci-cd-setup/pr-review.yml .github/workflows/
git add .github/workflows/
git commit -m "feat: CI/CD 파이프라인 활성화"
git push origin main
```

## GitHub Secrets 필요

- `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`

## 워크플로우

1. **ci.yml** — lint + typecheck + build
2. **deploy.yml** — Vercel 자동 배포 + 텔레그램 알림
3. **pr-review.yml** — 보안 스캔 + PR 사이즈 체크