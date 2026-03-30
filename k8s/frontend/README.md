# Frontend

Kubernetes 환경에서 프론트엔드 애플리케이션을 Kustomize 구조로 배포하기 위한 설정입니다.

Deployment 기반으로 구성되어 있으며, ConfigMap을 통한 환경 설정 관리와 Ingress를 통한 외부 접근을 제공합니다.

<br>

## 📁 Directory Structure

```bash
frontend/
├── README.md
├── frontend.yaml          # Deployment & Service 정의
├── ingress.yaml          # Ingress 정의 (외부 접근용)
├── kustomization.yaml    # Kustomization 정의
└── config/
    └── frontend-config.json  # 프론트엔드 환경 설정 파일
```

<br>

## 🔧 리소스 구성

### Deployment & Service

- Deployment: 프론트엔드 애플리케이션 Pod 관리 (기본 1개 replica)

- Service: 클러스터 내부 통신을 위한 ClusterIP 서비스 (포트 80 → 3000)

### ConfigMap

- frontend-config: JSON 형태의 설정 파일을 Pod 내부 /app/config 경로에 마운트

### Ingress

- 외부 접근: goormthon-2.goorm.training/\* 경로로 프론트엔드 애플리케이션 접근 가능

<br>

## ⚙️ 커스터마이징 방법

### 1. 구름톤 팀 번호 설정

다음 파일에서 `goormthon-2`를 실제 팀 번호로 변경하세요

> ex. goormthon-1, goormthon-2 등

**frontend.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend-deployment
spec:
  template:
    spec:
      containers:
        - name: frontend
          image: 837126493345.dkr.ecr.ap-northeast-2.amazonaws.com/goormthon-2/frontend:latest #FIXME:
```

**ingress.yaml**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: frontend-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
    - host: goormthon-2.goorm.training #FIXME:
```

**kustomization.yaml**

```yaml
namespace: goormthon-2 #FIXME:
```

### 2. 프론트엔드 설정 변경

`config/frontend-config.json` 파일을 수정하여 환경 변수를 설정할 수 있습니다:

**예시**

```json
{
  "REACT_APP_API_URL": "https://goormthon-01.goorm.training/api",
  "REACT_APP_APP_NAME": "Goormthon App",
  "REACT_APP_VERSION": "1.0.0",
  "REACT_APP_ENVIRONMENT": "production"
}
```

### 3. Replica 수 조정

`frontend.yaml` 파일에서 `replicas:` 값을 원하는 수로 변경하세요.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend-deployment
spec:
  replicas: 1 #FIXME: replica 수 조정
```

<br>

## 📝 주의사항

### ConfigMap 변경 시

ConfigMap을 수정한 후에는 Deployment를 재시작하여 변경 사항이 반영되도록 해야 합니다.

```bash
kubectl rollout restart deployment frontend-deployment -n goormthon-2
```

### Port 매핑

- Service 포트: 80 (외부 접근용)
- Container 포트: 3000 (React 개발 서버 기본 포트)
- 프론트엔드 애플리케이션은 반드시 3000 포트에서 실행되어야 합니다

<br>

## 📦 배포 방법

```bash
# frontend 디렉토리로 이동
cd k8s/frontend

# Kustomize를 사용하여 배포
kubectl apply -k .
```
