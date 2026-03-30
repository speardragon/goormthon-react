# Backend

Kubernetes 환경에서 백엔드 애플리케이션을 Kustomize 구조로 배포하기 위한 설정입니다.

Deployment 기반으로 구성되어 있으며, ConfigMap을 통한 설정 관리와 Ingress를 통한 외부 접근을 제공합니다.

<br>

## 📁 Directory Structure

```bash
backend/
├── README.md
├── backend.yaml           # Deployment & Service 정의
├── ingress.yaml          # Ingress 정의 (외부 접근용)
├── kustomization.yaml    # Kustomization 정의
└── config/
    └── backend-config.json   # 백엔드 설정 파일
```

<br>

## 🔧 리소스 구성

### Deployment & Service

- Deployment: 백엔드 애플리케이션 Pod 관리 (기본 1개 replica)

- Service: 클러스터 내부 통신을 위한 ClusterIP 서비스 (포트 80 → 8080)

### ConfigMap

- backend-config: JSON 형태의 설정 파일을 Pod 내부 /app/config 경로에 마운트

### Ingress

- 외부 접근: goormthon-4.goorm.training/api/\* 경로로 백엔드 API 접근 가능

- 기본적으로 주석 처리되어 있으며, Client-Side 호출 시에만 활성화

<br>

## ⚙️ 커스터마이징 방법

### 1. 구름톤 팀 번호 설정

다음 파일에서 `goormthon-4`를 실제 팀 번호로 변경하세요

> ex. goormthon-4, goormthon-4 등

**backend.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-deployment
spec:
  template:
    spec:
      containers:
        - name: backend
          image: 837126493345.dkr.ecr.ap-northeast-2.amazonaws.com/goormthon-4/backend:latest #FIXME:
```

**ingress.yaml**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: backend-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
    - host: goormthon-4.goorm.training #FIXME:
```

**kustomization.yaml**

```yaml
namespace: goormthon-4 #FIXME:
```

### 2. 환경 변수 설정

`config/backend-config.json` 파일을 수정하여 필요한 환경 변수를 설정할 수 있습니다.

**예시**

```json
{
  "GREETING": "Hello from Backend",
  "PORT": 8080,
  "DATABASE_URL": "redis://redis-service:6379",
  "LOG_LEVEL": "info"
}
```

### 3. Replica 수 조정

`backend.yaml` 파일에서 `replicas:` 값을 원하는 수로 변경하세요.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-deployment
spec:
  replicas: 1 #FIXME: replica 수 조정
```

<br>

## 📝 주의사항

### ConfigMap 변경 시

ConfigMap을 수정한 후에는 Deployment를 재시작하여 변경 사항이 반영되도록 해야 합니다.

```bash
kubectl rollout restart deployment backend-deployment -n goormthon-4
```

### Ingress 설정

Client-Side 렌더링을 사용하는 경우 kustomization.yaml에서 ingress.yaml을 주석 해제하세요

```yaml
resources:
  - backend.yaml
  - ingress.yaml # Client-Side 렌더링 시 주석 해제
```

### Port 매핑

- Service 포트: 80 (클러스터 내부 통신용)
- Container 포트: 8080 (애플리케이션 실제 포트)
- 백엔드 애플리케이션은 반드시 8080 포트에서 실행되어야 합니다.

<br>

## 📦 배포 방법

```bash
# backend 디렉토리로 이동
cd k8s/backend

# Kustomize를 사용하여 배포
kubectl apply -k .
```
