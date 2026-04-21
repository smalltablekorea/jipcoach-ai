#!/bin/bash
set -e
echo "🔧 CI/CD 파이프라인 설치 중..."

# Check gh auth has workflow scope
if ! gh auth status 2>&1 | grep -q workflow; then
    echo "⚠️  workflow 스코프가 필요합니다. 브라우저에서 인증해주세요:"
    gh auth refresh -h github.com -s workflow
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
mkdir -p "$REPO_ROOT/.github/workflows"
cp "$REPO_ROOT/docs/ci-cd-setup/ci.yml" "$REPO_ROOT/.github/workflows/"
cp "$REPO_ROOT/docs/ci-cd-setup/deploy.yml" "$REPO_ROOT/.github/workflows/"
cp "$REPO_ROOT/docs/ci-cd-setup/pr-review.yml" "$REPO_ROOT/.github/workflows/"
git add .github/workflows/
git commit -m "feat: CI/CD 파이프라인 활성화"
git push origin main
echo "✅ CI/CD 파이프라인 활성화 완료!"
